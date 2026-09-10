import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { pitchkitApi } from '@/lib/pitchkit-api'

/** Call once after login when running inside Capacitor. */
export async function initCapacitorNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  CapApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'rosti:' && parsed.hostname === 'invite') {
        const token = parsed.searchParams.get('token')
        const email = parsed.searchParams.get('email')
        window.location.href = `/register?invitationId=${token ?? ''}&email=${encodeURIComponent(email ?? '')}`
      }
    } catch {
      // ignore malformed deep links
    }
  })

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', (token) => {
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
    void pitchkitApi.registerDevice(token.value, platform)
  })
}
