// Every class exported by a `*.entity.ts` file under `src/`, matching the CLI's `entitiesTs` glob
// in `db.config.ts`. Vite expands this glob into static imports, in dev, tests and `dist/main.js`.
// The MikroORM CLI does not run through Vite, so `db.config.ts` must not import this file.
const entityModules = import.meta.glob('../../**/*.entity.ts', { eager: true })

export const entities = Array.from(
  new Set(
    Object.values(entityModules).flatMap((mod) =>
      Object.values(mod as object).filter((value) => typeof value === 'function'),
    ),
  ),
)
