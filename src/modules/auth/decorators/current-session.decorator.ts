import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionEntity } from '../entities/session.entity';

interface RequestWithSession {
  session?: SessionEntity | null;
}

export const CurrentSession = createParamDecorator(
  (data: keyof SessionEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithSession>();
    const session = request.session;
    return data && session ? session[data] : session;
  },
);
