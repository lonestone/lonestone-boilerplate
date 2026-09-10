# Rösti mobile (Capacitor)

The authenticated app lives in `apps/web-spa`. Capacitor wraps the SPA build for iOS and Android.

## Setup

```bash
pnpm --filter=@pitchkit/web-spa build
pnpm --filter=@pitchkit/web-spa exec cap add ios
pnpm --filter=@pitchkit/web-spa exec cap add android
pnpm --filter=@pitchkit/web-spa cap:sync
pnpm --filter=@pitchkit/web-spa cap:ios    # or cap:android
```

Config: [`capacitor.config.json`](./capacitor.config.json)

Deep link scheme: `rosti://invite?token=…&email=…`

Push tokens are registered via `initCapacitorNative()` in `app/lib/capacitor.ts` after login.
