import { SpaceResource } from '@opencloud-eu/web-client'
import { isGraphResourceId } from './commentTags'
import { DashboardTargetSummary } from '../types'

type SpaceRootSource = Pick<SpaceResource, 'id' | 'fileId'> & {
  root?: { fileId?: string | null }
}

type SpaceRootTarget = Pick<DashboardTargetSummary, 'fileId' | 'id'>

export function deriveSpaceRootFileId(
  space: SpaceRootSource,
  target?: SpaceRootTarget
): string | undefined {
  return deriveSpaceScrollToFileId(space, target)
}

export function deriveSpaceNavigationFileId(
  space: Pick<SpaceResource, 'id'>
): string | undefined {
  return deriveSpaceRootFileIdFromSpaceId(space.id)
}

export function deriveSpaceScrollToFileId(
  space: SpaceRootSource,
  target?: SpaceRootTarget
): string | undefined {
  for (const candidate of collectSpaceScrollToFileIdCandidates(space, target)) {
    if (isGraphResourceId(candidate)) {
      return candidate
    }
  }

  return deriveSpaceNavigationFileId(space)
}

function collectSpaceScrollToFileIdCandidates(
  space: SpaceRootSource,
  target?: SpaceRootTarget
): string[] {
  return [
    typeof space.fileId === 'string' ? space.fileId : undefined,
    typeof space.root?.fileId === 'string' ? space.root.fileId : undefined,
    target?.fileId,
    target?.id?.includes('!') ? target.id : undefined
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function deriveSpaceRootFileIdFromSpaceId(spaceId: string | undefined): string | undefined {
  if (!spaceId) {
    return undefined
  }

  if (isGraphResourceId(spaceId)) {
    return spaceId
  }

  if (!spaceId.includes('$')) {
    return undefined
  }

  const storageSegment = spaceId.split('$').pop()

  if (!storageSegment) {
    return undefined
  }

  const derived = `${spaceId}!${storageSegment}`

  return isGraphResourceId(derived) ? derived : undefined
}
