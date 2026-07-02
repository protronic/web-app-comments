import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { createLocationSpaces } from '@opencloud-eu/web-pkg'
import type { LocationQueryRaw, RouteLocationNamedRaw, Router } from 'vue-router'
import { DashboardTargetSummary, DashboardThreadEntry } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { isGraphResourceId } from './commentTags'
import { buildDashboardResource } from './dashboardResource'
import { deriveSpaceNavigationFileId, deriveSpaceScrollToFileId } from './spaceRootFileId'
import { relativizeMountpointPath } from './mountpointPaths'

/** Must match `panel.name` in `src/index.ts`. */
export const COMMENTS_SIDEBAR_PANEL = 'comments'

type DashboardFileActionOptions = {
  space: SpaceResource
  resources: Resource[]
  omitSystemActions?: boolean
}

export interface DashboardFileActions {
  getDefaultAction: (options: DashboardFileActionOptions) => unknown
  triggerDefaultAction: (options: DashboardFileActionOptions) => void
}

export function openDashboardTarget(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>,
  router: Router,
  fileActions?: DashboardFileActions
): void {
  if (entry.target.resourceType === 'file' && fileActions) {
    if (openDashboardTargetInEditor(space, entry, router, fileActions)) {
      return
    }
  }

  openDashboardTargetInFiles(space, entry, router)
}

export function openDashboardTargetInFiles(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>,
  router: Router
): void {
  void router.push(buildOpenInFilesLocation(space, entry))
}

export function openDashboardTargetInEditor(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>,
  _router: Router,
  fileActions: DashboardFileActions,
  openWithDefaultEditor?: (
    space: SpaceResource,
    target: DashboardTargetSummary
  ) => boolean
): boolean {
  if (entry.target.resourceType !== 'file') {
    return false
  }

  if (openWithDefaultEditor?.(space, entry.target)) {
    return true
  }

  const options = buildFileActionOptions(space, entry)
  const action = fileActions.getDefaultAction(options)

  if (!action) {
    return false
  }

  fileActions.triggerDefaultAction(options)
  return true
}

export function getOpenTargetLabel(
  translate: (message: string) => string,
  target: DashboardTargetSummary
): string {
  switch (target.resourceType) {
    case 'space':
      return translate(msg.openSpace)
    case 'folder':
      return translate(msg.openFolder)
    default:
      return translate(msg.openFile)
  }
}

export function getSelectFileInFilesLabel(translate: (message: string) => string): string {
  return translate(msg.selectFileInFiles)
}

export function buildOpenTargetLocation(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>
): RouteLocationNamedRaw {
  return buildFilesViewTargetLocation(space, entry)
}

export function buildOpenInFilesLocation(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>
): RouteLocationNamedRaw {
  return buildFilesViewTargetLocation(space, entry)
}

export function buildFilesViewTargetLocation(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>
): RouteLocationNamedRaw {
  const path = getFilesViewDrivePath(space, entry.target)

  const location: RouteLocationNamedRaw = {
    params: {
      driveAliasAndItem: space.getDriveAliasAndItem({ path })
    }
  }

  const { fileId, scrollToFileId } = resolveFilesViewQueryParams(space, entry.target)

  location.query = {
    ...buildCommentSidebarQuery({
      fileId,
      scrollToFileId
    })
  }

  return createLocationSpaces('files-spaces-generic', location)
}

export function buildCommentSidebarQuery(options: {
  fileId?: string
  scrollToFileId?: string
} = {}): LocationQueryRaw {
  const query: LocationQueryRaw = {
    details: COMMENTS_SIDEBAR_PANEL
  }

  if (options.fileId) {
    query.fileId = options.fileId
  }

  if (options.scrollToFileId) {
    query.scrollTo = options.scrollToFileId
  }

  return query
}

export function buildPrivateLinkLocation(privateLink?: string): RouteLocationNamedRaw | undefined {
  const fileId = extractPrivateLinkFileId(privateLink)

  if (!fileId) {
    return undefined
  }

  return {
    name: 'resolvePrivateLink',
    params: { fileId },
    query: buildCommentSidebarQuery()
  }
}

export function extractPrivateLinkFileId(privateLink?: string): string | undefined {
  if (!privateLink) {
    return undefined
  }

  try {
    const url = new URL(privateLink, 'https://opencloud.local')
    const match = url.pathname.match(/^\/f\/(.+)$/)

    if (!match?.[1]) {
      return undefined
    }

    return decodeURIComponent(match[1])
  } catch {
    return undefined
  }
}

