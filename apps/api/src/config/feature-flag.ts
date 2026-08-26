const FEATURE_PREFIX = 'FEATURE_'

function toEnvName(flag: string): string {
  const upperFlag = flag.toUpperCase()
  if (upperFlag.startsWith(FEATURE_PREFIX)) {
    return upperFlag
  }

  return `${FEATURE_PREFIX}${upperFlag}`
}

function isEnabledValue(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue === 'true' || normalizedValue === '1'
}

/**
 * Returns whether a feature flag is on.
 *
 * Reads `FEATURE_<NAME>` from the environment. Pass the name with or without
 * the `FEATURE_` prefix. The flag is on only for `true` or `1` (any case).
 * Unknown flags are off; they are not part of the env schema.
 */
export function isFeatureEnabled(flag: string): boolean {
  return isEnabledValue(process.env[toEnvName(flag)])
}
