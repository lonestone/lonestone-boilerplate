import { Migration } from '@mikro-orm/migrations'

export class Migration20250304113300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "sessions" drop constraint "sessions_user_id_foreign";`)

    this.addSql(`alter table "accounts" drop constraint "accounts_user_id_foreign";`)

    this.addSql(`create table "user" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "email" varchar(255) not null, "email_verified" boolean not null default false, "image" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "user_pkey" primary key ("id"));`)
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`)

    this.addSql(`create table "session" ("id" uuid not null default gen_random_uuid(), "expires_at" timestamptz not null, "token" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "ip_address" varchar(255) null, "user_agent" varchar(255) null, "user_id" uuid not null, constraint "session_pkey" primary key ("id"));`)
    this.addSql(`alter table "session" add constraint "session_token_unique" unique ("token");`)

    this.addSql(`create table "account" ("id" uuid not null default gen_random_uuid(), "account_id" varchar(255) not null, "provider_id" varchar(255) not null, "user_id" uuid not null, "access_token" varchar(255) null, "refresh_token" varchar(255) null, "id_token" varchar(255) null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" varchar(255) null, "password" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "account_pkey" primary key ("id"));`)

    this.addSql(`create table "verification" ("id" uuid not null default gen_random_uuid(), "identifier" varchar(255) not null, "value" varchar(255) not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "verification_pkey" primary key ("id"));`)

    this.addSql(`alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`)

    this.addSql(`alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`)

    this.addSql(`drop table if exists "users" cascade;`)

    this.addSql(`drop table if exists "sessions" cascade;`)

    this.addSql(`drop table if exists "accounts" cascade;`)

    this.addSql(`drop table if exists "verifications" cascade;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "session" drop constraint "session_user_id_foreign";`)

    this.addSql(`alter table "account" drop constraint "account_user_id_foreign";`)

    this.addSql(`create table "users" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "email" varchar(255) not null, "email_verified" boolean not null default false, "image" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "users_pkey" primary key ("id"));`)
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`)

    this.addSql(`create table "sessions" ("id" uuid not null default gen_random_uuid(), "expires_at" timestamptz not null, "token" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "ip_address" varchar(255) null, "user_agent" varchar(255) null, "user_id" uuid not null, constraint "sessions_pkey" primary key ("id"));`)
    this.addSql(`alter table "sessions" add constraint "sessions_token_unique" unique ("token");`)

    this.addSql(`create table "accounts" ("id" uuid not null default gen_random_uuid(), "account_id" varchar(255) not null, "provider_id" varchar(255) not null, "user_id" uuid not null, "access_token" varchar(255) null, "refresh_token" varchar(255) null, "id_token" varchar(255) null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" varchar(255) null, "password" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "accounts_pkey" primary key ("id"));`)

    this.addSql(`create table "verifications" ("id" uuid not null default gen_random_uuid(), "identifier" varchar(255) not null, "value" varchar(255) not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "verifications_pkey" primary key ("id"));`)

    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`)

    this.addSql(`alter table "accounts" add constraint "accounts_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`)

    this.addSql(`drop table if exists "user" cascade;`)

    this.addSql(`drop table if exists "session" cascade;`)

    this.addSql(`drop table if exists "account" cascade;`)

    this.addSql(`drop table if exists "verification" cascade;`)
  }
}
