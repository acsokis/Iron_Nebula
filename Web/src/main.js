import './style.css';
import './phone.css';
import './native.css';
import {Renderer} from './renderer.js';
import {NativeHud} from './native-hud.js';
import {Input,icon} from './input.js';
import {AudioEngine} from './audio.js';
import {Network} from './network.js';
import {PhoneBridge,runPhone} from './phone.js';
import {cleanCode,cleanName,validIceServers} from './protocol.js';
import {createWorld,addPlayer,startRun,stepWorld,neutralInput,validSnapshot,migrateSoloSave,buyUpgrade,SHOP,COLORS,SECTORS,WEAPONS,clamp} from './world.js';

const $=selector=>document.querySelector(selector),params=new URLSearchParams(location.search);
const toast=message=>{const element=$('#toast');element.textContent=String(message).slice(0,240);element.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.hidden=true,6500);};
const code=params.get('controller');
if(code){
  const url=new URL(location.href);url.searchParams.delete('controller');history.replaceState(null,'',url);
  runPhone(code).catch(error=>{$('#loading').hidden=true;$('#desktop').hidden=true;$('#phone-mode').hidden=false;$('[data-phone-status]').textContent=error.message;});
}else boot().catch(error=>{$('#loading-label').textContent='Flight computer unavailable';const detail=document.createElement('p');detail.className='muted';detail.textContent=error.message;$('#loading-label').after(detail);console.error(error);});

