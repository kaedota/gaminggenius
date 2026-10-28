import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {eventState,upcomingEvents,malaysiaDate} from '../event-utils.js';
const events=JSON.parse(readFileSync(new URL('../data/events.json',import.meta.url)));
test('Malaysia date crosses midnight before UTC',()=>assert.equal(malaysiaDate(new Date('2026-10-27T17:00:00Z')),'2026-10-28'));
test('upcoming, ongoing, historical and unknown dates stay distinct',()=>{
 assert.equal(eventState({startDate:'2026-11-07',endDate:'2026-11-08'},'2026-10-28').id,'upcoming');
 assert.equal(eventState({startDate:'2026-11-07',endDate:'2026-11-08'},'2026-11-08').id,'today');
 assert.equal(eventState({startDate:'2026-10-27'},'2026-10-28').id,'archived');
 assert.equal(eventState({startDate:null},'2026-10-28').id,'undated');
});
test('current upcoming list is Halloween then Elmina; expired forms do not remain upcoming',()=>{
 assert.deepEqual(upcomingEvents(events,'2026-10-28').map(e=>e.id),['halloween','elmina']);
 assert.deepEqual(upcomingEvents(events,'2026-11-09'),[]);
});
test('original posters and thumbnails exist for every event and IDs are unique',()=>{
 assert.equal(new Set(events.map(e=>e.id)).size,events.length);
 for(const event of events){assert.ok(existsSync(new URL('../'+event.poster,import.meta.url)),event.poster);assert.ok(existsSync(new URL('../'+event.thumbnail,import.meta.url)),event.thumbnail);for(const asset of [event.poster,event.thumbnail])assert.ok(statSync(new URL('../'+asset,import.meta.url)).size>0,asset+' must not be empty');}
});
test('confirmed year correction and real Elmina registration are retained',()=>{
 assert.equal(events.find(e=>e.id==='justplay').startDate,'2026-09-13');
 assert.equal(events.find(e=>e.id==='elmina').registrationUrl,'https://forms.gle/xL64RhokrHdTP4376');
 assert.equal(events.filter(e=>e.kind==='weekly').length,11);
});


test('confirmed video ownership retains the first recap without extra or duplicate films',()=>{
 const expected={paradigm:3,'centro-beyblade':1,'racers-1':2};
 const films=events.filter(e=>e.videos?.length);assert.deepEqual(Object.fromEntries(films.map(e=>[e.id,e.videos.length])),expected);
 const all=films.flatMap(e=>e.videos);assert.equal(new Set(all.map(v=>v.src)).size,6);
 const corrected=events.find(e=>e.id==='racers-1').videos.find(v=>v.src==='assets/videos/little-racers-2-event-film-01.mp4');assert.equal(corrected.title,'Little Racers I · Event Film');assert.equal(corrected.description,'A film from the first Little Racers Challenge.');assert.equal(corrected.poster,'assets/videos/little-racers-2-event-film-01.jpg');assert.ok(!(events.find(e=>e.id==='racers-2').videos||[]).some(v=>v.src===corrected.src));
 const first=events.find(e=>e.id==='racers-1').videos[0];assert.equal(first.title,'Official Event Recap · Part 3');assert.equal(first.src,'assets/videos/little-racers-1-recap-part-3.mp4');
 for(const film of all){assert.equal(film.type,'video/mp4');const video=readFileSync(new URL('../'+film.src,import.meta.url));assert.equal(video.subarray(4,8).toString(),'ftyp');assert.ok(video.length>1000000);const poster=readFileSync(new URL('../'+film.poster,import.meta.url));assert.equal(poster[0],0xff);assert.equal(poster[1],0xd8);}
});
