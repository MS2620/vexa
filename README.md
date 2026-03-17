<div align="center">
  <h1>🍿 Vexa</h1>
  <p><strong>A beautifully self-hosted media request dashboard for homelabs.</strong></p>

[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](#)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](#)

</div>

## ✨ Features

- 🔗 **Real-Debrid Integration** – Seamless streaming via Real-Debrid.
- 🚀 **Zurg + rclone Workflow** – Fast mounting and symlinking directly to Plex.
- 🎬 **Plex Integration** – Deep library sync, availability checks, and continuous playback shortcuts.
- 👥 **Comprehensive UI** – Integrated request management, user approvals, settings, and live logs.

---

## 📋 Prerequisites

### 🔑 Accounts / API

- **TMDB API key**
- **Real-Debrid API token**
- **Plex URL + Plex token**

### 💻 Software

- **Docker + Docker Compose**

### 🧩 FUSE / Mount Requirement (Important)

Vexa uses `rclone mount` with FUSE (`/dev/fuse`) for the Zurg mount, so this stack requires a Linux environment with FUSE support.

- **Linux (recommended):** Install FUSE (`fuse3` or distro equivalent), ensure `/dev/fuse` exists, then run this stack normally.
- **macOS:** Run Vexa in a Linux VM or Linux host (recommended). Docker Desktop on macOS is not a reliable target for this FUSE-based mount workflow.
- **Windows:** Run Vexa in WSL2 (Linux distro with Docker Engine) or a Linux VM/host. Native Docker Desktop on Windows is not a reliable target for `/dev/fuse` passthrough.

---

## 🚀 Quick Start (No Clone, No Curl)

Use this flow if you want users to create files manually and run Vexa without cloning the repository.

### 1) 📁 Create stack directory

```bash
mkdir -p ~/vexa-stack/config
cd ~/vexa-stack
```

### 2) 📂 Create host mount paths (Linux environment)

```bash
sudo mkdir -p /mnt/zurg /mnt/plex_symlinks
sudo chmod 755 /mnt/zurg /mnt/plex_symlinks
```

### 3) 🐳 Create `docker-compose.yml`

Create `~/vexa-stack/docker-compose.yml`:

```yaml
services:
  zurg:
    image: ghcr.io/debridmediamanager/zurg-testing:latest
    container_name: zurg
    restart: unless-stopped
    volumes:
      - ./config/zurg.yml:/app/config.yml:ro
      - zurg-data:/app/data

  rclone:
    image: rclone/rclone:latest
    container_name: rclone
    restart: unless-stopped
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor:unconfined
    devices:
      - /dev/fuse:/dev/fuse:rwm
    volumes:
      - ./config/rclone.conf:/config/rclone/rclone.conf:ro
      - type: bind
        source: /mnt/zurg
        target: /mnt/zurg
        bind:
          propagation: shared
    command: >
      mount zurg: /mnt/zurg
      --allow-non-empty
      --allow-other
      --dir-cache-time 10s
      --vfs-cache-mode off
      --no-checksum
    depends_on:
      - zurg

  app:
    image: ${VEXA_IMAGE:-ghcr.io/ms2620/vexa:latest}
    pull_policy: always
    container_name: vexa
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - SESSION_SECRET=${SESSION_SECRET:?SESSION_SECRET env var is required}
      - DB_PATH=/app/data/database.sqlite
      - DEBRID_MOUNT=/mnt/zurg/__all__
      - PLEX_SYMLINK_ROOT=/mnt/plex_symlinks
    volumes:
      - vexa-data:/app/data
      - type: bind
        source: /mnt/zurg
        target: /mnt/zurg
        bind:
          propagation: slave
      - /mnt/plex_symlinks:/mnt/plex_symlinks
    depends_on:
      - rclone

  plex:
    image: linuxserver/plex:latest
    container_name: plex
    restart: unless-stopped
    network_mode: host
    environment:
      - PUID=1000
      - PGID=1000
      - VERSION=docker
      - PLEX_CLAIM=${PLEX_CLAIM:-}
    volumes:
      - plex-config:/config
      - /mnt/plex_symlinks:/mnt/plex_symlinks:ro
      - type: bind
        source: /mnt/zurg
        target: /mnt/zurg
        bind:
          propagation: shared
    depends_on:
      - rclone

volumes:
  vexa-data:
    name: debrid-data
  zurg-data:
  plex-config:
```

### 4) ⚙️ Create `config/rclone.conf`

Create `~/vexa-stack/config/rclone.conf`:

```ini
[zurg]
type = webdav
url = http://zurg:9999/dav
vendor = other
```

### 5) 🛠️ Create `config/zurg.yml`

Create `~/vexa-stack/config/zurg.yml`:

```yaml
zurg: v1

token: YOUR_REAL_DEBRID_TOKEN_HERE

port: 9999
concurrent_workers: 20
check_for_changes_every_secs: 10
retain_folder_name_extension: false
retain_rd_torrent_name: true

directories:
  __all__:
    group_order: 10
    group: all
    filters:
      - regex: /.*/
```

Replace `YOUR_REAL_DEBRID_TOKEN_HERE` with your token from https://real-debrid.com/apitoken.

### 6) 🔐 Create `.env`

Create `~/vexa-stack/.env`:

```env
SESSION_SECRET=replace_with_a_long_random_secret_min_32_chars
PLEX_CLAIM=
VEXA_IMAGE=ghcr.io/ms2620/vexa:latest
# SECURE_COOKIES=true
```

Notes:

- `SESSION_SECRET` is required (32+ chars)
- `PLEX_CLAIM` is only needed when claiming a fresh Plex container
- Keep `VEXA_IMAGE` default unless pinning a specific tag

### 7) 🏁 Start Vexa

```bash
docker compose pull
docker compose up -d
```

### 8) 🌐 Open the app

- **App:** `http://localhost:3000`
- First run automatically redirects to `/setup`

---

## 🧙‍♂️ First-Run Setup Wizard

At `/setup`, enter:

1. Admin username/password
2. TMDB API key
3. Real-Debrid token
4. Plex URL/token
5. Plex movie & TV library IDs

Then sign in at `/login`.

---

## 🔄 Updating

From your `~/vexa-stack` directory:

```bash
docker compose pull
docker compose up -d
```

---

## 🚑 Troubleshooting

### 🔄 Redirect loop to `/setup`

- Complete the setup wizard fully.
- Ensure the TMDB key was properly saved.
- Check logs: `docker compose logs -f app`

### ❌ Plex unreachable

- Verify `plex_url` includes `http://` or `https://`.
- Verify the Plex token.
- Ensure the container can reach your Plex host.

### 🔗 Symlinks not created

- Ensure `/mnt/zurg` is correctly mounted by rclone.
- Ensure `/mnt/plex_symlinks` is writable by the app container.
- Ensure the `DEBRID_MOUNT` path exists within the container.

---

## 🛡️ Security Best Practices

- 🚫 **Never** commit your `.env` file to version control.
- 🔑 Use a strong, generated string for `SESSION_SECRET`.
- 🔒 Set `SECURE_COOKIES=true` in `.env` if using a reverse proxy with HTTPS.
