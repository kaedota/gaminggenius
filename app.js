import {calculateRankings} from './ranking.js';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const dialog=$('event-dialog');
$('dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function showEvent(e){
 $('dialog-label').textContent=e.label;$('dialog-title').textContent=e.title;$('dialog-meta').textContent=`${e.date} / ${e.venue}`;$('dialog-description').textContent=e.description;$('dialog-details').textContent=e.details;
 $('dialog-metrics').replaceChildren(...e.metrics.map(([value,label])=>{const d=node('div');d.append(node('strong',value),node('span',label));return d;}));dialog.showModal();
}
let events=[];
function renderEvents(filter='all'){
 const list=events.filter(e=>filter==='all'||e.category===filter).sort((a,b)=>Number(b.featured||false)-Number(a.featured||false)||b.sortDate.localeCompare(a.sortDate));
 $('event-count').textContent=`${list.length} ARCHIVE ENTRIES`;
 $('event-grid').replaceChildren(...list.map((e,i)=>{
 const article=node('article',undefined,'event-card');const art=node('button',undefined,`event-art ${e.accent} ${e.category==='racers'?'racing':e.category==='community'?'community':''}`);art.setAttribute('aria-label',`View ${e.title}`);art.append(node('span',e.label,'art-label'),node('span',e.title,'art-title'),node('span',String(i+1).padStart(2,'0'),'art-number'));art.addEventListener('click',()=>showEvent(e));
 const meta=node('div',undefined,'event-card-meta');meta.append(node('span',e.date,'event-date'),node('span',e.status==='completed'?'COMPLETED':e.status==='series'?'ONGOING SERIES':'PROPOSED',`status ${e.status}`));
 const title=node('h3',undefined,'event-title'),button=node('button',e.title);button.addEventListener('click',()=>showEvent(e));title.append(button,node('span','↗'));article.append(art,meta,title,node('p',e.venue,'event-venue'));return article;
 }));
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderEvents(button.dataset.filter);}));
let rankings=[],season;
function renderRankings(){
 const q=$('player-search').value.trim().toLocaleLowerCase();const matches=rankings.filter(p=>`${p.name} ${p.id}`.toLocaleLowerCase().includes(q));
 $('ranking-body').replaceChildren(...matches.map(p=>{
 const row=node('tr');const who=node('td'),button=node('button',p.name,'rank-player');button.addEventListener('click',()=>{
 $('dialog-label').textContent=`${season.name} / PLAYER RESULTS`;$('dialog-title').textContent=p.name;$('dialog-meta').textContent=`${p.id} · Rank ${p.rank} · ${p.total} points`;$('dialog-description').textContent=`Best ${season.bestResults} eligible results count. ${p.results.length} recorded events.`;$('dialog-metrics').replaceChildren();$('dialog-details').replaceChildren(...p.results.map(r=>node('p',`${r.date} · ${r.event_id} · Place ${r.placement} · ${r.points} pts${p.counted.includes(r)?' · COUNTED':''}`)));dialog.showModal();
 });who.append(button,node('small',p.id));row.append(node('td',String(p.rank).padStart(2,'0')),who,node('td',String(p.results.length)),node('td',String(p.total)));return row;
 }));
 $('ranking-empty').hidden=matches.length>0;
 if(rankings.length && !matches.length){$('ranking-empty').replaceChildren(node('h4','No matching players.'),node('p','Try another name or GG player ID.'));}
}
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`Could not load ${path}`);return r.json();}
getJSON('data/events.json').then(data=>{events=data;renderEvents();}).catch(()=>{$('event-grid').replaceChildren(node('p','The archive could not load. Please refresh or contact GG.','load-state'));});
getJSON('data/season.json').then(config=>{
 season=config;
 $('season-name-label').textContent=config.name.toUpperCase();
 $('rank-footnote').textContent=`${config.status==='active'?'Season format':'Proposed format'}: best ${config.bestResults} eligible event results per season.`;
 document.querySelectorAll('.point-grid strong').forEach((el,i)=>{el.textContent=[config.points['1'],config.points['2'],config.points['3'],config.points['4'],config.points.top8,config.points.top16,config.points.participation][i];});
 const bestSummary=document.querySelectorAll('.rules-content summary')[1];
 bestSummary.textContent=`Why the best ${config.bestResults} results?`;
 bestSummary.nextElementSibling.textContent=`Your ${config.bestResults} highest-scoring eligible results contribute to your total. Extra appearances offer another chance to improve, without making attendance alone the deciding factor. One placement award per event; participation points are not added on top.`;

 if(config.status==='active'){
 $('rulebook-label').textContent='THE RULEBOOK / SEASON RULES';$('rulebook-description').textContent='Only announced GG season points events count. Check event eligibility before registering.';rankings=calculateRankings(config.results,config);$('season-status').textContent='SEASON ACTIVE';$('season-dates').textContent=`${config.startDate||'Start TBA'} — ${config.endDate||'End TBA'}`;
 }else{$('season-status').textContent='RULES IN DEVELOPMENT';}
 renderRankings();
}).catch(()=>{$('ranking-empty').replaceChildren(node('h4','Rankings are unavailable.'),node('p','Please try again later. No results have been displayed.'));});
$('player-search').addEventListener('input',renderRankings);
