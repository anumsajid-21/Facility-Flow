import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { THROTTLE_KEY, ThrottleOptions } from '../decorators/throttle.decorator';

interface Bucket {
  timestamps: number[];
}

function tooManyRequests(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests, please try again later.',
      error: 'Too Many Requests',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * Sliding-window rate limiter.
 *
 * Backing store:
 *  - REDIS_URL set  -> shared Redis (ZSET sliding window), correct across
 *    multiple instances and restarts. Use this in production.
 *  - otherwise      -> in-memory per-process map, fine for a single instance.
 *
 * Redis failures fail OPEN (request allowed) with a logged warning — a
 * rate-limiter outage must never take the API down.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private buckets = new Map<string, Bucket>();
  private redis: Redis | null = null;

  constructor(private reflector: Reflector) {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err: Error) => {
        this.logger.warn(`Redis rate-limit store unavailable (${err.message}) — failing open`);
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options: ThrottleOptions | undefined = this.reflector.getAllAndOverride(
      THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const key = this.keyFor(req, context);
    const now = Date.now();
    const windowMs = options.ttl * 1000;

    if (this.redis && this.redis.status === 'ready') {
      return this.checkRedis(key, now, windowMs, options.limit);
    }
    return this.checkMemory(key, now, windowMs, options.limit);
  }

  /** Shared sliding window: ZADD now / ZREMRANGEBYSCORE old / ZCARD count. */
  private async checkRedis(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean> {
    const redisKey = `ratelimit:${key}`;
    try {
      const results = (await this.redis!
        .multi()
        .zremrangebyscore(redisKey, 0, now - windowMs)
        .zadd(redisKey, String(now), `${now}-${Math.random().toString(36).slice(2, 8)}`)
        .zcard(redisKey)
        .pexpire(redisKey, windowMs + 1000)
        .exec()) as Array<[null, number]>;
      const count = Number(results?.[2]?.[1] ?? 0);
      if (count > limit) {
        throw tooManyRequests();
      }
      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Rate-limit Redis error (${(err as Error).message}) — failing open`);
      return true;
    }
  }

  /** Per-process fallback (single instance / dev). */
  private checkMemory(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): boolean {
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= limit) {
      throw tooManyRequests();
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);

    // Opportunistic cleanup so idle keys don't leak memory.
    if (this.buckets.size > 10000) {
      for (const [k, b] of this.buckets) {
        if (!b.timestamps.some((t) => now - t < windowMs)) this.buckets.delete(k);
      }
    }
    return true;
  }

  private keyFor(req: any, context: ExecutionContext): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const ip =
      req.ip || req.connection?.remoteAddress || req.headers?.['x-forwarded-for'] || 'unknown';
    const user = req.user?.userId ? `:u${req.user.userId}` : '';
    return `${controller}.${handler}:${ip}${user}`;
  }
}
