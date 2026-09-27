import { loadRanks, saveRank, localRanks, onlineEnabled } from './leaderboard.js';
import { vineAt, vineEndpoint, swingLaunchVelocity, pointSegmentDistance } from './physics.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = s => document.querySelector(s);
const ui = { score: $('#score'), distance: $('#distance'), combo: $('#combo'), hearts: $('#hearts'), hint: $('#hint'), toast: $('#toast'), overlay: $('#overlay'), title: $('#panelTitle'), text: $('#panelText'), stats: $('#finalStats'), name: $('#playerName'), play: $('#playBtn'), pause: $('#pauseBtn'), sound: $('#soundBtn'), ranking: $('#ranking'), list: $('#rankList'), status: $('#rankStatus'), globalTab: $('#globalTab'), localTab: $('#localTab') };
const TAU = Math.PI * 2, G = 1050, STEP = 1 / 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = v => v - Math.floor(v);
const hash = n => fract(Math.sin(n * 127.1 + 73.7) * 43758.5453);
let w = 1000, h = 700, scale = 1, dpr = 1;
let state = 'menu', last = 0, acc = 0, time = 0, camera = 0, shake = 0;
let score = 0, distance = 0, combo = 1, lives = 1, bananas = 0, swings = 0, bestCombo = 1;
let vines = [], particles = [], pickups = [], lastIndex = 0;
let monkey = { x: 180, y: 430, vx: 0, vy: 0, vine: 0, attached: true, airborne: 0, rotation: 0, trail: [] };
let soundOn = false, audioCtx = null, toastTimer, rankingTab = 'global', submitPending = false;
ui.name.value = localStorage.getItem('monkey-name') || '';

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const cssScale = clamp(Math.min(innerWidth / 850, innerHeight / 650), .62, 1.45);
  scale = cssScale * dpr;
  w = canvas.width / scale;
  h = canvas.height / scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
addEventListener('resize', resize); resize();

