import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'user' })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  name!: string

  @Property()
  @Unique()
  email!: string

  @Property()
  emailVerified: boolean = false

  @Property({ nullable: true })
  image?: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'session' })
export class Session {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  expiresAt!: Date

  @Property()
  @Unique()
  token!: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  ipAddress?: string

  @Property({ nullable: true })
  userAgent?: string

  @ManyToOne(() => User, { fieldName: 'userId' })
  user!: User
}

@Entity({ tableName: 'account' })
export class Account {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  accountId!: string

  @Property()
  providerId!: string

  @ManyToOne(() => User, { fieldName: 'userId' })
  user!: User

  @Property({ nullable: true })
  accessToken?: string

  @Property({ nullable: true })
  refreshToken?: string

  @Property({ nullable: true })
  idToken?: string

  @Property({ nullable: true })
  accessTokenExpiresAt?: Date

  @Property({ nullable: true })
  refreshTokenExpiresAt?: Date

  @Property({ nullable: true })
  scope?: string

  @Property({ nullable: true })
  password?: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'verification' })
export class Verification {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  identifier!: string

  @Property()
  value!: string

  @Property()
  expiresAt!: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
