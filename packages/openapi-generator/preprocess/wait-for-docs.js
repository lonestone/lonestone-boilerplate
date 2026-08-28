import { spawn } from 'node:child_process'
import process from 'node:process'
import { buildOpenApiDocsUrl, loadDocsEnv } from './docs-url.js'

loadDocsEnv()
const url = buildOpenApiDocsUrl(process.env.API_URL, process.env.API_PREFIX)

const child = spawn('wait-on', [url], { stdio: 'inherit', shell: true })
child.on('exit', (code) => {
  process.exit(code ?? 1)
})
child.on('error', (error) => {
  // oxlint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})
