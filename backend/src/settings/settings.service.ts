import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/user.decorator';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getMe(user: AuthUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        hiringOrg: true,
        provider: {
          include: {
            services: { include: { category: true } },
            serviceAreas: true,
          },
        },
        notificationPreference: true,
      },
    });
    if (!dbUser) throw new NotFoundException('User not found');
    const { password, ...safeUser } = dbUser;
    return safeUser;
  }

  async updateProfile(user: AuthUser, dto: any) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) throw new NotFoundException('User not found');

    const userData: any = {};
    if (dto.name !== undefined) userData.name = dto.name;
    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.phone !== undefined) userData.phone = dto.phone;
    if (dto.avatarUrl !== undefined) userData.avatarUrl = dto.avatarUrl;

    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: user.userId },
        data: userData,
      });
    }

    if (user.role === 'HIRING_ORG' && user.hiringOrgId && dto.hiringOrg) {
      const orgData: any = {};
      if (dto.hiringOrg.name !== undefined) orgData.name = dto.hiringOrg.name;
      if (dto.hiringOrg.description !== undefined) orgData.description = dto.hiringOrg.description;
      if (dto.hiringOrg.contactEmail !== undefined) orgData.contactEmail = dto.hiringOrg.contactEmail;
      if (dto.hiringOrg.contactPhone !== undefined) orgData.contactPhone = dto.hiringOrg.contactPhone;
      if (dto.hiringOrg.logoUrl !== undefined) orgData.logoUrl = dto.hiringOrg.logoUrl;

      if (Object.keys(orgData).length > 0) {
        await this.prisma.organization.update({
          where: { id: user.hiringOrgId },
          data: orgData,
        });
      }
    }

    if (user.role === 'PROVIDER' && user.providerId && dto.provider) {
      const provData: any = {};
      if (dto.provider.name !== undefined) provData.name = dto.provider.name;
      if (dto.provider.description !== undefined) provData.description = dto.provider.description;
      if (dto.provider.contactInfo !== undefined) provData.contactInfo = dto.provider.contactInfo;
      if (dto.provider.logoUrl !== undefined) provData.logoUrl = dto.provider.logoUrl;
      if (dto.provider.bankName !== undefined) provData.bankName = dto.provider.bankName;
      if (dto.provider.accountNumber !== undefined) provData.accountNumber = dto.provider.accountNumber;
      if (dto.provider.routingNumber !== undefined) provData.routingNumber = dto.provider.routingNumber;

      if (Object.keys(provData).length > 0) {
        await this.prisma.provider.update({
          where: { id: user.providerId },
          data: provData,
        });
      }

      if (Array.isArray(dto.provider.categoryIds)) {
        await this.prisma.providerService.deleteMany({ where: { providerId: user.providerId } });
        for (const catId of dto.provider.categoryIds) {
          await this.prisma.providerService.create({
            data: { providerId: user.providerId, categoryId: catId },
          });
        }
      }

      if (Array.isArray(dto.provider.serviceAreas)) {
        await this.prisma.providerServiceArea.deleteMany({ where: { providerId: user.providerId } });
        for (const area of dto.provider.serviceAreas) {
          await this.prisma.providerServiceArea.create({
            data: { providerId: user.providerId, areaName: area },
          });
        }
      }
    }

    return this.getMe(user);
  }

  async changePassword(user: AuthUser, dto: any) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(dto.currentPassword, dbUser.password);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(dto.newPassword) || !/[a-z]/.test(dto.newPassword) || !/[0-9]/.test(dto.newPassword)) {
      throw new BadRequestException('Password must contain uppercase, lowercase, and numbers');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { password: newHash },
    });
    return { success: true, message: 'Password updated successfully' };
  }

  async getNotificationPreferences(user: AuthUser) {
    let pref = await this.prisma.notificationPreference.findUnique({ where: { userId: user.userId } });
    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId: user.userId,
          inApp: true,
          email: true,
          categories: {
            QUOTATION_RECEIVED: { inApp: true, email: true },
            JOB_STATUS_CHANGE: { inApp: true, email: true },
            APPROVAL: { inApp: true, email: true },
            PAYMENT: { inApp: true, email: true },
          },
        },
      });
    }
    return pref;
  }

  async updateNotificationPreferences(user: AuthUser, dto: any) {
    const current = await this.getNotificationPreferences(user);
    const updated = await this.prisma.notificationPreference.update({
      where: { userId: user.userId },
      data: {
        inApp: dto.inApp !== undefined ? dto.inApp : current.inApp,
        email: dto.email !== undefined ? dto.email : current.email,
        categories: dto.categories !== undefined ? dto.categories : (current.categories as any),
      },
    });
    return updated;
  }
}
