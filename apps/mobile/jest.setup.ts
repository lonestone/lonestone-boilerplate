import '@testing-library/react-native/extend-expect'

// Mock react-native-dotenv
jest.mock('react-native-dotenv', () => ({
  EXPO_PUBLIC_API_URL: 'http://localhost:3000',
}))

// Silence console warnings during tests
globalThis.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}
