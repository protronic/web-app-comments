// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import { resolveCommentDocumentTargets } from '../../src/utils/resolveTarget'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('dashboard target resolution', () => {
  it('resolves space-root targets without hanging', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const auth = Buffer.from('admin:admin').toString('base64')
    const headers = () => ({ Authorization: `Basic ${auth}` })
    const dav = webdav(baseUrl, headers)

    const response = await fetch(`${baseUrl}/graph/v1.0/me/drives`, { headers: headers() })
    const { value: drives } = (await response.json()) as { value: Array<Record<string, unknown>> }
    const project = drives
      .filter((drive) => drive.driveType === 'project')
      .map((drive) => buildSpace({ ...drive, serverUrl: baseUrl } as never))[0]

    const api = new WebdavSidecarDashboardStorage(dav)
    const refs = await api['collectDocuments'](project)

    expect(refs.length).toBeGreaterThan(0)

    const started = Date.now()
    const resolved = await resolveCommentDocumentTargets(dav, project, refs)
    const elapsed = Date.now() - started

    expect(elapsed).toBeLessThan(10_000)
    expect(resolved.size).toBeGreaterThan(0)
  })
})
