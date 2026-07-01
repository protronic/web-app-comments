import type { User } from '@opencloud-eu/web-client/graph/generated'
import { CommentAuthor } from '../types'

const USER_IDENTITY_FIELDS = [
  'onPremisesSamAccountName',
  'id',
  'userName',
  'mail'
] as const

export function normalizeUserIdentity(value: string): string {
  return value.trim().toLowerCase()
}

export function resolveCommentUserId(
  user: Pick<User, 'id' | 'onPremisesSamAccountName' | 'mail'> & {
    userName?: string | null
  }
): string {
  for (const field of USER_IDENTITY_FIELDS) {
    const value = user[field as keyof typeof user]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

export function collectUserIdentityKeys(
  user: Record<string, unknown> | User | null | undefined
): string[] {
  if (!user) {
    return []
  }

  const keys = new Set<string>()

  for (const field of USER_IDENTITY_FIELDS) {
    const value = user[field as keyof typeof user]

    if (typeof value === 'string' && value.trim()) {
      keys.add(value.trim())
    }
  }

  return [...keys]
}

export function userRecordToAuthor(user: Record<string, unknown>): CommentAuthor {
  const id = resolveCommentUserId(user as User)
  const displayName = String(user.displayName || user.name || user.userName || id || 'Unknown')

  return { id: id || 'current-user', displayName }
}

export function graphUserToAuthor(user: User): CommentAuthor {
  const id = resolveCommentUserId(user)
  const displayName = user.displayName || id

  return { id, displayName }
}

export function authorMatchesUser(
  author: CommentAuthor,
  userIds: string | string[] | undefined
): boolean {
  const candidates = normalizeUserIds(userIds)

  if (candidates.size === 0) {
    return false
  }

  return candidates.has(normalizeUserIdentity(author.id))
}

export function userIdsMatch(left: string, right: string): boolean {
  return normalizeUserIdentity(left) === normalizeUserIdentity(right)
}

export function normalizeUserIds(userIds: string | string[] | undefined): Set<string> {
  const values = Array.isArray(userIds) ? userIds : userIds ? [userIds] : []

  return new Set(values.map(normalizeUserIdentity).filter(Boolean))
}

/** @deprecated Use authorMatchesUser instead */
export function authorsMatch(left: CommentAuthor, rightId: string): boolean {
  return authorMatchesUser(left, rightId)
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}

export function buildUserSearchFilter(term: string): string | undefined {
  const normalized = term.trim()

  if (!normalized) {
    return undefined
  }

  const escaped = escapeODataString(normalized)

  return [
    `startswith(displayName,'${escaped}')`,
    `startswith(onPremisesSamAccountName,'${escaped}')`,
    `startswith(mail,'${escaped}')`
  ].join(' or ')
}
