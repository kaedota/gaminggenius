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

export function publicPlayerDirectory(bundle) {
  const players = new Map();
  for (const season of [bundle, ...(bundle.archives || [])]) {
    for (const player of officialRankings(season)) {
      if (!players.has(player.id)) {
        players.set(player.id, {
          player_id: player.id,
          display_name: player.name,
          season_name: season.name,
          total: player.total,
          rank: player.rank,
          names: new Set(),
        });
      }
      const entry = players.get(player.id);
      entry.names.add(player.name);
      for (const result of player.results) entry.names.add(result.display_name);
    }
  }
  return [...players.values()].map((player) => ({
    ...player,
    names: [...player.names],
  }));
}

export function searchPublicPlayers(directory, query) {
  const normalized = query.trim().normalize("NFKC").toLowerCase();
  if (!normalized) return [];
  return directory.filter((player) =>
    [player.player_id, ...player.names].some((name) =>
      name.normalize("NFKC").toLowerCase().includes(normalized),
    ),
  );
}
