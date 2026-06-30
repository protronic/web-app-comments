import '@opencloud-eu/extension-sdk/tailwind.css'
import translations from '../l10n/translations.json'
import {
  defineWebApplication,
  Extension,
  SidebarPanelExtension,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { computed, markRaw } from 'vue'
import { useGettext } from 'vue3-gettext'
import CommentsPanel from './components/CommentsPanel.vue'

const applicationId = 'comments'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const extensions = useExtensions()

    return {
      appInfo: {
        name: $gettext('Comments'),
        id: applicationId,
        icon: 'chat-1',
        iconFillType: 'line'
      },
      translations,
      extensions
    }
  }
})

export function useExtensions() {
  const { $gettext } = useGettext()
  const userStore = useUserStore()

  return computed<Extension[]>(() => {
    if (!userStore.user) return []

    return [
      {
        id: 'com.github.opencloud-eu.web-extensions.comments.sidebar-panel',
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: 'comments',
          icon: 'chat-1',
          iconFillType: 'line',
          title: () => $gettext('Comments'),
          component: markRaw(CommentsPanel),
          componentAttrs: (panelContext) => ({
            panelContext
          }),
          isVisible: ({ items }) => items?.length === 1
        }
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>
    ]
  })
}
