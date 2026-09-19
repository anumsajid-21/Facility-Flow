import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/user.decorator";
import { InvoicesService } from "./invoices.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { IsNumber, IsOptional, IsString } from "class-validator";

class PaymentRecordDto {
  @IsNumber() amount: number;
  @IsString() paymentMethod: string;
  @IsOptional() @IsString() paymentReference?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() date?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("api/v1/invoices")
export class InvoicesController {
  constructor(private readonly is: InvoicesService) {}

  @Get("payment-history")
  paymentHistory(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("providerId") providerId?: string,
    @Query("category") category?: string,
  ) {
    return this.is.paymentHistory(user, { from, to, providerId, category });
  }

  @Get("payment-history/csv")
  paymentHistoryCsv(
    @Res() res: any,
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("providerId") providerId?: string,
    @Query("category") category?: string,
  ) {
    return this.is.paymentHistoryCsv(user, { from, to, providerId, category }, res);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.is.list(user, q);
  }

  @Post()
  @Roles("PROVIDER")
  createFromJob(@CurrentUser() user: AuthUser, @Body("jobId") jobId: string) {
    return this.is.createFromJob(user, jobId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.is.get(user, id);
  }

  @Get(":id/pdf")
  downloadPdf(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: any) {
    return this.is.generatePdf(user, id, res);
  }

  @Post(":id/payments")
  @Roles("HIRING_ORG", "ADMIN")
  addPayment(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: PaymentRecordDto) {
    return this.is.addPayment(user, id, dto);
  }

  @Get(":id/payments")
  payments(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.is.payments(user, id);
  }

  @Patch(":id/status")
  @Roles("PROVIDER")
  updateStatus(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body("status") status: string) {
    return this.is.updateStatus(user, id, status);
  }
}
