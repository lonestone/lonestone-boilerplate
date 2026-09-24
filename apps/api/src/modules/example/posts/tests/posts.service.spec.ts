import { EntityManager } from '@mikro-orm/core'
import { InternalServerErrorException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../../storage/storage.service'
import { Post } from '../posts.entity'
import { PostService } from '../posts.service'

vi.mock('../posts.entity', () => ({
  Post: class Post {
    versions = { add: vi.fn() }
    tags = { set: vi.fn() }
  },
  PostVersion: class PostVersion {},
}))

const imageUpload = {
  body: Buffer.from('image-bytes'),
  filename: 'cover.png',
  mimeType: 'image/png',
  size: 11,
}

describe('PostService images', () => {
  let em: EntityManager
  let storageService: StorageService
  let service: PostService

  beforeEach(() => {
    em = {
      findOne: vi.fn(),
      flush: vi.fn(),
      persist: vi.fn(),
    } as unknown as EntityManager
    storageService = {
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
    } as unknown as StorageService
    service = new PostService(em, storageService)
  })

  it('deletes the uploaded object when creating a post fails after upload', async () => {
    const persistenceError = new Error('database unavailable')
    vi.mocked(em.findOne).mockResolvedValue({ id: 'user-id' } as never)
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'new-key',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })
    vi.mocked(em.flush).mockRejectedValue(persistenceError)

    await expect(
      service.createPost(
        'user-id',
        { title: 'Title', content: [{ type: 'text', data: 'Body' }] },
        imageUpload,
      ),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: persistenceError,
    })
    expect(storageService.delete).toHaveBeenCalledWith('new-key')
  })

  it('deletes the uploaded object when a database query fails before persistence', async () => {
    const persistenceError = new Error('database unavailable')
    vi.mocked(em.findOne)
      .mockResolvedValueOnce({ id: 'user-id' } as never)
      .mockRejectedValueOnce(persistenceError)
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'new-key',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })

    await expect(
      service.createPost(
        'user-id',
        {
          title: 'Title',
          content: [{ type: 'text', data: 'Body' }],
          tags: ['news'],
        },
        imageUpload,
      ),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: persistenceError,
    })
    expect(storageService.delete).toHaveBeenCalledWith('new-key')
  })

  it('deletes the previous object only after a replacement is committed', async () => {
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImageStorageKey: 'old-key',
      versions: { add: vi.fn() },
      tags: { set: vi.fn() },
    })
    vi.mocked(em.findOne)
      .mockResolvedValueOnce(post as never)
      .mockResolvedValueOnce({
        title: 'Title',
        content: [{ type: 'text', data: 'Body' }],
        createdAt: new Date(),
      } as never)
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'new-key',
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
      size: 20,
    })
    vi.mocked(em.flush).mockResolvedValue(undefined)

    await service.updatePost('post-id', 'user-id', {}, imageUpload)

    expect(storageService.upload).toHaveBeenCalled()
    expect(em.flush).toHaveBeenCalled()
    expect(storageService.delete).toHaveBeenCalledWith('old-key')
    expect(vi.mocked(storageService.delete).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(em.flush).mock.invocationCallOrder[0],
    )
  })

  it('does not delete the previous object when replacement persistence fails', async () => {
    const persistenceError = new Error('database unavailable')
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImageStorageKey: 'old-key',
      versions: { add: vi.fn() },
      tags: { set: vi.fn() },
    })
    vi.mocked(em.findOne)
      .mockResolvedValueOnce(post as never)
      .mockResolvedValueOnce({
        title: 'Title',
        content: [{ type: 'text', data: 'Body' }],
        createdAt: new Date(),
      } as never)
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'new-key',
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
      size: 20,
    })
    vi.mocked(em.flush).mockRejectedValue(persistenceError)

    await expect(service.updatePost('post-id', 'user-id', {}, imageUpload)).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: persistenceError,
    })
    expect(storageService.delete).toHaveBeenCalledWith('new-key')
    expect(storageService.delete).not.toHaveBeenCalledWith('old-key')
  })

  it('keeps a committed image removal successful when storage cleanup fails', async () => {
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImageStorageKey: 'old-key',
      coverImageFilename: 'cover.png',
      coverImageMimeType: 'image/png',
      coverImageSize: 11,
    })
    vi.mocked(em.findOne).mockResolvedValue(post as never)
    vi.mocked(em.flush).mockResolvedValue(undefined)
    vi.mocked(storageService.delete).mockRejectedValue(new Error('storage unavailable'))

    await expect(service.removePostImage('post-id', 'user-id')).resolves.toBeUndefined()

    expect(em.flush).toHaveBeenCalled()
    expect(storageService.delete).toHaveBeenCalledWith('old-key')
    expect(post.coverImageStorageKey).toBeUndefined()
  })
})
