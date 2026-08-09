import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CommonErrorCode } from 'src/common/errors/common-error-code.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthErrorCode } from './errors/auth-error.code.enum';
import { TelegramOidcService } from './telegram/telegram-oidc.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramOidcService,
  ) {}

  async loginViaTelegram(res: Response) {
    const state = this.telegram.generateState();
    const { verifier, challenge } = this.telegram.generatePkce();

    res.cookie('telegram_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
      path: '/auth/telegram',
    });

    res.cookie('telegram_oauth_verifier', verifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
      path: '/auth/telegram',
    });

    const url = this.telegram.getAuthorizationUrl(state, challenge);

    return res.redirect(url);
  }

  async telegramCallback(
    req: Request,
    res: Response,
    code: string,
    state: string,
  ) {
    const storedState = req.cookies.telegram_oauth_state;
    const verifier = req.cookies.telegram_oauth_verifier;

    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URI}/?auth=error&code=${CommonErrorCode.UNAUTHORIZED}`,
      );
    }

    if (!storedState || !verifier) {
      return res.redirect(
        `${process.env.FRONTEND_URI}/?auth=error&code=${AuthErrorCode.TG_AUTH_EXPIRED}`,
      );
    }

    if (state !== storedState) {
      return res.redirect(
        `${process.env.FRONTEND_URI}/?auth=error&code=${AuthErrorCode.INVALID_OAUTH_STATE}`,
      );
    }

    const tokens = await this.telegram.exchangeCode(code, verifier);
    const claims = await this.telegram.verifyIdToken(tokens.id_token);
    console.log(claims);

    res.clearCookie('telegram_oauth_state', {
      path: '/api/auth/telegram',
    });
    res.clearCookie('telegram_oauth_verifier', {
      path: '/api/auth/telegram',
    });

    return res.redirect(`${process.env.FRONTEND_URI}/?auth=success`);
  }
}
