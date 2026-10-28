// Minijuego de tiro: se abre solo tocando el 🏀 del título (index.html carga este archivo bajo demanda).
// Mantén pulsado: la flecha gira; suelta: tiro en parábola. 30 s (+1 s por canasta). Canasta = 3 puntos + 1 por cada canasta
// seguida; tapón = -1. El defensor (con la cara de Wemby) salta sin parar y cada canasta acorta su salto 0,1 s.
(function(){
'use strict';

/* ---------- récords ----------
   Se guardan en un "almacén": por defecto el navegador (cada móvil los suyos).
   Para compartirlos entre los 4 hay que poner aquí un almacén remoto (ver README, "Minijuego"). */
// Firebase Realtime Database (REST, sin librerías). Pon aquí la URL de la base de datos, p. ej.
// 'https://apuesta-nba-default-rtdb.europe-west1.firebasedatabase.app'. Vacío = solo en este móvil.
const FIREBASE_URL = 'https://app-nba-bf985-default-rtdb.europe-west1.firebasedatabase.app';
const REMOTE = FIREBASE_URL ? {
  get: async()=>{ const r=await fetch(FIREBASE_URL+'/records.json',{cache:'no-store'}); if(!r.ok) throw new Error(r.status); return await r.json(); },
  // cada jugador escribe solo su récord: así dos personas no se pisan
  putOne: async(name,rec)=>{ const r=await fetch(FIREBASE_URL+'/records/'+name+'.json',{method:'PUT',body:JSON.stringify(rec)}); if(!r.ok) throw new Error(r.status); },
} : null;
const LOCAL_KEY = 'nba-juego-records';
const Records = {
  async load(){
    if(REMOTE){ try{ return (await REMOTE.get())||{}; }catch(e){} }
    try{ return JSON.parse(localStorage.getItem(LOCAL_KEY))||{}; }catch(e){ return {}; }
  },
  // guarda solo si mejora el récord de ese jugador; devuelve {recs, best:true/false}
  async submit(name, score){
    const recs=await this.load(), old=recs[name];
    if(old && old.score>=score) return {recs, best:false};
    recs[name]={score, at:new Date().toISOString()};
    if(REMOTE){ try{ await REMOTE.putOne(name, recs[name]); }catch(e){} }
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(recs)); }catch(e){}
    return {recs, best:true};
  },
};

/* ---------- constantes del mundo (unidades lógicas 400 x 600) ---------- */
const W=400, H=600, FLOOR=580, G=1400, V0=920, R=11;
const START={x:70,y:470};
const HOOP={x:320,y:250,half:21};            // aro: dos puntos de choque a ±half (más pequeño = más difícil)
const BOARD={x:HOOP.x+HOOP.half+12, top:HOOP.y-80, bot:HOOP.y+15};
const DEF={x:210, w:34, amp:200};            // defensor: x fija, salto de 200
const ANG_MIN=20, ANG_MAX=82, SWEEP=1.4;     // la flecha va de 20° a 82° y vuelve en 2 × 1,4 s
const TIME=30, BONUS=1, P0=2.0, PSTEP=0.1, PMIN=0.6;   // BONUS: segundos extra por canasta

const NAMES=['Ghali','Telmo','Manu','Adrian'];
const COLORS={Ghali:'#f59e0b',Telmo:'#38bdf8',Manu:'#e879f9',Adrian:'#4ade80'};
const img=src=>{const i=new Image(); i.src=src; return i;};
const FACES=Object.fromEntries(NAMES.map(n=>[n,img('img/people/'+n+'.jpg')]));
const WEMBY=img('img/awards/wembanyama.png');

let root, cv, cx, scale=1, raf=0, me=null, st=null;

