import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { ApplicationFileExtension } from '@opencloud-eu/web-pkg/dist/src/apps/types'
import { buildDashboardResource } from './dashboardResource'
import { relativizeMountpointPath } from './mountpointPaths'
import { DashboardTargetSummary } from '../types'

type FileActionOptions = {
  space: SpaceResource
  resources: Resource[]
  omitSystemActions?: boolean
}

export interface DefaultFileEditorActions {
  getDefaultAction: (options: FileActionOptions) => { handler?: (options: FileActionOptions) => void } | undefined
  triggerDefaultAction: (options: FileActionOptions) => void
  openEditor: (
    appFileExtension: ApplicationFileExtension,
    space: SpaceResource,
    resource: Resource
  ) => void
}

export function buildEditorResource(
  space: SpaceResource,
  target: DashboardTargetSummary
): Resource {
  const resource = buildDashboardResource(space, target)
  const path = relativizeMountpointPath(space, target.path)

  return {
    ...resource,
    path: path === '/' ? '' : path
  } as Resource
}

export function fileExtensionMatchesResource(
  fileExtension: ApplicationFileExtension,
  resource: Resource
): boolean {
  if (fileExtension.type === 'folder') {
    return Boolean(resource.isFolder)
  }

  if (fileExtension.type === 'file' && resource.isFolder) {
    return false
  }

  if (resource.extension && fileExtension.extension) {
    return resource.extension.toLowerCase() === fileExtension.extension.toLowerCase()
  }

  if (resource.mimeType && fileExtension.mimeType) {
    const resourceMime = resource.mimeType.toLowerCase()
    const extensionMime = fileExtension.mimeType.toLowerCase()

    return (
      resourceMime === extensionMime ||
      resourceMime.split('/')[0] === extensionMime
    )
  }

  return false
}

export function resolveDefaultFileExtension(
  fileExtensions: ApplicationFileExtension[],
  resource: Resource,
  routeExists: (routeName: string) => boolean
): ApplicationFileExtension | undefined {
  const candidates = fileExtensions
    .filter((fileExtension) => {
      const routeName = fileExtension.routeName || fileExtension.app

      if (!routeName || !routeExists(routeName)) {
        return false
      }

      if (!resource.canDownload?.() && !fileExtension.secureView) {
        return false
      }

      if (resource.isInVault && fileExtension.app?.startsWith('external-')) {
        return false
      }

      return fileExtensionMatchesResource(fileExtension, resource)
    })
    .sort((first, second) => {
      if (second.hasPriority !== first.hasPriority && second.hasPriority) {
        return 1
      }

      return 0
    })

  return candidates[0]
}

export function openResourceWithDefaultEditor(
  space: SpaceResource,
  target: DashboardTargetSummary,
  fileExtensions: ApplicationFileExtension[],
  fileActions: DefaultFileEditorActions,
  routeExists: (routeName: string) => boolean
): boolean {
  const resource = buildEditorResource(space, target)
  const options: FileActionOptions = {
    space,
    resources: [resource],
    omitSystemActions: true
  }

  if (fileActions.getDefaultAction(options)) {
    fileActions.triggerDefaultAction(options)
    return true
  }

  const fileExtension = resolveDefaultFileExtension(fileExtensions, resource, routeExists)

  if (!fileExtension) {
    return false
  }

  fileActions.openEditor(fileExtension, space, resource)
  return true
}
