import type { EdgeId, FlowId, NodeId } from './layout'

interface NodeText {
  /** Only for human steps. Commands and files keep their fixed name. */
  name?: string
  kind: string
  meta: string
  summary: string
  does?: string[]
  know?: string[]
}

interface FlowText {
  title: string
  note?: string
  /** One entry per step, in order. The node is the one the step lights up. */
  steps: [NodeId, string][]
}

interface CheatGroup {
  title: string
  items: [command: string, node: NodeId, text: string][]
}

interface Card {
  title: string
  text: string
}

/** Every word the map shows. */
interface Content {
  ui: {
    flowsLabel: string
    overview: string
    dimMaintainer: string
    legendLabel: string
    legend: {
      key: string
      cmd: string
      file: string
      ext: string
      producer: string
      border: string
      client: string
      next: string
      write: string
      read: string
    }
    mapLabel: string
    panelLabel: string
    cheatSheet: string
    flow: string
    cheatTitle: string
    cheatHint: string
    does: string
    know: string
    relations: string
    backToCheat: string
    seeFlow: string
    copy: string
    copied: string
    selected: string
    collapse: string
    open: string
    roles: Record<'key' | 'cmd' | 'file' | 'human' | 'ext', string>
    sides: Record<'producer' | 'border' | 'client', string>
    zones: {
      producer: string
      client: string
      border: string
      borderLine: string
      pullLine1: string
      pullLine2: string
    }
  }
  nodes: Record<NodeId, NodeText>
  edges: Record<EdgeId, string>
  flows: Record<FlowId, FlowText>
  cheat: CheatGroup[]
  cards: Card[]
}

const DLX = 'pnpm dlx @lonestone/boilerstone-cli'

