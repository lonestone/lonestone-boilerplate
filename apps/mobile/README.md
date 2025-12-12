# Mobile App

React Native mobile application built with Expo, featuring authentication, navigation, and dark mode support.

## Tech Stack

- **React Native** with **Expo** (~52.0)
- **React Navigation** (native stack)
- **NativeWind** (Tailwind CSS for React Native)
- **Zustand** (state management)
- **TanStack Query** (data fetching)
- **Better Auth** (authentication)
- **Jest** + **React Native Testing Library** (testing)
- **EAS Build** (builds and deployment)

## Prerequisites

- Node.js 24.10.0
- pnpm 10.5.2
- Expo CLI (installed automatically)
- iOS Simulator (for iOS development on macOS)
- Android Studio or Android Emulator (for Android development)

## Getting Started

### 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 2. Environment Setup

Copy the environment file:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `.env` and configure:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Note: On iOS simulator, use `http://localhost:3000`. On Android emulator, use `http://10.0.2.2:3000` or your machine's IP address.

### 3. Start Development Server

From the repository root:

```bash
pnpm dev:mobile
```

Or from the mobile folder:

```bash
cd apps/mobile
pnpm dev
```

This will start the Expo development server. You can then:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan the QR code with Expo Go app on your physical device

## Development

### Running on Specific Platforms

```bash
# iOS
pnpm ios

# Android
pnpm android

# Web (for quick testing)
pnpm web
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── navigation/           # Navigation configuration
│   │   ├── types.ts         # Navigation types
│   │   └── root-navigator.tsx
│   └── screens/             # Global screens
│       ├── home-screen.tsx
│       └── profile-screen.tsx
├── features/                # Feature modules
│   ├── common/
│   │   └── hooks/
│   │       └── use-theme.ts
│   └── auth/
│       └── components/
│           ├── login-screen.tsx
│           └── register-screen.tsx
├── components/              # Shared components
│   ├── button.tsx
│   ├── input.tsx
│   └── index.ts
├── lib/                     # External library configs
│   ├── auth-client.ts      # Better Auth client
│   └── query-client.tsx    # TanStack Query client
├── store/                   # Zustand stores
│   ├── auth-store.ts       # Authentication state
│   ├── theme-store.ts      # Theme/dark mode state
│   └── index.ts
├── config/                  # App configuration
│   └── env.config.ts       # Environment variables
├── App.tsx                 # App entry point
├── app.json               # Expo configuration
├── eas.json              # EAS Build configuration
└── package.json
```

## Building

### Development Builds

For features that don't work with Expo Go:

```bash
# Build for iOS
eas build --profile development --platform ios

# Build for Android
eas build --profile development --platform android
```

Install the development build on your device, then start the dev server with `pnpm dev`.

### Preview Builds

For internal testing:

```bash
# iOS and Android
eas build --profile preview --platform all

# iOS only
eas build --profile preview --platform ios

# Android only (APK)
eas build --profile preview --platform android
```

### Production Builds

For app store submission:

```bash
eas build --profile production --platform all
```

## Authentication

The mobile app uses Better Auth with the same configuration as the web apps. Users can:

- Sign up with email and password
- Sign in with email and password
- Sign out

Authentication state is managed globally with Zustand and persists across app restarts.

## Deep links (reset password)

- Scheme: `lonestone://reset-password?token=...` (configurable via `EXPO_PUBLIC_SCHEME` in `apps/mobile/.env` and `CLIENTS_MOBILE_SCHEME` in `apps/api/.env`).
- **Important:** Expo Go does not support custom schemes; you need a dev build or an installed app with this scheme to test.
- Useful commands:
  - Prebuild with this command `pnpm expo prebuild --clean --no-install`
  - Install a dev build for iOS (simulator): `pnpm expo run:ios`
  - Open a deeplink on the simulator: `xcrun simctl openurl booted "lonestone://reset-password?token=YOUR_TOKEN"`
  - Via utility: `npx uri-scheme open "lonestone://reset-password?token=YOUR_TOKEN" --ios`
- If you change the scheme, regenerate the prebuild and reinstall the dev build (`pnpm expo prebuild --clean --no-install && pnpm expo run:ios`).

### Universal Links (to be implemented)

The current flow uses a simple deeplink. To switch to Universal Links (iOS) / App Links (Android):

- Prepare the apple-app-site-association / assetlinks.json files on your domain.
- Use the utility script `pnpm create:universallinks` (see `apps/mobile/scripts/create-universallinks.ts`) to generate the base configuration.
- Update the iOS/Android config (entitlements, manifest) and align the API to send the universal URL.

## Dark Mode

The app supports automatic dark mode based on system preferences. Users can also toggle dark mode manually using the `useTheme` hook:

```tsx
import { useTheme } from '@/features/common/hooks/use-theme'

function MyComponent() {
  const { colorScheme, toggleColorScheme, isDark } = useTheme()

  return (
    <Button onPress={toggleColorScheme}>
      Toggle
      {' '}
      {isDark ? 'Light' : 'Dark'}
      {' '}
      Mode
    </Button>
  )
}
```

## CI/CD

The mobile app has a dedicated GitHub Actions workflow (`.github/workflows/mobile-ci.yml`) that:

- Runs linting and type checking
- Executes tests
- Builds preview versions on pull requests
- Builds production versions on main branch pushes

Requires `EXPO_TOKEN` secret in GitHub repository settings.

## Troubleshooting

### Metro bundler issues

Clear the cache:

```bash
pnpm dev --clear
```

### Environment variables not working

1. Restart the Metro bundler after changing `.env`
2. Ensure variables are prefixed with `EXPO_PUBLIC_`
3. Check `expo-env.d.ts` for type declarations

### Cannot connect to API

- On iOS simulator: use `http://localhost:3000`
- On Android emulator: use `http://10.0.2.2:3000`
- On physical device: use your computer's IP address (e.g., `http://192.168.1.100:3000`)

## Documentation

For more detailed guidelines, see the [Mobile Guidelines](../documentation/src/content/docs/guidelines/mobile.mdx).
