export function setupEventGallery(pauseVideos) {
  const section=document.getElementById('event-gallery');
  const viewer=document.getElementById('photo-dialog');
  const image=document.getElementById('photo-view');
  const heading=document.getElementById('photo-title');
  const previous=document.getElementById('photo-previous');
  const next=document.getElementById('photo-next');
  let photos=[],index=0,title='';
  function show(i) {
    index=(i+photos.length)%photos.length;
    const photo=photos[index];image.src=photo.src;image.alt=photo.alt||title;
    image.width=photo.width;image.height=photo.height;
    heading.textContent=title+' · Photo '+(index+1)+' / '+photos.length;
    previous.disabled=next.disabled=photos.length<2;
  }
  document.getElementById('photo-close').addEventListener('click',()=>viewer.close());
  previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));
  viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}});
  viewer.addEventListener('close',()=>image.removeAttribute('src'));
  function clear() {if(viewer.open)viewer.close();section.replaceChildren();section.hidden=true;photos=[];}
  function render(event) {
    clear();photos=event.photos||[];title=event.title;
    if(!photos.length)return;
    section.hidden=false;
    const label=document.createElement('p');label.className='eyebrow';label.textContent='FROM THE EVENT';
    const h=document.createElement('h3');h.textContent='EVENT PHOTOS';
    const grid=document.createElement('div');grid.className='event-photo-grid';
    photos.forEach((photo,i)=>{
      const button=document.createElement('button');button.className='event-photo-open';button.setAttribute('aria-label','Enlarge '+title+' photo '+(i+1));
      const thumb=document.createElement('img');thumb.src=photo.thumbnail||photo.src;thumb.alt=photo.alt||title;thumb.width=photo.width;thumb.height=photo.height;thumb.loading='lazy';thumb.decoding='async';
      button.append(thumb);button.addEventListener('click',()=>{pauseVideos();show(i);viewer.showModal();});grid.append(button);
    });section.append(label,h,grid);
  }
  return {clear,render};
}
