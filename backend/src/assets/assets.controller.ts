import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe, Res } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { AssetsService, AssetFilter } from "./assets.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { IsDateString, IsOptional, IsString } from "class-validator";

class AssetDto {
  @IsString() assetId: string;
  @IsString() name: string;
  @IsOptional() category?: string;
  @IsOptional() brand?: string;
  @IsOptional() model?: string;
  @IsOptional() serialNumber?: string;
  @IsOptional() location?: string;
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() warranty?: string;
  @IsOptional() maintenanceFrequency?: string;
  @IsOptional() status?: string;
  @IsOptional() notes?: string;
  @IsOptional() areaId?: string;
}

const ASSET_CATEGORIES = ["AC", "HVAC", "Generator", "Pump", "Electrical panel", "Elevator", "Other"];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("HIRING_ORG", "ADMIN")
@Controller("api/v1/assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto, @Query("category") category?: string, @Query("status") status?: string, @Query("buildingId") buildingId?: string, @Query("search") search?: string) {
    return this.assets.list(user, { category, status, buildingId, search } as AssetFilter, q);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: AssetDto) {
    return this.assets.create(user, dto);
  }

  @Get("categories")
  categories() {
    return ASSET_CATEGORIES;
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.assets.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: AssetDto) {
    return this.assets.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.assets.archive(user, id);
  }

  @Get(":id/history")
  history(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.assets.history(user, id);
  }

  @Get(":id/qrcode")
  async qrcode(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: any) {
    const png = await this.assets.qrcode(user, id);
    res.setHeader("Content-Type", "image/png");
    return png;
  }
}
