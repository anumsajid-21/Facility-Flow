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
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { AuditService } from '../audit/audit.service';
import { ProvidersService } from './providers.service';
import { FilesService } from '../files/files.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsDateString, IsOptional, IsString, IsInt, IsArray } from 'class-validator';

class ProviderProfileDto {
  @IsOptional() name?: string;
  @IsOptional() description?: string;
  @IsOptional() phone?: string;
  @IsOptional() email?: string;
  @IsOptional() address?: string;
  @IsOptional() website?: string;
  @IsOptional() experience?: string;
  @IsOptional() @IsInt() workforceCapacity?: number;
  @IsOptional() operatingInfo?: string;
  @IsOptional() @IsArray() serviceCategoryIds?: string[];
  @IsOptional() @IsArray() serviceAreaIds?: string[];
}

class VerificationDocumentDto {
  @IsString() documentType: string;
  @IsString() fileId: string; // UUID from Files upload
  @IsOptional() @IsDateString() expiresAt?: string;
}

/**
 * Provider self-management and public discovery.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/providers')
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly files: FilesService,
  ) {}

  @Get()
  async publicList(@Query() q: PaginationDto, @Query('categoryId') categoryId?: string, @Query('city') city?: string) {
    return this.providers.publicList({ categoryId, city }, q);
  }

  @Get('my-profile')
  @Roles('PROVIDER')
  async myProfile(@CurrentUser() user: AuthUser) {
    if (!user.providerId) throw new NotFoundException('No provider profile for this user');
    return this.providers.getOne(user, user.providerId);
  }

  @Patch('my-profile')
  @Roles('PROVIDER')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: ProviderProfileDto) {
    if (!user.providerId) throw new NotFoundException('No provider profile for this user');
    return this.providers.update(user, user.providerId, dto);
  }

  @Get('my-profile/documents')
  @Roles('PROVIDER')
  async myDocuments(@CurrentUser() user: AuthUser) {
    if (!user.providerId) throw new NotFoundException('No provider profile for this user');
    return this.providers.documents(user, user.providerId);
  }

  @Post('my-profile/documents')
  @Roles('PROVIDER')
  async addDocument(@CurrentUser() user: AuthUser, @Body() dto: VerificationDocumentDto) {
    if (!user.providerId) throw new NotFoundException('No provider profile for this user');
    return this.providers.addDocument(user, user.providerId, dto);
  }
}

/**
 * Public provider profile endpoint (no auth required for basic info).
 */
@Controller('api/v1/provider-public')
export class ProviderPublicController {
  constructor(private readonly providers: ProvidersService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.getPublic(id);
  }
}
