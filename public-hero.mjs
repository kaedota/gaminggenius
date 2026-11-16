import {upcomingEvents} from './event-utils.js';
// Explicit campaign opt-in: weekly events remain in the upcoming list below.
export function heroEvent(events,today){return upcomingEvents(events,today).find(event=>event.homeHero===true)||null;}
// Owner-selected closing campaign; a newly approved major event takes precedence.
export function heroRecap(events,today){return events.find(event=>event.id==='elmina'&&event.public!==false&&(!event.status||event.status==='confirmed')&&event.startDate&&(event.endDate||event.startDate)<today)||null;}
export function renderPublicHero(events,today,showMedia){
 const host=document.querySelector('#home .hero-copy');if(!host)return;
 const event=heroEvent(events,today),recap=event?null:heroRecap(events,today);host.replaceChildren();
 if(recap){
  const title=document.createElement('h1');title.className='visually-hidden';title.textContent='Elmina Cup 2026 — Thank you for an unforgettable battle.';
  const image=document.createElement('img');image.src='assets/elmina-closing-hero-20261116.webp';image.alt=title.textContent;image.width=1672;image.height=941;image.fetchPriority='high';image.decoding='async';
  const box=document.createElement('button');box.type='button';box.className='hero-poster-open';box.setAttribute('aria-label','View Elmina Cup closing banner');box.addEventListener('click',()=>showMedia(image.getAttribute('src'),'Elmina Cup 2026','ELMINA CUP 2026','7–8 NOVEMBER 2026'));box.append(image);host.append(title,box);
 }
 else if(!event){
  const title=document.createElement('h1');title.className='visually-hidden';title.textContent='Gaming Genius — Play, compete, belong.';
  const image=document.createElement('img');image.src='assets/gg-brand-hero-20261116-v4.webp';image.alt='Gaming Genius — Play, compete, belong.';image.width=1672;image.height=941;image.fetchPriority='high';image.decoding='async';
  const box=document.createElement('button');box.type='button';box.className='hero-poster-open';box.setAttribute('aria-label','View Gaming Genius poster');box.addEventListener('click',()=>showMedia(image.getAttribute('src'),title.textContent,'GAMING GENIUS','PLAY · COMPETE · BELONG'));box.append(image);host.append(title,box);
 }
 else{
  const title=document.createElement('h1');title.className='visually-hidden';title.textContent=event.title;
  const meta=document.createElement('p');meta.className='hero-event-meta';meta.textContent=[event.dateLabel||event.startDate,event.time,event.venue].filter(Boolean).join(' · ');
  const button=document.createElement('button');button.className='hero-poster-open';button.dataset.photo=event.poster;button.dataset.title=event.title;button.setAttribute('aria-label','View '+event.title+' poster');
  button.addEventListener('click',()=>showMedia(event.poster,event.title));
  const image=document.createElement('img');image.src=event.poster;image.alt=event.title;image.fetchPriority='high';image.decoding='async';button.append(image);host.append(title,meta,button);
 }
 const actions=document.createElement('div');actions.className='hero-actions';
 for(const [label,href,style] of [[event?'VIEW EVENT DETAILS':recap?'VIEW EVENT RECAP':'UPCOMING EVENTS',event?'#event/'+encodeURIComponent(event.id):recap?'#event/'+encodeURIComponent(recap.id):'calendar.html','red'],['GG RANKINGS','#ranking','outline']]){const link=document.createElement('a');link.className='button '+style;link.href=href;link.textContent=label;actions.append(link);}
 host.append(actions);
}
