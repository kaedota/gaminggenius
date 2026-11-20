import{pairs as publicPairs}from'./site-language-data.mjs?v=20261115';
import{pairs as memberPairs}from'./site-member-language.mjs?v=20261115';
import{pairs as contentPairs}from'./site-content-language.mjs?v=20261115';
const normal=s=>s.replace(/\s+/g,' ').trim();
const en=new Map(),zh=new Map();for(const[e,c]of[...publicPairs,...memberPairs,...contentPairs,['SHOP','商店'],['LIVE','直播'],['VIEW EVENT RECAP','查看赛事回顾'],['View Elmina Cup closing banner','查看 Elmina Cup 闭幕横幅'],['BOOK GAMING','游戏预约'],['VIEW EVENT DETAILS','查看赛事详情'],['UPCOMING EVENTS','近期赛事'],['PLAY. COMPETE. BELONG.','一起玩。一起比。一起成长。'],['Verification details (1–500 characters)','核对说明（1–500 字）'],['Reason (1–500 characters)','更正原因（1–500字）'],['Enter a short note, such as ok; up to 500 characters.','请填写简短说明，例如 ok；最多500字。']]){en.set(normal(e),e);en.set(normal(c),e);zh.set(normal(e),c);zh.set(normal(c),c);}
export function translate(source,language){
 const value=normal(source),dict=language==='en'?en:zh;
 if(dict.has(value))return dict.get(value);
 let m;
 if(language==='en'){
  if((m=value.match(/^已登录 · (.*)$/s)))return'Signed in · '+m[1];
  if((m=value.match(/^第 (\d+) 名$/)))return'Place '+m[1];
  if((m=value.match(/^找到 (\d+) 个档案。请核对后选择。$/)))return`Found ${m[1]} profiles. Check the records before choosing.`;
  if((m=value.match(/^已选择 (.*)（(GG-[^)]+)）。请填写参赛核对说明，提交后由 GG 审核。$/)))return`Selected ${m[1]} (${m[2]}). Enter participation details and submit for GG review.`;
  if((m=value.match(/^已选择 (.*)（(GG-[^)]+)）。登录后填写核对说明并提交认领。$/)))return`Selected ${m[1]} (${m[2]}). Sign in, enter verification details and submit your claim.`;
  if((m=value.match(/^(GG-[\w-]+) · (.*) · ([\d.]+) 分$/)))return`${m[1]} · ${m[2]} · ${m[3]} pts`;
  if((m=value.match(/^(Swiss|淘汰赛) · 第(\d+)轮$/)))return`${m[1]==='Swiss'?'Swiss':'Knockout'} · Round ${m[2]}`;
  if((m=value.match(/^赛事结束 · 冠军：(.*)$/)))return'Tournament complete · Champion: '+m[1];
  if((m=value.match(/^确认保存 (\d+)–(\d+)？将写入原引擎测试赛事。$/)))return`Save ${m[1]}–${m[2]}? This writes to the original-engine test tournament.`;
  if((m=value.match(/^(\d+) 分 · (.*)$/)))return`${m[1]} pts · ${translate(m[2],language)}`;
  if((m=value.match(/^(GG-[\w-]+) · 待审核$/)))return`${m[1]} · Pending review`;
  if((m=value.match(/^申请编号 (.*)$/)))return'Application ID '+m[1];
  if((m=value.match(/^审核原因 (.*)$/)))return'Review reason '+m[1];
  if((m=value.match(/^资料反馈 · (.*)$/)))return'Profile feedback · '+m[1];
  if((m=value.match(/^新名字 (GG-.*)$/)))return'New name '+m[1];
  if((m=value.match(/^更正原因 (GG-.*)$/)))return'Correction reason '+m[1];
  if((m=value.match(/^GG 会员隐私说明 · 更新于 (.*)$/)))return'GG member privacy notice · Updated '+m[1];
 }else{
  if((m=value.match(/^(\d+) EVENTS$/)))return`${m[1]} 场活动`;
  if((m=value.match(/^(\d+) DATED BATTLE NIGHTS$/)))return`${m[1]} 场已注明日期的夜赛`;
  if((m=value.match(/^(.*) · (REGULAR POINTS ×1|DOUBLE POINTS ×2)$/)))return m[1]+' · '+translate(m[2],language);
  if((m=value.match(/^FIRST GG RANKING EVENT (.*)$/)))return'首场 GG 积分赛事 '+translate(m[1],language);
  if((m=value.match(/^(\d+) verified events\. All results count in (.*)\.$/)))return`${m[1]} 场已核实赛事，全部成绩计入 ${m[2]}。`;
  if((m=value.match(/^(.*) · ×(\d+) · GG-confirmed final points · ([\d.]+) pts$/)))return`${m[1]} · ×${m[2]} · GG 已确认最终积分 · ${m[3]} 分`;
  if((m=value.match(/^(.*) · ×(\d+) · Place (\d+) · ([\d.]+) pts$/)))return`${m[1]} · ×${m[2]} · 第${m[3]}名 · ${m[4]} 分`;
  if((m=value.match(/^GG Season (\d+) runs (.*) \(Asia\/Kuala_Lumpur\)\. Halloween Night opens the season with Regular Points ×1\.$/)))return`GG 第${m[1]}赛季：${m[2]}（马来西亚时间）。Halloween Night 以普通积分 ×1 开启赛季。`;
  if((m=value.match(/^SEASON (\d+) RULES$/)))return`第${m[1]}赛季规则`;
  if((m=value.match(/^Starts (.*)$/)))return'开始于 '+m[1];
  if((m=value.match(/^SEASON (\d+) · (.*)$/)))return`第${m[1]}赛季 · ${translate(m[2],language)}`;
  if((m=value.match(/^View (.*) poster$/)))return`查看 ${m[1]} 海报`;
  if((m=value.match(/^View (.*), (.*)$/)))return`查看 ${m[1]}，${m[2]}`;
 }
 return source;
}
export function message(source){return translate(source,typeof document!=='undefined'&&document.documentElement.lang==='en'?'en':'zh');}

