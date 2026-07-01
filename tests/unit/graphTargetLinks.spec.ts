import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import { enrichTargetLinkFromGraph } from '../../src/utils/graphTargetLinks'
import { DashboardTargetSummary } from '../../src/types'

describe('graph target link enrichment', () => {
  const space = mock<SpaceResource>({
    id: 'owner$space'
  })

  it('loads webUrl from graph when webdav did not provide a private link', async () => {
    const graph = {
      getDriveItem: vi.fn().mockResolvedValue({
        id: 'owner$space!file-1',
        webUrl: 'https://test.oc:9200/f/owner%24space%21file-1'
      })
    }

    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }

    await expect(enrichTargetLinkFromGraph(graph, space, target)).resolves.toEqual({
      ...target,
      fileId: 'owner$space!file-1',
      privateLink: 'https://test.oc:9200/f/owner%24space%21file-1'
    })
    expect(graph.getDriveItem).toHaveBeenCalledWith('owner$space', 'owner$space!file-1')
  })

  it('keeps an existing private link', async () => {
    const graph = {
      getDriveItem: vi.fn()
    }

    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      privateLink: 'https://test.oc:9200/f/owner%24space%21file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }

    await expect(enrichTargetLinkFromGraph(graph, space, target)).resolves.toEqual(target)
    expect(graph.getDriveItem).not.toHaveBeenCalled()
  })
})
