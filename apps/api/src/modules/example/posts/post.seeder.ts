import { faker } from '@faker-js/faker'
import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { addDays } from 'date-fns'
import slugify from 'slugify'
import { Tag } from '../tags/tag.entity'
import { Post, PostVersion } from './posts.entity'

const POST_DEFINITIONS = [
  {
    title: 'Building Type-Safe APIs with NestJS and Zod',
    excerpt: 'How runtime validation and TypeScript work together to eliminate an entire class of bugs at the boundary between your API and its consumers.',
    imageKey: 'nestjs-zod',
  },
  {
    title: 'MikroORM in Production: Lessons Learned',
    excerpt: 'After running MikroORM in three production apps, here are the patterns we leaned on and the pitfalls we wish someone had warned us about.',
    imageKey: 'mikroorm-prod',
  },
  {
    title: 'The Case for Monorepos in Modern Full-Stack Teams',
    excerpt: 'Monorepos are not just a tooling choice — they shape how teams communicate, how features ship, and how bugs are caught before they reach users.',
    imageKey: 'monorepo-teams',
  },
  {
    title: 'React Server Components vs. Client Components: A Practical Guide',
    excerpt: 'Beyond the hype: a concrete decision framework for choosing the right rendering model for each part of your React application.',
    imageKey: 'rsc-guide',
  },
  {
    title: 'Designing Pagination That Scales',
    excerpt: 'Offset pagination is deceptively simple. Cursor-based pagination is deceptively complex. Here is how to choose — and implement — the right approach.',
    imageKey: 'pagination-scale',
  },
  {
    title: 'OpenTelemetry for NestJS: A Complete Setup',
    excerpt: 'Distributed traces, structured logs, and Sentry integration — all wired together in a production NestJS service with zero black magic.',
    imageKey: 'otel-nestjs',
  },
  {
    title: 'End-to-End Type Safety Across the Stack',
    excerpt: 'From database columns to React component props, there is now a straight line of types. This post explains how we got there and what we gave up.',
    imageKey: 'e2e-types',
  },
  {
    title: 'Writing Maintainable E2E Tests with Vitest and Testcontainers',
    excerpt: 'Containerised databases per test run, zero shared state, and deterministic seeds — the testing setup that finally made our CI green and kept it that way.',
    imageKey: 'e2e-vitest',
  },
  {
    title: 'Better Auth: Drop-In Authentication Without the Lock-In',
    excerpt: 'An honest comparison of Better Auth against Clerk, Auth.js, and rolling your own — with a focus on data ownership and migration cost.',
    imageKey: 'better-auth',
  },
  {
    title: 'Optimistic UI Updates in React: Patterns and Trade-offs',
    excerpt: 'When you update the UI before the server confirms, users feel speed. When the server disagrees, users feel confusion. Here is how to handle both.',
    imageKey: 'optimistic-ui',
  },
]

function generateDatePublished(post: Post) {
  const items = post.versions.getItems()
  if (items.length === 1) {
    return addDays(items[0].createdAt, 1)
  }
  const secondToLast = items[items.length - 2]
  const last = items[items.length - 1]
  return faker.date.between({
    from: secondToLast.createdAt,
    to: addDays(last.createdAt, 2),
  })
}

function computeSlug(post: Post): string | undefined {
  if (post.versions.length === 0)
    return undefined

  const baseSlug = slugify(post.versions.getItems()[0].title, { lower: true, strict: true })
  const shortId = post.id.substring(0, 8)
  return `${baseSlug}-${shortId}`
}

function pickRandomTags(tags: Tag[], min = 1, max = 3): Tag[] {
  const shuffled = [...tags].sort(() => Math.random() - 0.5)
  const count = faker.number.int({ min, max: Math.min(max, tags.length) })
  return shuffled.slice(0, count)
}

export class PostSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const tags: Tag[] = context.tags ?? []
    const posts: Post[] = []

    const postDefs = [...POST_DEFINITIONS]
    let defIndex = 0

    for (const user of context.users) {
      const postCount = faker.number.int({ min: 1, max: 3 })
      for (let i = 0; i < postCount; i++) {
        const def = postDefs[defIndex % postDefs.length]
        defIndex++

        const createdAt = faker.date.between({
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        })

        const post = new Post()
        post.user = user.id
        post.createdAt = createdAt
        post.coverImage = `https://picsum.photos/seed/${def.imageKey}/1200/630`
        await em.persist(post).flush()

        // Create initial version with realistic content
        const version = new PostVersion()
        version.post = post
        version.createdAt = createdAt
        version.title = def.title
        version.content = [
          { type: 'text', data: def.excerpt },
          { type: 'text', data: faker.lorem.paragraphs(3) },
        ]
        await em.persist(version).flush()
        post.versions.add(version)

        // Occasionally add a revised version
        if (faker.datatype.boolean(0.4)) {
          const revisionDate = addDays(createdAt, faker.number.int({ min: 2, max: 14 }))
          const revision = new PostVersion()
          revision.post = post
          revision.createdAt = revisionDate
          revision.title = def.title
          revision.content = [
            { type: 'text', data: def.excerpt },
            { type: 'text', data: faker.lorem.paragraphs(4) },
            { type: 'text', data: faker.lorem.paragraph() },
          ]
          await em.persist(revision).flush()
          post.versions.add(revision)
        }

        // Wire M2M tags
        if (tags.length > 0) {
          const selectedTags = pickRandomTags(tags)
          selectedTags.forEach(tag => post.tags.add(tag))
        }

        posts.push(post)
      }
    }

    // Publish roughly half the posts
    for (const post of posts) {
      post.publishedAt = faker.datatype.boolean(0.6)
        ? generateDatePublished(post)
        : undefined

      if (post.publishedAt) {
        post.slug = computeSlug(post)
      }

      await em.persist(post).flush()
    }

    context.posts = posts
  }
}
