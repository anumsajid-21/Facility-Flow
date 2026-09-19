import { Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.userId);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notifications.markRead(user.userId, id);
    return { ok: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.userId);
    return { ok: true };
  }
}