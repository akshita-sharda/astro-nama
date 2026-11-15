# Astronoma

**A celestial web experience for Vedic astrology, numerology, and natural Hinglish AI conversations.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-D8B36A?style=flat-square&logo=javascript&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-22.13+-33453A?style=flat-square&logo=nodedotjs&logoColor=white) ![Gemini](https://img.shields.io/badge/AI-Gemini-786194?style=flat-square) ![SQLite](https://img.shields.io/badge/Storage-SQLite-4F4059?style=flat-square&logo=sqlite&logoColor=white)

Astronoma evolves an earlier Streamlit experiment into a standalone, responsive website with a Node.js backend. It combines an animated celestial interface with locally calculated chart context and conversational explanations in Hinglish.

## Features

- Birth charts with planetary placements, whole-sign houses, nakshatras, and approximate Vimshottari periods.
- Gemini conversations grounded in server-calculated chart placements; planet and house questions can be opened directly in chat.
- Multiple birth profiles and a personal dashboard.
- Birth-date and Pythagorean name numerology with visible calculations.
- Moon-based compatibility factors without a fabricated matching score.
- Seven- and thirty-day planetary transit timelines.
- Daily Panchang values at local sunrise.
- Optional browser voice input and spoken replies.
- Searchable saved readings, resumable conversations, and text exports.
- Local accounts with hashed passwords, private sessions, and explicit version-checked workspace backups.
- Responsive layouts, celestial animations, and reduced-motion support.

## Run locally

Requires Node.js 22.13 or newer.

~~~powershell
cd website
npm.cmd install
npm.cmd run dev
~~~

On macOS/Linux, use npm instead of npm.cmd. Open the URL printed in the terminal. One server serves both the frontend and backend. This website does not require Streamlit.

For AI chat, copy website/.env.example to website/.env and add your own Gemini API key. Chart calculations and numerology do not require a key. Keep keys and account databases private. Provider quotas and billing depend on your account.

## Architecture

| Layer | Implementation |
| --- | --- |
| Interface | HTML, CSS, JavaScript, hash-based page navigation |
| Backend | Node.js HTTP server and same-origin JSON APIs |
| Chart calculations | Astronomy Engine and Luxon |
| AI explanations | Server-side Gemini integration |
| Browser workspace | LocalStorage profiles, readings, and saved conversations |
| Accounts | SQLite, salted scrypt password hashes, HttpOnly sessions |

## Verification

~~~powershell
cd website
npm.cmd run check
~~~

Includes frontend smoke checks and 20 automated backend tests for calculation invariants, API boundaries, account isolation, workspace conflicts, and AI request handling. Provider calls are mocked in automated tests; microphone behavior requires a supported browser and permission.

## Scope and accuracy

This is a local development project. Sidereal conversion uses an approximate Lahiri-style ayanamsa; dasha timing is approximate. Independent reference-kundali validation remains pending. Compatibility is a factor comparison rather than full 36-Guna matching. Panchang end times and muhurta are not calculated. Astrology and numerology are interpretive traditions, not scientifically established predictors.

Account backups currently live on the local server. Cross-device cloud access requires deployment, HTTPS, and operational hardening. GitHub hosts the source code; this repository does not represent a deployed live demo.

See [the website guide](website/README.md) for detailed setup, data flow, methods, and limitations.
