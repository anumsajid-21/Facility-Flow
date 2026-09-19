import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { QuotationsService } from './quotations.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

class QuotationDto {
  @IsUUID() serviceRequestId: string;
  @IsNumber() price: number;
  @IsOptional() laborCost?: number;
  @IsOptional() materialCost?: number;
  @IsInt() numberOfWorkers: number;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() equipment?: string;
  @IsOptional() sla?: string;
  @IsOptional() warranty?: string;
  @IsOptional() terms?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() notes?: string;
  @IsOptional() attachmentIds?: string[];
}

/**
 * Provider quotation management + hiring-org comparison.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/quotations')
export class QuotationsController {
  constructor(private readonly qs: QuotationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto, @Query('providerId') providerId?: string, @Query('organizationId') organizationId?: string) {
    return this.qs.list(user, providerId, organizationId, q);
  }

  /** Provider: browse OPEN service requests available for quoting. */
  @Get('open-requests')
  @Roles('PROVIDER')
  async openRequests(@CurrentUser() user: AuthUser) {
    return this.qs.openRequests(user);
  }

  @Post()
  @Roles('PROVIDER')
  async create(@CurrentUser() user: AuthUser, @Body() dto: QuotationDto) {
    return this.qs.create(user, dto);
  }

  @Post(':id/submit')
  @Roles('PROVIDER')
  async submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.qs.submit(user, id);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.qs.get(user, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<QuotationDto>) {
    return this.qs.update(user, id, dto);
  }

  @Post(':id/withdraw')
  @Roles('PROVIDER')
  async withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.qs.withdraw(user, id);
  }

  /** Hiring org compares quotations for a request, then accepts one. */
  @Get('request/:requestId')
  async forRequest(@CurrentUser() user: AuthUser, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.qs.forRequest(user, requestId);
  }

  @Post(':id/accept')
  @Roles('HIRING_ORG', 'ADMIN')
  async accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.qs.accept(user, id);
  }
}