export function getFilesViewDrivePath(
  space: SpaceResource,
  target: DashboardTargetSummary
): string {
  if (target.resourceType === 'space') {
    return ''
  }

  const path = getOpenTargetPath(space, target)

  if (target.resourceType !== 'file') {
    return path
  }

  const graphFileId = getTargetGraphFileId(target)

  if (!graphFileId) {
    return path
  }

  if (!path || path === '/') {
    return ''
  }

  const slashIndex = path.lastIndexOf('/')

  if (slashIndex <= 0) {
    return ''
  }

  return path.slice(0, slashIndex)
}

export function getOpenTargetPath(space: SpaceResource, target: DashboardTargetSummary): string {
  if (target.resourceType === 'space') {
    return ''
  }

  let path = relativizeMountpointPath(space, target.path)

  if (path === '/') {
    path = ''
  }

  if (!path && target.resourceType === 'folder') {
    path = deriveFolderNavigationPath(space, target)
  }

  return path
}

export function getOpenTargetFileId(
  space: SpaceResource,
  target: DashboardTargetSummary
): string | undefined {
  if (target.resourceType === 'space') {
    return getSpaceRootFileId(space, target)
  }

  const candidate = target.fileId || target.id

  if (!isGraphResourceId(candidate)) {
    return undefined
  }

  if (target.resourceType === 'folder' && getOpenTargetPath(space, target)) {
    return undefined
  }

  return candidate
}

export function getCommentSidebarScrollToFileId(
  space: SpaceResource,
  target: DashboardTargetSummary
): string | undefined {
  if (target.resourceType === 'space') {
    return getSpaceRootFileId(space, target)
  }

  return getOpenTargetFileId(space, target) ?? getTargetGraphFileId(target)
}

function buildFileActionOptions(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'target'>
): DashboardFileActionOptions {
  return {
    space,
    resources: [buildDashboardResource(space, entry.target)],
    omitSystemActions: true
  }
}

function resolveFilesViewQueryParams(
  space: SpaceResource,
  target: DashboardTargetSummary
): { fileId?: string; scrollToFileId?: string } {
  if (target.resourceType === 'space' || target.resourceType === 'folder') {
    return {
      fileId: getOpenTargetFileId(space, target),
      scrollToFileId: getCommentSidebarScrollToFileId(space, target)
    }
  }

  const targetFileId = getTargetGraphFileId(target)
  const filePath = getOpenTargetPath(space, target)
  const isRootLevelFile = !filePath || filePath === '/'

  if (isRootLevelFile && targetFileId) {
    const spaceRootFileId = deriveSpaceNavigationFileId(space)

    if (spaceRootFileId && spaceRootFileId !== targetFileId) {
      return {
        fileId: spaceRootFileId,
        scrollToFileId: targetFileId
      }
    }
  }

  const parentFileId = getTargetParentFileId(target)

  if (parentFileId && targetFileId && parentFileId !== targetFileId) {
    return {
      fileId: parentFileId,
      scrollToFileId: targetFileId
    }
  }

  if (targetFileId) {
    return {
      fileId: targetFileId,
      scrollToFileId: targetFileId
    }
  }

  return {
    fileId: getOpenTargetFileId(space, target),
    scrollToFileId: getCommentSidebarScrollToFileId(space, target)
  }
}

function getSpaceRootFileId(
  space: SpaceResource,
  target: DashboardTargetSummary
): string | undefined {
  const scrollToFileId = deriveSpaceScrollToFileId(space, target)

  if (scrollToFileId) {
    return scrollToFileId
  }

  return getTargetGraphFileId(target)
}

function getTargetParentFileId(target: DashboardTargetSummary): string | undefined {
  const parentFileId = target.parentFileId

  return isGraphResourceId(parentFileId) ? parentFileId : undefined
}

function getTargetGraphFileId(target: DashboardTargetSummary): string | undefined {
  const candidate = target.fileId || target.id

  return isGraphResourceId(candidate) ? candidate : undefined
}

function deriveFolderNavigationPath(
  space: Pick<SpaceResource, 'driveType' | 'name'>,
  target: Pick<DashboardTargetSummary, 'name' | 'path'>
): string {
  const candidates = [target.path, target.name ? `/${target.name}` : undefined].filter(
    (value): value is string => Boolean(value && value !== '/')
  )

  for (const candidate of candidates) {
    const relativized = relativizeMountpointPath(space, candidate)

    if (relativized && relativized !== '/') {
      return relativized
    }
  }

  return ''
}
