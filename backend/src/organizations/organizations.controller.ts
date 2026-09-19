import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { IsNotEmpty, IsString } from 'class-validator';

class UpdateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

/**
 * Hiring-organization self-management (the tenant the user is attached to).
 */
@UseGuards(JwtAuthGuard)
@UseGuards(RolesGuard)
@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.hiringOrgId! },
      include: {
        buildings: { where: { isArchived: false } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });
    return org;
  }

  @Roles('HIRING_ORG', 'ADMIN')
  @Patch('me')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.update({
      where: { id: user.hiringOrgId! },
      data: { name: dto.name },
    });
    void this.audit.log({
      actorId: user.userId,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'Organization',
      entityId: org.id,
      details: { name: dto.name },
    });
    return org;
  }
}