function endpoint(v, t = time) { return vineEndpoint(v, t); }
function ensureWorld(i) {
  while (lastIndex < i + 9) {
    const next = vineAt(++lastIndex);
    vines.push(next);
    if (next.i % 2 === 0) pickups.push({ x: next.x - 155, y: 338 + hash(next.i) * 70, taken: false });
  }
  while (vines.length && vines[0].i < i - 4) vines.shift();
  while (pickups.length && pickups[0].x < (i - 5) * 310) pickups.shift();
}
function currentVine() { return vines.find(v => v.i === monkey.vine); }
function start() {
  state = 'playing'; time = 0; acc = 0; camera = 0; score = 0; distance = 0; combo = 1; bestCombo = 1; lives = 1; bananas = 0; swings = 0; shake = 0;
  vines = [vineAt(0)]; particles = []; pickups = []; lastIndex = 0; ensureWorld(0);
  monkey = { ...endpoint(vines[0], 0), vx: 0, vy: 0, vine: 0, attached: true, airborne: 0, rotation: 0, trail: [] };
  ui.overlay.hidden = true; ui.hint.hidden = false; ui.pause.textContent = 'Ⅱ'; $('#finishBtn').hidden = true; updateHud();
}
function updateHud() {
  ui.score.textContent = score.toLocaleString('en-US');
  ui.distance.innerHTML = `${distance.toLocaleString('en-US')} <em>m</em>`;
  ui.combo.textContent = '×' + combo;
  ui.hearts.textContent = '♥'.repeat(lives) + '♡'.repeat(1 - lives);
}
function showToast(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1200);
}
function tone(freq = 500, duration = .1, type = 'sine') {
  if (!soundOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * .65, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(.065, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (_) { /* Audio is optional. */ }
}
function burst(x, y, color, count = 14) {
  for (let j = 0; j < count; j++) {
    const a = hash(j * 3 + time) * TAU, sp = 70 + hash(j * 7 + time) * 190;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .65 + hash(j + time) * .3, max: 1, size: 2 + hash(j * 5) * 5, color });
  }
}
function jump() {
  if (state !== 'playing' || !monkey.attached) return;
  const v = currentVine(), target = vines.find(q => q.i === monkey.vine + 1);
  if (!v || !target) return;
  const here = endpoint(v);
  monkey.x = here.x; monkey.y = here.y;
  Object.assign(monkey, swingLaunchVelocity(v, time));
  monkey.attached = false; monkey.airborne = 0;
  const swingVelocity = Math.cos(time * v.speed + v.phase);
  monkey.perfect = swingVelocity > .76 && here.theta > .08;
  monkey.trail = [];
  if (monkey.perfect) { burst(monkey.x, monkey.y, '#ffdc7b', 8); showToast('PERFECT LAUNCH!'); tone(690, .16); }
  else tone(400, .1);
  swings++;
}
function catchVine(v) {
  monkey.attached = true; monkey.vine = v.i; monkey.airborne = 0;
  const e = endpoint(v); monkey.x = e.x; monkey.y = e.y; monkey.rotation = 0;
  combo = monkey.perfect ? Math.min(combo + 1, 10) : 1;
  bestCombo = Math.max(bestCombo, combo);
  const points = (v.gold ? 250 : 100) * combo;
  score += points; distance = Math.round(v.i * 30);
  showToast(`${v.gold ? 'GOLDEN VINE ✦ ' : ''}+${points.toLocaleString()}  COMBO ×${combo}`);
  shake = 5; burst(monkey.x, monkey.y, v.gold ? '#ffdb69' : '#a8f18d'); tone(v.gold ? 760 : 540, .16);
  ensureWorld(v.i); updateHud();
}
function miss() {
  lives = 0; combo = 1; shake = 13;
  burst(monkey.x, monkey.y, '#ff8e71', 20); tone(170, .3, 'triangle'); updateHud();
  finish();
}
async function finish() {
  if (state === 'gameover') return;
  state = 'gameover'; ui.overlay.hidden = false; ui.hint.hidden = true;
  ui.title.innerHTML = 'GREAT<br><span>SWING!</span>';
  ui.text.textContent = 'การผจญภัยครั้งนี้จบแล้ว ลุยใหม่เพื่อทำลายสถิติ!';
  ui.stats.hidden = false;
  ui.stats.innerHTML = `<div><small>คะแนน</small><strong>${score.toLocaleString()}</strong></div><div><small>ระยะทาง</small><strong>${distance} m</strong></div><div><small>คอมโบสูงสุด</small><strong>×${bestCombo}</strong></div>`;
  ui.play.innerHTML = 'เล่นอีกครั้ง <span>↗</span>';
  $('#finishBtn').hidden = true;
  if (score > 0 && !submitPending) {
    submitPending = true;
    const name = ui.name.value.trim().slice(0, 18) || 'นักโหนป่า';
    localStorage.setItem('monkey-name', name);
    try { const result = await saveRank({ name, score, distance, bestCombo }); if (result.online) showToast('บันทึกอันดับออนไลน์แล้ว!'); }
    catch (_) { showToast('เก็บอันดับในเครื่องแล้ว'); }
    submitPending = false;
  }
}
function tick(dt) {
  time += dt;
  if (state === 'playing') {
    if (monkey.attached) {
      const e = endpoint(currentVine()); monkey.x = e.x; monkey.y = e.y;
    } else {
      const oldX = monkey.x, oldY = monkey.y;
      monkey.vy += G * dt; monkey.x += monkey.vx * dt; monkey.y += monkey.vy * dt;
      monkey.airborne += dt; monkey.rotation += dt * 5;
      if (monkey.trail.length > 8) monkey.trail.shift();
      monkey.trail.push({ x: monkey.x, y: monkey.y });
      for (const b of pickups) {
        if (!b.taken && Math.hypot(monkey.x - b.x, monkey.y - b.y) < 42) {
          b.taken = true; bananas++; score += 50 * combo; burst(b.x, b.y, '#ffd76e', 10); tone(900, .08); updateHud();
        }
      }
      const target = vines.find(v => v.i === monkey.vine + 1);
      if (target && monkey.airborne > .38) {
        const e = endpoint(target);
        // A swept check prevents fast movement or a slow display from skipping the catch zone.
        const d = pointSegmentDistance(e.x, e.y, oldX, oldY, monkey.x, monkey.y);
        if (d < 55) catchVine(target);
      }
      if (!monkey.attached && (monkey.y > Math.max(h + 110, 850) || monkey.airborne > 1.65)) miss();
    }
    camera += (monkey.x - Math.min(260, w * .34) - camera) * Math.min(1, dt * 4.3);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    shake = Math.max(0, shake - 24 * dt);
  }
}

