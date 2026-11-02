# @lonestone/boilerstone-cli

Installer, local setup and upgrade tool for the [Lonestone boilerplate](https://github.com/lonestone/lonestone-boilerplate). Needs `git` and `pnpm`.

```bash
# Create a project from the release that has the same version as this CLI
pnpm dlx @lonestone/boilerstone-cli init my-app

# Connect an existing project to the upgrade system (run at its root)
pnpm dlx @lonestone/boilerstone-cli onboard
```

Inside a project, `pnpm rock` sets up your machine, `pnpm boilerplate upgrade` prepares an upgrade, and `pnpm boilerplate extension add <name>` adds an extension (`pnpm boilerplate extension list` shows them, e.g. `capacitor` for native Android and iOS apps).

Every command and flow, with a map of what each one reads and writes: [Boilerstone CLI documentation](https://lonestone.github.io/lonestone-boilerplate/references/2_boilerstone-cli/). `pnpm dlx @lonestone/boilerstone-cli --help` lists the commands and options.
