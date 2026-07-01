<template>
  <div class="ext:flex ext:h-full ext:flex-col">
    <header
      class="ext:flex ext:items-center ext:justify-between ext:border-b ext:border-role-outline-variant ext:bg-role-surface-container ext:px-5 ext:py-4"
    >
      <h1 class="ext:m-0 ext:text-xl ext:font-semibold">
        {{ $gettext(msg.commentDashboard) }}
      </h1>
      <oc-button appearance="outline" size="small" :disabled="isLoading" @click="loadDashboard">
        {{ $gettext(msg.refresh) }}
      </oc-button>
    </header>

    <div class="ext:flex ext:flex-1 ext:flex-col ext:gap-4 ext:overflow-y-auto ext:p-4">
      <p class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
        {{ $gettext(msg.allThreadsDescription) }}
      </p>

      <div class="ext:flex ext:flex-wrap ext:items-end ext:gap-4">
        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext(msg.status) }}</span>
          <select
            v-model="query.status"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="all">{{ $gettext(msg.all) }}</option>
            <option value="open">{{ $gettext(msg.statusOpen) }}</option>
            <option value="resolved">{{ $gettext(msg.resolved) }}</option>
          </select>
        </label>

        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext(msg.replies) }}</span>
          <select
            v-model="query.answered"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="all">{{ $gettext(msg.all) }}</option>
            <option value="answered">{{ $gettext(msg.answered) }}</option>
            <option value="unanswered">{{ $gettext(msg.unanswered) }}</option>
          </select>
        </label>

        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext(msg.type) }}</span>
          <select
            v-model="query.type"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="all">{{ $gettext(msg.all) }}</option>
            <option value="file">{{ $gettext(msg.files) }}</option>
            <option value="folder">{{ $gettext(msg.folders) }}</option>
            <option value="space">{{ $gettext(msg.spaces) }}</option>
          </select>
        </label>

        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext(msg.user) }}</span>
          <select
            v-model="query.user"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="me">{{ $gettext(msg.me) }}</option>
            <option value="all">{{ $gettext(msg.allUsers) }}</option>
          </select>
        </label>

        <fieldset class="ext:flex ext:min-w-48 ext:flex-col ext:gap-2 ext:text-sm">
          <legend class="ext:px-1">{{ $gettext(msg.tags) }}</legend>
          <label
            v-for="tag in availableTags"
            :key="tag"
            class="ext:flex ext:items-center ext:gap-2 ext:font-normal"
          >
            <input v-model="query.tags" type="checkbox" :value="tag" />
            <span>{{ tag }}</span>
          </label>
        </fieldset>

        <oc-button
          appearance="outline"
          size="small"
          :disabled="isLoading || !filtersActive"
          @click="resetFilters"
        >
          {{ $gettext(msg.clearFilters) }}
        </oc-button>
      </div>

      <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext(msg.showingThreads, { count: entries.length, total }) }}
      </p>

      <div v-if="isLoading" class="ext:flex ext:flex-1 ext:items-center ext:justify-center">
        <oc-spinner size="medium" :aria-label="$gettext(msg.loadingCommentDashboard)" />
      </div>

      <div
        v-else-if="error"
        class="ext:flex ext:flex-1 ext:flex-col ext:items-center ext:justify-center ext:gap-3 ext:text-center"
      >
        <p class="ext:m-0 ext:text-sm ext:text-role-error">
          {{ error }}
        </p>
        <oc-button appearance="outline" size="small" @click="loadDashboard">
          {{ $gettext(msg.retry) }}
        </oc-button>
      </div>

      <div
        v-else-if="entries.length === 0"
        class="ext:flex ext:flex-1 ext:items-center ext:justify-center ext:text-center ext:text-sm ext:text-role-on-surface-variant"
      >
        {{ $gettext(msg.noMatchingThreads) }}
      </div>

      <div v-else class="ext:flex ext:flex-1 ext:flex-col ext:gap-3 ext:overflow-y-auto">
        <article
          v-for="entry in entries"
          :key="`${entry.space.id}:${entry.thread.id}`"
          class="ext:rounded-lg ext:border ext:border-role-outline ext:bg-role-surface ext:p-4"
        >
          <div class="ext:flex ext:items-start ext:justify-between ext:gap-3">
            <div class="ext:min-w-0 ext:flex-1">
              <h2 class="ext:m-0 ext:truncate ext:text-base ext:font-semibold">
                {{ getEntryTitle(entry) }}
              </h2>
              <p class="ext:m-0 ext:mt-1 ext:text-sm ext:text-role-on-surface-variant">
                {{ entry.target.name }} · {{ entry.target.path }}
              </p>
              <p class="ext:m-0 ext:mt-1 ext:text-xs ext:text-role-on-surface-variant">
                {{ formatTargetMeta(entry) }} · {{ entry.space.name }} ·
                {{ formattedDate(entry.thread.updatedAt) }}
              </p>
            </div>

            <div class="ext:flex ext:flex-col ext:items-end ext:gap-2">
              <span
                class="ext:rounded-full ext:px-2 ext:py-1 ext:text-xs ext:font-medium"
                :class="statusClass(entry.thread.status)"
              >
                {{
                  entry.thread.status === 'resolved'
                    ? $gettext(msg.resolved)
                    : $gettext(msg.statusOpen)
                }}
              </span>
              <span class="ext:text-xs ext:text-role-on-surface-variant">
                {{
                  entry.isAnswered
                    ? $gettext(msg.replyCount, { count: entry.replyCount })
                    : $gettext(msg.noRepliesYet)
                }}
              </span>
            </div>
          </div>

          <div
            v-if="entry.lastReply"
            class="ext:mt-3 ext:rounded-md ext:bg-role-surface-container ext:p-3"
          >
            <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
              {{
                $gettext(msg.lastReplyBy, {
                  author: entry.lastReply.author.displayName,
                  date: formattedDate(entry.lastReply.createdAt)
                })
              }}
            </p>
            <p class="ext:m-0 ext:mt-1 ext:text-sm">
              {{ entry.lastReply.preview }}
            </p>
          </div>

          <div class="ext:mt-3 ext:flex ext:gap-2">
            <oc-button appearance="outline" size="small" @click="openTarget(entry)">
              {{ openTargetLabel(entry) }}
            </oc-button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { unref } from 'vue'
