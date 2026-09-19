import { Body, Controller, Get, Param, Post, UseGuards, ParseUUIDPipe, UploadedFiles } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { ProofOfWorkService } from "./proof-of-work.service";
import { IsOptional, IsString, IsArray } from "class-validator";

class ProofDto {
  @IsOptional() providerNote?: string;
  @IsOptional() completionNote?: string;
  @IsString() workerName: string;
  @IsOptional() @IsArray() beforePhotoIds?: string[];
  @IsOptional() @IsArray() afterPhotoIds?: string[];

}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/jobs")
export class ProofOfWorkController {
  constructor(private readonly pow: ProofOfWorkService) {}

  @Post(":jobId/proof")
  @Roles("PROVIDER", "WORKER")
  async add(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string, @Body() dto: ProofDto, @Body("beforePhotoIds") beforePhotoIds: string[] = [], @Body("afterPhotoIds") afterPhotoIds: string[] = []) {
    return this.pow.add(user, jobId, dto, beforePhotoIds, afterPhotoIds);
  }

  @Get(":jobId/proof")
  async get(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.pow.get(user, jobId);
  }

  @Get("proof/by-provider/:providerId")
  async byProvider(@Param("providerId", ParseUUIDPipe) providerId: string) {
    return this.pow.byProvider(providerId);
  }
}
