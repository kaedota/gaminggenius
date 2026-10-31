import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {eventState,upcomingEvents,malaysiaDate,sortNewest} from '../event-utils.js';
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
 assert.equal(events.filter(e=>e.kind==='weekly').length,14);
});


test('confirmed video ownership retains the first recap without extra or duplicate films',()=>{
 const expected={paradigm:3,'centro-beyblade':2,'centro-tcg':1,'racers-1':2,'racers-2':2,elmina:1,halloween:1};
 const films=events.filter(e=>e.videos?.length);assert.deepEqual(Object.fromEntries(films.map(e=>[e.id,e.videos.length])),expected);
 const all=films.flatMap(e=>e.videos);assert.equal(new Set(all.map(v=>v.src)).size,12);
 const corrected=events.find(e=>e.id==='racers-1').videos.find(v=>v.src==='assets/videos/little-racers-2-event-film-01.mp4');assert.equal(corrected.title,'Little Racers I · Event Film');assert.equal(corrected.description,'A film from the first Little Racers Challenge.');assert.equal(corrected.poster,'assets/videos/little-racers-2-event-film-01.jpg');assert.ok(!(events.find(e=>e.id==='racers-2').videos||[]).some(v=>v.src===corrected.src));
 const first=events.find(e=>e.id==='racers-1').videos[0];assert.equal(first.title,'Official Event Recap · Part 3');assert.equal(first.src,'assets/videos/little-racers-1-recap-part-3.mp4');
 for(const film of all){assert.equal(film.type,'video/mp4');const video=readFileSync(new URL('../'+film.src,import.meta.url));assert.equal(video.subarray(4,8).toString(),'ftyp');assert.ok(video.length>1000000);const poster=readFileSync(new URL('../'+film.poster,import.meta.url));assert.equal(poster[0],0xff);assert.equal(poster[1],0xd8);}
});

test('confirmed poster dates migrate once into Weekly and keep archive order',()=>{
 const checks=[['weekly-1013','2026-10-13','assets/posters/undated-emperor.webp'],['weekly-0929','2026-09-29','assets/posters/undated-prizes.webp'],['centro-beyblade','2026-08-16','assets/posters/centro-beyblade.webp']];
 for(const [id,date,poster] of checks){const e=events.find(e=>e.id===id);assert.equal(e.startDate,date);assert.equal(e.endDate,date);assert.equal(e.poster,poster);assert.equal(events.filter(e=>e.poster===poster).length,1);assert.equal(eventState(e,'2026-10-29').label,'PAST EVENT');}
 const weekly=sortNewest(events.filter(e=>e.kind==='weekly')).map(e=>e.id);assert.ok(weekly.indexOf('weekly-1020')<weekly.indexOf('weekly-1013'));assert.ok(weekly.indexOf('weekly-1013')<weekly.indexOf('weekly-1011'));assert.ok(weekly.indexOf('weekly-1011')<weekly.indexOf('weekly-0929'));assert.ok(weekly.indexOf('weekly-0929')<weekly.indexOf('weekly-0922'));
 const archive=sortNewest(events.filter(e=>e.kind!=='weekly')).map(e=>e.id);assert.equal(archive[archive.indexOf('centro-tcg')+1],'centro-beyblade');assert.equal(archive[archive.indexOf('centro-beyblade')+1],'racers-2');
 assert.deepEqual(JSON.parse(readFileSync(new URL('../data/supplemental.json',import.meta.url))),[]);
});

test('four supplied event films are merged into the owner-confirmed activities',()=>{for(const [id,slugs] of [['racers-2',['little-racers-2-recap-v2','little-racers-2-event-highlights']],['centro-beyblade',['centro-beyblade-20260816-event-film']],['centro-tcg',['centro-tcg-event-film']]])for(const slug of slugs){const matches=events.filter(e=>e.videos?.some(v=>v.src==='assets/videos/'+slug+'.mp4'));assert.deepEqual(matches.map(e=>e.id),[id]);const film=matches[0].videos.find(v=>v.src==='assets/videos/'+slug+'.mp4');assert.equal(film.poster,'assets/videos/'+slug+'.jpg');assert.ok(film.width>0&&film.height>0);assert.ok(statSync(new URL('../'+film.src,import.meta.url)).size<25000000);}});
