import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, NotFoundException, BadRequestException, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { ContractsService } from "./contracts.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

class ContractDto {
  @IsUUID() quotationId: string;
  @IsString() buildingId: string;
  @IsString() serviceName: string;
  @IsNumber() price: number;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() frequency?: string;
  @IsOptional() @IsInt() occurrencesLimit?: number;
  @IsOptional() customRecurrence?: string;
  @IsOptional() sla?: string;
  @IsOptional() paymentTerms?: string;
  @IsOptional() cancellationTerms?: string;
  @IsOptional() responsibilities?: string;
  @IsOptional() renewalTerms?: string;
  @IsOptional() title?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/contracts")
export class ContractsController {
  constructor(private readonly cs: ContractsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.cs.list(user, q);
  }

  @Post()
  @Roles("HIRING_ORG", "ADMIN")
  create(@CurrentUser() user: AuthUser, @Body() dto: ContractDto) {
    return this.cs.createFromQuotation(user, dto);
  }

  @Get(":id/activity")
  activity(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.cs.activity(user, id);
  }

  @Get(":id/versions")
  versions(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.cs.versions(user, id);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.cs.get(user, id);
  }

  @Post(":id/snapshot")
  @Roles("HIRING_ORG", "ADMIN")
  snapshot(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.cs.snapshot(user, id);
  }

  @Patch(":id")
  @Roles("HIRING_ORG", "ADMIN")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: Partial<ContractDto>) {
    return this.cs.update(user, id, dto);
  }
}
