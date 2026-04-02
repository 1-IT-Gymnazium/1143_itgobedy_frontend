# ITG Lunch App UI

Frontend for the ITG lunch management system, built with Vue 3 + Vite.

It supports:
- Firebase Google sign-in
- Cookie/JWT-based authenticated sessions with role-aware routing
- Student dashboard and lunch status
- Gifting lunch to another student
- Public lunch pool (donate/claim)
- Admin dashboard and tools
- NFC card scanning/assignment flows via a dedicated Socket.IO card-reader service

## What Runs in This Repository

This repository contains **two runtime services**:

1. **Vue frontend** (Vite dev server, default `http://localhost:5173`)
2. **Card reader bridge server** (`card-reader-server.cjs`, default `http://localhost:3001`)

Your main backend API (authentication, users, lunches, permissions, Socket.IO API on backend port) is a **separate project** expected at `http://localhost:5000` by default.

## Tech Stack

- Vue 3 (`<script setup>` + Composition API)
- Vue Router 4
- Vite 7
- Firebase Web SDK (Google auth)
- Socket.IO client/server
- Express (card-reader bridge service)
- Bootstrap Icons

## Architecture Overview

- `src/utils/api.js` handles authenticated HTTP requests and exposes app-level API helpers.
- `src/utils/socket.js` manages a singleton Socket.IO connection to the **main backend** (`VITE_API_URL` fallback `http://localhost:5000`) for real-time data (`user_info`, `students`, `lunches`, etc.).
- `card-reader-server.cjs` receives card UIDs (`POST /api/card-scan`) and broadcasts them via Socket.IO event `card_scanned`.
- Admin card screens (`CardScanner.vue`, `CardAssignment.vue`, `UserManagement.vue`) connect directly to card-reader server at `http://localhost:3001`.
- Detailed card-reader architecture: `CARD_READER_ARCHITECTURE.md`.

## Main Features

### Student
- Login with Google
- Dashboard with lunch status and profile
- Gift your lunch to another student
- Claim/donate from/to public lunch pool

### Admin
- Admin dashboard with lunch and user statistics
- Live card scanner screen for cafeteria serving
- Card assignment screen (bind scanned UID to student)
- User management (edit/delete users, card update support)

## Routes

- `/` login
- `/dashboard` student dashboard (auth required)
- `/gift-lunch` gift flow (auth required)
- `/public-pool` public pool (auth required)
- `/admin` admin dashboard (auth + admin JWT claim)
- `/admin/card-scanner` live scanner (auth + admin)
- `/admin/card-assignment` assign cards (auth + admin)
- `/admin/user-management` user CRUD (auth + admin)
- `/server-error` server/socket error page
- `/:pathMatch(.*)*` not found

Admin checks are done by decoding JWT cookie claims client-side (`isAdmin`, `is_admin`, `admin`, or `role === 'admin'`).

## Project Structure

```text
.
├── src/
│   ├── components/
│   │   ├── LoginPage.vue
│   │   ├── Dashboard.vue
│   │   ├── GiftLunch.vue
│   │   ├── PublicPool.vue
│   │   ├── AdminDashboard.vue
│   │   ├── CardScanner.vue
│   │   ├── CardAssignment.vue
│   │   ├── UserManagement.vue
│   │   ├── AppHeader.vue
│   │   ├── AppFooter.vue
│   │   ├── NotFound.vue
│   │   └── ServerError.vue
│   ├── composables/
│   │   ├── useAuth.js
│   │   ├── useNotifications.js
│   │   └── useSocketRetry.js
│   ├── plugins/
│   │   └── socket.js
│   ├── router/
│   │   └── index.js
│   └── utils/
│       ├── api.js
│       ├── firebase.js
│       ├── googleAuth.js
│       └── socket.js
├── card-reader-server.cjs
├── card-reader-client/
│   ├── pyscard_reader.py
│   └── requirements.txt
└── CARD_READER_ARCHITECTURE.md
```

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0` (from `package.json` engines)
- npm
- Running backend API service (separate repo, default `http://localhost:5000`)
- Optional for physical NFC scanning: Python 3 + PC/SC-compatible reader

