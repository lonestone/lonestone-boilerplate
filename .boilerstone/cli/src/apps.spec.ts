import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALWAYS_INCLUDED_APPS, OPTIONAL_PACKAGES, parseAppsOption, WEB_APPS } from './apps'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function listFolders(relativePath: string): string[] {
  return readdirSync(join(projectRoot, relativePath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

describe('parseAppsOption', () => {
  it('parses a single web app', () => {
    expect(parseAppsOption('web-spa')).toEqual(['web-spa'])
    expect(parseAppsOption('web-ssr')).toEqual(['web-ssr'])
  })

  it('parses several web apps', () => {
    expect(parseAppsOption('web-spa,web-ssr')).toEqual(['web-spa', 'web-ssr'])
  })

  it('returns the apps in catalog order', () => {
    expect(parseAppsOption('web-ssr,web-spa')).toEqual(['web-spa', 'web-ssr'])
  })

  it('removes duplicates', () => {
    expect(parseAppsOption('web-ssr,web-ssr')).toEqual(['web-ssr'])
    expect(parseAppsOption('web-ssr,web-spa,web-ssr')).toEqual(['web-spa', 'web-ssr'])
  })

  it('ignores spaces around the ids', () => {
    expect(parseAppsOption(' web-spa , web-ssr ')).toEqual(['web-spa', 'web-ssr'])
    expect(parseAppsOption('  none ')).toEqual([])
  })

  it('ignores empty items between commas', () => {
    expect(parseAppsOption('web-spa,,web-ssr,')).toEqual(['web-spa', 'web-ssr'])
  })

  it('returns an empty list for none', () => {
    expect(parseAppsOption('none')).toEqual([])
  })

  it('rejects an empty value', () => {
    expect(() => parseAppsOption('')).toThrow('--apps needs a value')
    expect(() => parseAppsOption('  ')).toThrow('--apps needs a value')
    expect(() => parseAppsOption(',')).toThrow('--apps needs a value')
  })

  it('rejects none combined with an app', () => {
    expect(() => parseAppsOption('none,web-spa')).toThrow('none')
    expect(() => parseAppsOption('web-spa,none')).toThrow('none')
  })

  it.each(ALWAYS_INCLUDED_APPS)('rejects %s because it is always included', (app) => {
    expect(() => parseAppsOption(app)).toThrow(`'${app}' is always included`)
    expect(() => parseAppsOption(`web-spa,${app}`)).toThrow(`'${app}'`)
  })

  it('rejects an unknown app and names it', () => {
    expect(() => parseAppsOption('mobile')).toThrow("Unknown app 'mobile'")
    expect(() => parseAppsOption('web-spa,mobile')).toThrow("Unknown app 'mobile'")
  })

  it('lists the valid choices in the error for an unknown app', () => {
    expect(() => parseAppsOption('mobile')).toThrow('web-spa, web-ssr or none')
  })
})

describe('app catalog', () => {
  it('classifies every folder under apps/', () => {
    const known: readonly string[] = [...WEB_APPS, ...ALWAYS_INCLUDED_APPS]
    const unclassified = listFolders('apps').filter((folder) => !known.includes(folder))

    expect(
      unclassified,
      `apps/${unclassified.join(', apps/')} is not classified. Add it to WEB_APPS or ALWAYS_INCLUDED_APPS in .boilerstone/cli/src/apps.ts so that \`init\` knows whether a project can leave it out.`,
    ).toEqual([])
  })

  it('has a folder for every web app', () => {
    const missing = WEB_APPS.filter((app) => !existsSync(join(projectRoot, 'apps', app)))

    expect(
      missing,
      `WEB_APPS lists ${missing.join(', ')} but there is no such folder under apps/. Update .boilerstone/cli/src/apps.ts.`,
    ).toEqual([])
  })

  it('has a folder for every optional package', () => {
    const missing = OPTIONAL_PACKAGES.filter(
      (name) => !existsSync(join(projectRoot, 'packages', name)),
    )

    expect(
      missing,
      `OPTIONAL_PACKAGES lists ${missing.join(', ')} but there is no such folder under packages/. Update .boilerstone/cli/src/apps.ts.`,
    ).toEqual([])
  })
})
