# web-app-comments

OpenCloud Web extension for file and document comments. Adds a sidebar panel in the Files app for discussing selected files and folders.

Comments are stored in WebDAV sidecar files (`.conflu/comments/`) so they work without a native comments API. See [docs/](docs/) for the storage model and planned native API.

## Development

Requires Docker, Docker Compose, and [pnpm](https://pnpm.io/installation).

```bash
pnpm install && pnpm build:w
docker compose up
```

Add to `/etc/hosts`: `127.0.0.1 test.oc`

Open `https://test.oc:9200` (user `admin` / `admin`).

The **Comment dashboard** is available from the app menu at `/comments/dashboard`. It lists all comment threads across spaces and supports filters for open/resolved and answered/unanswered threads.

See [docs/dashboard-api.md](docs/dashboard-api.md) for the programmatic dashboard API.

## curl examples

Comments are stored as JSON sidecar files under `{container}/.conflu/comments/{fileId}.json`.
There is no dedicated HTTP comments API yet; these examples show the underlying WebDAV/Graph layer.

Local dev defaults:

```bash
export OC_HOST='https://test.oc:9200'
export OC_USER='admin'
export OC_PASS='admin'
export OC_RESOLVE='--resolve test.oc:9200:127.0.0.1'
```

### List drives and get the space id

```bash
curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  "${OC_HOST}/graph/v1.0/me/drives" \
  | jq '.value[] | {name, driveAlias, id, webDavUrl: .root.webDavUrl}'
```

Example space id for the personal drive:

```bash
export SPACE_ID='3aa12485-865e-4ad4-8adc-39eab0fb6aee$4c96551e-ff46-46e9-9571-10af0ffaf62c'
```

### List comment sidecar files in a folder

Sidecars live next to the commented file or folder, for example:

`/Testordner/.conflu/comments/*.json`

```bash
curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  -X PROPFIND \
  "${OC_HOST}/dav/spaces/${SPACE_ID}/Testordner/.conflu/comments/" \
  -H 'Depth: 1'
```

### Read one sidecar document

```bash
export SIDECAR='3aa12485-865e-4ad4-8adc-39eab0fb6aee_4c96551e-ff46-46e9-9571-10af0ffaf62c_8af7a404-6220-4a1e-8fa7-653f16f82343.json'

curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  "${OC_HOST}/dav/spaces/${SPACE_ID}/Testordner/.conflu/comments/${SIDECAR}" \
  | jq .
```

The JSON contains `threads[]` with `status`, `comments[]`, and a `target` snapshot.
Filter ideas for scripts:

```bash
# open threads only
jq '.threads[] | select(.status == "open")'

# threads with at least one reply
jq '.threads[] | select([.comments[] | select(.deletedAt == null)] | length > 1)'

# last reply in a thread
jq '.threads[] | {
  threadId: .id,
  lastReply: ([.comments[] | select(.deletedAt == null)] | last)
}'
```

### Resolve the current file or folder name after a rename

The sidecar snapshot can contain an old `target.name` / `target.path`.
Ask WebDAV for the live resource instead:

```bash
curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  -X PROPFIND \
  "${OC_HOST}/dav/spaces/${SPACE_ID}/Testordner/Testfiel.txt" \
  -H 'Depth: 0'
```

The dashboard uses the same idea: it refreshes target metadata from WebDAV on load.

### Write a sidecar manually

```bash
curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  -X PUT \
  "${OC_HOST}/dav/spaces/${SPACE_ID}/handbook/.conflu/comments/file_1_2.json" \
  -H 'Content-Type: application/json' \
  --data-binary @comment-sidecar.json
```

Create the folders first if needed:

```bash
curl -k -s -u "${OC_USER}:${OC_PASS}" ${OC_RESOLVE} \
  -X MKCOL \
  "${OC_HOST}/dav/spaces/${SPACE_ID}/handbook/.conflu/comments/"
```

## Build

```bash
pnpm build
```

Production output is in `dist/`. Deploy to OpenCloud's web apps directory (see [web applications docs](https://docs.opencloud.eu/docs/admin/configuration/web-applications)).

## Tests

```bash
pnpm test:unit
```
