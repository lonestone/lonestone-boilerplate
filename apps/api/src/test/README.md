# Tests pour l'API NestJS

Ce dossier contient les tests pour l'API NestJS du projet. Nous utilisons Vitest comme framework de test.

## Structure des tests

```
src/test/
├── helpers/
│   ├── test-app.helper.ts      # initializeTestApp – bootstrap NestJS app pour e2e
│   ├── test-auth.helper.ts     # createRequest, createSessionFromUser, testSessionMiddleware
│   ├── test-db.helper.ts       # createTestOrm, cleanupTestOrm
│   └── test-user.helpers.ts    # createUserWithSession
├── setup/
│   ├── test.setup.ts           # Import reflect-metadata
│   ├── test.e2e-setup.ts       # beforeEach/afterEach avec ORM + cleanup
│   └── test.global-setup.ts    # Container PostgreSQL partagé + env variables
```

La config Vitest se trouve dans `apps/api/vitest.config.ts` (projets `unit` et `e2e`).

Dans le dossier `src/modules/*/tests/`, vous trouverez les tests pour le module `*`.

- **Tests unitaires** : fichiers `*.spec.ts`
- **Tests e2e** : fichiers `*.e2e-spec.ts`

## Commandes

```bash
# Tests
pnpm test

# Tests en mode watch
pnpm test:watch

# Tests avec couverture
pnpm test:cov
```

## Architecture des tests e2e

Le système utilise :
- **1 container PostgreSQL partagé** démarré via `globalSetup` (rapide)
- **1 base de données par test** pour l'isolation totale
- **Sessions parallel-safe** avec `AsyncLocalStorage` + header `X-Test-Session-Id`
- **Pattern AAA** (Arrange-Act-Assert) recommandé

## Exemple de test e2e (controller)

```typescript
// posts.controller.e2e-spec.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { PostModule } from '../posts.module'

describe('postController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp({ orm: context.orm }, {
      imports: [PostModule],
    })
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  it('should create a post', async (context) => {
    const { em, request } = context
    // Arrange
    const { session } = await createUserWithSession(em)
    const createPostDto = {
      title: 'Test Post',
      content: [{ type: 'text', data: 'Test content' }],
    }

    // Act
    const response = await request.withSession(session)
      .post('/admin/posts')
      .send(createPostDto)

    // Assert
    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: 'Test Post',
      type: 'draft',
    })
  })

  it('should return 401 when unauthenticated', async (context) => {
    const { request } = context
    // Act - no session
    const response = await request.post('/admin/posts').send({
      title: 'Test Post',
      content: [{ type: 'text', data: 'content' }],
    })

    // Assert
    expect(response.status).toBe(401)
  })
})
```

## Exemple de test unitaire (service)

```typescript
// posts.service.spec.ts
import { Test } from '@nestjs/testing'
import { PostService } from './posts.service'

describe('PostService', () => {
  let service: PostService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: 'EntityManager',
          useValue: {
            find: vi.fn(),
            persistAndFlush: vi.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(PostService)
  })

  it('should create a post', async () => {
    // ...
  })
})
```

## Bonnes pratiques

1. **Pattern AAA** - Arrange (setup), Act (action), Assert (vérification)
2. **Isolation** - Chaque test a sa propre DB, utiliser `context.em` pour les données
3. **Sessions par requête** - Utiliser `request.withSession(session)` pour les tests parallèles
4. **Stocker l'app** - Toujours mettre `context.app = app` pour le cleanup automatique
5. **Factories** - Utiliser les factories dans `src/factories/` pour créer les données de test
