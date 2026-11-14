# Deploying Grex Theme Builder (`--read-only` Docker & GrabLab CMS v1.0.0 Guide)

This directory contains the hardened production deployment manifest for **Grex Theme Builder**, built cleanly on **GRAB (`v1.1.0`)**, **GrabLab CMS (`v1.0.0`)**, and **Grex JS (`v1.0.0`)**.

> **Zero-Secrets Git Policy:** Never commit real server IP addresses, private domains, database passwords, OAuth secrets, or `GRABLAB_MASTER_KEY` values to Git. Supply all secrets via an untracked `.env` file or your container secret manager.

---

## 1. Two Supported `--read-only` Hosting Modes

Both services in [`docker-compose.yml`](docker-compose.yml) run with an immutable root filesystem (`read_only: true`, equivalent to `docker run --read-only`), drop all Linux capabilities (`cap_drop: ["ALL"]`), block privilege escalation (`no-new-privileges:true`), and mount `/tmp` as `noexec,nosuid`.

### Mode A: Standalone Grex Theme Builder Studio (`grex-builder-studio`)
Runs `src/studio.grab` as a standalone Studio, Revisions, and AI MCP layout workspace.

| Host Path | Container Path | Access | Purpose |
|---|---|---|---|
| `../storage` | `/app/storage` | `rw` | SQLite database (`storage/studio.db`) & auto-generated `GRAB-DESIGN-SYSTEM.md` |
| `../public/grex` | `/app/public/grex` | `rw` | Zero-FOUC compiled `tokens.css` & `builder.css` written **before** cache invalidation |
| Container image | `/app/src`, `/app/views`, `/app/theme`, `/app/public/theme` | `ro` (immutable rootfs) | Verified application source, templates, and synced browser modules |

### Mode B: GrabLab CMS v1.0.0 Integrated (`grablab-cms`, profile `grablab-integrated`)
Mounts **Grex Theme Builder** read-only into a running **GrabLab CMS `v1.0.0`** container as an exclusive `mode: "visual"` theme.

| Host Path | Container Path | Access | Purpose |
|---|---|---|---|
| `../theme` | `/app/themes/grex-builder` | `ro` | Exclusive `mode: "visual"` manifest (`theme.json`) and 11 `.grab.html` templates |
| `../public/theme` | `/app/public/themes/grex-builder` | `ro` | Synced Grex Studio static UI scripts (`studio.js`, `preview-host.js`, `builder.css`, `theme.css`) |
| `../public/grex` | `/app/public/grex` | `rw` | Shared compiled CSS target (`tokens.css` & `builder.css`) served via `server.asset` (`?v=<sha256>`) |
| `./grablab-storage` | `/app/storage` | `rw` | GrabLab CMS persistent storage / SQLite DB |
| `./grablab-uploads` | `/app/uploads` | `rw` | GrabLab sanitized binary media uploads (`--allow-write /app/uploads`) |

---

## 2. Environment Setup (Copy, Never Commit `.env`)

Create an untracked `.env` file alongside [`docker-compose.yml`](docker-compose.yml):

```env
# Standalone Studio
GREX_BUILDER_IMAGE=grex-builder-studio:v1.0.0
GREX_STUDIO_PORT=8080
GREX_TRUSTED_PROXY=127.0.0.1

# Optional GrabLab Integrated Profile (`--profile grablab-integrated`)
GRABLAB_IMAGE=grablab-cms:v1.0.0
GRABLAB_PORT=8081
GRABLAB_MASTER_KEY=replace-with-32-plus-random-bytes-at-runtime
GRABLAB_MAX_UPLOAD_BYTES=10485760
GRABLAB_TRUSTED_PROXY=127.0.0.1
```

---

## 3. First-Time Studio Migrations

Run the cumulative Studio and Revisions migrations once before launching the standalone container:

```sh
grab migrate --db-config grab.data.json --allow-db main:migrate migrations/001_studio_schema.grab
grab migrate --db-config grab.data.json --allow-db main:migrate migrations/002_revisions_schema.grab
```

Start Standalone Studio:

```sh
docker compose -f deploy/docker-compose.yml up -d
```

Start both Standalone Studio and GrabLab CMS Integrated:

```sh
docker compose -f deploy/docker-compose.yml --profile grablab-integrated up -d
```

---

## 4. Direct `docker run --read-only` Reference (Standalone)

```sh
docker run --rm -d \
  --name grex-builder-studio \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -p 127.0.0.1:8080:8080 \
  -v "$(pwd)/storage:/app/storage:rw" \
  -v "$(pwd)/public/grex:/app/public/grex:rw" \
  -e GREX_STATIC_DIR="/app/public/grex" \
  -e GREX_DESIGN_SYSTEM_PATH="/app/storage/GRAB-DESIGN-SYSTEM.md" \
  grex-builder-studio:v1.0.0 \
  grab serve \
    --addr 0.0.0.0:8080 \
    --allow-public \
    --allow-scripts \
    --diagnostics production \
    --log-format json \
    --trusted-proxy 127.0.0.1 \
    --allow-read /app \
    --allow-write /app/public/grex \
    --allow-write /app/storage \
    --allow-env GREX_STATIC_DIR,GREX_DESIGN_SYSTEM_PATH \
    --db-config /app/grab.data.json \
    --allow-db main:read-write \
    --platform-config /app/grab.platform.json \
    --allow-cache studio:read-write \
    --static /app/public \
    --max-body-bytes 15728640 \
    /app/src/studio.grab
```

---

## 5. Health & Readiness Endpoints

- **Liveness:** `GET /_health` → `200 OK` (`{"status":"ok","engine":"grex-visual",...}`)
- **Readiness:** `GET /_ready` → `200 OK` (`{"status":"ready","engine":"grex-visual",...}`)
