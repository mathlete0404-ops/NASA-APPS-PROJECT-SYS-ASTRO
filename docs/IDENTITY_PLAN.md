# Who you are: login & identity — current state and improvement plan

Status: **proposal for the team**. The login and person-switching code was **not changed** in this
pass (the teammate owns it). Only the first-open setup was added, which creates a local profile.

## What exists today

| Piece | How it works now | Where |
| --- | --- | --- |
| Local profile (no account) | The first-open setup asks for call sign, role, mission phase, launch date and body mass, and stores them on the device (IndexedDB `crew-mirror:v2`). | `web/src/screens/Welcome.tsx`, `createProfile()` in `web/src/data/store.ts` |
| Switching person on one device | The header "Crew" dropdown switches the active profile. No PIN, so anyone holding the device can view anyone's data. | `web/src/App.tsx` (`setActiveCrew`) |
| Cloud account (optional) | Supabase email + password. On sign-in, the cloud profile's call sign becomes a local profile, cloud data is merged in, and this device's data for that call sign is uploaded. | `web/src/data/cloud.ts`, `onAccount()` in `store.ts` |
| Medical officer | The role is requested at sign-up and approved by an admin in SQL. RLS lets them read only their mission's crew, never edit it. | `supabase/migrations/*` |
| Mission | Joined by typing a mission code at sign-up. | `profiles.mission_code` |

## Gaps found

1. **Two identities can diverge.** The call sign from first-open setup (e.g. `MS3`) and the call sign
   used at sign-up can differ, which leaves two profiles on one device.
2. **Shared devices have no lock.** On a shared tablet, any crew member can open anyone's health data
   from the dropdown.
3. **Offline sync drops cloud writes.** When a signed-in user is offline, cloud uploads fail quietly.
   The data is safe on the device, but it only re-uploads on the next sign-in event. This conflicts
   with the offline-first design (no Wi-Fi in space).
4. **Mission codes are self-asserted.** Anyone who knows a code can join that mission, and its medical
   officer then sees them.
5. **Email sign-up needs the internet.** Confirmation emails and password resets can't work in flight.
6. **The medical-officer view reads only this device.** It doesn't yet use the cloud crew list
   (`missionCrew()` exists but isn't wired in).
7. **No account deletion** in the app.

## Proposed improvements (in priority order)

| # | Change | Effort | Notes |
| --- | --- | --- | --- |
| 1 | **Cloud outbox**, like the habitat server's: queue failed uploads in IndexedDB and retry on the `online` event and every 15 s | S | Fixes gap 3. The same pattern as `api.ts` `send()`/`flushOutbox()` |
| 2 | **"Link this profile"** at sign-up/sign-in: prefill the call sign from the local profile and offer to merge local data into the account | S | Fixes gap 1 |
| 3 | **Per-person PIN** (4–6 digits, hashed with WebCrypto, stored locally) asked when switching to another person's profile | M | Fixes gap 2. Works offline, no server needed |
| 4 | **Accounts issued before flight**: the mission admin creates crew accounts with an invite link, so there is no email confirmation in space; long-lived refresh tokens | M | Fixes gap 5. Supabase admin invite plus a sign-in link before launch |
| 5 | **Mission membership approval**: a `mission_members` table that the medical officer or admin approves; RLS keyed on approved membership | M | Fixes gap 4 |
| 6 | **Medical-officer view from the cloud** when online, falling back to this device | S | Fixes gap 6. Use `missionCrew()` |
| 7 | **Delete my account and data** in Settings (an RPC that deletes the user's rows, then the auth user) | S | Privacy |

Suggested order for the hackathon: 1 → 2 → 6, each a small, safe change. Items 3–5 are the blueprint
for after the event.
