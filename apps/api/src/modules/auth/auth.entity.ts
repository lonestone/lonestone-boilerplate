import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from "@mikro-orm/core";

@Entity({ tableName: "user" })
export class User {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @Property()
  name!: string;

  @Property()
  @Unique()
  email!: string;

  @Property({ fieldName: "emailVerified" })
  emailVerified: boolean = false;

  @Property({ nullable: true })
  image?: string;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

@Entity({ tableName: "session" })
export class Session {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @Property({ fieldName: "expiresAt" })
  expiresAt!: Date;

  @Property()
  @Unique()
  token!: string;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ fieldName: "ipAddress", nullable: true })
  ipAddress?: string;

  @Property({ fieldName: "userAgent", nullable: true })
  userAgent?: string;

  @ManyToOne(() => User, { fieldName: "userId" })
  user!: User;
}

@Entity({ tableName: "account" })
export class Account {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @Property({ fieldName: "accountId" })
  accountId!: string;

  @Property({ fieldName: "providerId" })
  providerId!: string;

  @ManyToOne(() => User, { fieldName: "userId" })
  user!: User;

  @Property({ fieldName: "accessToken", nullable: true })
  accessToken?: string;

  @Property({ fieldName: "refreshToken", nullable: true })
  refreshToken?: string;

  @Property({ fieldName: "idToken", nullable: true })
  idToken?: string;

  @Property({ fieldName: "accessTokenExpiresAt", nullable: true })
  accessTokenExpiresAt?: Date;

  @Property({ fieldName: "refreshTokenExpiresAt", nullable: true })
  refreshTokenExpiresAt?: Date;

  @Property({ nullable: true })
  scope?: string;

  @Property({ nullable: true })
  password?: string;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

@Entity({ tableName: "verification" })
export class Verification {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @Property()
  identifier!: string;

  @Property()
  value!: string;

  @Property({ fieldName: "expiresAt" })
  expiresAt!: Date;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
