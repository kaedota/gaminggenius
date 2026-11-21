export const SIZES=Object.freeze(['XS','S','M','L','XL','XXL','XXXL']);
export const PRODUCTS=Object.freeze({bx52:Object.freeze({name:'BX-52 LusterDragoon 6-60LC',cents:7590,max:1}),
 deck:Object.freeze({name:'GG Battle Deck Box',cents:3900,max:9}),jersey:Object.freeze({name:'GG Official Jersey',cents:6500,max:20})});
export const money=cents=>'RM'+(cents/100).toFixed(2);
export function normaliseCart(value){
 if(!Array.isArray(value))return[];
 const rows=new Map();
 for(const item of value.slice(0,100)){
  if(!item||!Object.hasOwn(PRODUCTS,item.product))continue;
  const size=item.product==='jersey'?item.size:'';
  if(item.product==='jersey'&&!SIZES.includes(size))continue;
  if(!Number.isInteger(item.quantity)||item.quantity<1)continue;
  const key=item.product+':'+size,old=rows.get(key);
  rows.set(key,{product:item.product,size,quantity:Math.min(PRODUCTS[item.product].max,(old?.quantity||0)+item.quantity)});
 }
 return [...rows.values()];
}
export const subtotal=cart=>normaliseCart(cart).reduce((sum,item)=>sum+PRODUCTS[item.product].cents*item.quantity,0);
