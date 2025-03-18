import { PostController } from "../posts.controller";
import { PostService } from "../posts.service";
import { CreatePostInput } from "../contracts/posts.contract";
import { MikroORM } from "@mikro-orm/core";
import { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import { 
  initializeTestApp, 
  cleanupTestData, 
  closeTestApp, 
  TEST_USER_TOKEN, 
  TestAppContext 
} from "../../../test/test-utils";
import { AllMethods } from "supertest/types";

describe("PostController (e2e)", () => {
  let testContext: TestAppContext;
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    // Initialiser l'application de test
    testContext = await initializeTestApp([PostController], [PostService]);
    app = testContext.app;
    orm = testContext.orm;
  });

  afterEach(async () => {
    // Nettoyer les données de test après chaque test
    await cleanupTestData(orm);
  });

  afterAll(async () => {
    // Fermer l'application et l'ORM
    await closeTestApp(testContext);
  });

  // Test pour vérifier les routes disponibles
  it('should have the correct routes registered', () => {
    const server = app.getHttpServer();
    const router = server._events.request._router;
    
    // Vérifier si les routes que nous voulons tester existent
    const routes = router.stack
      .filter((layer: {
        route: {
          path: string;
          methods: Record<string, boolean>;
        };
      }) => layer.route)
      .map((layer: {
        route: {
          path: string;
          methods: Record<string, boolean>;
        };
      }) => {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods);
        return { path, methods };
      });
    
    // Vérifier si nos routes de test existent
    const hasCreatePostRoute = routes.some((route: {
      path: string;
      methods: AllMethods[];
    }) => 
      route.path === '/admin/posts' && route.methods.includes('post'));
    
    const hasPublishPostRoute = routes.some((route: {
      path: string;
      methods: AllMethods[];
    }) => 
      route.path.includes('/admin/posts/') && route.path.includes('/publish') && route.methods.includes('patch'));
    
    const hasUnpublishPostRoute = routes.some((route: {
      path: string;
      methods: AllMethods[];
    }) => 
      route.path.includes('/admin/posts/') && route.path.includes('/unpublish') && route.methods.includes('patch'));
    
    expect(hasCreatePostRoute).toBeTruthy();
    expect(hasPublishPostRoute).toBeTruthy();
    expect(hasUnpublishPostRoute).toBeTruthy();
  });

  describe("POST /admin/posts", () => {
    it("should create a post", async () => {
      const createPostDto: CreatePostInput = {
        title: "Test Post",
        content: [
          {
            type: "text",
            data: "This is a test post content",
          },
        ],
      };

      try {
        const response = await supertest(app.getHttpServer())
          .post("/admin/posts")
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .send(createPostDto)
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          title: "Test Post",
          content: expect.any(Array),
          type: "draft",
        });


        return response;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error creating post:', error.message);
        } else {
          console.error('Error creating post:', error);
        }
        throw error;
      }
    });
  });



  describe("PATCH /admin/posts/:id/publish", () => {
    it("should publish a post", async () => {
      try {
        // First create a post
        const createResponse = await supertest(app.getHttpServer())
          .post("/admin/posts")
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .send({
            title: "Test Post",
            content: [
              {
                type: "text",
                data: "This is a test post content",
              },
            ],
          })
          .expect(201);

        const postId = createResponse.body.id;

        // Then publish it
        const publishResponse = await supertest(app.getHttpServer())
          .patch(`/admin/posts/${postId}/publish`)
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .expect(200);

        expect(publishResponse.body).toMatchObject({
          id: postId,
          type: "published",
          slug: `test-post-${postId.slice(0, 8)}`,
          publishedAt: expect.any(String),
        });

        return publishResponse;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in publish test:', error.message);
        } else {
          console.error('Error in publish test:', error);
        }
        throw error;
      }
    });
  });

  describe("PATCH /admin/posts/:id/unpublish", () => {
    it("should unpublish a post", async () => {
      try {
        // First create a post
        const createResponse = await supertest(app.getHttpServer())
          .post("/admin/posts")
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .send({
            title: "Test Post",
            content: [
              {
                type: "text",
                data: "This is a test post content",
              },
            ],
          })
          .expect(201);

        const postId = createResponse.body.id;

        // Then publish it
        await supertest(app.getHttpServer())
          .patch(`/admin/posts/${postId}/publish`)
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .expect(200);

        // Finally unpublish it
        await supertest(app.getHttpServer())
          .patch(`/admin/posts/${postId}/unpublish`)
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .expect(200);
        
        const unpublishResponse = await supertest(app.getHttpServer())
          .get(`/admin/posts/${postId}`)
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .expect(200);

        console.log(unpublishResponse.body);

        expect(unpublishResponse.body).toMatchObject({
          id: postId,
          type: "draft",
          publishedAt: null,
        });

        return unpublishResponse;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in unpublish test:', error.message);
        } else {
          console.error('Error in unpublish test:', error);
        }
        throw error;
      }
    });
  });
});