/* ---------- interfaz ---------- */
const css=`
#jg{position:fixed;inset:0;z-index:50;background:rgba(10,12,18,.96);color:#fff;display:flex;flex-direction:column;align-items:center;
  padding:calc(env(safe-area-inset-top,0px) + 54px) 12px calc(env(safe-area-inset-bottom,0px) + 10px);font:15px/1.4 system-ui,sans-serif;overflow:auto;touch-action:manipulation}
#jg .x{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 8px);background:#222838;color:#fff;border:0;border-radius:999px;width:38px;height:38px;font-size:20px;cursor:pointer}
#jg h2{margin:6px 0 4px;font-size:22px}
#jg .s{color:#9aa3b8;font-size:13px;text-align:center;max-width:420px;margin:0 0 10px}
#jg .pick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:min(420px,100%);margin:8px 0 14px}
#jg .pick button{background:#1b2030;border:2px solid #2d3448;border-radius:14px;padding:10px 4px;color:#fff;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px}
#jg .pick button:hover{border-color:#f59e0b}
#jg .pick img{width:58px;height:58px;border-radius:50%;object-fit:cover;object-position:50% 15%}
#jg .board{width:min(420px,100%);background:#161a26;border-radius:14px;padding:10px 14px}
#jg .board h3{margin:0 0 6px;font-size:14px;color:#fcd34d}
#jg .row{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid #262c3d}
#jg .row:first-of-type{border-top:0}
#jg .row img{width:32px;height:32px;border-radius:50%;object-fit:cover;object-position:50% 15%}
#jg .row b{flex:1}#jg .row span{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
#jg .row small{color:#9aa3b8;font-size:11px;display:block;font-weight:400}
#jg .row.lead span{color:#fcd34d}
#jg canvas{display:block;border-radius:14px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#jg .btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:14px 0}
#jg .btns button{background:#f59e0b;color:#111;border:0;border-radius:999px;padding:10px 18px;font:700 15px system-ui;cursor:pointer}
#jg .btns button.g{background:#222838;color:#fff}
#jg .big{font-size:56px;font-weight:900;color:#fcd34d;line-height:1}
#jg .note{margin-top:8px;font-size:12px;color:#9aa3b8;text-align:center;max-width:420px}`;

function el(html){ const d=document.createElement('div'); d.innerHTML=html; return d.firstElementChild; }

async function boardHTML(title, hl){
  const recs=await Records.load();
  const rows=NAMES.map(n=>({n,r:recs[n]})).sort((a,b)=>(b.r?b.r.score:-1e9)-(a.r?a.r.score:-1e9));
  const top=rows[0]&&rows[0].r?rows[0].n:null;
  return `<div class="board"><h3>${title}</h3>${rows.map(({n,r})=>`<div class="row ${n===top?'lead':''}"><img src="img/people/${n}.jpg" alt="">
    <b>${n===top?'👑 ':''}${n}${n===hl?' (tú)':''}<small>${r?'récord del '+new Date(r.at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'sin partidas'}</small></b><span>${r?r.score:'–'}</span></div>`).join('')}</div>
    ${REMOTE?'':'<p class="note">De momento los récords se guardan solo en este móvil.</p>'}`;
}

async function screenPick(){
  stopLoop();
  root.innerHTML=`<button class="x" data-x aria-label="Cerrar">✕</button><h2>🏀 Tiro con tapón</h2>
    <p class="s">Mantén pulsado: la flecha gira. Suelta para tirar. 30 segundos, +1 s por canasta. Canasta: 3 puntos, +1 por cada canasta seguida. Tapón de Wemby: −1. Cada canasta le hace saltar más rápido.</p>
    <p class="s"><b>¿Quién eres?</b></p>
    <div class="pick">${NAMES.map(n=>`<button data-me="${n}"><img src="img/people/${n}.jpg" alt="">${n}</button>`).join('')}</div>
    ${await boardHTML('Quién va ganando')}`;
}

async function screenEnd(){
  stopLoop();
  const {recs,best}=await Records.submit(me, st.score);
  const prev=recs[me];
  root.innerHTML=`<button class="x" data-x aria-label="Cerrar">✕</button><h2>¡Tiempo!</h2>
    <p class="s">${me}, has hecho</p><div class="big">${st.score}</div>
    <p class="s" style="margin-top:8px">${st.makes} canastas · ${st.shots} tiros · mejor racha ${st.bestStreak} · ${st.blocks} tapones</p>
    <p class="s"><b>${best?'🎉 ¡Nuevo récord personal!':'Tu récord sigue en '+prev.score}</b></p>
    <div class="btns"><button data-again>Jugar otra vez</button><button class="g" data-pickagain>Cambiar de jugador</button><button class="g" data-x>Salir</button></div>
    ${await boardHTML('Quién va ganando', me)}`;
}

/* ---------- partida ---------- */
function newGame(){
  st={score:0, streak:0, bestStreak:0, makes:0, shots:0, blocks:0, period:P0, defT:0, bonus:0,
      t:-3, ball:null, aiming:false, aimT:0, ang:ANG_MIN, fx:[], over:false};
  resetBall();
}
function resetBall(){ st.ball={x:START.x,y:START.y,vx:0,vy:0,state:'ready',scored:false,blocked:false,life:0,wait:0}; }
const endTime=()=>TIME+st.bonus;

function screenPlay(){
  root.innerHTML=`<button class="x" data-x aria-label="Cerrar">✕</button><canvas></canvas>
    <p class="note">Mantén pulsado sobre la pista para apuntar y suelta para tirar.</p>`;
  cv=root.querySelector('canvas'); cx=cv.getContext('2d');
  fit(); newGame();
  cv.addEventListener('pointerdown',down); cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  let last=performance.now();
  const loop=now=>{ const dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); if(!st.over) raf=requestAnimationFrame(loop); };
  raf=requestAnimationFrame(loop);
}
function stopLoop(){ cancelAnimationFrame(raf); raf=0; }
function fit(){
  const dpr=window.devicePixelRatio||1;
  scale=Math.min((window.innerWidth-24)/W, (window.innerHeight-130)/H, 1.4);
  cv.style.width=W*scale+'px'; cv.style.height=H*scale+'px';
  cv.width=Math.round(W*scale*dpr); cv.height=Math.round(H*scale*dpr);
  cx.setTransform(scale*dpr,0,0,scale*dpr,0,0);
}
function down(e){ e.preventDefault(); if(st.t<0||st.t>=endTime()||st.ball.state!=='ready') return; st.aiming=true; st.aimT=0; cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); }
function up(e){
  if(!st.aiming) return; st.aiming=false;
  const a=st.ang*Math.PI/180, b=st.ball;
  b.vx=V0*Math.cos(a); b.vy=-V0*Math.sin(a); b.state='flight'; st.shots++;
}
function aimAngle(t){ return ANG_MIN+(ANG_MAX-ANG_MIN)*(0.5-0.5*Math.cos(Math.PI*t/SWEEP)); }
// altura del salto del defensor (0 en el suelo, amp en lo alto); un salto completo (ida y vuelta) dura st.period
const defLift=()=>DEF.amp*Math.abs(Math.sin(Math.PI*st.defT/st.period));
function defHands(){ const top=FLOOR-150-defLift(); return {x0:DEF.x-DEF.w/2-4, x1:DEF.x+DEF.w/2+4, y0:top, y1:top+50}; }

