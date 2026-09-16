import process from 'node:process'
import { runBoilerplateCli } from './boilerplate.js'
import { runInstaller, printInstallerUsage } from './install.js'
import { runSetup } from './setup.js'
import { colorize } from './utils.js'

function printRootUsage(): void {
  console.log(`
${colorize('🪨  Lonestone CLI', 'bright')}

${colorize('Usage:', 'cyan')}
  lonestone <command> [args]

${colorize('Project commands:', 'cyan')}
  ${colorize('init [dir]', 'bright')}              Create a new project from the template
  ${colorize('onboard', 'bright')}                 Add the upgrade system to an existing project
  ${colorize('rock', 'bright')}                    Interactive first-run setup (pnpm rock)
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
  ${colorize('--ref <latest|vX.Y.Z>', 'bright')}   Template release for init/onboard (default: latest)
  ${colorize('--project <path>', 'bright')}        Project root (default: current directory)

${colorize('Examples:', 'cyan')}
  ${colorize('lonestone init my-app', 'dim')}
  ${colorize('lonestone init my-app --ref v1.1.0', 'dim')}
  ${colorize('lonestone onboard', 'dim')}
  ${colorize('lonestone upgrade', 'dim')}
  ${colorize('pnpm dlx @lonestone/cli init my-app', 'dim')}
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
