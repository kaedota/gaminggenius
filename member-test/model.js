import { calculateRankings } from "../ranking.js";
export function officialRankings(s) {
  return ["active", "completed"].includes(s.status)
    ? s.finalRankings || calculateRankings(s.results, s)
    : [];
}
export function playerSeasons(bundle, id) {
  return [bundle, ...(bundle.archives || [])].map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    player: officialRankings(s).find((p) => p.id === id) || {
      id,
      total: 0,
      rank: null,
      results: [],
    },
  }));
}
export function identityInventory(bundle) {
  const ids = new Map();
  for (const s of [bundle, ...(bundle.archives || [])])
    for (const r of s.results) {
      if (!ids.has(r.player_id)) ids.set(r.player_id, new Set());
      ids.get(r.player_id).add(r.display_name);
    }
  return [...ids].map(([player_id, names]) => ({
    player_id,
    names: [...names],
    ambiguous: names.size > 1,
  }));
}
