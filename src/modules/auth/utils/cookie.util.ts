import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_INV_CODE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  TG_OAUTH_STATE_COOKIE,
  TG_OAUTH_TTL_MS,
  TG_OAUTH_VERIFIER_COOKIE,
} from '../constants/auth.constants';

const isSecureCookie = (): boolean => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return true;
};

export function getCookie(req: Request, name: string): string | undefined {
  return req.cookies?.[name] as string | undefined;
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  const secure = isSecureCookie();

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  const secure = isSecureCookie();

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
  });
}

export function setOidcCookies(
  res: Response,
  state: string,
  verifier: string,
  inv_code?: string,
): void {
  const options = {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    maxAge: TG_OAUTH_TTL_MS,
    path: '/auth/telegram',
  };

  res.cookie(TG_OAUTH_STATE_COOKIE, state, options);
  res.cookie(TG_OAUTH_VERIFIER_COOKIE, verifier, options);
  if (inv_code) {
    res.cookie(OAUTH_INV_CODE, inv_code, options);
  } else {
    res.clearCookie(OAUTH_INV_CODE, { ...options, maxAge: undefined });
  }
}

export function clearOidcCookies(res: Response): void {
  const options = {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/auth/telegram',
  };

  res.clearCookie(TG_OAUTH_STATE_COOKIE, options);
  res.clearCookie(TG_OAUTH_VERIFIER_COOKIE, options);
  res.clearCookie(OAUTH_INV_CODE, options);
}
