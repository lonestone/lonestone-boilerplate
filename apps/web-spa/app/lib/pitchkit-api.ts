const API_URL = import.meta.env.VITE_API_URL as string

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const pitchkitApi = {
  listClubs: () => request<Club[]>('/clubs'),
  getClub: (orgId: string) => request<Club>(`/clubs/${orgId}`),
  updateClub: (
    orgId: string,
    body: {
      name?: string
      venue?: string | null
      sportType?: SportType | null
      defaultMaxCapacity?: number | null
    },
  ) =>
    request<Club>(`/clubs/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listMembers: (orgId: string) => request<ClubMember[]>(`/clubs/${orgId}/members`),
  updateMemberRole: (orgId: string, memberId: string, role: 'admin' | 'member') =>
    request<ClubMember>(`/clubs/${orgId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  listSeasons: (orgId: string) => request<Season[]>(`/clubs/${orgId}/seasons`),
  createSeason: (orgId: string, body: { name: string; startsAt: string; endsAt?: string }) =>
    request<Season>(`/clubs/${orgId}/seasons`, { method: 'POST', body: JSON.stringify(body) }),

  listMatches: (orgId: string, seasonId?: string) =>
    request<Match[]>(
      `/clubs/${orgId}/matches${seasonId ? `?seasonId=${seasonId}` : ''}`,
    ),
  getMatch: (orgId: string, matchId: string) =>
    request<Match>(`/clubs/${orgId}/matches/${matchId}`),
  createMatches: (orgId: string, body: CreateMatchBody) =>
    request<Match[]>(`/clubs/${orgId}/matches`, { method: 'POST', body: JSON.stringify(body) }),
  updateMatch: (
    orgId: string,
    matchId: string,
    body: {
      title?: string
      startsAt?: string
      location?: string | null
      maxCapacity?: number
    },
  ) =>
    request<Match>(`/clubs/${orgId}/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  cancelMatch: (orgId: string, matchId: string, reason?: string) =>
    request<Match>(`/clubs/${orgId}/matches/${matchId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  listAttendances: (orgId: string, matchId: string) =>
    request<Attendance[]>(`/clubs/${orgId}/matches/${matchId}/attendances`),
  respondAttendance: (orgId: string, matchId: string, status: 'present' | 'absent') =>
    request<Attendance>(`/clubs/${orgId}/matches/${matchId}/attendances/me`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  setAttendance: (
    orgId: string,
    matchId: string,
    userId: string,
    status: 'present' | 'absent' | 'pending',
  ) =>
    request<Attendance>(`/clubs/${orgId}/matches/${matchId}/attendances/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  listLineups: (orgId: string, matchId: string) =>
    request<Lineup[]>(`/clubs/${orgId}/matches/${matchId}/lineups`),
  setLineup: (
    orgId: string,
    matchId: string,
    assignments: Array<{ userId: string; team: 'blue' | 'red' }>,
  ) =>
    request<Lineup[]>(`/clubs/${orgId}/matches/${matchId}/lineups`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
  setPlayerTeam: (
    orgId: string,
    matchId: string,
    userId: string,
    team: 'blue' | 'red' | null,
  ) =>
    request<Lineup[]>(`/clubs/${orgId}/matches/${matchId}/lineups/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ team }),
    }),

  listMatchStats: (orgId: string, matchId: string) =>
    request<MatchStat[]>(`/clubs/${orgId}/matches/${matchId}/stats`),
  upsertMatchStats: (
    orgId: string,
    matchId: string,
    stats: Array<{ userId: string; goals: number; assists: number }>,
  ) =>
    request<MatchStat[]>(`/clubs/${orgId}/matches/${matchId}/stats`, {
      method: 'PUT',
      body: JSON.stringify({ stats }),
    }),
  seasonStats: (orgId: string, seasonId: string) =>
    request<SeasonPlayerStat[]>(`/clubs/${orgId}/seasons/${seasonId}/stats`),

  listMessages: (orgId: string, matchId: string) =>
    request<MatchMessage[]>(`/clubs/${orgId}/matches/${matchId}/messages`),
  postMessage: (
    orgId: string,
    matchId: string,
    body: string,
    mentionedUserIds?: string[],
  ) =>
    request<MatchMessage>(`/clubs/${orgId}/matches/${matchId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, mentionedUserIds }),
    }),

  getNotificationPreferences: () =>
    request<NotificationPreference>('/notifications/preferences'),
  updateNotificationPreferences: (body: Partial<NotificationPreference>) =>
    request<NotificationPreference>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web') =>
    request('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  getMatchCost: (orgId: string, matchId: string) =>
    request<MatchCost>(`/clubs/${orgId}/matches/${matchId}/cost`),
  upsertMatchCost: (
    orgId: string,
    matchId: string,
    body: { pitchCostCents: number; extrasCostCents: number },
  ) =>
    request<MatchCost>(`/clubs/${orgId}/matches/${matchId}/cost`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listFees: (orgId: string, matchId: string) =>
    request<SessionFee[]>(`/clubs/${orgId}/matches/${matchId}/fees`),
  updateFeeStatus: (orgId: string, feeId: string, status: 'owed' | 'paid' | 'waived') =>
    request<SessionFee>(`/clubs/${orgId}/fees/${feeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getPaymentLink: (orgId: string) =>
    request<{ paymentLink?: string }>(`/clubs/${orgId}/payment-link`),
  setPaymentLink: (orgId: string, paymentLink: string | null) =>
    request<{ paymentLink?: string }>(`/clubs/${orgId}/payment-link`, {
      method: 'PUT',
      body: JSON.stringify({ paymentLink }),
    }),
}

export type SportType =
  | 'football'
  | 'futsal'
  | 'basketball'
  | 'volleyball'
  | 'tennis'
  | 'padel'
  | 'badminton'
  | 'other'

export interface Club {
  id: string
  name: string
  slug?: string | null
  logo?: string | null
  paymentLink?: string | null
  venue?: string | null
  sportType?: SportType | null
  defaultMaxCapacity?: number | null
  createdAt: string
}

export interface ClubMember {
  id: string
  userId: string
  name: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  role: 'owner' | 'admin' | 'member'
  createdAt: string
}

export interface Season {
  id: string
  organizationId: string
  name: string
  startsAt: string
  endsAt?: string | null
  status: 'active' | 'closed'
  createdAt: string
}

export interface Match {
  id: string
  organizationId: string
  seasonId: string
  seriesId?: string | null
  title: string
  startsAt: string
  location?: string | null
  maxCapacity: number
  status: 'scheduled' | 'cancelled' | 'played'
  reminderOffsetsHours?: number[] | null
  presentCount?: number
  cancellationReason?: string | null
  createdAt: string
}

export interface CreateMatchBody {
  seasonId: string
  title: string
  startsAt: string
  location?: string
  maxCapacity: number
  reminderOffsetsHours?: number[]
  recurrence?: {
    frequency: 'weekly' | 'monthly' | 'monthly_nth_weekday' | 'custom'
    endsAt?: string
    occurrenceCount?: number
    rrule?: string
  }
}

export interface Attendance {
  id: string
  matchId: string
  userId: string
  userName: string
  status: 'present' | 'absent' | 'pending'
  respondedAt?: string | null
}

export interface Lineup {
  id: string
  matchId: string
  userId: string
  userName: string
  team: 'blue' | 'red'
}

export interface MatchStat {
  id: string
  matchId: string
  userId: string
  userName: string
  goals: number
  assists: number
}

export interface SeasonPlayerStat {
  userId: string
  userName: string
  goals: number
  assists: number
  matchesPlayed: number
}

export interface MatchMessage {
  id: string
  matchId: string
  authorId: string
  authorName: string
  body: string
  mentionedUserIds: string[]
  createdAt: string
}

export interface NotificationPreference {
  id: string
  emailEnabled: boolean
  pushEnabled: boolean
  notifyNewMatch: boolean
  notifyRsvpReminder: boolean
  notifyMatchCancelled: boolean
  chatMentionsOnly: boolean
  notifyChatMention: boolean
  notifyAllChatMessages: boolean
}

export interface MatchCost {
  id: string
  matchId: string
  pitchCostCents: number
  extrasCostCents: number
  perPlayerCents?: number
  presentCount?: number
}

export interface SessionFee {
  id: string
  matchId: string
  userId: string
  userName: string
  amountCents: number
  status: 'owed' | 'paid' | 'waived'
  paidAt?: string | null
}
