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

export function getGraphResourceId(target: CommentTarget): string | undefined {
  return target.resource.fileId || target.resource.id || undefined
}

export function hasCommentThreads(document: CommentDocument): boolean {
  return document.threads.length > 0
}

export async function syncCommentedTag(
  graph: CommentTagsGraphClient | undefined,
  target: CommentTarget,
  document: CommentDocument
): Promise<void> {
  if (!graph) {
    return
  }

  const resourceId = getGraphResourceId(target)

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
