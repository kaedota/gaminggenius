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
