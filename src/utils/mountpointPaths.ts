import { SpaceResource } from '@opencloud-eu/web-client'

export function relativizeMountpointPath(
  space: Pick<SpaceResource, 'driveType' | 'name'>,
  path: string
): string {
  if (space.driveType !== 'mountpoint' || !path || path === '/') {
    return path
  }

  const mountName = space.name?.trim()

  if (!mountName) {
    return path
  }

  const segments = path.replace(/^\//, '').split('/').filter(Boolean)

  if (segments.length === 0 || segments[0] !== mountName) {
    return path
  }

  const rest = segments.slice(1)

  return rest.length === 0 ? '/' : `/${rest.join('/')}`
}
