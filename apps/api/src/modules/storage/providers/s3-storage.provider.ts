import { Readable } from 'node:stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import type { BucketLocationConstraint } from '@aws-sdk/client-s3'
import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  IStorageProvider,
  StorageProviderObject,
  StorageProviderUploadInput,
} from './storage-provider.interface'

export interface S3StorageProviderOptions {
  bucket: string
  endpoint?: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  createBucket: boolean
}

interface S3ClientLike {
  send(command: object): Promise<unknown>
}

@Injectable()
export class S3StorageProvider implements IStorageProvider, OnModuleInit {
  private readonly client: S3ClientLike

  constructor(
    private readonly options: S3StorageProviderOptions,
    client?: S3ClientLike,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: options.endpoint,
        region: options.region,
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
        forcePathStyle: options.forcePathStyle,
      })
  }

  async onModuleInit(): Promise<void> {
    if (!this.options.createBucket) return

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }))
    } catch (error: unknown) {
      if (!this.isMissingBucketError(error)) throw error

      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.options.bucket,
          CreateBucketConfiguration:
            this.options.region === 'us-east-1'
              ? undefined
              : { LocationConstraint: this.options.region as BucketLocationConstraint },
        }),
      )
    }
  }

  async upload(input: StorageProviderUploadInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.size,
        ContentType: input.contentType,
        Metadata: {
          filename: encodeURIComponent(input.filename),
        },
      }),
    )
  }

  async download(key: string): Promise<StorageProviderObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      )

      if (!this.isGetObjectResponse(response)) {
        throw new Error('The storage provider returned an invalid object stream')
      }

      return {
        body: response.Body,
        contentType: response.ContentType ?? 'application/octet-stream',
        filename: this.decodeFilename(response.Metadata?.filename, key),
        size: response.ContentLength ?? 0,
      }
    } catch (error: unknown) {
      if (this.isMissingObjectError(error)) return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }))
  }

  private isGetObjectResponse(value: unknown): value is {
    Body: Readable
    ContentType?: string
    ContentLength?: number
    Metadata?: Record<string, string>
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'Body' in value &&
      value.Body instanceof Readable
    )
  }

  private isMissingObjectError(error: unknown): boolean {
    return error instanceof Error && error.name === 'NoSuchKey'
  }

  private isMissingBucketError(error: unknown): boolean {
    return (
      (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) ||
      (error instanceof Error && ['NoSuchBucket', 'NotFound'].includes(error.name))
    )
  }

  private decodeFilename(filename: string | undefined, fallback: string): string {
    if (!filename) return fallback

    try {
      return decodeURIComponent(filename)
    } catch {
      return filename
    }
  }
}
