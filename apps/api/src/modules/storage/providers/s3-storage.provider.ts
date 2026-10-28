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
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { OnModuleInit } from '@nestjs/common'
import {
  IStorageProvider,
  SignedUrl,
  SignedUrlOptions,
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
  signedUrlExpiresIn: number
}

export class S3StorageProvider implements IStorageProvider, OnModuleInit {
  private readonly client: S3Client

  constructor(private readonly options: S3StorageProviderOptions) {
    this.client = new S3Client({
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

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }))
  }

  /**
   * Every call within the same signing window returns the same URL, so browsers and query
   * caches can reuse the file. Each returned URL stays valid for at least half its lifetime.
   */
  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<SignedUrl> {
    const expiresIn = this.options.signedUrlExpiresIn
    const signingDate = this.getSigningWindowStart()
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        ResponseContentType: options.mimeType,
        ResponseContentDisposition: `inline; filename*=UTF-8''${this.encodeFilename(options.filename)}`,
        // Keys are never reused, so the bytes behind a URL never change.
        ResponseCacheControl: `private, max-age=${expiresIn}, immutable`,
      }),
      { expiresIn, signingDate },
    )

    return {
      url,
      expiresAt: new Date(signingDate.getTime() + expiresIn * 1000),
    }
  }

  private getSigningWindowStart(): Date {
    const windowMs = Math.max(1, Math.floor(this.options.signedUrlExpiresIn / 2)) * 1000
    return new Date(Math.floor(Date.now() / windowMs) * windowMs)
  }

  private isMissingBucketError(error: unknown): boolean {
    return (
      (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) ||
      (error instanceof Error && ['NoSuchBucket', 'NotFound'].includes(error.name))
    )
  }

  private encodeFilename(filename: string): string {
    return encodeURIComponent(filename).replaceAll("'", '%27')
  }
}