if(typeof document!=='undefined'){
 let language;try{language=localStorage.getItem('gg-language');}catch{}
 if(!['zh','en'].includes(language))language=navigator.language.toLowerCase().startsWith('zh')?'zh':'en';
 const sources=new WeakMap(),attributeSources=new WeakMap();const originalTitle=document.title;
 const protectedSelector='script,style,noscript,textarea,input,pre,code,.rank-player,.compact-name,#ranking-body td:nth-child(2),.metric-card h3,#directory-results h3,#admin-queue article p,#feedback-player option,[data-no-translate],.gg-language';
 const bar=document.createElement('div');bar.className='gg-language';bar.setAttribute('role','group');bar.setAttribute('aria-label','Language / 语言');
 const label=document.createElement('span');label.textContent='GAMING GENIUS';bar.append(label);
 const buttons=['zh','en'].map(value=>{const b=document.createElement('button');b.type='button';b.textContent=value==='zh'?'中文':'English';b.dataset.ggLang=value;b.onclick=()=>{language=value;try{localStorage.setItem('gg-language',value);}catch{}flush();window.dispatchEvent(new CustomEvent('gg-language-change',{detail:{language}}));};bar.append(b);return b;});
 document.body.prepend(bar);document.documentElement.classList.add('gg-bilingual');
 function applyText(node){if(!node.parentElement||node.parentElement.closest(protectedSelector))return;const current=node.nodeValue;let entry=sources.get(node);if(!entry||entry.last!==current)entry={source:current,last:current};const translated=translate(entry.source,language);if(current!==translated)node.nodeValue=translated;entry.last=translated;sources.set(node,entry);}
 function applyAttribute(el,name){const current=el.getAttribute(name);if(!current)return;let all=attributeSources.get(el);if(!all){all={};attributeSources.set(el,all);}let entry=all[name];if(!entry||entry.last!==current)entry={source:current,last:current};const translated=translate(entry.source,language);if(current!==translated)el.setAttribute(name,translated);entry.last=translated;all[name]=entry;}
 let pending=false;const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(flush);}});
 function flush(){pending=false;observer.disconnect();const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode())applyText(walker.currentNode);for(const el of document.querySelectorAll('[placeholder],[aria-label],button[title],a[title],summary[title]')){if(el.closest('.gg-language'))continue;for(const name of['placeholder','aria-label','title'])applyAttribute(el,name);}document.title=translate(originalTitle,language);document.documentElement.lang=language==='en'?'en':'zh-Hans';buttons.forEach(b=>b.setAttribute('aria-pressed',b.dataset.ggLang===language));observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});}
 flush();
 window.addEventListener('storage',event=>{if(event.key==='gg-language'&&['zh','en'].includes(event.newValue)){language=event.newValue;flush();}});
}
