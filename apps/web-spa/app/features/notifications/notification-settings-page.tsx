import { Button } from '@pitchkit/ui/components/primitives/button'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pitchkitApi, type NotificationPreference } from '@/lib/pitchkit-api'

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient()
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => pitchkitApi.getNotificationPreferences(),
  })

  const update = useMutation({
    mutationFn: (body: Partial<NotificationPreference>) =>
      pitchkitApi.updateNotificationPreferences(body),
    onSuccess: () => {
      toast.success('Preferences saved')
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  if (isLoading || !prefs) return <div className="p-6">Loading…</div>

  const toggles: Array<{ key: keyof NotificationPreference; label: string }> = [
    { key: 'emailEnabled', label: 'Email notifications' },
    { key: 'pushEnabled', label: 'Push notifications' },
    { key: 'notifyNewMatch', label: 'New match' },
    { key: 'notifyRsvpReminder', label: 'RSVP reminders' },
    { key: 'notifyMatchCancelled', label: 'Match cancelled' },
    { key: 'notifyChatMention', label: 'Chat mentions' },
    { key: 'chatMentionsOnly', label: 'Chat: mentions only (ignore other messages)' },
    { key: 'notifyAllChatMessages', label: 'All chat messages' },
  ]

  return (
    <div className="space-y-6 p-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground">Choisis comment Rösti te contacte.</p>
      </div>
      <ul className="space-y-3">
        {toggles.map(({ key, label }) => {
          if (key === 'id') return null
          const value = prefs[key]
          if (typeof value !== 'boolean') return null
          return (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm">{label}</span>
              <Button
                size="sm"
                variant={value ? 'default' : 'outline'}
                onClick={() => update.mutate({ [key]: !value })}
              >
                {value ? 'On' : 'Off'}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
