
const state = {
  lessons: [],
  idx: 0,
  startedAt: null,
  answered: 0
};

const $ = (sel)=>document.querySelector(sel);
const $$= (sel)=>document.querySelectorAll(sel);

async function loadLessons(){
  const res = await fetch('data/lessons.json');
  state.lessons = await res.json();
  const saved = JSON.parse(localStorage.getItem('ptA1Progress')||'{}');
  state.idx = saved.idx ?? 0;
  renderLesson();
  updateStreak(saved);
  startTimer();
}

function saveProgress(){
  localStorage.setItem('ptA1Progress', JSON.stringify({idx: state.idx, streak: getStreak()}));
}

function renderLesson(){
  const lesson = state.lessons[state.idx];
  $('#lessonTitle').textContent = lesson.title;
  $('#lessonMeta').innerHTML = `Lição ${state.idx+1} de ${state.lessons.length}`;
  $('#dailyChallenge').innerHTML = lesson.challenge;
  $('#culturalNote').innerHTML = lesson.culturalNote;
  renderContent(lesson);
  updateProgressBar(0);
}

function renderContent(lesson){
  const wrap = $('#lessonContainer');
  wrap.innerHTML = '';

  // Vocab
  const vSec = document.createElement('section');
  vSec.innerHTML = `<div class="section-title"><span class="badge">Vocabulário</span></div>`;
  const grid = document.createElement('div');
  grid.className = 'vocab-grid';
  lesson.vocab.forEach(v => {
    const d = document.createElement('div');
    d.className='vocab-item';
    d.innerHTML = `<strong>${v.pt}</strong><br><small>${v.it}</small>`;
    grid.appendChild(d);
  });
  vSec.appendChild(grid);
  wrap.appendChild(vSec);

  // Phrases
  const pSec = document.createElement('section');
  pSec.innerHTML = `<div class="section-title"><span class="badge">Frasi</span></div>`;
  lesson.phrases.forEach(ph => {
    const d = document.createElement('div');
    d.className = 'phrase';
    d.innerHTML = ph;
    pSec.appendChild(d);
  });
  wrap.appendChild(pSec);

  // Quizzes
  const qSec = document.createElement('section');
  qSec.innerHTML = `<div class="section-title"><span class="badge">Quiz</span></div>`;
  lesson.quizzes.forEach((q, qi)=>{
    qSec.appendChild(renderQuiz(q, qi));
  });
  wrap.appendChild(qSec);

  state.answered = 0;
}

