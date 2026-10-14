import { Migration } from '@mikro-orm/migrations'

export class Migration20261014171201 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`create index "session_userId_index" on "session" ("userId");`)
    this.addSql(`create index "account_userId_index" on "account" ("userId");`)
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "session_userId_index";`)
    this.addSql(`drop index "account_userId_index";`)
  }
}
