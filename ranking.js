export const DEFAULT_POINTS={champion:20,runnerUp:15,third:10,topCut:7,participation:5};
export function eventSettings(config,id) { return {title:id,multiplier:1,topCutSize:null,scoringMode:'final-event',...config.events?.[id]}; }
export function multiplierLabel(n) { return n===2?'Double Points ×2':'Regular Points ×1'; }
export function resultKey(r,config) { return JSON.stringify([r.season_id||config.id,r.event_id,r.player_id]); }
export function pointsFor(result,config) {
  if ((result.attendance||'attended')!=='attended') return 0;
  const event=eventSettings(config,result.event_id), p=config.points;
  const topCut=result.top_cut ?? (Number.isInteger(event.topCutSize)?result.placement<=event.topCutSize:false);
  const awards=[p.participation];
  if(topCut)awards.push(p.topCut);
  if(result.placement===1)awards.push(p.champion);
  if(result.placement===2)awards.push(p.runnerUp);
  if(result.placement===3)awards.push(p.third);
  return Math.max(...awards)*event.multiplier;
}
export function validateResults(rows,config) {
  if(!config.id || !['draft','active','completed'].includes(config.status))throw Error('Invalid season configuration.');
  const keys=Object.keys(DEFAULT_POINTS);
  if(!config.points || keys.some(k=>!Number.isFinite(config.points[k])||config.points[k]<0))throw Error('Invalid points configuration.');
  const seen=new Set(), names=new Map(), events=new Map();
  for(const [i,r] of rows.entries()) {
    const prefix='Row '+(i+1)+': ';
    for(const k of ['event_id','date','player_id','display_name'])if(typeof r[k]!=='string'||!r[k].trim())throw Error(prefix+'Missing '+k+'.');
    if(r.season_id && r.season_id!==config.id)throw Error(prefix+'Wrong season ID.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)throw Error(prefix+'Use a real date in YYYY-MM-DD format.');
    if(config.startDate&&r.date<config.startDate || config.endDate&&r.date>config.endDate)throw Error(prefix+'Event is outside this season.');
    const event=eventSettings(config,r.event_id);
    if(![1,2].includes(event.multiplier))throw Error(prefix+'Multiplier must be 1 or 2.');
    if(event.scoringMode!=='final-event'||r.slot||r.session)throw Error(prefix+'Slot/session scoring pending: provide one confirmed final-event result, not separate slot/session awards.');
    if(event.topCutSize!==null && (!Number.isInteger(event.topCutSize)||event.topCutSize<0))throw Error(prefix+'Invalid Top Cut size.');
    const attendance=r.attendance||'attended';
    if(!['attended','no_show','registered','disqualified'].includes(attendance))throw Error(prefix+'Invalid attendance.');
    if(!Number.isInteger(r.participants)||r.participants<1)throw Error(prefix+'Invalid participant count.');
    if(attendance==='attended'&&(!Number.isInteger(r.placement)||r.placement<1||r.placement>r.participants))throw Error(prefix+'Invalid placement.');
    if(r.top_cut!==undefined && typeof r.top_cut!=='boolean')throw Error(prefix+'top_cut must be true or false.');
    if(attendance==='attended'&&r.placement>3&&r.top_cut===undefined&&event.topCutSize===null)throw Error(prefix+'Confirm Top Cut size or supply top_cut=true/false.');
    if(r.top_cut!==undefined&&event.topCutSize!==null&&attendance==='attended'&&r.top_cut!==(r.placement<=event.topCutSize))throw Error(prefix+'Top Cut flag conflicts with event settings.');
    const key=resultKey(r,config);if(seen.has(key))throw Error(prefix+'Duplicate player/event result.');seen.add(key);
    if(names.has(r.player_id)&&names.get(r.player_id)!==r.display_name)throw Error(prefix+'Player ID has inconsistent display names.');names.set(r.player_id,r.display_name);
    const prior=events.get(r.event_id);if(prior&&(prior.date!==r.date||prior.participants!==r.participants))throw Error(prefix+'Event date or participant count is inconsistent.');events.set(r.event_id,r);
  }
  return rows;
}
export function upsertResults(existing,incoming,config) {
  if(config.status==='completed')throw Error('Completed season is read-only; reopen it deliberately before correcting.');
  validateResults(existing,config);validateResults(incoming,config);
  const merged=new Map(existing.map(r=>[resultKey(r,config),r]));
  for(const r of incoming)merged.set(resultKey(r,config),{...r,season_id:config.id});
  const rows=[...merged.values()];validateResults(rows,config);return rows;
}
export function calculateRankings(rows,config) {
  validateResults(rows,config);const players=new Map();
  for(const r of rows) {
    const points=pointsFor(r,config);if(points===0)continue;
    if(!players.has(r.player_id))players.set(r.player_id,{id:r.player_id,name:r.display_name,results:[]});
    const event=eventSettings(config,r.event_id);
    players.get(r.player_id).results.push({...r,season_id:config.id,event_title:event.title,multiplier:event.multiplier,points});
  }
  const list=[...players.values()].map(p=>{p.results.sort((a,b)=>a.date.localeCompare(b.date)||a.event_id.localeCompare(b.event_id));p.total=p.results.reduce((s,r)=>s+r.points,0);p.best=Math.min(...p.results.map(r=>r.placement));p.wins=p.results.filter(r=>r.placement===1).length;return p;}).sort((a,b)=>b.total-a.total||a.best-b.best||b.wins-a.wins||a.name.localeCompare(b.name));
  list.forEach((p,i)=>{const prev=list[i-1];p.rank=prev&&prev.total===p.total&&prev.best===p.best&&prev.wins===p.wins?prev.rank:i+1;});return list;
}
export function startNextSeason(bundle,id,name) {
  if(bundle.status==='completed'&&(!bundle.startDate||!bundle.endDate))throw Error('Completed season requires start and end dates.');
  if(bundle.status!=='completed')throw Error('Complete the current season before starting another.');
  if(!/^[a-zA-Z0-9_-]+$/.test(id)||!name?.trim()||[bundle.id,...(bundle.archives||[]).map(s=>s.id)].includes(id))throw Error('Use a new unique season ID and name.');
  const {archives=[],...current}=structuredClone(bundle);
  const snapshot={...current,finalRankings:calculateRankings(current.results,current)};
  return {id,name:name.trim(),status:'draft',startDate:null,endDate:null,scoringVersion:'cumulative-v2',points:{...DEFAULT_POINTS},events:{},results:[],archives:[...archives,snapshot]};
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
  const optional=['season_id','top_cut','attendance','slot','session'];
  if(!headers || required.some(k=>!headers.includes(k)) || headers.some(k=>![...required,...optional].includes(k)) || new Set(headers).size!==headers.length)throw Error('CSV needs '+required.join(', ')+'; optional: '+optional.join(', '));
  return rows.map((r,i)=>{
    if(r.length!==headers.length)throw Error(`CSV row ${i+2}: wrong number of columns.`);
    const record=Object.fromEntries(headers.map((k,j)=>[k,r[j].trim()]));
    for(const k of ['placement','participants'])record[k]=record[k]===''?null:/^\d+$/.test(record[k])?Number(record[k]):NaN;
    if ('top_cut' in record) { if (!['true','false',''].includes(record.top_cut)) throw Error('top_cut must be true or false.'); record.top_cut=record.top_cut===''?undefined:record.top_cut==='true'; }
    if (!record.attendance) record.attendance='attended';
    return record;
  });
}