async function boot(){
  const canvas=$('#game'),manifest=await fetch(new URL('./assets/manifest.json',document.baseURI)).then(r=>{if(!r.ok)throw new Error('Game textures could not be loaded. Serve this game over HTTP(S).');return r.json();});
  const renderer=new Renderer(canvas,manifest),audio=new AudioEngine();
  await renderer.load(progress=>$('#loading-progress').value=progress);
  const nativeHud=new NativeHud($('#native-instruments'),renderer.textures.uiAtlas.image);
  let world=createWorld(),myId=0,mode='solo',overlay='menu',ready=false,difficulty=1,endless=true;const overlayStack=[];
  let focused=0,lastPhase='lobby',inputSent=0,lastUi=0,lastHurt=0,lastSave=0,iceServers;
  let roomJoining=false,previousTime=performance.now(),accumulator=0,previousSnapshot=null;
  let previousSimulation=performance.now();
  let scriptedInput=null;
  let phonePairing=null;
  const visual=new Map();addPlayer(world,0,'YOU');
  const input=new Input(canvas,profile=>{document.body.dataset.profile=profile;$('#input-state').textContent={keyboard:'KEYBOARD / MOUSE',xbox:'XBOX CONTROLLER',dualsense:'DUALSENSE',phone:'PHONE CONTROLLER'}[profile];updateHints();});
  const phone=new PhoneBridge((state,buttons)=>input.setPhone(state,buttons),message=>{
    if(message.includes('disconnected'))input.select(input.padProfile??'keyboard');
    if(message==='Phone controller connected.'){input.select('phone');if(overlay==='phone-pair')closeOverlay();}
    $('#phone-state').textContent=message;toast(message);
  });
  const network=new Network({getWorld:()=>world,onWorld:incoming=>{
    if(previousSnapshot&&incoming.tick<previousSnapshot.tick&&incoming.phase===previousSnapshot.phase)return;
    if(incoming.phase!=='shop'&&world.phase==='shop')ready=false;
    world=incoming;previousSnapshot=incoming;myId=network.myId;
    if(world.phase==='lobby'){ready=false;input.choice=-1;input.revision=0;}
  },onStatus:message=>{toast(message);$('#room-state').textContent=message;},onChange:()=>refreshLobby()});
  const settingsKey='iron-nebula-web-settings-v1',saveKey='iron-nebula-web-solo-v1';
  function updateHints(){for(const placeholder of document.querySelectorAll('[data-hint]'))placeholder.replaceChildren(icon(input.profile,placeholder.dataset.hint));}
  updateHints();document.body.dataset.profile='keyboard';
  function show(panel){
    overlay=panel;focused=0;
    for(const id of ['menu','lobby','join','pause','settings','phone-pair','about'])$(`#${id}`).hidden=id!==panel;
    if(document.activeElement instanceof HTMLElement&&!document.activeElement.getClientRects().length)document.activeElement.blur();
    input.mouse.active=false;input.stopRumble();highlight();
  }
  function closeOverlay(){show(overlayStack.pop()??null);}
  function settings(){if(overlay==='settings'){closeOverlay();return;}overlayStack.push(overlay);show('settings');}
  function controls(){settings();$('.control-reference').scrollIntoView({block:'center'});}
  async function sound(){await audio.unlock().catch(()=>toast('Use the Sound button to enable browser audio.'));}
  function resetSolo(){network.close();mode='solo';myId=0;world=createWorld(crypto.getRandomValues(new Uint32Array(1))[0]||1);addPlayer(world,0,cleanName($('#callsign').value));ready=false;visual.clear();input.choice=-1;input.revision=0;previousSnapshot=null;audio.seen.clear();}
  $('#solo').addEventListener('click',()=>{void sound();resetSolo();startRun(world,difficulty,endless);show(null);});
  $('#continue').addEventListener('click',()=>{try{const saved=migrateSoloSave(JSON.parse(localStorage.getItem(saveKey)));if(!validSnapshot(saved)||saved.players.length!==1||saved.players[0].id!==0||!['shop','playing'].includes(saved.phase))throw new Error('This browser save is not compatible.');resetSolo();world=saved;show(null);void sound();}catch(error){toast(error.message);}});
  try{const saved=migrateSoloSave(JSON.parse(localStorage.getItem(saveKey)));$('#continue').disabled=!validSnapshot(saved)||saved.players.length!==1;}catch{}
  $('#join-open').addEventListener('click',()=>{overlayStack.push(overlay);show('join');$('#join-code').focus();});
  $('#host').addEventListener('click',async()=>{
    if(roomJoining)return;roomJoining=true;void sound();resetSolo();mode='host';show('lobby');$('#room-code').textContent='OPENING…';
    try{const code=await network.hostRoom($('#callsign').value,iceServers);$('#room-code').textContent=code;$('#room-state').textContent='Room open. Invite your wing.';refreshLobby();}
    catch(error){network.close();mode='solo';show('menu');toast(error.message);}finally{roomJoining=false;}
  });
  $('#join-confirm').addEventListener('click',async()=>{
    if(roomJoining)return;roomJoining=true;void sound();resetSolo();mode='guest';show('lobby');$('#room-code').textContent=$('#join-code').value.toUpperCase();
    try{await network.joinRoom($('#join-code').value,$('#callsign').value,iceServers);myId=network.myId;refreshLobby();}
    catch(error){network.close();mode='solo';show('join');toast(error.message);}finally{roomJoining=false;}
  });
  $('#join-code').addEventListener('keydown',event=>{if(event.key==='Enter')$('#join-confirm').click();});
  $('#start-party').addEventListener('click',()=>{if(mode!=='host'||world.players.length<2){toast('Wait for at least one guest.');return;}startRun(world,difficulty,endless);ready=false;show(null);network.broadcast(true);});
  function leave(){network.close();mode='solo';myId=0;ready=false;world=createWorld();addPlayer(world,0,'YOU');overlayStack.length=0;show('menu');$('#hud').hidden=true;$('#ending').hidden=true;$('#shop').hidden=true;input.release();visual.clear();}
  $('#leave-lobby').addEventListener('click',leave);$('#exit-run').addEventListener('click',leave);$('#replay').addEventListener('click',()=>{if(mode==='guest'){toast('Waiting for host to return to the lobby.');return;}
    if(mode==='host'){const seats=world.players.map(p=>({id:p.id,name:p.name}));world=createWorld();for(const seat of seats)addPlayer(world,seat.id,seat.name);show('lobby');network.broadcast(true);}else leave();});
  $('#pause-button').addEventListener('click',()=>{show('pause');});$('#resume').addEventListener('click',()=>show(null));
  $('#settings-toggle').addEventListener('click',settings);$('#pause-settings').addEventListener('click',settings);
  $('#about-toggle').addEventListener('click',()=>{overlayStack.push(overlay);show('about');});
  $('#about-settings').addEventListener('click',()=>{overlayStack.push(overlay);show('about');});
  $('#tethered').addEventListener('change',event=>{input.tethered=event.target.checked;input.mouse.active=false;saveSettings();});
  $('#flight-mode').addEventListener('change',event=>{endless=event.target.value==='orbit';saveSettings();});
  document.addEventListener('pointerdown',()=>{void sound();},{once:true});
  document.addEventListener('click',event=>{if(event.target.closest('button,summary')){void sound().then(()=>audio.ui('confirm'));}});
  document.addEventListener('pointerover',event=>{if(event.target.closest('button'))audio.ui('navigate');});
  document.addEventListener('change',event=>{if(event.target.matches('select,input[type=checkbox]'))audio.ui('confirm');});
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',closeOverlay));
  $('#fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else $('#viewport').requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));});
  $('#sound-toggle').addEventListener('click',()=>{audio.enabled=!audio.enabled;if(audio.enabled)void sound();$('#sound-toggle').setAttribute('aria-pressed',String(audio.enabled));});
  $('#copy-room').addEventListener('click',()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',network.code);
    navigator.clipboard?.writeText(url.href).then(()=>toast('Invite link copied.')).catch(()=>toast(`Room code: ${network.code}`));});
  $('#ready').addEventListener('click',()=>{ready=!ready;});
  $('#phone-toggle').addEventListener('click',async()=>{overlayStack.push(overlay);show('phone-pair');$('#phone-state').textContent='Opening a private pairing session…';
    try{const pairing=phone.peer&&phone.code&&phonePairing?phonePairing:await phone.pair(iceServers);phonePairing=pairing;$('#phone-qr').src=pairing.qr;$('#phone-code').textContent=pairing.code;$('#phone-state').textContent=phone.connection?.open?'Phone connected. Back returns to flight.':'Scan with your phone camera, then open the link.';}
    catch(error){$('#phone-state').textContent=error.message;}});
  $('#unpair').addEventListener('click',()=>{phone.close();phonePairing=null;input.select(input.padProfile??'keyboard');$('#phone-state').textContent='Unpaired. Old QR code no longer works.';$('#phone-qr').removeAttribute('src');$('#phone-code').textContent='';});
  $('#apply-ice').addEventListener('click',()=>{try{iceServers=validIceServers(JSON.parse($('#ice-config').value));toast('ICE settings applied for the next connection. They are not saved.');}catch(error){toast(error.message);}});
  const saveSettings=()=>{try{localStorage.setItem(settingsKey,JSON.stringify({lighting:renderer.settings.lighting,gi:renderer.settings.gi,shadows:renderer.settings.shadows,hdr:renderer.settings.hdr,bloom:renderer.settings.bloom,fog:renderer.settings.fog,quality:renderer.settings.quality,fxBudget:renderer.settings.fxBudget,profile:renderer.settings.profile,sfx:audio.sfx,music:audio.music,musicSource:audio.musicSource,tethered:input.tethered,endless,vibration:$('#vibration').checked,difficulty}));}catch{}};
  const customGraphics=()=>{renderer.settings.profile='custom';$('#effects-profile').value='custom';};
  function syncGraphics(){for(const key of ['lighting','gi','shadows'])$(`#${key}`).checked=renderer.settings[key];for(const key of ['quality','bloom','fog'])$(`#${key}`).value=String(renderer.settings[key]);$('#effects-profile').value=renderer.settings.profile;}
  $('#effects-profile').addEventListener('change',event=>{renderer.preset(event.target.value);if(event.target.value==='custom')customGraphics();syncGraphics();saveSettings();});
  $('#music-source').addEventListener('change',event=>{audio.setMusicSource(event.target.value);saveSettings();});
  for(const key of ['lighting','gi','shadows'])$(`#${key}`).addEventListener('change',event=>{renderer.settings[key]=event.target.checked;customGraphics();saveSettings();});
  for(const key of ['bloom','fog'])$(`#${key}`).addEventListener('input',event=>{renderer.settings[key]=Number(event.target.value);customGraphics();saveSettings();});
  $('#quality').addEventListener('change',event=>{renderer.settings.quality=Number(event.target.value);renderer.resize();customGraphics();saveSettings();});
  $('#hdr-lighting').disabled=!renderer.hdr;$('#hdr-lighting').checked=renderer.hdr;
  $('#hdr-lighting').addEventListener('change',event=>{renderer.setHdrLighting(event.target.checked);$('#hdr-display').checked=false;saveSettings();});
  const hdrPossible=!!navigator.gpu&&matchMedia('(dynamic-range: high)').matches&&renderer.hdr;
  $('#hdr-display').disabled=!hdrPossible;$('#hdr-note').textContent=hdrPossible?'Native HDR can be enabled experimentally. It uses an extra presentation pass and may reduce performance.':'Native HDR display output is unavailable here. HDR lighting still works when floating-point rendering is supported.';
  $('#hdr-display').addEventListener('change',async event=>{event.target.disabled=true;try{await renderer.setHdrDisplay(event.target.checked);$('#hdr-lighting').checked=renderer.settings.hdr;$('#hdr-note').textContent=renderer.presenter.reason;}
    catch(error){event.target.checked=false;toast(error.message);}finally{event.target.disabled=!hdrPossible;}});
  $('#sfx-volume').addEventListener('input',event=>{audio.sfx=Number(event.target.value);saveSettings();});$('#music-volume').addEventListener('input',event=>{audio.music=Number(event.target.value);saveSettings();});
  $('#difficulty').addEventListener('change',event=>{difficulty=Number(event.target.value);saveSettings();});$('#vibration').addEventListener('change',saveSettings);
  try{const saved=JSON.parse(localStorage.getItem(settingsKey));if(saved&&typeof saved==='object'){
    renderer.settings.profile=['performance','balanced','high','custom'].includes(saved.profile)?saved.profile:'custom';
    if([24,48,100].includes(saved.fxBudget))renderer.settings.fxBudget=saved.fxBudget;
    if(typeof saved.tethered==='boolean')input.tethered=saved.tethered;$('#tethered').checked=input.tethered;
    if(typeof saved.endless==='boolean')endless=saved.endless;$('#flight-mode').value=endless?'orbit':'campaign';
    audio.setMusicSource(saved.musicSource==='chip'?'chip':'desktop');$('#music-source').value=audio.musicSource;
    for(const key of ['lighting','gi','shadows'])if(typeof saved[key]==='boolean'){renderer.settings[key]=saved[key];$(`#${key}`).checked=saved[key];}
    for(const key of ['bloom','fog'])if(Number.isFinite(saved[key])){renderer.settings[key]=clamp(saved[key],0,key==='bloom'?1.5:1);$(`#${key}`).value=renderer.settings[key];}
    if([1,.75,.5].includes(saved.quality)){renderer.settings.quality=saved.quality;$('#quality').value=saved.quality;renderer.resize();}
    renderer.setHdrLighting(typeof saved.hdr==='boolean'?saved.hdr:renderer.hdr);$('#hdr-lighting').checked=renderer.settings.hdr;
    if(Number.isFinite(saved.music)){audio.music=clamp(saved.music,0,1);$('#music-volume').value=audio.music;}if(Number.isFinite(saved.sfx)){audio.sfx=clamp(saved.sfx,0,1);$('#sfx-volume').value=audio.sfx;}
    if(typeof saved.vibration==='boolean')$('#vibration').checked=saved.vibration;if([0,1,2].includes(saved.difficulty)){difficulty=saved.difficulty;$('#difficulty').value=difficulty;}
  }}catch{}
  syncGraphics();
  function resizeWorld(){renderer.resize();const v=renderer.viewport;$('#native-instruments').style.transform=`translate(${v.x}px,${v.y}px) scale(${v.width/1920})`;}
  const resize=new ResizeObserver(resizeWorld);resize.observe($('#viewport'));resizeWorld();
  function refreshLobby(){
    $('#room-code').textContent=network.code||'CONNECTING…';$('#start-party').hidden=mode!=='host';$('#start-party').disabled=world.players.length<2;
    const holder=$('#seats');holder.replaceChildren();
    for(let id=0;id<6;id++){const pilot=world.players.find(p=>p.id===id),row=document.createElement('div');row.className='seat'+(pilot?'':' empty');
      const name=document.createElement('span'),dot=document.createElement('i');dot.className='pilot-dot';dot.style.background=pilot?COLORS[id]:'#34445a';name.append(dot,document.createTextNode(pilot?`P${id+1} · ${pilot.name}`:`P${id+1} · waiting for pilot`));
      const role=document.createElement('small');role.textContent=pilot?(id===0?'HOST':id===myId?'YOU':'CONNECTED'):'OPEN SEAT';row.append(name,role);holder.append(row);}
  }
  function renderShop(){
    $('#shop-credits').textContent=`${world.credits} CR`;$('#shop-note').textContent=mode==='guest'?'Your host makes purchases. Toggle Ready when you are set.':'Purchases use team credits. Everyone must be ready to continue.';
    const list=$('#shop-items');list.replaceChildren();for(const item of SHOP){const button=document.createElement('button');button.className='shop-item';
      const title=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),price=document.createElement('b');strong.textContent=item.title;small.textContent=item.detail;title.append(strong,small);price.textContent=`${item.price} CR`;button.append(title,price);
      button.disabled=mode==='guest'||world.credits<item.price||item.weapon!==undefined&&!!(world.unlocked&(1<<item.weapon))||item.weapon===undefined&&world.upgrades[item.id]>=3;
      button.addEventListener('click',()=>{if(buyUpgrade(world,item.id)){void sound();audio.tone(780,.1,'triangle',.08,1100);renderShop();network.broadcast(true);}else toast('Upgrade unavailable or already at maximum.');});list.append(button);}
  }
  function updateUi(){
    nativeHud.draw(world,myId);
    $('#hud').hidden=!['playing','shop'].includes(world.phase);
    $('#connection-state').textContent=mode==='solo'?'LOCAL FLIGHT':mode==='host'?`HOST · ${world.players.length}/6 PILOTS`:`P2P · P${myId+1}`;
    if(world.phase!==lastPhase){
      if(mode==='solo'&&['gameover','victory'].includes(world.phase)){try{localStorage.removeItem(saveKey);}catch{}$('#continue').disabled=true;}
      if(world.phase==='playing'){show(null);$('#shop').hidden=true;$('#ending').hidden=true;ready=false;}
      if(world.phase==='shop'){show(null);$('#shop').hidden=false;renderShop();ready=false;}
      if(['gameover','victory'].includes(world.phase)){show(null);$('#shop').hidden=true;$('#ending').hidden=false;$('#ending-label').textContent=world.phase==='victory'?'CAMPAIGN SECURED':'SIGNAL LOST';$('#ending-title').textContent=world.phase==='victory'?'You lit up the void.':'One more flight?';$('#ending-score').textContent=`${world.score.toLocaleString()} points · ${world.kills} targets`;$('#replay').disabled=mode==='guest';}
      if(world.phase==='lobby'&&mode!=='solo'){show('lobby');$('#shop').hidden=true;$('#ending').hidden=true;}
      lastPhase=world.phase;
    }
    const sector=SECTORS[world.sector-1];$('#sector-number').textContent=`0${world.sector}`;$('#sector-name').textContent=sector.name;$('#score').textContent=String(world.score).padStart(7,'0');$('#credits').textContent=`CR ${String(world.credits).padStart(5,'0')}`;
    document.body.dataset.party=String(world.players.length);$('#native-wave').textContent=`${world.endless?`ORBIT ${(world.orbit??0)+1} · `:''}WAVE ${String(world.wave).padStart(2,'0')}`;
    const own=world.players.find(p=>p.id===myId);if(own){$('#weapon-name').textContent=WEAPONS[own.weapon].name;$('#weapon-level').textContent=`LEVEL ${own.level} / 7`;
      $('#native-lives').textContent=String(own.lives).padStart(2,'0');$('#native-hull').textContent=`HP ${own.health}/${own.maxHealth}`;$('#native-shield').max=own.maxShield;$('#native-shield').value=own.shield;
      if(own.hurt>lastHurt&&$('#vibration').checked)input.rumble();lastHurt=own.hurt;}
    const boss=world.enemies.find(e=>e.kind==='boss');$('#boss-hud').hidden=!boss;if(boss){$('#boss-name').textContent=boss.name;$('#boss-health').value=boss.health/boss.maxHealth;}
    const party=$('#party-hud');party.replaceChildren();for(const p of world.players){const panel=document.createElement('div');panel.className='pilot-hud';panel.style.setProperty('--pilot',COLORS[p.id]);
      const name=document.createElement('b'),bar=document.createElement('progress'),stats=document.createElement('span');name.className='pilot-name';name.textContent=`P${p.id+1} ${p.id===myId?'YOU':p.name}`;bar.max=p.maxHealth;bar.value=p.health;stats.textContent=p.lives>0?`HULL ${p.health}/${p.maxHealth} · ♥ ${p.lives} · ◇ ${p.shield}`:'SPECTATING';panel.append(name,bar,stats);party.append(panel);}
    if(world.phase==='shop'){const row=$('#ready-list');row.replaceChildren();for(const p of world.players){const tag=document.createElement('span');tag.className='ready-pilot'+((p.id===myId?ready:p.ready)?' ready':'');tag.textContent=`P${p.id+1} ${(p.id===myId?ready:p.ready)?'READY':'WAITING'}`;row.append(tag);}$('#ready-text').textContent=ready?'Ready — waiting for the wing':world.sector===3?(world.endless?'Ready for next orbit':'Ready to finish campaign'):'Ready for next sector';}
    if(overlay==='lobby')refreshLobby();
    $('#pause-note').textContent=mode==='solo'?'Your solo flight is paused.':'Only your input is paused. The wing keeps flying.';
    $('#fx-state').textContent=[renderer.settings.hdr?'HDR LIGHTS':'SDR',renderer.settings.gi?'GI':null,renderer.settings.lighting?'LIGHTING':null].filter(Boolean).join(' · ');
  }
  function visibleControls(){const root=overlay?$(`#${overlay}`):world.phase==='shop'?$('#shop'):['gameover','victory'].includes(world.phase)?$('#ending'):null;
    return root?[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea')].filter(e=>e.getClientRects().length):[];}
  function highlight(){document.querySelectorAll('.focused-control').forEach(e=>e.classList.remove('focused-control'));const items=visibleControls();if(items.length){focused=(focused+items.length)%items.length;items[focused].classList.add('focused-control');}}
  function action(name){
    if(['up','down','confirm','back'].includes(name)){void sound().then(()=>audio.ui(name==='confirm'?'confirm':'navigate'));}
    if(name==='settings'){settings();return;}if(name==='help'){controls();return;}
    if(name==='pause'){if(world.phase==='shop'){ready=!ready;return;}if(overlay==='pause')show(null);else if(world.phase==='playing')show('pause');return;}
    if(name==='back'){if(['settings','phone-pair','join','about'].includes(overlay))closeOverlay();else if(overlay==='pause')show(null);else if(overlay==='lobby')leave();else if(world.phase==='playing')show('pause');return;}
    if(name==='ready'&&world.phase==='shop'){ready=!ready;return;}
    if(!overlay&&world.phase==='playing'&&['next','previous'].includes(name)){input.weapon(world,myId,name==='next'?1:-1);return;}
    if(!overlay&&world.phase==='playing'&&name.startsWith('weapon')){input.weapon(world,myId,0,Number(name.at(-1)));return;}
    const controls=visibleControls();if(!controls.length)return;
    if(['up','down'].includes(name)){focused=(focused+(name==='down'?1:-1)+controls.length)%controls.length;highlight();controls[focused].scrollIntoView({block:'nearest'});}
    else if(['left','right'].includes(name)){const control=controls[focused];if(control?.type==='range'){name==='right'?control.stepUp():control.stepDown();control.dispatchEvent(new Event('input'));}else if(control?.tagName==='SELECT'){control.selectedIndex=clamp(control.selectedIndex+(name==='right'?1:-1),0,control.options.length-1);control.dispatchEvent(new Event('change'));}}
    else if(name==='confirm'){const control=controls[focused];if(control?.type==='checkbox')control.click();else if(control?.tagName==='BUTTON')control.click();else control?.focus();}
  }
  if(params.get('room')){$('#join-code').value=cleanCode(params.get('room'))??'';overlayStack.push('menu');show('join');}
  $('#loading').hidden=true;updateUi();
  const qa=import.meta.env.DEV&&params.get('test')==='1';
  if(qa)window.__IRON_NEBULA__={state:()=>structuredClone(world),network:()=>network.diagnostics(),renderer:()=>renderer.diagnostics(),profile:()=>input.profile,
    drive:value=>{scriptedInput=value;},audio:()=>({state:audio.context?.state??'locked',enabled:audio.enabled,sfx:audio.sfx,music:audio.music,source:audio.musicSource,desktopPlaying:!!audio.desktop&&!audio.desktop.paused,desktopTime:audio.desktop?.currentTime??0,desktopFailed:!!audio.desktopFailed}),
    phone:()=>({paired:!!phone.connection?.open,code:phone.code,input:structuredClone(input.phone.input)}),
    control:()=>({tethered:input.tethered,input:input.read(world,myId,false,ready),dragPointer:input.dragPointer,padButtons:[...input.oldPadButtons]}),
    scenario:options=>{if(mode==='guest')throw new Error('Host authority only');if(options.phase)world.phase=options.phase;if(options.credits!==undefined)world.credits=options.credits;
      if(options.unlocked)world.unlocked=options.unlocked;if(options.sectorTime!==undefined)world.sectorTime=options.sectorTime;if(options.bossStage!==undefined)world.bossStage=options.bossStage;
      if(options.enemies!==undefined)world.enemies=structuredClone(options.enemies);if(options.shots!==undefined)world.shots=structuredClone(options.shots);if(options.fx!==undefined)world.fx=structuredClone(options.fx);if(options.pickups!==undefined)world.pickups=structuredClone(options.pickups);if(options.orbit!==undefined)world.orbit=options.orbit;if(options.sector!==undefined)world.sector=options.sector;if(options.level)world.players.forEach(p=>{p.level=options.level;p.health=p.maxHealth=100;p.invuln=1000;});network.broadcast(true);},
    renderFrame:()=>renderer.render(world,myId),version:'dev-only'};
  function simulationTick(){
    const now=performance.now(),dt=Math.min(.1,(now-previousSimulation)/1000);previousSimulation=now;phone.tick();
    const menuActive=!!overlay||world.phase==='shop'||['gameover','victory'].includes(world.phase);
    for(const name of input.poll(menuActive))action(name);
    const blocked=document.hidden||!input.active||!!overlay||document.activeElement?.tagName==='INPUT'||document.activeElement?.tagName==='TEXTAREA';
    let local=input.read(world,myId,blocked,ready);
    if(qa&&scriptedInput)local={...neutralInput(local.seq),...scriptedInput,seq:local.seq,ready:scriptedInput.ready??ready};
    if(mode==='guest'){
      if(now-inputSent>33){network.input(local);inputSent=now;}
      if(network.server&&!network.server.open&&network.myId>=1&&now-network.lastStateAt>1000){toast('Host disconnected. Returning to command.');leave();}
    }else if(!(mode==='solo'&&overlay&&world.phase==='playing')){
      accumulator+=dt;let count=0;while(accumulator>=1/60&&count++<6){stepWorld(world,mode==='host'?network.collect(local):{0:local},1/60);accumulator-=1/60;}
      if(mode==='host')network.broadcast();
    }
    if(mode==='solo'&&['playing','shop'].includes(world.phase)&&now-lastSave>5000){lastSave=now;try{localStorage.setItem(saveKey,JSON.stringify(world));$('#continue').disabled=false;}catch{}}
  }
  const simulationTimer=setInterval(simulationTick,16);
  function loop(now){
    const dt=Math.min(.05,(now-previousTime)/1000);previousTime=now;
    let display=world;
    if(mode==='guest'&&world.phase==='playing'){
      display={...world,players:world.players.map(p=>{const old=visual.get(p.id),speed=1-Math.exp(-dt*(p.id===myId?18:12));const pos={x:old?old.x+(p.x-old.x)*speed:p.x,y:old?old.y+(p.y-old.y)*speed:p.y};visual.set(p.id,pos);return {...p,...pos};})};
    }
    if(!(qa&&params.get('render')==='off'))renderer.render(display,myId);
    audio.update(world,!document.hidden&&input.active);if(now-lastUi>90){updateUi();lastUi=now;}requestAnimationFrame(loop);
  }
  window.addEventListener('pagehide',()=>{clearInterval(simulationTimer);network.close();phone.close();input.release();});
  requestAnimationFrame(loop);
}
