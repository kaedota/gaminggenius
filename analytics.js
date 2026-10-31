const sections = new Map([
  ['home','Home'], ['events','Event Archive'], ['ranking','GG Rankings'],
  ['weekly','Weekly Battles'], ['rules','Season Rules'], ['about','About GG'],
  ['connect','Community'], ['partner','Event Partnerships'], ['upcoming','Upcoming Events'],
  ['featured-film','Featured Event']
]);
export function safePage(hash, eventIds = []) {
  const key=String(hash||'').replace(/^#/,'');
  if(sections.has(key))return {path:'/'+(key==='home'?'':key),title:sections.get(key)};
  if(key.startsWith('event/') && eventIds.includes(key.slice(6)))return {path:'/events/'+key.slice(6),title:'GG Event · '+key.slice(6)};
  return {path:'/',title:'Home'};
}
export function safeReferrer(value) {
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.origin+'/':'';} catch {return '';}
}
export function pagePayload(hash,eventIds,referrer) {
  const page=safePage(hash,eventIds);
  return {page_location:'https://gaminggenius.my'+page.path,page_title:page.title,page_referrer:safeReferrer(referrer)};
}
// Enable only after the administrator creates the GA4 stream and disables enhanced measurement.
export function startAnalytics(measurementId,eventIds=[]) {
  if(!/^G-[A-Z0-9]+$/.test(measurementId)||location.hostname!=='gaminggenius.my'||navigator.doNotTrack==='1')return;
  window.dataLayer=window.dataLayer||[];
  const gtag=function(){window.dataLayer.push(arguments);};
  const initial=pagePayload(location.hash,eventIds,document.referrer);
  gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('js',new Date());
  gtag('config',measurementId,{...initial,send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  let previous='';
  function track() {
    const payload=pagePayload(location.hash,eventIds,document.referrer);
    if(payload.page_location===previous)return;
    previous=payload.page_location;
    gtag('event','page_view',{...payload,send_to:measurementId});
  }
  track();window.addEventListener('hashchange',track);
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;document.head.append(script);
}
