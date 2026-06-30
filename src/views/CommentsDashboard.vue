<template>
  <div class="ext:flex ext:h-full ext:flex-col">
    <header
      class="ext:flex ext:items-center ext:justify-between ext:border-b ext:border-role-outline-variant ext:bg-role-surface-container ext:px-5 ext:py-4"
    >
      <h1 class="ext:m-0 ext:text-xl ext:font-semibold">
        {{ $gettext('Comment dashboard') }}
      </h1>
      <oc-button appearance="outline" size="small" :disabled="isLoading" @click="loadDashboard">
        {{ $gettext('Refresh') }}
      </oc-button>
    </header>

    <div class="ext:flex ext:flex-1 ext:flex-col ext:gap-4 ext:overflow-y-auto ext:p-4">
      <p class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
        {{
          $gettext(
            'All comment threads across your spaces. Filter by open or resolved and answered or unanswered.'
          )
        }}
      </p>

      <div class="ext:flex ext:flex-wrap ext:gap-4">
        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext('Status') }}</span>
          <select
            v-model="query.status"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="all">{{ $gettext('All') }}</option>
            <option value="open">{{ $gettext('Open') }}</option>
            <option value="resolved">{{ $gettext('Resolved') }}</option>
          </select>
        </label>

        <label class="ext:flex ext:flex-col ext:gap-1 ext:text-sm">
          <span>{{ $gettext('Replies') }}</span>
          <select
            v-model="query.answered"
            class="ext:rounded-md ext:border ext:border-role-outline ext:bg-role-surface ext:px-3 ext:py-2"
          >
            <option value="all">{{ $gettext('All') }}</option>
            <option value="answered">{{ $gettext('Answered') }}</option>
            <option value="unanswered">{{ $gettext('Unanswered') }}</option>
          </select>
        </label>
      </div>

      <p class="ext:m-0 ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext('Showing %{count} of %{total} threads', { count: entries.length, total }) }}
      </p>

      <div v-if="isLoading" class="ext:flex ext:flex-1 ext:items-center ext:justify-center">
      <oc-spinner size="medium" :aria-label="$gettext('Loading comment dashboard')" />
    </div>

    <div
      v-else-if="error"
      class="ext:flex ext:flex-1 ext:flex-col ext:items-center ext:justify-center ext:gap-3 ext:text-center"
    >
      <p class="ext:m-0 ext:text-sm ext:text-role-error">
        {{ error }}
      </p>
      <oc-button appearance="outline" size="small" @click="loadDashboard">
        {{ $gettext('Retry') }}
      </oc-button>
    </div>

    <div
      v-else-if="entries.length === 0"
      class="ext:flex ext:flex-1 ext:items-center ext:justify-center ext:text-center ext:text-sm ext:text-role-on-surface-variant"
    >
      {{ $gettext('No comment threads match the current filters.') }}
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
              {{ entry.space.name }} · {{ formattedDate(entry.thread.updatedAt) }}
            </p>
          </div>

          <div class="ext:flex ext:flex-col ext:items-end ext:gap-2">
            <span
              class="ext:rounded-full ext:px-2 ext:py-1 ext:text-xs ext:font-medium"
              :class="statusClass(entry.thread.status)"
            >
              {{ entry.thread.status === 'resolved' ? $gettext('Resolved') : $gettext('Open') }}
            </span>
            <span class="ext:text-xs ext:text-role-on-surface-variant">
              {{
                entry.isAnswered
                  ? $gettext('%{count} replies', { count: entry.replyCount })
                  : $gettext('No replies yet')
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
              $gettext('Last reply by %{author} · %{date}', {
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
            {{ entry.target.isFolder ? $gettext('Open folder') : $gettext('Open file') }}
          </oc-button>
        </div>
      </article>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { unref } from 'vue'
import { createLocationSpaces, useRouter } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { DashboardThreadEntry } from '../types'
import { getThreadTitleLine } from '../utils/comments'
import { useCommentsDashboard } from '../composables/useCommentsDashboard'

const { $gettext, current: currentLanguage } = useGettext()
const router = useRouter()
const { entries, total, isLoading, error, query, loadDashboard } = useCommentsDashboard()

function getEntryTitle(entry: DashboardThreadEntry): string {
  const preview = getThreadTitleLine(entry.thread)

  if (preview) {
    return preview
  }

  return entry.thread.status === 'resolved'
    ? $gettext('Resolved thread')
    : $gettext('Open thread')
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

function openTarget(entry: DashboardThreadEntry) {
  const routeName =
    entry.space.driveType === 'project' ? 'files-spaces-projects' : 'files-spaces-generic'

  void router.push(
    createLocationSpaces(routeName, {
      params: {
        driveAliasAndItem: `${entry.space.driveAlias}${entry.target.path}`
      }
    })
  )
}
</script>
