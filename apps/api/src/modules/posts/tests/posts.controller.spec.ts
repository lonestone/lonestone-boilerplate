import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from '../posts.controller';
import { PostService } from '../posts.service';
import { CreatePostInput } from '../contracts/posts.contract';
import { AuthGuard } from '../../auth/auth.guard';

describe('PostController', () => {
  let controller: PostController;
  let service: PostService;

  // Mock du service des posts
  const mockPostService = {
    createPost: jest.fn(),
    publishPost: jest.fn(),
    unpublishPost: jest.fn(),
  };

  // Mock de la session utilisateur
  const mockSession = {
    user: {
      id: 'test-user-id',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PostController>(PostController);
    service = module.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      // Données de test
      const createPostDto: CreatePostInput = {
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      };

      // Mock de la réponse du service
      const expectedResult = {
        id: 'test-post-id',
        slug: 'test-post',
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
        versions: [],
        publishedAt: null,
        type: 'draft',
      };

      mockPostService.createPost.mockResolvedValue(expectedResult);

      // Appel de la méthode du contrôleur
      const result = await controller.createPost(mockSession, createPostDto);

      // Vérifications
      expect(service.createPost).toHaveBeenCalledWith(
        mockSession.user.id,
        createPostDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('publishPost', () => {
    it('should publish a post', async () => {
      // ID du post à publier
      const postId = 'test-post-id';

      // Mock de la réponse du service
      const expectedResult = {
        id: postId,
        slug: 'test-post',
        title: 'Test Post',
        content: [],
        versions: [],
        publishedAt: new Date(),
        type: 'published',
      };

      mockPostService.publishPost.mockResolvedValue(expectedResult);

      // Appel de la méthode du contrôleur
      const result = await controller.publishPost(mockSession, postId);

      // Vérifications
      expect(service.publishPost).toHaveBeenCalledWith(
        mockSession.user.id,
        postId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('unpublishPost', () => {
    it('should unpublish a post', async () => {
      // ID du post à dépublier
      const postId = 'test-post-id';

      // Mock de la réponse du service
      const expectedResult = {
        id: postId,
        slug: 'test-post',
        title: 'Test Post',
        content: [],
        versions: [],
        publishedAt: null,
        type: 'draft',
      };

      mockPostService.unpublishPost.mockResolvedValue(expectedResult);

      // Appel de la méthode du contrôleur
      const result = await controller.unpublishPost(mockSession, postId);

      // Vérifications
      expect(service.unpublishPost).toHaveBeenCalledWith(
        mockSession.user.id,
        postId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
}); 