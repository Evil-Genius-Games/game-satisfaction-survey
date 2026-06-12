# Verification Notes

## Survey flow browser check

Observed on `http://localhost:3000` with the existing local Next.js dev server:

1. The branded survey landing screen loads with the Evil Genius Games logo, dark cinematic background, and first question, `What convention are you attending?`.
2. Selecting `Gen Con` advances to `Who was your GM / Game Master?`.
3. Selecting `Alex Morgan` advances to `What adventure did you play?`, with adventure choices filtered to `Everyday Heroes: The Vault` and `Kong: Skull Island Cinematic Adventure`.

Next verification steps: select an adventure and confirm the restored rating sequence appears as GM 1–5, adventure 1–5, then NPS/referral 1–10.
4. After selecting `Everyday Heroes: The Vault`, the first restored rating question appeared as `Rate the GM from 1 to 5.` with exactly five rating buttons, 1 through 5.
5. After selecting a GM rating and advancing, the second restored rating question appeared immediately next as `Rate the adventure from 1 to 5.` with exactly five rating buttons, 1 through 5.
6. After selecting an adventure rating and advancing, the third restored rating question appeared immediately next as `How likely are you to recommend this game to a friend?` with exactly ten rating buttons, 1 through 10. This confirms the live survey sequence is GM 1–5, adventure 1–5, then NPS/referral 1–10.

## Admin panel browser check

1. Opened `http://localhost:3000/admin` using the local admin credentials configured in `.env.local`. The admin panel loaded and showed tabs for `Dropdown Options`, `GM Associations`, `Graphs`, `Responses`, `GM Interest Form`, and `Settings`.
2. Switched to the `Graphs` tab. The dashboard section `Rating Question Analytics` displayed the three restored reporting charts with the expected titles: `Rate the GM from 1 to 5.`, `Rate the adventure from 1 to 5.`, and `How likely are you to recommend this game to a friend?`.
3. The admin reporting scales matched the survey configuration: the GM and adventure charts use 1–5 buckets, and the NPS/referral chart uses 1–10 buckets. All three charts loaded without UI errors in the visible dashboard content.

## Homepage and admin login refresh browser check

The refreshed public survey homepage was opened locally at `http://localhost:3000/`. It displays the official Evil Genius Games logo, the `Mission Debrief` kicker, the `Unlock your $5 reward` headline, on-brand supporting copy, and the expected survey entry flow with a persistent coupon code banner.

The refreshed admin login page was opened locally at `http://localhost:3000/admin/login`. It displays the official Evil Genius Games logo, the `Evil Genius Survey Manager` title, the on-brand secret-lair copy, the `Mission Control` highlight card, domain-restricted login copy referencing `@evilgeniusgaming.com`, and the mode-aware `Launch dashboard` call to action.

Validation commands completed successfully: typecheck, tests, and lint all passed with 0 errors. Lint reported 166 warnings, which are pre-existing warnings related to console statements and explicit `any` usage.

Browser screenshots captured by the environment:

- Public survey homepage: `/home/ubuntu/screenshots/localhost_2026-06-08_01-30-13_5310.webp`
- Admin login page: `/home/ubuntu/screenshots/localhost_2026-06-08_01-30-25_1216.webp`
