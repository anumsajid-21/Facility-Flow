import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/user.decorator';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.settingsService.getMe(user);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.settingsService.updateProfile(user, dto);
  }

  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.settingsService.changePassword(user, dto);
  }

  @Get('notifications')
  async getNotificationPreferences(@CurrentUser() user: AuthUser) {
    return this.settingsService.getNotificationPreferences(user);
  }

  @Patch('notifications')
  async updateNotificationPreferences(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.settingsService.updateNotificationPreferences(user, dto);
  }

  @Get('session')
  async getSessionInfo(@CurrentUser() user: AuthUser, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      hiringOrgId: user.hiringOrgId,
      providerId: user.providerId,
      ip,
      userAgent,
      loginAt: new Date().toISOString(),
    };
  }
}
