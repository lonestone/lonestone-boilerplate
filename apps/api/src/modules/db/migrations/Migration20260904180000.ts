import { Migration } from '@mikro-orm/migrations'

export class Migration20260904180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "organization" add column if not exists "venue" varchar(255) null;`,
    )
    this.addSql(
      `alter table "organization" add column if not exists "sportType" text check ("sportType" in ('football', 'futsal', 'basketball', 'volleyball', 'tennis', 'padel', 'badminton', 'other')) null;`,
    )
    this.addSql(
      `alter table "organization" add column if not exists "defaultMaxCapacity" int null;`,
    )

    this.addSql(
      `alter table "match_series" drop constraint if exists "match_series_frequency_check";`,
    )
    this.addSql(
      `alter table "match_series" add constraint "match_series_frequency_check" check ("frequency" in ('weekly', 'monthly', 'monthly_nth_weekday', 'custom'));`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "match_series" drop constraint if exists "match_series_frequency_check";`,
    )
    this.addSql(
      `alter table "match_series" add constraint "match_series_frequency_check" check ("frequency" in ('weekly', 'monthly', 'custom'));`,
    )

    this.addSql(`alter table "organization" drop column if exists "defaultMaxCapacity";`)
    this.addSql(`alter table "organization" drop column if exists "sportType";`)
    this.addSql(`alter table "organization" drop column if exists "venue";`)
  }
}
