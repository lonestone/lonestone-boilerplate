import { Migration } from '@mikro-orm/migrations'

export class Migration20260625120000 extends Migration {
  override async up(): Promise<void> {
    // Align the lone snake_case column with the project's camelCase convention,
    // now enforced globally via EntityCaseNamingStrategy.
    this.addSql(`alter table "comment" rename column "author_name" to "authorName";`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "comment" rename column "authorName" to "author_name";`)
  }
}
