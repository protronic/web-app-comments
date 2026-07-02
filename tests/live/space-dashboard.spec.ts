// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import { findSpaceForSearchResource } from '../../src/utils/dashboardSearch'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('space dashboard diagnostic', () => {
  it('reports tagged resources and space entries', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const auth = Buffer.from('admin:admin').toString('base64')
    const headers = () => ({ Authorization: `Basic ${auth}` })
    const dav = webdav(baseUrl, headers)

    const response = await fetch(`${baseUrl}/graph/v1.0/me/drives`, { headers: headers() })
    const { value: drives } = (await response.json()) as { value: Array<Record<string, unknown>> }
    const spaces = drives
      .filter(
        (drive) =>
          drive.driveType === 'personal' ||
          drive.driveType === 'project' ||
          drive.driveType === 'mountpoint'
      )
      .map((drive) => buildSpace({ ...drive, serverUrl: baseUrl } as never))

    const search = await dav.search('tag:Kommentiert', { searchLimit: 100 })
    console.log(
      'search hits',
      JSON.stringify(
        search.resources.map((resource) => ({
          name: resource.name,
          path: resource.path,
          storageId: resource.storageId,
          fileId: resource.fileId,
          isFolder: resource.isFolder,
          mapped: findSpaceForSearchResource(spaces, resource)?.name
        })),
        null,
        2
      )
    )

    for (const space of spaces.filter((s) => s.driveType === 'project')) {
      try {
        const root = await dav.getFileInfo(space, { path: '/' })
        console.log('project root', space.name, {
          path: root.path,
          name: root.name,
          fileId: root.fileId,
          spaceId: space.id
        })
        for (const sidecarPath of [`/.${root.name || space.name}.jsco`]) {
          try {
            const body = (await dav.getFileContents(space, { path: sidecarPath })).body
            console.log('found sidecar', space.name, sidecarPath, body.slice(0, 120))
          } catch {
            console.log('missing sidecar', space.name, sidecarPath)
          }
        }
      } catch (error) {
        console.log('project root failed', space.name, String(error))
      }
    }

    const api = new WebdavSidecarDashboardStorage(dav)
    const result = await api.listThreads(spaces, { status: 'all', answered: 'all' })
    console.log(
      'dashboard entries',
      JSON.stringify(
        result.entries.map((entry) => ({
          space: entry.space.name,
          driveType: entry.space.driveType,
          targetName: entry.target.name,
          targetPath: entry.target.path,
          resourceType: entry.target.resourceType,
          threadId: entry.thread.id
        })),
        null,
        2
      )
    )

    expect(result.total).toBeGreaterThan(0)

    const projectEntries = result.entries.filter((entry) => entry.space.driveType === 'project')
    const spaceTypeEntries = result.entries.filter((entry) => entry.target.resourceType === 'space')

    expect(projectEntries.length + spaceTypeEntries.length).toBeGreaterThanOrEqual(1)
  })
})
