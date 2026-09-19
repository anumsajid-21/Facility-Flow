import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { AnalyticsService } from "./analytics.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @Roles("HIRING_ORG", "ADMIN", "PROVIDER")
  async dashboard(@CurrentUser() user: AuthUser) {
    if (user.role === "PROVIDER") return this.analytics.providerDashboard(user);
    return this.analytics.hiringDashboard(user);
  }

  @Get("spend")
  @Roles("HIRING_ORG", "ADMIN")
  async spend(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analytics.spend(user, from, to);
  }

  @Get("export.csv")
  @Roles("HIRING_ORG", "ADMIN")
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: any, @Query("from") from?: string, @Query("to") to?: string) {
    const csv = await this.analytics.exportCsv(user, from, to);
    res.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", "attachment; filename=facilityflow-analytics.csv").send(csv);
  }
}
