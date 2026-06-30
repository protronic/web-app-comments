<template>
  <form class="ext:flex ext:flex-col ext:gap-2" @submit.prevent="submit">
    <textarea
      v-model="body"
      class="ext:min-h-24 ext:w-full ext:resize-y ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:p-2 ext:text-sm ext:text-role-on-surface"
      :placeholder="placeholder"
      :disabled="disabled"
    />
    <div class="ext:flex ext:items-center ext:justify-between ext:gap-2">
      <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext(msg.markdownSupported) }}
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
import { ref, watch } from 'vue'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'

const { $gettext } = useCommentGettext()

const {
  initialBody = '',
  submitLabel,
  placeholder = '',
  disabled = false,
  cancelable = false
} = defineProps<{
  initialBody?: string
  submitLabel: string
  placeholder?: string
  disabled?: boolean
  cancelable?: boolean
}>()

const emit = defineEmits<{
  submit: [body: string]
  cancel: []
}>()

const body = ref(initialBody)

watch(
  () => initialBody,
  (value) => {
    body.value = value
  }
)

function submit() {
  const value = body.value.trim()

  if (!value || disabled) {
    return
  }

  emit('submit', value)
  body.value = ''
}

function cancel() {
  body.value = initialBody
  emit('cancel')
}
</script>
