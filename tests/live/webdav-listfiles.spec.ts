// @vitest-environment node

import { buildSpace, webdav } from '@opencloud-eu/web-client'

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('webdav listFiles exposes .conflu folder', () => {
  it('lists .conflu in project root and Testordner', async () => {
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

    const personal = spaces.find((space) => space.driveType === 'personal')
    const project = spaces.find((space) => space.driveType === 'project')

    expect(personal).toBeDefined()
    expect(project).toBeDefined()

    const projectRoot = await dav.listFiles(project!, { path: '/' }, { depth: 1 })
    expect(projectRoot.children?.some((child) => child.name === '.conflu')).toBe(true)

    const personalRoot = await dav.listFiles(personal!, { path: '/' }, { depth: 1 })
    expect(personalRoot.children?.some((child) => child.name === '.conflu')).toBe(false)

    const testordner = personalRoot.children?.find((child) => child.name === 'Testordner')
    expect(testordner).toBeDefined()

    const testordnerListing = await dav.listFiles(
      personal!,
      { path: testordner!.path || '/Testordner' },
      { depth: 1 }
    )
    expect(testordnerListing.children?.some((child) => child.name === '.conflu')).toBe(true)
  })
})
