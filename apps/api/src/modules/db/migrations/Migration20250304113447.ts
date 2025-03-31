import { Migration } from '@mikro-orm/migrations'

export class Migration20250304113447 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "user" drop column "created_at", drop column "updated_at";`)

    this.addSql(`alter table "user" add column "createdAt" timestamptz not null, add column "updatedAt" timestamptz not null;`)
    this.addSql(`alter table "user" rename column "email_verified" to "emailVerified";`)

    this.addSql(`alter table "session" drop column "expires_at", drop column "created_at", drop column "updated_at", drop column "ip_address", drop column "user_agent";`)

    this.addSql(`alter table "session" add column "expiresAt" timestamptz not null, add column "createdAt" timestamptz not null, add column "updatedAt" timestamptz not null, add column "ipAddress" varchar(255) null, add column "userAgent" varchar(255) null;`)

    this.addSql(`alter table "account" drop column "account_id", drop column "provider_id", drop column "access_token", drop column "refresh_token", drop column "id_token", drop column "access_token_expires_at", drop column "refresh_token_expires_at", drop column "created_at", drop column "updated_at";`)

    this.addSql(`alter table "account" add column "accountId" varchar(255) not null, add column "providerId" varchar(255) not null, add column "accessToken" varchar(255) null, add column "refreshToken" varchar(255) null, add column "idToken" varchar(255) null, add column "accessTokenExpiresAt" timestamptz null, add column "refreshTokenExpiresAt" timestamptz null, add column "createdAt" timestamptz not null, add column "updatedAt" timestamptz not null;`)

    this.addSql(`alter table "verification" drop column "expires_at", drop column "created_at", drop column "updated_at";`)

    this.addSql(`alter table "verification" add column "expiresAt" timestamptz not null, add column "createdAt" timestamptz not null, add column "updatedAt" timestamptz not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user" drop column "createdAt", drop column "updatedAt";`)

    this.addSql(`alter table "user" add column "created_at" timestamptz not null, add column "updated_at" timestamptz not null;`)
    this.addSql(`alter table "user" rename column "emailVerified" to "email_verified";`)

    this.addSql(`alter table "session" drop column "expiresAt", drop column "createdAt", drop column "updatedAt", drop column "ipAddress", drop column "userAgent";`)

    this.addSql(`alter table "session" add column "expires_at" timestamptz not null, add column "created_at" timestamptz not null, add column "updated_at" timestamptz not null, add column "ip_address" varchar(255) null, add column "user_agent" varchar(255) null;`)

    this.addSql(`alter table "account" drop column "accountId", drop column "providerId", drop column "accessToken", drop column "refreshToken", drop column "idToken", drop column "accessTokenExpiresAt", drop column "refreshTokenExpiresAt", drop column "createdAt", drop column "updatedAt";`)

    this.addSql(`alter table "account" add column "account_id" varchar(255) not null, add column "provider_id" varchar(255) not null, add column "access_token" varchar(255) null, add column "refresh_token" varchar(255) null, add column "id_token" varchar(255) null, add column "access_token_expires_at" timestamptz null, add column "refresh_token_expires_at" timestamptz null, add column "created_at" timestamptz not null, add column "updated_at" timestamptz not null;`)

    this.addSql(`alter table "verification" drop column "expiresAt", drop column "createdAt", drop column "updatedAt";`)

    this.addSql(`alter table "verification" add column "expires_at" timestamptz not null, add column "created_at" timestamptz not null, add column "updated_at" timestamptz not null;`)
  }
}
