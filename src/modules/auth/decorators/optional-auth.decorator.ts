import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

export function OptionalAuth() {
  return applyDecorators(
    SetMetadata(IS_OPTIONAL_AUTH_KEY, true),
    UseGuards(AuthGuard),
  );
}
