const get=(store,key)=>{try{return store?.getItem(key)??null;}catch{return null;}};
export function resolveAuthReturn(from,store){if(from==='passes'||from==='booking')return from;if(get(store,'gg-passes-return')==='play-passes.html')return'passes';if(get(store,'gg-booking-return')==='booking.html')return'booking';return null;}
export function rememberAuthReturn(kind,store){try{if(kind==='passes'){store.setItem('gg-passes-return','play-passes.html');store.removeItem('gg-booking-return');return true;}if(kind==='booking'){store.setItem('gg-booking-return','booking.html');store.removeItem('gg-passes-return');return true;}}catch{}return false;}
export function clearAuthReturn(kind,store){try{if(kind==='passes')store.removeItem('gg-passes-return');}catch{}}
