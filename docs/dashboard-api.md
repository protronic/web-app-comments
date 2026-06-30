# Comments Dashboard API

The dashboard aggregates comment threads from WebDAV sidecar files (`.conflu/comments/*.json`) across all spaces the current user can access.

## TypeScript API

Import from the extension module:

```ts
import {
  WebdavSidecarDashboardStorage,
  queryDashboardEntries,
  type CommentsDashboardQuery
} from './api'
```

### `CommentsDashboardApi.listThreads(spaces, query?)`

Returns all matching threads across the provided spaces.

```ts
const api = new WebdavSidecarDashboardStorage(webdav)
const result = await api.listThreads(spaces, {
  status: 'open',
  answered: 'unanswered',
  limit: 50,
  offset: 0
})
```

### Query filters

| Field | Values | Description |
|-------|--------|-------------|
| `status` | `all`, `open`, `resolved` | Thread resolve state |
| `answered` | `all`, `answered`, `unanswered` | Whether the thread has at least one reply |
| `spaceId` | space id | Restrict to one space |
| `limit` | number | Page size after filtering |
| `offset` | number | Pagination offset after filtering |

### Response shape

```ts
interface CommentsDashboardResult {
  entries: DashboardThreadEntry[]
  total: number
}

interface DashboardThreadEntry {
  thread: CommentThread
  target: {
    id: string
    name: string
    path: string
    isFolder: boolean
  }
  space: {
    id: string
    name: string
    driveAlias: string
    driveType?: string
  }
  replyCount: number
  isAnswered: boolean
  lastReply?: {
    author: CommentAuthor
    body: string
    preview: string
    createdAt: string
  }
}
```

Target `name` and `path` are resolved from WebDAV at load time, so renames of files and folders show up on refresh without rewriting sidecar JSON.

## UI

The extension registers:

- App menu item: **Comment dashboard**
- Route: `/comments/dashboard`

Filters in the UI map directly to the query fields above.

## Notes

- This MVP reads sidecar files client-side via WebDAV. A future native comments API can expose the same query contract server-side.
The dashboard uses all accessible drives: personal space, project spaces, and mount points. Virtual drives such as the aggregated Shares view are skipped.

Scanning explicitly probes `{folder}/.conflu/comments/` in every visited directory, because hidden dot folders are often omitted from WebDAV listings.
