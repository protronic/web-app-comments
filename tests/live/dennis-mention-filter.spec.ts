// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'
import { createInitialDashboardQuery } from '../../src/composables/useCommentsDashboard'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import { collectUserIdentityKeys } from '../../src/utils/userIdentity'
import { threadInvolvesUser } from '../../src/utils/mentions'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('dashboard mention filter for Dennis', () => {
  it('includes threads where Dennis was @mentioned under user=me', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const auth = Buffer.from('dennis:dennis').toString('base64')
    const headers = () => ({ Authorization: `Basic ${auth}` })
    const dav = webdav(baseUrl, headers)

    const me = await (await fetch(`${baseUrl}/graph/v1.0/me`, { headers: headers() })).json()
    const userIds = collectUserIdentityKeys(me)

    const response = await fetch(`${baseUrl}/graph/v1.0/me/drives`, { headers: headers() })
    const { value: drives } = (await response.json()) as {
      value: Array<Record<string, unknown>>
    }
    const spaces = drives
      .filter(
        (drive) =>
          drive.driveType === 'personal' ||
          drive.driveType === 'project' ||
          drive.driveType === 'mountpoint'
      )
      .map((drive) => buildSpace({ ...drive, serverUrl: baseUrl } as never))

    const api = new WebdavSidecarDashboardStorage(dav)
    const all = await api.listThreads(spaces, {
      status: 'all',
      answered: 'all',
      tags: ['Kommentiert']
    })

    const mentionThreads = all.entries.filter((entry) =>
      threadInvolvesUser(entry.thread, userIds)
    )

    expect(mentionThreads.length).toBeGreaterThan(0)

    const pollQuery = await api.listThreads(spaces, {
      status: 'all',
      answered: 'all',
      user: 'me',
      userIds,
      tags: ['Kommentiert']
    })

    expect(pollQuery.entries.length).toBeGreaterThan(0)
    expect(pollQuery.entries.some((entry) => threadInvolvesUser(entry.thread, userIds))).toBe(
      true
    )

    const initialQuery = await api.listThreads(spaces, {
      ...createInitialDashboardQuery(),
      userIds
    })

    expect(initialQuery.entries.length).toBeGreaterThan(0)
    expect(
      initialQuery.entries.some((entry) => threadInvolvesUser(entry.thread, userIds))
    ).toBe(true)
  })
})
