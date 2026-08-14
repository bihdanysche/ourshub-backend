import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SplitsHelperService } from './services/splits-helper.service';
import { SplitsManagementService } from './services/splits-management.service';
import { SplitsPaymentService } from './services/splits-payment.service';
import { SplitsQueryService } from './services/splits-query.service';
import { SplitsController } from './splits.controller';
import { SplitsService } from './splits.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SplitsController],
  providers: [
    SplitsHelperService,
    SplitsQueryService,
    SplitsManagementService,
    SplitsPaymentService,
    SplitsService,
  ],
  exports: [SplitsService],
})
export class SplitsModule {}
