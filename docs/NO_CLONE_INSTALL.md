# Vexa No-Clone Install (Docker)

This guide lets users deploy Vexa **without cloning the repository**.

## 1) Create a stack directory

```bash
mkdir -p ~/vexa-stack/config
cd ~/vexa-stack
```

## 2) Download required files directly from GitHub

```bash
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/MS2620/vexa/master/docker-compose.yml
curl -fsSL -o config/rclone.conf https://raw.githubusercontent.com/MS2620/vexa/master/config/rclone.conf
curl -fsSL -o config/zurg.yml https://raw.githubusercontent.com/MS2620/vexa/master/config/zurg.yml.example
```

## 3) Set required host mount paths

```bash
sudo mkdir -p /mnt/zurg /mnt/plex_symlinks
sudo chmod 755 /mnt/zurg /mnt/plex_symlinks
```

## 4) Configure Real-Debrid token in `config/zurg.yml`

Replace this line:

```yml
token: YOUR_REAL_DEBRID_TOKEN_HERE
```

with your real token from https://real-debrid.com/apitoken.

## 5) Create `.env`

```bash
cat > .env <<'ENV'
SESSION_SECRET=replace_with_a_long_random_secret_min_32_chars
PLEX_CLAIM=
VEXA_IMAGE=ghcr.io/ms2620/vexa:latest
# SECURE_COOKIES=true
ENV
```

Notes:
- `PLEX_CLAIM` is only needed when claiming a fresh Plex container.
- Keep `VEXA_IMAGE` as default unless you want to pin a specific tag.

## 6) Start the stack

```bash
docker compose pull
docker compose up -d
```

## 7) Open Vexa

- App: http://localhost:3000
- First run redirects to `/setup`

At setup, enter:
- Admin username/password
- TMDB API key
- Real-Debrid token
- Plex URL/token
- Plex movie & TV library IDs

## Updates

```bash
cd ~/vexa-stack
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/MS2620/vexa/master/docker-compose.yml
curl -fsSL -o config/rclone.conf https://raw.githubusercontent.com/MS2620/vexa/master/config/rclone.conf
docker compose pull
docker compose up -d
```

## Optional: Publish this as GitHub Wiki

Copy this page to your repo wiki as:
- `Home`
- or `No-Clone-Install`
