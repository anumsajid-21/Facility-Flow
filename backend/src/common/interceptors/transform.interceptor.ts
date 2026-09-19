import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Paginated {
  data: unknown;
  meta?: PaginationMeta;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface TransformResponse {
  data: unknown;
  meta?: PaginationMeta;
}

/**
 * Wraps every successful controller response in a consistent envelope:
 *   { data: <payload>, meta?: <pagination info> }
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const res = http.getResponse();
    return next.handle().pipe(
      map((payload) => {
        if (res.headersSent || payload === undefined) {
          return payload;
        }
        if (payload && typeof payload === 'object' && 'meta' in payload && 'data' in payload) {
          const p = payload as Paginated;
          return { data: this.toSafeJson(p.data), meta: p.meta };
        }
        return { data: this.toSafeJson(payload) };
      }),
    );
  }

  private toSafeJson(value: unknown): unknown {
    if (value === undefined) return null;
    return JSON.parse(
      JSON.stringify(value, (_key, val) =>
        val && typeof val === 'object' && typeof val.toNumber === 'function'
          ? Number(val.toNumber())
          : val,
      ),
    );
  }
}