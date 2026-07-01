import { ref } from 'vue'
import { useClientService } from '@opencloud-eu/web-pkg'
import { CommentAuthor } from '../types'
import { graphUserToAuthor } from '../utils/userIdentity'

export function useUserMentions() {
  const clientService = useClientService()
  const isSearching = ref(false)

  const searchUsers = async (query: string): Promise<CommentAuthor[]> => {
    const term = query.trim()
    isSearching.value = true

    try {
      const users = await clientService.graphAuthenticated.users.listUsers(
        term
          ? {
              search: `"${term.replace(/"/g, '')}"`,
              orderBy: ['displayName'],
              select: ['id', 'displayName', 'onPremisesSamAccountName', 'mail']
            }
          : {
              orderBy: ['displayName'],
              select: ['id', 'displayName', 'onPremisesSamAccountName', 'mail']
            }
      )

      return users.map((user) => graphUserToAuthor(user)).filter((user) => user.id).slice(0, 10)
    } catch {
      return []
    } finally {
      isSearching.value = false
    }
  }

  return {
    isSearching,
    searchUsers
  }
}
