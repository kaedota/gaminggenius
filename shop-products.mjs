import './shop-cart.mjs?v=20261121-bx52';
import{shopCall}from'./shop-checkout.mjs?v=20261121-bx52';
const t=(en,zh)=>document.documentElement.lang.startsWith('zh')?zh:en;
const controls=[];
const stockControls=[];
for(const card of document.querySelectorAll('.product')){
 const art=card.querySelector('.product-art'),copy=card.querySelector('.product-copy');
 if(!art||!copy)continue;
 const dialog=document.createElement('dialog');dialog.className='product-dialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-label',copy.querySelector('h2').textContent);
 if(['deck-box','bx52'].includes(card.id)){stockControls.push({copy,key:card.id==='bx52'?'bx52_available':'deck_available',count:null});const stock=copy.querySelector('.stock');if(stock){stock.removeAttribute('data-en');stock.removeAttribute('data-zh');}}
 const close=document.createElement('button');close.type='button';close.className='product-close';close.textContent='×';close.setAttribute('aria-label','Close / 关闭');
 const layout=document.createElement('div');layout.className='product-detail-layout';const image=art.cloneNode(true);image.removeAttribute('target');image.classList.add('detail-art');image.setAttribute('aria-label','Enlarge image / 放大图片');
 const zoom=document.createElement('dialog');zoom.className='product-zoom';const zoomClose=close.cloneNode(true),large=art.querySelector('img').cloneNode(true);zoom.append(zoomClose,large);zoomClose.onclick=()=>zoom.close();image.onclick=e=>{e.preventDefault();zoom.showModal();};document.body.append(zoom);
 const gallery=document.createElement('div');gallery.className='product-gallery';gallery.append(image);
 if(card.dataset.gallery){const thumbs=document.createElement('div');thumbs.className='product-thumbnails';thumbs.setAttribute('aria-label','Product photos / 商品照片');const sources=card.dataset.gallery.split('|');sources.forEach((src,index)=>{const thumb=document.createElement('button');thumb.type='button';thumb.setAttribute('aria-label','Photo / 图片 '+(index+1));thumb.setAttribute('aria-pressed',String(index===0));const preview=document.createElement('img');preview.src=src;preview.alt='';preview.loading='lazy';thumb.append(preview);thumb.onclick=()=>{image.querySelector('img').src=src;image.href=src;large.src=src;thumbs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===thumb)));};thumbs.append(thumb);});gallery.append(thumbs);}
 layout.append(gallery,copy);dialog.append(close,layout);document.body.append(dialog);
 const summary=document.createElement('div');summary.className='product-summary';summary.append(copy.querySelector('.product-tag').cloneNode(true),copy.querySelector('h2').cloneNode(true),copy.querySelector('.product-price').cloneNode(true));
 const button=document.createElement('button');button.type='button';button.className='button outline';summary.append(button);card.append(summary);
 const open=()=>dialog.showModal();art.removeAttribute('target');art.onclick=e=>{e.preventDefault();open();};button.onclick=open;close.onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});zoom.addEventListener('click',e=>{if(e.target===zoom)zoom.close();});
 copy.querySelector('form')?.addEventListener('submit',()=>{if(copy.querySelector('form').checkValidity()){button.textContent=t('ADDED · VIEW DETAILS','已加入 · 查看详情');}});
 controls.push(button);
}
function translate(){controls.forEach(b=>b.textContent=t('VIEW DETAILS','查看详情'));}translate();window.addEventListener('gg-language-change',translate);
function showStock(){for(const {copy,count}of stockControls){const stock=copy.querySelector('.stock'),button=copy.querySelector('button[type=submit]'),qty=copy.querySelector('input[type=number]');if(stock)stock.textContent=count===null?t('Checking stock…','正在查询库存…'):count===0?t('Sold out','已售完'):t('Ready stock: ','现货：')+count;if(qty&&count!==null)qty.max=String(count);if(button)button.disabled=count===null||count===0;}}
async function refreshStock(){try{const data=await shopCall('catalog');stockControls.forEach(c=>c.count=typeof data[c.key]==='number'&&Number.isInteger(data[c.key])&&data[c.key]>=0?data[c.key]:null);}catch{stockControls.forEach(c=>c.count=null);}showStock();}showStock();refreshStock();window.addEventListener('gg-language-change',showStock);window.addEventListener('focus',refreshStock);
if(location.hash==='#bx52')document.querySelector('#bx52 .product-summary button')?.click();
if(location.hash==='#cart'||new URLSearchParams(location.search).has('order'))document.querySelector('.shop-cart .button.red')?.click();
