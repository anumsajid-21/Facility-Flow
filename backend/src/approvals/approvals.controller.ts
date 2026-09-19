import { Body, Controller, Get, Param, Post, UseGuards, ParseUUIDPipe, Query } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { ApprovalsService } from "./approvals.service";
import { IsString } from "class-validator";

class ApproveDto {
  @IsString() type: "approve" | "rework";
  @IsString() notes: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/jobs")
export class ApprovalsController {
  constructor(private readonly as: ApprovalsService) {}

  @Get(":jobId/approvals")
  approvals(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.as.list(user, jobId);
  }

  @Post(":jobId/approve")
  @Roles("HIRING_ORG", "ADMIN")
  approve(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string, @Body() dto: ApproveDto) {
    if (dto.type !== "approve") throw new Error("Use rework endpoint");
    return this.as.approve(user, jobId, dto.notes);
  }

  @Post(":jobId/rework")
  @Roles("HIRING_ORG", "ADMIN")
  rework(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string, @Body() dto: ApproveDto) {
    if (dto.type !== "rework") throw new Error("Use approve endpoint");
    return this.as.requestRework(user, jobId, dto.notes);
  }
}
