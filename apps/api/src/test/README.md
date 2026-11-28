# Tests pour l'API NestJS

Ce dossier contient les tests pour l'API NestJS du projet. Nous utilisons Vitest comme framework de test.

## Structure des tests

```
src/test/
├── helpers/
│   ├── test-app.helper.ts      # initializeTestApp – bootstrap NestJS app pour e2e
│   ├── test-auth.helper.ts     # createRequest, createSessionFromUser, testSessionMiddleware
│   ├── test-db.helper.ts       # createTemplateDatabase, createTestOrm, cleanupTestOrm
│   └── test-user.helpers.ts    # createUserWithSession
├── setup/
│   ├── test.setup.ts           # Import reflect-metadata
│   ├── test.e2e-setup.ts       # beforeEach/afterEach : base du test + ORM, puis suppression
│   └── test.global-setup.ts    # Container PostgreSQL partagé + base modèle + env variables
```

La config Vitest se trouve dans `apps/api/vitest.config.ts` (projets `unit` et `e2e`).

Dans le dossier `src/modules/*/tests/`, vous trouverez les tests pour le module `*`.

- **Tests e2e** : fichiers `*.e2e-spec.ts`. Le test par défaut, pour les routes.
- **Tests unitaires** : fichiers `*.spec.ts`. Seulement pour la logique métier complexe : voir la règle dans `apps/documentation/src/content/docs/guides/api-testing.mdx`.

## Commandes

```bash
# Tous les tests
pnpm test

# Seulement les tests que la branche peut toucher (voir le guide api-testing, « When to run what »)
pnpm test:changed

# Tests en mode watch
pnpm test:watch

# Tests avec couverture
pnpm test:cov
```

## Architecture des tests e2e

Le système utilise :
- **1 container PostgreSQL partagé** démarré via `globalSetup`. Ses données vivent en mémoire (tmpfs), et Postgres tourne sans durabilité (`fsync`, `synchronous_commit` et `full_page_writes` à `off`) : les données n'ont pas à survivre au run.
- **1 base modèle** (`test_template`) construite une seule fois par run, par `schema.refresh()`, dans `globalSetup`
- **1 base de données par worker Vitest** (`test_worker_<n>`), copiée une fois depuis la base modèle (`CREATE DATABASE … TEMPLATE`). Avant chaque test e2e, `createTestOrm` vide toutes ses tables : chaque test part de tables vides
- **`isolate: false`** sur le projet e2e : un worker garde les modules de l'app chargés d'un fichier au suivant. Un fichier e2e ne doit pas laisser derrière lui de `vi.mock`, de fausses horloges ni de `process.env` modifié
- **Sessions parallel-safe** avec `AsyncLocalStorage` + header `X-Test-Session-Id`
- **Pattern AAA** (Arrange-Act-Assert) recommandé

Si tu ajoutes une entité, rien à faire : la base modèle est reconstruite à chaque run depuis les entités.

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

## Bonnes pratiques

1. **Pattern AAA** - Arrange (setup), Act (action), Assert (vérification)
2. **Isolation** - Chaque test e2e a sa propre DB, copiée de la base modèle et vide de données, utiliser `context.em` pour les données
3. **Sessions par requête** - Utiliser `request.withSession(session)` pour les tests parallèles
4. **Stocker l'app** - Toujours mettre `context.app = app` pour le cleanup automatique
5. **Factories** - Créer les données de test avec les factories du module (`<module>.factory.ts`, par exemple `PostFactory`) et `createUserData` pour les utilisateurs. Voir le guide « Entity factories » de la documentation
