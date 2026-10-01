/**
 * @param {string | undefined} prefix
 * @returns {string}
 */
export function normalizeApiPrefix(prefix) {
  const trimmed = prefix?.trim() ?? ''
  if (!trimmed || trimmed === '/') {
    return '/api'
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.replace(/\/+$/, '')
}

/**
 * @param {string | undefined} apiUrl
 * @param {string | undefined} apiPrefix
 * @returns {string}
 */
export function buildOpenApiDocsUrl(apiUrl, apiPrefix) {
  const origin = (apiUrl ?? '').trim().replace(/\/+$/, '')
  return `${origin}${normalizeApiPrefix(apiPrefix)}/docs.json`
}
