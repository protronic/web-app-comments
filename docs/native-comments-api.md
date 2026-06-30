# Native OpenCloud Comments API Contract

This draft describes the server-backed storage adapter that can replace the WebDAV sidecar MVP.

## Goals

- Store comments in OpenCloud server storage or metadata DB.
- Enforce file and folder permissions server-side.
- Support file and folder targets, replies, resolve state, unread markers, mentions, and notifications.
- Keep the frontend `CommentStorage` interface stable.

## Resource Model

```ts
interface NativeCommentThread {
  id: string
  objectType: 'files'
  objectId: string
  status: 'open' | 'resolved'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: NativeCommentActor
  comments: NativeComment[]
}

interface NativeComment {
  id: string
  threadId: string
  parentId?: string
  message: string
  format: 'text' | 'markdown'
  actor: NativeCommentActor
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

interface NativeCommentActor {
  type: 'user'
  id: string
  displayName: string
}
```

## Endpoints

The API should be compatible with an ownCloud/Nextcloud-style comments model while using OpenCloud auth and permissions.

```text
GET    /remote.php/dav/comments/files/{fileId}
POST   /remote.php/dav/comments/files/{fileId}
PATCH  /remote.php/dav/comments/files/{fileId}/threads/{threadId}
POST   /remote.php/dav/comments/files/{fileId}/threads/{threadId}/comments
PATCH  /remote.php/dav/comments/files/{fileId}/threads/{threadId}/comments/{commentId}
DELETE /remote.php/dav/comments/files/{fileId}/threads/{threadId}/comments/{commentId}
PATCH  /remote.php/dav/comments/files/{fileId}/read-marker
```

`GET` should support pagination:

```text
GET /remote.php/dav/comments/files/{fileId}?limit=50&offset=0&includeResolved=false
```

`POST /remote.php/dav/comments/files/{fileId}` creates a new thread:

```json
{
  "message": "Please review this section.",
  "format": "markdown"
}
```

`PATCH /threads/{threadId}` resolves or reopens a thread:

```json
{
  "status": "resolved"
}
```

## Permissions

- `GET` requires read access to the target file or folder.
- `POST` requires update/comment permission. If OpenCloud does not have a dedicated comment permission, use the nearest existing write permission first.
- `PATCH` and `DELETE` for comments require ownership or moderation permission.
- Thread resolve can be allowed for target editors and comment authors.
- Shares must be evaluated against the target resource, not against a separate comments object.

## Notifications And Mentions

- Parse `@user` mentions server-side after comment creation.
- Emit notifications for direct replies, mentions, and new top-level comments when the user has access to the target.
- Do not include comment text in notifications if the recipient no longer has access.
- Store unread markers per user and target file id.

## Realtime

- Emit SSE events for `comment.created`, `comment.updated`, `comment.deleted`, and `thread.updated`.
- Include `fileId`, `threadId`, `commentId`, and `initiatorId` in the event payload.
- The frontend should refresh the current target when it receives a matching event.

## Migration From Sidecar MVP

- Sidecar JSON documents can be imported by file id.
- Imported comments should preserve author display names and timestamps where possible.
- After migration, the frontend should switch adapters by configuration and stop writing sidecar files.
