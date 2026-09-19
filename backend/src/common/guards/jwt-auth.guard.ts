import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Rejects requests without a valid JWT bearer token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('You must be signed in to access this resource');
    }
    return user;
  }
}