import { useFileActions, useRouter, useSpacesStore } from '@opencloud-eu/web-pkg'
import { DashboardThreadEntry } from '../types'
import { getThreadTitleLine } from '../utils/comments'
import { buildOpenTargetLocation } from '../utils/dashboardNavigation'
import { buildDashboardResource } from '../utils/dashboardResource'
import { useCommentsDashboard } from '../composables/useCommentsDashboard'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'

const { $gettext, current: currentLanguage } = useCommentGettext()
const router = useRouter()
const spacesStore = useSpacesStore()
const { getDefaultAction, triggerDefaultAction } = useFileActions()
const { entries, total, isLoading, error, availableTags, query, filtersActive, resetFilters, loadDashboard } =
  useCommentsDashboard()

function getEntryTitle(entry: DashboardThreadEntry): string {
  const preview = getThreadTitleLine(entry.thread)

  if (preview) {
    return preview
  }

  return entry.thread.status === 'resolved'
    ? $gettext(msg.resolvedThread)
    : $gettext(msg.openThread)
}

function statusClass(status: DashboardThreadEntry['thread']['status']): string {
  return status === 'resolved'
    ? 'ext:bg-role-surface-container ext:text-role-on-surface-variant'
    : 'ext:bg-role-primary-container ext:text-role-on-primary-container'
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat(unref(currentLanguage), {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatTargetMeta(entry: DashboardThreadEntry): string {
  const parts = [formatResourceType(entry.target.resourceType)]

  if (entry.target.mimeType) {
    parts.push(entry.target.mimeType)
  }

  if (entry.target.tags.length > 0) {
    parts.push(entry.target.tags.join(', '))
  }

  return parts.join(' · ')
}

function formatResourceType(resourceType: DashboardThreadEntry['target']['resourceType']): string {
  switch (resourceType) {
    case 'space':
      return $gettext(msg.space)
    case 'folder':
      return $gettext(msg.folder)
    default:
      return $gettext(msg.file)
  }
}

function openTargetLabel(entry: DashboardThreadEntry): string {
  switch (entry.target.resourceType) {
    case 'space':
      return $gettext(msg.openSpace)
    case 'folder':
      return $gettext(msg.openFolder)
    default:
      return $gettext(msg.openFile)
  }
}

function openTarget(entry: DashboardThreadEntry) {
  const space = unref(spacesStore.spaces).find((candidate) => candidate.id === entry.space.id)

  if (!space) {
    return
  }

  if (entry.target.resourceType === 'file') {
    const resource = buildDashboardResource(space, entry.target)
    const action = getDefaultAction({
      space,
      resources: [resource],
      omitSystemActions: true
    })

    if (action) {
      triggerDefaultAction({
        space,
        resources: [resource],
        omitSystemActions: true
      })
      return
    }
  }

  void router.push(buildOpenTargetLocation(space, entry))
}
</script>
