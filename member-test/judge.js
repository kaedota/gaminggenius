import {snapshotIssues,roundColumns} from './source-view.mjs?v=20261124-stage-v1';
import {FINISH_TYPES,FINISH_POINTS,FINISH_RULESET,deriveFinishScore,derivePlayerStats,sourceMatchFingerprint} from './source-finishes.mjs?v=20261126-fresh-v1';
import {createClient} from './vendor/supabase.js';
import config from './config.js';
import {createAuthStorage} from './auth-storage.js';
import {selectTotpFactor} from './mfa-state.js';

const $=selector=>document.querySelector(selector);
const client=createClient(config.supabaseUrl,config.publishableKey,{auth:{storage:createAuthStorage(sessionStorage,localStorage),flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let userRole=null,writesEnabled=false,allowed=false,factorId=null,current=null,busy=false;
let recordings=[],uncertainMatchIds=new Set(),inspection=null;
const drafts=new Map();
const messages={
 SOURCE_STRUCTURE_REVIEW_REQUIRED:'原引擎分组资料仍需核对，本场保持只读；未写入比分。',
 SOURCE_UNEXPECTED_GROUPS:'原引擎分组资料需要主办方核对，原缓存和比分保留。',
 AUTH_REQUIRED:'请登录；会话可能已过期。',MFA_REQUIRED:'登录成功，请完成裁判双重验证。',
 JUDGE_NOT_ASSIGNED:'此账号未获本场裁判权限，无法录分。',SOURCE_JUDGE_TEST_DISABLED:'裁判测试权限尚未启用。',
 PILOT_CLOSED:'此账号未获测试访问。',SOURCE_WRITE_BUSY:'另一位裁判正在保存，请稍后刷新再操作。',
 RATE_LIMITED:'操作太频繁，请稍后再试。',SOURCE_CONTROL_NOT_READY:'比赛阶段尚未准备好，请刷新核对。',
 SOURCE_ROUND_INCOMPLETE:'本轮尚有未完成对局。',SOURCE_WRITES_DISABLED:'云端录分尚未启用。',
 SOURCE_NOT_CONFIGURED:'云端录分尚未准备好，未写入比分。',
 SOURCE_DOWNSTREAM_REVIEW_REQUIRED:'已有后续轮次，仅可更正决胜方式并保持原总分；比分更正需主办方核对。',
 PILOT_BUDGET_INSUFFICIENT:'Challonge 测试额度不足，未写入比分。',SOURCE_STALE_MATCH:'比分已变化，请刷新核对后重试。',
 SOURCE_STALE_RECORDING:'本场决胜方式记录已变化，请刷新核对后重试。',
 SOURCE_INVALID_FINAL_SCORE:'胜方须4–6分，败方0–3分，必须为整数。',SOURCE_REASON_REQUIRED:'请填写更正原因，可简短说明。',
 SOURCE_MATCH_INCOMPLETE:'尚未到4分，请继续记录回合，或核对仅总分模式。',
 SOURCE_INVALID_BATTLES:'回合记录不完整，请核对后重试。',SOURCE_INVALID_FINISH:'请选择 Spin、Over、Burst 或 Xtreme。',
 SOURCE_INVALID_BATTLE_WINNER:'选手资料已变化，请刷新后重新核对。',
 SOURCE_BATTLES_AFTER_MATCH_FINISHED:'已到4分；如需更正，请先撤销最后一回合。',
 SOURCE_INVALID_REVISION:'记录版本需要刷新核对。',
 SOURCE_OPERATION_NEEDS_REVIEW:'写入结果需要核对，请停止重复提交并联系主办方。',
};

function el(tag,attrs={},text){
 const node=document.createElement(tag);
 for(const [key,value]of Object.entries(attrs)){
  if(['className','hidden','disabled','readOnly','required','value','type','name','id'].includes(key))node[key]=value;
  else node.setAttribute(key,String(value));
 }
 if(text!==undefined)node.textContent=String(text);
 return node;
}
const allMatches=()=>current?.rounds.flatMap(round=>round.matches)||[];
const recordFor=match=>recordings.filter(record=>record.slug===current.slug&&record.matchId===match.id).sort((a,b)=>b.revision-a.revision)[0]||null;
function verifiedBattles(match,recording){
 if(!recording||recording.status!=='verified'||recording.ruleset!==FINISH_RULESET||recording.sourceFingerprint!==sourceMatchFingerprint(match)||!Array.isArray(recording.battles))return null;
 try{const result=deriveFinishScore(match,recording.battles);return result.scoreA===match.scoreA&&result.scoreB===match.scoreB&&result.winner===match.winner?result.battles:null;}catch{return null;}
}
function hasDownstream(match){return current.rounds.some(round=>round.number>match.round);}
function canEditMatch(match){
 return allowed&&writesEnabled&&!snapshotIssues(current).length&&!uncertainMatchIds.has(match.id)&&!!match.b&&match.walkover!==true&&['pending','complete'].includes(match.status)&&
  (!current.state||['group_stages_underway','underway','awaiting_review'].includes(current.state))&&
  !(match.status!=='complete'&&current.rounds.some(round=>round.number>match.round&&round.matches.some(next=>next.status==='complete')));
}
async function api(path,data){
 const {data:session}=await client.auth.getSession(),token=session.session?.access_token;if(!token)throw Error('AUTH_REQUIRED');
 const response=await fetch(config.supabaseUrl+'/functions/v1/gg-source',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+token},body:JSON.stringify({...data,action:path.slice(1)})});
 const body=await response.json();if(!response.ok)throw Error(body.error);return body;
}
async function run(fn){
 if(busy)return;busy=true;document.querySelectorAll('.editor-fields').forEach(field=>field.disabled=true);
 try{$('#message').textContent='处理中…';await fn();}
 catch(error){$('#message').textContent=messages[error.message]||'操作未完成，请核对输入或稍后重试。';}
 finally{busy=false;document.querySelectorAll('.editor-fields').forEach(field=>field.disabled=false);}
}
function battleList(battles,entries){
 const list=el('ol',{className:'battle-list'});
 for(const battle of battles)list.append(el('li',{},`${entries.get(battle.winnerParticipantId)?.name||battle.winnerParticipantId} · ${battle.finish} +${FINISH_POINTS[battle.finish]}`));
 return list;
}

function mountScoreEditor(container,match,recording,entries,{scoreLocked=false}={}){
 const key=JSON.stringify([current.slug,match.id]),version=JSON.stringify([sourceMatchFingerprint(match),recording?.revision??0]);
 let draft=drafts.get(key);
 if(!draft||draft.version!==version){
  const saved=verifiedBattles(match,recording);
  draft={version,mode:saved||match.status!=='complete'?'finishes':'totals',battles:saved||[],a:match.scoreA??'',b:match.scoreB??'',reason:'',requestId:null,confirmation:null};
  drafts.set(key,draft);
 }
 const form=el('form',{className:'score-form finish-editor','data-match':match.id}),fields=el('fieldset',{className:'editor-fields'});form.append(fields);container.append(form);
 const mode=el('select',{name:'mode'});mode.append(el('option',{value:'finishes'},'逐回合记录决胜方式'),el('option',{value:'totals'},'仅总分（含罚分或详情缺失）'));mode.value=draft.mode;
 const modeLabel=el('label',{},'录分方式');modeLabel.append(mode);fields.append(modeLabel);
 if(match.status==='complete'&&!verifiedBattles(match,recording))fields.append(el('p',{className:'muted'},'本场只有总分记录，决胜方式详情不可用。可重新录入完整回合；罚分请使用仅总分模式。'));
 if(scoreLocked)fields.append(el('p',{className:'notice'},`已有后续轮次。此处仅可更正决胜方式，总分须保持 ${match.scoreA}–${match.scoreB}。`));
 const live=el('output',{className:'finish-score','aria-live':'polite'});fields.append(live);
 const finishPanel=el('div',{className:'finish-panel'}),buttons=[];
 for(const participantId of [match.a,match.b]){
  const player=el('section',{className:'finish-player'});player.append(el('h4',{},entries.get(participantId)?.name||participantId));
  const grid=el('div',{className:'finish-buttons'});
  for(const finish of FINISH_TYPES){
   const button=el('button',{type:'button',className:'finish-button','data-player':participantId,'data-finish':finish,'aria-label':`${entries.get(participantId)?.name||participantId} ${finish} +${FINISH_POINTS[finish]}`},`${finish} +${FINISH_POINTS[finish]}`);
   button.onclick=()=>{if(busy)return;try{const next=deriveFinishScore(match,[...draft.battles,{winnerParticipantId:participantId,finish}],{requireComplete:false});draft.battles=next.battles;changed();}catch(error){alert.textContent=messages[error.message]||'请核对回合记录。';}};
   buttons.push(button);grid.append(button);
  }
  player.append(grid);finishPanel.append(player);
 }
 const listBox=el('div',{'data-battle-list':''}),undo=el('button',{type:'button',className:'secondary','data-action':'undo'},'撤销最后一回合');
 undo.onclick=()=>{if(busy||!draft.battles.length)return;draft.battles.pop();changed();};
 finishPanel.append(listBox,undo,el('p',{className:'muted'},'平局或重赛不记分。罚分请切换仅总分，不记作 Spin。'));fields.append(finishPanel);
 const totalsPanel=el('div',{className:'totals-panel'}),scoreRow=el('div',{className:'manual-score-row'});
 const a=el('input',{name:'a',type:'number',min:0,max:6,step:1,value:draft.a}),b=el('input',{name:'b',type:'number',min:0,max:6,step:1,value:draft.b});
 for(const [input,id]of [[a,match.a],[b,match.b]]){const label=el('label',{},entries.get(id)?.name||id);label.append(input);scoreRow.append(label);input.oninput=()=>{draft.a=a.value;draft.b=b.value;changed();};}
 totalsPanel.append(scoreRow,el('p',{className:'muted'},'仅保存双方总分，决胜方式详情不可用；不会从总分推算回合或罚分类型。'));fields.append(totalsPanel);
 const reason=el('textarea',{name:'reason',required:match.status==='complete',minlength:1,maxlength:500,value:draft.reason}),reasonLabel=el('label',{},match.status==='complete'?'更正原因（可简短说明）':'备注（可选）');reasonLabel.append(reason);fields.append(reasonLabel);
 const alert=el('p',{role:'alert',className:'editor-alert'}),submit=el('button',{type:'submit'},'核对比分');fields.append(alert,submit);
 function changed(){draft.confirmation=null;draft.requestId=null;alert.textContent='';submit.textContent='核对比分';update();}
 reason.oninput=()=>{draft.reason=reason.value;changed();};
 function update(){
  const result=deriveFinishScore(match,draft.battles,{requireComplete:false});
  finishPanel.hidden=draft.mode!=='finishes';totalsPanel.hidden=draft.mode!=='totals';
  a.disabled=b.disabled=draft.mode!=='totals';a.required=b.required=draft.mode==='totals';a.readOnly=b.readOnly=scoreLocked;
  a.value=draft.a;b.value=draft.b;
  const scoreA=draft.mode==='finishes'?result.scoreA:draft.a,scoreB=draft.mode==='finishes'?result.scoreB:draft.b;
  live.textContent=`${scoreA===''?'—':scoreA} – ${scoreB===''?'—':scoreB}${draft.mode==='finishes'&&result.complete?' · 已到4分':''}`;
  listBox.replaceChildren(draft.battles.length?battleList(draft.battles,entries):el('p',{className:'muted'},'尚未记录回合。'));
  buttons.forEach(button=>button.disabled=result.complete);undo.disabled=!draft.battles.length;
 }
 mode.onchange=()=>{
  if(busy)return;
  if(mode.value==='totals'&&draft.mode==='finishes'&&draft.battles.length){const result=deriveFinishScore(match,draft.battles,{requireComplete:false});draft.a=result.scoreA;draft.b=result.scoreB;}
  draft.mode=mode.value;changed();
 };
 form.onsubmit=event=>{
  event.preventDefault();if(busy)return;
  try{
   draft.reason=reason.value.trim();if(match.status==='complete'&&!draft.reason)throw Error('SOURCE_REASON_REQUIRED');
   let scoreA,scoreB,battles;
   if(draft.mode==='finishes'){const result=deriveFinishScore(match,draft.battles);scoreA=result.scoreA;scoreB=result.scoreB;battles=result.battles;}
   else{scoreA=Number(a.value);scoreB=Number(b.value);battles=null;if(a.value===''||b.value===''||![scoreA,scoreB].every(Number.isInteger)||!((scoreA>=4&&scoreA<=6&&scoreB>=0&&scoreB<=3)||(scoreB>=4&&scoreB<=6&&scoreA>=0&&scoreA<=3)))throw Error('SOURCE_INVALID_FINAL_SCORE');}
   if(scoreLocked&&(scoreA!==match.scoreA||scoreB!==match.scoreB))throw Error('SOURCE_DOWNSTREAM_REVIEW_REQUIRED');
   const data={slug:current.slug,matchId:match.id,expected:sourceMatchFingerprint(match),scoreA,scoreB,battles,recordingRevision:recording?.revision??0,reason:draft.reason},signature=JSON.stringify(data);
   if(draft.confirmation!==signature){draft.confirmation=signature;draft.requestId=crypto.randomUUID();alert.textContent=`确认保存 ${scoreA}–${scoreB}？${battles?'决胜方式已记录。':'仅总分，决胜方式详情不可用。'}`;submit.textContent='确认保存';return;}
   run(async()=>{
    let result;
    try{result=await api('/score',{...data,requestId:draft.requestId});}
    catch(error){if(error.message==='SOURCE_OPERATION_NEEDS_REVIEW'){uncertainMatchIds.add(match.id);drafts.delete(key);draw();}throw error;}
    current=result.snapshot;drafts.delete(key);
    if(result.recording)recordings=[...recordings.filter(record=>record.matchId!==match.id),result.recording];uncertainMatchIds.delete(match.id);
    try{await refresh();$('#message').textContent='原引擎已核对，比分和记录保存成功。';}
    catch{$('#message').textContent='比分和记录已核对保存；缓存刷新未完成，请点检查权限 / 刷新缓存。';}
   });
  }catch(error){alert.textContent=messages[error.message]||'请核对比分和回合记录。';}
 };
 update();return {form,draft};
}

function drawStats(entries){
 const section=el('section',{className:'card judge-stats'});section.append(el('h2',{},'本场胜率（内测）'));
 if(snapshotIssues(current).length){section.append(el('p',{className:'muted'},'分组资料核对后显示统计'));return section;}
 const matches=new Map(allMatches().map(match=>[match.id,match]));
 const usable=recordings.filter(record=>record.slug===current.slug&&!uncertainMatchIds.has(record.matchId)).map(record=>{
  const match=matches.get(record.matchId);
  return match&&record.sourceFingerprint===sourceMatchFingerprint(match)?record:{...record,status:'stale'};
 });
 for(const match of allMatches())if(match.status==='complete'&&!recordFor(match)&&!uncertainMatchIds.has(match.id))usable.push({slug:current.slug,matchId:match.id,revision:0,status:'verified',match,sourceFingerprint:sourceMatchFingerprint(match),battles:null});
 const stats=derivePlayerStats(usable,{includeTest:true});
 section.append(el('p',{className:'muted'},'仅统计本场已核对赛果，不含轮空或待核对对局。仅总分对局计胜负，不推算决胜方式。'));
 if(!stats.length){section.append(el('p',{},'暂无已核对的完成对局。'));return section;}
 const grid=el('div',{className:'stats-grid'}),percentage=rate=>rate===null?'—':`${Math.round(rate*1000)/10}%`;
 for(const player of stats){
  const entry=entries.get(player.participantId),card=el('article',{className:'stat-player'});
  card.append(el('h3',{},`${entry?.name||player.participantId}${entry?.seed?' · #'+entry.seed:''}`),el('p',{},`对局 ${player.matchWins}胜 ${player.matchLosses}负 · 胜率 ${percentage(player.matchWinRate)}`),el('p',{className:'muted'},`决胜方式完整记录 ${player.recordedMatches}/${player.matchesPlayed} 场`));
  const details=el('details');details.append(el('summary',{},'回合与决胜方式'),el('p',{},`已记录回合 ${player.battleWins}胜 ${player.battleLosses}负 · 胜率 ${percentage(player.battleWinRate)}`));
  const table=el('table',{className:'finish-counts'}),head=el('tr');for(const label of ['决胜方式','获胜回合','对手获胜'])head.append(el('th',{},label));table.append(head);
  for(const finish of FINISH_TYPES){const row=el('tr');for(const text of [finish,player.finishCounts[finish],player.finishLossCounts[finish]])row.append(el('td',{},text));table.append(row);}
  details.append(table);card.append(details);grid.append(card);
 }
 section.append(grid);return section;
}

function drawHostControls(){
 const existing=$('#host-controls');if(existing)existing.remove();
 const slug=$('#source').value,fresh=slug==='ggfull20261126';
 if(userRole!=='owner'||!['ggfull20261101','ggfull20261126'].includes(slug))return;
 const box=el('section',{className:'card',id:'host-controls'}),state=current?.state||'未初始化',held=!!current&&snapshotIssues(current).length>0;
 box.append(el('h2',{},fresh?'全新模拟赛 · 主办方控制':'完整模拟赛 · 主办方控制'),el('p',{},'裁判负责录分，阶段切换由 Owner 确认。'));
 const controls=current?[['refresh','刷新赛事']]:[];
 if(!current&&fresh){controls.push(['setup','建立全新模拟赛']);box.append(el('p',{},'建立8名模拟选手的全新赛事后，再手动开始Swiss。旧赛事和比分保留。'));}
 if(held){
  box.append(el('p',{className:'notice'},'赛事资料待核对，阶段切换已关闭。'));
 }
 if(current){
  const inspect=el('button',{type:'button',className:'secondary'},'查看原赛分组');
  inspect.onclick=()=>{if(busy)return;run(async()=>{const result=await api('/inspect',{slug:$('#source').value,requestId:crypto.randomUUID()});inspection=result.inspection;drawHostControls();$('#message').textContent='已读取原赛分组资料；比分和待核对状态保持不变。';});};box.append(inspect);
 }
 if(!held&&state==='pending')controls.push(['start_group_stage','正式开始3轮Swiss']);
 else if(!held&&state==='group_stages_underway'&&current.rounds.some(round=>round.number===3)&&allMatches().every(match=>['complete','bye'].includes(match.status)))controls.push(['finalize_group_stage','确认Swiss结束及Top4晋级']);
 else if(!held&&state==='group_stages_finalized')controls.push(['start','开始Top4淘汰赛']);
 else if(!held&&state==='awaiting_review')controls.push(['finalize','确认结束比赛，发布最终结果']);
 for(const [control,label]of controls){
  const button=el('button',{type:'button',disabled:control!=='refresh'&&!writesEnabled},label);let confirmed=false,requestId=null;
  button.onclick=()=>{if(busy||button.disabled)return;if(!confirmed){confirmed=true;requestId=crypto.randomUUID();button.textContent='确认：'+label;return;}run(async()=>{
   if(control==='setup')await api('/setup',{slug,requestId});
   else await api('/control',{slug,control,expectedState:current?.state||null,requestId});
   await refresh();$('#message').textContent=control==='setup'?'全新模拟赛已建立。请核对选手，再手动开始Swiss。':'赛事状态已核对。';
  });};box.append(button);
 }
 if(inspection&&inspection.slug===current?.slug)box.append(inspectionPanel(inspection));
 $('#board').before(box);
}

function inspectionPanel(data){
 const details=el('details',{className:'source-inspection'});details.append(el('summary',{},'原赛分组资料（只读）'));
 const names=new Map((current?.entries||[]).map(entry=>[entry.id,entry.name]));
 const name=id=>id==null?'原引擎未提供':`${names.get(id)||data.participants.find(entry=>entry.id===id)?.name||id} (${id})`;
 const group=value=>value==null?'原引擎未提供':String(value);
 const participantTable=el('table'),participantHead=el('tr');for(const label of ['选手','原赛选手ID','分组ID'])participantHead.append(el('th',{},label));participantTable.append(participantHead);
 for(const participant of data.participants){const row=el('tr');for(const text of [names.get(participant.id)||participant.name,participant.id,group(participant.groupId)])row.append(el('td',{},text));participantTable.append(row);}
 const matchTable=el('table'),matchHead=el('tr');for(const label of ['原赛对局ID','上方选手','下方选手','轮次','分组ID'])matchHead.append(el('th',{},label));matchTable.append(matchHead);
 for(const match of data.matches){const row=el('tr');for(const text of [match.id,name(match.a),name(match.b),match.round??'原引擎未提供',group(match.groupId)])row.append(el('td',{},text));matchTable.append(row);}
 const participants=el('div',{className:'table-scroll'}),matches=el('div',{className:'table-scroll'});participants.append(participantTable);matches.append(matchTable);
 details.append(el('p',{className:'muted'},'此处直接展示原赛提供的选手与对局分组，不根据名字猜测或合并分组。'),el('h3',{},'原赛选手'),participants,el('h3',{},'原赛对局'),matches);return details;
}

function draw(){
 drawHostControls();const board=$('#board');board.replaceChildren();if(!current){board.textContent=userRole==='owner'&&$('#source').value==='ggfull20261126'?'尚未建立全新模拟赛。请使用上方主办方控制，建立后再手动开始Swiss。':'尚无原引擎缓存，请联系主办方。';return;}
 const entries=new Map(current.entries.map(entry=>[entry.id,entry]));board.append(el('h2',{},current.title));
 if(snapshotIssues(current).length)board.append(el('p',{className:'notice',role:'alert'},current.review?.note||'原引擎分组资料需要核对，本场只读；原缓存和比分保留。'));
 if(current.state==='complete')board.append(el('p',{className:'notice'},'赛事结束 · 冠军：'+(current.champions||[]).map(id=>entries.get(id)?.name||id).join(' / ')));
 const track=el('div',{className:'round-track'});
 for(const round of roundColumns(current)){
  const column=el('section',{className:'round-column'});column.append(el('h3',{},`${round.group?round.group+' 组 · ':''}${round.swiss?'Swiss':'淘汰赛'} · 第${round.round}轮`));
  for(const match of round.matches){
   const editable=canEditMatch(match),details=el('details',{className:'compact-match'+(editable?' editable':'')}),summary=el('summary'),players=el('span',{className:'compact-players'});
   summary.append(el('span',{className:'compact-table'},match.number??''));
   for(const [index,id]of [match.a,match.b].entries()){
    const player=el('span',{className:'compact-player'+(match.winner===id?' winner':'')});player.append(el('span',{className:'compact-seed'},entries.get(id)?.seed??''),el('span',{className:'compact-name'},entries.get(id)?.name||'轮空'),el('span',{className:'compact-score'},(index?match.scoreB:match.scoreA)??'—'));players.append(player);
   }
   summary.append(players);details.append(summary);const editor=el('div',{className:'compact-editor'});
   if(editable)mountScoreEditor(editor,match,recordFor(match),entries,{scoreLocked:match.status==='complete'&&hasDownstream(match)});
   else{
    editor.append(el('p',{className:'muted'},uncertainMatchIds.has(match.id)?'此对局写入结果待核对，暂不计入胜率，请联系主办方。':'此对局只读。'));
    const battles=verifiedBattles(match,recordFor(match));if(battles&&!uncertainMatchIds.has(match.id))editor.append(battleList(battles,entries));else if(match.status==='complete')editor.append(el('p',{className:'muted'},'决胜方式详情不可用；不会根据总分推算。'));
   }
   details.append(editor);column.append(details);
  }
  track.append(column);
 }
 board.append(track,drawStats(entries));
}

async function refresh(){
 userRole=null;allowed=false;writesEnabled=false;const {data}=await client.auth.getSession(),signed=!!data.session;
 $('#login').hidden=signed;$('#logout').hidden=!signed;$('#mfa').hidden=true;$('#permission').textContent=signed?'正在核对赛事权限…':'请先登录，赛事仅供已授权裁判查看。';
 if(!signed){current=null;recordings=[];uncertainMatchIds.clear();drafts.clear();inspection=null;draw();$('#message').textContent='请登录已获授权的测试账号。';return;}
 try{
  const access=await api('/access',{slug:$('#source').value});userRole=access.role;allowed=true;
  const cached=await api('/snapshot',{slug:$('#source').value});current=cached.snapshot;recordings=Array.isArray(cached.recordings)?cached.recordings:[];uncertainMatchIds=new Set(cached.uncertainMatchIds||[]);writesEnabled=!!cached.writesEnabled&&(!current||!snapshotIssues(current).length);
  $('#permission').textContent=(access.role==='owner'?'Owner':'Judge')+' · 仅限本场'+(!current?' · 尚无赛事缓存':writesEnabled?' · 可录分':snapshotIssues(current).length?' · 只读（分组资料待核对）':' · 只读（录分未开放或额度不足）');$('#message').textContent='权限检查通过。';
 }catch(error){
  current=null;recordings=[];uncertainMatchIds.clear();inspection=null;allowed=false;writesEnabled=false;userRole=null;
  if(error.message==='MFA_REQUIRED'){const {data:factors,error:factorError}=await client.auth.mfa.listFactors();if(factorError)throw factorError;const factor=selectTotpFactor(factors,factorId);factorId=factor?.id||null;$('#mfa').hidden=false;$('#enroll').hidden=!!factorId;}
  $('#permission').textContent=messages[error.message]||'没有查看或写入权限。';throw error;
 }finally{draw();}
}

$('#login-form').onsubmit=event=>{event.preventDefault();const email=event.target.elements.email.value,password=event.target.elements.password.value;event.target.elements.password.value='';run(async()=>{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await refresh();});};
$('#logout').onclick=()=>run(async()=>{const {error}=await client.auth.signOut();if(error)throw error;factorId=null;drafts.clear();$('#setup').replaceChildren();await refresh();$('#message').textContent='已退出。';});
 $('#check').onclick=()=>run(refresh);$('#source').onchange=()=>{inspection=null;run(refresh);};
$('#enroll').onclick=()=>run(async()=>{const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'GG Judge Test'});if(error)throw error;factorId=data.id;const image=el('img',{src:data.totp.qr_code,alt:'验证器绑定二维码'}),text=el('p',{},'手动设置密钥（仅自行保存到验证器）：'+data.totp.secret);$('#setup').replaceChildren(image,text);$('#enroll').hidden=true;$('#message').textContent='请自行绑定验证器，再输入当前验证码。';});
$('#mfa-form').onsubmit=event=>{event.preventDefault();const code=event.target.elements.code.value;event.target.elements.code.value='';run(async()=>{if(!factorId)throw Error('MFA_REQUIRED');const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});if(error)throw error;$('#setup').replaceChildren();await refresh();});};
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){allowed=false;writesEnabled=false;userRole=null;current=null;recordings=[];uncertainMatchIds.clear();drafts.clear();inspection=null;draw();$('#permission').textContent='已退出，查看及写入权限已关闭。';}});
await run(refresh);
