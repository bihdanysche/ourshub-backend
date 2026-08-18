import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequired } from './decorators/auth-required.decorator';
import { CurrentSession } from './decorators/current-session.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionResponseDto } from './dto/session-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('telegram')
  @ApiOperation({ summary: 'Initiate Telegram OIDC login flow' })
  @ApiQuery({ name: 'inv_code', required: false, description: 'Optional crew invitation code to retain after login' })
  @ApiResponse({ status: 302, description: 'Redirects to Telegram login page' })
  async authViaTelegram(
    @Req() req: Request,
    @Res() res: Response,
    @Query('inv_code') inv_code?: string,
  ) {
    return await this.authService.loginViaTelegram(req, res, inv_code);
  }

  @Get('telegram/callback')
  @ApiOperation({ summary: 'Telegram OIDC callback handler' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with auth status' })
  async onTelegramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return await this.authService.telegramCallback(req, res, code, state);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.refresh(req, res);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and terminate active session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return await this.authService.logout(req, res);
  }

  @Get('me')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getMe(@CurrentUser() user: UserEntity): UserResponseDto {
    return this.authService.getMe(user);
  }

  @Post('me/avatar')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Upload user profile avatar image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser('id') userId: number,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ ok: true }> {
    return await this.authService.uploadAvatar(userId, file!);
  }

  @Delete('me/avatar')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Delete user profile avatar image' })
  @ApiResponse({ status: 200, description: 'Avatar deleted' })
  async deleteAvatar(
    @CurrentUser('id') userId: number,
  ): Promise<{ ok: true }> {
    return await this.authService.deleteAvatar(userId);
  }

  @Get('sessions')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get list of active sessions for current user' })
  @ApiResponse({ status: 200, type: [SessionResponseDto] })
  async getSessions(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
  ): Promise<SessionResponseDto[]> {
    return await this.authService.getSessions(user, session);
  }

  @Post('sessions/shutdown/:id')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Shutdown specific user session by ID' })
  @ApiResponse({ status: 200, description: 'Session terminated' })
  async shutdownSession(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.authService.shutdownSession(user, session, id);
  }

  @Post('sessions/shutdown-all')
  @AuthRequired()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Shutdown all user sessions except current' })
  @ApiResponse({ status: 200, description: 'Other sessions terminated' })
  async shutdownAllSessions(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
  ) {
    return await this.authService.shutdownAllSessions(user, session);
  }
}
