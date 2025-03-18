// This file is used by the mikro-orm CLI for migrations and seeding
import { config } from "./env.config";

import { defineConfig, Options } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";

type CreateMikroOrmOptions = {
  isTest?: boolean;
} & Options;

export const createMikroOrmOptions = (options?: CreateMikroOrmOptions) => {
  const {  ...restOptions } = options ?? {};

  const _options: Options = defineConfig({
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
      path: "./dist/modules/db/migrations",
      pathTs: "./src/modules/db/migrations",
      allOrNothing: true,
      disableForeignKeys: false,
    },
    ...restOptions,
  });

  return _options;
};

export const createTestMikroOrmOptions = (options?: Options) =>
  createMikroOrmOptions({ isTest: true, ...options });
export default createMikroOrmOptions;
