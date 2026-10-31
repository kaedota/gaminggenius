import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pointsFor,calculateRankings,validateResults,upsertResults,parseCSV,startNextSeason} from '../ranking.js';
const live=JSON.parse(readFileSync(new URL('../data/season.json',import.meta.url)));
const rows=live.results.filter(r=>r.event_id==='halloween');
const expected=[['Sailor Moon',20],['大马古天乐',20],['Hong',12],['XD Jason',12],['Bryan',12],['BKM_DK',10],['Fariz',10],['Jason Lee',10],['XD Jim',10],['Corvus',10],['Andu',10],['Vincent',10],['XD Ashe',10],['Yeoh',10],['Kendesu',10],['Sky',7],['Louis',7],['BKM_Meehun',5],['Sky 的朋友',5],['saintwolfgang',5],['Lengzai Boss',5],['Yz',5],['Ah Bean',5],['Luck is Skill',5],['RK9',5]];
test('published Halloween has 25 distinct players, 38 slots and exactly 230 confirmed points in owner order',()=>{
 assert.equal(rows.length,25);assert.equal(new Set(rows.map(r=>r.player_id)).size,25);
 assert.equal(live.events.halloween.slots,38);assert.ok(rows.every(r=>r.participants===25&&r.placement===null));
 assert.deepEqual(calculateRankings(rows,live).map(p=>[p.name,p.total]),expected);
 assert.equal(rows.reduce((n,r)=>n+pointsFor(r,live),0),230);
 assert.notEqual(rows.find(r=>r.display_name==='Sky').player_id,rows.find(r=>r.display_name==='Sky 的朋友').player_id);
});
test('final total is not stacked or multiplied; explicit event authorization is required',()=>{
 const row=rows[2];assert.equal(pointsFor({...row,placement:1,top_cut:true},live),12);
 const doubled={...live,events:{...live.events,halloween:{...live.events.halloween,multiplier:2}}};assert.equal(pointsFor(row,doubled),12);
 assert.throws(()=>validateResults([row],{...live,events:{...live.events,halloween:{...live.events.halloween,allowFinalPoints:false}}}),/final points/);
 for(const points of [-1,NaN,Infinity,1.5,'12'])assert.throws(()=>validateResults([{...row,final_points:points}],live),/final points/);
 assert.throws(()=>validateResults([{...row,attendance:'no_show'}],live),/Absent/);
 assert.throws(()=>validateResults([{...row,slot:'B'}],live),/slot\/session/);
});
test('re-save and corrections replace a player event; other event totals still accumulate',()=>{
 const before=JSON.stringify(live);const same=upsertResults(rows,rows,live);assert.deepEqual(same,rows);
 const r=rows[0],corrected=upsertResults(rows,[{...r,final_points:7}],live);assert.equal(corrected.length,25);assert.equal(calculateRankings(corrected,live).find(p=>p.id===r.player_id).total,7);
 const other={...r,event_id:'elmina',date:'2026-11-07',placement:1};delete other.final_points;
 const combined=upsertResults(rows,[other],live);assert.equal(calculateRankings(combined,live).find(p=>p.id===r.player_id).total,60);
 assert.equal(JSON.stringify(live),before);
});
test('confirmed final-points CSV round trips blank placing without changing IDs or totals',()=>{
 const csv='season_id,event_id,date,player_id,display_name,placement,participants,attendance,final_points\nseason-01,halloween,2026-10-30,GG-0003,Hong,,25,attended,12\n';
 const imported=parseCSV(csv);assert.equal(imported[0].placement,null);assert.equal(pointsFor(imported[0],live),12);assert.equal(upsertResults(rows,imported,live).length,25);
 assert.throws(()=>validateResults(parseCSV(csv.replace(',12\n',',=12\n')),live),/final points/);
});
test('archive preserves confirmed totals and tie order while new season starts empty',()=>{
 const next=startNextSeason({...live,status:'completed'},'season-02','GG Season 02');assert.equal(next.results.length,0);
 assert.deepEqual(next.archives.at(-1).finalRankings.map(p=>[p.name,p.total]),expected);
 assert.throws(()=>validateResults(rows,next),/Wrong season/);
});