function renderQuiz(q, qi){
  const box = document.createElement('div');
  box.className = 'quiz';
  const h = document.createElement('h4');
  h.innerHTML = q.q ? q.q : 'Associações / Ordem';
  box.appendChild(h);

  const fb = document.createElement('div');
  fb.className='feedback';

  if(q.type==='multipleChoice'){
    const opts = document.createElement('div');
    opts.className='options';
    q.options.forEach((op, i)=>{
      const b = document.createElement('button');
      b.className='option';
      b.innerHTML = op.replace(/(\b(ser|estar|ter|ir|comer|beber|falar|ver|vir|gostar|fazer|dormir|trabalhar|estudar|haver|poder|querer)\b)/gi,'<b>$1</b>');
      b.onclick = ()=>{
        if(i===q.correctIndex){ b.classList.add('correct'); fb.textContent='Correto!'; fb.className='feedback ok';}
        else { b.classList.add('wrong'); fb.textContent='Não é bem isso.'; fb.className='feedback bad';}
        lockOptions(opts);
        incrementProgress();
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
  }

  if(q.type==='fillBlank'){
    const inp = document.createElement('input');
    inp.placeholder='Resposta…';
    inp.setAttribute('aria-label','Resposta');
    inp.onkeydown = (e)=>{ if(e.key==='Enter') check(); };
    const btn = document.createElement('button');
    btn.textContent='Verificar';
    btn.className='btn';
    function check(){
      const val = (inp.value||'').trim().toLowerCase();
      const ok = val===q.answer.toLowerCase();
      fb.textContent = ok ? 'Correto!' : `Sugestão: ${q.answer}`;
      fb.className = 'feedback ' + (ok?'ok':'bad');
      inp.disabled = true; btn.disabled = true;
      incrementProgress();
    }
    btn.onclick = check;
    box.appendChild(inp); box.appendChild(btn);
  }

  if(q.type==='match'){
    const pairs = q.pairs.slice();
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.className='options'; right.className='options';
    let selectedLeft=null; let solved=0;
    pairs.forEach(p=>{
      const L = document.createElement('button');
      L.className='option'; L.textContent=p[0]; L.dataset.key=p[0];
      L.onclick=()=>{ selectedLeft=L; [...left.children].forEach(x=>x.classList.remove('correct')); L.classList.add('correct'); };
      left.appendChild(L);
      const R = document.createElement('button');
      R.className='option'; R.textContent=p[1]; R.dataset.value=p[1];
      R.onclick=()=>{
        if(selectedLeft && pairs.some(x=>x[0]===selectedLeft.dataset.key && x[1]===R.dataset.value)){
          R.classList.add('correct'); R.disabled=true; selectedLeft.classList.add('correct'); selectedLeft.disabled=true;
          solved++;
          if(solved===pairs.length){ fb.textContent='Excelente!'; fb.className='feedback ok'; incrementProgress(); }
        }else{ R.classList.add('wrong'); fb.textContent='Tenta outra vez.'; fb.className='feedback bad'; }
      };
      right.appendChild(R);
    });
    const wrap = document.createElement('div'); wrap.className='row'; wrap.appendChild(left); wrap.appendChild(right);
    box.appendChild(wrap);
  }

  if(q.type==='reorder'){
    const tokens = q.tokens.slice();
    const tray = document.createElement('div'); tray.className='options'; tray.style.minHeight='44px';
    const pool = document.createElement('div'); pool.className='options';
    tokens.forEach(t=>{
      const b = document.createElement('button'); b.className='option'; b.textContent=t;
      b.onclick=()=>{ if(b.parentElement===pool) tray.appendChild(b); else pool.appendChild(b); };
      pool.appendChild(b);
    });
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Verificar ordem';
    btn.onclick=()=>{
      const seq = [...tray.children].map(x=>x.textContent);
      const ok = JSON.stringify(seq)===JSON.stringify(q.solution);
      fb.textContent = ok ? 'Perfeito!' : 'Quase… prova a trocar.';
      fb.className='feedback ' + (ok?'ok':'bad');
      if(ok){ btn.disabled=true; incrementProgress(); }
    };
    box.appendChild(pool); box.appendChild(tray); box.appendChild(btn);
  }

  box.appendChild(fb);
  return box;
}

function lockOptions(container){
  container.querySelectorAll('button').forEach(b=>b.disabled=true);
}

function incrementProgress(){
  state.answered++;
  const total = document.querySelectorAll('.quiz').length;
  updateProgressBar(Math.min(100, Math.round(state.answered/total*100)));
}

function updateProgressBar(pct){
  $('#progressBar').style.width = pct + '%';
}

function startTimer(){
  if(state.startedAt) return;
  state.startedAt = Date.now();
  let remaining = 15*60; // 15 minutes
  const tick = ()=>{
    remaining = Math.max(0, 15*60 - Math.floor((Date.now()-state.startedAt)/1000));
    const m = String(Math.floor(remaining/60)).padStart(2,'0');
    const s = String(remaining%60).padStart(2,'0');
    $('#timer').textContent = `⏱️ ${m}:${s}`;
    if(remaining>0) requestAnimationFrame(tick);
  };
  tick();
}

function updateStreak(saved){
  const today = new Date().toDateString();
  const last = localStorage.getItem('ptA1LastDay');
  let streak = Number(localStorage.getItem('ptA1Streak')||0);
  if(last!==today){ 
    // If last day is exactly yesterday, increment; else reset
    if(last){
      const d1 = new Date(last); const d2 = new Date(today);
      const diff = Math.round((d2 - d1)/86400000);
      if(diff===1) streak++; else streak=1;
    }else{
      streak=1;
    }
    localStorage.setItem('ptA1LastDay', today);
    localStorage.setItem('ptA1Streak', String(streak));
  }
  $('#streakCount').textContent = String(streak);
}

function getStreak(){ return Number(localStorage.getItem('ptA1Streak')||0); }

// Navigation
$('#nextBtn').onclick = ()=>{
  state.idx = (state.idx + 1) % state.lessons.length;
  saveProgress(); renderLesson();
};
$('#prevBtn').onclick = ()=>{
  state.idx = (state.idx - 1 + state.lessons.length) % state.lessons.length;
  saveProgress(); renderLesson();
};
$('#resetProgress').onclick = ()=>{
  localStorage.removeItem('ptA1Progress');
  localStorage.removeItem('ptA1Streak');
  localStorage.removeItem('ptA1LastDay');
  state.idx = 0; state.startedAt = null;
  renderLesson(); updateStreak({});
  $('#progressBar').style.width = '0%';
};

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.hidden = false;
  btn.onclick = async ()=>{
    btn.hidden = true;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  };
});

// Register SW
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js');
  });
}

loadLessons();
