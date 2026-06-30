<template>
  <article
    class="ext:rounded-lg ext:border ext:border-role-outline ext:bg-role-surface ext:p-3"
    :class="{ 'ext:opacity-70': thread.status === 'resolved' }"
  >
    <header class="ext:mb-3 ext:flex ext:items-start ext:justify-between ext:gap-2">
      <div>
        <h3 class="ext:m-0 ext:text-sm ext:font-semibold">
          {{ threadTitle }}
        </h3>
        <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
          {{ formattedDate(thread.updatedAt) }}
        </p>
      </div>
      <oc-button appearance="raw" size="small" :disabled="disabled" @click="toggleResolved">
        {{
          thread.status === 'resolved'
            ? $gettext('Reopen')
            : $gettext('Resolve')
        }}
      </oc-button>
    </header>

    <ol class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-3 ext:p-0">
      <li
        v-for="comment in thread.comments"
        :key="comment.id"
        class="ext:rounded-md ext:bg-role-surface-container ext:p-3"
      >
        <div class="ext:mb-2 ext:flex ext:items-start ext:justify-between ext:gap-2">
          <div>
            <p class="ext:m-0 ext:text-sm ext:font-semibold">
              {{ comment.author.displayName }}
            </p>
            <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
              {{ formattedDate(comment.updatedAt || comment.createdAt) }}
            </p>
          </div>
          <div v-if="canModify(comment)" class="ext:flex ext:gap-1">
            <oc-button
              appearance="raw"
              size="small"
              :disabled="disabled"
              @click="startEdit(comment)"
            >
              {{ $gettext('Edit') }}
            </oc-button>
            <oc-button
              appearance="raw"
              size="small"
              :disabled="disabled"
              @click="emit('delete-comment', thread.id, comment.id)"
            >
              {{ $gettext('Delete') }}
            </oc-button>
          </div>
        </div>

        <CommentForm
          v-if="editingCommentId === comment.id"
          :initial-body="comment.body"
          :submit-label="$gettext('Save')"
          :placeholder="$gettext('Update comment')"
          :disabled="disabled"
          cancelable
          @submit="updateComment(comment.id, $event)"
          @cancel="editingCommentId = undefined"
        />
        <p
          v-else-if="comment.deletedAt"
          class="ext:m-0 ext:text-sm ext:italic ext:text-role-on-surface-variant"
        >
          {{ $gettext('Comment deleted') }}
        </p>
        <div v-else class="comments-markdown ext:text-sm" v-html="renderCommentMarkdown(comment.body)" />
      </li>
    </ol>

    <div
      v-if="thread.status === 'resolved'"
      class="ext:mt-3 ext:text-xs ext:text-role-on-surface-variant"
    >
      {{ resolvedLabel }}
    </div>
    <CommentForm
      v-else
      class="ext:mt-3"
      :submit-label="$gettext('Reply')"
      :placeholder="$gettext('Write a reply')"
      :disabled="disabled"
      @submit="emit('reply', thread.id, $event)"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { getThreadTitleLine } from '../utils/comments'
import { CommentMessage, CommentThread } from '../types'
import { renderCommentMarkdown } from '../utils/markdown'

import CommentForm from './CommentForm.vue'

const { $gettext, current: currentLanguage } = useGettext()

const { thread, currentUserId, disabled = false } = defineProps<{
  thread: CommentThread
  currentUserId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  reply: [threadId: string, body: string]
  update: [threadId: string, commentId: string, body: string]
  'delete-comment': [threadId: string, commentId: string]
  'set-resolved': [threadId: string, resolved: boolean]
}>()

const editingCommentId = ref<string>()

const threadTitle = computed(() => {
  const preview = getThreadTitleLine(thread)
  if (preview) {
    return preview
  }

  return thread.status === 'resolved' ? $gettext('Resolved thread') : $gettext('Open thread')
})

const resolvedLabel = computed(() => {
  if (!thread.resolvedBy || !thread.resolvedAt) {
    return $gettext('Resolved')
  }

  return $gettext('Resolved by %{user} on %{date}', {
    user: thread.resolvedBy.displayName,
    date: formattedDate(thread.resolvedAt)
  })
})

function canModify(comment: CommentMessage): boolean {
  return !comment.deletedAt && comment.author.id === currentUserId
}

function startEdit(comment: CommentMessage) {
  editingCommentId.value = comment.id
}

function updateComment(commentId: string, body: string) {
  editingCommentId.value = undefined
  emit('update', thread.id, commentId, body)
}

function toggleResolved() {
  emit('set-resolved', thread.id, thread.status !== 'resolved')
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat(unref(currentLanguage), {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
</script>

<style scoped>
.comments-markdown :deep(p) {
  margin: 0;
}

.comments-markdown :deep(a) {
  color: var(--oc-color-role-primary);
}

.comments-markdown :deep(code) {
  border-radius: 0.25rem;
  background: var(--oc-color-role-surface-container-high);
  padding: 0.125rem 0.25rem;
}
</style>
