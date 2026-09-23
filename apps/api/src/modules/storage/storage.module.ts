import { Module } from '@nestjs/common'
import { config } from '../../config/env.config'
import { S3StorageProvider } from './providers/s3-storage.provider'
import { STORAGE_PROVIDER } from './providers/storage-provider.interface'
import { StorageController } from './storage.controller'
import { StorageService } from './storage.service'

@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): S3StorageProvider =>
        new S3StorageProvider({
          bucket: config.storage.bucket,
          endpoint: config.storage.endpoint,
          region: config.storage.region,
          accessKeyId: config.storage.accessKeyId,
          secretAccessKey: config.storage.secretAccessKey,
          forcePathStyle: config.storage.forcePathStyle,
          createBucket: config.storage.createBucket,
        }),
    },
    {
      provide: 'STORAGE_BUCKET',
      useValue: config.storage.bucket,
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
