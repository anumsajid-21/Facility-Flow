import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/user.decorator';

/**
 * Validates the JWT, then resolves the live user record from the database.
 *
 * Returning the full AuthUser (incl. current tenant ids and active flag) on
 * every request guarantees authorization reflects the latest state — a
 * revoked/suspended account stops working immediately even if its token is
 * not expired.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-insecure-do-not-use-in-prod',
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, hiringOrgId: true, providerId: true, isActive: true, workerProfile: { select: { id: true, providerId: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or inactive');
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthUser['role'],
      hiringOrgId: user.hiringOrgId,
      providerId: user.providerId || user.workerProfile?.providerId || null,
      workerId: user.workerProfile?.id || null,
      isActive: user.isActive,
    };
  }
}