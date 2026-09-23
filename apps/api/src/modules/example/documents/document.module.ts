import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { StorageModule } from '../../storage/storage.module'
import { DocumentController } from './document.controller'
import { Document } from './document.entity'
import { DocumentMapper } from './document.mapper'
import { DocumentService } from './document.service'

@Module({
  imports: [MikroOrmModule.forFeature([Document]), StorageModule],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentMapper],
  exports: [DocumentService],
})
export class DocumentModule {}
