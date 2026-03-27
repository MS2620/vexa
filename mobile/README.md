# Vexa Mobile (Expo)

This folder is the React Native migration target for the current Next.js dashboard.

## What this currently includes

- Expo + TypeScript app scaffold
- Mobile migration shell in `App.tsx`
- Section placeholders matching web app pages:
  - Discover
  - Movies
  - Series
  - Calendar
  - Requests
  - Search
  - Users
  - Logs
  - Blocklist
  - Settings

## Run the mobile app

1. Install dependencies (already done if scaffold command completed):
   - `npm install`
2. Set mobile environment values (copy `.env.example` to `.env`):
   - `EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3000`
3. Start Expo:
   - `npm run start`
4. Open in simulator/device:
   - `npm run android`
   - `npm run ios`
   - `npm run web`

## Important migration notes

- Keep Next.js API routes running as backend during migration.
- Mobile app should call the existing API routes first, then backend internals can be refactored later.
- Auth in mobile typically requires token-based flow rather than browser cookie-only session behavior.

## Suggested migration order

1. Authentication and session bootstrap
2. Discover + Movies + Series list screens
3. Media details screen (`/media/[type]/[id]` parity)
4. Requests and approvals flow
5. Notifications and push setup
6. Settings and admin tools (users, logs, blocklist)

## Validation

- `npm run typecheck`
- `npm run web` (quick visual check)
