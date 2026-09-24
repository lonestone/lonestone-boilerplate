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

    provider = new S3StorageProvider({
      bucket,
      endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
      region: 'us-east-1',
      accessKeyId: 'rustfsadmin',
      secretAccessKey: 'rustfsadmin',
      forcePathStyle: true,
      createBucket: true,
    })
  }, 120_000)

  afterAll(async () => {
    await container?.stop()
  })

  it('creates its bucket and completes the object lifecycle', async () => {
    const inputBody = Buffer.from('hello RustFS')
    const key = randomUUID()

    await provider.onModuleInit()
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
})

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
