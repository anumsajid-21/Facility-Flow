import { Body, Controller, Get, Param, Patch, Post, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { RecurrenceFrequency } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/user.decorator";
import { RecurringService } from "./recurring.service";

class ScheduleDto {
  @IsEnum(RecurrenceFrequency) frequency: RecurrenceFrequency;
  @IsDateString() startsAt: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsInt() @Min(1) occurrencesLimit?: number;
}
class PauseDto { @IsBoolean() paused: boolean; }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("HIRING_ORG", "PROVIDER", "ADMIN")
@Controller("api/v1/recurring")
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}
  @Get("contracts/:contractId") get(@CurrentUser() user: AuthUser, @Param("contractId", ParseUUIDPipe) id: string) { return this.recurring.get(user, id); }
  @Post("contracts/:contractId") create(@CurrentUser() user: AuthUser, @Param("contractId", ParseUUIDPipe) id: string, @Body() dto: ScheduleDto) { return this.recurring.create(user, id, dto); }
  @Patch("contracts/:contractId") pause(@CurrentUser() user: AuthUser, @Param("contractId", ParseUUIDPipe) id: string, @Body() dto: PauseDto) { return this.recurring.pause(user, id, dto.paused); }
}
