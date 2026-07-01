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

export async function syncCommentedTag(
  graph: CommentTagsGraphClient | undefined,
  webdav: WebDAV,
  target: CommentTarget,
  document: CommentDocument
): Promise<void> {
  if (!graph) {
    return
  }

  const resourceId = await resolveGraphResourceId(webdav, target)

  if (!resourceId) {
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

function escapeTagTerm(tag: string): string {
  if (/[\s:"()]/.test(tag)) {
    return `"${tag.replace(/"/g, '\\"')}"`
  }

  return tag
}
