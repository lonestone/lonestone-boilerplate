// Option helper of the sample extension, for the CLI tests: suggest prints the
// content of assets/name.txt when the project has it.
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

const [command] = process.argv.slice(2)
if (command === 'suggest' && existsSync('assets/name.txt')) {
  console.log(readFileSync('assets/name.txt', 'utf-8').trim())
}
