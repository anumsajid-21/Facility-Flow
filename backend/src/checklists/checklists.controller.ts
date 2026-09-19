import { Body, Controller, Get, Param, Patch, Post, UseGuards, NotFoundException, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { ChecklistsService } from "./checklists.service";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

class ChecklistDto {
  @IsString() name: string;
  @IsOptional() categoryId?: string;
  @IsOptional() description?: string;
}

class ItemDto {
  @IsString() description: string;
  @IsInt() sortOrder: number;
}

class ChecklistItemResultDto {
  @IsString() checklistItemId: string;
  @IsBoolean() isChecked: boolean;
  @IsOptional() notes?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/checklists")
export class ChecklistsController {
  constructor(private readonly cs: ChecklistsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.cs.list(user);
  }

  @Post()
  @Roles("PROVIDER")
  create(@CurrentUser() user: AuthUser, @Body() dto: ChecklistDto, @Body("items") items: ItemDto[]) {
    return this.cs.create(user, dto, items);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.cs.get(user, id);
  }

  @Get("category/:categoryId")
  byCategory(@CurrentUser() user: AuthUser, @Param("categoryId", ParseUUIDPipe) categoryId: string) {
    return this.cs.byCategory(user, categoryId);
  }

  @Post("jobs/:jobId/results")
  @Roles("PROVIDER")
  saveResults(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string, @Body("results") results: ChecklistItemResultDto[]) {
    return this.cs.saveResults(user, jobId, results);
  }

  @Get("jobs/:jobId/results")
  jobResults(@CurrentUser() user: AuthUser, @Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.cs.jobResults(user, jobId);
  }
}
