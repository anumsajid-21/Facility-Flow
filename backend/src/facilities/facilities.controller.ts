import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPage } from '../common/dto/pagination.dto';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class BuildingDto {
  @IsString() name: string;
  @IsString() address: string;
  @IsString() city: string;
  @IsOptional() buildingType?: string;
  @IsOptional() @Type(() => Number) @IsInt() numberOfFloors?: number;
  @IsOptional() operatingInfo?: string;
  @IsOptional() notes?: string;
}

class FloorDto {
  @IsString() name: string;
}

class AreaDto {
  @IsString() name: string;
  @IsOptional() category?: string;
}

const AREA_CATEGORY = ['Office', 'Lobby', 'Washroom', 'Parking', 'Equipment room', 'Other'];

/**
 * Facility hierarchy: Buildings → Floors → Areas.
 * All scoped to the hiring organization that owns the building (tenant isolation).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HIRING_ORG', 'ADMIN')
@Controller('api/v1/facilities')
export class FacilitiesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ---------- Buildings ----------
  @Get('buildings')
  async listBuildings(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    const take = q.limit;
    const skip = (q.page - 1) * take;
    const where = { ...(user.role === 'ADMIN' ? {} : { organizationId: user.hiringOrgId! }), isArchived: false };
    const [total, buildings] = await Promise.all([
      this.prisma.building.count({ where }),
      this.prisma.building.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { floors: { where: { isArchived: false }, include: { areas: { where: { isArchived: false } } } } } }),
    ]);
    return buildPage(buildings, total, q.page, take);
  }

  @Post('buildings')
  async createBuilding(@CurrentUser() user: AuthUser, @Body() dto: BuildingDto) {
    const building = await this.prisma.building.create({
      data: { ...dto, numberOfFloors: dto.numberOfFloors ?? null, organizationId: user.hiringOrgId! },
    });
    void this.audit.log({ actorId: user.userId, action: 'BUILDING_CREATED', entityType: 'Building', entityId: building.id, details: dto });
    return building;
  }

  @Get('buildings/:id')
  async getBuilding(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const building = await this.prisma.building.findFirst({
      where: { id, organizationId: user.hiringOrgId! },
      include: { floors: { include: { areas: true } } },
    });
    if (!building) throw new NotFoundException('Building not found');
    return building;
  }

  @Patch('buildings/:id')
  async updateBuilding(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BuildingDto) {
    const building = await this.prisma.building.updateMany({
      where: { id, organizationId: user.hiringOrgId! },
      data: {
        name: dto.name, address: dto.address, city: dto.city, buildingType: dto.buildingType ?? null,
        numberOfFloors: dto.numberOfFloors ?? null, operatingInfo: dto.operatingInfo ?? null, notes: dto.notes ?? null,
      },
    });
    if (!building.count) throw new NotFoundException('Building not found');
    void this.audit.log({ actorId: user.userId, action: 'BUILDING_UPDATED', entityType: 'Building', entityId: id, details: dto });
    return { id };
  }

  @Post('buildings/:id/archive')
  async archiveBuilding(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const building = await this.prisma.building.updateMany({
      where: { id, organizationId: user.hiringOrgId! },
      data: { isArchived: true },
    });
    if (!building.count) throw new NotFoundException('Building not found');
    void this.audit.log({ actorId: user.userId, action: 'BUILDING_ARCHIVED', entityType: 'Building', entityId: id });
    return { id, archived: true };
  }

  /** Delete (soft) a building. Tenant-isolated: only the owning organization may delete. */
  @Delete('buildings/:id')
  async deleteBuilding(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const building = await this.prisma.building.findFirst({
      where: { id, organizationId: user.hiringOrgId! },
      select: { id: true },
    });
    if (!building) throw new NotFoundException('Building not found');
    await this.prisma.$transaction([
      this.prisma.floor.updateMany({ where: { buildingId: id }, data: { isArchived: true } }),
      this.prisma.area.updateMany({
        where: { floor: { buildingId: id } },
        data: { isArchived: true },
      }),
      this.prisma.building.update({ where: { id }, data: { isArchived: true } }),
    ]);
    void this.audit.log({ actorId: user.userId, action: 'BUILDING_DELETED', entityType: 'Building', entityId: id });
    return { id, deleted: true };
  }

  // ---------- Floors ----------
  @Get('buildings/:buildingId/floors')
  async listFloors(@CurrentUser() user: AuthUser, @Param('buildingId', ParseUUIDPipe) buildingId: string) {
    await this.ensureBuilding(buildingId, user);
    return this.prisma.floor.findMany({ where: { buildingId, isArchived: false } });
  }

  @Post('buildings/:buildingId/floors')
  async createFloor(@CurrentUser() user: AuthUser, @Param('buildingId', ParseUUIDPipe) buildingId: string, @Body() dto: FloorDto) {
    await this.ensureBuilding(buildingId, user);
    const floor = await this.prisma.floor.create({ data: { name: dto.name, buildingId } });
    void this.audit.log({ actorId: user.userId, action: 'FLOOR_CREATED', entityType: 'Floor', entityId: floor.id, details: dto });
    return floor;
  }

  @Patch('floors/:id')
  async updateFloor(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FloorDto) {
    await this.ensureFloor(id, user);
    const floor = await this.prisma.floor.updateMany({ where: { id }, data: { name: dto.name } });
    if (!floor.count) throw new NotFoundException('Floor not found');
    return { id };
  }

  @Post('floors/:id/archive')
  async archiveFloor(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.ensureFloor(id, user);
    const floor = await this.prisma.floor.updateMany({ where: { id }, data: { isArchived: true } });
    if (!floor.count) throw new NotFoundException('Floor not found');
    return { id, archived: true };
  }

  @Get('floors/:floorId/areas')
  async listAreas(@CurrentUser() user: AuthUser, @Param('floorId', ParseUUIDPipe) floorId: string) {
    await this.ensureFloor(floorId, user);
    return this.prisma.area.findMany({ where: { floorId, isArchived: false } });
  }

  @Post('floors/:floorId/areas')
  async createArea(@CurrentUser() user: AuthUser, @Param('floorId', ParseUUIDPipe) floorId: string, @Body() dto: AreaDto) {
    await this.ensureFloor(floorId, user);
    const area = await this.prisma.area.create({ data: { name: dto.name, floorId, category: dto.category ?? null } });
    void this.audit.log({ actorId: user.userId, action: 'AREA_CREATED', entityType: 'Area', entityId: area.id, details: dto });
    return area;
  }

  @Patch('areas/:id')
  async updateArea(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AreaDto) {
    await this.ensureArea(id, user);
    const area = await this.prisma.area.updateMany({ where: { id }, data: { name: dto.name, category: dto.category ?? null } });
    if (!area.count) throw new NotFoundException('Area not found');
    return { id };
  }

  @Get('area-categories')
  async areaCategories() {
    return AREA_CATEGORY;
  }

  private async ensureBuilding(buildingId: string, user: AuthUser) {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, organizationId: true } });
    if (!building || building.organizationId !== user.hiringOrgId) throw new NotFoundException('Building not found');
  }
  private async ensureFloor(floorId: string, user: AuthUser) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      select: { id: true, building: { select: { organizationId: true } } },
    });
    if (!floor || floor.building.organizationId !== user.hiringOrgId) throw new NotFoundException('Floor not found');
  }

  private async ensureArea(areaId: string, user: AuthUser) {
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true, floor: { select: { building: { select: { organizationId: true } } } } },
    });
    if (!area || area.floor.building.organizationId !== user.hiringOrgId) throw new NotFoundException('Area not found');
  }
}