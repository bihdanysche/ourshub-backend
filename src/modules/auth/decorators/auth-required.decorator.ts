import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';

export function AuthRequired() {
  return applyDecorators(UseGuards(AuthGuard));
}
