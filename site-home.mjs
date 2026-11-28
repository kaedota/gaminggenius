import{startAnalytics}from'./analytics.js?v=20261128-simple-v1';
const legacy=new Set(['events','weekly','ranking','rules','upcoming','highlights']);
export function legacyEventTarget(hash){if(legacy.has(hash.slice(1))||hash.startsWith('#event/'))return 'events.html'+hash;return null;}
const forward=()=>{const target=legacyEventTarget(location.hash);if(target)location.replace(new URL(target,location.href));};
forward();window.addEventListener('hashchange',forward);if(!legacyEventTarget(location.hash))startAnalytics('G-CYS5Q3VHJT');const year=document.querySelector('#copyright-year');if(year)year.textContent=new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
