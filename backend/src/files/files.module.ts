import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

/**
 * @Global: any module can inject FilesService.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}