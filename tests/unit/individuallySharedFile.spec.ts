import { Resource, ShareTypes, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { isIndividuallySharedCommentTarget } from '../../src/utils/individuallySharedFile'

describe('individually shared file detection', () => {
  it('detects a single-file mountpoint share', () => {
    const space = mock<SpaceResource>({ driveType: 'mountpoint', name: 'Plan.md' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      isShareRoot: () => true
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(true)
  })

  it('does not flag files inside a shared folder mount', () => {
    const space = mock<SpaceResource>({ driveType: 'mountpoint', name: 'Share' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      isShareRoot: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(false)
  })

  it('detects direct outgoing shares on owner files', () => {
    const space = mock<SpaceResource>({ driveType: 'personal' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      shareTypes: [ShareTypes.user.value],
      isMounted: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(true)
  })

  it('ignores mounted resources inside shared folders', () => {
    const space = mock<SpaceResource>({ driveType: 'personal' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Share/Plan.md',
      isFolder: false,
      shareTypes: [ShareTypes.user.value],
      isMounted: () => true
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(false)
  })
})
