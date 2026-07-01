import type { User } from '@opencloud-eu/web-client/graph/generated'
import { CommentAuthor } from '../types'

export function userRecordToAuthor(user: Record<string, unknown>): CommentAuthor {
  const id = String(user.id || user.onPremisesSamAccountName || user.userName || 'current-user')
  const displayName = String(user.displayName || user.name || user.userName || id)

  return { id, displayName }
}

export function graphUserToAuthor(user: User): CommentAuthor {
  const id = user.onPremisesSamAccountName || user.id || ''
  const displayName = user.displayName || id

  return { id, displayName }
}

export function authorsMatch(left: CommentAuthor, rightId: string): boolean {
  return left.id === rightId
}
