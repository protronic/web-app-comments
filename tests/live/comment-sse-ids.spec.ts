// @vitest-environment node

import { createRequire } from 'node:module'
import { graph, webdav } from '@opencloud-eu/web-client'
import {
  collectCommentTargetFileIds,
  resolveCommentSidecarFileIds,
  sseEventMatchesCommentTarget
} from '../../src/utils/commentSse'
import { createCommentTarget } from '../../src/utils/target'

const require = createRequire(import.meta.url)
const axios = require(
  require.resolve('axios', {
    paths: [require.resolve('@opencloud-eu/web-client')]
  })
)

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('comment SSE file id diagnostic', () => {
  it('logs watched ids for admin and dennis on shared files', async () => {
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

    const report: string[] = []

    for (const [user, password] of [
      ['admin', 'admin'],
      ['dennis', 'dennis']
    ] as const) {
      const g = mkGraph(user, password)
      const dav = mkDav(user, password)
      const drives = (await g.drives.listMyDrives({}, {})).filter((drive) =>
        ['personal', 'project', 'mountpoint'].includes(drive.driveType)
      )

      for (const space of drives) {
        const listing = await dav.listFiles(space, { path: '/' }, { depth: 1 })

        for (const resource of listing.children || []) {
          if (!resource.name?.match(/\.(md|txt)$/)) {
            continue
          }

          const target = createCommentTarget(space, resource)
          const syncIds = collectCommentTargetFileIds(target)
          const watchedIds = await resolveCommentSidecarFileIds(dav, target)

          report.push(
            JSON.stringify({
              user,
              space: `${space.driveType}:${space.name}`,
              resource: resource.name,
              path: resource.path,
              fileId: resource.fileId,
              id: resource.id,
              remoteItemId: resource.remoteItemId,
              storageId: resource.storageId,
              syncIds: [...syncIds],
              watchedIds: [...watchedIds]
            })
          )
        }
      }
    }

    console.log(report.join('\n'))
    expect(report.length).toBeGreaterThan(0)
  })

  it('shows whether owner sidecar id matches recipient watched ids', async () => {
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

    const adminDav = mkDav('admin', 'admin')
    const dennisDav = mkDav('dennis', 'dennis')
    const adminGraph = mkGraph('admin', 'admin')
    const adminDrives = (await adminGraph.drives.listMyDrives({}, {})).filter(
      (drive) => drive.driveType === 'personal'
    )
    const dennisDrives = (await adminGraph.drives.listMyDrives({}, {})).filter(
      (drive) => drive.driveType === 'mountpoint'
    )

    void dennisDrives

    const adminSpace = adminDrives[0]
    const targets = [
      ...(await adminDav.listFiles(adminSpace, { path: '/' }, { depth: 1 })).children || []
    ]

    const shareFolder = targets.find((entry) => entry.name === 'Share' && entry.isFolder)

    if (shareFolder) {
      targets.push(
        ...((await adminDav.listFiles(adminSpace, { path: shareFolder.path || '/Share' }, { depth: 1 }))
          .children || [])
      )
    }

    const adminWatchedByFile = new Map<string, Set<string>>()

    for (const resource of targets) {
      if (!resource.name?.match(/\.(md|txt)$/)) {
        continue
      }

      const adminTarget = createCommentTarget(adminSpace, resource)
      adminWatchedByFile.set(
        resource.path || resource.name,
        await resolveCommentSidecarFileIds(adminDav, adminTarget)
      )
    }

    const dennisGraph = mkGraph('dennis', 'dennis')
    const dennisMountpoints = (await dennisGraph.drives.listMyDrives({}, {})).filter(
      (drive) => drive.driveType === 'mountpoint'
    )

    const dennisBySpace = new Map<string, Set<string>>()

    for (const space of dennisMountpoints) {
      const listing = await dennisDav.listFiles(space, { path: '/' }, { depth: 1 })

      for (const resource of listing.children || []) {
        if (!resource.name?.match(/\.(md|txt)$/)) {
          continue
        }

        const dennisTarget = createCommentTarget(space, resource)
        const dennisWatched = await resolveCommentSidecarFileIds(dennisDav, dennisTarget)
        dennisBySpace.set(`${space.name}/${resource.name}`, dennisWatched)
      }
    }

    console.log('CROSS_MATCH_START')
    for (const [adminPath, adminWatched] of adminWatchedByFile) {
      for (const [spaceName, dennisWatched] of dennisBySpace) {
        for (const ownerSidecarId of adminWatched) {
          console.log(
            JSON.stringify({
              adminPath,
              ownerSidecarId,
              spaceName,
              dennisMatches: sseEventMatchesCommentTarget({ itemid: ownerSidecarId }, dennisWatched),
              adminMatches: sseEventMatchesCommentTarget({ itemid: ownerSidecarId }, adminWatched),
              dennisWatched: [...dennisWatched],
              adminWatched: [...adminWatched]
            })
          )
        }
      }
    }
    console.log('CROSS_MATCH_END')

    expect(adminWatchedByFile.size).toBeGreaterThan(0)
  })
})
