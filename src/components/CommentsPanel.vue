<template>
  <aside class="ext:flex ext:h-full ext:flex-col ext:gap-4 ext:p-4">
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
      <CommentForm
        :key="commentTarget.id"
        :submit-label="$gettext(msg.comment)"
        :placeholder="$gettext(msg.writeComment)"
        :disabled="isSaving"
        @submit="createThread"
      />

      <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext(msg.prototypeStorage) }}
      </p>

      <div v-if="isLoading" class="ext:flex ext:flex-1 ext:items-center ext:justify-center">
        <oc-spinner size="small" :aria-label="$gettext(msg.loadingComments)" />
      </div>

      <div
        v-else-if="error"
        class="ext:flex ext:flex-1 ext:flex-col ext:items-center ext:justify-center ext:gap-3 ext:text-center"
      >
        <p class="ext:m-0 ext:text-sm ext:text-role-error">
          {{ error }}
        </p>
        <oc-button appearance="outline" size="small" @click="loadComments">
          {{ $gettext(msg.retry) }}
        </oc-button>
      </div>

      <div
        v-else-if="threads.length === 0"
        class="ext:flex ext:flex-1 ext:items-center ext:justify-center ext:text-center ext:text-sm ext:text-role-on-surface-variant"
      >
        {{ $gettext(msg.noCommentsYet) }}
      </div>

      <div v-else class="ext:flex ext:flex-1 ext:flex-col ext:gap-3 ext:overflow-y-auto">
        <CommentThread
          v-for="thread in threads"
          :key="thread.id"
          :thread="thread"
          :current-user-id="currentUser.id"
          :disabled="isSaving"
          @reply="replyToThread"
          @update="updateComment"
          @delete-comment="deleteComment"
          @set-resolved="setThreadResolved"
        />
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { createCommentTarget, resolveSidebarSpace } from '../utils/target'
import { useComments } from '../composables/useComments'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'
import CommentForm from './CommentForm.vue'
import CommentThread from './CommentThread.vue'

const { $gettext } = useCommentGettext()

const { panelContext } = defineProps<{
  panelContext: Record<string, any>
}>()

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

const {
  threads,
  isLoading,
  isSaving,
  error,
  currentUser,
  loadComments,
  createThread,
  replyToThread,
  updateComment,
  deleteComment,
  setThreadResolved
} = useComments(() => unref(commentTarget))
</script>
