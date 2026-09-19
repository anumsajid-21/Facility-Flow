import { Body, Controller, Get, Param, Post, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/user.decorator";
import { SlaService } from "./sla.service";

class SlaPolicyDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsInt() @Min(1) responseHours?: number;
  @IsInt() @Min(1) resolutionHours: number;
  @IsOptional() @IsInt() @Min(1) warningHours?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/sla")
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  @Get("policies")
  @Roles("PROVIDER", "ADMIN")
  policies(@CurrentUser() user: AuthUser) { return this.sla.policies(user); }

  @Post("policies")
  @Roles("PROVIDER")
  createPolicy(@CurrentUser() user: AuthUser, @Body() dto: SlaPolicyDto) { return this.sla.createPolicy(user, dto); }

  @Get("jobs/:id")
  @Roles("HIRING_ORG", "PROVIDER", "ADMIN")
  job(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) { return this.sla.getForJob(user, id); }

  @Post("evaluate")
  @Roles("ADMIN")
  evaluate() { return this.sla.evaluateBreaches(); }
}
