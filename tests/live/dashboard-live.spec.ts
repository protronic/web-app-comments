// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('dashboard live against test.oc', () => {
  it('loads personal and project space comment threads', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const auth = Buffer.from('admin:admin').toString('base64')
    const headers = () => ({ Authorization: `Basic ${auth}` })
    const dav = webdav(baseUrl, headers)

    const response = await fetch(`${baseUrl}/graph/v1.0/me/drives`, { headers: headers() })
    const { value: drives } = (await response.json()) as { value: Array<Record<string, unknown>> }
    const spaces = drives
      .filter((drive) => drive.driveType === 'personal' || drive.driveType === 'project')
      .map((drive) => buildSpace({ ...drive, serverUrl: baseUrl } as never))

    const api = new WebdavSidecarDashboardStorage(dav)
    const result = await api.listThreads(spaces, { status: 'all', answered: 'all' })

    expect(result.total).toBeGreaterThanOrEqual(3)

    const projectEntries = result.entries.filter((entry) => entry.space.driveType === 'project')
    expect(projectEntries.length).toBeGreaterThanOrEqual(1)
    expect(projectEntries[0]?.target.name).toBe('New space')
  })
})
