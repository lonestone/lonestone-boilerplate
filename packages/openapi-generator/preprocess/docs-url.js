import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenvx from '@dotenvx/dotenvx'

const preprocessDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(preprocessDir, '..')
const repoRoot = join(packageRoot, '../..')

function firstExisting(paths) {
  return paths.find((filePath) => existsSync(filePath))
}

/**
 * API_PREFIX comes from the API env. API_URL comes from the generator env.
 * First file wins, so a leftover generator API_PREFIX cannot override the API.
 */
export function loadDocsEnv() {
  const apiEnv = firstExisting([
    join(repoRoot, 'apps/api/.env'),
    join(repoRoot, 'apps/api/.env.example'),
  ])
  const generatorEnv = firstExisting([join(packageRoot, '.env'), join(packageRoot, '.env.example')])
  const files = [apiEnv, generatorEnv].filter(Boolean)
  if (files.length === 0) {
    return
  }
  dotenvx.config({ path: files, quiet: true })
}

/**
 * @param {string | undefined} apiUrl
 * @param {string | undefined} apiPrefix
 * @returns {string}
 */
export function buildOpenApiDocsUrl(apiUrl, apiPrefix) {
  const origin = (apiUrl ?? '').trim().replace(/\/+$/, '')
  const trimmedPrefix = (apiPrefix ?? '').trim().replace(/\/+$/, '')
  if (!origin) {
    throw new Error('API_URL is missing from packages/openapi-generator/.env')
  }
  if (!trimmedPrefix) {
    throw new Error('API_PREFIX is missing from apps/api/.env')
  }
  const prefix = trimmedPrefix.startsWith('/') ? trimmedPrefix : `/${trimmedPrefix}`
  return `${origin}${prefix}/docs.json`
}
