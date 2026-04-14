# 🛡️ Server Architecture - Backend Documentation

This folder contains the core API, WebSocket handlers, and Database models for the Prode platform.

## 🏗 Stack Overview
*   **Runtime Engine**: Node.js (v20+) using ES Modules (`"type": "module"`).
*   **Framework**: Express.js mapped natively for rapid controller generation.
*   **Database**: PostgreSQL using **Prisma ORM** (`prisma/schema.prisma`).
*   **Realtime**: Socket.io configured for room-based networking.
*   **Security**: JSON Web Tokens for stateless Auth, Bcrypt for encrypting passwords, CORS to restrict origins, and Custom Middleware for protected routes.

---

## 🗺 Directory Structure

```text
/server
 ├── prisma/              # Schema declarations + Test initial Seeding scripts
 │    └── schema.prisma   # PostgreSQL DB schema source of truth
 ├── src/
 │    ├── config/         # Environment setup (dotenv, Express init, Socket init)
 │    ├── controllers/    # Route executors handling request parsing and response formatting
 │    ├── middleware/     # Global protections (Auth JWT Verify, Admin Verify, Global Error Catcher)
 │    ├── routes/         # Express Router mappings linking Endpoints -> Controllers
 │    ├── services/       # Core business logic separated from the HTTP layer. Ex: Scoring engine.
 │    ├── utils/          # Standardized Error handling logic
 │    └── app.js          # REST Server Entrypoint Configuration
 └── server.js            # Node Binary Entrypoint. Attaches HTTP and Socket.io to Port
```

---

## 🗄 Prisma Database Schema
The database uses a robust relational model to track interactions. Key models include:

*   **User**: Handles auth, theming configurations (`themePrimary`, etc).
*   **Player**: Global real-world players initialized dynamically.
*   **OutrightPrediction**: 1-to-1 relations mapping a User to their tournament guesses (Champion, TopScorer).
*   **DreamTeam**: 1-to-1 relation linking a User to 5 specific `Player` records plus dynamic layout `formation`.
*   **Group / GroupUser**: Many-to-Many logic. Tracks Group codes, admin roles within a group, and forced styling rules.
*   **Match / Prediction**: Daily interactions tracking score multipliers (the `isJoker` flag).
*   **Message**: Scalable message logs linked to isolated `Group`s for Socket historic fetching.

---

## 🔌 API Endpoints Matrix

| Module | Endpoint | Method | Security | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/register` | `POST` | Public | Account creation |
| **Auth** | `/api/auth/login` | `POST` | Public | Emits JWT Auth token |
| **Auth** | `/api/auth/profile` | `PUT` | Auth Required | Updates Name and Theme CSS Vars |
| **Matches** | `/api/matches` | `GET` | Auth Required | Fetches active matches globally |
| **Predictions** | `/api/predictions` | `POST` | Auth Required | Saves scores and computes Joker availability |
| **Groups** | `/api/groups` | `POST` | Auth Required | Creates new group |
| **Groups** | `/api/groups/join` | `POST` | Auth Required | Links user by short-invite code |
| **Groups** | `/api/groups/:id` | `GET` | Member Req | Fetches Leaderboard and historic Chat messages |
| **DreamTeam** | `/api/dreamteam/players` | `GET` | Auth Required | Resolves player catalog |
| **DreamTeam** | `/api/dreamteam` | `POST/GET`| Auth Required | Reads/Writes 5-a-side Dream Team layout |
| **Outrights** | `/api/outrights` | `POST/GET`| Auth Required | Reads/Writes Final Tournament guesses |
| **Admin** | `/api/admin/...` | `*` | SUPERADMIN | Platform management and resolving winners |

---

## ⚡ Real-time Sockets Architecture
Located in `src/config/socket.js`. Implements namespaced channels.

**Rooms**: Uses `#group_${groupId}` string identifiers.
**Events**:
*   `chat:join`: Client invokes to enter a space. Backend ensures JWT Auth check directly on the handshake.
*   `chat:message`: Broadcasts incoming payload to the targeted room + writes to `Message` DB table asynchronously to prevent IO bottlenecks.
*   `chat:history`: Backend emits an on-connect packet sending the latest 50 DB rows to the user smoothly.

---

## 🔧 Dev Workflow
```bash
# Push schema updates safely
npx prisma db push --accept-data-loss

# Seed Players
node prisma/seed_players.js

# Hot-reload Backend Server
npm run dev
```
