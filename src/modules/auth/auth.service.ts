import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { CommonErrorCode } from 'src/common/errors/common-error-code.enum';
import { extractErrorCode } from 'src/common/utils/extract-error-code.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_INV_CODE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_SECONDS,
  TG_OAUTH_STATE_COOKIE,
  TG_OAUTH_VERIFIER_COOKIE,
} from './constants/auth.constants';
import { SessionResponseDto } from './dto/session-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import { AuthErrorCode } from './errors/auth-error.code.enum';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';
import { GeoIpService } from './services/geoip.service';
import { TelegramOidcService } from './telegram/telegram-oidc.service';
import { TelegramIdTokenClaims } from './telegram/telegram.types';
import { randomUUID } from 'crypto';
import { processAndValidateImage } from 'src/common/utils/media-helper.util';
import { StorageService } from 'src/modules/storage/storage.service';
import {
  clearAuthCookies,
  clearOidcCookies,
  getCookie,
  setAuthCookies,
  setOidcCookies,
} from './utils/cookie.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramOidcService,
    private readonly jwtService: JwtService,
    private readonly geoIpService: GeoIpService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async loginViaTelegram(req: Request, res: Response, inv_code?: string) {
    const accessToken = getCookie(req, ACCESS_TOKEN_COOKIE);
    if (await this.isSessionActive(accessToken)) {
      return this.redirectToFrontend(res, {
        error: AuthErrorCode.ALREADY_AUTHENTICATED,
      });
    }

    const state = this.telegram.generateState();
    const { verifier, challenge } = this.telegram.generatePkce();

    setOidcCookies(res, state, verifier, inv_code);

    const url = this.telegram.getAuthorizationUrl(state, challenge);
    return res.redirect(url);
  }

  async telegramCallback(
    req: Request,
    res: Response,
    code?: string,
    state?: string,
  ) {
    const storedState = getCookie(req, TG_OAUTH_STATE_COOKIE);
    const verifier = getCookie(req, TG_OAUTH_VERIFIER_COOKIE);
    const inv_code = getCookie(req, OAUTH_INV_CODE);

    if (!code || !state) {
      return this.redirectToFrontend(res, {
        error: CommonErrorCode.UNAUTHORIZED,
        inv_code,
      });
    }

    if (!storedState || !verifier) {
      return this.redirectToFrontend(res, {
        error: AuthErrorCode.TG_AUTH_EXPIRED,
        inv_code,
      });
    }

    if (state !== storedState) {
      return this.redirectToFrontend(res, {
        error: AuthErrorCode.INVALID_OAUTH_STATE,
        inv_code,
      });
    }

    try {
      const tokens = await this.telegram.exchangeCode(code, verifier);
      const claims = await this.telegram.verifyIdToken(tokens.id_token);

      await this.loginByTelegramClaim(claims, req, res);

      clearOidcCookies(res);
      return this.redirectToFrontend(res, { success: true, inv_code });
    } catch (err) {
      console.log(err);
      clearOidcCookies(res);
      const errorCode = extractErrorCode(
        err,
        AuthErrorCode.TELEGRAM_AUTH_FAILED,
      );
      return this.redirectToFrontend(res, { error: errorCode, inv_code });
    }
  }

  async loginByTelegramClaim(
    claims: TelegramIdTokenClaims,
    req: Request,
    res: Response,
  ) {
    let user = await this.prisma.user.findUnique({
      where: { tg_sub: claims.sub },
    });

    if (!user) {
      let username: string | null = claims.preferred_username ?? null;
      let username_lower: string | null = null;
      if (username) {
        const lower = username.toLowerCase();
        const existing = await this.prisma.user.findUnique({
          where: { username_lower: lower },
        });
        if (existing) {
          username = null;
          username_lower = null;
        } else {
          username_lower = lower;
        }
      }

      user = await this.prisma.user.create({
        data: {
          tg_sub: claims.sub,
          tg_id: String(claims.id),
          name: claims.name,
          avatar: claims.picture ?? null,
          username,
          username_lower,
        },
      });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const agent = (req.headers['user-agent'] as string) || 'unknown';
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const location = this.geoIpService.lookupLocation(ip);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip,
        agent,
        location,
        expiresAt,
      },
    });

    await this.issueTokensAndSetCookies(user.id, session.id, res);
  }

  async refresh(req: Request, res: Response) {
    const accessToken = getCookie(req, ACCESS_TOKEN_COOKIE);
    if (accessToken && (await this.isAccessTokenValid(accessToken))) {
      throw new BadRequestException({
        error_code: AuthErrorCode.ACCESS_TOKEN_NOT_EXPIRED,
      });
    }

    const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException({
        error_code: AuthErrorCode.REFRESH_TOKEN_REQUIRED,
      });
    }

    let payload: RefreshTokenPayload;
    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);
    } catch {
      clearAuthCookies(res);
      throw new UnauthorizedException({
        error_code: AuthErrorCode.INVALID_REFRESH_TOKEN,
      });
    }

    if (!payload?.sub || !payload?.sid || payload.type !== 'refresh') {
      clearAuthCookies(res);
      throw new UnauthorizedException({
        error_code: AuthErrorCode.INVALID_REFRESH_TOKEN,
      });
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      if (session) {
        await this.prisma.session
          .delete({ where: { id: session.id } })
          .catch(() => {});
      }
      clearAuthCookies(res);
      throw new UnauthorizedException({
        error_code: AuthErrorCode.SESSION_EXPIRED,
      });
    }

    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: new Date(),
        expiresAt: newExpiresAt,
      },
    });

    await this.issueTokensAndSetCookies(session.userId, session.id, res);
    return { ok: true };
  }

  async logout(req: Request, res: Response) {
    const accessToken = getCookie(req, ACCESS_TOKEN_COOKIE);
    const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);

    const sessionId =
      this.extractSessionId(accessToken) ?? this.extractSessionId(refreshToken);

    if (sessionId) {
      await this.prisma.session
        .deleteMany({
          where: { id: sessionId },
        })
        .catch(() => {});
    }

    clearAuthCookies(res);
    return { ok: true };
  }

  getMe(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
    };
  }

  async getSessions(
    user: UserEntity,
    currentSession: SessionEntity,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      agent: s.agent,
      location: s.location,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSession.id,
    }));
  }

  async shutdownSession(
    user: UserEntity,
    currentSession: SessionEntity,
    sessionId: number,
  ) {
    if (sessionId === currentSession.id) {
      throw new BadRequestException({
        error_code: AuthErrorCode.CANNOT_SHUTDOWN_CURRENT_SESSION,
      });
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.id) {
      throw new NotFoundException({
        error_code: AuthErrorCode.SESSION_NOT_FOUND,
      });
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return { ok: true };
  }

  async shutdownAllSessions(user: UserEntity, currentSession: SessionEntity) {
    await this.prisma.session.deleteMany({
      where: {
        userId: user.id,
        id: { not: currentSession.id },
      },
    });

    return { ok: true };
  }

  private async isSessionActive(accessToken?: string): Promise<boolean> {
    if (!accessToken) return false;
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
      if (!payload?.sid) return false;

      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
      });
      return !!session && session.expiresAt.getTime() > Date.now();
    } catch {
      return false;
    }
  }

  private async isAccessTokenValid(accessToken?: string): Promise<boolean> {
    if (!accessToken) return false;
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
      return Boolean(payload?.sub && payload?.sid);
    } catch {
      return false;
    }
  }

  private extractSessionId(token?: string): number | undefined {
    if (!token) return undefined;
    try {
      const payload = this.jwtService.decode<{ sid?: number }>(token);
      return payload?.sid;
    } catch {
      return undefined;
    }
  }

  private redirectToFrontend(
    res: Response,
    result: ({ success: true } | { error: string }) & { inv_code?: string },
  ) {
    const frontendUri = this.configService.getOrThrow<string>('FRONTEND_URI');
    const origin = result.inv_code
      ? `${frontendUri}/join-crew/${result.inv_code}`
      : frontendUri;
    const url =
      'error' in result
        ? `${origin}/?auth=error&code=${result.error}`
        : `${origin}/?auth=success`;
    return res.redirect(url);
  }

  private async issueTokensAndSetCookies(
    userId: number,
    sessionId: number,
    res: Response,
  ) {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    setAuthCookies(res, accessToken, refreshToken);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ ok: true }> {
    const processed = await processAndValidateImage(file, {
      maxSizeBytes: 15 * 1024 * 1024,
      targetAspectRatio: 1,
      errorCodes: {
        IMAGE_REQUIRED: AuthErrorCode.IMAGE_REQUIRED,
        INVALID_IMAGE_FORMAT: AuthErrorCode.INVALID_IMAGE_FORMAT,
        IMAGE_TOO_LARGE: AuthErrorCode.IMAGE_TOO_LARGE,
        INVALID_IMAGE_ASPECT_RATIO: AuthErrorCode.INVALID_IMAGE_ASPECT_RATIO,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        error_code: CommonErrorCode.NOT_FOUND,
      });
    }

    if (user.avatar) {
      await this.storageService.delete(user.avatar);
    }

    const key = `users/avatars/${userId}_${randomUUID()}.${processed.extension}`;
    await this.storageService.uploadBuffer(
      processed.buffer,
      key,
      processed.contentType,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: key },
    });

    return { ok: true };
  }

  async deleteAvatar(userId: number): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        error_code: CommonErrorCode.NOT_FOUND,
      });
    }

    if (user.avatar) {
      await this.storageService.delete(user.avatar);
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: null },
      });
    }

    return { ok: true };
  }
}
