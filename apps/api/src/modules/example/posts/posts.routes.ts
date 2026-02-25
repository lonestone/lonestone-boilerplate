import { Elysia, t } from 'elysia'
import { AuthMacro } from '../../auth/auth.macro'

import { PostService } from './posts.service'

// Routes admin (authentifiees)
export const postRoutes = new Elysia({ prefix: '/admin/posts' })
  .use(AuthMacro)
  .use(PostService)
  .guard({
    auth: true,
  }, app => app

    // POST /admin/posts - Creer un post
    .post('/', async ({ body, user, postService }) => {
      return postService.createPost(user.id, {
        title: body.title,
        content: body.content,
      })
    }, {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        content: t.Array(t.Union([
          t.Object({ type: t.Literal('text'), data: t.String() }),
          t.Object({ type: t.Literal('image'), data: t.String() }),
          t.Object({ type: t.Literal('video'), data: t.String() }),
        ])),
      }),
      detail: { tags: ['Admin Posts'], summary: 'Create a new post' },
    })

    // GET /admin/posts - Liste des posts de l'utilisateur
    .get('/', async ({ user, postService }) => {
      return postService.getUserPosts(user.id, { offset: 0, pageSize: 10 })
    }, {
      detail: { tags: ['Admin Posts'], summary: 'Get user posts' },
    })

    // GET /admin/posts/:id - Recuperer un post
    .get('/:id', async ({ params, user, postService }) => {
      return postService.getUserPost(params.id, user.id)
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Admin Posts'], summary: 'Get a post by ID' },
    })

    // PUT /admin/posts/:id - Mettre a jour un post
    .put('/:id', async ({ params, body, user, postService }) => {
      return postService.updatePost(params.id, user.id, body)
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        content: t.Optional(t.Array(t.Union([
          t.Object({ type: t.Literal('text'), data: t.String() }),
          t.Object({ type: t.Literal('image'), data: t.String() }),
          t.Object({ type: t.Literal('video'), data: t.String() }),
        ]))),
      }),
      detail: { tags: ['Admin Posts'], summary: 'Update a post' },
    })

    // PATCH /admin/posts/:id/publish - Publier un post
    .patch('/:id/publish', async ({ params, user, postService }) => {
      return postService.publishPost(user.id, params.id)
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Admin Posts'], summary: 'Publish a post' },
    })

    // PATCH /admin/posts/:id/unpublish - Depublier un post
    .patch('/:id/unpublish', async ({ params, user, postService }) => {
      return postService.unpublishPost(user.id, params.id)
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Admin Posts'], summary: 'Unpublish a post' },
    }))

// Routes publiques (non authentifiees)
export const publicPostRoutes = new Elysia({ prefix: '/public/posts' })
  .use(PostService) // Add PostService here to make it available in public routes

  // GET /public/posts/random - Post aleatoire
  .get('/random', async ({ postService }) => {
    return postService.getRandomPublicPost()
  }, {
    detail: { tags: ['Public Posts'], summary: 'Get a random public post' },
  })

  // GET /public/posts/:slug - Recuperer un post public par slug
  .get('/:slug', async ({ params, postService }) => {
    return postService.getPublicPost(params.slug)
  }, {
    params: t.Object({ slug: t.String() }),
    detail: { tags: ['Public Posts'], summary: 'Get a public post by slug' },
  })

  // GET /public/posts - Liste des posts publics
  .get('/', async ({ query, postService }) => {
    const pagination = { offset: Number(query.offset ?? 0), pageSize: Number(query.pageSize ?? 10) }
    const filtering = query.filter?.split(';').map((item: string) => {
      const [property, rule, value] = item.split(':')
      return { property, rule, value }
    })
    return postService.getPublicPosts(pagination, filtering ?? [])
  }, {
    detail: { tags: ['Public Posts'], summary: 'Get all public posts' },
  })
