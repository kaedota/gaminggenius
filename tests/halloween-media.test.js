import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const events=JSON.parse(readFileSync(new URL('../data/events.json',import.meta.url)));
test('Halloween retains all eleven supplied photographs and a distinct recap',()=>{
 const e=events.find(e=>e.id==='halloween');
 assert.deepEqual(e.photos.map(p=>p.src.split('/').pop()).sort(),['7826','7827','7828','7829','7845','7934','7936','7938','7940','7942','7944'].map(n=>'img_'+n+'.jpg'));
 assert.equal(new Set(e.photos.map(p=>p.src)).size,11);
 for(const p of e.photos){for(const src of [p.src,p.thumbnail]){const b=readFileSync(new URL('../'+src,import.meta.url));assert.equal(b.readUInt16BE(0),0xffd8,src);}assert.ok(p.width>0&&p.height>0);}
 const films=e.videos.filter(v=>v.src==='assets/videos/halloween-2026-event-recap.mp4');assert.equal(films.length,1);
 const film=readFileSync(new URL('../'+films[0].src,import.meta.url));assert.equal(film.toString('ascii',4,8),'ftyp');
 assert.equal(readFileSync(new URL('../'+films[0].poster,import.meta.url)).readUInt16BE(0),0xffd8);
});
