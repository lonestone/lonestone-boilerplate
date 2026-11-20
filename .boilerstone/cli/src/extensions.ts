/**
 * Extensions `extension add` knows about. Each one lives in its own git
 * repository, released with `vX.Y.Z` tags, with an `extension.json` manifest at
 * its root (see `extension-manifest.ts`).
 */
import process from 'node:process'

export interface ExtensionEntry {
  description: string
  remote: string
}

export const EXTENSIONS: Record<string, ExtensionEntry> = {
  capacitor: {
    description: 'Wrap a web app into Android and iOS apps with Capacitor',
    remote: 'https://github.com/lonestone/lonestone-boilerplate-capacitor.git',
  },
}

/**
 * Overrides the remote of the extension being added: a fork, or a local
 * directory. A local directory is used as it is, uncommitted changes included,
 * unless `--ref` asks for one of its tags.
 */
export const EXTENSION_REPO_ENV = 'BOILERSTONE_EXTENSION_REPO'

export function resolveExtensionRemote(name: string): string {
  const entry = EXTENSIONS[name]
  if (!entry) {
    throw new Error(`Unknown extension '${name}'. Available: ${Object.keys(EXTENSIONS).join(', ')}`)
  }
  return process.env[EXTENSION_REPO_ENV] || entry.remote
}
