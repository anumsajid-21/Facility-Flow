import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, NotFoundException, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { WorkersService } from "./workers.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { IsOptional, IsString } from "class-validator";

class WorkerDto {
  @IsString() name: string;
  @IsOptional() skills?: string;
  @IsOptional() certifications?: string;
  @IsOptional() availability?: string;
  @IsOptional() status?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/workers")
export class WorkersController {
  constructor(private readonly ws: WorkersService) {}

  @Get()
  @Roles("PROVIDER")
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.ws.list(user, q);
  }

  @Post()
  @Roles("PROVIDER")
  create(@CurrentUser() user: AuthUser, @Body() dto: WorkerDto) {
    return this.ws.create(user, dto);
  }

  @Get(":id")
  @Roles("PROVIDER")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.ws.get(user, id);
  }

  @Post(":id/invite")
  @Roles("PROVIDER")
  invite(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: { email: string }) {
    return this.ws.invite(user, id, dto);
  }

  @Patch(":id/status")
  @Roles("PROVIDER")
  setStatus(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: { status: string }) {
    return this.ws.setStatus(user, id, dto.status);
  }

  @Patch(":id")
  @Roles("PROVIDER")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: Partial<WorkerDto>) {
    return this.ws.update(user, id, dto);
  }

  @Get(":id/assignments")
  @Roles("PROVIDER")
  assignments(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.ws.assignments(user, id);
  }
}
