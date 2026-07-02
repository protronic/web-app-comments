import { Resource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { COMMENT_TAG } from '../constants/tags'
import { CommentDocument, CommentTarget } from '../types'

export interface CommentTagsGraphClient {
  assignTags(data: { resourceId: string; tags: string[] }): Promise<void>
  unassignTags(data: { resourceId: string; tags: string[] }): Promise<void>
}

export function buildTagSearchPattern(tags: string[]): string {
  const selected = tags.length > 0 ? tags : [COMMENT_TAG]

  if (selected.length === 1) {
    return `tag:${escapeTagTerm(selected[0])}`
  }

  return selected.map((tag) => `tag:${escapeTagTerm(tag)}`).join(' AND ')
}

export function isGraphResourceId(id: unknown): id is string {
  return typeof id === 'string' && id.includes('$') && id.includes('!')
}

export function getGraphResourceId(target: CommentTarget): string | undefined {
  const candidates = [target.resource.fileId, target.resource.id, target.id]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  return candidates.find(isGraphResourceId)
}

export async function resolveGraphResourceId(
  webdav: WebDAV,
  target: CommentTarget
): Promise<string | undefined> {
  const direct = getGraphResourceId(target)

  if (direct) {
    return direct
  }

  try {
    const resource = await webdav.getFileInfo(target.space, {
      path: target.path,
      fileId: target.resource.fileId || target.resource.id
    })
    const resolved = resource.fileId || resource.id

    return isGraphResourceId(resolved) ? resolved : undefined
  } catch {
    return undefined
  }
}

export function hasCommentThreads(document: CommentDocument): boolean {
  return document.threads.length > 0
}

export function getGraphResourceIdFromResource(
  resource: Pick<Resource, 'fileId' | 'id'> | undefined
): string | undefined {
  const candidates = [resource?.fileId, resource?.id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )

  return candidates.find(isGraphResourceId)
}

export async function syncResourceCommentedTag(
  graph: CommentTagsGraphClient | undefined,
  resourceId: string | undefined,
  document: CommentDocument
): Promise<void> {
  if (!graph || !resourceId) {
    return
  }

  try {
    if (hasCommentThreads(document)) {
      await graph.assignTags({ resourceId, tags: [COMMENT_TAG] })
      return
    }

    await graph.unassignTags({ resourceId, tags: [COMMENT_TAG] })
  } catch {
    // Tag sync is best-effort and must not block comment storage.
  }
}

export async function syncSidecarCommentedTag(
  graph: CommentTagsGraphClient | undefined,
  sidecarResource: Pick<Resource, 'fileId' | 'id'> | undefined,
  document: CommentDocument
): Promise<void> {
  await syncResourceCommentedTag(graph, getGraphResourceIdFromResource(sidecarResource), document)
}

export async function syncCommentedTag(
  graph: CommentTagsGraphClient | undefined,
  webdav: WebDAV,
  target: CommentTarget,
  document: CommentDocument
): Promise<void> {
  const resourceId = graph ? await resolveGraphResourceId(webdav, target) : undefined

  await syncResourceCommentedTag(graph, resourceId, document)
}

function escapeTagTerm(tag: string): string {
  if (/[\s:"()]/.test(tag)) {
    return `"${tag.replace(/"/g, '\\"')}"`
  }

  return tag
}
