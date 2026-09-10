import { Migration } from '@mikro-orm/migrations'

export class Migration20260904190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "invitation" add column if not exists "createdAt" timestamptz not null default now();`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "invitation" drop column if exists "createdAt";`)
  }
}
