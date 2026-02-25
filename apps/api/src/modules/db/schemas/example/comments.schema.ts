import { relations } from 'drizzle-orm'
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { user } from '../auth.schema'
import { posts } from './posts.schema'

// Table: comment
export const comments = pgTable('comment', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('postId').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('userId').references(() => user.id),
  content: text('content').notNull(),
  authorName: varchar('authorName', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  parentId: uuid('parentId'),
}, table => [
  index('comment_postId_idx').on(table.postId),
  index('comment_userId_idx').on(table.userId),
  index('comment_parentId_idx').on(table.parentId),
])

// Self-referencing relation for replies
export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'parentChild',
  }),
  replies: many(comments, {
    relationName: 'parentChild',
  }),
}))

// Inferred types
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
