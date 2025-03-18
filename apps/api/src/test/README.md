# Tests pour l'API NestJS

Ce dossier contient les tests pour l'API NestJS du projet. Nous utilisons Jest comme framework de test.

## Structure des tests

Dans le dossier `src/modules/*/tests/`, vous trouverez les tests pour le module `*`.

- **Tests unitaires** : fichiers `*.spec.ts` 
- **Tests e2e** : fichiers `*.e2e-spec.ts` 

## Commandes

```bash
# Tests e2e
pnpm test

# Tests unitaires en mode watch
pnpm test:watch

# Tests avec couverture
pnpm test:cov

```

## Exemple simple de test unitaire

```typescript
// posts.controller.spec.ts
import { Test } from '@nestjs/testing';
import { PostController } from './posts.controller';
import { PostService } from './posts.service';

describe('PostController', () => {
  let controller: PostController;
  let service: PostService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: {
            createPost: jest.fn().mockResolvedValue({
              id: 'test-id',
              title: 'Test Post',
              content: [{ type: 'text', data: 'Test content' }]
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(PostController);
    service = module.get(PostService);
  });

  it('should create a post', async () => {
    const session = { user: { id: 'user-id' } };
    const dto = { 
      title: 'Test Post', 
      content: [{ type: 'text', data: 'Test content' }] 
    };
    
    const result = await controller.createPost(session, dto);
    
    expect(service.createPost).toHaveBeenCalledWith('user-id', dto);
    expect(result.title).toBe('Test Post');
  });
});
```

## Exemple simple de test e2e

```typescript
// posts.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostController } from '../src/modules/posts/posts.controller';
import { PostService } from '../src/modules/posts/posts.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';

describe('Posts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: {
            createPost: jest.fn().mockResolvedValue({
              id: 'test-id',
              title: 'Test Post',
              content: [{ type: 'text', data: 'Test content' }]
            }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    
    // Simuler une session utilisateur
    app.use((req, res, next) => {
      req.session = { user: { id: 'user-id' } };
      next();
    });
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/admin/posts (POST)', () => {
    return request(app.getHttpServer())
      .post('/admin/posts')
      .send({ 
        title: 'Test Post', 
        content: [{ type: 'text', data: 'Test content' }] 
      })
      .expect(201)
      .expect(res => {
        expect(res.body.title).toBe('Test Post');
      });
  });
});
```

## Bonnes pratiques

1. **Isoler les tests** - Chaque test doit être indépendant
2. **Utiliser des mocks** - Simuler les dépendances externes
3. **Tester les cas d'erreur** - Pas seulement les cas de succès
4. **Nettoyer après les tests** - Utiliser `afterEach` ou `afterAll` 