import { Module, Global } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DbService } from "./db.service";

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useClass: DbService,
    }),
  ],
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
