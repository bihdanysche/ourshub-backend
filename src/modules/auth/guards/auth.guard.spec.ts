import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenExpiredError } from 'jsonwebtoken';
import { CommonErrorCode } from 'src/common/errors/common-error-code.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../constants/auth.constants';
import { AuthErrorCode } from '../errors/auth-error.code.enum';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  function createMockExecutionContext(
    cookies: Record<string, string> = {},
    isOptional = false,
  ) {
    mockReflector.getAllAndOverride.mockReturnValue(isOptional);

    const request = {
      cookies,
      user: undefined,
      session: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('should throw UNAUTHORIZED if token is missing on protected route', async () => {
    const { context } = createMockExecutionContext({});

    try {
      await guard.canActivate(context);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toEqual({
        error_code: CommonErrorCode.UNAUTHORIZED,
      });
    }
  });

  it('should return true and set user/session to null if token is missing on optional route', async () => {
    const { context, request } = createMockExecutionContext({}, true);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toBeNull();
    expect(request.session).toBeNull();
  });

  it('should throw TOKEN_EXPIRED if token has expired', async () => {
    const { context } = createMockExecutionContext({
      [ACCESS_TOKEN_COOKIE]: 'expired_jwt_token',
    });

    const expiredError = new TokenExpiredError('jwt expired', new Date());
    mockJwtService.verifyAsync.mockRejectedValue(expiredError);

    try {
      await guard.canActivate(context);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toEqual({
        error_code: AuthErrorCode.TOKEN_EXPIRED,
      });
    }
  });

  it('should throw INVALID_ACCESS_TOKEN if token signature is invalid', async () => {
    const { context } = createMockExecutionContext({
      [ACCESS_TOKEN_COOKIE]: 'invalid_jwt_token',
    });

    mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    try {
      await guard.canActivate(context);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toEqual({
        error_code: AuthErrorCode.INVALID_ACCESS_TOKEN,
      });
    }
  });

  it('should throw SESSION_EXPIRED if session not found in database', async () => {
    const { context } = createMockExecutionContext({
      [ACCESS_TOKEN_COOKIE]: 'valid_jwt_token',
    });

    mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, sid: 10 });
    mockPrismaService.session.findUnique.mockResolvedValue(null);

    try {
      await guard.canActivate(context);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toEqual({
        error_code: AuthErrorCode.SESSION_EXPIRED,
      });
    }
  });

  it('should authenticate successfully and set user and session on request', async () => {
    const { context, request } = createMockExecutionContext({
      [ACCESS_TOKEN_COOKIE]: 'valid_jwt_token',
    });

    const mockUser = { id: 1, name: 'Test User' };
    const mockSession = {
      id: 10,
      userId: 1,
      expiresAt: new Date(Date.now() + 100000),
      lastUsedAt: new Date(),
      user: mockUser,
    };

    mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, sid: 10 });
    mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockUser);
    expect(request.session).toEqual({
      id: 10,
      userId: 1,
      expiresAt: mockSession.expiresAt,
      lastUsedAt: mockSession.lastUsedAt,
    });
  });
});
