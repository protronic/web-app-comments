// @vitest-environment node

import { createRequire } from 'node:module'
import { graph, webdav } from '@opencloud-eu/web-client'
import { isIndividuallySharedCommentTarget, resolveIndividualShareViaGraph } from '../../src/utils/individuallySharedFile'

const require = createRequire(import.meta.url)
const axios = require(
  require.resolve('axios', {
    paths: [require.resolve('@opencloud-eu/web-client')]
  })
)

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('individual share hint detection diagnostic', () => {
  it('logs resource share metadata on test.oc', async () => {
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
      const roles = Object.fromEntries(
        (await g.permissions.listRoleDefinitions()).map((role) => [role.id, role])
      )

      for (const space of drives) {
        const listing = await dav.listFiles(space, { path: '/' }, { depth: 1 })

        for (const resource of listing.children || []) {
          if (!resource.name?.match(/\.(md|txt)$/) && resource.name !== 'Share') {
            continue
          }

          let directShares = 0
          let graphHint = false

          if (resource.fileId && (space.driveType === 'personal' || space.driveType === 'project')) {
            try {
              const driveId = resource.fileId.split('!')[0]
              const perms = await g.permissions.listPermissions(driveId, resource.fileId, roles)
              directShares = perms.shares.filter((share) => 'sharedWith' in share).length
              graphHint = await resolveIndividualShareViaGraph({ permissions: g.permissions }, space, resource)
            } catch {
              directShares = -1
            }
          }

          report.push(
            JSON.stringify({
              user,
              space: `${space.driveType}:${space.name}`,
              resource: resource.name,
              path: resource.path,
              shareTypes: resource.shareTypes,
              isMounted: resource.isMounted?.(),
              isReceivedShare: resource.isReceivedShare?.(),
              isShareRoot: resource.isShareRoot?.(),
              directShares,
              hint: isIndividuallySharedCommentTarget(space, resource),
              graphHint
            })
          )
        }

        if (space.driveType === 'personal' || space.driveType === 'project') {
          const shareFolder = (listing.children || []).find(
            (entry) => entry.name === 'Share' && entry.isFolder
          )

          if (shareFolder) {
            const nested = await dav.listFiles(space, { path: shareFolder.path || '/Share' }, { depth: 1 })

            for (const resource of nested.children || []) {
              if (!resource.name?.match(/\.(md|txt)$/)) {
                continue
              }

              let directShares = 0
              let graphHint = false

              if (resource.fileId) {
                try {
                  const driveId = resource.fileId.split('!')[0]
                  const perms = await g.permissions.listPermissions(driveId, resource.fileId, roles)
                  directShares = perms.shares.filter((share) => 'sharedWith' in share).length
                  graphHint = await resolveIndividualShareViaGraph({ permissions: g.permissions }, space, resource)
                } catch {
                  directShares = -1
                }
              }

              report.push(
                JSON.stringify({
                  user,
                  space: `${space.driveType}:${space.name}`,
                  resource: resource.name,
                  path: resource.path,
                  shareTypes: resource.shareTypes,
                  isMounted: resource.isMounted?.(),
                  isReceivedShare: resource.isReceivedShare?.(),
                  isShareRoot: resource.isShareRoot?.(),
                  directShares,
                  hint: isIndividuallySharedCommentTarget(space, resource),
                  graphHint
                })
              )
            }
          }
        }
      }
    }

    console.log(report.join('\n'))
    expect(report.length).toBeGreaterThan(0)
  })
})
