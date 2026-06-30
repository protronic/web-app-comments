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
        {{ $gettext('Markdown is supported.') }}
      </p>
      <div class="ext:flex ext:gap-2">
        <oc-button
          v-if="cancelable"
          appearance="raw"
          size="small"
          :disabled="disabled"
          @click.prevent="cancel"
        >
          {{ $gettext('Cancel') }}
        </oc-button>
        <oc-button
          appearance="filled"
          size="small"
          :disabled="disabled || !body.trim()"
          @click.prevent="submit"
        >
          {{ disabled ? $gettext('Saving…') : submitLabel }}
        </oc-button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()

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
