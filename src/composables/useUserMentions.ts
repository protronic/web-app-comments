import { ref } from 'vue'
import { useClientService } from '@opencloud-eu/web-pkg'
import { CommentAuthor } from '../types'
import { buildUserSearchFilter, graphUserToAuthor } from '../utils/userIdentity'

export function useUserMentions() {
  const clientService = useClientService()
  const isSearching = ref(false)

  const searchUsers = async (query: string): Promise<CommentAuthor[]> => {
    const term = query.trim()
    isSearching.value = true

    try {
      const users = await listGraphUsers(term)
      const normalizedTerm = term.toLowerCase()

      return users
        .map((user) => graphUserToAuthor(user))
        .filter((user) => user.id)
        .filter((user) => {
          if (!normalizedTerm) {
            return true
          }

          return [user.displayName, user.id]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedTerm))
        })
        .slice(0, 10)
    } catch {
      return []
    } finally {
      isSearching.value = false
    }
  }

  const listGraphUsers = async (term: string) => {
    const filter = buildUserSearchFilter(term)
    const select = ['id', 'displayName', 'onPremisesSamAccountName', 'mail'] as const

    try {
      return await clientService.graphAuthenticated.users.listUsers(
        filter
          ? {
              filter,
              orderBy: ['displayName'],
              select: [...select]
            }
          : {
              orderBy: ['displayName'],
              select: [...select]
            }
      )
    } catch {
      if (!term) {
        throw new Error('Unable to list users')
      }

      return clientService.graphAuthenticated.users.listUsers({
        search: `"${term.replace(/"/g, '')}"`,
        orderBy: ['displayName'],
        select: [...select]
      })
    }
  }

  return {
    isSearching,
    searchUsers
  }
}
