// This file is used by the mikro-orm CLI for migrations and seeding
import { config } from "./env.config";

import { defineConfig, Options } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";

export const createMikroOrmOptions = () => {
  const options: Options = defineConfig({
    entities: ["./dist/**/*.entity.js"],
    entitiesTs: ["./src/**/*.entity.ts"],
    dbName: config.database.name,
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    metadataProvider: TsMorphMetadataProvider,
    forceUtcTimezone: true,
    debug: config.env === "development",
    extensions: [SeedManager, Migrator],
    seeder: {
      path: "./dist/seeders",
      pathTs: "./src/seeders",
      defaultSeeder: "DatabaseSeeder",
      glob: "!(*.d).{js,ts}",
      emit: "ts",
      fileName: (className: string) => className,
    },
    migrations: {
      path: "./src/modules/db/migrations",
      allOrNothing: true,
      disableForeignKeys: false,
    },
  });

  return options;
};

export default createMikroOrmOptions;