function rounded(x, y, rw, rh, r) { ctx.beginPath(); ctx.roundRect(x, y, rw, rh, r); }
function leaf(x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * .8, -s * .5, -s * .4, -s * 1.3, 0, -s * 1.6);
  ctx.bezierCurveTo(s * .7, -s * .9, s * .8, -s * .3, 0, 0); ctx.fill(); ctx.restore();
}
function background() {
  const biome = Math.floor(Math.max(0, monkey.vine) / 12) % 3;
  const palettes = [['#0a303c','#116052','#f2b867'],['#172c50','#395e70','#e8b67b'],['#20263e','#354a55','#e4aa73']];
  const [top, mid, glow] = palettes[biome];
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(.72, mid); g.addColorStop(1, '#23634e'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  const sunX = w*.78 - camera*.025 % (w*.4);
  const halo = ctx.createRadialGradient(sunX, h*.26, 15, sunX, h*.26, 250); halo.addColorStop(0, glow+'85'); halo.addColorStop(1, glow+'00'); ctx.fillStyle=halo; ctx.fillRect(sunX-250,h*.26-250,500,500);
  ctx.fillStyle=glow; ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(sunX,h*.26,56,0,TAU);ctx.fill();ctx.globalAlpha=1;
  for (let layer = 0; layer < 3; layer++) {
    const factor = [.13,.27,.43][layer], base = h * [.68,.76,.86][layer], color = ['#174c51','#19544b','#164438'][layer];
    const step = [190,145,110][layer]; const offset = camera * factor;
    const first = Math.floor(offset / step) - 2, end = first + Math.ceil(w/step)+5;
    for(let i=first;i<end;i++) {
      const x=i*step-offset, s=.7+hash(i*19+layer)*.55, trunk=17*s, crown=65*s;
      ctx.fillStyle=color;rounded(x-trunk/2,base-60*s,trunk,h-base+110,7);ctx.fill();
      ctx.beginPath();ctx.ellipse(x,base-90*s,crown*.55,crown,0,0,TAU);ctx.fill();
      ctx.beginPath();ctx.ellipse(x-36*s,base-80*s,crown*.52,crown*.65,-.4,0,TAU);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+36*s,base-80*s,crown*.52,crown*.65,.4,0,TAU);ctx.fill();
    }
  }
  ctx.fillStyle='#143e35'; ctx.fillRect(0,h-52,w,52);
  for(let i=Math.floor(camera*.78/90)-2;i<Math.floor(camera*.78/90)+Math.ceil(w/90)+4;i++){
    const x=i*90-camera*.78, y=h-30+hash(i)*20; leaf(x,y,22,hash(i+5)*2-1,'#2e7751');leaf(x+14,y+11,18,.8,'#3c875b');
  }
  for(let i=0;i<26;i++) {const px=fract(hash(i*17)*w*2-camera*.06/w)*w, py=75+hash(i*23)*h*.65;
    ctx.globalAlpha=.14+.12*Math.sin(time*2+i);ctx.fillStyle='#fff3ae';ctx.beginPath();ctx.arc(px,py,1.5+hash(i*3)*2,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawVine(v) {
  const e=endpoint(v), x=v.x-camera, ex=e.x-camera;
  if(x < -220 || x > w+230) return;
  const active=v.i===monkey.vine && monkey.attached, next=v.i===monkey.vine+1;
  const sway=Math.sin(time*2+v.i)*8;
  ctx.strokeStyle='#062b29';ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,v.y-70);ctx.bezierCurveTo(x+sway,v.y+90,ex-sway,v.y+v.len*.7,ex,e.y);ctx.stroke();
  ctx.strokeStyle=v.gold?'#e7bf59':'#5cba80';ctx.lineWidth=6;ctx.stroke();
  ctx.strokeStyle=v.gold?'#ffe6a1':'#a7e59b';ctx.lineWidth=1.4;ctx.stroke();
  for(let j=1;j<5;j++) {const t=j/5, lx=x+(ex-x)*t+Math.sin(t*TAU)*12, ly=v.y+(e.y-v.y)*t;
    leaf(lx,ly,11,(-1)**j*.8,v.gold?'#ddc266':(j%2?'#43ab73':'#67c381'));}
  ctx.fillStyle=v.gold?'#fce68e':'#c5f7b0';ctx.beginPath();ctx.arc(ex,e.y,9,0,TAU);ctx.fill();
  if(next || active){ctx.strokeStyle=next?'#ffe9a6bb':'#c5f8b486';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ex,e.y,22+Math.sin(time*4)*3,0,TAU);ctx.stroke();}
  if(next){ctx.globalAlpha=.75;ctx.fillStyle='#fff5cb';ctx.font='600 12px Kanit';ctx.textAlign='center';ctx.fillText('จับตรงนี้',ex,e.y-35);ctx.globalAlpha=1;}
}
function drawBanana(b) {
  if(b.taken)return;const x=b.x-camera,y=b.y+Math.sin(time*3+b.x)*5;if(x<-40||x>w+40)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(-.3);ctx.shadowColor='#ffe075';ctx.shadowBlur=17;ctx.fillStyle='#ffdc69';
  ctx.beginPath();ctx.moveTo(-12,-10);ctx.quadraticCurveTo(-2,12,17,2);ctx.quadraticCurveTo(6,19,-10,11);ctx.quadraticCurveTo(-16,1,-12,-10);ctx.fill();
  ctx.fillStyle='#694e2a';ctx.fillRect(-13,-13,4,6);ctx.restore();
}
function drawMonkey() {
  const x=monkey.x-camera,y=monkey.y;
  for(let i=0;i<monkey.trail.length;i++) {const p=monkey.trail[i];ctx.globalAlpha=i/monkey.trail.length*.2;ctx.fillStyle='#ffe8ae';ctx.beginPath();ctx.arc(p.x-camera,p.y,10,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  ctx.save();ctx.translate(x,y);ctx.rotate(monkey.attached?Math.sin(time*2+monkey.vine)*.13:monkey.rotation);
  ctx.strokeStyle='#643f2a';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(6,15);ctx.bezierCurveTo(32,12,39,34,22,37);ctx.stroke();
  ctx.fillStyle='#72462e';ctx.beginPath();ctx.ellipse(0,12,23,25,0,0,TAU);ctx.fill();
  ctx.fillStyle='#986440';ctx.beginPath();ctx.ellipse(0,16,13,16,0,0,TAU);ctx.fill();
  for(const side of [-1,1]){ctx.strokeStyle='#6c432e';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(side*12,2);ctx.lineTo(side*27,-11);ctx.stroke();ctx.beginPath();ctx.moveTo(side*10,32);ctx.lineTo(side*19,41);ctx.stroke();}
  ctx.fillStyle='#71452f';ctx.beginPath();ctx.arc(0,-17,23,0,TAU);ctx.fill();
  for(const side of [-1,1]){ctx.fillStyle='#72462e';ctx.beginPath();ctx.arc(side*21,-21,9,0,TAU);ctx.fill();ctx.fillStyle='#c78c64';ctx.beginPath();ctx.arc(side*21,-21,5,0,TAU);ctx.fill();}
  ctx.fillStyle='#e9ae80';ctx.beginPath();ctx.ellipse(0,-10,16,13,0,0,TAU);ctx.fill();
  ctx.fillStyle='#182e29';for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*7,-20,2.7,0,TAU);ctx.fill();}
  ctx.strokeStyle='#6a3a2e';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,-9,5,.2,Math.PI-.2);ctx.stroke();
  ctx.fillStyle='#eabf81';rounded(-18,-39,36,8,4);ctx.fill();ctx.fillStyle='#d56548';rounded(-21,-42,42,5,3);ctx.fill();
  ctx.restore();
}
function draw() {
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  background();
  for(const b of pickups)drawBanana(b);
  for(const v of vines)drawVine(v);
  for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-camera,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  drawMonkey();
  for(let i=0;i<8;i++){let x=(i*178-camera*.68)%(w+200);if(x<0)x+=w+200;leaf(x,-5,20,i%2?.5:-.5,'#0b3e36');}
  ctx.restore();
}
function loop(now){const elapsed=Math.min((now-last)/1000||0,.05);last=now;if(state!=='paused')acc+=elapsed;
  let n=0;while(acc>=STEP&&n++<7){tick(STEP);acc-=STEP;}if(n>=7)acc=0;draw();requestAnimationFrame(loop);}
