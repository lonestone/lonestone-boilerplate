import { randomUUID } from 'node:crypto'
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { S3StorageProvider } from '../providers/s3-storage.provider'

describe('S3StorageProvider with RustFS', () => {
  const bucket = `storage-integration-${randomUUID()}`
  let container: StartedTestContainer
  let provider: S3StorageProvider

  beforeAll(async () => {
    container = await new GenericContainer('rustfs/rustfs:latest')
      .withEnvironment({
        RUSTFS_ACCESS_KEY: 'rustfsadmin',
        RUSTFS_SECRET_KEY: 'rustfsadmin',
        RUSTFS_CONSOLE_ENABLE: 'false',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/health', 9000))
      .withStartupTimeout(120_000)
      .start()

    provider = createProvider({ signedUrlExpiresIn: 60 })
    await provider.onModuleInit()
  }, 120_000)

  function createProvider(input: { signedUrlExpiresIn: number }): S3StorageProvider {
    return new S3StorageProvider({
      bucket,
      endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
      region: 'us-east-1',
      accessKeyId: 'rustfsadmin',
      secretAccessKey: 'rustfsadmin',
      forcePathStyle: true,
      createBucket: true,
      signedUrlExpiresIn: input.signedUrlExpiresIn,
    })
  }

  afterAll(async () => {
    await container?.stop()
  })

  it('creates its bucket and completes the object lifecycle', async () => {
    const inputBody = Buffer.from('hello RustFS')
    const key = randomUUID()

    await provider.upload({
      key,
      body: inputBody,
      contentType: 'text/plain',
      filename: 'hello.txt',
      size: inputBody.length,
    })

    const object = await provider.download(key)
    expect(object).not.toBeNull()
    expect(object).toMatchObject({
      contentType: 'text/plain',
      filename: 'hello.txt',
      size: inputBody.length,
    })
    expect(await readStream(object!.body)).toEqual(inputBody)

    await provider.delete(key)
    await expect(provider.download(key)).resolves.toBeNull()
  })

  it('serves an object through a pre-signed GET URL', async () => {
    const inputBody = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const key = randomUUID()
    await provider.upload({
      key,
      body: inputBody,
      contentType: 'application/octet-stream',
      filename: 'stored.bin',
      size: inputBody.length,
    })

    const { url } = await provider.getSignedUrl(key, {
      filename: 'couverture été.png',
      mimeType: 'image/png',
    })
    const actualResponse = await fetch(url)

    expect(actualResponse.status).toBe(200)
    expect(actualResponse.headers.get('content-type')).toBe('image/png')
    expect(actualResponse.headers.get('content-disposition')).toBe(
      "inline; filename*=UTF-8''couverture%20%C3%A9t%C3%A9.png",
    )
    expect(Buffer.from(await actualResponse.arrayBuffer())).toEqual(inputBody)

    await provider.delete(key)
  })

  it('refuses a pre-signed URL whose signature was tampered with', async () => {
    const inputBody = Buffer.from('private')
    const key = randomUUID()
    await provider.upload({
      key,
      body: inputBody,
      contentType: 'text/plain',
      filename: 'private.txt',
      size: inputBody.length,
    })

    const { url } = await provider.getSignedUrl(key, {
      filename: 'private.txt',
      mimeType: 'text/plain',
    })
    const tamperedUrl = new URL(url)
    tamperedUrl.searchParams.set('response-content-type', 'text/html')
    const actualResponse = await fetch(tamperedUrl)

    expect(actualResponse.status).toBe(403)

    await provider.delete(key)
  })

  it('refuses a pre-signed URL after it expires', async () => {
    const inputBody = Buffer.from('short-lived')
    const key = randomUUID()
    const shortLivedProvider = createProvider({ signedUrlExpiresIn: 1 })
    await provider.upload({
      key,
      body: inputBody,
      contentType: 'text/plain',
      filename: 'short-lived.txt',
      size: inputBody.length,
    })

    const { url, expiresAt } = await shortLivedProvider.getSignedUrl(key, {
      filename: 'short-lived.txt',
      mimeType: 'text/plain',
    })
    await new Promise((resolve) => setTimeout(resolve, expiresAt.getTime() - Date.now() + 1500))
    const actualResponse = await fetch(url)

    expect(actualResponse.status).toBe(403)

    await provider.delete(key)
  })
})

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
