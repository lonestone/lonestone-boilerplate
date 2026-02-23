import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Table: user
export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
})

// Table: session
export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  ipAddress: varchar('ipAddress', { length: 255 }),
  userAgent: text('userAgent'),
  userId: uuid('userId').notNull().references(() => user.id),
}, table => [
  index('session_userId_idx').on(table.userId),
])

// Table: account
export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: varchar('accountId', { length: 255 }).notNull(),
  providerId: varchar('providerId', { length: 255 }).notNull(),
  userId: uuid('userId').notNull().references(() => user.id),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index('account_userId_idx').on(table.userId),
])

// Table: verification
export const verification = pgTable('verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
})

// Relations
export const usersRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionsRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountsRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

// Inferred types
export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert
export type Account = typeof account.$inferSelect
export type NewAccount = typeof account.$inferInsert
export type Verification = typeof verification.$inferSelect
export type NewVerification = typeof verification.$inferInsert
