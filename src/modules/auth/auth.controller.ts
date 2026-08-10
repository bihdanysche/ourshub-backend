import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequired } from './decorators/auth-required.decorator';
import { CurrentSession } from './decorators/current-session.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionResponseDto } from './dto/session-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('telegram')
  async authViaTelegram(
    @Req() req: Request,
    @Res() res: Response,
    @Query('inv_code') inv_code?: string,
  ) {
    return await this.authService.loginViaTelegram(req, res, inv_code);
  }

  @Get('telegram/callback')
  async onTelegramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return await this.authService.telegramCallback(req, res, code, state);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.refresh(req, res);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return await this.authService.logout(req, res);
  }

  @Get('me')
  @AuthRequired()
  getMe(@CurrentUser() user: UserEntity): UserResponseDto {
    return this.authService.getMe(user);
  }

  @Get('sessions')
  @AuthRequired()
  async getSessions(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
  ): Promise<SessionResponseDto[]> {
    return await this.authService.getSessions(user, session);
  }

  @Post('sessions/shutdown/:id')
  @AuthRequired()
  async shutdownSession(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.authService.shutdownSession(user, session, id);
  }

  @Post('sessions/shutdown-all')
  @AuthRequired()
  async shutdownAllSessions(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: SessionEntity,
  ) {
    return await this.authService.shutdownAllSessions(user, session);
  }
}
