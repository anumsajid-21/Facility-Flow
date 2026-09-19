import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}