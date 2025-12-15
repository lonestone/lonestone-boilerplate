// This file mocks external dependencies for test isolation.

// Mock AI module example
/* jest.mock('ai', () => ({
  generateObject: jest.fn().mockResolvedValue({ object: { analysisResult: 'mocked result' } } as never),
}))
 */

jest.mock('better-auth/crypto', () => {
  const hashPassword = jest.fn(async (password: string) => `hashed:${password}`)
  const verifyPassword = jest.fn(
    async (password: string, hashed: string) => hashed === `hashed:${password}`,
  )

  return {
    hashPassword,
    verifyPassword,
    signJWT: jest.fn(),
    verifyJWT: jest.fn(),
    symmetricEncrypt: jest.fn(),
    symmetricDecrypt: jest.fn(),
    symmetricEncodeJWT: jest.fn(),
    symmetricDecodeJWT: jest.fn(),
    generateRandomString: jest.fn(() => 'test-random-string'),
    constantTimeEqual: jest.fn((a: string, b: string) => a === b),
  }
})

jest.mock('@better-auth/expo', () => ({
  expo: () => ({ name: 'expo-plugin-mock' }),
}))

jest.mock('better-auth/plugins', () => ({
  openAPI: () => ({ name: 'openapi-plugin-mock' }),
  createAuthMiddleware: (fn: (...args: any[]) => any) => fn,
}))

jest.mock('better-auth/node', () => ({
  toNodeHandler: jest.fn(() => (_req: any, _res: any, next: () => void) => {
    if (typeof next === 'function')
      next()
  }),
}))

jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({
    api: {},
    options: { hooks: {}, plugins: [] },
  })),
}))