function fx(text,color){ st.fx.push({text,color,t:0}); }

function update(dt){
  st.t+=dt; st.defT+=dt;
  if(st.aiming){ st.aimT+=dt; }
  st.ang=aimAngle(st.aimT);
  st.fx.forEach(f=>f.t+=dt); st.fx=st.fx.filter(f=>f.t<1.2);
  const b=st.ball;
  if(b.state==='flight'||b.state==='done'){
    for(let i=0,n=Math.ceil(dt/(1/240));i<n;i++) step(b, dt/n);
  }
  if(b.state==='done'){ b.life+=dt; if(b.life>b.wait) resetBall(); }   // relanzar en cuanto se sabe el resultado
  if(st.t>=endTime() && b.state!=='flight' && !st.aiming){ st.over=true; setTimeout(screenEnd,600); }
}
function endShot(b,wait){
  if(b.state!=='flight') return;
  b.state='done'; b.life=0; b.wait=wait??0.15;
  if(!b.scored && !b.blocked){ st.streak=0; fx('Fallo','#9aa3b8'); }
}
function step(b,dt){
  const py=b.y;
  b.vy+=G*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
  // aro: dos puntos con rebote
  for(const rx of [HOOP.x-HOOP.half, HOOP.x+HOOP.half]){
    const dx=b.x-rx, dy=b.y-HOOP.y, d=Math.hypot(dx,dy);
    if(d<R+2&&d>0){ const nx=dx/d, ny=dy/d, dot=b.vx*nx+b.vy*ny; if(dot<0){ b.vx-=1.6*dot*nx; b.vy-=1.6*dot*ny; } b.x=rx+nx*(R+2); b.y=HOOP.y+ny*(R+2); }
  }
  // tablero
  if(b.x+R>BOARD.x && b.x<BOARD.x+10 && b.y>BOARD.top && b.y<BOARD.bot && b.vx>0){ b.x=BOARD.x-R; b.vx=-b.vx*0.6; }
  // tapón: el balón toca las manos del defensor
  if(b.state==='flight' && !b.blocked && !b.scored){
    const h=defHands();
    if(b.x+R>h.x0 && b.x-R<h.x1 && b.y+R>h.y0 && b.y-R<h.y1){
      b.blocked=true; b.vx=-Math.abs(b.vx)*0.45; b.vy=Math.abs(b.vy)*0.3+120;
      st.score-=1; st.streak=0; st.blocks++; fx('¡TAPÓN! −1','#ef4444'); endShot(b,0.3);
    }
  }
  // canasta: cruza la línea del aro hacia abajo entre los dos puntos
  if(b.state==='flight' && !b.scored && !b.blocked && py<HOOP.y && b.y>=HOOP.y && b.vy>0 && b.x>HOOP.x-HOOP.half+2 && b.x<HOOP.x+HOOP.half-2){
    b.scored=true; const pts=3+st.streak; st.score+=pts; st.streak++; st.makes++;
    st.bestStreak=Math.max(st.bestStreak,st.streak);
    st.period=Math.max(PMIN, +(st.period-PSTEP).toFixed(2));
    st.bonus+=BONUS;
    fx('+'+pts+(st.streak>1?'  ×'+st.streak+' seguidas':'')+'  +'+BONUS+' s','#4ade80');
    endShot(b,0.2);
  }
  // fallo: el balón ya baja por debajo del aro sin haber entrado
  if(b.state==='flight' && b.vy>0 && b.y>HOOP.y+40) endShot(b);
  if(b.y>FLOOR-R){ b.y=FLOOR-R; b.vy=-b.vy*0.4; b.vx*=0.6; endShot(b); }
  if(b.x>W+30||b.x<-30) endShot(b);
}

