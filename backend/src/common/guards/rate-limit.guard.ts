import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { THROTTLE_KEY, ThrottleOptions } from '../decorators/throttle.decorator';

interface Bucket {
  timestamps: number[];
}

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * This guard intentionally has no external dependencies. For distributed
 * deployments it can be swapped for a shared store (Redis) without changing
 * route declarations. Limits restart with the process — acceptable for the
 * initial production monolith and clearly documented.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private buckets = new Map<string, Bucket>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= options.limit) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests, please try again later.', error: 'Too Many Requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
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