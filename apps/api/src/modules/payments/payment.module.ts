import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { MatchCost } from './match-cost.entity'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'
import { SessionFee } from './session-fee.entity'

@Module({
  imports: [MikroOrmModule.forFeature([MatchCost, SessionFee])],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
