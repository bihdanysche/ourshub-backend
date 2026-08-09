import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { GeoIpService } from './services/geoip.service';
import { TelegramOidcService } from './telegram/telegram-oidc.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [TelegramOidcService, AuthService, AuthGuard, GeoIpService],
  exports: [AuthService, AuthGuard, JwtModule, GeoIpService],
})
export class AuthModule {}
