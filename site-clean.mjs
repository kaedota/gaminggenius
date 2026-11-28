const copy={
 'nav.book':['Book gaming','预约游玩'],'nav.events':['Tournaments','比赛与排名'],'nav.shop':['Shop','商店'],'nav.work':['Work with GG','商务合作'],'nav.member':['Member centre','会员中心']
};
function language(){return document.documentElement.lang.toLowerCase().startsWith('zh')?'zh':'en';}
function translateNavigation(){const zh=language()==='zh';document.querySelectorAll('[data-i18n-simple],[data-en][data-zh]').forEach(el=>{const pair=copy[el.dataset.i18nSimple];const value=zh?(el.dataset.zh||pair?.[1]):(el.dataset.en||pair?.[0]);if(value&&el.textContent!==value)el.textContent=value;});}
function openTarget(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id||id.startsWith('event/'))return;const target=document.getElementById(id);if(!target)return;let parent=target.closest('details');let opened=false;while(parent){if(!parent.open){parent.open=true;opened=true;}parent=parent.parentElement?.closest('details');}if(opened)requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}));}
function markPage(){const path=location.pathname.endsWith('/')?'index.html':location.pathname.split('/').pop();document.querySelectorAll('.site-header nav a').forEach(a=>{const target=new URL(a.href).pathname.split('/').pop();if(target===path)a.setAttribute('aria-current','page');});}
// Account labels are presentation only; the existing auth controller owns state.
const account=document.querySelector('#site-account');
function normalizeAccount(){account?.querySelectorAll('a').forEach(a=>{if(['会员中心','Member centre'].includes(a.textContent.trim())){a.setAttribute('data-no-translate','');const value=language()==='zh'?'会员中心':'Member centre';if(a.textContent!==value)a.textContent=value;}});}
const refreshCopy=()=>{translateNavigation();normalizeAccount();};
refreshCopy();markPage();openTarget();window.addEventListener('gg-language-change',refreshCopy);window.addEventListener('hashchange',openTarget);new MutationObserver(refreshCopy).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
if(account)new MutationObserver(normalizeAccount).observe(account,{childList:true,subtree:true});
