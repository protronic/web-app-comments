// @vitest-environment node

import { createRequire } from 'node:module'
import { graph, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import { collectUserIdentityKeys } from '../../src/utils/userIdentity'

const require = createRequire(import.meta.url)
const axios = require(
  require.resolve('axios', {
    paths: [require.resolve('@opencloud-eu/web-client')]
  })
)

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('share folder link diagnostic', () => {
  it('reports navigation targets for Share folder entries', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const g = graph(
      `${baseUrl}/graph`,
      axios.create({
        baseURL: `${baseUrl}/graph`,
        auth: { username: 'dennis', password: 'dennis' },
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
    )
    const dav = webdav(baseUrl, () => ({
      Authorization: `Basic ${Buffer.from('dennis:dennis').toString('base64')}`
    }))

    const me = await (
      await fetch(`${baseUrl}/graph/v1.0/me`, {
        headers: { Authorization: `Basic ${Buffer.from('dennis:dennis').toString('base64')}` }
      })
    ).json()
    const userIds = collectUserIdentityKeys(me)
    const drives = await g.drives.listMyDrives({}, {})
    const api = new WebdavSidecarDashboardStorage(dav, g)
    const result = await api.listThreads(drives, {
      status: 'all',
      answered: 'all',
      user: 'me',
      userIds,
      tags: ['Kommentiert']
    })

    const shareEntries = result.entries.filter((entry) => entry.target.name === 'Share')

    for (const entry of shareEntries) {
      const space = drives.find((drive) => drive.id === entry.space.id)

      console.log(
        JSON.stringify(
          {
            target: entry.target,
            space: entry.space,
            driveAliasAndItemRoot: space?.getDriveAliasAndItem?.({ path: '' }),
            driveAliasAndItemTarget: space?.getDriveAliasAndItem?.({ path: entry.target.path })
          },
          null,
          2
        )
      )
    }

    expect(shareEntries.length).toBeGreaterThan(0)
    expect(shareEntries.every((entry) => entry.target.path === '/')).toBe(true)
  })
})
