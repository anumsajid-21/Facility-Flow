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
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '../common/decorators/throttle.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { ServiceRequestsService } from './service-requests.service';
import { AiAssistService } from './ai-assist.service';
import { MatchingService } from '../matching/matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

class AiAssistDto {
  @IsString()
  @MinLength(10, { message: 'Please describe the problem in a bit more detail (at least 10 characters).' })
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;
}

class ServiceRequestDto {
  @IsString() title: string;
  @IsOptional() @Transform(({ value }) => value === '' || value === null ? undefined : value) @IsUUID() categoryId?: string;
  @IsString() description: string;
  @IsUUID() buildingId: string;
  @IsOptional() @Transform(({ value }) => value === '' || value === null ? undefined : value) @IsUUID() floorId?: string;
  @IsOptional() @Transform(({ value }) => value === '' || value === null ? undefined : value) @IsUUID() areaId?: string;
  @IsOptional() @IsString() requirements?: string;
  @IsOptional() @Transform(({ value }) => value === '' || value === null ? undefined : value) @IsString() preferredDate?: string;
  @IsOptional() @IsString() frequency?: string;
  @IsOptional() @Transform(({ value }) => value === '' || value === null || isNaN(Number(value)) ? undefined : Number(value)) @IsNumber() budget?: number;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() attachmentIds?: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HIRING_ORG', 'ADMIN')
@Controller('api/v1/service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly sr: ServiceRequestsService,
    private readonly matching: MatchingService,
    private readonly prisma: PrismaService,
    private readonly aiAssist: AiAssistService,
  ) {}

  /** Service categories for the request-creation dropdown (declared before ':id' routes). */
  @Get('categories')
  async categories() {
    return this.prisma.serviceCategory.findMany({ orderBy: { name: 'asc' } });
  }

  /** Whether AI Assist is configured — lets the frontend hide the entry point when it isn't. */
  @Get('ai-assist/status')
  aiAssistStatus() {
    return { enabled: this.aiAssist.isEnabled() };
  }

  /**
   * Turns a free-text problem description into suggested form fields.
   * Purely advisory — never creates or modifies a service request itself.
   */
  @Post('ai-assist')
  @Throttle({ limit: 10, ttl: 60 })
  async aiAssistAnalyze(@Body() dto: AiAssistDto) {
    try {
      return await this.aiAssist.analyze(dto.description, dto.answers);
    } catch (err: any) {
      if (err?.message === 'AI_NOT_CONFIGURED') {
        throw new HttpException('AI Assist is not configured.', HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw new HttpException('AI Assist could not analyze this description. Please fill in the form manually.', HttpStatus.BAD_GATEWAY);
    }
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.sr.list(user, q, false);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: ServiceRequestDto) {
    return this.sr.create(user, dto);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sr.get(user, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<ServiceRequestDto>) {
    return this.sr.update(user, id, dto);
  }

  @Post(':id/submit')
  async submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sr.submit(user, id);
  }

  @Post(':id/archive')
  async archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sr.archive(user, id);
  }

  @Get(':id/matches')
  async matches(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const request = await this.sr.get(user, id);
    if (request.status !== 'OPEN') {
      return { providers: [], explanation: 'Matching only for OPEN requests' };
    }
    const providers = await this.matching.match(id);
    return { providers };
  }
}
