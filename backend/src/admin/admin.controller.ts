import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { AdminService } from "./admin.service";
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto";

class VerifyProviderDto {
  @IsEnum({ values: ["VERIFIED", "REJECTED", "SUSPENDED", "UNDER_REVIEW"] })
  status: string;
  @IsString() notes: string;
}
class BulkReviewDto {
  @IsArray() @IsUUID("4", { each: true }) ids: string[];
  @IsEnum({ values: ["APPROVED", "REJECTED"] }) status: "APPROVED" | "REJECTED";
  @IsOptional() @IsString() notes?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("api/v1/admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("activity")
  async activity() {
    return this.admin.recentActivity();
  }

  @Get("dashboard")
  async dashboard() {
    return this.admin.dashboard();
  }

  @Get("providers")
  async providers() {
    return this.admin.providers();
  }

  @Get("organizations")
  async organizations() {
    return this.admin.organizations();
  }

  @Get("users")
  async users() {
    return this.admin.users();
  }

  @Get("service-requests")
  async serviceRequests(@Query() q: PaginationDto) {
    return this.admin.serviceRequests(q);
  }

  @Get("buildings")
  async buildings(@Query() q: PaginationDto) {
    return this.admin.buildings(q);
  }

  @Patch("providers/:id/status")
  async verifyProvider(@Param("id", ParseUUIDPipe) id: string, @Body() dto: VerifyProviderDto) {
    return this.admin.verifyProvider(id, dto.status, dto.notes);
  }

  @Get("verification-queue")
  verificationQueue() {
    return this.admin.verificationQueue();
  }

  @Post("verification-documents/bulk-review")
  bulkReview(@CurrentUser() user: AuthUser, @Body() dto: BulkReviewDto) {
    return this.admin.bulkReviewDocuments(dto.ids, dto.status, dto.notes, user.userId);
  }
}