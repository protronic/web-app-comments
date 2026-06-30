import { SpaceResource } from '@opencloud-eu/web-client'
import { Graph } from '@opencloud-eu/web-client/graph'
import { mock } from 'vitest-mock-extended'
import { ref } from 'vue'
import { loadDashboardSpaces } from '../../src/utils/dashboardSpaces'

describe('loadDashboardSpaces', () => {
  const graphClient = mock<Graph>({
    drives: {
      listMyDrives: vi.fn()
    }
  })

  beforeEach(() => {
    vi.mocked(graphClient.drives.listMyDrives).mockResolvedValue([
      mock<SpaceResource>({ id: 'personal', driveType: 'personal', disabled: false }),
      mock<SpaceResource>({ id: 'project', driveType: 'project', disabled: false }),
      mock<SpaceResource>({ id: 'virtual', driveType: 'virtual', disabled: false })
    ])
  })

  it('loads personal and project spaces from graph and the store', async () => {
    const spaces = ref<SpaceResource[]>([])

    const spacesStore = {
      spaces,
      loadSpaces: vi.fn().mockResolvedValue(undefined)
    }

    const result = await loadDashboardSpaces(spacesStore as never, graphClient)

    expect(spacesStore.loadSpaces).toHaveBeenCalledWith({ graphClient })
    expect(graphClient.drives.listMyDrives).toHaveBeenCalled()
    expect(result.map((space) => space.id).sort()).toEqual(['personal', 'project'])
  })

  it('merges matching spaces from the store', async () => {
    const spaces = ref<SpaceResource[]>([
      mock<SpaceResource>({ id: 'share', driveType: 'share', disabled: false }),
      mock<SpaceResource>({ id: 'project', driveType: 'project', disabled: false })
    ])

    const spacesStore = {
      spaces,
      loadSpaces: vi.fn().mockResolvedValue(undefined)
    }

    const result = await loadDashboardSpaces(spacesStore as never, graphClient)

    expect(spacesStore.loadSpaces).not.toHaveBeenCalled()
    expect(result.map((space) => space.id).sort()).toEqual(['personal', 'project'])
  })

  it('reuses already loaded spaces from the store', async () => {
    const spaces = ref<SpaceResource[]>([
      mock<SpaceResource>({ id: 'personal', driveType: 'personal', disabled: false })
    ])

    const spacesStore = {
      spaces,
      loadSpaces: vi.fn().mockResolvedValue(undefined)
    }

    await loadDashboardSpaces(spacesStore as never, graphClient)

    expect(spacesStore.loadSpaces).not.toHaveBeenCalled()
  })
})
