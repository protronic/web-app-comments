// @vitest-environment node

import { createRequire } from 'node:module'
import { graph, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import { createCommentTarget, getCommentSidecarReadPaths } from '../../src/utils/target'
import { collectUserIdentityKeys } from '../../src/utils/userIdentity'

const require = createRequire(import.meta.url)
const axios = require(
  require.resolve('axios', {
    paths: [require.resolve('@opencloud-eu/web-client')]
  })
)

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('shared mention access diagnostic', () => {
  it('reports Dennis access to source files and sidecars', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const mkGraph = (user: string, password: string) =>
      graph(
        `${baseUrl}/graph`,
        axios.create({
          baseURL: `${baseUrl}/graph`,
          auth: { username: user, password: password },
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
      )
    const mkDav = (user: string, password: string) =>
      webdav(baseUrl, () => ({
        Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
      }))

    const adminGraph = mkGraph('admin', 'admin')
    const adminDav = mkDav('admin', 'admin')
    const dennisGraph = mkGraph('dennis', 'dennis')
    const dennisDav = mkDav('dennis', 'dennis')

    const me = await (
      await fetch(`${baseUrl}/graph/v1.0/me`, {
        headers: { Authorization: `Basic ${Buffer.from('dennis:dennis').toString('base64')}` }
      })
    ).json()
    const userIds = collectUserIdentityKeys(me)

    const dennisDrives = (await dennisGraph.drives.listMyDrives({}, {})).filter((drive) =>
      ['personal', 'project', 'mountpoint'].includes(drive.driveType)
    )

    const report: string[] = []

    for (const space of dennisDrives.filter((drive) => drive.driveType === 'mountpoint')) {
      try {
        const listing = await dennisDav.listFiles(space, { path: '/' }, { depth: 1 })

        for (const resource of listing.children || []) {
          if (!resource.name?.match(/\.(md|txt|jsco)$/)) {
            continue
          }

          let readable = true

          try {
            await dennisDav.getFileContents(space, { path: resource.path })
          } catch {
            readable = false
          }

          report.push(`${space.name}/${resource.name}: readable=${readable}`)
        }
      } catch (error) {
        report.push(`${space.name}: list failed ${String(error)}`)
      }
    }

    const adminPersonal = (await adminGraph.drives.listMyDrives({}, {})).find(
      (drive) => drive.driveType === 'personal'
    )
    expect(adminPersonal).toBeTruthy()

    const adminListing = await adminDav.listFiles(adminPersonal!, { path: '/' }, { depth: 1 })
    const roleDefinitions = await adminGraph.permissions.listRoleDefinitions()
    const graphRoles = Object.fromEntries(roleDefinitions.map((role) => [role.id, role]))

    for (const resource of adminListing.children || []) {
      if (!resource.name?.match(/\.(md|txt)$/)) {
        continue
      }

      const target = createCommentTarget(adminPersonal!, resource)
      const sidecarPath = getCommentSidecarReadPaths(target)[0]
      let sidecarInfo

      try {
        sidecarInfo = await adminDav.getFileInfo(adminPersonal!, { path: sidecarPath })
      } catch {
        report.push(`${resource.name}: no sidecar yet`)
        continue
      }

      const driveId = resource.fileId.split('!')[0]
      const sourcePerms = await adminGraph.permissions.listPermissions(
        driveId,
        resource.fileId,
        graphRoles
      )
      const sidecarPerms = await adminGraph.permissions.listPermissions(
        driveId,
        sidecarInfo.fileId,
        graphRoles
      )

      const sourceUsers = sourcePerms.shares
        .filter((share) => 'sharedWith' in share)
        .map((share) => share.sharedWith?.displayName)
      const sidecarUsers = sidecarPerms.shares
        .filter((share) => 'sharedWith' in share)
        .map((share) => share.sharedWith?.displayName)

      report.push(
        `${resource.name}: sourceShares=[${sourceUsers.join(', ')}] sidecarShares=[${sidecarUsers.join(', ')}]`
      )
    }

    const api = new WebdavSidecarDashboardStorage(dennisDav, dennisGraph)
    const allTagged = await api.listThreads(dennisDrives, {
      status: 'all',
      answered: 'all',
      tags: ['Kommentiert']
    })
    const poll = await api.listThreads(dennisDrives, {
      status: 'all',
      answered: 'all',
      user: 'me',
      userIds,
      tags: ['Kommentiert']
    })

    report.push(`dennis tagged entries (no user filter): ${allTagged.entries.length}`)
    report.push(...allTagged.entries.map((entry) => `  tagged - ${entry.target.name}`))
    report.push(`dennis mention poll entries: ${poll.entries.length}`)
    report.push(...poll.entries.map((entry) => `  - ${entry.target.name}`))
    report.push(`dennis userIds: ${userIds.join(', ')}`)

    console.log(report.join('\n'))

    expect(report.length).toBeGreaterThan(0)
  })
})
