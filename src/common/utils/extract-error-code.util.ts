import { HttpException } from '@nestjs/common';
import { CommonErrorCode } from '../errors/common-error-code.enum';

export function extractErrorCode(
  err: unknown,
  fallback: string = CommonErrorCode.INTERNAL_SERVER_ERROR,
): string {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'error_code' in response
    ) {
      return String((response).error_code);
    }
  }
  return fallback;
}
