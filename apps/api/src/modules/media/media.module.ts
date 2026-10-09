import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { Media } from './media.entity'
import { MediaMapper } from './media.mapper'
import { MediaService } from './media.service'

@Module({
  imports: [MikroOrmModule.forFeature([Media]), StorageModule],
  providers: [MediaService, MediaMapper],
  exports: [MediaService, MediaMapper],
})
export class MediaModule {}
