#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')
const binTs = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'bin.ts')
const result = spawnSync(process.execPath, [tsxCli, binTs, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)
