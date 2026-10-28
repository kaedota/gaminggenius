# Gaming Genius — Black / Red Website V2

Existing GitHub Pages project: **kaedota/gaminggenius**
Public address: https://kaedota.github.io/gaminggenius/

This version implements Kae's approved black/red esports + Beyblade direction with the exact headline **BUILT FOR THE BATTLE.** It replaces the rejected cream/orange design. The existing GitHub Pages main/root publishing source and domain configuration are retained.

## Included

- Original GG logo rendered from the supplied PDF-compatible Illustrator file. Original colours and proportions retained; page margins cropped only.
- Two actual, approved cover photographs: Paradigm group photograph extracted from GG's report; Little Racers screenshot with black sidebars cropped. Lossless WebP copies retain decoded source pixel values. CSS frames the originals; click either photograph to see the whole image. No generative image edits or AI face changes are included.
- 8 main activity records: Paradigm, AEON, Centro Beyblade, Centro Pokémon TCG, JustPlay, Elmina, Little Racers I and II.
- 11 dated Night/Weekly Battle records, from 8 August to 30 October 2026; expandable archive.
- 2 undated posters retained separately as supplementary artwork, not invented extra tournaments.
- Original full posters plus lighter thumbnails. Entire posters are visible; click to read full artwork and details.
- Direct WhatsApp and two Instagram links, plus the original supplied QR images in a dialog.
- Elmina registration link, shown only while the event is upcoming or on its event dates.
- Searchable season leaderboard, player-result dialog, shared points calculation and CSV preparation tool. No fabricated players or results; Season 01 remains a draft.

## Local preview

Node is only needed for the preview copy and tests; the deployed website is plain static HTML/CSS/JS.

```
node build.mjs
node --test tests/*.test.js
```

Serve the project over HTTP (not `file://`). Use any local static HTTP server. GitHub Pages continues to serve the repository root. `dist/` is ignored; no hosting platform is added.

## Publish to the existing GitHub Pages repository

Upload/merge this folder's contents at the **root of kaedota/gaminggenius**, replacing corresponding files. Do not nest the whole folder inside another `gaminggenius/` directory. Include **assets/**, **data/** and **event-utils.js**. Keep any existing `CNAME` or GitHub Pages configuration. The archive intentionally does not include `.git/`, `dist/`, credentials, private event reports or generated face-altered images.

After committing, check the existing Pages deployment and refresh the public URL.

## Maintain activities

Edit `data/events.json`. Each record includes ID, category, dates, venue, copy, thumbnail and poster. Supported categories: `beyblade`, `esports`, `tcg`, `community`. `kind` is `mall`, `junior` or `weekly`.

- ISO `startDate` and `endDate` drive labels using Malaysia time. Historical dates are labelled **PAST EVENT**, not assumed proof of completion.
- Unknown dates remain null and are labelled **DATE TO BE ADDED**.
- Keep poster text in the original image; display corrected metadata separately.
- JustPlay's year is **2026**, explicitly confirmed by Kae, despite the original poster saying 2025.
- Little Racers I: 28 September 2025; II: 23–24 and 30–31 May 2026.
- Centro Beyblade's exact date is still unconfirmed.
- Slots/capacities and advertised prizes must not be described as actual turnout or paid results.
- Share an event with `#event/<event-id>` appended to the site URL.
- To add upcoming registration, set `registrationUrl`. Expired events do not display registration buttons automatically.

`data/supplemental.json` holds the two undated Night Battle artworks. Do not assign them a made-up date or count them twice.

## Maintain rankings

Open `results-tool.html` on the published site. It is a **browser-only preparation tool**, not a protected admin system. Imported records live in tab memory; download before leaving. It loads existing `data/season.json`, validates appended CSV records, previews rankings, and exports replacement JSON. It does not automatically write to GitHub.

CSV headers:

```
event_id,date,player_id,display_name,placement,participants
```

Use stable GG IDs, public player aliases and verified final standings. Do not include phone numbers, birthdays or private contact information. Exclude no-shows and disqualifications before import.

Draft points: champion 100, runner-up 70, third 50, fourth 35, places 5–8 get 25, 9–16 get 15, others 5. Best six results count. Equal totals use best counted placing, then counted wins; remaining ties share ranks (1,1,3). One award per player/event; no stacking of participation points. Eligible events must be announced before entry. This GG ranking is independent of other organisations' systems.

Confirm season dates, eligibility and correction deadlines before changing `status` from `draft` to `active`. No past results were automatically imported or retrospectively awarded points.

## Social / contact

- WhatsApp: exact URL decoded from the supplied QR, retained in `data/links.json` and the public button.
- Main Instagram: `@gaming_geniusmy`.
- Beyblade Instagram: `@ggeniusbeyblade`.
- Elmina registration: https://forms.gle/xL64RhokrHdTP4376
- Business email: gaminggeniusmy@gmail.com.

External forms/social URLs were extracted or supplied, not submitted or used to join groups. Changes to account links must update both `index.html` and `data/links.json`.

## Remaining owner input

- Exact date of the Centro Beyblade event.
- Date/association for the two supplementary Night Battle posters.
- Actual approved season rules, dates and verified results.
- Additional real event photographs/videos can be added later. Current posters are supplied by Kae, not stand-ins.

## Integration checks / 28 October 2026

- Preserve strict CSV closing-quote validation and fail-closed season import/export loading from the existing repository.
- Photographs, logo and usable supplied posters are copied byte-for-byte; no colour or face edits. Photo hover brightness adjustment removed.
- Empty supplied assets: weekly-0901-thumb.webp uses the supplied full poster; weekly-1011.webp falls back to the supplied thumbnail with a note; instagram-beyblade.webp is unavailable and its QR control is marked awaiting original. Direct Instagram link remains available.
- Elmina venue remains Elmina Lakeside Mall, explicitly reconfirmed by the owner. The registration form currently describes Near Elmina Sales Gallery; check the form for current details.
- JustPlay remains 13 September 2026; original poster is unchanged. Season remains draft with zero results.
