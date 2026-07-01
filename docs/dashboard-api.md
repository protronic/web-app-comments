# Comments Dashboard API

The dashboard aggregates comment threads from WebDAV sidecar files (`.{name}.jsco`, with legacy fallback to `.conflu/comments/*.json`) across all spaces the current user can access.

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
| `type` | `all`, `file`, `folder`, `space` | OpenCloud resource type from WebDAV |
| `tags` | tag names | Default: `Kommentiert`. Uses WebDAV search (`tag:…`) to find candidate resources before loading sidecars |
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
    resourceType: 'file' | 'folder' | 'space'
    mimeType?: string
    tags: string[]
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

Target `name`, `path`, `resourceType`, `mimeType`, and `tags` are resolved from WebDAV at load time. Available tag names for the UI filter come from the Graph tags API (`/v1.0/extensions/org.libregraph/tags`). Commented resources are tagged automatically with `Kommentiert` when a sidecar is saved.

## Notes

- This MVP reads sidecar files client-side via WebDAV. A future native comments API can expose the same query contract server-side.
- The dashboard discovers candidate resources through WebDAV search using the selected tags instead of recursively scanning every folder.
- The dashboard uses all accessible drives: personal space, project spaces, and mount points. Virtual drives such as the aggregated Shares view are skipped.
- Existing comment sidecars receive the `Kommentiert` tag when their resource is opened in the sidebar or when a comment is saved again.

