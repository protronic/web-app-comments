import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import { relativizeMountpointPath } from '../../src/utils/mountpointPaths'

describe('relativizeMountpointPath', () => {
  const shareMount = mock<SpaceResource>({
    driveType: 'mountpoint',
    name: 'Share'
  })

  it('strips the mount name prefix from source paths', () => {
    expect(relativizeMountpointPath(shareMount, '/Share')).toBe('/')
    expect(relativizeMountpointPath(shareMount, '/Share/Neue Datei.txt')).toBe('/Neue Datei.txt')
  })

  it('keeps already relative paths unchanged', () => {
    expect(relativizeMountpointPath(shareMount, '/Neue Datei.txt')).toBe('/Neue Datei.txt')
    expect(relativizeMountpointPath(shareMount, '/')).toBe('/')
  })

  it('ignores non-mountpoint spaces', () => {
    const personal = mock<SpaceResource>({ driveType: 'personal', name: 'Personal' })

    expect(relativizeMountpointPath(personal, '/Share')).toBe('/Share')
  })
})
