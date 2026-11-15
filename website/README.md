# Astronoma

Standalone website and local Node.js backend. The Streamlit app is separate and is not used here.

## Start in VS Code (PowerShell)

Stop the previous website server with Ctrl+C, then run:

```powershell
cd B:\astro-nama\website
npm.cmd install
npm.cmd run check
npm.cmd run dev
```

Open http://127.0.0.1:4173/ and refresh the browser. Node.js 22.13 or later is required. `npm.cmd` avoids the PowerShell npm.ps1 execution-policy error.

## Connect free-tier Hinglish AI

1. Create a Gemini API key in https://aistudio.google.com/api-keys using a project on the free tier.
2. Copy `.env.example` to `.env` inside **website**, not the parent folder. Do not overwrite an existing .env.
3. Replace `paste_your_key_here` with your key. Set `GEMINI_MODEL` to an available text model on your free plan (example: `gemini-3.5-flash-lite`; availability changes).
4. Restart the Node server. Open Ask Astronoma and accept its data-sharing notice before sending.

The key is read only by the server and is never served to the browser. No key is needed for local chart calculations or numerology. The app never upgrades billing, retries a different paid model, or automatically switches providers. **Using a key on a billed project can still incur charges**; the code cannot verify your provider billing plan. Local request limits are 40 API requests/minute and 100 AI attempts/day; these limits reset when the process restarts. They are development controls, not a provider spending cap.

AI chat sends the question, up to 12 recent messages, and server-calculated chart placements. It does not automatically include raw name, birthplace, birth time, coordinates, or DOB. The user may still type personal information into their own messages. Free-tier content may be used by Google to improve its products. Check current provider terms and model quotas before use.

## Chart flow

Open Your kundali, enter birth details, then **Find birthplace** and select the correct result. Coordinates and IANA timezone can also be entered manually. Save details, then calculate the chart. Legacy browser profiles need coordinates and timezone added before calculation.

- Astronomy Engine computes geocentric positions for Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn.
- Sidereal conversion uses a documented **approximate Lahiri-style ayanamsa**: 23.85305556 degrees at J2000 plus a precession polynomial. This is not the Swiss Ephemeris Lahiri implementation.
- Whole-sign houses use a geometrically calculated ascendant. Rahu and Ketu use mean lunar nodes.
- Moon longitude determines nakshatra/pada and the starting Vimshottari balance. Dasha dates use 365.25-day years; mahadasha and current antardasha are displayed.
- Luxon applies the IANA timezone rules at the birth date. Nonexistent or ambiguous DST times are rejected rather than guessed. Latitude outside (-66, 66) is not supported.
- Unknown birth time leaves personalized chart, houses and dasha unavailable; general AI chat and numerology remain available.

**Accuracy limit:** calculations are in development. Ayanamsa and dasha dates are approximate and are not yet independently verified against reference kundalis. Near sign/nakshatra boundaries, small method differences matter. This is not a certified professional ephemeris implementation. The engine tests include broad astronomical sanity checks and internal invariants, not high-precision reference validation.

Birthplace lookup uses GeoNames via Open-Meteo. Its free hosted API is for non-commercial use; choose an appropriate license/provider before a commercial launch. Only the city search term is sent; no key is required. Offline search reports an error and offers manual coordinates.

## Data and deployment

Birth profiles and saved numerology/chart snapshots stay in localStorage in the current browser and origin. Optional accounts store an explicitly uploaded workspace copy in website/data/accounts.sqlite. Other users of the same browser profile can access that data. Profile deletion does not delete saved snapshots; those can be removed in Saved readings. Unsaved chat history stays in memory for this tab. Use Save in the chat toolbar to persist a conversation in browser-local storage; subsequent successful replies in that saved chat update the same entry. Saved conversations can be searched, filtered, read, downloaded, and resumed from Saved readings. Resume is blocked if the current birth profile differs from the saved context, and Gemini data consent is requested again.

The local server binds to 127.0.0.1, denies cross-origin API use, limits body size, and never serves .env, backend source, or account files. Hosted cloud access, deployment hardening, and divisional charts remain future stages. Do not expose this local prototype as a production service without designing those pieces.

## Verification

`npm.cmd run check` checks syntax, frontend route rendering, numerology, API routing/security/error paths, timezone validation, chart invariants, dasha logic, and Gemini request/error handling. Provider responses are mocked in automated tests; live Gemini requires your own key. Engine-dependent checks explicitly skip if packages are not installed. Browser layout and interaction verification are separate.

## References

- https://github.com/cosinekitty/astronomy/tree/master/source/js
- https://github.com/moment/luxon
- https://open-meteo.com/en/docs/geocoding-api
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/pricing

## Personal workspace features

- Dashboard highlights fetch the locally calculated chart and display ascendant, Moon rashi, nakshatra/pada and current approximate Vimshottari period. Empty, unknown-time and error states remain explicit. Refresh highlights recalculates them.
- Saved conversations survive reload in this browser and origin. New conversation starts a separate thread. Updating/removing a birth profile does not remove saved conversation snapshots.
- Plain-text downloads are available for conversations, charts, and numerology, including their method/interpretation notes. No AI request is needed to download an existing reading.
- Saved readings support title/message search and type filtering.

## Exploration tools

- Multiple birth profiles: add, switch, edit, and remove separate profiles. Switching starts a fresh chat context.
- Chart questions: select a planet or house to carry its calculated placement into chat. Sending still requires your action and Gemini consent.
- Name numerology: Pythagorean expression, soul urge, and personality numbers, with visible working and saved readings. Latin letters are supported; Y is treated as a consonant.
- Compatibility: compares calculated Moon signs, nakshatras, elements, and angular separation. It is not a full 36-Guna score.
- Transits: seven- or thirty-day sign-change timelines for seven classical planets, with natal whole-sign house context.
- Daily Panchang: sunrise, sunset, weekday, tithi, nakshatra, yoga, and karana at local sunrise. End times and muhurta are not calculated. The same approximate sidereal method applies.
- Voice: optional browser speech recognition fills the message field; optional speech synthesis reads the latest reply. Availability depends on browser support. Browser voice providers may process audio or text.
- Accounts: salted scrypt password hashes, seven-day HttpOnly sessions, per-user SQLite storage, and version checks to prevent stale uploads. Upload and download are explicit. Downloading creates a browser-copy backup before replacement. Back up the data directory to retain accounts. No password recovery is provided.

Account storage currently runs on this local server. Cross-device cloud sync requires a hosted backend, HTTPS, deployment configuration, and operational backups; it is not an external cloud service yet. New routes require restarting the server. If 4173 is occupied, the server chooses the next available port: open the URL printed in the terminal.
