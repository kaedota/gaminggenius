import {upcomingEvents} from './event-utils.js';
export function heroEvent(events,today){return upcomingEvents(events,today)[0]||null;}
export function renderPublicHero(events,today,showMedia){
 const host=document.querySelector('#home .hero-copy');if(!host)return;
 const event=heroEvent(events,today);host.replaceChildren();
 if(!event){const box=document.createElement('div');box.className='hero-placeholder';const title=document.createElement('h1');title.textContent='PLAY. COMPETE. BELONG.';box.append(title);host.append(box);}
 else{
  const title=document.createElement('h1');title.className='visually-hidden';title.textContent=event.title;
  const meta=document.createElement('p');meta.className='hero-event-meta';meta.textContent=[event.dateLabel||event.startDate,event.time,event.venue].filter(Boolean).join(' · ');
  const button=document.createElement('button');button.className='hero-poster-open';button.dataset.photo=event.poster;button.dataset.title=event.title;button.setAttribute('aria-label','View '+event.title+' poster');
  button.addEventListener('click',()=>showMedia(event.poster,event.title));
  const image=document.createElement('img');image.src=event.poster;image.alt=event.title;image.fetchPriority='high';image.decoding='async';button.append(image);host.append(title,meta,button);
 }
 const actions=document.createElement('div');actions.className='hero-actions';
 for(const [label,href,style] of [[event?'VIEW EVENT DETAILS':'UPCOMING EVENTS',event?'#event/'+encodeURIComponent(event.id):'calendar.html','red'],['GG RANKINGS','#ranking','outline']]){const link=document.createElement('a');link.className='button '+style;link.href=href;link.textContent=label;actions.append(link);}
 host.append(actions);
}
