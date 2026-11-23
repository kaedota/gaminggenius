export function renderHomeRecaps(events, dialog) {
 const host=document.getElementById('home-recaps'),event=events.find(e=>e.id==='elmina');
 const films=(event?.homepageFilms||[]).map(src=>event.videos?.find(v=>v.src===src)).filter(Boolean);
 if(!host||!films.length)return;
 host.hidden=false;host.dataset.noTranslate='';
 const make=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const top=make('div','recap-heading'),copy=make('div'),eyebrow=make('p','eyebrow'),heading=make('h2'),counter=make('span','recap-counter');
 eyebrow.textContent='ELMINA CUP 2026 / GG X BEYBLADE';copy.append(eyebrow,heading);top.append(copy,counter);
 const frame=make('div','recap-stage'),video=make('video');
 video.controls=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload='none';video.setAttribute('muted','');video.setAttribute('playsinline','');
 frame.append(video);
 const bar=make('div','recap-toolbar'),prev=make('button','button outline'),next=make('button','button outline'),sound=make('button','button outline'),tabs=make('div','recap-choices'),note=make('p','recap-note');
 note.setAttribute('role','status');counter.setAttribute('aria-live','polite');
 for(const b of[prev,next,sound])b.type='button';
 bar.append(prev,tabs,next,sound);host.replaceChildren(top,frame,bar,note);
 let index=0,visible=false,userPaused=false,automaticPause=0,failed=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const zh=()=>document.documentElement.lang.startsWith('zh');
 const text=(en,z)=>zh()?z:en;
 const label=f=>zh()?(f.titleZh||f.title):f.title;
 const eligible=()=>visible&&!document.hidden&&!dialog?.open;
 function pause(){if(!video.paused){automaticPause++;video.pause();}}
 function sync(){if(!eligible())pause();else if(!userPaused&&!reduced.matches&&!failed)video.play().catch(()=>{note.textContent=text('Press play to watch. Sound is optional.','点击播放观看，可自行开启声音。');});}
 const selectors=films.map((film,i)=>{const b=make('button','recap-choice');b.type='button';b.onclick=()=>select(i);tabs.append(b);return b;});
 function translate(){heading.textContent=text('THE BATTLE. RELIVED.','重温每一场热血对战。');prev.textContent=text('← Previous','← 上一支');next.textContent=text('Next →','下一支 →');prev.setAttribute('aria-label',text('Previous Elmina video','上一支 Elmina 视频'));next.setAttribute('aria-label',text('Next Elmina video','下一支 Elmina 视频'));sound.textContent=video.muted?text('Sound on','开启声音'):text('Mute','静音');counter.textContent=(index+1)+' / '+films.length+' · '+label(films[index]);video.setAttribute('aria-label',label(films[index]));for(let i=0;i<selectors.length;i++){selectors[i].textContent=label(films[i]);selectors[i].setAttribute('aria-pressed',String(index===i));}note.textContent=failed?text('Video unavailable. Please try the other film.','视频暂时无法播放，请切换另一支。'):text('Muted autoplay · Choose either film or turn sound on.','默认静音自动播放 · 可切换视频或开启声音。');}
 function select(i){pause();index=(i+films.length)%films.length;userPaused=false;failed=false;video.poster=films[index].poster;video.src=films[index].src;video.load();translate();sync();}
 video.addEventListener('pause',()=>{if(automaticPause){automaticPause--;return;}if(eligible())userPaused=true;});
 video.addEventListener('play',()=>{userPaused=false;if(!eligible())pause();});
 video.addEventListener('volumechange',()=>{sound.textContent=video.muted?text('Sound on','开启声音'):text('Mute','静音');});
 video.addEventListener('error',()=>{failed=true;translate();});
 prev.onclick=()=>select(index-1);next.onclick=()=>select(index+1);sound.onclick=()=>{video.muted=!video.muted;if(video.paused&&eligible()){userPaused=false;video.play().catch(()=>{});}};
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0.2}).observe(frame);
 if(dialog)new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']});
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',pause);
 window.addEventListener('gg-language-change',translate);window.addEventListener('storage',event=>{if(event.key==='gg-language')translate();});
 reduced.addEventListener('change',()=>{if(reduced.matches)pause();else sync();});
 select(0);
}
