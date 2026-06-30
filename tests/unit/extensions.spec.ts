import { SidebarPanelExtension, useUserStore } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { useExtensions } from '../../src'

describe('comments app', () => {
  it('registers one sidebar panel for a single selected resource', () => {
    getWrapper((extensions) => {
      const extension = unref(extensions)[0] as SidebarPanelExtension<Resource, Resource, Resource>
      const resource = mock<Resource>()

      expect(extension.type).toBe('sidebarPanel')
      expect(extension.extensionPointIds).toEqual(['global.files.sidebar'])
      expect(extension.panel.isVisible({ items: [resource] })).toBeTruthy()
    })
  })

  it('does not show the sidebar panel for multiple resources', () => {
    getWrapper((extensions) => {
      const extension = unref(extensions)[0] as SidebarPanelExtension<Resource, Resource, Resource>

      expect(extension.panel.isVisible({ items: [mock<Resource>(), mock<Resource>()] })).toBeFalsy()
    })
  })
})

function getWrapper(setup: (extensions: ReturnType<typeof getExtensions>) => void) {
  const mocks = { ...defaultComponentMocks() }

  return getComposableWrapper(
    () => {
      const userStore = useUserStore()
      userStore.user = mock<ReturnType<typeof useUserStore>['user']>({ id: 'einstein' })
      setup(getExtensions())
    },
    {
      mocks,
      provide: mocks
    }
  )
}

function getExtensions() {
  return useExtensions()
}