/* ---------- dibujo ---------- */
function circleImg(im,x,y,r,border){
  cx.save(); cx.beginPath(); cx.arc(x,y,r,0,7); cx.closePath(); cx.clip();
  if(im.complete&&im.naturalWidth){ const s=Math.max(2*r/im.naturalWidth,2*r/im.naturalHeight)*1.15; const w=im.naturalWidth*s, h=im.naturalHeight*s; cx.drawImage(im,x-w/2,y-r*1.1,w,h); }
  else { cx.fillStyle='#555'; cx.fill(); }
  cx.restore(); if(border){ cx.beginPath(); cx.arc(x,y,r,0,7); cx.lineWidth=3; cx.strokeStyle=border; cx.stroke(); }
}
function drawBall(x,y,rot){
  cx.save(); cx.translate(x,y); cx.rotate(rot||0);
  cx.beginPath(); cx.arc(0,0,R,0,7); cx.fillStyle='#f97316'; cx.fill(); cx.lineWidth=1.3; cx.strokeStyle='#7c2d12'; cx.stroke();
  cx.beginPath(); cx.moveTo(-R,0); cx.lineTo(R,0); cx.moveTo(0,-R); cx.lineTo(0,R); cx.stroke();
  cx.beginPath(); cx.arc(-R*1.2,0,R*0.9,-0.9,0.9); cx.stroke(); cx.beginPath(); cx.arc(R*1.2,0,R*0.9,Math.PI-0.9,Math.PI+0.9); cx.stroke();
  cx.restore();
}
function draw(){
  // fondo
  const g=cx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1e2537'); g.addColorStop(1,'#0f1320'); cx.fillStyle=g; cx.fillRect(0,0,W,H);
  cx.fillStyle='#b7793f'; cx.fillRect(0,FLOOR,W,H-FLOOR); cx.fillStyle='rgba(0,0,0,.18)'; for(let x=0;x<W;x+=28) cx.fillRect(x,FLOOR,1,H-FLOOR);
  // canasta
  cx.fillStyle='#e5e7eb'; cx.fillRect(BOARD.x,BOARD.top,8,BOARD.bot-BOARD.top);
  cx.fillStyle='#9ca3af'; cx.fillRect(BOARD.x+8,BOARD.top+40,40,6); cx.fillRect(BOARD.x+40,BOARD.top+40,6,FLOOR-BOARD.top-40);
  cx.strokeStyle='rgba(255,255,255,.75)'; cx.lineWidth=1;
  for(let i=0;i<=5;i++){ const x0=HOOP.x-HOOP.half+i*HOOP.half*0.4; cx.beginPath(); cx.moveTo(x0,HOOP.y); cx.lineTo(HOOP.x-HOOP.half*0.55+i*HOOP.half*0.22,HOOP.y+34); cx.stroke(); }
  cx.strokeStyle='#ef4444'; cx.lineWidth=4; cx.beginPath(); cx.moveTo(HOOP.x-HOOP.half,HOOP.y); cx.lineTo(BOARD.x,HOOP.y); cx.stroke();
  // defensor
  const lift=defLift(), fy=FLOOR-lift;
  cx.fillStyle='#64748b'; cx.fillRect(DEF.x-9,fy-55,7,55); cx.fillRect(DEF.x+2,fy-55,7,55);          // piernas
  cx.fillStyle='#e5e7eb'; cx.fillRect(DEF.x-DEF.w/2,fy-115,DEF.w,62);                                    // camiseta
  cx.fillStyle='#111'; cx.font='bold 16px system-ui'; cx.textAlign='center'; cx.fillText('1',DEF.x,fy-78);
  cx.fillStyle='#8a5a3c'; cx.fillRect(DEF.x-DEF.w/2-4,fy-150,7,40); cx.fillRect(DEF.x+DEF.w/2-3,fy-150,7,40); // brazos arriba
  circleImg(WEMBY,DEF.x,fy-128,15,'#111');
  // tirador: la cara del jugador elegido
  cx.fillStyle=COLORS[me]; cx.fillRect(START.x-14,FLOOR-80,28,60); cx.fillStyle='#64748b'; cx.fillRect(START.x-12,FLOOR-22,9,22); cx.fillRect(START.x+3,FLOOR-22,9,22);
  circleImg(FACES[me],START.x,FLOOR-98,20,COLORS[me]);
  // flecha
  const b=st.ball;
  if(b.state==='ready' && st.t>=0 && st.t<endTime()){
    const a=st.ang*Math.PI/180, len=st.aiming?70:50, ex=b.x+Math.cos(a)*len, ey=b.y-Math.sin(a)*len;
    cx.strokeStyle=st.aiming?'#fcd34d':'rgba(252,211,77,.4)'; cx.lineWidth=4; cx.beginPath(); cx.moveTo(b.x,b.y); cx.lineTo(ex,ey); cx.stroke();
    cx.beginPath(); cx.moveTo(ex,ey); cx.lineTo(ex-Math.cos(a-0.5)*12,ey+Math.sin(a-0.5)*12); cx.lineTo(ex-Math.cos(a+0.5)*12,ey+Math.sin(a+0.5)*12); cx.closePath(); cx.fillStyle=cx.strokeStyle; cx.fill();
  }
  drawBall(b.x,b.y,(b.x+b.y)/12);
  // marcador
  const left=Math.max(0,endTime()-Math.max(0,st.t));
  cx.fillStyle='rgba(0,0,0,.35)'; cx.fillRect(0,0,W,46);
  cx.textAlign='left'; cx.fillStyle='#fff'; cx.font='bold 22px system-ui'; cx.fillText(st.score+' pts',12,31);
  cx.textAlign='center'; cx.fillStyle=left<6?'#ef4444':'#fcd34d'; cx.fillText(Math.ceil(left)+' s',W/2,31);
  cx.textAlign='right'; cx.fillStyle='#cbd5e1'; cx.font='13px system-ui'; cx.fillText('próxima: +'+(3+st.streak),W-12,22); cx.fillText('salto '+st.period.toFixed(1)+' s',W-12,39);
  // cuenta atrás y avisos
  if(st.t<0){ cx.textAlign='center'; cx.fillStyle='#fcd34d'; cx.font='bold 90px system-ui'; cx.fillText(Math.ceil(-st.t),W/2,H/2-40); }
  st.fx.forEach((f,i)=>{ cx.globalAlpha=Math.max(0,1-f.t/1.2); cx.textAlign='center'; cx.fillStyle=f.color; cx.font='bold 26px system-ui'; cx.fillText(f.text,W/2,120-f.t*30+i*4); cx.globalAlpha=1; });
}

