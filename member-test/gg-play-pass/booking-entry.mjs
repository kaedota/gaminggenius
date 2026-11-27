// Additive optional entry only. Never changes prices, holds, payment methods or
// native inventory. Call again after the existing booking render() replaces DOM.
export function mountPassEntry(root,{language='zh',href='play-passes.html'}={}){
 if(!root||root.querySelector('[data-gg-pass-entry]'))return;
 const en=language==='en',box=document.createElement('aside');box.dataset.ggPassEntry='';box.className='gg-pass-entry';
 const title=document.createElement('strong');title.textContent='GTA VI PLAY PASS';
 const line=document.createElement('p');line.textContent=en?'RM350 · 30 sessions × 2 hours · 90 days':'RM350 · 30次 × 2小时 · 90天有效';
 const a=document.createElement('a');a.href=href;a.textContent=en?'VIEW PLAY PASS →':'查看游玩配套 →';box.append(title,line,a);root.append(box);
 return()=>box.remove();
}
