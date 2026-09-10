import { authClient } from '@/lib/auth-client'

const PENDING_INVITATION_KEY = 'pitchkit.pendingInvitationId'

export function storePendingInvitationId(invitationId: string): void {
  if (!invitationId) return
  sessionStorage.setItem(PENDING_INVITATION_KEY, invitationId)
}

export function clearPendingInvitationId(): void {
  sessionStorage.removeItem(PENDING_INVITATION_KEY)
}

export function getStoredPendingInvitationId(): string | null {
  return sessionStorage.getItem(PENDING_INVITATION_KEY)
}

/**
 * Accept pending club invitations for the current session.
 * Call only when the user is signed in (ideally with a verified email).
 * Returns the organization id of the first accepted invitation, if any.
 */
export async function acceptPendingInvitations(): Promise<string | null> {
  const invitationIds = new Set<string>()
  const storedId = getStoredPendingInvitationId()
  if (storedId) invitationIds.add(storedId)

  const listed = await authClient.organization.listUserInvitations()
  if (!listed.error && Array.isArray(listed.data)) {
    for (const invitation of listed.data) {
      if (invitation.id) invitationIds.add(invitation.id)
    }
  }

  let acceptedOrganizationId: string | null = null

  for (const invitationId of invitationIds) {
    const result = await authClient.organization.acceptInvitation({ invitationId })
    if (result.error) continue
    const organizationId =
      result.data?.member?.organizationId ?? result.data?.invitation?.organizationId ?? null
    if (organizationId && !acceptedOrganizationId) {
      acceptedOrganizationId = organizationId
    }
  }

  clearPendingInvitationId()

  if (acceptedOrganizationId) {
    localStorage.setItem('pitchkit.activeClubId', acceptedOrganizationId)
    await authClient.organization.setActive({ organizationId: acceptedOrganizationId })
  }

  return acceptedOrganizationId
}
