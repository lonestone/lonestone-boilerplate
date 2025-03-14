import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { PostController } from '../posts.controller';
import { PostService } from '../posts.service';
import { AuthGuard } from '../../auth/auth.guard';

const userId = crypto.randomUUID();
const postId = crypto.randomUUID();

// Mock de l'AuthGuard pour simuler une session utilisateur
class MockAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.session = {
      user: {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      },
    };
    return true;
  }
}

describe('PostsController (e2e)', () => {
  let app: INestApplication;
  // Mock du service des posts
  const mockPostService = {
    createPost: jest.fn(),
    publishPost: jest.fn(),
    unpublishPost: jest.fn(),
  };

  // Token d'authentification fictif pour les tests
  const MOCK_AUTH_TOKEN = 'test-auth-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/admin/posts (POST)', () => {
    it('should create a post', async () => {
      const createPostDto = {
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      };

      const expectedResult = {
        id: postId,
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

      await request(app.getHttpServer())
        .post('/admin/posts')
        .set('Authorization', `Bearer ${MOCK_AUTH_TOKEN}`)
        .send(createPostDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual(expectedResult);
          expect(mockPostService.createPost).toHaveBeenCalledWith(userId, createPostDto);
        });
    });
  });

  describe('/admin/posts/:id/publish (POST)', () => {
    it('should publish a post', async () => {
      const expectedResult = {
        id: postId,
        slug: 'test-post',
        title: 'Test Post',
        content: [],
        versions: [],
        publishedAt: new Date().toISOString(),
        type: 'published',
      };

      mockPostService.publishPost.mockResolvedValue(expectedResult);

      await request(app.getHttpServer())
        .post(`/admin/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${MOCK_AUTH_TOKEN}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual(expectedResult);
          expect(mockPostService.publishPost).toHaveBeenCalledWith(userId, postId);
        });
    });
  });

  describe('/admin/posts/:id/unpublish (POST)', () => {
    it('should unpublish a post', async () => {
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

      await request(app.getHttpServer())
        .post(`/admin/posts/${postId}/unpublish`)
        .set('Authorization', `Bearer ${MOCK_AUTH_TOKEN}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual(expectedResult);
          expect(mockPostService.unpublishPost).toHaveBeenCalledWith(userId, postId);
        });
    });
  });
}); 