import process from 'node:process'
import { CLI_BIN_NAME, CLI_PACKAGE_NAME } from './boilerplate-core.js'
import { runBoilerplateCli } from './boilerplate.js'
import { runInstaller, printInstallerUsage } from './install.js'
import { runSetup } from './setup.js'
import { colorize, getCliVersion } from './utils.js'

function printRootUsage(): void {
  console.log(`
${colorize('🪨  Boilerstone CLI', 'bright')}

${colorize('Usage:', 'cyan')}
  ${CLI_BIN_NAME} <command> [args]

${colorize('Project commands:', 'cyan')}
  ${colorize('init [dir]', 'bright')}              Create a new project from the release matching this CLI
  ${colorize('onboard', 'bright')}                 Add the upgrade system to an existing project
  ${colorize('rock', 'bright')}                    Set up the local dev environment: .env files, Docker, migrations (pnpm rock)
  ${colorize('upgrade [version]', 'bright')}       Stage a boilerplate upgrade (default: latest)

${colorize('Upgrade commands:', 'cyan')}
  ${colorize('bootstrap', 'bright')}               Wire an already-fetched .boilerstone/ directory
  ${colorize('upgrade status', 'bright')}          Show tracking state and readiness
  ${colorize('upgrade path --to <v>', 'bright')}   Show the intention path to a version
  ${colorize('upgrade record', 'bright')}          Record an applied or skipped intention
  ${colorize('upgrade finish --to <v>', 'bright')} Mark the upgrade range complete
  ${colorize('intentions lint', 'bright')}         Validate published intention metadata
  ${colorize('versions list', 'bright')}           List available boilerplate versions

${colorize('Options:', 'cyan')}
  ${colorize('--ref <vX.Y.Z>', 'bright')}          Optional for init/onboard; must be this CLI's version
  ${colorize('--apps <list>', 'bright')}           init only: web apps to include (web-spa, web-ssr, comma separated, or none)
                          Without it, init asks about each one, or keeps all when it cannot ask
  ${colorize('--project <path>', 'bright')}        Project root (default: current directory)

${colorize('Examples:', 'cyan')}
  ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME} init my-app`, 'dim')}
  ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME}@1.2.0 init my-app`, 'dim')}   ${colorize('(pin the release by pinning the CLI)', 'dim')}
  ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME} init my-app --apps web-ssr`, 'dim')}
  ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME} init my-app --apps none`, 'dim')}   ${colorize('(API only)', 'dim')}
  ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME} onboard`, 'dim')}
  ${colorize('pnpm boilerplate upgrade', 'dim')}   ${colorize('(inside a project)', 'dim')}
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    printRootUsage()
    printInstallerUsage()
    process.exit(0)
  }

  // pnpm dlx reuses a cached copy of `@latest` for a while after a release, so
  // say which CLI is running. On stderr: `upgrade status --json` owns stdout.
  console.error(colorize(`${CLI_PACKAGE_NAME}@${getCliVersion()}`, 'dim'))

  if (command === 'rock' || command === 'setup') {
    await runSetup()
    return
  }

  if (command === 'init' || command === 'onboard') {
    await runInstaller(args)
    return
  }

  await runBoilerplateCli(args)
}

await main()
