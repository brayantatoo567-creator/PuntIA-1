import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
(() => {
  const $ = s => document.querySelector(s);
  const avatar = $('#puntiaMascot');
  if (!avatar || avatar.dataset.puntia3d === 'ready') return;
  avatar.dataset.puntia3d = 'ready';
  const style = document.createElement('style');
  style.textContent = '#puntiaMascot{isolation:isolate;cursor:pointer;transform-style:preserve-3d}#puntiaMascot .reference-mascot{opacity:0!important;pointer-events:none}#puntiaMascot .hair,#puntiaMascot .face,#puntiaMascot .eye,#puntiaMascot .mouth,#puntiaMascot .bow,#puntiaMascot .body,#puntiaMascot .hook,#puntiaMascot .yarn{opacity:0!important}#puntiaMascot .puntia-3d-canvas{position:absolute;inset:-4% -12%;width:124%;height:108%;z-index:2;display:block;outline:none}.puntia-memory-button{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:9px;padding:10px 12px;border:1px solid #71365c;border-radius:11px;background:#21142b;color:#ff9bc6;font-weight:800;font-size:11px}.puntia-memory-panel{margin-top:10px;padding:12px;border:1px solid #49304f;border-radius:13px;background:#111728;color:#fff;font-size:12px}.puntia-memory-panel h4{margin:0 0 7px;color:#ff8cbd}.puntia-memory-panel p{color:#c4cada;line-height:1.5}.puntia-memory-panel button{border:1px solid #61405e;background:#261a31;color:#fff;border-radius:9px;padding:7px 10px;margin:3px;font-size:11px}.puntia-emotion{display:inline-flex;margin-top:7px;border-radius:20px;padding:4px 8px;background:#2b1a38;color:#ff9bc6;font-size:10px;font-weight:900}@media(prefers-reduced-motion:reduce){#puntiaMascot .puntia-3d-canvas{filter:none!important}}';
  document.head.appendChild(style);
  const canvas = document.createElement('canvas');
  canvas.className = 'puntia-3d-canvas'; canvas.setAttribute('aria-label','Mascota PuntIA animada en escena 3D'); canvas.setAttribute('role','img'); avatar.appendChild(canvas);
  let renderer, scene, camera, avatarGroup, avatarPlane, yarnGroup, frameId, observer;
  let emotion = 'happy', targetX = 0, targetY = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35,1,.1,50); camera.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,2.2));
    const key = new THREE.DirectionalLight(0xffc4df,2.1); key.position.set(-3,4,6); scene.add(key);
    const fill = new THREE.PointLight(0xffffff,1.2); fill.position.set(3,-2,4); scene.add(fill);
    avatarGroup = new THREE.Group(); scene.add(avatarGroup);
    new THREE.TextureLoader().load('/puntia-mascota.webp', texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      avatarPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.65,3.95),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
      avatarPlane.position.set(0,-.06,0); avatarGroup.add(avatarPlane);
    }, undefined, () => {
      const head = new THREE.Mesh(new THREE.SphereGeometry(.85,32,24),new THREE.MeshStandardMaterial({color:'#ff82b7',roughness:.72}));
      head.position.y=.55; avatarGroup.add(head);
      const body = new THREE.Mesh(new THREE.SphereGeometry(.7,24,18),new THREE.MeshStandardMaterial({color:'#e93483',roughness:.85}));
      body.scale.set(1.1,1.2,.6); body.position.y=-.85; avatarGroup.add(body);
      [-.3,.3].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.09,12,12),new THREE.MeshBasicMaterial({color:'#24101d'}));eye.position.set(x,.63,.77);avatarGroup.add(eye)});
    });
    yarnGroup = new THREE.Group(); scene.add(yarnGroup);
    for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=2+(i%4)*.045;const bead=new THREE.Mesh(new THREE.SphereGeometry(.025+(i%3)*.008,8,8),new THREE.MeshStandardMaterial({color:i%2?'#ff4e9a':'#ffb1d1',roughness:.7}));bead.position.set(Math.cos(a)*r,Math.sin(a)*r*.92,-.15);yarnGroup.add(bead)}
    const resize=()=>{const r=avatar.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
    observer=new ResizeObserver(resize);observer.observe(avatar);resize();
    const animate=()=>{frameId=requestAnimationFrame(animate);const t=performance.now()*.001;if(!reducedMotion){avatarGroup.position.y=Math.sin(t*1.45)*.045;avatarGroup.rotation.y+=(targetX-avatarGroup.rotation.y)*.035;avatarGroup.rotation.x+=(targetY-avatarGroup.rotation.x)*.035;avatarGroup.scale.setScalar(emotion==='excited'?1+Math.max(0,Math.sin(t*5))*.025:1);yarnGroup.rotation.z=t*.12;if(avatarPlane)avatarPlane.rotation.z=Math.sin(t*1.2)*.012}renderer.render(scene,camera)};
    animate();
    avatar.addEventListener('pointermove',e=>{const r=avatar.getBoundingClientRect();targetX=Math.max(-.16,Math.min(.16,((e.clientX-r.left)/r.width-.5)*.3));targetY=Math.max(-.12,Math.min(.12,-((e.clientY-r.top)/r.height-.5)*.18))});
    avatar.addEventListener('pointerleave',()=>{targetX=0;targetY=0});
  } catch(error) {
    console.error('PuntIA 3D no disponible:',error); canvas.remove();
    avatar.querySelector('.reference-mascot')?.style.setProperty('opacity','1','important');
    avatar.querySelectorAll('.hair,.face,.eye,.mouth,.bow,.body,.hook,.yarn').forEach(el=>el.style.setProperty('opacity','1','important'));
  }
  function setEmotion(next){
    emotion=['happy','curious','focused','excited','concerned','surprised'].includes(next)?next:'happy';
    avatar.dataset.emotion=emotion;
    let badge=$('#puntiaEmotionBadge');
    if(!badge){badge=document.createElement('span');badge.id='puntiaEmotionBadge';badge.className='puntia-emotion';$('.speech')?.appendChild(badge)}
    const labels={happy:'😊 Alegre',curious:'👀 Curiosa',focused:'🧶 Concentrada',excited:'✨ Emocionada',concerned:'💗 Te acompaño',surprised:'😮 Sorprendida'};
    badge.textContent=labels[emotion];
  }
  window.PuntIAAvatar={setEmotion,getEmotion:()=>emotion};
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{const response=await originalFetch(input,init);try{const url=typeof input==='string'?input:input.url;if(url.includes('/api/puntia/chat')&&response.ok){const data=await response.clone().json();if(data.emotion)setEmotion(data.emotion);if(data.memorySaved)showToast('Memoria actualizada')}}catch{}return response};
  function showToast(message){const toast=$('#toast');if(!toast)return;toast.textContent=message;toast.style.display='block';clearTimeout(window.__puntiaMemoryToast);window.__puntiaMemoryToast=setTimeout(()=>toast.style.display='none',2200)}
  const nav=$('#desktopNav')||$('.sidebar');
  if(nav&&!$('#puntiaMemoryButton')){
    const button=document.createElement('button');button.id='puntiaMemoryButton';button.className='puntia-memory-button';button.textContent='🧠 Memoria de PuntIA';nav.appendChild(button);
    const panel=document.createElement('section');panel.id='puntiaMemoryPanel';panel.className='puntia-memory-panel';panel.hidden=true;
    panel.innerHTML='<h4>Lo que PuntIA recuerda</h4><p id="puntiaMemoryStatus">Memoria guardada en el servidor de la aplicación.</p><div id="puntiaMemoryItems"></div><button type="button" id="puntiaSavePreference">Guardar preferencia</button><button type="button" id="puntiaClearMemory">Borrar memoria</button>';nav.appendChild(panel);
    async function refreshMemory(){const status=$('#puntiaMemoryStatus'),items=$('#puntiaMemoryItems');status.textContent='Cargando recuerdos…';items.replaceChildren();try{const r=await originalFetch('/api/puntia/memory/demo-user');if(!r.ok)throw Error('API');const rows=(await r.json()).items||[];status.textContent=rows.length?'Hay '+rows.length+' recuerdos recientes guardados.':'Todavía no hay recuerdos guardados.';rows.slice(-8).reverse().forEach(row=>{const p=document.createElement('p');p.textContent='• '+row.content;items.appendChild(p)})}catch{status.textContent='No se pudo consultar la memoria. Comprueba que el backend esté actualizado.'}}
    button.addEventListener('click',async()=>{panel.hidden=!panel.hidden;if(!panel.hidden){await refreshMemory();panel.scrollIntoView({behavior:'smooth',block:'nearest'})}});
    $('#puntiaSavePreference').addEventListener('click',async()=>{const value=window.prompt('¿Qué debería recordar PuntIA? Ejemplo: prefiero patrones para principiantes.');if(!value||!value.trim())return;try{const r=await originalFetch('/api/puntia/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'demo-user',content:value,category:'preference'})});if(!r.ok)throw Error();await refreshMemory();showToast('Preferencia guardada')}catch{showToast('No se pudo guardar la preferencia')}});
    $('#puntiaClearMemory').addEventListener('click',async()=>{if(!window.confirm('¿Borrar los recuerdos del usuario de demostración? Esta acción no se puede deshacer.'))return;try{const r=await originalFetch('/api/puntia/memory/demo-user',{method:'DELETE'});if(!r.ok)throw Error();await refreshMemory();showToast('Memoria borrada')}catch{showToast('No se pudo borrar la memoria')}});
  }
  setEmotion('happy');
  window.addEventListener('pagehide',()=>{if(frameId)cancelAnimationFrame(frameId);observer?.disconnect();renderer?.dispose()});
})();
