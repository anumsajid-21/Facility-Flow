import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { FilesService } from './files.service';
import { FileKind } from '@prisma/client';

/**
 * Secure file upload/download endpoints.
 * Direct file system paths are never exposed to clients.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/v1/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload/:kind')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Param('kind') kind: string,
    @CurrentUser() user: AuthUser,
  ) {
    const validKinds = Object.values(FileKind);
    if (!validKinds.includes(kind as FileKind)) {
      throw new BadRequestException('Invalid file kind');
    }
    const record = await this.files.store(file, kind as FileKind, user.userId);
    return { id: record.id, originalName: record.originalName, mimeType: record.mimeType, size: record.size };
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    await this.files.assertAccess(id, user);
    const { data, mimeType, originalName } = await this.files.read(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.send(data);
  }
}