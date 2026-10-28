# Gaming Genius

Existing GitHub Pages website: https://kaedota.github.io/gaminggenius/

## Website refresh — October 2026

Static HTML/CSS/JavaScript, no framework, backend or paid service required. Keep publishing from the repository's existing Pages branch/root. The custom domain configuration has not been changed.

- `index.html`, `styles.css`, `app.js`: responsive public website, searchable season rankings, category-filtered event archive and event details.
- `data/events.json`: archive content. `completed`, `series`, and `planned` have distinct labels. Missing dates/photos are stated, not invented. The artwork is graphic illustration, not event photography. Add confirmed events and actual photography here and in `assets/` as available. Current archive contains the known event series; it is not a complete individual weekly-event history.
- `data/season.json`: season rules and verified results. It starts as a draft with no fabricated players. Public rankings display only when `status` is `active`.
- `results-tool.html`: browser-only CSV preparation tool, deliberately not advertised as a secure admin panel. Uploaded records remain in page memory. No credentials, localStorage or automatic GitHub writes.
- `ranking.js`: shared validation/calculation logic, tested by `npm test` (or `node --test tests/*.test.js`).

## Maintain rankings

Open `results-tool.html` on the site. Set season dates/name, import verified CSV rows, inspect the calculated table, and download `season.json`. Commit it to `data/season.json` in this repository to publish through the existing GitHub Pages workflow. Download before leaving the page. Existing results load from the published JSON so subsequent CSVs append; duplicate event/player records are rejected.

CSV columns:

```
event_id,date,player_id,display_name,placement,participants
```

Use a stable GG player ID, public alias, ISO date, final placement and actual event participant count. Never upload birth dates, telephone numbers, private contact details or unapproved personal data. Verify player alias publication permission and event results before import. Do not import no-shows/disqualifications.

Draft rules: 100/70/50/35 points for places 1–4; 25 for 5–8; 15 for 9–16; 5 below. Best six results count. Ties use best counted placing, then counted wins; remaining ties share rank (1,1,3). One placement award per player/event. All eligible events use the same scale and must be announced before entry. This is an independent GG system, not another organisation's ranking. Draft rules, season dates, event eligibility and correction deadline need organiser confirmation before activation. Import tools validate structure, not whether results are true. This is an event-points leaderboard, not an opponent-strength/Elo rating.

## Content requiring confirmation

- Full dates and verified outcomes for Centro and individual weekly events.
- Individual TCG/board-game event records rather than the current collection entry.
- Little Racers II advertised May dates versus June project wrap-up (both explained in detail).
- Actual event photos/videos, final standings and publication permissions.
- Elmina is proposed for 7–8 November 2026 and is not shown as completed. Final programme/registration/official designation is not asserted.
- No unverified total audience, views or attendance statistics from the July site are retained.

## Preview

Serve the repository over HTTP; JSON and ES modules do not work through `file://`. For local preview, use any static HTTP server. Run `node build.mjs` to prepare `dist/` if needed. Production remains on the existing GitHub Pages branch/root; no alternate hosting is configured.
