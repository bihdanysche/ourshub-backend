import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth.constants';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import { AuthErrorCode } from './errors/auth-error.code.enum';
import { GeoIpService } from './services/geoip.service';
import { TelegramOidcService } from './telegram/telegram-oidc.service';
import { TelegramIdTokenClaims } from './telegram/telegram.types';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUser: UserEntity = {
    id: 1,
    tg_id: 12345678,
    tg_sub: 'tg_sub_123',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    username: 'testuser',
    username_lower: 'testuser',
    createdAt: new Date(),
  };

  const mockSession: SessionEntity = {
    id: 10,
    userId: 1,
    ip: '127.0.0.1',
    agent: 'Jest Test Agent',
    location: 'Kyiv, UA',
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockTelegramService = {
    generatePkce: jest.fn(),
    generateState: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const mockGeoIpService = {
    lookupLocation: jest.fn().mockReturnValue('Kyiv, UA'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRONTEND_URI = 'http://localhost:3000';
    process.env.NODE_ENV = 'development';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TelegramOidcService, useValue: mockTelegramService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GeoIpService, useValue: mockGeoIpService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loginByTelegramClaim', () => {
    it('should create new user and session if user does not exist', async () => {
      const claims: TelegramIdTokenClaims = {
        iss: 'https://oauth.telegram.org',
        aud: 'test_client',
        sub: 'tg_new_sub',
        iat: 123456,
        exp: 234567,
        id: 99999,
        name: 'New User',
        preferred_username: 'New_Username',
        picture: 'https://avatar.png',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null); // tg_sub lookup
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null); // username_lower uniqueness check
      mockPrismaService.user.create.mockResolvedValue({
        id: 2,
        tg_sub: claims.sub,
        tg_id: claims.id,
        name: claims.name,
        avatar: claims.picture,
        username: claims.preferred_username,
        username_lower: 'new_username',
      });

      mockPrismaService.session.create.mockResolvedValue({
        id: 20,
        userId: 2,
        ip: '127.0.0.1',
        agent: 'test',
        location: 'Kyiv, UA',
        expiresAt: new Date(Date.now() + 10000),
      });

      mockJwtService.signAsync.mockResolvedValue('signed_jwt_token');

      const mockReq = {
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1',
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
      } as unknown as Response;

      await service.loginByTelegramClaim(claims, mockReq, mockRes);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          tg_sub: claims.sub,
          tg_id: String(claims.id),
          name: claims.name,
          avatar: claims.picture,
          username: claims.preferred_username,
          username_lower: 'new_username',
        },
      });

      expect(mockGeoIpService.lookupLocation).toHaveBeenCalledWith('127.0.0.1');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 2,
          ip: '127.0.0.1',
          agent: 'test',
          location: 'Kyiv, UA',
        }) as unknown,
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'signed_jwt_token',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'signed_jwt_token',
        expect.any(Object),
      );
    });

    it('should use existing user without overwriting fields if user exists', async () => {
      const claims: TelegramIdTokenClaims = {
        iss: 'https://oauth.telegram.org',
        aud: 'test_client',
        sub: mockUser.tg_sub,
        iat: 123456,
        exp: 234567,
        id: mockUser.tg_id,
        name: 'New Name From TG',
        picture: 'https://newavatar.png',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockJwtService.signAsync.mockResolvedValue('token');

      const mockReq = { headers: {}, ip: '1.1.1.1' } as unknown as Request;
      const mockRes = { cookie: jest.fn() } as unknown as Response;

      await service.loginByTelegramClaim(claims, mockReq, mockRes);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          location: 'Kyiv, UA',
        }) as unknown,
      });
    });
  });

  describe('refresh', () => {
    it('should throw BadRequestException ACCESS_TOKEN_NOT_EXPIRED if access token is still valid', async () => {
      const mockReq = {
        cookies: {
          [ACCESS_TOKEN_COOKIE]: 'valid_access_token',
          [REFRESH_TOKEN_COOKIE]: 'some_refresh_token',
        },
      } as unknown as Request;
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      mockJwtService.verifyAsync.mockImplementation((token: string) => {
        if (token === 'valid_access_token') {
          return Promise.resolve({ sub: 1, sid: 10 });
        }
        return Promise.reject(new Error('invalid token'));
      });

      try {
        await service.refresh(mockReq, mockRes);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toEqual({
          error_code: AuthErrorCode.ACCESS_TOKEN_NOT_EXPIRED,
        });
      }
    });

    it('should throw UnauthorizedException REFRESH_TOKEN_REQUIRED if no refresh token provided', async () => {
      const mockReq = {
        cookies: {},
      } as unknown as Request;
      const mockRes = { clearCookie: jest.fn() } as unknown as Response;

      await expect(service.refresh(mockReq, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate tokens and update session if refresh token and session are valid', async () => {
      const mockReq = {
        cookies: {
          [ACCESS_TOKEN_COOKIE]: 'expired_token',
          [REFRESH_TOKEN_COOKIE]: 'valid_refresh_token',
        },
      } as unknown as Request;
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      mockJwtService.verifyAsync.mockImplementation((token: string) => {
        if (token === 'expired_token') {
          return Promise.reject(new Error('jwt expired'));
        }
        if (token === 'valid_refresh_token') {
          return Promise.resolve({
            sub: 1,
            sid: 10,
            type: 'refresh',
          });
        }
        return Promise.reject(new Error('unknown token'));
      });

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      mockJwtService.signAsync.mockResolvedValue('new_token');

      const result = await service.refresh(mockReq, mockRes);

      expect(result).toEqual({ ok: true });
      expect(prisma.session.update).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'new_token',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'new_token',
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should decode token, delete session, clear cookies, and return ok: true', async () => {
      const mockReq = {
        cookies: {
          [ACCESS_TOKEN_COOKIE]: 'token_with_sid',
        },
      } as unknown as Request;
      const mockRes = { clearCookie: jest.fn() } as unknown as Response;

      mockJwtService.decode.mockReturnValue({ sid: 10 });
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(mockReq, mockRes);

      expect(result).toEqual({ ok: true });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.any(Object),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.any(Object),
      );
    });
  });

  describe('getMe', () => {
    it('should return user fields', () => {
      const result = service.getMe(mockUser);
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        name: mockUser.name,
        avatar: mockUser.avatar,
      });
    });
  });

  describe('getSessions', () => {
    it('should return list of sessions with isCurrent flag and location', async () => {
      const otherSession: SessionEntity = {
        id: 11,
        userId: 1,
        ip: '192.168.1.1',
        agent: 'Other',
        location: null,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      };

      mockPrismaService.session.findMany.mockResolvedValue([
        mockSession,
        otherSession,
      ]);

      const sessions = await service.getSessions(mockUser, mockSession);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[0].location).toBe('Kyiv, UA');
      expect(sessions[1].isCurrent).toBe(false);
      expect(sessions[1].location).toBeNull();
    });
  });

  describe('shutdownSession', () => {
    it('should throw BadRequestException CANNOT_SHUTDOWN_CURRENT_SESSION if trying to shut down current session', async () => {
      await expect(
        service.shutdownSession(mockUser, mockSession, mockSession.id),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.shutdownSession(mockUser, mockSession, mockSession.id),
      ).rejects.toMatchObject({
        response: {
          error_code: AuthErrorCode.CANNOT_SHUTDOWN_CURRENT_SESSION,
        },
      });
    });

    it('should throw NotFoundException SESSION_NOT_FOUND if session not found or belongs to another user', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.shutdownSession(mockUser, mockSession, 999),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.shutdownSession(mockUser, mockSession, 999),
      ).rejects.toMatchObject({
        response: {
          error_code: AuthErrorCode.SESSION_NOT_FOUND,
        },
      });
    });

    it('should delete session and return ok: true', async () => {
      const sessionToDelete = { ...mockSession, id: 99 };
      mockPrismaService.session.findUnique.mockResolvedValue(sessionToDelete);
      mockPrismaService.session.delete.mockResolvedValue(sessionToDelete);

      const result = await service.shutdownSession(mockUser, mockSession, 99);

      expect(result).toEqual({ ok: true });
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 99 },
      });
    });
  });

  describe('shutdownAllSessions', () => {
    it('should delete all sessions except current session and return ok: true', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.shutdownAllSessions(mockUser, mockSession);

      expect(result).toEqual({ ok: true });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          id: { not: mockSession.id },
        },
      });
    });
  });
});
