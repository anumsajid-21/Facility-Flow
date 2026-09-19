import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcryptjs';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Role } from '@prisma/client';

export interface AuthPayload {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    hiringOrgId: string | null;
    providerId: string | null;
  };
}

const BCRYPT_ROUNDS = 12;

/**
 * Authentication and role-based account provisioning. Passwords are hashed
 * with bcrypt; the JWT carries only the user id and email — authorization is
 * resolved server-side from the DB on every request (see JwtStrategy).
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private sign(user: { id: string; email: string; role: Role }): string {
    return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }

  async register(dto: RegisterDto): Promise<AuthPayload> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let hiringOrgId: string | null = null;
    let providerId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (dto.role === 'HIRING_ORG') {
        const org = await tx.organization.create({ data: { name: dto.companyName } });
        hiringOrgId = org.id;
      } else if (dto.role === 'PROVIDER') {
        const provider = await tx.provider.create({
          data: {
            name: dto.companyName,
            verificationStatus: 'VERIFIED',
            workforceCapacity: 20,
          },
        });
        providerId = provider.id;
      }

      const user = await tx.user.create({
        data: {
          email: dto.email,
          password,
          name: dto.name,
          role: dto.role as Role,
          hiringOrgId,
          providerId,
        },
      });

      if (hiringOrgId) {
        await tx.organizationMember.create({
          data: { organizationId: hiringOrgId, userId: user.id, role: 'ADMIN' },
        });
      }

      void this.audit.log({
        actorId: user.id,
        action: 'REGISTER',
        entityType: 'User',
        entityId: user.id,
        details: { role: dto.role, companyName: dto.companyName },
      });
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, role: true, hiringOrgId: true, providerId: true },
    });

    void this.notifications.notify({
      userId: user.id,
      type: 'ACCOUNT_CREATED',
      title: 'Welcome to FacilityFlow',
      message: 'Your account was created successfully.',
    });

    return {
      access_token: this.sign(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, hiringOrgId, providerId },
    };
  }

  async login(dto: LoginDto): Promise<AuthPayload> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, password: true, role: true, hiringOrgId: true, providerId: true, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Incorrect password or username');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password or username');
    }
    return {
      access_token: this.sign(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hiringOrgId: user.hiringOrgId,
        providerId: user.providerId,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true, email: true } });
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await this.notifications.notify({ userId: user.id, type: 'PASSWORD_RESET', title: 'Reset your password', message: `Use this link within one hour: ${baseUrl}/reset-password?token=${rawToken}` });
    }
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  async resetPassword(rawToken: string, password: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new UnauthorizedException('This reset link is invalid or expired');
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { password: hash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { message: 'Password reset successfully.' };
  }

  async me(userId: string): Promise<AuthPayload['user']> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, hiringOrgId: true, providerId: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hiringOrgId: user.hiringOrgId,
      providerId: user.providerId,
    };
  }
}