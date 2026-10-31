import test from 'node:test';import assert from 'node:assert/strict';
import {safePage,safeReferrer,pagePayload} from '../analytics.js';
test('only known sections and event IDs are reported',()=>{
 assert.deepEqual(safePage('#ranking'),{path:'/ranking',title:'GG Rankings'});
 assert.equal(safePage('#event/elmina',['elmina']).path,'/events/elmina');
 for(const hash of ['#Sailor Moon','#event/Sailor Moon','#ranking?name=secret','#event/elmina?phone=0123'])assert.deepEqual(safePage(hash,['elmina']),{path:'/',title:'Home'});
});
test('source URLs discard credentials, paths, search queries and fragments',()=>{
 assert.equal(safeReferrer('https://example.com/search?name=PRIVATE#phone'), 'https://example.com/');
 assert.equal(safeReferrer('https://user:password@example.com/private'),'https://example.com/');
 for(const value of ['', 'bad', 'javascript:private', 'file:///private'])assert.equal(safeReferrer(value),'');
});
test('payload cannot contain player input and uses only canonical public routes',()=>{
 const payload=pagePayload('#ranking',['elmina'],'https://example.com/?phone=PRIVATE');
 assert.deepEqual(Object.keys(payload),['page_location','page_title','page_referrer']);
 assert.equal(payload.page_location,'https://gaminggenius.my/ranking');
 assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
});
