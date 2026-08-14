import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { CommonErrorCode } from 'src/common/errors/common-error-code.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  SESSION_ACTIVITY_UPDATE_INTERVAL_MS,
} from '../constants/auth.constants';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { SessionEntity } from '../entities/session.entity';
import { UserEntity } from '../entities/user.entity';
import { AuthErrorCode } from '../errors/auth-error.code.enum';
import { AccessTokenPayload } from '../interfaces/jwt-payload.interface';
import { getCookie } from '../utils/cookie.util';

interface AuthenticatedRequest extends Request {
  user?: UserEntity | null;
  session?: SessionEntity | null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = getCookie(request, ACCESS_TOKEN_COOKIE);

    if (!token) {
      if (isOptional) {
        request.user = null;
        request.session = null;
        return true;
      }
      throw new UnauthorizedException({
        error_code: CommonErrorCode.UNAUTHORIZED,
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (err: unknown) {
      if (isOptional) {
        request.user = null;
        request.session = null;
        return true;
      }
      if (
        err instanceof TokenExpiredError ||
        (typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          err.name === 'TokenExpiredError')
      ) {
        throw new UnauthorizedException({
          error_code: AuthErrorCode.TOKEN_EXPIRED,
        });
      }
      throw new UnauthorizedException({
        error_code: AuthErrorCode.INVALID_ACCESS_TOKEN,
      });
    }

    if (!payload?.sub || !payload?.sid) {
      if (isOptional) {
        request.user = null;
        request.session = null;
        return true;
      }
      throw new UnauthorizedException({
        error_code: AuthErrorCode.INVALID_ACCESS_TOKEN,
      });
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      if (isOptional) {
        request.user = null;
        request.session = null;
        return true;
      }
      throw new UnauthorizedException({
        error_code: AuthErrorCode.SESSION_EXPIRED,
      });
    }

    const now = Date.now();
    if (
      now - session.lastUsedAt.getTime() >
      SESSION_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      void this.prisma.session
        .update({
          where: { id: session.id },
          data: { lastUsedAt: new Date(now) },
        })
        .catch(() => {});
    }

    const { user, ...sessionData } = session;
    request.user = user;
    request.session = sessionData;

    return true;
  }
}
