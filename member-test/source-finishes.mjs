// Shared by the private judge page and server. These are decisive battle results;
// draws, replays, launch penalties and walkovers must not be invented as finishes.
// Takara Tomy Asia regulations, March 2026, page 2:
// https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation_en.pdf
export const FINISH_POINTS = Object.freeze({Spin: 1, Over: 2, Burst: 2, Xtreme: 3});
export const FINISH_TYPES = Object.freeze(Object.keys(FINISH_POINTS));
export const FINISH_RULESET = 'beyblade-x-first-to-4-v1';
export const MATCH_TARGET = 4;
export const MAX_DECISIVE_BATTLES = 7;

const TEST_SLUGS = new Set(['unwlah3a', 'kjhh8b0r', 'ggfull20261101', 'ggfull20261126']);
const fail = code => { throw Error(code); };
const validId = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 200 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const validRevision = value => Number.isSafeInteger(value) && value >= 0;
const emptyFinishes = () => Object.fromEntries(FINISH_TYPES.map(finish => [finish, 0]));

// This deliberately uses the same contract as source-score.js:fingerprint while
// keeping the browser module independent of the server-only Challonge reader.
export const sourceMatchFingerprint = match => JSON.stringify([
  match.id, match.a, match.b, match.scoreA, match.scoreB, match.winner, match.status,
]);

function requireMatch(match) {
  if (!match || !validId(match.id) || !validId(match.a) || !validId(match.b) ||
      match.a === match.b || match.walkover === true ||
      ![undefined, 'pending', 'complete'].includes(match.status)) fail('SOURCE_INVALID_MATCH');
}

/**
 * Return normalized battles and scores derived exclusively from their outcomes.
 * UI drafts pass requireComplete:false, including for the initial empty draft.
 * IDs and finish names are exact: display names, player sides and supplied point
 * values never determine a result. This function does not mutate either input.
 */
export function deriveFinishScore(match, battles, {requireComplete = true} = {}) {
  requireMatch(match);
  if (!Array.isArray(battles) || battles.length > MAX_DECISIVE_BATTLES) fail('SOURCE_INVALID_BATTLES');
  let scoreA = 0, scoreB = 0, winner = null;
  const normalized = [];
  for (const battle of battles) {
    if (winner !== null) fail('SOURCE_BATTLES_AFTER_MATCH_FINISHED');
    if (!battle || typeof battle !== 'object' || Array.isArray(battle) || typeof battle.finish !== 'string' ||
        !Object.hasOwn(FINISH_POINTS, battle.finish)) fail('SOURCE_INVALID_FINISH');
    if (battle.winnerParticipantId !== match.a && battle.winnerParticipantId !== match.b) {
      fail('SOURCE_INVALID_BATTLE_WINNER');
    }
    const points = FINISH_POINTS[battle.finish];
    if (battle.winnerParticipantId === match.a) scoreA += points;
    else scoreB += points;
    normalized.push({winnerParticipantId: battle.winnerParticipantId, finish: battle.finish});
    if (scoreA >= MATCH_TARGET || scoreB >= MATCH_TARGET) winner = battle.winnerParticipantId;
  }
  if (requireComplete && winner === null) fail('SOURCE_MATCH_INCOMPLETE');
  return {
    ruleset: FINISH_RULESET,
    battles: normalized,
    scoreA, scoreB, winner,
    complete: winner !== null,
    status: winner === null ? 'pending' : 'complete',
  };
}

/**
 * Validate the caller's source view and recording revision before deriving a new
 * recording. sourceFingerprint describes the supplied current source match; the
 * handler stores a new fingerprint only after verifying the updated source match.
 */
export function validateRecording({
  match, battles, expected, expectedRevision = 0, revision = 0, requireComplete = true,
}) {
  requireMatch(match);
  const sourceFingerprint = sourceMatchFingerprint(match);
  if (typeof expected !== 'string' || expected !== sourceFingerprint) fail('SOURCE_STALE_MATCH');
  if (!validRevision(expectedRevision) || !validRevision(revision)) fail('SOURCE_INVALID_REVISION');
  if (expectedRevision !== revision) fail('SOURCE_STALE_RECORDING');
  return {...deriveFinishScore(match, battles, {requireComplete}), sourceFingerprint, revision};
}

function finalMatchIsValid(match) {
  try { requireMatch(match); } catch { return false; }
  if (match.status !== 'complete' || ![match.scoreA, match.scoreB].every(Number.isInteger)) return false;
  const aWins = match.scoreA >= 4 && match.scoreA <= 6 && match.scoreB >= 0 && match.scoreB <= 3;
  const bWins = match.scoreB >= 4 && match.scoreB <= 6 && match.scoreA >= 0 && match.scoreA <= 3;
  return (aWins && match.winner === match.a) || (bWins && match.winner === match.b);
}

function recordingSignature(recording) {
  return JSON.stringify([
    recording.status, recording.isTest === true, recording.sourceFingerprint,
    recording.ruleset, sourceMatchFingerprint(recording.match || {}),
    recording.match?.walkover === true, recording.review?.required === true,
    recording.battles == null ? null : Array.isArray(recording.battles) ?
      recording.battles.map(battle => [battle?.winnerParticipantId, battle?.finish]) : 'invalid',
  ]);
}

