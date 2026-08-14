import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CommonErrorCode } from './common/errors/common-error-code.enum';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: () => {
        return new BadRequestException({
          error_code: CommonErrorCode.BAD_REQUEST,
        });
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const frontendUri = configService.get<string>('FRONTEND_URI') ?? 'https://ourshub.pp.ua';
  const allowedOrigins = frontendUri.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = configService.get<number>('PORT') ?? 8080;
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
