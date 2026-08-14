import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StorageModule } from 'src/modules/storage/storage.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CrewsController } from './crews.controller';
import { CrewsService } from './crews.service';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [CrewsController],
  providers: [CrewsService],
  exports: [CrewsService],
})
export class CrewsModule {}
