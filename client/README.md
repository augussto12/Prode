# 🎨 Client Architecture - Frontend Documentation

This folder contains the complete Progressive Web Application (PWA) client tailored for Prode Mundial 2026.

## 🚀 Stack & Core Technology
*   **Framework**: React 18 built upon the `Vite` bundler for instant Hot Module Replacement.
*   **Styling**: `Tailwind CSS` for utility-first layouts, supplemented by strict UI variables in `index.css`.
*   **State Management**: `Zustand` for seamless, unopinionated, context-free, global application states (e.g. JWT Auth states, Dynamic Theming configs).
*   **Routing**: `React Router DOM` v6.
*   **Network & Sockets**: `Axios` linked heavily via `services/api.js` to automatically attach JWT interceptors. `Socket.io-client` for real-time reactivity.
*   **Animations**: `framer-motion` integrated for micro-animations and smooth layout transitions (Used deeply in `DreamTeam.jsx` Pitch components).

---

## 📂 Architecture Map

```text
/client
 ├── public/              # Static Assets (apple-touch-icons, standard favicons)
 ├── src/
 │    ├── components/
 │    │    ├── chat/      # GroupChat component with bounded Socket integrations
 │    │    ├── dreamteam/ # Pitch layout and coordinate mathematics
 │    │    ├── layout/    # Top Navigation Bar, PWA Install prompt and Layout wrapper
 │    │    └── matches/   # Advanced MatchCard holding prediction inputs and Joker logic
 │    ├── pages/          # Full Route Views (Dashboard, Login, Profile, GroupView, etc)
 │    ├── services/       # API initialization mapping interceptors for 401s auto-logouts
 │    ├── store/          # Zustand Models (authStore.js, themeStore.js)
 │    ├── App.jsx         # App Entrypoint linking React Router and Contextual Hooks
 │    └── index.css       # Tailwind Bindings + the core "Glassmorphism" Design System logic
 ├── manifest.json        # Service worker parameters for PWA offline capabilities
 └── vite.config.js       # Bundler definitions attaching `vite-plugin-pwa` strategies
```

---

## 🎨 UI/UX System & Theming Engine
The application enforces a rigid **"Glassmorphism"** standard out-of-the-box. This uses transparent layering (`bg-white/5` and `backdrop-blur`) superimposed over deeply saturated gradients.

**Dynamic CSS Variables:**
By utilizing `Zustand` (`themeStore.js`), the application manipulates standard `:root` CSS variables real-time on `document.documentElement.style`.
When a user updates their theme on `Profile.jsx` or visits a custom group, these colors mutate live:
*   `--color-primary`, `--color-secondary`, `--color-accent`
*   `--color-bg-from`, `--color-bg-to`

This grants users infinite personalization without hardcoding React inline-styles everywhere.

---

## 🧩 Key Modules 

### Groups & Sockets (`GroupView.jsx` + `GroupChat.jsx`)
Resolves a 2-Col grid pattern. 
Upon mounting `GroupView`, a side-effect mounts the Socket listener inside `GroupChat`.
The chat relies on `initialMessages` mapped downwards from the backend, and injects incoming events instantaneously into local React states, enforcing an auto-scroll tail using `useRef`.

### Dream Team Fantasy (`DreamTeam.jsx` & `Pitch.jsx`)
Extremely complex visual mathematics. The `Pitch` receives a `formation` string directly mapping to `%` (Percentages) targeting Absolute positioning. It transitions smoothly when the formation state changes. Ensures logic blocks selecting overlapping players structurally.

### PWA Engine
Linked centrally in `main.jsx`. Binds a `window.addEventListener('beforeinstallprompt')`. This globally exposes the exact installation method, feeding it into a visual `DeferredPrompt` inside `PwaPrompt.jsx` for iOS heuristics, or native Android/Windows handlers.

---

## 🔧 Dev Workflow
```bash
# Standard local hot-reload
npm run dev

# Generate final chunks for raw production
npm run build
```
