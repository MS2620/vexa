# Vexa

Vexa is a self-hosted media request dashboard for homelabs. It combines:

- Real-Debrid for source/search
- Zurg + rclone mount for local filesystem access
- Plex for library playback and availability checks
- A Next.js app for requests, approval flow, settings, users, and logs

## What You Get

- Request movies/series and track status
- Approve/deny requests
- Check availability in Plex
- Optional symlink sync flow for Plex-friendly library paths
- Admin/user auth with session cookies
- Setup wizard on first run

---

## Prerequisites

### Required Accounts / API

- TMDB API key
- Real-Debrid API token
- Plex server URL + Plex token

### Required Software

- Docker + Docker Compose (recommended deployment)
- OR Node.js 20+ and npm (local dev mode)

### Host Directories (Docker stack)

Create these on the host machine:

```bash
sudo mkdir -p /mnt/zurg /mnt/plex_symlinks
sudo chmod 755 /mnt/zurg /mnt/plex_symlinks
```

These paths are used by:

- `rclone` mount target: `/mnt/zurg`
- Plex symlink library root: `/mnt/plex_symlinks`

---

## Quick Start (Docker, Recommended)

### 1) Clone and enter project

```bash
git clone https://github.com/MS2620/vexa.git
cd vexa
```

### 2) Configure Zurg

Copy example config and insert your RD token:

```bash
cp config/zurg.yml.example config/zurg.yml
```

Edit `config/zurg.yml`:

```yml
token: YOUR_REAL_DEBRID_TOKEN_HERE
```

### 3) Create `.env`

Create `.env` in project root:

```env
SESSION_SECRET=replace_with_at_least_32_characters
PLEX_CLAIM=claim-xxxxxx
```

Notes:

- `SESSION_SECRET` is required
- `PLEX_CLAIM` is usually only needed on first Plex boot
- App image defaults to `ghcr.io/ms2620/vexa:latest`
- To pin/override image tag, add this to `.env`:

```env
VEXA_IMAGE=ghcr.io/ms2620/vexa:latest
```
- To use secure auth cookies behind HTTPS reverse proxy, also set:

```env
SECURE_COOKIES=true
```

### 4) Pull and start stack

```bash
docker compose pull
docker compose up -d
```

### 5) Open app

- Vexa UI: `http://localhost:3000`
- On first run, you will be redirected to `/setup`

---

## First-Run Setup Wizard

At `/setup`, complete:

1. Admin username + password
2. Integration settings:
   - TMDB API key
   - Real-Debrid token
   - Plex URL (example: `http://192.168.1.10:32400`)
   - Plex token
   - Plex Movie library ID
   - Plex TV library ID

After submit, log in at `/login`.

---

## Finding Plex Values

### Plex URL

Usually:

- `http://<your-server-ip>:32400`

### Plex Token

You can retrieve from Plex Web requests (browser devtools/network) or from Plex docs/tools you already use in your homelab.

### Plex Library IDs

Open in browser (replace URL/token):

```text
http://<plex-url>/library/sections?X-Plex-Token=<token>
```

Find your movie and TV section keys (numeric IDs).

---

## Local Development (without Docker)

Use this mode for UI/API development. You can run without zurg mount, but symlink creation will be skipped until mount paths exist.

### 1) Install deps

```bash
npm install
```

### 2) Create env file

Create `.env.local`:

```env
SESSION_SECRET=replace_with_at_least_32_characters
DB_PATH=./database.sqlite
DEBRID_MOUNT=/mnt/zurg/__all__
PLEX_SYMLINK_ROOT=/mnt/plex_symlinks
# SECURE_COOKIES=false
```

### 3) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Configuration Reference

### Environment Variables

- `SESSION_SECRET` (required): session encryption secret (32+ chars)
- `DB_PATH` (optional): sqlite file path
  - Default local: `./database.sqlite`
  - Default container: `/app/data/database.sqlite`
- `DEBRID_MOUNT` (optional): zurg mount path used for symlink source
  - Default: `/mnt/zurg/__all__`
- `PLEX_SYMLINK_ROOT` (optional): root where Plex-visible symlinks are created
  - Default: `/mnt/plex_symlinks`
- `SECURE_COOKIES` (optional): set `true` for HTTPS-only cookies
- `PLEX_CLAIM` (optional): for first Plex container claim

### Persistent Data

- SQLite DB in Docker volume `vexa-data` mounted at `/app/data` (mapped to existing `debrid-data` volume name for compatibility)
- Zurg data in volume `zurg-data`
- Plex config in volume `plex-config`

---

## Common Commands

```bash
# dev
npm run dev

# lint
npm run lint

# production build (local)
npm run build
npm run start

# docker stack
docker compose pull
docker compose up -d
docker compose logs -f app
docker compose down
```

---

## Operational Notes

- Middleware enforces setup flow and auth redirects.
- If app is not configured (`tmdb_key` missing), users are redirected to `/setup`.
- If not logged in, protected routes redirect to `/login`.
- Symlink creation is skipped safely when `DEBRID_MOUNT` is unavailable.

---

## Troubleshooting

### App keeps redirecting to `/setup`

- Complete setup wizard fully
- Confirm settings row was saved (TMDB key not empty)
- Check app logs:

```bash
docker compose logs -f app
```

### Plex status shows unreachable

- Verify `plex_url` includes protocol (`http://`)
- Verify Plex token is valid
- Confirm Plex is reachable from app container/network

### Requests never become available

- Verify correct Plex movie/TV library IDs
- Ensure Plex metadata has TMDB GUIDs or title matches
- Re-run status/sync from app settings page

### Symlinks not created

- Ensure `/mnt/zurg` is mounted by rclone
- Ensure `DEBRID_MOUNT` path exists and is readable in app container
- Ensure `/mnt/plex_symlinks` is writable by app container user

---

## Security Notes

- Do not commit `.env` or secrets.
- Use strong `SESSION_SECRET` values.
- Use HTTPS + `SECURE_COOKIES=true` when exposed beyond trusted LAN.

---

## Tech Stack

- Next.js 16 (App Router)
- React 19
- SQLite (`sqlite` + `sqlite3`)
- iron-session
- Tailwind CSS 4
