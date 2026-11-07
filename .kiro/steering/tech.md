---
inclusion: always
---

# Tech Stack

## Core

- **TypeScript** — strict typing on all code.
- **Preact** — lightweight UI framework.
- **Vite** — build tool and dev server.
- **vite-plugin-pwa** — installable web app with offline support.

## Testing

- **Vitest** — unit and integration tests.
- **fast-check** — property-based testing for sweep logic and filter behavior.
- **Playwright** — end-to-end tests.

## Browser APIs

- **@mediapipe/tasks-vision** — Face Landmarker for blink and nod detection (video never uploaded).
- **Web Serial** — Arduino knock box connection.
- **Web Speech API** — text-to-speech synthesis using voices already on the laptop.

## Backend (Optional)

- **AWS Lambda** with **Amazon Bedrock** — Claude Haiku for sentence suggestions (only for spelled text, no video or patient identity).
- **GitHub Pages** — public HTTPS hosting.

## Hardware (Optional)

- **Arduino** — small sketch for knock-box sensor input (piezo or button).

## Rules

- Never add a dependency without asking first.
- Prefer native browser APIs over polyfills.
- Use fast-check for all property-based tests.
- Keep `src/core` pure: no DOM, no browser APIs, no side effects.
- The AI service provides sentence suggestions. The local word list provides word suggestions.
