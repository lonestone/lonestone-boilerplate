import { relations } from 'drizzle-orm'
import {
  index,
  json,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { PostContent } from '../../../example/posts/contracts/posts.contract'
import { user } from '../auth.schema'

// Table: post
export const posts = pgTable('post', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').notNull().references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  publishedAt: timestamp('publishedAt'),
  slug: varchar('slug', { length: 255 }).unique(),
}, table => [
  index('post_userId_idx').on(table.userId),
  index('post_publishedAt_idx').on(table.publishedAt),
  index('post_slug_idx').on(table.slug),
])

// Table: postVersion
export const postVersions = pgTable('postVersion', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('postId').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: json('content').$type<PostContent[]>(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, table => [
  index('postVersion_postId_idx').on(table.postId),
  index('postVersion_title_idx').on(table.title),
])

// Relations will be defined after comments schema is created
// to avoid circular dependencies
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(user, {
    fields: [posts.userId],
    references: [user.id],
  }),
  versions: many(postVersions),
}))

export const postVersionsRelations = relations(postVersions, ({ one }) => ({
  post: one(posts, {
    fields: [postVersions.postId],
    references: [posts.id],
  }),
}))

// Inferred types
export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
export type PostVersion = typeof postVersions.$inferSelect
export type NewPostVersion = typeof postVersions.$inferInsert
