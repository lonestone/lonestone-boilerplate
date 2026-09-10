import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module, forwardRef } from '@nestjs/common'
import { NotificationModule } from '../notifications/notification.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { MatchMessage } from './match-message.entity'
import { MessageMention } from './message-mention.entity'

@Module({
  imports: [
    MikroOrmModule.forFeature([MatchMessage, MessageMention]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
