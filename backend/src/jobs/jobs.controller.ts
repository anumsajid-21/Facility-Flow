import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, NotFoundException, BadRequestException, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { JobsService } from "./jobs.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID } from "class-validator";

class JobDto {
  @IsUUID() contractId: string;
  @IsUUID() buildingId: string;
  @IsOptional() floorId?: string;
  @IsOptional() areaId?: string;
  @IsString() title: string;
  @IsOptional() location?: string;
  @IsDateString() date: string;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsOptional() instructions?: string;
  @IsOptional() requiredSkills?: string;
  @IsOptional() serviceName?: string;
}

class AssignWorkerDto {
  @IsUUID() workerId: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/jobs")
export class JobsController {
  constructor(private readonly js: JobsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.js.list(user, q);
  }

  @Post()
  @Roles("HIRING_ORG", "ADMIN")
  create(@CurrentUser() user: AuthUser, @Body() dto: JobDto) {
    return this.js.create(user, dto);
  }

  @Get("calendar/daily")
  calendar(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    return this.js.calendar(user, date);
  }

  @Get(":id/activity")
  activity(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.js.activity(user, id);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.js.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: Partial<JobDto>) {
    return this.js.update(user, id, dto);
  }

  @Post(":id/start")
  start(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.js.start(user, id);
  }

  @Post(":id/complete")
  complete(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.js.complete(user, id);
  }

  @Post(":id/assign-worker")
  @Roles("PROVIDER")
  assignWorker(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignWorkerDto) {
    return this.js.assignWorker(user, id, dto.workerId);
  }

  @Get(":id/workers")
  @Roles("PROVIDER")
  assignedWorkers(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.js.assignedWorkers(user, id);
  }
}
