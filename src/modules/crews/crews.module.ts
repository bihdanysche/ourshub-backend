import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CrewsController } from './crews.controller';
import { CrewsService } from './crews.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CrewsController],
  providers: [CrewsService],
  exports: [CrewsService],
})
export class CrewsModule {}
