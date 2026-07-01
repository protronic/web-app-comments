// @vitest-environment node

import { createRequire } from 'node:module'
import { graph, webdav } from '@opencloud-eu/web-client'
import { WebdavSidecarCommentStorage } from '../../src/storage/WebdavSidecarCommentStorage'
import { createCommentTarget } from '../../src/utils/target'

const require = createRequire(import.meta.url)
const axios = require(
  require.resolve('axios', {
    paths: [require.resolve('@opencloud-eu/web-client')]
  })
)

const LIVE = process.env.LIVE_DASHBOARD === '1'

describe.runIf(LIVE)('sidecar permission sync', () => {
  it('copies collaborator shares from the source file to the .jsco sidecar', async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const baseUrl = 'https://test.oc:9200'
    const axiosClient = axios.create({
      baseURL: `${baseUrl}/graph`,
      auth: { username: 'admin', password: 'admin' },
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    const graphClient = graph(`${baseUrl}/graph`, axiosClient)
    const dav = webdav(baseUrl, () => ({
      Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}`
    }))

    const drives = (await graphClient.drives.listMyDrives({}, {})).filter(
      (drive) => drive.driveType === 'personal'
    )
    const space = drives[0]
    const listing = await dav.listFiles(space, { path: '/' }, { depth: 1 })
    const file = listing.children?.find((entry) => entry.name === 'Neue Datei.md')

    expect(file).toBeTruthy()

    const target = createCommentTarget(space, file!)
    const storage = new WebdavSidecarCommentStorage(dav, {
      tags: graphClient.tags,
      permissions: graphClient.permissions
    })

    const threads = await storage.list(target)

    if (threads.length === 0) {
      await storage.createThread(target, {
        body: 'Sidecar permission sync live test',
        format: 'markdown',
        author: { id: 'admin', displayName: 'Admin' }
      })
    } else {
      await storage.replyToThread(target, threads[0].id, {
        body: `Sidecar permission sync live test ${Date.now()}`,
        format: 'markdown',
        author: { id: 'admin', displayName: 'Admin' }
      })
    }

    const sidecar = await dav.getFileInfo(space, { path: '/.Neue Datei.md.jsco' })
    const driveId = sidecar.fileId.split('!')[0]
    const roleDefinitions = await graphClient.permissions.listRoleDefinitions()
    const graphRoles = Object.fromEntries(roleDefinitions.map((role) => [role.id, role]))
    const sourcePermissions = await graphClient.permissions.listPermissions(
      driveId,
      file!.fileId,
      graphRoles
    )
    const sidecarPermissions = await graphClient.permissions.listPermissions(
      driveId,
      sidecar.fileId,
      graphRoles
    )

    const sourceCollaborators = sourcePermissions.shares
      .filter((share) => 'sharedWith' in share && share.sharedWith?.id)
      .map((share) => share.sharedWith.id)

    expect(sourceCollaborators.length).toBeGreaterThan(0)

    for (const collaboratorId of sourceCollaborators) {
      expect(
        sidecarPermissions.shares.some(
          (share) => 'sharedWith' in share && share.sharedWith?.id === collaboratorId
        )
      ).toBe(true)
    }
  })
})