## Environment Variables

Create `.env` in project root:

```env
# Main backend base URL for frontend API + backend Socket.IO
VITE_API_URL=http://localhost:5000

# Firebase auth config (required for Google login)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...

# Optional PIN for CardScanner protected navigation
VITE_CARD_SCANNER_PIN=1234
```

Notes:
- `VITE_CARD_SCANNER_PIN` defaults to `1234` if not set.
- Some card-reader URLs are currently hardcoded in admin components to `http://localhost:3001`.
- `CardScanner.vue` currently calls lunch endpoint using hardcoded `http://localhost:5000/api/lunch`.

## Install

```bash
npm install
```

## Run (Development)

### 1) Start frontend + card-reader bridge

```bash
npm run dev
```

This uses `concurrently` to run:
- `vite`
- `node card-reader-server.cjs`

### 2) Ensure backend API is running

Run your backend project separately (expected at `VITE_API_URL`, usually `http://localhost:5000`).

### 3) Open app

- Frontend: `http://localhost:5173`
- Card-reader bridge status: `http://localhost:3001/api/status`

## NPM Scripts

- `npm run dev` - starts Vite + card-reader bridge server
- `npm run build` - production build (`vite build`)
- `npm run preview` - preview built frontend

## Backend Contract Used by Frontend

### HTTP endpoints used

- `POST /api/verify-token`
- `POST /api/logout`
- `POST /api/assign_card`
- `DELETE /api/students/:id`
- `PUT /api/students/:id`
- `POST /api/give_lunch_direct`
- `POST /api/request_lunch`
- `POST /api/give_lunch`
- `POST /api/lunch` (used directly in `CardScanner.vue`)

### Backend Socket.IO events used

Request emits from frontend:
- `get_user_info`
- `get_lunches`
- `get_students`
- `get_all_students`
- `get_recent_lunches`

Expected responses/errors:
- `user_info_response` / `user_info_error`
- `lunches_response` / `lunches_error`
- `students_response` / `students_error`
- `all_students_response` / `all_students_error`
- `recent_lunches_response` / `recent_lunches_error`

## Card Reader Integration

### Card-reader bridge service (`card-reader-server.cjs`)

Default port `3001`, endpoints:
- `POST /api/card-scan` - receives `{ card_uid }` from Python client
- `POST /api/simulate-scan` - test scans manually
- `GET /api/status` - diagnostics

Socket events:
- emits `card_scanned` with `{ uid }`
- emits `reader_status`

### Optional Python hardware client

In `card-reader-client/`:

```bash
cd card-reader-client
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python pyscard_reader.py
```

Supported env vars for Python client:
- `SERVER_URL` (default `http://localhost:3001`)
- `READER_NAME` (optional reader name hint)

### Simulate a scan without hardware

```bash
curl -X POST http://localhost:3001/api/simulate-scan \
  -H "Content-Type: application/json" \
  -d '{"card_uid":"ABC123DEF456"}'
```

## Troubleshooting

- **Cannot log in with Google**: verify Firebase env vars and authorized domains in Firebase Console.
- **Redirects to `/server-error`**: backend Socket.IO may be down/unreachable; check backend process and CORS.
- **No card events in admin screens**: ensure `card-reader-server.cjs` is running on `3001` and not blocked by firewall/CORS.
- **Card reader server port conflict**: set `PORT` before start, e.g. `PORT=3002 node card-reader-server.cjs`.
- **No physical card detection**: verify PC/SC drivers/service and Python dependencies (`pyscard`, `pyserial`).

## Deployment Notes

For production, deploy as separate services:

1. **Frontend** (static hosting: Vercel/Netlify/Nginx, etc.)
2. **Main backend API + backend Socket.IO**
3. **Card-reader bridge service** near reader hardware/network

Before production:
- Set production `VITE_API_URL`
- Replace hardcoded URLs in admin card components with env-driven values
- Configure strict CORS origins in both backend and card-reader server
- Ensure secure cookie settings and HTTPS everywhere

## Additional Documentation

- Card reader details and flow diagrams: `CARD_READER_ARCHITECTURE.md`
