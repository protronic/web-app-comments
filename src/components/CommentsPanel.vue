<template>
  <aside class="ext:flex ext:h-full ext:flex-col ext:gap-3 ext:p-4">
    <p
      v-if="selectedResource"
      class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant"
    >
      {{ selectedResource.name }}
    </p>

    <div
      v-if="!commentTarget"
      class="ext:flex ext:flex-1 ext:items-center ext:justify-center ext:text-center ext:text-sm ext:text-role-on-surface-variant"
    >
      {{ $gettext(msg.selectTarget) }}
    </div>

    <template v-else>
      <div
        v-if="showIndividualShareHint"
        class="ext:rounded-lg ext:border ext:border-role-warning ext:bg-role-warning-container ext:p-3 ext:text-sm ext:text-role-on-warning-container"
        role="status"
      >
        <p class="ext:m-0 ext:font-medium">
          {{ $gettext(msg.individualShareCommentWarningTitle) }}
        </p>
        <p class="ext:mb-0 ext:mt-2">
          {{ $gettext(msg.individualShareCommentWarningDesc) }}
        </p>
      </div>

      <p
        v-if="isRefreshing"
        class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant"
        aria-live="polite"
      >
        {{ $gettext(msg.refreshingComments) }}
      </p>

      <div
        v-if="isLoading && !hasLoadedOnce"
        class="ext:flex ext:flex-1 ext:items-center ext:justify-center"
      >
        <oc-spinner size="small" :aria-label="$gettext(msg.loadingComments)" />
      </div>

      <div
        v-else-if="error && !hasLoadedOnce"
        class="ext:flex ext:flex-1 ext:flex-col ext:items-center ext:justify-center ext:gap-3 ext:text-center"
      >
        <p class="ext:m-0 ext:text-sm ext:text-role-error">
          {{ error }}
        </p>
        <oc-button appearance="outline" size="small" @click="loadComments()">
          {{ $gettext(msg.retry) }}
        </oc-button>
      </div>

      <div
        v-else
        ref="threadScroller"
        class="ext:flex ext:min-h-0 ext:flex-1 ext:flex-col ext:gap-3 ext:overflow-y-auto"
      >
        <div
          v-if="threads.length === 0"
          class="ext:flex ext:flex-1 ext:items-center ext:justify-center ext:text-center ext:text-sm ext:text-role-on-surface-variant"
        >
          {{ $gettext(msg.noCommentsYet) }}
        </div>

        <CommentThread
          v-for="thread in threads"
          :key="thread.id"
          :thread="thread"
          :current-user-ids="currentUserIds"
          :disabled="isSaving"
          @reply="handleReplyToThread"
          @update="updateComment"
          @delete-comment="deleteComment"
          @set-resolved="setThreadResolved"
        />
      </div>

      <div class="ext:mt-auto ext:flex ext:flex-col ext:gap-2 ext:border-t ext:border-role-outline-variant ext:pt-3">
        <oc-button
          v-if="hasLoadedOnce && threads.length > 0"
          appearance="outline"
          size="small"
          class="ext:self-start ext:text-role-error"
          :disabled="isSaving || (isLoading && !hasLoadedOnce)"
          @click="confirmDeleteAllComments"
        >
          {{ $gettext(msg.deleteAllComments) }}
        </oc-button>

        <p
          v-if="showIndividualShareHint"
          class="ext:m-0 ext:rounded-md ext:border ext:border-role-warning ext:bg-role-warning-container ext:p-2 ext:text-xs ext:text-role-on-warning-container"
          role="status"
        >
          {{ $gettext(msg.individualShareCommentComposerHint) }}
        </p>

        <CommentForm
          :key="commentTarget.id"
          :submit-label="$gettext(msg.comment)"
          :placeholder="$gettext(msg.writeComment)"
          :disabled="isSaving || (isLoading && !hasLoadedOnce)"
          @submit="handleCreateThread"
        />

        <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
          {{ $gettext(msg.prototypeStorage) }}
        </p>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, unref, watch } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { useMessages, useModals } from '@opencloud-eu/web-pkg'
import { createCommentTarget, resolveSidebarSpace } from '../utils/target'
import { useComments } from '../composables/useComments'
import { useIndividualShareCommentHint } from '../composables/useIndividualShareCommentHint'
import { ensureCommentNotificationListener } from '../composables/useCommentNotifications'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'
import CommentForm from './CommentForm.vue'
import CommentThread from './CommentThread.vue'

const { $gettext } = useCommentGettext()
const { showMessage } = useMessages()
const { dispatchModal } = useModals()

ensureCommentNotificationListener()

const { panelContext } = defineProps<{
  panelContext: Record<string, any>
}>()

const threadScroller = ref<HTMLElement | null>(null)

const selectedResource = computed<Resource | null>(() => {
  const items = unref(panelContext?.items)

  if (!Array.isArray(items) || items.length !== 1) {
    return null
  }

  return items[0] as Resource
})

const selectedSpace = computed(() => resolveSidebarSpace(panelContext))

const commentTarget = computed(() => {
  const space = unref(selectedSpace)
  const resource = unref(selectedResource)

  if (!space || !resource) {
    return null
  }

  return createCommentTarget(space, resource)
})

const { showIndividualShareHint, warnOnCommentSave } = useIndividualShareCommentHint(
  () => unref(selectedSpace),
  () => unref(selectedResource)
)

const {
  threads,
  isLoading,
  isRefreshing,
  hasLoadedOnce,
  isSaving,
  error,
  currentUserIds,
  loadComments,
  consumeScrollToLatest,
  createThread,
  replyToThread,
  updateComment,
  deleteComment,
  setThreadResolved,
  deleteAllComments
} = useComments(() => unref(commentTarget))

const confirmDeleteAllComments = () => {
  const target = unref(commentTarget)

  if (!target) {
    return
  }

  dispatchModal({
    title: $gettext(msg.deleteAllCommentsConfirmTitle, { name: target.name }),
    message: $gettext(msg.deleteAllCommentsConfirmMessage),
    confirmText: $gettext(msg.delete),
    onConfirm: async () => {
      const deleted = await deleteAllComments()

      if (deleted) {
        showMessage({ title: $gettext(msg.deleteAllCommentsSuccess) })
      }
    }
  })
}

const handleCreateThread = async (body: string) => {
  warnOnCommentSave()
  await createThread(body)
}

const handleReplyToThread = async (threadId: string, body: string) => {
  warnOnCommentSave()
  await replyToThread(threadId, body)
}

watch([threads, isRefreshing], () => {
  void consumeScrollToLatest(threadScroller.value ?? undefined)
})
</script>
