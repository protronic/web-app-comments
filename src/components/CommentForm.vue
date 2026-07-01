<template>
  <form class="ext:relative ext:flex ext:flex-col ext:gap-2" @submit.prevent="submit">
    <textarea
      ref="textareaRef"
      v-model="body"
      class="ext:min-h-24 ext:w-full ext:resize-y ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:p-2 ext:text-sm ext:text-role-on-surface"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @keydown="onKeydown"
      @click="updateCursor"
      @keyup="updateCursor"
    />

    <ul
      v-if="mentionOpen && mentionCandidates.length > 0"
      class="ext:absolute ext:z-10 ext:max-h-48 ext:w-full ext:overflow-y-auto ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:p-1 ext:shadow-lg"
      :style="mentionListStyle"
      role="listbox"
    >
      <li
        v-for="(candidate, index) in mentionCandidates"
        :key="candidate.id"
        role="option"
        :aria-selected="index === mentionHighlightIndex"
        class="ext:cursor-pointer ext:rounded-md ext:px-2 ext:py-1 ext:text-sm"
        :class="
          index === mentionHighlightIndex
            ? 'ext:bg-role-primary-container ext:text-role-on-primary-container'
            : 'ext:text-role-on-surface'
        "
        @mousedown.prevent="selectMention(candidate)"
      >
        <span class="ext:font-medium">{{ candidate.displayName }}</span>
        <span
          v-if="candidate.id !== candidate.displayName"
          class="ext:ml-2 ext:text-xs ext:text-role-on-surface-variant"
        >
          {{ candidate.id }}
        </span>
      </li>
    </ul>

    <div class="ext:flex ext:items-center ext:justify-between ext:gap-2">
      <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext(msg.markdownSupported) }}
        <span v-if="enableMentions"> · {{ $gettext(msg.mentionHint) }}</span>
      </p>
      <div class="ext:flex ext:gap-2">
        <oc-button
          v-if="cancelable"
          appearance="raw"
          size="small"
          :disabled="disabled"
          @click.prevent="cancel"
        >
          {{ $gettext(msg.cancel) }}
        </oc-button>
        <oc-button
          appearance="filled"
          size="small"
          :disabled="disabled || !body.trim()"
          @click.prevent="submit"
        >
          {{ disabled ? $gettext(msg.saving) : submitLabel }}
        </oc-button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CommentAuthor } from '../types'
import { useUserMentions } from '../composables/useUserMentions'
import { getActiveMentionQuery, insertUserMention } from '../utils/mentions'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'

const { $gettext } = useCommentGettext()
const { searchUsers } = useUserMentions()

const {
  initialBody = '',
  submitLabel,
  placeholder = '',
  disabled = false,
  cancelable = false,
  enableMentions = true
} = defineProps<{
  initialBody?: string
  submitLabel: string
  placeholder?: string
  disabled?: boolean
  cancelable?: boolean
  enableMentions?: boolean
}>()

const emit = defineEmits<{
  submit: [body: string]
  cancel: []
}>()

const body = ref(initialBody)
const textareaRef = ref<HTMLTextAreaElement>()
const cursor = ref(0)
const mentionCandidates = ref<CommentAuthor[]>([])
const mentionHighlightIndex = ref(0)
const mentionStart = ref<number>()
const mentionOpen = ref(false)
let mentionSearchToken = 0

const mentionListStyle = computed(() => ({
  top: '4.5rem'
}))

watch(
  () => initialBody,
  (value) => {
    body.value = value
  }
)

function updateCursor() {
  cursor.value = textareaRef.value?.selectionStart ?? body.value.length
}

function closeMentionList() {
  mentionOpen.value = false
  mentionCandidates.value = []
  mentionHighlightIndex.value = 0
  mentionStart.value = undefined
}

async function refreshMentionCandidates() {
  if (!enableMentions) {
    closeMentionList()
    return
  }

  updateCursor()
  const activeMention = getActiveMentionQuery(body.value, cursor.value)

  if (!activeMention) {
    closeMentionList()
    return
  }

  mentionStart.value = activeMention.start
  mentionOpen.value = true
  const token = ++mentionSearchToken
  const results = await searchUsers(activeMention.query)
  if (token !== mentionSearchToken) {
    return
  }

  mentionCandidates.value = results
  mentionHighlightIndex.value = 0

  if (results.length === 0) {
    mentionOpen.value = false
  }
}

function onInput() {
  void refreshMentionCandidates()
}

function selectMention(user: CommentAuthor) {
  if (mentionStart.value === undefined) {
    return
  }

  updateCursor()
  const next = insertUserMention(body.value, mentionStart.value, cursor.value, user)
  body.value = next.value
  closeMentionList()

  requestAnimationFrame(() => {
    const textarea = textareaRef.value
    if (!textarea) {
      return
    }

    textarea.focus()
    textarea.setSelectionRange(next.cursor, next.cursor)
    cursor.value = next.cursor
  })
}

function onKeydown(event: KeyboardEvent) {
  if (!mentionOpen.value || mentionCandidates.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    mentionHighlightIndex.value =
      (mentionHighlightIndex.value + 1) % mentionCandidates.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    mentionHighlightIndex.value =
      (mentionHighlightIndex.value - 1 + mentionCandidates.value.length) %
      mentionCandidates.value.length
    return
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    selectMention(mentionCandidates.value[mentionHighlightIndex.value])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMentionList()
  }
}

function submit() {
  const value = body.value.trim()

  if (!value || disabled) {
    return
  }

  closeMentionList()
  emit('submit', value)
  body.value = ''
}

function cancel() {
  body.value = initialBody
  closeMentionList()
  emit('cancel')
}
</script>

<style scoped>
:global(.comment-mention) {
  color: var(--oc-color-role-primary);
  font-weight: 600;
}
</style>
