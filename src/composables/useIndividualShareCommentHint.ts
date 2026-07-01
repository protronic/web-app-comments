import { computed, ref, unref, watch } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useClientService, useMessages } from '@opencloud-eu/web-pkg'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { commentMessages as msg } from '../i18n/messages'
import {
  isIndividuallySharedCommentTarget,
  resolveIndividualShareViaGraph,
  shouldResolveIndividualShareViaGraph
} from '../utils/individuallySharedFile'

const warnedResourceIds = new Set<string>()
const warnedOnCommentSaveResourceIds = new Set<string>()

function maybeShowIndividualShareToast(
  showMessage: ReturnType<typeof useMessages>['showMessage'],
  $gettext: ReturnType<typeof useCommentGettext>['$gettext'],
  resource: Resource
) {
  const resourceKey = resource.fileId || resource.id

  if (!resourceKey || warnedResourceIds.has(resourceKey)) {
    return
  }

  warnedResourceIds.add(resourceKey)
  showMessage({
    title: $gettext(msg.individualShareCommentWarningTitle),
    desc: $gettext(msg.individualShareCommentWarningDesc),
    status: 'warning',
    timeout: 10_000
  })
}

export function useIndividualShareCommentHint(
  space: () => SpaceResource | null,
  resource: () => Resource | null
) {
  const { showMessage } = useMessages()
  const { $gettext } = useCommentGettext()
  const clientService = useClientService()
  const showIndividualShareHint = ref(false)
  let resolveGeneration = 0

  watch(
    [space, resource],
    () => {
      const currentSpace = unref(space)
      const currentResource = unref(resource)
      const generation = ++resolveGeneration

      showIndividualShareHint.value = false

      if (!currentSpace || !currentResource) {
        return
      }

      if (isIndividuallySharedCommentTarget(currentSpace, currentResource)) {
        showIndividualShareHint.value = true
        maybeShowIndividualShareToast(showMessage, $gettext, currentResource)
        return
      }

      if (!shouldResolveIndividualShareViaGraph(currentSpace, currentResource)) {
        return
      }

      void resolveIndividualShareViaGraph(
        clientService.graphAuthenticated,
        currentSpace,
        currentResource
      ).then((hasDirectShares) => {
        if (generation !== resolveGeneration) {
          return
        }

        showIndividualShareHint.value = hasDirectShares

        if (hasDirectShares) {
          maybeShowIndividualShareToast(showMessage, $gettext, currentResource)
        }
      })
    },
    { immediate: true }
  )

  const warnOnCommentSave = () => {
    if (!showIndividualShareHint.value) {
      return
    }

    const currentResource = unref(resource)

    if (!currentResource) {
      return
    }

    const resourceKey = currentResource.fileId || currentResource.id

    if (!resourceKey || warnedOnCommentSaveResourceIds.has(resourceKey)) {
      return
    }

    warnedOnCommentSaveResourceIds.add(resourceKey)
    showMessage({
      title: $gettext(msg.individualShareCommentWarningTitle),
      desc: $gettext(msg.individualShareCommentSaveWarningDesc),
      status: 'warning',
      timeout: 10_000
    })
  }

  return {
    showIndividualShareHint: computed(() => showIndividualShareHint.value),
    warnOnCommentSave
  }
}
