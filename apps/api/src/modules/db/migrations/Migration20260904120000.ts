import { Migration } from '@mikro-orm/migrations'

export class Migration20260904120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "user" add column if not exists "firstName" varchar(255) null;`)
    this.addSql(`alter table "user" add column if not exists "lastName" varchar(255) null;`)
    this.addSql(`alter table "user" add column if not exists "phone" varchar(255) null;`)

    this.addSql(
      `alter table "session" add column if not exists "activeOrganizationId" varchar(255) null;`,
    )

    this.addSql(`
      create table if not exists "organization" (
        "id" uuid not null default gen_random_uuid(),
        "name" varchar(255) not null,
        "slug" varchar(255) null,
        "logo" varchar(255) null,
        "metadata" text null,
        "paymentLink" varchar(255) null,
        "createdAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "organization" add constraint "organization_slug_unique" unique ("slug");`,
    )

    this.addSql(`
      create table if not exists "member" (
        "id" uuid not null default gen_random_uuid(),
        "userId" uuid not null,
        "organizationId" uuid not null,
        "role" varchar(255) not null default 'member',
        "createdAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "member" add constraint "member_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "member" add constraint "member_organizationId_foreign" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "invitation" (
        "id" uuid not null default gen_random_uuid(),
        "email" varchar(255) not null,
        "inviterId" uuid not null,
        "organizationId" uuid not null,
        "role" varchar(255) not null,
        "status" varchar(255) not null,
        "expiresAt" timestamptz not null,
        "createdAt" timestamptz not null default now(),
        "token" varchar(255) null,
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "invitation" add constraint "invitation_inviterId_foreign" foreign key ("inviterId") references "user" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "invitation" add constraint "invitation_organizationId_foreign" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "season" (
        "id" uuid not null default gen_random_uuid(),
        "organizationId" uuid not null,
        "name" varchar(255) not null,
        "startsAt" date not null,
        "endsAt" date null,
        "status" text check ("status" in ('active', 'closed')) not null default 'active',
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "season" add constraint "season_organizationId_foreign" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(`create index "season_organizationId_index" on "season" ("organizationId");`)

    this.addSql(`
      create table if not exists "match_series" (
        "id" uuid not null default gen_random_uuid(),
        "organizationId" uuid not null,
        "seasonId" uuid not null,
        "title" varchar(255) not null,
        "location" varchar(255) null,
        "maxCapacity" int not null,
        "frequency" text check ("frequency" in ('weekly', 'monthly', 'custom')) not null,
        "rrule" varchar(255) null,
        "startsAt" timestamptz not null,
        "endsAt" timestamptz null,
        "reminderOffsetsHours" jsonb null,
        "createdById" uuid not null,
        "createdAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_series" add constraint "match_series_organizationId_foreign" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_series" add constraint "match_series_seasonId_foreign" foreign key ("seasonId") references "season" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_series" add constraint "match_series_createdById_foreign" foreign key ("createdById") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "match" (
        "id" uuid not null default gen_random_uuid(),
        "organizationId" uuid not null,
        "seasonId" uuid not null,
        "seriesId" uuid null,
        "title" varchar(255) not null,
        "startsAt" timestamptz not null,
        "location" varchar(255) null,
        "maxCapacity" int not null,
        "status" text check ("status" in ('scheduled', 'cancelled', 'played')) not null default 'scheduled',
        "reminderOffsetsHours" jsonb null,
        "createdById" uuid not null,
        "cancellationReason" text null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match" add constraint "match_organizationId_foreign" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match" add constraint "match_seasonId_foreign" foreign key ("seasonId") references "season" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match" add constraint "match_seriesId_foreign" foreign key ("seriesId") references "match_series" ("id") on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table "match" add constraint "match_createdById_foreign" foreign key ("createdById") references "user" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(`create index "match_startsAt_index" on "match" ("startsAt");`)

    this.addSql(`
      create table if not exists "match_attendance" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "userId" uuid not null,
        "status" text check ("status" in ('present', 'absent', 'pending')) not null default 'pending',
        "respondedAt" timestamptz null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_attendance" add constraint "match_attendance_matchId_userId_unique" unique ("matchId", "userId");`,
    )
    this.addSql(
      `alter table "match_attendance" add constraint "match_attendance_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_attendance" add constraint "match_attendance_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "match_lineup" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "userId" uuid not null,
        "team" text check ("team" in ('blue', 'red')) not null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_lineup" add constraint "match_lineup_matchId_userId_unique" unique ("matchId", "userId");`,
    )
    this.addSql(
      `alter table "match_lineup" add constraint "match_lineup_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_lineup" add constraint "match_lineup_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "match_stat" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "userId" uuid not null,
        "goals" int not null default 0,
        "assists" int not null default 0,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_stat" add constraint "match_stat_matchId_userId_unique" unique ("matchId", "userId");`,
    )
    this.addSql(
      `alter table "match_stat" add constraint "match_stat_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_stat" add constraint "match_stat_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "match_message" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "authorId" uuid not null,
        "body" text not null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_message" add constraint "match_message_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "match_message" add constraint "match_message_authorId_foreign" foreign key ("authorId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "message_mention" (
        "id" uuid not null default gen_random_uuid(),
        "messageId" uuid not null,
        "mentionedUserId" uuid not null,
        "createdAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "message_mention" add constraint "message_mention_messageId_foreign" foreign key ("messageId") references "match_message" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "message_mention" add constraint "message_mention_mentionedUserId_foreign" foreign key ("mentionedUserId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "notification_preference" (
        "id" uuid not null default gen_random_uuid(),
        "userId" uuid not null,
        "emailEnabled" boolean not null default true,
        "pushEnabled" boolean not null default true,
        "notifyNewMatch" boolean not null default true,
        "notifyRsvpReminder" boolean not null default true,
        "notifyMatchCancelled" boolean not null default true,
        "chatMentionsOnly" boolean not null default true,
        "notifyChatMention" boolean not null default true,
        "notifyAllChatMessages" boolean not null default false,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "notification_preference" add constraint "notification_preference_userId_unique" unique ("userId");`,
    )
    this.addSql(
      `alter table "notification_preference" add constraint "notification_preference_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "device_token" (
        "id" uuid not null default gen_random_uuid(),
        "userId" uuid not null,
        "token" varchar(512) not null,
        "platform" text check ("platform" in ('ios', 'android', 'web')) not null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "device_token" add constraint "device_token_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "scheduled_job" (
        "id" uuid not null default gen_random_uuid(),
        "type" text check ("type" in ('match_invite', 'rsvp_reminder')) not null,
        "matchId" uuid not null,
        "runAt" timestamptz not null,
        "status" text check ("status" in ('pending', 'done', 'cancelled', 'failed')) not null default 'pending',
        "payload" jsonb null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "scheduled_job" add constraint "scheduled_job_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(`create index "scheduled_job_runAt_index" on "scheduled_job" ("runAt");`)

    this.addSql(`
      create table if not exists "match_cost" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "pitchCostCents" int not null default 0,
        "extrasCostCents" int not null default 0,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "match_cost" add constraint "match_cost_matchId_unique" unique ("matchId");`,
    )
    this.addSql(
      `alter table "match_cost" add constraint "match_cost_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`
      create table if not exists "session_fee" (
        "id" uuid not null default gen_random_uuid(),
        "matchId" uuid not null,
        "userId" uuid not null,
        "amountCents" int not null,
        "status" text check ("status" in ('owed', 'paid', 'waived')) not null default 'owed',
        "paidAt" timestamptz null,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now(),
        primary key ("id")
      );
    `)
    this.addSql(
      `alter table "session_fee" add constraint "session_fee_matchId_userId_unique" unique ("matchId", "userId");`,
    )
    this.addSql(
      `alter table "session_fee" add constraint "session_fee_matchId_foreign" foreign key ("matchId") references "match" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "session_fee" add constraint "session_fee_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "session_fee" cascade;`)
    this.addSql(`drop table if exists "match_cost" cascade;`)
    this.addSql(`drop table if exists "scheduled_job" cascade;`)
    this.addSql(`drop table if exists "device_token" cascade;`)
    this.addSql(`drop table if exists "notification_preference" cascade;`)
    this.addSql(`drop table if exists "message_mention" cascade;`)
    this.addSql(`drop table if exists "match_message" cascade;`)
    this.addSql(`drop table if exists "match_stat" cascade;`)
    this.addSql(`drop table if exists "match_lineup" cascade;`)
    this.addSql(`drop table if exists "match_attendance" cascade;`)
    this.addSql(`drop table if exists "match" cascade;`)
    this.addSql(`drop table if exists "match_series" cascade;`)
    this.addSql(`drop table if exists "season" cascade;`)
    this.addSql(`drop table if exists "invitation" cascade;`)
    this.addSql(`drop table if exists "member" cascade;`)
    this.addSql(`drop table if exists "organization" cascade;`)
    this.addSql(`alter table "session" drop column if exists "activeOrganizationId";`)
    this.addSql(`alter table "user" drop column if exists "phone";`)
    this.addSql(`alter table "user" drop column if exists "lastName";`)
    this.addSql(`alter table "user" drop column if exists "firstName";`)
  }
}
