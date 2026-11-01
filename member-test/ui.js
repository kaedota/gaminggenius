import { playerSeasons } from "./model.js";
export const $ = (id) => document.getElementById(id);
export function node(tag, text = "", cls = "") {
  const n = document.createElement(tag);
  n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
export function jsonPanel(title, data) {
  const box = node("details", "", "panel");
  box.append(
    node("summary", title),
    node("pre", JSON.stringify(data, null, 2)),
  );
  return box;
}
export function playerCard(profile, bundle) {
  const card = node("article", "", "card metric-card");
  card.append(
    node("span", profile.player_id, "tag"),
    node("h3", profile.display_name),
  );
  for (const s of playerSeasons(bundle, profile.player_id)) {
    const wrap = node("div");
    wrap.append(node("p", s.name));
    const stats = node("div", "", "stats");
    for (const [label, value] of [
      ["积分", s.player.total],
      ["官方排名", s.player.rank === null ? "—" : "#" + s.player.rank],
      ["赛事", s.player.results.length],
    ]) {
      const v = node("div");
      v.append(node("b", String(value)), node("small", label));
      stats.append(v);
    }
    wrap.append(stats);
    if (!s.player.results.length)
      wrap.append(node("p", "本赛季尚无已核实成绩。新建档案不会获得积分。"));
    else {
      const overflow = node("div", "", "table-wrap"),
        table = node("table"),
        head = node("tr");
      for (const text of ["赛事 / 日期", "成绩", "积分来源"])
        head.append(node("th", text));
      table.append(head);
      for (const r of s.player.results) {
        const row = node("tr");
        row.append(
          node("td", r.event_title + " · " + r.date),
          node(
            "td",
            r.placement == null
              ? "最终积分已确认 · 名次未提供"
              : "第 " + r.placement + " 名",
          ),
          node(
            "td",
            r.points +
              " 分 · " +
              (r.final_points !== undefined
                ? "官方确认最终总分（不再叠加）"
                : r.multiplier === 2
                  ? "双倍 ×2"
                  : "普通 ×1"),
          ),
        );
        table.append(row);
      }
      overflow.append(table);
      wrap.append(overflow);
    }
    card.append(wrap);
  }
  card.append(node("p", "历史 slot 原始资料如未提供，不推测次数或额外发分。"));
  return card;
}
