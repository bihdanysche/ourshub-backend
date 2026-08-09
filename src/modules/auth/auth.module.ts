import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelegramOidcService } from './telegram/telegram-oidc.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [TelegramOidcService, AuthService],
})
export class AuthModule {}
