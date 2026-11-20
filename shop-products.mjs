import './shop-cart.mjs?v=20261121b';
import{shopCall}from'./shop-checkout.mjs?v=20261121b';
const t=(en,zh)=>document.documentElement.lang.startsWith('zh')?zh:en;
const controls=[];
let stockCopy=null,stockCount=null;
for(const card of document.querySelectorAll('.product')){
 const art=card.querySelector('.product-art'),copy=card.querySelector('.product-copy');
 if(!art||!copy)continue;
 const dialog=document.createElement('dialog');dialog.className='product-dialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-label',copy.querySelector('h2').textContent);
 if(card.id==='deck-box'){stockCopy=copy;const stock=copy.querySelector('.stock');if(stock){stock.removeAttribute('data-en');stock.removeAttribute('data-zh');}}
 const close=document.createElement('button');close.type='button';close.className='product-close';close.textContent='×';close.setAttribute('aria-label','Close / 关闭');
 const layout=document.createElement('div');layout.className='product-detail-layout';const image=art.cloneNode(true);image.removeAttribute('target');image.classList.add('detail-art');image.setAttribute('aria-label','Enlarge image / 放大图片');
 const zoom=document.createElement('dialog');zoom.className='product-zoom';const zoomClose=close.cloneNode(true),large=art.querySelector('img').cloneNode(true);zoom.append(zoomClose,large);zoomClose.onclick=()=>zoom.close();image.onclick=e=>{e.preventDefault();zoom.showModal();};document.body.append(zoom);
 layout.append(image,copy);dialog.append(close,layout);document.body.append(dialog);
 const summary=document.createElement('div');summary.className='product-summary';summary.append(copy.querySelector('.product-tag').cloneNode(true),copy.querySelector('h2').cloneNode(true),copy.querySelector('.product-price').cloneNode(true));
 const button=document.createElement('button');button.type='button';button.className='button outline';summary.append(button);card.append(summary);
 const open=()=>dialog.showModal();art.removeAttribute('target');art.onclick=e=>{e.preventDefault();open();};button.onclick=open;close.onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});zoom.addEventListener('click',e=>{if(e.target===zoom)zoom.close();});
 copy.querySelector('form')?.addEventListener('submit',()=>{if(copy.querySelector('form').checkValidity()){button.textContent=t('ADDED · VIEW DETAILS','已加入 · 查看详情');}});
 controls.push(button);
}
function translate(){controls.forEach(b=>b.textContent=t('VIEW DETAILS','查看详情'));}translate();window.addEventListener('gg-language-change',translate);
function showStock(){if(!stockCopy)return;const stock=stockCopy.querySelector('.stock'),button=stockCopy.querySelector('button[type=submit]'),qty=stockCopy.querySelector('input[type=number]');if(stock)stock.textContent=stockCount===null?t('Checking stock…','正在查询库存…'):t('Ready stock: ','现货：')+stockCount;if(qty&&stockCount!==null)qty.max=String(stockCount);if(button)button.disabled=stockCount===null||stockCount===0;}
async function refreshStock(){try{const data=await shopCall('catalog');stockCount=Number.isInteger(Number(data.deck_available))?Number(data.deck_available):null;}catch{stockCount=null;}showStock();}showStock();refreshStock();window.addEventListener('gg-language-change',showStock);window.addEventListener('focus',refreshStock);
if(location.hash==='#cart'||new URLSearchParams(location.search).has('order'))document.querySelector('.shop-cart .button.red')?.click();

