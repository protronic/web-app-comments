import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import {
  createCommentTarget,
  getCommentDocumentPath,
  getCommentSidecarFileName,
  getSidecarContainerPath,
  normalizeResourceNameForSidecar,
  resolveSidebarSpace,
  resolveSourceResourceFromSidecar
} from '../../src/utils/target'

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
  it('derives the commented resource container from a sibling sidecar path', () => {
    expect(getSidecarContainerPath('/projects/.Plan.md.jsco')).toBe('/projects')
  })
})

describe('space-root sidecar paths', () => {
  it('stores space comments in a tagged sidecar at the space root', () => {
    const space = mock<SpaceResource>({
      id: 'owner$space',
      name: 'New space',
      driveType: 'project'
    })
    const target = createCommentTarget(
      space,
      mock<Resource>({
        id: 'owner$space',
        name: 'New space',
        path: '/',
        isFolder: true
      })
    )

    expect(getCommentDocumentPath(target)).toBe('/.New space.jsco')
  })
})

describe('sidecar resource naming', () => {
  it('normalizes sidecar file names before building sibling paths', () => {
    expect(normalizeResourceNameForSidecar('.New folder.jsco')).toBe('New folder')
    expect(normalizeResourceNameForSidecar('New folder.jsco')).toBe('New folder')
  })

  it('does not double-append the sidecar suffix', () => {
    const target = {
      name: '.New folder.jsco',
      path: '/New folder'
    }

    expect(getCommentSidecarFileName(target)).toBe('.New folder.jsco')
  })

  it('maps sidecar resources back to their source path', () => {
    expect(
      resolveSourceResourceFromSidecar({
        name: '.New folder.jsco',
        path: '/.New folder.jsco',
        isFolder: true
      })
    ).toEqual({
      name: 'New folder',
      path: '/New folder'
    })
  })
})
