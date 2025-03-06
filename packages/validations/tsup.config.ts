// @ts-expect-error tsup file outside of src
import { exec as execCb } from 'node:child_process'
// @ts-expect-error tsup file outside of src
import { dirname } from 'node:path'
// @ts-expect-error tsup file outside of src
import { fileURLToPath } from 'node:url'
// @ts-expect-error tsup file outside of src
import { promisify } from 'node:util'

import { defineConfig } from 'tsup'

const exec = promisify(execCb)

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  entry: {
    client: 'src/client.ts',
    server: 'src/server.ts',
  },
  format: ['esm', 'cjs'],
  target: 'es2022',
  sourcemap: true,
  // clean: true,
  onSuccess: async () => {
    console.log('Successfully built nest-zod-validation package')
    /**
     * Do not use tsup for generating d.ts files because it can not generate type
     * the definition maps required for go-to-definition to work in our IDE. We
     * use tsc for that.
     * Note that we pass the cwd to tsc to ensure the command is executed in the
     * root of the current package (useful for `pnpm --parallel`).
     */
    exec('tsc --emitDeclarationOnly', { cwd: __dirname })
      .then(() => {
        console.log('Successfully emitted nest-zod-validation declarations')
      })
      .catch((err) => {
        console.error('Error emitting nest-zod-validation declarations', err)
      })
  },
  /**
   * Do not use tsup for generating d.ts files because it can not generate type
   * the definition maps required for go-to-definition to work in our IDE. We
   * use tsc for that.
   */
})
