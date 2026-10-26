import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const avatar = $('#puntiaMascot');
  if (!avatar || avatar.dataset.puntia3d === 'ready') return;
  avatar.dataset.puntia3d = 'ready';

  const style = document.createElement('style');
  style.textContent = `
    #puntiaMascot{isolation:isolate;cursor:pointer;transform-style:preserve-3d;position:relative}
    #puntiaMascot .reference-mascot,#puntiaMascot .hair,#puntiaMascot .face,#puntiaMascot .eye,#puntiaMascot .mouth,#puntiaMascot .bow,#puntiaMascot .body,#puntiaMascot .hook,#puntiaMascot .yarn{opacity:0!important;pointer-events:none}
    #puntiaMascot .puntia-3d-canvas{position:absolute;inset:-2% -5%;width:110%;height:104%;z-index:2;display:block;outline:none;touch-action:pan-y}
    .puntia-memory-button{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:9px;padding:10px 12px;border:1px solid #71365c;border-radius:11px;background:#21142b;color:#ff9bc6;font-weight:800;font-size:11px}
    .puntia-memory-panel{margin-top:10px;padding:12px;border:1px solid #49304f;border-radius:13px;background:#111728;color:#fff;font-size:12px}
    .puntia-memory-panel h4{margin:0 0 7px;color:#ff8cbd}.puntia-memory-panel p{color:#c4cada;line-height:1.5}
    .puntia-memory-panel button{border:1px solid #61405e;background:#261a31;color:#fff;border-radius:9px;padding:7px 10px;margin:3px;font-size:11px}
    .puntia-emotion{display:inline-flex;margin-top:7px;border-radius:20px;padding:4px 8px;background:#2b1a38;color:#ff9bc6;font-size:10px;font-weight:900}
    @media(prefers-reduced-motion:reduce){#puntiaMascot .puntia-3d-canvas{filter:none!important}}
  `;
  document.head.appendChild(style);

  const canvas = document.createElement('canvas');
  canvas.className = 'puntia-3d-canvas';
  canvas.setAttribute('aria-label', 'PuntIA, muñeca 3D de estambre con expresiones animadas');
  canvas.setAttribute('role', 'img');
  avatar.appendChild(canvas);

  let renderer, scene, camera, root, face, eyes = [], brows = [], mouth, yarnOrbit, hookGroup;
  let frameId, observer, emotion = 'happy', targetX = 0, targetY = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const animatedParts = {};
  const material = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
  const sphere = (parent, name, pos, scale, mat, segments = 24) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(12, Math.floor(segments * .7))), mat);
    mesh.name = name; mesh.position.set(...pos); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  };
  const tube = (parent, name, points, radius, mat, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 5), radius, 8, closed), mat);
    mesh.name = name; parent.add(mesh); return mesh;
  };

  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, .1, 40);
    camera.position.set(0, .15, 9.2);
    scene.add(new THREE.HemisphereLight(0xffe6f2, 0x40305e, 2.0));
    const key = new THREE.DirectionalLight(0xffd5e8, 3.0); key.position.set(-3, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa88cff, 2.1); rim.position.set(4, 2, -4); scene.add(rim);
    const fill = new THREE.PointLight(0xffffff, 1.0); fill.position.set(2, -2, 5); scene.add(fill);

    root = new THREE.Group(); root.name = 'PuntIA_Rig'; scene.add(root);
    const hairMat = material('#f45ca8'), hairLight = material('#ff9bce'), hairDark = material('#d93687');
    const skinMat = material('#ffd2b5'), skinShade = material('#eaa18d');
    const dressMat = material('#a782f3'), dressLight = material('#c5a9ff'), dressDark = material('#7750c7');
    const white = material('#fff9fb', .45), eyeMat = material('#38213d', .32), irisMat = material('#6d3b72', .3);
    const stitchMat = material('#f7c2df'), hookMat = material('#f0c37a', .32, .25), yarnMat = material('#ff79b9');
    const blushMat = new THREE.MeshStandardMaterial({color:'#f58caa',transparent:true,opacity:.48,roughness:1});

    // Volumetric amigurumi head, neck and body.
    sphere(root, 'neck', [0,.35,0], [.24,.35,.24], skinMat);
    const torso = new THREE.Mesh(new THREE.ConeGeometry(.68,1.28,40,1,false), dressMat);
    torso.name = 'crochet_dress'; torso.position.set(0,-.48,0); torso.scale.z=.68; root.add(torso);
    sphere(root, 'dress_collar', [0,.08,.03], [.42,.15,.38], dressLight);
    sphere(root, 'head', [0,1.18,.02], [.73,.82,.62], skinMat, 40);
    sphere(root, 'ear_left', [-.7,1.14,0], [.14,.2,.12], skinShade);
    sphere(root, 'ear_right', [.7,1.14,0], [.14,.2,.12], skinShade);
    sphere(root, 'ear_inner_left', [-.72,1.14,.085], [.06,.1,.035], blushMat);
    sphere(root, 'ear_inner_right', [.72,1.14,.085], [.06,.1,.035], blushMat);
    sphere(root, 'cheek_left', [-.43,.96,.51], [.17,.095,.035], blushMat);
    sphere(root, 'cheek_right', [.43,.96,.51], [.17,.095,.035], blushMat);

    // Yarn hair cap and individual wool curls create real depth and silhouette.
    sphere(root, 'hair_cap', [0,1.65,-.02], [.78,.61,.65], hairMat, 36);
    const curls = [];
    const curlPositions = [
      [-.67,1.77,.16,.25],[-.47,2.03,.14,.23],[-.22,2.12,.13,.21],[.05,2.14,.14,.22],[.32,2.07,.15,.23],[.56,1.91,.16,.24],[.69,1.65,.16,.23],
      [-.68,1.38,.16,.24],[.66,1.39,.16,.24],[-.61,1.1,.14,.21],[.61,1.1,.14,.21],[-.45,1.89,.14,.22],[.45,1.91,.14,.22]
    ];
    curlPositions.forEach((p,i)=>{
      const c=sphere(root,'yarn_curl_'+i,[p[0],p[1],.19], [p[2],p[3],.22],i%3===0?hairLight:hairMat,20); curls.push(c);
      tube(root,'curl_stitch_'+i,[[p[0]-.045,p[1]+.035,.39],[p[0],p[1]+.065,.405],[p[0]+.045,p[1]+.035,.39]],.012,hairDark);
    });
    // Side locks frame the face.
    sphere(root,'lock_left',[-.62,1.0,.25],[.19,.46,.22],hairMat);
    sphere(root,'lock_right',[.62,1.0,.25],[.19,.46,.22],hairMat);

    // Face rig: separate eye, eyelid, eyebrow and mouth objects.
    [-.29,.29].forEach((x,i)=>{
      const eyeGroup = new THREE.Group(); eyeGroup.name=i===0?'eye_rig_left':'eye_rig_right'; eyeGroup.position.set(x,1.29,.565); root.add(eyeGroup);
      sphere(eyeGroup,'eye_white',[0,0,0],[.145,.205,.075],white,24);
      sphere(eyeGroup,'iris',[.012,-.005,.061],[.083,.112,.032],irisMat,20);
      sphere(eyeGroup,'pupil',[.016,-.002,.085],[.048,.075,.021],eyeMat,18);
      sphere(eyeGroup,'eye_glint',[-.012,.045,.105],[.022,.028,.012],white,12);
      const lid=sphere(eyeGroup,'blink_lid',[0,.20,.09],[.16,.005,.03],skinMat,16);
      eyes.push({group:eyeGroup,lid});
      tube(root,'eyebrow_'+i,[[x-.13,1.54,.59],[x,1.59,.62],[x+.13,1.54,.59]],.027,hairDark);
      brows.push(root.getObjectByName('eyebrow_'+i));
    });
    mouth = tube(root,'mouth', [[-.13,.78,.625],[-.065,.735,.65],[0,.73,.66],[.065,.735,.65],[.13,.78,.625]], .022, material('#a84868'));
    // Nose and cheek embroidery.
    sphere(root,'nose',[0,1.02,.63],[.055,.045,.035],skinShade,16);
    // Crochet texture marks across the dress.
    for(let row=0;row<4;row++) for(let col=-2;col<=2;col++){
      const x=col*.19, y=-.18-row*.23;
      tube(root,'dress_stitch_'+row+'_'+col,[[x-.045,y,.42-Math.abs(col)*.035],[x,y+.035,.44-Math.abs(col)*.035],[x+.045,y,.42-Math.abs(col)*.035]],.012,stitchMat);
    }

    // Articulated arms with subtle idle swing.
    const armMat = material('#f5b99f');
    const arms = [];
    [-1,1].forEach(side=>{
      const pivot=new THREE.Group(); pivot.position.set(side*.48,.02,0); root.add(pivot); arms.push({pivot,side});
      sphere(pivot,'shoulder',[side*.08,-.03,.02],[.19,.2,.2],dressLight);
      const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,4,10),armMat); upper.position.set(side*.22,-.29,.05); upper.rotation.z=side*.48; pivot.add(upper);
      sphere(pivot,'hand',[side*.39,-.54,.12],[.13,.14,.12],skinMat);
    });
    // Crochet hook in her right hand.
    hookGroup=new THREE.Group(); hookGroup.name='crochet_hook_rig'; hookGroup.position.set(.76,-.45,.3); hookGroup.rotation.z=-.48; root.add(hookGroup);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.92,12),hookMat); shaft.rotation.z=-.32; hookGroup.add(shaft);
    tube(hookGroup,'hook_tip',[[.12,.39,0],[.17,.48,0],[.11,.54,0],[.04,.52,0]],.034,hookMat);
    // A separate yarn ball with curved strands.
    yarnOrbit=new THREE.Group(); yarnOrbit.name='yarn_ball_rig'; yarnOrbit.position.set(-.85,-.92,.15); root.add(yarnOrbit);
    sphere(yarnOrbit,'yarn_ball',[0,0,0],[.38,.38,.34],yarnMat,28);
    for(let i=0;i<7;i++){
      const a=i*Math.PI/7;
      tube(yarnOrbit,'yarn_strand_'+i,[[-.29*Math.cos(a),-.22,.23],[-.16*Math.cos(a+.4),0,.31],[.22*Math.cos(a),.22,.22]],.018,i%2?hairLight:hairDark);
    }
    // A soft floor shadow anchors the character in space.
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.1,40),new THREE.MeshBasicMaterial({color:'#100b25',transparent:true,opacity:.18,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2; shadow.scale.set(1,.35,1); shadow.position.set(0,-1.65,-.3); root.add(shadow);

    function resize(){
      const rect=avatar.getBoundingClientRect(), w=Math.max(1,rect.width), h=Math.max(1,rect.height);
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    }
    observer=new ResizeObserver(resize); observer.observe(avatar); resize();

    function animate(){
      frameId=requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      if(!reducedMotion){
        root.position.y=Math.sin(t*1.35)*.045;
        root.rotation.y+=(targetX-root.rotation.y)*.035;
        root.rotation.x+=(targetY-root.rotation.x)*.035;
        root.scale.setScalar(emotion==='excited'?1+Math.max(0,Math.sin(t*5))*.025:1);
        arms.forEach(a=>{a.pivot.rotation.z=Math.sin(t*1.5+a.side)*.035});
        hookGroup.rotation.z=-.48+Math.sin(t*1.8)*.035;
        yarnOrbit.rotation.y=Math.sin(t*.8)*.18;
        // Natural blink cycle: close both eyes briefly, then reopen.
        const blink=Math.pow(Math.max(0,Math.sin(t*.72+1.3)),34);
        eyes.forEach(e=>{e.group.scale.y=Math.max(.08,1-blink*.94);e.lid.position.y=.20-blink*.16;e.lid.scale.y=.005+blink*.20});
        if(emotion==='surprised'){eyes.forEach(e=>e.group.scale.y=Math.max(.08,1-blink*.94)*1.08)}
      }
      renderer.render(scene,camera);
    }
    animate();
    avatar.addEventListener('pointermove',e=>{
      const r=avatar.getBoundingClientRect();
      targetX=Math.max(-.22,Math.min(.22,((e.clientX-r.left)/r.width-.5)*.4));
      targetY=Math.max(-.14,Math.min(.14,-((e.clientY-r.top)/r.height-.5)*.22));
    });
    avatar.addEventListener('pointerleave',()=>{targetX=0;targetY=0});
    avatar.addEventListener('click',()=>{if(emotion==='happy')setEmotion('curious');else setEmotion('happy')});
  } catch(error) {
    console.error('PuntIA 3D no disponible:',error);
    canvas.remove();
    avatar.querySelector('.reference-mascot')?.style.setProperty('opacity','1','important');
    avatar.querySelectorAll('.hair,.face,.eye,.mouth,.bow,.body,.hook,.yarn').forEach(el=>el.style.setProperty('opacity','1','important'));
  }

  function setEmotion(next){
    emotion=['happy','curious','focused','excited','concerned','surprised','thinking','talking'].includes(next)?next:'happy';
    avatar.dataset.emotion=emotion;
    const labels={happy:'😊 Alegre',curious:'👀 Curiosa',focused:'🧶 Concentrada',excited:'✨ Emocionada',concerned:'💗 Te acompaño',surprised:'😮 Sorprendida',thinking:'💭 Pensando',talking:'💬 Hablando'};
    let badge=$('#puntiaEmotionBadge');
    if(!badge){badge=document.createElement('span');badge.id='puntiaEmotionBadge';badge.className='puntia-emotion';$('.speech')?.appendChild(badge)}
    badge.textContent=labels[emotion];
    const browPositions={happy:[1.54,1.59,1.54],curious:[1.55,1.65,1.55],focused:[1.58,1.53,1.58],excited:[1.56,1.66,1.56],concerned:[1.59,1.52,1.59],surprised:[1.62,1.68,1.62],thinking:[1.58,1.62,1.55],talking:[1.54,1.59,1.54]};
    brows.forEach((b,i)=>{
      const side=i===0?-1:1, ys=browPositions[emotion]||browPositions.happy;
      const pts=emotion==='concerned'?(side<0?[[ -.42,1.58,.59],[-.29,1.52,.62],[-.16,1.57,.59]]:[[.16,1.57,.59],[.29,1.52,.62],[.42,1.58,.59]]):
        emotion==='focused'?(side<0?[[-.42,1.61,.59],[-.29,1.55,.62],[-.16,1.56,.59]]:[[.16,1.56,.59],[.29,1.55,.62],[.42,1.61,.59]]):
        (side<0?[[-.42,ys[0],.59],[-.29,ys[1],.62],[-.16,ys[2],.59]]:[[.16,ys[2],.59],[.29,ys[1],.62],[.42,ys[0],.59]]);
      b.geometry.dispose();b.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),20,.027,8,false);
    });
    if(mouth && root){
      root.remove(mouth);mouth.geometry.dispose();mouth.material.dispose();
      const shapes={
        happy:[[-.13,.78,.625],[-.065,.735,.65],[0,.73,.66],[.065,.735,.65],[.13,.78,.625]],
        excited:[[-.14,.79,.625],[-.1,.68,.65],[0,.65,.67],[.1,.68,.65],[.14,.79,.625]],
        curious:[[-.10,.76,.63],[-.04,.735,.65],[.04,.74,.65],[.10,.77,.63]],
        focused:[[-.10,.75,.63],[-.03,.745,.65],[.04,.745,.65],[.10,.75,.63]],
        concerned:[[-.13,.72,.625],[-.06,.77,.65],[0,.79,.66],[.06,.77,.65],[.13,.72,.625]],
        surprised:[[-.06,.77,.64],[-.07,.72,.65],[0,.70,.67],[.07,.72,.65],[.06,.77,.64]],
        thinking:[[-.10,.75,.63],[-.02,.74,.65],[.07,.76,.64]],
        talking:[[-.12,.77,.63],[-.09,.70,.65],[0,.68,.67],[.09,.70,.65],[.12,.77,.63]]
      };
      const points=shapes[emotion]||shapes.happy;
      mouth=tube(root,'mouth',points,emotion==='talking'||emotion==='surprised'?.035:.022,material('#a84868'));
      if(emotion==='surprised'||emotion==='talking') mouth.scale.y=1.15;
    }
  }
  window.PuntIAAvatar={setEmotion,getEmotion:()=>emotion};

  function getUserId(){
    let id=localStorage.getItem('puntia_user_id');
    if(!id){id='u-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));localStorage.setItem('puntia_user_id',id)}
    return id;
  }
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input.url; let options=init;
    if(url.includes('/api/puntia/chat')&&init.body){try{const body=JSON.parse(init.body);body.userId=body.userId||getUserId();options={...init,body:JSON.stringify(body)}}catch{}}
    const response=await originalFetch(input,options);
    try{if(url.includes('/api/puntia/chat')&&response.ok){const data=await response.clone().json();if(data.emotion)setEmotion(data.emotion);if(data.memorySaved)showToast('Memoria actualizada')}}catch{}
    return response;
  };
  function showToast(message){const toast=$('#toast');if(!toast)return;toast.textContent=message;toast.style.display='block';clearTimeout(window.__puntiaMemoryToast);window.__puntiaMemoryToast=setTimeout(()=>toast.style.display='none',2200)}
  const nav=$('#desktopNav')||$('.sidebar');
  if(nav&&!$('#puntiaMemoryButton')){
    const button=document.createElement('button');button.id='puntiaMemoryButton';button.className='puntia-memory-button';button.textContent='🧠 Memoria de PuntIA';nav.appendChild(button);
    const panel=document.createElement('section');panel.id='puntiaMemoryPanel';panel.className='puntia-memory-panel';panel.hidden=true;
    panel.innerHTML='<h4>Lo que PuntIA recuerda</h4><p id="puntiaMemoryStatus">Memoria guardada en el servidor de la aplicación.</p><div id="puntiaMemoryItems"></div><button type="button" id="puntiaSavePreference">Guardar preferencia</button><button type="button" id="puntiaClearMemory">Borrar memoria</button>';nav.appendChild(panel);
    async function refreshMemory(){
      const status=$('#puntiaMemoryStatus'),items=$('#puntiaMemoryItems');status.textContent='Cargando recuerdos…';items.replaceChildren();
      try{const r=await originalFetch('/api/puntia/memory/'+encodeURIComponent(getUserId()));if(!r.ok)throw Error('API');const rows=(await r.json()).items||[];status.textContent=rows.length?'Hay '+rows.length+' recuerdos recientes guardados.':'Todavía no hay recuerdos guardados.';rows.slice(-8).reverse().forEach(row=>{const p=document.createElement('p');p.textContent='• '+row.content;items.appendChild(p)})}
      catch{status.textContent='No se pudo consultar la memoria. Comprueba que el backend esté actualizado.'}
    }
    button.addEventListener('click',async()=>{panel.hidden=!panel.hidden;if(!panel.hidden){await refreshMemory();panel.scrollIntoView({behavior:'smooth',block:'nearest'})}});
    $('#puntiaSavePreference').addEventListener('click',async()=>{
      const value=window.prompt('¿Qué debería recordar PuntIA? Ejemplo: prefiero patrones para principiantes.');
      if(!value||!value.trim())return;
      try{const r=await originalFetch('/api/puntia/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:getUserId(),content:value,category:'preference'})});if(!r.ok)throw Error();await refreshMemory();showToast('Preferencia guardada')}
      catch{showToast('No se pudo guardar la preferencia')}
    });
    $('#puntiaClearMemory').addEventListener('click',async()=>{
      if(!window.confirm('¿Borrar los recuerdos del usuario de demostración? Esta acción no se puede deshacer.'))return;
      try{const r=await originalFetch('/api/puntia/memory/'+encodeURIComponent(getUserId()),{method:'DELETE'});if(!r.ok)throw Error();await refreshMemory();showToast('Memoria borrada')}
      catch{showToast('No se pudo borrar la memoria')}
    });
  }
  setEmotion('happy');
  window.addEventListener('pagehide',()=>{if(frameId)cancelAnimationFrame(frameId);observer?.disconnect();renderer?.dispose()});
})();