vines = [vineAt(0)]; ensureWorld(0); Object.assign(monkey, endpoint(vines[0]));
requestAnimationFrame(loop);

async function openRanking(tab = rankingTab){
  rankingTab=tab;ui.ranking.hidden=false;ui.globalTab.classList.toggle('active',tab==='global');ui.localTab.classList.toggle('active',tab==='local');
  ui.status.textContent=tab==='global'?'กำลังโหลดอันดับ…':'อันดับที่บันทึกบนอุปกรณ์นี้';ui.list.replaceChildren();
  let rows;
  try{rows=tab==='global'?await loadRanks():localRanks();ui.status.textContent=tab==='global'?'อันดับออนไลน์ · 20 อันดับแรก':'อันดับที่บันทึกบนอุปกรณ์นี้';}
  catch(_){rows=localRanks();ui.status.textContent=onlineEnabled()?'โหลดออนไลน์ไม่ได้ · แสดงอันดับในเครื่อง':'ยังไม่เชื่อม Firebase · แสดงอันดับในเครื่อง';}
  if(!rows.length){const li=document.createElement('li');li.textContent='ยังไม่มีคะแนน เริ่มโหนเป็นคนแรก!';ui.list.append(li);return;}
  rows.forEach((r,i)=>{const li=document.createElement('li');const place=document.createElement('span'),name=document.createElement('span'),points=document.createElement('span');place.className='place';name.className='name';points.className='points';place.textContent=i<3?['🥇','🥈','🥉'][i]:`#${i+1}`;name.textContent=r.name||'นักโหนป่า';points.textContent=Number(r.score||0).toLocaleString();li.append(place,name,points);ui.list.append(li);});
}
ui.play.addEventListener('click',()=>{
  if (state === 'paused') { state = 'playing'; ui.overlay.hidden = true; ui.pause.textContent = 'Ⅱ'; ui.hint.hidden = false; }
  else start();
});
$('#rankBtn').addEventListener('click',()=>openRanking());
$('#closeRank').addEventListener('click',()=>ui.ranking.hidden=true);
ui.ranking.addEventListener('click',e=>{if(e.target===ui.ranking)ui.ranking.hidden=true;});
ui.globalTab.addEventListener('click',()=>openRanking('global'));ui.localTab.addEventListener('click',()=>openRanking('local'));
ui.pause.addEventListener('click',()=>{if(state==='playing'){state='paused';ui.overlay.hidden=false;ui.title.innerHTML='PAUSED<br><span>GAME</span>';ui.text.textContent='พักหายใจสักครู่ แล้วกลับไปเหวี่ยงต่อ';ui.stats.hidden=true;ui.play.innerHTML='เล่นต่อ <span>↗</span>';ui.pause.textContent='▶';ui.hint.hidden=true;$('#finishBtn').hidden=false;}else if(state==='paused'){state='playing';ui.overlay.hidden=true;ui.pause.textContent='Ⅱ';ui.hint.hidden=false;$('#finishBtn').hidden=true;}});
$('#finishBtn').addEventListener('click',finish);
ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.textContent=soundOn?'♫':'♪';ui.sound.setAttribute('aria-label',soundOn?'ปิดเสียง':'เปิดเสียง');tone(500,.1);});
function action(e){if(e?.target?.closest?.('button,.panel,.rank-panel'))return;if(state==='playing'){e?.preventDefault?.();jump();}}
canvas.addEventListener('pointerdown',action);
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(state==='playing')jump();else if(state==='menu'||state==='gameover')start();else if(state==='paused')ui.play.click();}if(e.code==='Escape'&&!ui.ranking.hidden)ui.ranking.hidden=true;});
updateHud();
