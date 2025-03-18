import { Test, TestingModule } from "@nestjs/testing";
import { MikroORM } from "@mikro-orm/core";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { createTestMikroOrmOptions } from "../config/mikro-orm.config";
import { ExecutionContext, INestApplication } from "@nestjs/common";
import { json } from "express";
import * as express from "express";
import { User } from "../modules/auth/auth.entity";
import { AuthGuard } from "../modules/auth/auth.guard";

export const TEST_USER_ID = "cc8edee2-e4e6-4122-b77f-344247f86ead";
export const TEST_USER_TOKEN = "test-token";

export interface TestAppContext {
  app: INestApplication;
  orm: MikroORM;
  moduleFixture: TestingModule;
}

/**
 * Initialise une application NestJS pour les tests
 * @param controllers Les contrôleurs à tester
 * @param providers Les providers à injecter
 * @returns Un objet contenant l'application, l'ORM et le module de test
 */
export async function initializeTestApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers: any[]
): Promise<TestAppContext> {
  // Initialiser la connexion à la base de données de test
  const orm = await MikroORM.init(createTestMikroOrmOptions({
    allowGlobalContext: true,
  }));

  // Créer un utilisateur de test
  await createTestUser(orm);

  // Créer un module de test
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      MikroOrmModule.forRoot(createTestMikroOrmOptions({
        allowGlobalContext: true,
      })),
    ],
    controllers,
    providers,
  })
    .overrideGuard(AuthGuard)
    .useValue({ 
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        request.session = {
          user: {
            id: TEST_USER_ID,
          },
        };
        return true;
      },
    })
    .compile();

  // Créer l'application
  const app = moduleFixture.createNestApplication({
    bodyParser: false,
  });
  
  // Configurer l'application comme dans main.ts
  app.use(json({ limit: '50mb' }));
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      // If is routes of better auth, next 
      if (req.originalUrl.startsWith(`auth`)) {
        return next();
      }
      // Else, apply the express json middleware
      express.json()(req, res, next);
    }
  );
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });
  
  await app.init();

  return { app, orm, moduleFixture };
}

/**
 * Crée un utilisateur de test s'il n'existe pas déjà
 * @param orm L'instance MikroORM
 */
async function createTestUser(orm: MikroORM): Promise<void> {
  const forkedEm = orm.em.fork();
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await forkedEm.findOne(User, { id: TEST_USER_ID });
    
    if (!existingUser) {
      // Créer l'utilisateur s'il n'existe pas
      const user = forkedEm.create(User, {
        id: TEST_USER_ID,
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await forkedEm.persistAndFlush(user);
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur de test:', error);
  }
}

/**
 * Nettoie les données de test
 * @param orm L'instance MikroORM
 */
export async function cleanupTestData(orm: MikroORM): Promise<void> {
  try {
    // Utiliser un nouveau fork de l'EntityManager pour le nettoyage
    const forkedEm = orm.em.fork();
    // Supprimer dans le bon ordre pour respecter les contraintes de clé étrangère
    await forkedEm.getConnection().execute('DELETE FROM "comment" CASCADE');
    await forkedEm.getConnection().execute('DELETE FROM "postVersion" CASCADE');
    await forkedEm.getConnection().execute('DELETE FROM "post" CASCADE');
    await forkedEm.flush();
  } catch (error) {
    console.error('Erreur lors du nettoyage des données de test:', error);
  }
}

/**
 * Ferme l'application et l'ORM
 * @param context Le contexte de l'application de test
 */
export async function closeTestApp(context: TestAppContext): Promise<void> {
  await context.app.close();
  await context.orm.close();
} 