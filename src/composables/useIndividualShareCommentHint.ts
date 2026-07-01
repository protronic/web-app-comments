import { computed, unref, watch } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useMessages } from '@opencloud-eu/web-pkg'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { commentMessages as msg } from '../i18n/messages'
import { isIndividuallySharedCommentTarget } from '../utils/individuallySharedFile'

const warnedResourceIds = new Set<string>()

export function useIndividualShareCommentHint(
  space: () => SpaceResource | null,
  resource: () => Resource | null
) {
  const { showMessage } = useMessages()
  const { $gettext } = useCommentGettext()

  const showIndividualShareHint = computed(() => {
    const currentSpace = unref(space)
    const currentResource = unref(resource)

    if (!currentSpace || !currentResource) {
      return false
    }

    return isIndividuallySharedCommentTarget(currentSpace, currentResource)
  })

  watch(
    [space, resource],
    () => {
      const currentSpace = unref(space)
      const currentResource = unref(resource)

      if (!currentSpace || !currentResource) {
        return
      }

      if (!isIndividuallySharedCommentTarget(currentSpace, currentResource)) {
        return
      }

      const resourceKey = currentResource.fileId || currentResource.id

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
    },
    { immediate: true }
  )

  return { showIndividualShareHint }
}
