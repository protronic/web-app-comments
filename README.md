# web-app-comments

OpenCloud Web extension for file and document comments. Adds a sidebar panel in the Files app for discussing selected files and folders.

Comments are stored in WebDAV sidecar files (`.conflu/comments/`) so they work without a native comments API. See [docs/](docs/) for the storage model and planned native API.

## Development

Requires Docker, Docker Compose, and [pnpm](https://pnpm.io/installation).

```bash
pnpm install && pnpm build:w
docker compose up
```

Open `https://host.docker.internal:9200` (user `admin` / `admin`).

## Build

```bash
pnpm build
```

Production output is in `dist/`. Deploy to OpenCloud's web apps directory (see [web applications docs](https://docs.opencloud.eu/docs/admin/configuration/web-applications)).

## Tests

```bash
pnpm test:unit
```
