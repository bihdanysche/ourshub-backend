import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { CommonErrorCode } from '../errors/common-error-code.enum';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let errorCode: CommonErrorCode | string =
      CommonErrorCode.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'error_code' in exceptionResponse
      ) {
        errorCode = String(exceptionResponse.error_code);
      } else {
        errorCode = this.mapStatusToCode(status);
      }
    }

    response.status(status).json({
      error_code: errorCode,
    });
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return CommonErrorCode.BAD_REQUEST;
      case 401:
        return CommonErrorCode.UNAUTHORIZED;
      case 403:
        return CommonErrorCode.FORBIDDEN;
      case 404:
        return CommonErrorCode.NOT_FOUND;
      case 409:
        return CommonErrorCode.CONFLICT;
      case 429:
        return CommonErrorCode.TOO_MANY_REQUESTS;
      default:
        return CommonErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}