/* ---------- abrir / cerrar ---------- */
function onClick(e){
  const t=e.target;
  if(t.closest('[data-x]')){ close(); return; }
  const m=t.closest('[data-me]'); if(m){ me=m.dataset.me; screenPlay(); return; }
  if(t.closest('[data-again]')){ screenPlay(); return; }
  if(t.closest('[data-pickagain]')){ screenPick(); return; }
}
function onPop(){ if(root && !(history.state&&history.state.juego)) close(true); }
function onResize(){ if(cv&&root&&root.contains(cv)) fit(); }

function open(){
  if(root) return;
  if(!document.getElementById('jg-css')){ const s=document.createElement('style'); s.id='jg-css'; s.textContent=css; document.head.appendChild(s); }
  root=el('<div id="jg"></div>'); document.body.appendChild(root); document.body.style.overflow='hidden';
  root.addEventListener('click',onClick); window.addEventListener('popstate',onPop); window.addEventListener('resize',onResize);
  // entrada propia en el historial: el botón Atrás del móvil cierra el juego
  history.pushState(Object.assign({},history.state||{},{juego:true}),'');
  screenPick();
}
function close(fromPop){
  if(!root) return;
  stopLoop(); root.remove(); root=null; cv=null; document.body.style.overflow='';
  window.removeEventListener('popstate',onPop); window.removeEventListener('resize',onResize);
  if(!fromPop && history.state && history.state.juego) history.back();
}
window.Juego={open, close, Records, _state:()=>st};   // _state: solo para pruebas
})();
