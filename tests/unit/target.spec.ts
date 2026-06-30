import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { getSidecarContainerPath, resolveSidebarSpace } from '../../src/utils/target'

describe('resolveSidebarSpace', () => {
  it('uses root as the active space', () => {
    const space = mock<SpaceResource>({ id: 'space-1', driveType: 'personal' })
    const resource = mock<Resource>({ name: 'Notes.md' })

    expect(
      resolveSidebarSpace({
        root: space,
        parent: mock<Resource>({ name: 'Documents' }),
        items: [resource]
      })
    ).toBe(space)
  })

  it('falls back to parent when it is a space', () => {
    const space = mock<SpaceResource>({ id: 'space-1', driveType: 'project' })
    const resource = mock<Resource>({ name: 'README.md' })

    expect(
      resolveSidebarSpace({
        parent: space,
        items: [resource]
      })
    ).toBe(space)
  })

  it('returns null when no space is available', () => {
    expect(
      resolveSidebarSpace({
        parent: mock<Resource>({ name: 'Documents' }),
        items: [mock<Resource>({ name: 'Notes.md' })]
      })
    ).toBeNull()
  })
})

describe('getSidecarContainerPath', () => {
  it('derives the commented resource container from a sidecar path', () => {
    expect(
      getSidecarContainerPath('/Testordner/.conflu/comments/file-1.json')
    ).toBe('/Testordner')
  })
})
