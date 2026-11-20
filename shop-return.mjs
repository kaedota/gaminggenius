// Same-tab navigation only. This link grants no access; the checkout verifies auth.
if(sessionStorage.getItem('gg-shop-return')==='shop.html'){
 const link=document.createElement('a');link.href='../shop.html#cart';link.className='button';link.dataset.noTranslate='';
 const update=()=>{link.textContent=document.documentElement.lang.startsWith('zh')?'返回购物车':'BACK TO CART';};
 update();document.querySelector('main')?.prepend(link);window.addEventListener('gg-language-change',update);
}