export const content: Content = {
  ui: {
    flowsLabel: 'Flow to follow',
    overview: 'Overview',
    dimMaintainer: 'Dim the boilerplate side',
    legendLabel: 'Legend',
    legend: {
      key: 'Command to know',
      cmd: 'Less common command',
      file: 'File or state',
      ext: 'Human step or release',
      producer: 'Boilerplate repository',
      border: 'Boundary: the release',
      client: 'Your project',
      next: 'Then',
      write: 'Writes or creates',
      read: 'Reads',
    },
    mapLabel: 'Map of the commands',
    panelLabel: 'Details',
    cheatSheet: 'Cheat sheet',
    flow: 'Flow',
    cheatTitle: 'The commands',
    cheatHint:
      'Click a node on the map to see what it does. Pick a flow at the top to follow it step by step.',
    does: 'What it does',
    know: 'Good to know',
    relations: 'Relations',
    backToCheat: 'Back to the cheat sheet',
    seeFlow: 'See the flow “{title}”',
    copy: 'Copy',
    copied: 'Copied',
    selected: 'Selected',
    collapse: 'Collapse',
    open: 'Open',
    roles: {
      key: 'command to know',
      cmd: 'less common command',
      file: 'file or state',
      human: 'human step',
      ext: 'release',
    },
    sides: {
      producer: 'boilerplate side',
      border: 'at the boundary',
      client: 'in your project',
    },
    zones: {
      producer: 'BOILERPLATE REPOSITORY · LONESTONE',
      client: 'YOUR PROJECT · AT THE CLIENT',
      border: 'BOUNDARY',
      borderLine: 'Only the release crosses: git tag + npm package.',
      pullLine1: 'Nothing is pushed into your project:',
      pullLine2: 'you pull the changes yourself.',
    },
  },

  nodes: {
    release: {
      name: 'Release vX.Y.Z',
      kind: 'Release',
      meta: 'git tag + npm, same version',
      summary:
        'A git tag `vX.Y.Z` and the package `@lonestone/boilerstone-cli@X.Y.Z`. They always share the same version.',
      does: [
        'Release Please creates the tag when the release PR is merged. CI publishes the package.',
        '`init` and `onboard` start from this tag. Upgrades read the intentions from it.',
      ],
    },
    init: {
      kind: 'Start',
      meta: 'creates a project',
      summary: 'Creates a new project from the release that has the same version as the CLI.',
      does: [
        'Run it in the folder that will hold the project. The folder name becomes the scope `@my-app/*`: use lowercase letters, digits and dashes.',
        'Clones the release into a temporary folder, rewrites it, then moves it into place. If something fails, nothing is left behind.',
        'Writes the `pnpm dlx` scripts and creates `boilerplate.json`.',
        'Then runs `git init`, `pnpm install`, `pnpm fmt` and `pnpm rock`.',
      ],
      know: [
        '`--ref` is optional and must name the same release. For another version, change the CLI version.',
        'v1.0.0 and v1.1.0 cannot be used to create a project.',
        '`init` does not commit. Make the first commit yourself.',
      ],
    },
    onboard: {
      kind: 'Start',
      meta: 'project without .boilerstone/',
      summary:
        'Connects an existing project that has no `.boilerstone/` yet to the upgrade system.',
      does: [
        'Run it at the root of the project, next to `package.json`.',
        'Fetches `.boilerstone/` and the `boilerstone-upgrade` skills (Claude and Cursor) from the release of the CLI.',
        'Runs `bootstrap`, then `pnpm install` only if the pnpm workspace changed.',
        'Offers to commit. The default is yes.',
      ],
      know: [
        'If the project already has a `.boilerstone/`, `onboard` refuses. Run an upgrade instead (`pnpm boilerplate upgrade`).',
        'It also refuses if the `boilerstone-upgrade` skills already exist.',
        'It deletes nothing outside `.boilerstone/`.',
        'It suggests a starting version read from the git tags of the project. Check it. Answer `0.0.0` if you are not sure, so that no intention is skipped.',
      ],
    },
    bootstrap: {
      kind: 'Start',
      meta: 'run by onboard',
      summary: 'Wires a `.boilerstone/` that is already there. Safe to run again.',
      does: [
        'Adds the `boilerplate` script (`pnpm dlx @lonestone/boilerstone-cli@latest`). Touches neither `rock` nor the dependencies.',
        'Adds `.boilerstone/upgrade/` to `.gitignore`.',
        'Removes the files that are only for the boilerplate from `.boilerstone/`.',
        'Creates `boilerplate.json` with `upgrade init`, which asks for the starting version.',
      ],
      know: [
        'Never replaces anything that already exists.',
        '`BOILERPLATE_SOURCE_VERSION=1.1.0` skips the question about the version.',
      ],
    },
    rock: {
      kind: 'Local machine',
      meta: 'safe to run again',
      summary: 'Prepares the local environment. Run it after every clone, and whenever you want.',
      does: [
        'Creates the missing `.env` files from every `.env.example` (root, `apps/*`, `packages/*`).',
        'Asks for the database, the ports and SMTP when variables are missing.',
        'Offers to start Docker (`pnpm docker:up`), then the migrations.',
      ],
      know: [
        'Runs the CLI of the release of the project: `pnpm dlx @lonestone/boilerstone-cli@X.Y.Z rock`.',
        'Renames nothing and deletes nothing, so you can run it again.',
        'On a template that was never generated, it warns you and asks for confirmation.',
      ],
    },
    env: {
      kind: 'File',
      meta: 'local, not versioned',
      summary: 'Your local environment: the `.env` files, the database and MailDev in Docker.',
      does: [
        'The `.env` files are never committed.',
        'Running `pnpm rock` again fills in what is missing.',
      ],
    },
    pkg: {
      kind: 'File',
      meta: 'boilerplate and rock scripts',
      summary: 'The two scripts that call the CLI.',
      does: [
        '`"boilerplate": "pnpm dlx @lonestone/boilerstone-cli@latest"`: always the latest CLI.',
        '`"rock": "pnpm dlx @lonestone/boilerstone-cli@X.Y.Z rock"`: the version of the release of the project.',
      ],
    },
    state: {
      kind: 'File',
      meta: 'the versioned state',
      summary: 'The only versioned state: the starting version and the intentions already handled.',
      does: ['Created by `init` or by `bootstrap`.', 'Read by `upgrade status` and `upgrade`.'],
      know: ['Validated on every read and every write.'],
    },
    refs: {
      kind: 'File · git',
      meta: 'tags of the boilerplate',
      summary: 'The releases of the boilerplate, copied into your repository.',
      does: [
        'Stored under `refs/boilerstone/`, never among your own tags, so your versions cannot clash with them.',
        '`upgrade` fetches them by itself when it needs them.',
      ],
    },
    status: {
      kind: 'Upgrade',
      meta: 'read only',
      summary:
        'Tells you where the project stands and whether it is ready for an upgrade. Changes nothing.',
      does: [
        'Shows the current version, the tracked domains, and the intentions applied and skipped.',
        'Checks `boilerplate.json`, the worktree, the available releases, the release of the current version, and the cleanup of `.boilerstone/`.',
        'Gives the command to run for each point that is missing.',
      ],
      know: ['Exits with an error if a check fails.', 'Use `--json` for agents.'],
    },
    versions: {
      kind: 'Upgrade',
      meta: 'read only',
      summary: 'Lists the boilerplate releases fetched into the project.',
      does: [
        'For each one: its date, and whether it has intentions to apply.',
        'If none is found, prints the `git fetch` command to run.',
      ],
    },
    path: {
      kind: 'Upgrade',
      meta: 'read only',
      summary: 'Shows the intentions between your version and a target. Changes nothing.',
      does: [
        'Keeps the intentions of your domains, and drops those already applied or skipped.',
        'Works on the releases already fetched, unless you pass `--fetch`.',
      ],
      know: ['Optional: `upgrade` does the same computation before it prepares.'],
    },
    prepare: {
      kind: 'Upgrade',
      meta: 'creates a branch',
      summary: 'Prepares an upgrade on its own branch. Does not change your code.',
      does: [
        'Targets the latest release by default, fetches the tags if needed, and lets you choose the intentions.',
        'Refuses if the worktree is not clean or if `.boilerstone/upgrade/` already exists.',
        'Builds everything in a temporary folder, then creates the branch and publishes `.boilerstone/upgrade/`.',
      ],
      know: [
        '`--include` and `--exclude` choose the intentions without asking.',
        '`--fetch` stops everything if fetching the tags fails.',
        'Does not commit and does not push.',
      ],
    },
    branch: {
      kind: 'Git branch',
      meta: 'created by upgrade',
      summary: 'The branch of the upgrade, for example `upgrade/v1.1.0-to-v1.2.0`.',
      does: [
        'Created by `upgrade`. The PR starts from this branch.',
        'If it already exists, check it out before you run `upgrade` again.',
      ],
    },
    workspace: {
      kind: 'Folder',
      meta: 'ignored by git, disposable',
      summary: 'The working folder of the upgrade.',
      does: [
        '`intentions/`: the intentions, numbered in order.',
        '`reference/`: the files of the boilerplate before and after, to compare.',
        '`upgrade-session.md`: the checklist that the agent, or you, follows.',
      ],
      know: ['You can delete it at any time.'],
    },
    apply: {
      name: 'Apply the intentions',
      kind: 'Human step',
      meta: 'agent or you',
      summary: 'The real work: replaying each intention in your code.',
      does: [
        'With an agent: open a session in the project and run `/boilerstone-upgrade` (Claude Code) or the skill of the same name (Cursor).',
        'The agent reads all the intentions and proposes an apply / skip / ask table. It waits for your approval.',
        'Then one intention at a time: follow the copy or adapt rule, validate (lint, typecheck, tests), commit.',
      ],
      know: [
        'A `breaking-manual` intention always stops for a human decision.',
        'If it gets stuck, the agent writes `.boilerstone/upgrade/blocked.md` and hands back control.',
        'Finding the old tool in the project is a reason to apply the intention, not to skip it.',
      ],
    },
    record: {
      kind: 'Upgrade',
      meta: 'writes to the state',
      summary: 'Records the result of an intention, once it is validated.',
      does: [
        'Writes to `boilerplate.json`: applied (with the date) or skipped (with the reason).',
        'Ticks the box in `upgrade-session.md`.',
      ],
      know: [
        'One option at a time: `--applied` or `--skipped`. `--skipped` needs `--reason`.',
        'Does not record the same result twice.',
      ],
    },
    finish: {
      kind: 'Upgrade',
      meta: 'last commit',
      summary: 'Closes the upgrade. This is the last commit before the PR.',
      does: [
        'Checks that every intention in the range is applied or skipped.',
        'Writes the new version to `boilerplate.json`.',
        'Moves the pin of `rock` to the new version.',
      ],
      know: [
        'Refuses while an intention is still open, or if the release is not available in the repository.',
        'Leaves a customized `rock` alone.',
      ],
    },
    state2: {
      kind: 'File · final',
      meta: 'same file, updated',
      summary: 'The same `boilerplate.json`, at the end of the upgrade.',
      does: [
        '`upgrade record` adds each applied or skipped intention to it.',
        '`upgrade finish` writes the new version to it.',
      ],
    },
    pkg2: {
      kind: 'File · final',
      meta: 'same file, rock pinned',
      summary: 'The same `package.json`, at the end of the upgrade.',
      does: [
        '`upgrade finish` moves `rock` to the new version, for example `pnpm dlx @lonestone/boilerstone-cli@X.Y.Z rock`.',
      ],
    },
    pr: {
      name: 'Open the PR',
      kind: 'Human step',
      meta: 'a human merges',
      summary: 'Final commit, then a PR from the `upgrade/…` branch.',
      does: [
        'In the PR, list the intentions applied, skipped (with the reason) and blocked, and the validations you ran.',
        'Merging stays a human decision.',
      ],
    },
    intentions: {
      kind: 'Maintainer',
      meta: 'boilerplate only',
      summary: 'The migration intentions, on the boilerplate side.',
      does: [
        '`unreleased/`: those of the PRs that are not released yet.',
        '`vX.Y.Z/`: those of one release, numbered in the order to run them.',
      ],
      know: ['Absent from client projects: they read the intentions from the tags.'],
    },
    promote: {
      kind: 'Maintainer',
      meta: 'on the release PR',
      summary: 'When a release is cut, files the pending intentions under their version.',
      does: [
        'Moves `unreleased/*.md` to `vX.Y.Z/` and numbers them.',
        'Runs `intentions sync` again, which updates the README of the release.',
      ],
      know: ['The “Intention promote” CI check asks for it on the release PR.'],
    },
    lint: {
      kind: 'Maintainer · CI',
      meta: 'in CI',
      summary: 'Checks the metadata of the intentions: id, domain, classification.',
      does: [
        'Runs in CI. The “Intention gate” check also demands one intention per PR, or the `no-intention` label.',
      ],
    },
  },

  edges: {
    'release->init': '`init` clones the release',
    'release->onboard': 'fetches `.boilerstone/` and the skills',
    'release->refs': 'tags copied into `refs/boilerstone/`',
    'init->pkg': 'writes the `pnpm dlx` scripts',
    'init->state': 'creates `boilerplate.json`',
    'init->rock': 'run at the end of `init`',
    'onboard->bootstrap': 'runs `bootstrap`',
    'bootstrap->pkg': 'adds the `boilerplate` script',
    'bootstrap->state': 'creates `boilerplate.json` (`upgrade init`)',
    'rock->env': 'creates the `.env` files, starts Docker',
    'promote->intentions': '`unreleased/` to `vX.Y.Z/`',
    'intentions->lint': 'checked by CI',
    'intentions->release': 'leave with the tag',
    'state->status': 'read by `upgrade status`',
    'refs->status': 'available releases',
    'refs->versions': 'listed',
    'versions->path': 'pick a target',
    'status->prepare': 'if everything is ready',
    'path->prepare': 'preview, same computation',
    'refs->prepare': 'intentions read from the tag',
    'prepare->branch': 'creates the branch',
    'prepare->workspace': 'publishes the working folder',
    'workspace->apply': '`upgrade-session.md`',
    'apply->record': 'after validation',
    'record->finish': 'when everything is handled',
    'record->state2': 'adds the result',
    'finish->state2': 'writes the new version',
    'finish->pkg2': 'moves the pin of `rock`',
    'finish->pr': 'last commit',
    'branch->pr': 'the PR starts from this branch',
  },

  flows: {
    create: {
      title: 'Create a project',
      steps: [
        [
          'init',
          'Run it in the folder that will hold the project. The folder name becomes the scope `@my-app/*`.',
        ],
        [
          'release',
          'The CLI clones the release that has its own version, into a temporary folder.',
        ],
        [
          'pkg',
          'It writes the `boilerplate` and `rock` scripts as `pnpm dlx`. There is no dependency on the CLI.',
        ],
        ['state', 'It creates `boilerplate.json` with the starting version.'],
        ['rock', 'It installs the dependencies, formats the code, then runs `pnpm rock`.'],
        [
          'env',
          '`rock` creates the `.env` files, asks for the ports, and offers Docker and the migrations. Then make your first commit.',
        ],
      ],
    },
    join: {
      title: 'Join a project',
      steps: [
        ['rock', 'Clone the repository of the project, then run `pnpm install` and `pnpm rock`.'],
        [
          'env',
          '`rock` creates the missing `.env` files and starts Docker if you want. You can run it again at any time.',
        ],
      ],
    },
    onboard: {
      title: 'Connect a project without .boilerstone/',
      note: 'Does the project already have a `.boilerstone/` (created in v1.0.0 or v1.1.0)? Do not use `onboard`: run an upgrade. The `adopt-published-cli` intention moves it to the published CLI.',
      steps: [
        [
          'onboard',
          'For a project that has no `.boilerstone/` yet. Run it at the root, with a clean worktree.',
        ],
        [
          'release',
          'It fetches `.boilerstone/` and the `boilerstone-upgrade` skills from the release.',
        ],
        ['bootstrap', 'It runs `bootstrap`.'],
        [
          'pkg',
          '`bootstrap` adds the `boilerplate` script. It touches neither `rock` nor the dependencies.',
        ],
        [
          'state',
          '`bootstrap` creates `boilerplate.json` and asks for the starting version. Answer `0.0.0` if you are not sure. `onboard` then offers a commit.',
        ],
      ],
    },
    upgrade: {
      title: 'Run an upgrade',
      steps: [
        [
          'status',
          '`pnpm boilerplate upgrade status`: current version, clean worktree, available releases. Nothing changes.',
        ],
        [
          'prepare',
          '`pnpm boilerplate upgrade`: targets the latest release, fetches the tags, lets you choose the intentions.',
        ],
        ['branch', 'It creates the branch `upgrade/vA-to-vB`.'],
        [
          'workspace',
          'It publishes `.boilerstone/upgrade/`: numbered intentions, references, `upgrade-session.md`.',
        ],
        [
          'apply',
          'With the agent (`/boilerstone-upgrade`) or by hand: approve the apply / skip table, then one intention at a time, with validation and a commit.',
        ],
        [
          'record',
          'After each intention: `upgrade record --id <id> --applied`, or `--skipped --reason "…"`.',
        ],
        ['finish', 'When everything is handled: `upgrade finish --to X.Y.Z`.'],
        ['state2', 'The new version is written to `boilerplate.json`.'],
        ['pkg2', '`rock` moves to the new version.'],
        ['pr', 'Final commit, PR, then a human merges.'],
      ],
    },
    release: {
      title: 'Publish a release',
      steps: [
        [
          'intentions',
          'Every PR of the boilerplate adds an intention in `unreleased/`, or carries the `no-intention` label.',
        ],
        ['lint', 'CI runs `intentions lint` and the “Intention gate” check.'],
        ['promote', 'On the release PR: `pnpm boilerplate intentions promote --to X.Y.Z`.'],
        [
          'release',
          'On merge, Release Please creates the tag `vX.Y.Z` and CI publishes `@lonestone/boilerstone-cli@X.Y.Z`.',
        ],
      ],
    },
  },

  cheat: [
    {
      title: 'Outside a project',
      items: [
        [`${DLX} init my-app`, 'init', 'Create a project.'],
        [`${DLX}@X.Y.Z init my-app`, 'init', 'Create a project on a given release.'],
        [
          `${DLX} onboard`,
          'onboard',
          'Connect a project that has no `.boilerstone/`, at its root.',
        ],
      ],
    },
    {
      title: 'Inside a project',
      items: [
        ['pnpm rock', 'rock', 'Set up your machine.'],
        ['pnpm boilerplate upgrade status', 'status', 'See where the project stands.'],
        ['pnpm boilerplate upgrade', 'prepare', 'Prepare an upgrade to the latest release.'],
        [
          'pnpm boilerplate upgrade record --id <id> --applied',
          'record',
          'Record an applied intention.',
        ],
        ['pnpm boilerplate upgrade finish --to X.Y.Z', 'finish', 'Close the upgrade.'],
      ],
    },
    {
      title: 'Less often',
      items: [
        [
          'pnpm boilerplate upgrade path --to X.Y.Z',
          'path',
          'See the intentions before you prepare.',
        ],
        ['pnpm boilerplate versions list', 'versions', 'List the available releases.'],
        [`${DLX} bootstrap`, 'bootstrap', 'Wire a `.boilerstone/` that is already there.'],
        ['pnpm boilerplate upgrade init', 'state', 'Create `boilerplate.json` by hand.'],
      ],
    },
    {
      title: 'Boilerplate maintainer',
      items: [
        ['pnpm boilerplate intentions lint', 'lint', 'Check the intentions.'],
        [
          'pnpm boilerplate intentions promote --to X.Y.Z',
          'promote',
          'File the intentions of a release.',
        ],
        ['pnpm boilerplate intentions sync', 'promote', 'Regenerate the READMEs of the releases.'],
      ],
    },
  ],

  cards: [
    {
      title: 'Two ways to call the CLI',
      text: `Outside a project, with \`${DLX} <command>\`. Inside a project, \`pnpm boilerplate\` always runs the latest CLI, and \`pnpm rock\` runs the CLI of the release of the project. There is nothing to install.`,
    },
    {
      title: 'Choose a release',
      text: `To create a given release, pin the CLI: \`${DLX}@X.Y.Z init my-app\`. The CLI prints its version when it starts, because \`pnpm dlx\` may reuse a cached copy of \`@latest\` for a while after a release.`,
    },
    {
      title: 'With an AI agent',
      text: 'Run `/boilerstone-upgrade` in Claude Code, or the skill of the same name in Cursor. The agent proposes, you approve. To read the state, it uses `--json` on `upgrade status` and `upgrade path`.',
    },
    {
      title: 'A fork or a private mirror',
      text: 'When you run `init` or `onboard`, set `BOILERPLATE_REPO=<url>`. The address is kept in `boilerplate.json` for the upgrades.',
    },
    {
      title: 'Target another folder',
      text: 'The upgrade commands accept `--project <path>`. Otherwise they look for the project from the current folder.',
    },
    {
      title: 'Undo everything',
      text: 'During an upgrade: leave the branch, delete it, and remove `.boilerstone/upgrade/`. To leave the system: delete `.boilerstone/` and the `boilerplate` script.',
    },
  ],
}
