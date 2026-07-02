import { unref } from 'vue'
import { SpaceResource } from '@opencloud-eu/web-client'
import {
  useAppsStore,
  useClientService,
  useFileActions,
  useRouter,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { DashboardTargetSummary, DashboardThreadEntry } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { loadDashboardSpaces } from '../utils/dashboardSpaces'
import {
  DashboardFileActions,
  getOpenTargetLabel,
  getSelectFileInFilesLabel,
  openDashboardTargetInEditor,
  openDashboardTargetInFiles
} from '../utils/dashboardNavigation'
import { openResourceWithDefaultEditor } from '../utils/defaultFileEditor'

export function useDashboardTargetNavigation() {
  const router = useRouter()
  const spacesStore = useSpacesStore()
  const clientService = useClientService()
  const appsStore = useAppsStore()
  const { getDefaultAction, triggerDefaultAction, openEditor } = useFileActions()
  const { $gettext } = useCommentGettext()

  const fileActions: DashboardFileActions = {
    getDefaultAction,
    triggerDefaultAction
  }

  const openWithDefaultEditor = (space: SpaceResource, target: DashboardTargetSummary) => {
    return openResourceWithDefaultEditor(
      space,
      target,
      unref(appsStore.fileExtensions),
      { getDefaultAction, triggerDefaultAction, openEditor },
      (routeName) => router.hasRoute(routeName)
    )
  }

  const findSpaceInStore = (entry: Pick<DashboardThreadEntry, 'space'>) => {
    const spaces = unref(spacesStore.spaces) ?? []

    return (
      spaces.find((candidate) => candidate.id === entry.space.id) ??
      spaces.find((candidate) => candidate.driveAlias === entry.space.driveAlias)
    )
  }

  const resolveSpace = async (
    entry: Pick<DashboardThreadEntry, 'space'>
  ): Promise<SpaceResource | undefined> => {
    const existing = findSpaceInStore(entry)

    if (existing) {
      return existing
    }

    await loadDashboardSpaces(spacesStore, clientService.graphAuthenticated)

    return findSpaceInStore(entry)
  }

  const getEditorOpenLabel = (): string => {
    return $gettext(msg.openFile)
  }

  const openInFiles = async (entry: DashboardThreadEntry) => {
    const space = await resolveSpace(entry)

    if (!space) {
      return
    }

    openDashboardTargetInFiles(space, entry, router)
  }

  const openInEditor = async (entry: DashboardThreadEntry) => {
    const space = await resolveSpace(entry)

    if (!space) {
      return false
    }

    return openDashboardTargetInEditor(
      space,
      entry,
      router,
      fileActions,
      openWithDefaultEditor
    )
  }

  const getPrimaryOpenLabel = (target: DashboardTargetSummary) => {
    return getOpenTargetLabel($gettext, target)
  }

  const getFilesViewLabel = () => {
    return getSelectFileInFilesLabel($gettext)
  }

  return {
    fileActions,
    findSpaceInStore,
    getEditorOpenLabel,
    getFilesViewLabel,
    getPrimaryOpenLabel,
    openInEditor,
    openInFiles,
    openWithDefaultEditor,
    resolveSpace
  }
}
