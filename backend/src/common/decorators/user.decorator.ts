import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Role = 'HIRING_ORG' | 'PROVIDER' | 'ADMIN' | 'WORKER';

/**
 * The authenticated principal attached to requests by JwtStrategy.
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  hiringOrgId: string | null;
  providerId: string | null;
  workerId?: string | null;
  isActive: boolean;
}

/**
 * Extracts the authenticated user from the request.
 *
 * @example (userId: string, @CurrentUser() user: AuthUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);