import { EntityManager } from '@mikro-orm/core'
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

const inputFile = new File([Buffer.from('image-bytes')], 'cover.png', { type: 'image/png' })
const inputContent = [{ type: 'text' as const, data: 'Body' }]

function createMedia(storageKey: string): Media {
  return Object.assign(new Media(), { id: `${storageKey}-id`, storageKey })
}

function createPostWithCover(coverImage?: Media): Post {
  return Object.assign(new Post(), { id: 'post-id', coverImage })
}

const latestVersion = { title: 'Title', content: inputContent, createdAt: new Date() }

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
      upload: vi.fn(),
      attach: vi.fn((media: Media) => media),
      remove: vi.fn(),
    } as unknown as MediaService
    service = new PostService(em, mediaService)
  })

  describe('createPost', () => {
    it('uploads, attaches, then saves the cover image with the post', async () => {
      const expectedMedia = createMedia('new-key')
      vi.mocked(em.findOne).mockResolvedValue({ id: 'user-id' } as never)
      vi.mocked(mediaService.upload).mockResolvedValue(expectedMedia)

      const actualPost = await service.createPost('user-id', {
        title: 'Title',
        content: inputContent,
        coverImage: inputFile,
      })

      expect(mediaService.upload).toHaveBeenCalledWith(inputFile)
      expect(mediaService.attach).toHaveBeenCalledWith(expectedMedia)
      expect(actualPost.coverImage).toBe(expectedMedia)
      expect(mediaService.remove).not.toHaveBeenCalled()
    })

    it('removes the uploaded file and rethrows when the save fails', async () => {
      const expectedError = new Error('database unavailable')
      const uploadedMedia = createMedia('new-key')
      vi.mocked(em.findOne).mockResolvedValue({ id: 'user-id' } as never)
      vi.mocked(mediaService.upload).mockResolvedValue(uploadedMedia)
      vi.mocked(em.flush).mockRejectedValue(expectedError)

      await expect(
        service.createPost('user-id', {
          title: 'Title',
          content: inputContent,
          coverImage: inputFile,
        }),
      ).rejects.toBe(expectedError)

      expect(mediaService.remove).toHaveBeenCalledWith(uploadedMedia)
    })

    it('does not upload when the post fails before the save', async () => {
      const expectedError = new Error('database unavailable')
      vi.mocked(em.findOne)
        .mockResolvedValueOnce({ id: 'user-id' } as never)
        .mockRejectedValueOnce(expectedError)

      await expect(
        service.createPost('user-id', {
          title: 'Title',
          content: inputContent,
          tags: ['news'],
          coverImage: inputFile,
        }),
      ).rejects.toBe(expectedError)

      expect(mediaService.upload).not.toHaveBeenCalled()
    })
  })

  describe('updatePost', () => {
    it('replaces the cover image and removes the old file after the save', async () => {
      const previousMedia = createMedia('old-key')
      const expectedMedia = createMedia('new-key')
      const post = createPostWithCover(previousMedia)
      vi.mocked(em.findOne)
        .mockResolvedValueOnce(post as never)
        .mockResolvedValueOnce(latestVersion as never)
      vi.mocked(mediaService.upload).mockResolvedValue(expectedMedia)

      await service.updatePost('post-id', 'user-id', { coverImage: inputFile })

      expect(post.coverImage).toBe(expectedMedia)
      expect(em.remove).toHaveBeenCalledWith(previousMedia)
      expect(mediaService.remove).toHaveBeenCalledWith(previousMedia)
      expect(vi.mocked(mediaService.remove).mock.invocationCallOrder[0]).toBeGreaterThan(
        vi.mocked(em.flush).mock.invocationCallOrder[0],
      )
    })

    it('keeps the old file and removes the new one when the save fails', async () => {
      const previousMedia = createMedia('old-key')
      const uploadedMedia = createMedia('new-key')
      vi.mocked(em.findOne)
        .mockResolvedValueOnce(createPostWithCover(previousMedia) as never)
        .mockResolvedValueOnce(latestVersion as never)
      vi.mocked(mediaService.upload).mockResolvedValue(uploadedMedia)
      vi.mocked(em.flush).mockRejectedValue(new Error('database unavailable'))

      await expect(
        service.updatePost('post-id', 'user-id', { coverImage: inputFile }),
      ).rejects.toThrow('database unavailable')

      expect(mediaService.remove).toHaveBeenCalledTimes(1)
      expect(mediaService.remove).toHaveBeenCalledWith(uploadedMedia)
    })
  })

  it('removes the cover image row, then its file', async () => {
    const previousMedia = createMedia('old-key')
    const post = createPostWithCover(previousMedia)
    vi.mocked(em.findOne).mockResolvedValue(post as never)

    await service.removePostImage('post-id', 'user-id')

    expect(post.coverImage).toBeUndefined()
    expect(em.remove).toHaveBeenCalledWith(previousMedia)
    expect(mediaService.remove).toHaveBeenCalledWith(previousMedia)
    expect(vi.mocked(mediaService.remove).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(em.flush).mock.invocationCallOrder[0],
    )
  })
})
