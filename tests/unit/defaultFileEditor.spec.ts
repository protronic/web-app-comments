import { Resource } from '@opencloud-eu/web-client'
import type { ApplicationFileExtension } from '@opencloud-eu/web-pkg/dist/src/apps/types'
import {
  fileExtensionMatchesResource,
  openResourceWithDefaultEditor,
  resolveDefaultFileExtension
} from '../../src/utils/defaultFileEditor'
import { mock } from 'vitest-mock-extended'
import { vi } from 'vitest'

describe('default file editor', () => {
  const resource = {
    id: 'owner$space!file-1',
    fileId: 'owner$space!file-1',
    name: 'Neue Datei.odg',
    path: '/Neue Datei.odg',
    extension: 'odg',
    mimeType: 'application/vnd.oasis.opendocument.graphics',
    isFolder: false,
    canDownload: () => true
  } as Resource

  it('matches file extensions by extension or mime type', () => {
    expect(
      fileExtensionMatchesResource(
        { app: 'draw-io', extension: 'odg', type: 'file' },
        resource
      )
    ).toBe(true)
    expect(
      fileExtensionMatchesResource(
        {
          app: 'external',
          mimeType: 'application/vnd.oasis.opendocument.graphics',
          type: 'file'
        },
        resource
      )
    ).toBe(true)
  })

  it('prefers priority editor extensions', () => {
    const resolved = resolveDefaultFileExtension(
      [
        { app: 'text-editor', extension: 'txt', type: 'file' },
        { app: 'draw-io', extension: 'odg', type: 'file', hasPriority: true }
      ],
      resource,
      () => true
    )

    expect(resolved?.app).toBe('draw-io')
  })

  it('opens the default editor even when file actions are unavailable outside the files app', () => {
    const openEditor = vi.fn()
    const space = mock<Resource>({ id: 'owner$space' })

    const opened = openResourceWithDefaultEditor(
      space as never,
      {
        id: 'owner$space!file-1',
        fileId: 'owner$space!file-1',
        name: 'Neue Datei.odg',
        path: '/Neue Datei.odg',
        isFolder: false,
        resourceType: 'file',
        extension: 'odg',
        mimeType: 'application/vnd.oasis.opendocument.graphics',
        tags: []
      },
      [{ app: 'draw-io', extension: 'odg', type: 'file', hasPriority: true }],
      {
        getDefaultAction: vi.fn(() => undefined),
        triggerDefaultAction: vi.fn(),
        openEditor
      },
      () => true
    )

    expect(opened).toBe(true)
    expect(openEditor).toHaveBeenCalledWith(
      { app: 'draw-io', extension: 'odg', type: 'file', hasPriority: true },
      space,
      expect.objectContaining({
        extension: 'odg',
        path: '/Neue Datei.odg'
      })
    )
  })
})
