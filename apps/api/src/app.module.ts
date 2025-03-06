import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { DbModule } from "./modules/db/db.module";
import { AppController } from "./app.controller";
import { EmailModule } from "./modules/email/email.module";
import { PostModule } from "./modules/posts/posts.module";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
@Module({
  imports: [
    DbModule,
    AuthModule.forRootAsync(),
    EmailModule,
    PostModule,
    NestConfigModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
