import { SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentDocument, CommentTarget } from '../types'
import { createEmptyCommentDocument } from './comments'

export const COMMENT_PROPERTY_NAME = 'opencloud-comments-document'

const registeredClients = new WeakSet<WebDAV>()

export interface CommentPropertyHttpClient {
  request(config: {
    method: string
    url: string
    data?: string
    headers?: Record<string, string>
  }): Promise<{ status: number }>
}

export function ensureCommentPropertyRegistered(webdav: WebDAV): void {
  if (registeredClients.has(webdav)) {
    return
  }

  webdav.registerExtraProp(COMMENT_PROPERTY_NAME)
  registeredClients.add(webdav)
}

export async function readCommentDocument(
  webdav: WebDAV,
  target: CommentTarget
): Promise<CommentDocument> {
  ensureCommentPropertyRegistered(webdav)

  try {
    const resource = await webdav.getFileInfo(target.space, {
      path: target.path,
      fileId: target.resource.fileId || target.resource.id
    })
    const raw = resource.extraProps?.[COMMENT_PROPERTY_NAME]

    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return createEmptyCommentDocument(target)
    }

    return normalizeCommentDocument(target, JSON.parse(raw))
  } catch (error) {
    if (isNotFoundError(error)) {
      return createEmptyCommentDocument(target)
    }

    throw error
  }
}

export async function writeCommentDocument(
  webdav: WebDAV,
  http: CommentPropertyHttpClient,
  target: CommentTarget,
  document: CommentDocument
): Promise<void> {
  ensureCommentPropertyRegistered(webdav)

  const davPath = getResourceDavPath(target.space, target.path)
  const response = await http.request({
    method: 'PROPPATCH',
    url: urlJoin('/remote.php/dav', davPath),
    data: buildPropPatchSetBody({
      [COMMENT_PROPERTY_NAME]: JSON.stringify(document, null, 2)
    }),
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  })

  if (response.status !== 207 && response.status !== 200) {
    throw new Error(`Failed to store comment property (HTTP ${response.status}).`)
  }
}

function getResourceDavPath(space: SpaceResource, resourcePath: string): string {
  return urlJoin(space.webDavPath || '', resourcePath)
}

function normalizeCommentDocument(target: CommentTarget, value: unknown): CommentDocument {
  const document = value as Partial<CommentDocument>

  if (!document || document.version !== 1 || !Array.isArray(document.threads)) {
    return createEmptyCommentDocument(target)
  }

  return {
    version: 1,
    target: {
      id: target.id,
      name: target.name,
      path: target.path,
      isFolder: target.isFolder
    },
    threads: document.threads
  }
}

function buildPropPatchSetBody(properties: Record<string, string>): string {
  const propEntries = Object.entries(properties)
    .map(
      ([name, value]) =>
        `<oc:${escapeXmlTagName(name)}>${escapeXmlText(value)}</oc:${escapeXmlTagName(name)}>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propertyupdate xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:set>
    <d:prop>${propEntries}</d:prop>
  </d:set>
</d:propertyupdate>`
}

function escapeXmlTagName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isNotFoundError(error: unknown): boolean {
  const responseStatus = (
    error as { status?: number; statusCode?: number; response?: { status?: number } }
  )?.response?.status
  const statusCode =
    responseStatus ||
    (error as { status?: number; statusCode?: number })?.status ||
    (error as { status?: number; statusCode?: number })?.statusCode
  const message = (error as Error)?.message || ''

  return statusCode === 404 || message.includes('404') || message.includes('Not Found')
}
