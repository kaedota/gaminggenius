// Read/display validation only. Never merge matches by player name or invent results.
export function snapshotIssues(snapshot){
 const issues=[];if(!snapshot)return ['SNAPSHOT_MISSING'];
 if(snapshot.review?.required)issues.push('SOURCE_GROUP_REVIEW');
 const ids=new Set(),pairs=new Set();
 for(const r of snapshot.rounds||[])for(const m of r.matches||[]){
  if(ids.has(m.id))issues.push('DUPLICATE_MATCH_ID');ids.add(m.id);
  const key=JSON.stringify([m.stage||'',m.groupId??m.groupLabel??null,m.sourceRound??m.round??r.number,...[m.a,m.b].sort()]);
  if(m.b&&pairs.has(key))issues.push('AMBIGUOUS_GROUP_PAIRING');pairs.add(key);
  if(snapshot.state==='group_stages_underway'&&m.stage!=='swiss')issues.push('GROUP_STAGE_METADATA_MISSING');
 }
 return [...new Set(issues)];
}
export function roundColumns(snapshot){
 const columns=[];
 for(const r of snapshot.rounds||[]){
  const groups=new Map();
  for(const m of r.matches){const swiss=snapshot.state==='group_stages_underway'||m.stage==='swiss'||(!snapshot.format&&r.number<100);const round=swiss?(m.sourceRound??(r.number>100?r.number-100:r.number)):(m.sourceRound??(r.number>100?r.number-100:r.number));const group=m.groupLabel??(m.groupId!=null?String(m.groupId):null);const key=JSON.stringify([swiss,round,group]);if(!groups.has(key))groups.set(key,{number:r.number,round,swiss,group,matches:[]});groups.get(key).matches.push(m);}
  columns.push(...groups.values());
 }
 return columns;
}
