import { EntityManager } from '@mikro-orm/core'
import { InternalServerErrorException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Media } from '../../../media/media.entity'
import { MediaService } from '../../../media/media.service'
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

function createMedia(storageKey: string): Media {
  return Object.assign(new Media(), {
    id: `${storageKey}-id`,
    storageKey,
    filename: 'cover.png',
    mimeType: 'image/png',
    size: 11,
  })
}

describe('PostService images', () => {
  let em: EntityManager
  let mediaService: MediaService
  let service: PostService

  beforeEach(() => {
    em = {
      findOne: vi.fn(),
      flush: vi.fn(),
      persist: vi.fn(),
      remove: vi.fn(),
    } as unknown as EntityManager
    mediaService = {
      create: vi.fn(),
      downloadObject: vi.fn(),
      deleteObject: vi.fn(),
    } as unknown as MediaService
    service = new PostService(em, mediaService)
  })

  it('deletes the uploaded object when creating a post fails after upload', async () => {
    const persistenceError = new Error('database unavailable')
    vi.mocked(em.findOne).mockResolvedValue({ id: 'user-id' } as never)
    vi.mocked(mediaService.create).mockResolvedValue(createMedia('new-key'))
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
    expect(mediaService.deleteObject).toHaveBeenCalledWith('new-key')
  })

  it('deletes the uploaded object when a database query fails before persistence', async () => {
    const persistenceError = new Error('database unavailable')
    vi.mocked(em.findOne)
      .mockResolvedValueOnce({ id: 'user-id' } as never)
      .mockRejectedValueOnce(persistenceError)
    vi.mocked(mediaService.create).mockResolvedValue(createMedia('new-key'))

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
    expect(mediaService.deleteObject).toHaveBeenCalledWith('new-key')
  })

  it('reports both errors when the compensating delete also fails', async () => {
    const persistenceError = new Error('database unavailable')
    const cleanupError = new Error('storage unavailable')
    vi.mocked(em.findOne).mockResolvedValue({ id: 'user-id' } as never)
    vi.mocked(mediaService.create).mockResolvedValue(createMedia('new-key'))
    vi.mocked(em.flush).mockRejectedValue(persistenceError)
    vi.mocked(mediaService.deleteObject).mockRejectedValue(cleanupError)

    await expect(
      service.createPost(
        'user-id',
        { title: 'Title', content: [{ type: 'text', data: 'Body' }] },
        imageUpload,
      ),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: { errors: [persistenceError, cleanupError] },
    })
  })

  it('removes the previous media in the same flush and deletes its object after commit', async () => {
    const previousMedia = createMedia('old-key')
    const newMedia = createMedia('new-key')
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImage: previousMedia,
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
    vi.mocked(mediaService.create).mockResolvedValue(newMedia)
    vi.mocked(em.flush).mockResolvedValue(undefined)

    await service.updatePost('post-id', 'user-id', {}, imageUpload)

    expect(post.coverImage).toBe(newMedia)
    expect(em.remove).toHaveBeenCalledWith(previousMedia)
    expect(vi.mocked(em.remove).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(em.flush).mock.invocationCallOrder[0],
    )
    expect(mediaService.deleteObject).toHaveBeenCalledWith('old-key')
    expect(vi.mocked(mediaService.deleteObject).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(em.flush).mock.invocationCallOrder[0],
    )
  })

  it('does not delete the previous object when replacement persistence fails', async () => {
    const persistenceError = new Error('database unavailable')
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImage: createMedia('old-key'),
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
    vi.mocked(mediaService.create).mockResolvedValue(createMedia('new-key'))
    vi.mocked(em.flush).mockRejectedValue(persistenceError)

    await expect(service.updatePost('post-id', 'user-id', {}, imageUpload)).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: persistenceError,
    })
    expect(mediaService.deleteObject).toHaveBeenCalledWith('new-key')
    expect(mediaService.deleteObject).not.toHaveBeenCalledWith('old-key')
  })

  it('keeps a committed image removal successful when storage cleanup fails', async () => {
    const previousMedia = createMedia('old-key')
    const post = Object.assign(new Post(), {
      id: 'post-id',
      coverImage: previousMedia,
    })
    vi.mocked(em.findOne).mockResolvedValue(post as never)
    vi.mocked(em.flush).mockResolvedValue(undefined)
    vi.mocked(mediaService.deleteObject).mockRejectedValue(new Error('storage unavailable'))

    await expect(service.removePostImage('post-id', 'user-id')).resolves.toBeUndefined()

    expect(em.remove).toHaveBeenCalledWith(previousMedia)
    expect(em.flush).toHaveBeenCalled()
    expect(mediaService.deleteObject).toHaveBeenCalledWith('old-key')
    expect(post.coverImage).toBeUndefined()
  })
})
