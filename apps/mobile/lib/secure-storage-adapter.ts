import * as SecureStore from 'expo-secure-store'

export const AUTH_STORAGE_PREFIX = 'lonestone_auth'
const COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`
const SESSION_DATA_KEY = `${AUTH_STORAGE_PREFIX}_session_data`
const STORAGE_KEYS = [COOKIE_KEY, SESSION_DATA_KEY]

// Keep a synchronous in-memory cache because expoClient expects sync storage.
const memoryStore = new Map<string, string>()

/**
 * Hydrate the in-memory cache from SecureStore at app startup.
 * Should be awaited before the auth client performs requests.
 */
export async function hydrateSecureStorage() {
  await Promise.all(
    STORAGE_KEYS.map(async (key) => {
      try {
        const value = await SecureStore.getItemAsync(normalizeKey(key))
        if (value != null && value !== 'null') {
          memoryStore.set(key, value)
        }
      }
      catch {
        // Swallow errors to avoid blocking app start; auth will fall back to empty cache.
      }
    }),
  )
}

export const secureStorageReady = hydrateSecureStorage()

export const secureStorageAdapter = {
  getItem(key: string): string | null {
    const value = memoryStore.get(key)
    if (value === undefined || value === 'null')
      return null
    return value
  },
  setItem(key: string, value: string): void {
    if (value === null || value === undefined) {
      this.removeItem(key)
      return
    }

    const normalizedValue = value === 'null' ? '{}' : value
    memoryStore.set(key, normalizedValue)
    void SecureStore.setItemAsync(normalizeKey(key), normalizedValue).catch(() => {})
  },
  removeItem(key: string): void {
    memoryStore.delete(key)
    void SecureStore.deleteItemAsync(normalizeKey(key)).catch(() => {})
  },
}

/**
 * Normalizes storage keys for expo-secure-store compatibility.
 * expo-secure-store only accepts: alphanumeric, ".", "-", and "_"
 */
function normalizeKey(key: string): string {
  return key.replace(/:/g, '_')
}
