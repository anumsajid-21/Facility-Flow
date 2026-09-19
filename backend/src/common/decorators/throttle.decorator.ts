import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  /** Max requests per window. */
  limit: number;
  /** Window in seconds. */
  ttl: number;
}

/**
 * Per-route rate limiting. Applied globally on auth routes by default;
 * other routes can opt in with @Throttle({ limit, ttl }).
 */
export const Throttle = (options: ThrottleOptions) => SetMetadata(THROTTLE_KEY, options);