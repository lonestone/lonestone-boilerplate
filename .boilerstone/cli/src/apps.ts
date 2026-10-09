/**
 * The apps and packages of the boilerplate that `init` can leave out.
 *
 * The CLI only generates the release that carries its own version, so this
 * list lives here and not in the template. `apps.spec.ts` fails when a folder
 * under `apps/` or `packages/` is not classified below.
 */

/** Web apps a new project can include. Choosing none is valid: the project is then API only. */
export const WEB_APPS = ['web-spa', 'web-ssr'] as const
export type WebApp = (typeof WEB_APPS)[number]

export const WEB_APP_LABELS: Record<WebApp, string> = {
  'web-spa': 'Web SPA (React Router, client-side rendering)',
  'web-ssr': 'Web SSR (React Router, server-side rendering)',
}

/** Apps every project keeps. */
export const ALWAYS_INCLUDED_APPS = ['api', 'documentation'] as const

/**
 * Folders under `packages/` that a project keeps only while a remaining app or
 * package still depends on them. Every other folder under `packages/` is
 * always kept.
 */
export const OPTIONAL_PACKAGES = ['ui', 'i18n', 'openapi-generator'] as const

const NO_WEB_APP = 'none'

/**
 * Parses the value of `--apps`: web app ids separated by commas, or `none`.
 * Returns the ids in catalog order without duplicates. Throws an Error with a
 * message meant for the user.
 */
export function parseAppsOption(value: string): WebApp[] {
  const choices = `${WEB_APPS.join(', ')} or ${NO_WEB_APP}`
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    throw new Error(`--apps needs a value: ${choices} (several ids are separated by commas)`)
  }
  if (ids.includes(NO_WEB_APP)) {
    if (ids.length > 1) {
      throw new Error(`--apps ${NO_WEB_APP} cannot be combined with other values`)
    }
    return []
  }

  for (const id of ids) {
    if ((ALWAYS_INCLUDED_APPS as readonly string[]).includes(id)) {
      throw new Error(`'${id}' is always included: --apps lists web apps only (${choices})`)
    }
    if (!(WEB_APPS as readonly string[]).includes(id)) {
      throw new Error(`Unknown app '${id}': choose from ${choices}`)
    }
  }

  return WEB_APPS.filter((app) => ids.includes(app))
}
