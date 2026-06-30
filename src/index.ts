import '@opencloud-eu/extension-sdk/tailwind.css'
import translations from '../l10n/translations.json'
import {
  AppMenuItemExtension,
  defineWebApplication,
  Extension,
  SidebarPanelExtension,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import { computed, markRaw, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import CommentsPanel from './components/CommentsPanel.vue'

const applicationId = 'comments'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()
    const sidebarExtensions = useExtensions()

    const routes = [
      {
        path: '/dashboard',
        name: `${applicationId}-dashboard`,
        component: () => import('./views/CommentsDashboard.vue'),
        meta: {
          authContext: 'user',
          title: $gettext('Comment dashboard'),
          patchCleanPath: true
        }
      }
    ]

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      if (!userStore.user) {
        return []
      }

      return [
        {
          id: `app.${applicationId}.dashboard.menuItem`,
          type: 'appMenuItem',
          label: () => $gettext('Comment dashboard'),
          icon: 'chat-1',
          path: urlJoin(applicationId, 'dashboard'),
          color: 'white'
        }
      ]
    })

    const extensions = computed<Extension[]>(() => [
      ...unref(sidebarExtensions),
      ...unref(menuItems)
    ])

    return {
      appInfo: {
        name: $gettext('Comments'),
        id: applicationId,
        icon: 'chat-1',
        iconFillType: 'line'
      },
      translations,
      routes,
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
