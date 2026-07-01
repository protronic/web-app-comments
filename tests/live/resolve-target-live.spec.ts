// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { COMMENT_TAG } from '../../src/constants/tags'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('dashboard target resolution', () => {
  it('loads tagged comment threads without hanging', async () => {
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
    const started = Date.now()
    const result = await api.listThreads(spaces, {
      tags: [COMMENT_TAG],
      status: 'all',
      answered: 'all'
    })
    const elapsed = Date.now() - started

    expect(elapsed).toBeLessThan(10_000)
    expect(result.total).toBeGreaterThanOrEqual(0)
  })
})
