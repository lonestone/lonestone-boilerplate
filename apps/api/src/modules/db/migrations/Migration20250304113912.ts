import { Migration } from '@mikro-orm/migrations';

export class Migration20250304113912 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "session" drop constraint "session_user_id_foreign";`);

    this.addSql(`alter table "account" drop constraint "account_user_id_foreign";`);

    this.addSql(`alter table "session" rename column "user_id" to "userId";`);
    this.addSql(`alter table "session" add constraint "session_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade;`);

    this.addSql(`alter table "account" rename column "user_id" to "userId";`);
    this.addSql(`alter table "account" add constraint "account_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "session" drop constraint "session_userId_foreign";`);

    this.addSql(`alter table "account" drop constraint "account_userId_foreign";`);

    this.addSql(`alter table "session" rename column "userId" to "user_id";`);
    this.addSql(`alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`);

    this.addSql(`alter table "account" rename column "userId" to "user_id";`);
    this.addSql(`alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`);
  }

}
