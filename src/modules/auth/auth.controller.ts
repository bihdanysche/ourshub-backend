import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('telegram')
  async authViaTelegram(@Res() res: Response) {
    return await this.authService.loginViaTelegram(res);
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
}
