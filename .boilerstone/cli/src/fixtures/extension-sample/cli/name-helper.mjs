// Test fixture of the CLI specs only: never installed in a real project.
// Option helper of the sample extension: suggest prints the content of
// assets/name.txt when the project has it.
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

const [command] = process.argv.slice(2)
if (command === 'suggest' && existsSync('assets/name.txt')) {
  console.log(readFileSync('assets/name.txt', 'utf-8').trim())
}
