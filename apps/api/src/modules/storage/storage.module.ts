import { Module } from '@nestjs/common'
import { config } from '../../config/env.config'
import { DisabledStorageProvider } from './providers/disabled-storage.provider'
import { S3StorageProvider } from './providers/s3-storage.provider'
import { IStorageProvider, STORAGE_PROVIDER } from './providers/storage-provider.interface'
import { StorageService } from './storage.service'

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): IStorageProvider => {
        if (!config.storage.enabled) return new DisabledStorageProvider()

        return new S3StorageProvider(config.storage)
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
