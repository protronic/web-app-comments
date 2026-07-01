import {
  authorMatchesUser,
  buildUserSearchFilter,
  collectUserIdentityKeys,
  graphUserToAuthor,
  resolveCommentUserId,
  userRecordToAuthor
} from '../../src/utils/userIdentity'

describe('user identity', () => {
  it('prefers onPremisesSamAccountName as the canonical comment user id', () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000001',
      onPremisesSamAccountName: 'marie',
      displayName: 'Marie Curie'
    }

    expect(resolveCommentUserId(user)).toBe('marie')
    expect(userRecordToAuthor(user)).toEqual({
      id: 'marie',
      displayName: 'Marie Curie'
    })
    expect(graphUserToAuthor(user)).toEqual({
      id: 'marie',
      displayName: 'Marie Curie'
    })
  })

  it('collects all known identity keys for matching', () => {
    expect(
      collectUserIdentityKeys({
        id: '00000000-0000-0000-0000-000000000001',
        onPremisesSamAccountName: 'marie',
        mail: 'marie@example.com'
      })
    ).toEqual([
      'marie',
      '00000000-0000-0000-0000-000000000001',
      'marie@example.com'
    ])
  })

  it('matches authors across uuid and login aliases', () => {
    expect(
      authorMatchesUser({ id: '00000000-0000-0000-0000-000000000001', displayName: 'Marie' }, [
        'marie',
        '00000000-0000-0000-0000-000000000001'
      ])
    ).toBe(true)
  })

  it('builds a graph filter for user search', () => {
    expect(buildUserSearchFilter("O'Brien")).toContain("O''Brien")
    expect(buildUserSearchFilter('Marie')).toContain("startswith(displayName,'Marie')")
  })
})
