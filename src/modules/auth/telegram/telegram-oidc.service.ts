import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

import { AuthErrorCode } from '../errors/auth-error.code.enum';
import { TelegramIdTokenClaims, TelegramTokenResponse } from './telegram.types';

@Injectable()
export class TelegramOidcService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('TG_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>('TG_CLIENT_SECRET');
    this.redirectUri = this.configService.getOrThrow<string>('TG_REDIRECT_URI');
  }

  private readonly authorizationUrl = 'https://oauth.telegram.org/auth';
  private readonly tokenUrl = 'https://oauth.telegram.org/token';
  private readonly jwks = createRemoteJWKSet(
    new URL('https://oauth.telegram.org/.well-known/jwks.json'),
  );

  generatePkce(): {
    verifier: string;
    challenge: string;
  } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    return {
      verifier,
      challenge,
    };
  }

  generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  getAuthorizationUrl(state: string, challenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return `${this.authorizationUrl}?${params}`;
  }

  async exchangeCode(
    code: string,
    verifier: string,
  ): Promise<TelegramTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: verifier,
    });

    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new UnauthorizedException({
        error_code: AuthErrorCode.TELEGRAM_AUTH_FAILED,
      });
    }

    const data = (await response.json()) as TelegramTokenResponse;
    return data;
  }

  async verifyIdToken(idToken: string): Promise<TelegramIdTokenClaims> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: 'https://oauth.telegram.org',
        audience: this.clientId,
      });

      return payload as unknown as TelegramIdTokenClaims;
    } catch {
      throw new UnauthorizedException({
        error_code: AuthErrorCode.INVALID_TELEGRAM_ID_TOKEN,
      });
    }
  }
}
