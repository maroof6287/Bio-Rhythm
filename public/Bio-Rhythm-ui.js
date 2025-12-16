// Bio-Rhythm-ui.js
// Visual organism (bioluminescent deep-sea vibe). Vanilla canvas + touch gestures.

const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
const moodEl = document.getElementById('mood');
const dot = document.getElementById('dot');

const ctx = canvas.getContext('2d', { alpha: true });
let w=0, h=0, dpr=1;

function resize(){
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const r = stage.getBoundingClientRect();
  w = Math.floor(r.width);
  h = Math.floor(r.height);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w+'px';
  canvas.style.height = h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);

let t=0;
let energy = 0.18; // 0..1
let calm = 0.55;   // 0..1
let swirl = { x: 0, y: 0 };
let pointerDown = false;

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function setMood(){
  // energy increases with swipes; calm increases with hold
  const mood = energy > 0.6 ? 'Energized' : (calm > 0.7 ? 'Calm' : 'Awake');
  moodEl.textContent = mood;
  const glow = energy > 0.6 ? 'rgba(255,0,200,0.85)' : 'rgba(0,255,224,0.85)';
  dot.style.background = glow;
  dot.style.boxShadow = `0 0 18px ${glow}`;
}

function draw(){
  t += 1/60;

  // drift back slowly
  swirl.x *= 0.92;
  swirl.y *= 0.92;

  // background haze
  ctx.clearRect(0,0,w,h);
  const g = ctx.createRadialGradient(w*0.35, h*0.25, 40, w*0.5, h*0.6, Math.max(w,h));
  g.addColorStop(0, 'rgba(17,26,85,0.55)');
  g.addColorStop(1, 'rgba(2,6,23,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // particles
  for (let i=0;i<48;i++){
    const px = (Math.sin(t*0.7 + i*2.1) * 0.5 + 0.5) * w;
    const py = (Math.cos(t*0.55 + i*1.7) * 0.5 + 0.5) * h;
    const a = 0.05 + 0.08*Math.sin(t + i);
    ctx.fillStyle = `rgba(0,255,224,${a})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.2 + 0.8*Math.sin(t*2+i), 0, Math.PI*2);
    ctx.fill();
  }

  // organism body
  const cx = w*0.5 + swirl.x;
  const cy = h*0.52 + swirl.y;
  const baseR = Math.min(w,h)*0.12;
  const pulse = 1 + 0.06*Math.sin(t*3.2) + 0.14*energy*Math.sin(t*6.0);
  const r = baseR * pulse;

  // glow layers
  const glow1 = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r*3.0);
  glow1.addColorStop(0, `rgba(0,255,224,${0.20 + 0.35*calm})`);
  glow1.addColorStop(0.4, `rgba(255,0,200,${0.08 + 0.22*energy})`);
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.beginPath();
  ctx.arc(cx, cy, r*3.0, 0, Math.PI*2);
  ctx.fill();

  const body = ctx.createRadialGradient(cx-r*0.2, cy-r*0.2, r*0.2, cx, cy, r*1.2);
  body.addColorStop(0, `rgba(255,255,255,${0.20 + 0.20*energy})`);
  body.addColorStop(0.15, `rgba(0,255,224,${0.55})`);
  body.addColorStop(0.55, `rgba(11,16,47,${0.98})`);
  body.addColorStop(1, `rgba(2,6,23,${1.0})`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r*1.05, r*0.9, Math.sin(t*0.8)*0.15, 0, Math.PI*2);
  ctx.fill();

  // "wings" appear when energy high (sleep well vibe)
  if (energy > 0.58){
    ctx.strokeStyle = `rgba(80,255,122,${0.22 + 0.35*(energy-0.58)})`;
    ctx.lineWidth = 3;
    for (let s of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(cx + s*r*0.6, cy - r*0.1);
      ctx.quadraticCurveTo(cx + s*r*1.8, cy - r*0.9, cx + s*r*2.2, cy + r*0.3);
      ctx.stroke();
    }
  }

  // "stone" effect when calm low + no movement
  const still = Math.abs(swirl.x)+Math.abs(swirl.y) < 1.0;
  if (calm < 0.35 && still && !pointerDown){
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i=0;i<18;i++){
      const rx = cx + (Math.random()-0.5)*r*1.2;
      const ry = cy + (Math.random()-0.5)*r*1.0;
      ctx.fillRect(rx, ry, 2, 2);
    }
  }

  // "fire breath" when energy high + swipe burst
  if (energy > 0.72 && (Math.abs(swirl.x)+Math.abs(swirl.y) > 8)){
    const fx = cx + Math.sin(t*10)*4;
    const fy = cy + r*0.5;
    const flame = ctx.createLinearGradient(fx, fy, fx, fy+r*2.2);
    flame.addColorStop(0, 'rgba(255,0,200,0.55)');
    flame.addColorStop(0.4, 'rgba(0,255,224,0.40)');
    flame.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx-18, fy+r*1.1, fx, fy+r*2.2);
    ctx.quadraticCurveTo(fx+18, fy+r*1.1, fx, fy);
    ctx.fill();
  }

  setMood();
  requestAnimationFrame(draw);
}

function onPointer(e){
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX, y: p.clientY };
}

let last = null;
stage.addEventListener('pointerdown', (e)=>{
  pointerDown = true;
  last = onPointer(e);
  // holding calms
  calm = clamp(calm + 0.06, 0, 1);
});
stage.addEventListener('pointermove', (e)=>{
  if (!pointerDown) return;
  const p = onPointer(e);
  const dx = p.x - last.x;
  const dy = p.y - last.y;
  last = p;
  swirl.x += dx*0.4;
  swirl.y += dy*0.4;
  // swiping energizes
  const amp = clamp((Math.abs(dx)+Math.abs(dy))/60, 0, 1);
  energy = clamp(energy + 0.10*amp, 0, 1);
  calm = clamp(calm - 0.04*amp, 0, 1);
});
window.addEventListener('pointerup', ()=>{ pointerDown=false; last=null; });

// expose tiny hooks for script.js to sync "pre-transaction" emotion
window.__BR_UI__ = {
  pulseBoost(ms=1200){
    const start = performance.now();
    const base = energy;
    function tick(now){
      const p = clamp((now-start)/ms, 0, 1);
      energy = clamp(base + 0.40*Math.sin(p*Math.PI), 0, 1);
      calm = clamp(calm + 0.18*(1-p), 0, 1);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
};

resize();
requestAnimationFrame(draw);
