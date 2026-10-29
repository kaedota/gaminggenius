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
- Searchable season leaderboard, player-result dialog, shared points calculation and CSV preparation tool. No fabricated players or results; Season 01 is announced for 30 October–31 December 2026.

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

Use results-tool.html. It is a browser-only preparation tool, not an authenticated backend; export before leaving. It loads current results and archives and exports the entire season.json bundle. No automatic GitHub write. Season 01 is announced for 30 October–31 December 2026 with no players/results.

Cumulative-v2: Regular ×1 awards 20/15/10 to first/second/third, 7 to other confirmed Top Cut players, 5 to other actual participants. Double ×2 awards 40/30/20/14/10. Highest band only, never stacked. All valid events sum by unique Player ID within one season; no best-N cap. Ties remain best placing, then wins, then shared competition rank.

Event settings are in season.events[event_id]: multiplier (default 1, allowed 1/2), topCutSize (null means unknown), scoringMode (final-event or pending), title. Do not infer Top Cut from attendance. GG must confirm event eligibility/multiplier before registration; no historical event is automatically eligible. Only Halloween is currently designated eligible; all multipliers remain ×1. Other activities, including Elmina, are not automatically ranking events. Paradigm (six sessions), racers-2 (qualifiers/finals), weekly-0922 and weekly-0808 (two slots/player) use scoringMode=pending until GG confirms the award unit. Slot/session CSV awards are rejected, not silently added.

CSV required headers: event_id,date,player_id,display_name,placement,participants. Optional: season_id,top_cut,attendance,slot,session. Recommended template includes season_id,top_cut,attendance. top_cut=true/false; attendance=attended/no_show/registered/disqualified. No-show and registered-only rows may have blank placement and earn zero. Same-event metadata must agree. Unknown Top Cut requires an explicit boolean for placements after third. Conflicting configured flags are rejected. Do not include private contact data.

Import previews all old/new points before Apply. upsert key=(season_id,event_id,player_id): existing records are replaced on correction/re-save, not appended. Duplicate keys within one incoming batch are rejected as ambiguous. Invalid import is atomic. Event-setting changes preview recalculation before applying. No event multiplier supplied in CSV can override GG settings.

Set a verified season completed, export its final standings, then use Archive / New Season. This preserves the full completed season including scoring settings, raw results and finalRankings in archives; new season starts draft with empty results. Export includes every archive; public season selector exposes completed rankings/history. Archived seasons are read-only; historical corrections need a separate reviewed migration. Never clear history to start a season.

Migration audit: deployed season-01 had status=draft, results=[] and no prior archives on 29 Oct 2026. No real result requires recalculation. Previous unmerged 30/60 proposal is superseded. Data/events.json and all original media remain unchanged.

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

## Event recap video

Little Racers Challenge I (racers-1) includes the supplied Official Event Recap · Part 3 MP4 and poster under assets/videos/. Videos are optional event data. The native player loads on request, never autoplays, supports inline mobile playback and pauses when the dialog closes or its content changes. The WATCH EVENT RECAP button scrolls to the player. Share the existing #event/racers-1 URL; no event results or ranking points are inferred from the footage.

## Video Batch 01

Merge by event ID and deduplicate by src. Paradigm has three supplied promotional films; Centro Beyblade has one highlights film; The Game Genius_V0 event film belongs to Little Racers I, as corrected by the owner. Little Racers I has this event film plus its existing Part 3 recap; Little Racers II has no video from this batch. The event film and cover keep their existing little-racers-2-event-film-01 filenames to preserve references. No sixth batch film or placeholder is added. Each player preserves its own aspect ratio, uses native controls with preload=none and playsinline, and pauses on close or event changes. Starting another film pauses its siblings. Media and cover files are copied unchanged from GG-Videos-Fixed (1).zip.

## Season 01 public announcement
Published status=active means announced; visible phase is determined by Asia/Kuala_Lumpur calendar dates: before 2026-10-30 Starts 30 October, through 2026-12-31 Season Live, then Season Ended. Results and archives were preserved unchanged. enforceEligibility requires explicit eligible=true AND discipline=beyblade before recording results. Halloween is the sole confirmed event, Regular ×1, Top Cut 8 from its existing poster description. Other activities have no public ranking badges. Internal scoringMode flags still protect imports without appearing in public event labels. New seasons also require explicit event designation.