function currentRecordings(recordings) {
  const latest = new Map();
  for (const recording of recordings) {
    if (!recording || !validId(recording.slug) || !validId(recording.matchId) ||
        !validRevision(recording.revision)) continue;
    const key = JSON.stringify([recording.slug, recording.matchId]);
    const prior = latest.get(key);
    if (!prior || recording.revision > prior.revision) {
      latest.set(key, {revision: recording.revision, recording, signature: recordingSignature(recording)});
    } else if (recording.revision === prior.revision && recordingSignature(recording) !== prior.signature) {
      // Conflicting representations of the same revision cannot establish a result.
      prior.conflict = true;
    }
  }
  return [...latest.values()].filter(value => !value.conflict).map(value => value.recording);
}

function canonicalLinks(participantLinks) {
  const links = new Map();
  for (const link of participantLinks) {
    if (!link || !validId(link.slug) || !validId(link.participantId) || !validId(link.playerId)) continue;
    const key = JSON.stringify([link.slug, link.participantId]);
    if (links.has(key) && links.get(key) !== link.playerId) links.set(key, null);
    else if (!links.has(key)) links.set(key, link.playerId);
  }
  return links;
}

/**
 * Derive private statistics from current recording revisions, never increments.
 * A newer stale/needs-review revision shadows an older verified revision. Source
 * fingerprints must match. battles:null (or absent) counts a verified historical
 * match but contributes no battle or finish counts, exposing its missing coverage.
 *
 * Default rows are scoped by slug + participantId, without using display names.
 * crossEvent:true requires unambiguous explicit links for BOTH opponents and joins
 * rows only by their canonical playerId. Test sources/flags require includeTest:true.
 * All win rates and finishCoverage are ratios 0..1; a missing denominator is null.
 */
export function derivePlayerStats(recordings, {
  crossEvent = false, participantLinks = [], includeTest = false,
} = {}) {
  if (!Array.isArray(recordings) || !Array.isArray(participantLinks)) fail('SOURCE_INVALID_RECORDINGS');
  const links = canonicalLinks(participantLinks), players = new Map();
  const getPlayer = (slug, participantId, playerId) => {
    const key = crossEvent ? playerId : JSON.stringify([slug, participantId]);
    if (!players.has(key)) players.set(key, {
      key, slug: crossEvent ? null : slug, participantId: crossEvent ? null : participantId,
      playerId: crossEvent ? playerId : null,
      matchesPlayed: 0, matchWins: 0, matchLosses: 0,
      battlesPlayed: 0, battleWins: 0, battleLosses: 0,
      finishCounts: emptyFinishes(), finishLossCounts: emptyFinishes(),
      pointsFor: 0, pointsAgainst: 0, recordedMatches: 0, unrecordedMatches: 0,
    });
    return players.get(key);
  };
  for (const recording of currentRecordings(recordings)) {
    const {match, slug} = recording;
    if (recording.status !== 'verified' || recording.review?.required === true ||
        recording.matchId !== match?.id || !finalMatchIsValid(match) ||
        recording.sourceFingerprint !== sourceMatchFingerprint(match) ||
        ((recording.isTest === true || TEST_SLUGS.has(slug)) && includeTest !== true)) continue;
    let derived = null;
    if (recording.battles != null) {
      if (recording.ruleset !== FINISH_RULESET) continue;
      try { derived = deriveFinishScore(match, recording.battles); } catch { continue; }
      if (derived.scoreA !== match.scoreA || derived.scoreB !== match.scoreB || derived.winner !== match.winner) continue;
    }
    const playerA = links.get(JSON.stringify([slug, match.a]));
    const playerB = links.get(JSON.stringify([slug, match.b]));
    if (crossEvent && (!playerA || !playerB || playerA === playerB)) continue;
    const a = getPlayer(slug, match.a, playerA), b = getPlayer(slug, match.b, playerB);
    for (const [player, participantId, forPoints, againstPoints] of [
      [a, match.a, match.scoreA, match.scoreB], [b, match.b, match.scoreB, match.scoreA],
    ]) {
      player.matchesPlayed++;
      player[participantId === match.winner ? 'matchWins' : 'matchLosses']++;
      player.pointsFor += forPoints;
      player.pointsAgainst += againstPoints;
      player[derived ? 'recordedMatches' : 'unrecordedMatches']++;
    }
    for (const battle of derived?.battles || []) {
      const winner = battle.winnerParticipantId === match.a ? a : b, loser = winner === a ? b : a;
      winner.battlesPlayed++; loser.battlesPlayed++;
      winner.battleWins++; loser.battleLosses++;
      winner.finishCounts[battle.finish]++; loser.finishLossCounts[battle.finish]++;
    }
  }
  return [...players.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0).map(player => ({
    ...player,
    matchWinRate: player.matchesPlayed ? player.matchWins / player.matchesPlayed : null,
    battleWinRate: player.battlesPlayed ? player.battleWins / player.battlesPlayed : null,
    finishCoverage: player.matchesPlayed ? player.recordedMatches / player.matchesPlayed : null,
  }));
}
