import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {selectFeaturedFilm} from '../featured-film.js';
const events=JSON.parse(readFileSync(new URL('../data/events.json',import.meta.url)));
test('only explicitly selected Elmina promo features before and during its dates',()=>{
  for(const day of ['2026-10-29','2026-11-07','2026-11-08']){
    const selected=selectFeaturedFilm(events,day);assert.equal(selected.event.id,'elmina');
    assert.equal(selected.film.src,'assets/videos/elmina-cup-promo-01.mp4');
    assert.ok(existsSync(new URL('../'+selected.film.src,import.meta.url)));
    assert.ok(existsSync(new URL('../'+selected.film.poster,import.meta.url)));
  }
  assert.equal(selectFeaturedFilm(events,'2026-11-09'),null);
  assert.equal(selectFeaturedFilm(events.map(({homepagePromo,...e})=>e),'2026-10-29'),null);
});
