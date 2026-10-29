export function malaysiaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function eventState(event, today = malaysiaDate()) {
  if (!event.startDate) return { id: 'undated', label: 'DATE TO BE ADDED' };
  if (event.startDate > today) return { id: 'upcoming', label: 'UPCOMING' };
  if ((event.endDate || event.startDate) >= today) return { id: 'today', label: 'EVENT DAY' };
  return { id: 'archived', label: 'PAST EVENT' };
}
export function sortNewest(events) {
  return [...events].sort((a, b) => (b.startDate || '0000-00-00').localeCompare(a.startDate || '0000-00-00'));
}
export function upcomingEvents(events, today = malaysiaDate()) {
  return events.filter(e => e.startDate && (e.endDate || e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function seasonState(config, today = malaysiaDate()) {
  if (config.status === 'completed' || config.endDate && today > config.endDate) return {id:'ended',label:'Season Ended'};
  if (config.status === 'draft' || !config.startDate) return {id:'draft',label:'Season Coming Soon'};
  if (today < config.startDate) {
    const date = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'long'}).format(new Date(config.startDate+'T00:00:00+08:00'));
    return {id:'upcoming',label:'Starts '+date};
  }
  return {id:'live',label:'Season Live'};
}
export function rankingEventLabel(event, config) {
  const setting=config?.events?.[event.id];
  if(!setting?.eligible || event.category!=='beyblade' || !event.startDate || event.startDate<config.startDate || (event.endDate||event.startDate)>config.endDate)return '';
  const tier=setting.multiplier===2?'DOUBLE POINTS ×2':'REGULAR POINTS ×1';
  return (setting.firstRankingEvent?'FIRST GG RANKING EVENT\n':'')+(config.shortName||config.name.toUpperCase())+' · '+tier;
}
export function matchesPlayer(player,query) { return (player.name+' '+player.id).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()); }
