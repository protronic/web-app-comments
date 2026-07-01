// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { findSpaceForSearchResource } from '../../src/utils/dashboardSearch'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('dashboard search resource mapping', () => {
  it('maps tagged resources to Dennis mountpoint spaces', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const auth = Buffer.from('dennis:dennis').toString('base64')
    const headers = () => ({ Authorization: `Basic ${auth}` })
    const dav = webdav(baseUrl, headers)

    const response = await fetch(`${baseUrl}/graph/v1.0/me/drives`, { headers: headers() })
    const { value: drives } = (await response.json()) as {
      value: Array<Record<string, unknown>>
    }
    const allSpaces = drives.map((drive) => buildSpace({ ...drive, serverUrl: baseUrl } as never))
    const dashboardSpaces = allSpaces.filter(
      (space) => space.driveType === 'personal' || space.driveType === 'project'
    )

    const result = await dav.search('tag:Kommentiert', { searchLimit: 50 })

    expect(result.resources.length).toBeGreaterThan(0)
    expect(
      result.resources.map((resource) => ({
        name: resource.name,
        path: resource.path,
        storageId: resource.storageId,
        mapped: findSpaceForSearchResource(dashboardSpaces, resource)?.name ?? null
      }))
    ).toMatchInlineSnapshot()
  })
})
