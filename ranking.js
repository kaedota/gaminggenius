export function pointsFor(place, config) {
  const p = config.points;
  return p[String(place)] ?? (place <= 8 ? p.top8 : place <= 16 ? p.top16 : p.participation);
}
export function validateResults(rows, config) {
  if (!Number.isInteger(config.bestResults) || config.bestResults < 1) throw Error('Best results must be a positive integer.');
  const values = Object.values(config.points);
  if (values.length !== 7 || values.some(v => !Number.isFinite(v) || v < 0)) throw Error('Invalid points configuration.');
  const seen = new Set(), names = new Map(), events = new Map();
  for (const [i, r] of rows.entries()) {
    const prefix = `Row ${i + 1}: `;
    for (const k of ['event_id', 'date', 'player_id', 'display_name']) if (typeof r[k] !== 'string' || !r[k].trim()) throw Error(prefix + `Missing ${k}.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date) throw Error(prefix + 'Use a real date in YYYY-MM-DD format.');
    if (config.startDate && r.date < config.startDate || config.endDate && r.date > config.endDate) throw Error(prefix + 'Event is outside this season.');
    if (!Number.isInteger(r.placement) || !Number.isInteger(r.participants) || r.participants < 2 || r.placement < 1 || r.placement > r.participants) throw Error(prefix + 'Invalid placement or participant count.');
    const key = JSON.stringify([r.event_id, r.player_id]);
    if (seen.has(key)) throw Error(prefix + 'Duplicate player in the same event.');
    seen.add(key);
    if (names.has(r.player_id) && names.get(r.player_id) !== r.display_name) throw Error(prefix + 'Player ID has inconsistent display names.');
    names.set(r.player_id, r.display_name);
    const event = events.get(r.event_id);
    if (event && (event.date !== r.date || event.participants !== r.participants)) throw Error(prefix + 'Event date or participant count is inconsistent.');
    events.set(r.event_id, r);
  }
  return rows;
}
export function calculateRankings(rows, config) {
  validateResults(rows, config);
  const players = new Map();
  for (const r of rows) {
    if (!players.has(r.player_id)) players.set(r.player_id, {id:r.player_id, name:r.display_name, results:[]});
    players.get(r.player_id).results.push({...r, points:pointsFor(r.placement,config)});
  }
  const list = [...players.values()].map(p => {
    p.results.sort((a,b) => b.points-a.points || a.placement-b.placement || a.date.localeCompare(b.date) || a.event_id.localeCompare(b.event_id));
    p.counted = p.results.slice(0, config.bestResults);
    p.total = p.counted.reduce((s,r) => s+r.points,0);
    p.best = Math.min(...p.counted.map(r=>r.placement));
    p.wins = p.counted.filter(r=>r.placement===1).length;
    return p;
  }).sort((a,b)=> b.total-a.total || a.best-b.best || b.wins-a.wins || a.name.localeCompare(b.name));
  list.forEach((p,i)=>{
    const prev=list[i-1];
    p.rank=prev && prev.total===p.total && prev.best===p.best && prev.wins===p.wins ? prev.rank : i+1;
  });
  return list;
}
export function parseCSV(text) {
  const rows=[]; let row=[], cell='', quoted=false, closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(closed && ![',','\n','\r'].includes(c))throw Error('Unexpected character after closing CSV quote.');
    if(c==='"') {
      if(quoted && text[i+1]==='"') {cell+='"';i++;}
      else if(quoted) {quoted=false;closed=true;}
      else if(cell==='' && !closed) quoted=true;
      else throw Error('Unexpected quote in CSV.');
    } else if(c===','&&!quoted) {row.push(cell);cell='';closed=false;}
    else if((c==='\n'||c==='\r')&&!quoted) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';closed=false;}
    else cell+=c;
  }
  if(quoted)throw Error('Unclosed quote in CSV.');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  const headers=rows.shift()?.map(x=>x.trim());
  const required=['event_id','date','player_id','display_name','placement','participants'];
  if(!headers || headers.length!==6 || required.some(k=>!headers.includes(k)) || new Set(headers).size!==6)throw Error('CSV needs these six headers: '+required.join(', '));
  return rows.map((r,i)=>{
    if(r.length!==headers.length)throw Error(`CSV row ${i+2}: wrong number of columns.`);
    const record=Object.fromEntries(headers.map((k,j)=>[k,r[j].trim()]));
    for(const k of ['placement','participants'])record[k]=/^\d+$/.test(record[k])?Number(record[k]):NaN;
    return record;
  });
}
