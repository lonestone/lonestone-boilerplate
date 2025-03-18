import { <%= className %>Controller } from "../<%= name %>.controller";
import { <%= className %>Service } from "../<%= name %>.service";
import { Create<%= className %>Input } from "../contracts/<%= name %>.contract";
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

describe("<%= className %>Controller (e2e)", () => {
  let testContext: TestAppContext;
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    // Initialiser l'application de test
    testContext = await initializeTestApp([<%= className %>Controller], [<%= className %>Service]);
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

  describe("POST /admin/<%= name %>", () => {
    it("should create a <%= name %>", async () => {
      const create<%= className %>Dto: Create<%= className %>Input = {
        name: "Test <%= className %>",
        description: "This is a test <%= name %> description",
      };

      try {
        const response = await supertest(app.getHttpServer())
          .post("/admin/<%= name %>")
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .send(create<%= className %>Dto)
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: "Test <%= className %>",
          description: "This is a test <%= name %> description",
        });

        return response;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error creating <%= name %>:', error.message);
        } else {
          console.error('Error creating <%= name %>:', error);
        }
        throw error;
      }
    });
  });

  describe("GET /admin/<%= name %>/:id", () => {
    it("should get a <%= name %> by id", async () => {
      try {
        // First create a <%= name %>
        const createResponse = await supertest(app.getHttpServer())
          .post("/admin/<%= name %>")
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .send({
            name: "Test <%= className %>",
            description: "This is a test <%= name %> description",
          })
          .expect(201);

        const <%= name %>Id = createResponse.body.id;

        // Then get it by id
        const getResponse = await supertest(app.getHttpServer())
          .get(`/admin/<%= name %>/${<%= name %>Id}`)
          .set("Authorization", `Bearer ${TEST_USER_TOKEN}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: <%= name %>Id,
          name: "Test <%= className %>",
          description: "This is a test <%= name %> description",
        });

        return getResponse;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in get <%= name %> test:', error.message);
        } else {
          console.error('Error in get <%= name %> test:', error);
        }
        throw error;
      }
    });
  });
});