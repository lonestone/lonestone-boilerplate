// Option helper of the sample extension, for the CLI tests.
// suggest: prints assets/image.txt when the project has it; crashes when the
// project has assets/crash-suggest.
// check: refuses a file starting with "bad", crashes on a file starting with
// "crash", hangs on a file starting with "hang".
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

const [command, value] = process.argv.slice(2)
if (command === 'suggest') {
  if (existsSync('assets/crash-suggest')) {
    process.exit(3)
  }
  if (existsSync('assets/image.txt')) {
    console.log('assets/image.txt')
  }
} else if (command === 'check') {
  const content = readFileSync(value, 'utf-8')
  if (content.startsWith('crash')) {
    process.exit(3)
  }
  if (content.startsWith('hang')) {
    setTimeout(() => undefined, 60_000)
  }
  if (content.startsWith('bad')) {
    console.error(`${value}: not a good file`)
    process.exit(1)
  }
}
