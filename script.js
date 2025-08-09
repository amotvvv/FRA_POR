'use strict';
console.log('script.js v3.2.2 loaded');

'use strict';
(function(){
  const LS_KEY = 'pt_app_v3_state';
  const todayISO = () => new Date().toISOString().slice(0,10);
  const nowISO = () => new Date().toISOString();
  const state = loadState() || { points:0, streak:0, lastDone:null, completed:{}, currentDay:1, results:[] };
  function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} }
  function loadState(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)); } catch(e){ return null; } }

  // Root
  var root = document.getElementById('app');
  if(!root){ root = document.createElement('div'); root.id='app'; document.body.innerHTML=''; document.body.appendChild(root); }

  // Layout
  injectMinimalStyles();
  var course = buildCourse(); // 14 giorni
  renderLayout();

  function renderLayout(){
    root.innerHTML =
      '<header class="hdr">'
      +  '<div class="hdr-top"><h1>Portoghese Base</h1><div class="meta"><span>Streak: <b>'+state.streak+'</b></span><span>Punti: <b>'+state.points+'</b></span></div></div>'
      +  '<nav class="tabs"><button data-tab="home" class="tab active">Home</button><button data-tab="lessons" class="tab">Lezioni</button><button data-tab="profile" class="tab">Profilo</button></nav>'
      +'</header><main id="view"></main><footer class="ftr"></footer>';
    var view = root.querySelector('#view');
    showHome(view);
    root.querySelectorAll('.tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        root.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        var tab = btn.dataset.tab;
        if(tab==='home') showHome(view);
        if(tab==='lessons') showLessons(view);
        if(tab==='profile') showProfile(view);
      });
    });
  }

  function showHome(view){
    var day = state.currentDay;
    var lesson = course[day-1];
    view.innerHTML =
      '<section class="card">'
      +  '<h2>Giorno '+day+': '+lesson.title+'</h2>'
      +  renderObjectives(lesson)
      +  renderSection('Vocabulario', renderVocab(lesson.vocab))
      +  renderSection('Frasi utili', renderPhrases(lesson.phrases))
      +  renderSection('Verbi del giorno', renderVerbs(lesson.verbs))
      +  renderSection('Curiosità', '<p>'+lesson.culture+'</p>')
      +  renderQuizzes(lesson, day)
      +  renderDailyControls(day)
      +'</section>'
      + renderDaySelector();
    attachAudioHandlers();
    attachQuizHandlers(day);
    attachDailyHandlers(day);
    attachDaySelector();
  }
  function showLessons(view){
    var items = course.map(function(l,i){
      var day=i+1; var done = state.completed['D'+day] && state.completed['D'+day].done ? '✅' : '○';
      return '<li><button class="aslink" data-goto="'+day+'">'+done+' Giorno '+day+': '+l.title+'</button></li>';
    }).join('');
    view.innerHTML =
      '<section class="card"><h2>Tutte le lezioni (14 giorni)</h2><ul class="list">'+items+'</ul></section>'
      + renderDaySelector();
    view.querySelectorAll('[data-goto]').forEach(function(btn){
      btn.addEventListener('click', function(){
        state.currentDay = parseInt(btn.dataset.goto,10); saveState(); showHome(document.querySelector('#view')); activateTab('home');
      });
    });
    attachDaySelector();
  }
  function showProfile(view){
    var completedCount = Object.values(state.completed).filter(c=>c && c.done).length;
    view.innerHTML =
      '<section class="card"><h2>Profilo</h2>'
      + '<p><b>Punti:</b> '+state.points+'</p><p><b>Streak:</b> '+state.streak+'</p><p><b>Lezioni completate:</b> '+completedCount+'/14</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="exportCsv" class="secondary">Esporta risultati (CSV)</button><button id="reset" class="danger">Azzera progressi</button></div>'
      + '<p class="muted" style="margin-top:8px">L'export include: giorno, quiz, tipo, esito, punti e timestamp.</p></section>'
      + renderDaySelector();
    view.querySelector('#reset').addEventListener('click', function(){
      if(confirm('Sei sicuro di voler azzerare i progressi?')){ localStorage.removeItem(LS_KEY); location.reload(); }
    });
    view.querySelector('#exportCsv').addEventListener('click', exportCSV);
    attachDaySelector();
  }

  function renderObjectives(lesson){ return '<p class="muted">Obiettivi: '+lesson.goals.join(' • ')+'</p>'; }
  function renderSection(title, inner){ return '<section class="sub"><h3>'+title+'</h3>'+inner+'</section>'; }

  // Audio TTS
  function speakPT(text){
    try{
      var synth = window.speechSynthesis; if(!synth) return alert('Sintesi vocale non supportata.');
      var utter = new SpeechSynthesisUtterance(text);
      var voices = synth.getVoices();
      var ptVoice = (voices||[]).find(v=>/portuguese|portugu\u00EAs|pt/i.test((v.lang||v.name)||'')) || (voices||[]).find(v=>/pt-PT|pt_BR/i.test(v.lang||''));
      if(ptVoice) utter.voice = ptVoice;
      utter.lang = (ptVoice && ptVoice.lang) || 'pt-PT';
      utter.rate = 1;
      synth.cancel(); synth.speak(utter);
    }catch(e){ console.warn(e); }
  }
  function audioBtn(htmlTextPT){
    var clean = htmlTextPT.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    return '<button class="audio" data-tts="'+escapeHtml(clean)+'" title="Pronuncia (PT)">🔊</button>';
  }

  // Render parts
  function renderVocab(list){
    return '<ul class="kv">'+list.map(v=>'<li><span class="pt">'+escapeHtml(v.pt)+'</span> <span class="it">– '+escapeHtml(v.it)+'</span> '+audioBtn(v.pt)+'</li>').join('')+'</ul>';
  }
  function renderPhrases(list){ return '<ul class="phr">'+list.map(s=>'<li>'+s+' '+audioBtn(s)+'</li>').join('')+'</ul>'; }
  function renderVerbs(list){ return '<ul class="verbs">'+list.map(v=>'<li><code>'+escapeHtml(v.inf)+'</code> — '+escapeHtml(v.note)+'</li>').join('')+'</ul>'; }
  function attachAudioHandlers(){ root.querySelectorAll('button.audio').forEach(b=> b.addEventListener('click', ()=> speakPT(b.getAttribute('data-tts')||''))); }

  // Quizzes
  function renderQuizzes(lesson, day){
    var qhtml = lesson.quizzes.map((q,idx)=> renderQuiz(q, 'D'+day+'-Q'+(idx+1))).join('');
    return '<section class="sub"><h3>Quiz del giorno</h3>'+qhtml+'</section>';
  }
  function renderQuiz(q, qid){
    if(q.type==='match'){
      var opts = Array.from(new Set(q.pairs.map(p=>p.it)));
      var rows = q.pairs.slice(0,5).map((p,i)=>{
        var select = '<select data-q="'+qid+'" data-i="'+i+'"><option value="">Scegli</option>'+opts.map(o=>'<option value="'+escapeHtml(o)+'">'+escapeHtml(o)+'</option>').join('')+'</select>';
        return '<div class="match-row"><span class="pt">'+escapeHtml(p.pt)+'</span>'+select+'</div>';
      }).join('');
      return '<div class="quiz" data-type="match" data-id="'+qid+'" data-answer=\''+JSON.stringify(q.pairs).replace(/'/g,'&#39;')+'\'>'
        + '<p>'+(q.prompt||'Abbina parola ↔ significato (PT ↔ IT)')+'</p>'+rows
        + '<button class="btn-check" data-id="'+qid+'">Verifica</button><div class="qmsg" id="'+qid+'-msg"></div></div>';
    }
    if(q.type==='order'){
      var target = q.target;
      var clean = target.replace(/<[^>]+>/g,'').replace(/[!?.,]/g,'').trim();
      var pieces = shuffle(clean.split(/\s+/));
      var buttons = pieces.map(w=>'<button class="token" data-w="'+escapeHtml(w)+'">'+escapeHtml(w)+'</button>').join(' ');
      return '<div class="quiz" data-type="order" data-id="'+qid+'" data-target=\''+target.replace(/'/g,'&#39;')+'\'>'
        + '<p>'+(q.prompt||'Metti in ordine le parole per formare la frase (PT)')+'</p>'
        + '<div class="tokens">'+buttons+'</div><div class="build" id="'+qid+'-build"></div>'
        + '<button class="btn-check" data-id="'+qid+'">Verifica</button>'
        + '<button class="btn-clear" data-id="'+qid+'">Pulisci</button>'
        + '<div class="qmsg" id="'+qid+'-msg"></div></div>';
    }
    if(q.type==='multi'){
      var opts2 = q.options.map(o=>'<label class="opt"><input type="radio" name="'+qid+'" value="'+escapeHtml(o)+'"> '+o+'</label>').join('<br>');
      return '<div class="quiz" data-type="multi" data-id="'+qid+'" data-answer="'+escapeHtml(q.answer)+'"><p>'+q.prompt+'</p><div class="opts">'+opts2+'</div><button class="btn-check" data-id="'+qid+'">Verifica</button><div class="qmsg" id="'+qid+'-msg"></div></div>';
    }
    if(q.type==='cloze'){
      return '<div class="quiz" data-type="cloze" data-id="'+qid+'" data-answer="'+escapeHtml(q.answer)+'"><p>'+q.prompt+'</p><input class="inp" placeholder="Scrivi qui..." /><button class="btn-check" data-id="'+qid+'">Verifica</button><div class="qmsg" id="'+qid+'-msg"></div></div>';
    }
    if(q.type==='truefalse'){
      return '<div class="quiz" data-type="truefalse" data-id="'+qid+'" data-answer="'+(q.answer?'true':'false')+'"><p>'+q.prompt+'</p><label class="opt"><input type="radio" name="'+qid+'" value="true"> Vero</label><label class="opt"><input type="radio" name="'+qid+'" value="false"> Falso</label><button class="btn-check" data-id="'+qid+'">Verifica</button><div class="qmsg" id="'+qid+'-msg"></div></div>';
    }
    return '';
  }
  function attachQuizHandlers(day){
    var container = root;
    container.querySelectorAll('.quiz .btn-check').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        var qid = btn.dataset.id;
        var box = container.querySelector('.quiz[data-id="'+qid+'"]');
        var type = box.dataset.type; var ok=false;
        if(type==='match'){
          var correct = JSON.parse(box.dataset.answer.replace(/&#39;/g,"'"));
          ok = true;
          correct.slice(0,5).forEach((p,i)=>{
            var sel = box.querySelector('select[data-i="'+i+'"]');
            if(!sel || sel.value.trim() !== p.it){ ok=false; }
          });
        } else if(type==='order'){
          var targetHtml = box.dataset.target;
          var targetClean = targetHtml.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
          var built = box.querySelector('#'+qid+'-build').innerText.replace(/\s+/g,' ').trim();
          ok = (built === targetClean);
        } else if(type==='multi'){
          var ans = box.dataset.answer;
          var chosenEl = box.querySelector('input[type="radio"]:checked'); var chosen = chosenEl ? chosenEl.value : '';
          ok = (chosen===ans);
        } else if(type==='cloze'){
          var ans2 = (box.dataset.answer||'').toLowerCase().trim();
          var txt = (box.querySelector('.inp').value||'').toLowerCase().trim();
          ok = normalize(txt) === normalize(ans2);
        } else if(type==='truefalse'){
          var ans3 = box.dataset.answer;
          var chosenEl2 = box.querySelector('input[type="radio"]:checked'); var chosen2 = chosenEl2 ? chosenEl2.value : '';
          ok = (chosen2===ans3);
        }
        var msg = container.querySelector('#'+qid+'-msg');
        if(ok){ msg.textContent='✔️ Corretto! +10 punti'; msg.className='qmsg ok'; addPoints(10); markQuizDone(day,qid,type,true,10); }
        else { msg.textContent='❌ Riprova. Suggerimento: rivedi le frasi.'; msg.className='qmsg err'; markQuizDone(day,qid,type,false,0); }
      });
    });
    container.querySelectorAll('.quiz[data-type="order"] .token').forEach(tok=>{
      tok.addEventListener('click', ()=>{
        var build = tok.closest('.quiz').querySelector('.build');
        build.innerText = (build.innerText + ' ' + tok.dataset.w).trim();
        tok.disabled = true;
      });
    });
    container.querySelectorAll('.quiz[data-type="order"] .btn-clear').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        var quiz = btn.closest('.quiz');
        quiz.querySelectorAll('.token').forEach(t=>t.disabled=false);
        quiz.querySelector('.build').innerText='';
      });
    });
  }

  function markQuizDone(day, qid, type, correct, pts){
    var key = 'D'+day;
    state.completed[key] = state.completed[key] || { quizzes:{} };
    state.completed[key].quizzes[qid] = !!correct;
    state.results.push({ day:day, qid:qid, type:type, correct: !!correct, points: pts, ts: nowISO() });
    saveState();
  }

  function renderDailyControls(day){
    var done = state.completed['D'+day] && state.completed['D'+day].done;
    return '<div class="daily"><button id="mark-done" '+(done?'disabled':'')+'>Segna lezione come completata</button><span class="muted">'+(done?'Già completata oggi.':'')+'</span></div>';
  }
  function renderDaySelector(){
    var opts = Array.from({length:14}, (_,i)=>'<option value="'+(i+1)+'" '+(state.currentDay===(i+1)?'selected':'')+'>Giorno '+(i+1)+'</option>').join('');
    return '<section class="card slim"><label>Vai a: <select id="daySel">'+opts+'</select></label></section>';
  }
  function attachDaySelector(){
    var sel = root.querySelector('#daySel');
    if(sel){ sel.addEventListener('change', ()=>{ state.currentDay = parseInt(sel.value,10); saveState(); showHome(document.querySelector('#view')); activateTab('home'); }); }
  }
  function attachDailyHandlers(day){
    var btn = root.querySelector('#mark-done');
    if(btn){ btn.addEventListener('click', ()=>{ var key='D'+day; state.completed[key]=state.completed[key]||{quizzes:{}}; if(!state.completed[key].done){ state.completed[key].done=true; addPoints(20); updateStreak(); saveState(); showHome(document.querySelector('#view')); } }); }
  }
  function addPoints(p){ state.points += p; saveState(); root.querySelector('.meta').innerHTML = '<span>Streak: <b>'+state.streak+'</b></span><span>Punti: <b>'+state.points+'</b></span>'; }
  function updateStreak(){
    var t = todayISO(); if(state.lastDone===t) return;
    if(state.lastDone){ var y=new Date(state.lastDone); y.setDate(y.getDate()+1); var isYesterday = y.toISOString().slice(0,10)===t; state.streak = isYesterday ? (state.streak+1) : 1; }
    else { state.streak = 1; }
    state.lastDone = t;
  }

  // Export CSV
  function exportCSV(){
    var header = ['day','qid','type','correct','points','timestamp'];
    var rows = state.results.map(r=>[r.day, r.qid, r.type, r.correct?'1':'0', r.points, r.ts]);
    var csv = [header].concat(rows).map(r=>r.join(',')).join('\n');
    var blob = new Blob([csv], {type:'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'risultati_portoghese.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  // Utils
  function escapeHtml(s){ return String(s).replace(/[&<>'"]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;',\"'\":'&#39;','\"':'&quot;'}[m]; }); }
  function shuffle(a){ return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }
  function normalize(s){ return s.replace(/[áàãâ]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i').replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c'); }
  function activateTab(name){ root.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); var el = root.querySelector('.tab[data-tab="'+name+'"]'); if(el) el.classList.add('active'); }

  function injectMinimalStyles(){ /* stile già in style.css; qui nulla */ }

  // Contenuti (14 giorni) con verbi in <strong>
  function B(s, verb){ return s.replace(new RegExp(verb,'i'), function(m){ return '<strong>'+m+'</strong>'; }); }
  function buildCourse(){
    var days = [];

    days.push({ // D1
      title:"Cumprimentos e Apresentações",
      goals:["saluti","presentarsi","chiedere come va"],
      vocab:[
        {pt:"olá",it:"ciao"},{pt:"bom dia",it:"buongiorno"},{pt:"boa tarde",it:"buon pomeriggio"},
        {pt:"boa noite",it:"buonasera/buonanotte"},{pt:"prazer",it:"piacere"},{pt:"tudo bem?",it:"tutto bene?"},
        {pt:"obrigado/obrigada",it:"grazie (m/f)"},{pt:"chamar-se",it:"chiamarsi"},{pt:"nome",it:"nome"},{pt:"de onde",it:"di dove"}
      ],
      phrases:[B("Chamo-me Francesca e sou italiana.","Chamo-me"),B("Prazer em conhecer, eu sou a Ana.","sou"),B("Olá! Como estás? Estou bem, obrigado.","Estou"),B("De onde és? Eu sou de Lisboa.","sou")],
      verbs:[{inf:"chamar-se",note:"mi chiamo / ti chiami…"},{inf:"ser",note:"essere (identità/origine)"},{inf:"estar",note:"essere (stato/momento)"}],
      culture:"In Portogallo, un 'bom dia' cordiale apre molte porte. Il 'tu' è comune tra coetanei, ma con sconosciuti puoi usare 'você' in modo gentile.",
      quizzes:[
        {type:"match",pairs:[{pt:"olá",it:"ciao"},{pt:"prazer",it:"piacere"},{pt:"obrigado",it:"grazie (m)"},{pt:"boa tarde",it:"buon pomeriggio"},{pt:"chamar-se",it:"chiamarsi"}]},
        {type:"order",target:B("Chamo-me Francesca e sou italiana","Chamo-me")},
        {type:"multi",prompt:"Scegli la forma corretta di **ser**: Eu ___ de Portugal.",options:["sou","estou","é"],answer:"sou"},
        {type:"truefalse",prompt:"'Você' è sempre informale in Portogallo.",answer:false}
      ]
    });

    days.push({ // D2
      title:"Números e Idade",
      goals:["numeri 0–20","dire l'età","chiedere prezzi"],
      vocab:[
        {pt:"zero",it:"zero"},{pt:"um/uma",it:"uno/una"},{pt:"dois/duas",it:"due"},{pt:"três",it:"tre"},{pt:"quatro",it:"quattro"},
        {pt:"cinco",it:"cinque"},{pt:"seis",it:"sei"},{pt:"sete",it:"sette"},{pt:"oito",it:"otto"},{pt:"nove",it:"nove"},{pt:"dez",it:"dieci"},{pt:"idade",it:"età"}
      ],
      phrases:[B("Tenho dezassete anos e estudo no liceu.","Tenho"),B("Quanto custa este caderno? Custa três euros.","custa"),B("Pode fazer um desconto? É para estudante.","fazer")],
      verbs:[{inf:"ter",note:"avere → tenho, tens, tem…"}, {inf:"custar",note:"costare (impersonale: 'custa')"}, {inf:"poder",note:"potere → posso, podes, pode…"}],
      culture:"I prezzi sono spesso esposti. Chiedere 'Pode fazer desconto?' è comune ma non sempre applicabile nei negozi delle catene.",
      quizzes:[
        {type:"cloze",prompt:"Completa: Eu ___ (avere) dezassete anos.",answer:"tenho"},
        {type:"multi",prompt:"Traduci: 'Quanto costa?'",options:["Quanto custa?","Quanto tempo?","Quanto pesa?"],answer:"Quanto custa?"},
        {type:"match",pairs:[{pt:"sete",it:"sette"},{pt:"nove",it:"nove"},{pt:"dez",it:"dieci"},{pt:"idade",it:"età"},{pt:"dois",it:"due"}]}
      ]
    });

    days.push({ // D3
      title:"Família e Pronomi",
      goals:["parlare della famiglia","pronomi soggetto"],
      vocab:[
        {pt:"mãe",it:"madre"},{pt:"pai",it:"padre"},{pt:"irmã",it:"sorella"},{pt:"irmão",it:"fratello"},{pt:"filha",it:"figlia"},
        {pt:"filho",it:"figlio"},{pt:"avó",it:"nonna"},{pt:"avô",it:"nonno"},{pt:"família",it:"famiglia"},{pt:"amigo",it:"amico"}
      ],
      phrases:[B("Esta é a minha mãe e trabalha num hospital.","trabalha"),B("O meu irmão joga futebol e estuda muito.","estuda"),B("Nós moramos em Porto, mas os meus avós vivem no campo.","moramos")],
      verbs:[{inf:"trabalhar",note:"lavorare"},{inf:"estudar",note:"studiare"},{inf:"morar",note:"abitare/vivere (residenza)"}],
      culture:"Nelle conversazioni informali si omette spesso il pronome (eu/você/nós) perché la persona è chiara dalla forma del verbo.",
      quizzes:[
        {type:"order",target:B("Nós moramos em Porto","moramos")},
        {type:"multi",prompt:"Seleziona il significato di 'irmã'",options:["sorella","cugina","zia"],answer:"sorella"},
        {type:"truefalse",prompt:"In portoghese europeo, 'você' è sempre formale.",answer:false}
      ]
    });

    days.push({ // D4
      title:"Dias, Meses, Horas",
      goals:["giorni della settimana","parlare della routine"],
      vocab:[
        {pt:"segunda-feira",it:"lunedì"},{pt:"terça-feira",it:"martedì"},{pt:"quarta-feira",it:"mercoledì"},{pt:"quinta-feira",it:"giovedì"},
        {pt:"sexta-feira",it:"venerdì"},{pt:"sábado",it:"sabato"},{pt:"domingo",it:"domenica"},{pt:"hora",it:"ora"},{pt:"cedo",it:"presto"},{pt:"tarde",it:"tardi/pomeriggio"}
      ],
      phrases:[B("Acordo cedo e tomo pequeno-almoço às sete.","Acordo"),B("Estudo português à noite e vou ao ginásio à tarde.","Estudo"),B("Na sexta-feira, trabalho de casa.","trabalho")],
      verbs:[{inf:"acordar",note:"svegliarsi"},{inf:"tomar",note:"prendere (colazione/doccia/bus)"},{inf:"estudar",note:"studiare"},{inf:"ir",note:"andare → vou, vais, vai…"}],
      culture:"La colazione è 'pequeno-almoço'. In Portogallo, il sabato molti negozi chiudono prima la sera.",
      quizzes:[
        {type:"cloze",prompt:"Completa: Eu ___ (andare) ao ginásio à tarde.",answer:"vou"},
        {type:"match",pairs:[{pt:"sexta-feira",it:"venerdì"},{pt:"domingo",it:"domenica"},{pt:"hora",it:"ora"},{pt:"cedo",it:"presto"},{pt:"tarde",it:"tardi/pomeriggio"}]},
        {type:"order",target:B("Estudo português à noite","Estudo")}
      ]
    });

    days.push({ // D5
      title:"Comida e Bebidas",
      goals:["ordinare al bar/ristorante","chiedere il conto"],
      vocab:[
        {pt:"água",it:"acqua"},{pt:"pão",it:"pane"},{pt:"queijo",it:"formaggio"},{pt:"frango",it:"pollo"},{pt:"peixe",it:"pesce"},
        {pt:"sopa",it:"zuppa"},{pt:"sobremesa",it:"dessert"},{pt:"conta",it:"conto"},{pt:"ementa",it:"menu"},{pt:"garfo",it:"forchetta"},{pt:"faca",it:"coltello"}
      ],
      phrases:[B("Queria um pão e um café, por favor.","Queria"),B("Pode trazer a conta quando puder?","trazer"),B("Gostaria de experimentar o peixe do dia.","experimentar")],
      verbs:[{inf:"querer",note:"volere → quero, queres, quer…"},{inf:"trazer",note:"portare/servire → trago, trazes, traz…"},{inf:"experimentar",note:"provare/assaggiare"}],
      culture:"Molti ristoranti mettono sul tavolo 'couverts' (pane, olive, burro). Sono a pagamento solo se li consumi.",
      quizzes:[
        {type:"multi",prompt:"Come chiedi gentilmente il conto?",options:["Queres a conta?","Pode trazer a conta?","Dá-me a conta!"],answer:"Pode trazer a conta?"},
        {type:"truefalse",prompt:"I 'couverts' sono sempre gratuiti.",answer:false},
        {type:"match",pairs:[{pt:"peixe",it:"pesce"},{pt:"sopa",it:"zuppa"},{pt:"sobremesa",it:"dessert"},{pt:"conta",it:"conto"},{pt:"ementa",it:"menu"}]}
      ]
    });

    days.push({ // D6
      title:"Na Cidade e Transportes",
      goals:["chiedere indicazioni","muoversi in città"],
      vocab:[
        {pt:"autocarro",it:"autobus"},{pt:"metro",it:"metropolitana"},{pt:"bilhete",it:"biglietto"},{pt:"estação",it:"stazione"},{pt:"direita",it:"destra"},
        {pt:"esquerda",it:"sinistra"},{pt:"perto",it:"vicino"},{pt:"longe",it:"lontano"},{pt:"mapa",it:"mappa"},{pt:"desculpe",it:"mi scusi"}
      ],
      phrases:[B("Desculpe, pode dizer-me como chego à estação?","dizer-me"),B("Vire à direita e depois siga em frente.","siga"),B("Vou de metro porque é mais rápido.","Vou")],
      verbs:[{inf:"dizer",note:"dire → digo, dizes, diz…"},{inf:"seguir",note:"seguire, proseguire"},{inf:"ir",note:"andare → vou, vais, vai…"}],
      culture:"A Lisbona le colline sono ripide: ottima scusa per provare i famosi tram!",
      quizzes:[
        {type:"order",target:B("Vire à direita e siga em frente","siga")},
        {type:"cloze",prompt:"Completa: Eu ___ (andare) de metro.",answer:"vou"},
        {type:"match",pairs:[{pt:"mapa",it:"mappa"},{pt:"perto",it:"vicino"},{pt:"longe",it:"lontano"},{pt:"estação",it:"stazione"},{pt:"bilhete",it:"biglietto"}]}
      ]
    });

    days.push({ // D7
      title:"Revisão + Diálogos",
      goals:["ripasso settimanale","mini dialoghi"],
      vocab:[
        {pt:"hoje",it:"oggi"},{pt:"amanhã",it:"domani"},{pt:"ontem",it:"ieri"},{pt:"gostar de",it:"piacere (a)"},{pt:"precisar de",it:"aver bisogno di"},
        {pt:"querer",it:"volere"},{pt:"poder",it:"potere"},{pt:"ir",it:"andare"},{pt:"fazer",it:"fare"},{pt:"ficar",it:"restare/fermarsi"}
      ],
      phrases:[B("Hoje quero praticar português com um amigo.","quero"),B("Amanhã posso estudar mais tempo em casa.","posso"),B("Ontem fui ao centro e fiquei num café.","fiquei")],
      verbs:[{inf:"poder",note:"potere"},{inf:"querer",note:"volere"},{inf:"ficar",note:"restare"},{inf:"fazer",note:"fare"},{inf:"ir",note:"andare (passato: fui, foste, foi…)"}],
      culture:"Molti portoghesi amano i caffè storici: ordinare un 'bica' a Lisbona equivale a un espresso.",
      quizzes:[
        {type:"multi",prompt:"Seleziona il passato corretto di **ir**: Ontem eu ___ ao centro.",options:["vou","fui","ia"],answer:"fui"},
        {type:"truefalse",prompt:"'Bica' è un tipo di dolce tipico.",answer:false},
        {type:"order",target:B("Hoje quero praticar português","quero")}
      ]
    });

    days.push({ // D8
      title:"Casa e Objetos",
      goals:["stanze, oggetti comuni","descrivere la casa"],
      vocab:[
        {pt:"casa",it:"casa"},{pt:"quarto",it:"camera"},{pt:"cozinha",it:"cucina"},{pt:"sala",it:"soggiorno"},{pt:"casa de banho",it:"bagno"},
        {pt:"mesa",it:"tavolo"},{pt:"cadeira",it:"sedia"},{pt:"janela",it:"finestra"},{pt:"porta",it:"porta"},{pt:"luz",it:"luce"},{pt:"chave",it:"chiave"}
      ],
      phrases:[B("Moro num apartamento pequeno, mas é muito confortável.","Moro"),B("Abre a janela, por favor, e liga a luz.","Abre"),B("Preciso de uma cadeira para studiare melhor.","Preciso")],
      verbs:[{inf:"morar",note:"abitare"},{inf:"abrir",note:"aprire"},{inf:"ligar",note:"accendere/chiamare"},{inf:"precisar de",note:"aver bisogno di"}],
      culture:"In Portogallo si usa spesso l'acqua calda dei boiler elettrici domestici; fai attenzione agli orari notturni (tariffe bi-horárias).",
      quizzes:[
        {type:"cloze",prompt:"Completa: Eu ___ (abitare) num apartamento.",answer:"moro"},
        {type:"match",pairs:[{pt:"janela",it:"finestra"},{pt:"cadeira",it:"sedia"},{pt:"mesa",it:"tavolo"},{pt:"luz",it:"luce"},{pt:"porta",it:"porta"}]},
        {type:"truefalse",prompt:"'Ligar' significa solo 'telefonare'.",answer:false}
      ]
    });

    days.push({ // D9
      title:"Tempo e Roupa",
      goals:["parlare del meteo","vestiti e preferenze"],
      vocab:[
        {pt:"sol",it:"sole"},{pt:"chuva",it:"pioggia"},{pt:"vento",it:"vento"},{pt:"frio",it:"freddo"},{pt:"calor",it:"caldo"},
        {pt:"casaco",it:"giacca"},{pt:"camisola",it:"maglione"},{pt:"camiseta",it:"maglietta"},{pt:"calças",it:"pantaloni"},{pt:"sapatos",it:"scarpe"}
      ],
      phrases:[B("Hoje está frio, por isso visto um casaco quente.","visto"),B("Quando chove, levo sempre um guarda-chuva.","levo"),B("No verão, gosto de usar camisetas leves.","gosto")],
      verbs:[{inf:"vestir",note:"vestire/indossare"},{inf:"levar",note:"portare/indossare"},{inf:"gostar de",note:"piacere"}],
      culture:"A nord (Porto) il clima è più umido e fresco rispetto al sud (Algarve). 'Camisola' in PT è maglione; in BR è spesso la maglia da calcio.",
      quizzes:[
        {type:"multi",prompt:"Traduci: 'Está frio'.",options:["Fa caldo","Fa freddo","Piove"],answer:"Fa freddo"},
        {type:"order",target:B("Hoje está frio por isso visto um casaco","visto")},
        {type:"truefalse",prompt:"'Camisola' significa sempre maglietta.",answer:false}
      ]
    });

    days.push({ // D10
      title:"Escola e Estudo",
      goals:["materie","impegni scolastici"],
      vocab:[
        {pt:"escola",it:"scuola"},{pt:"aula",it:"lezione"},{pt:"caderno",it:"quaderno"},{pt:"livro",it:"libro"},{pt:"exame",it:"esame"},
        {pt:"projeto",it:"progetto"},{pt:"nota",it:"voto"},{pt:"professor(a)",it:"insegnante"},{pt:"matemática",it:"matematica"},{pt:"história",it:"storia"}
      ],
      phrases:[B("Estudo matemática todos os dias e faço exercícios online.","Estudo"),B("A professora dá uma tarefa para amanhã.","dá"),B("Quero migliorare as minhas notas este semestre.","Quero")],
      verbs:[{inf:"estudar",note:"studiare"},{inf:"fazer",note:"fare → faço, fazes, faz…"},{inf:"dar",note:"dare → dou, dás, dá…"},{inf:"querer",note:"volere"}],
      culture:"Nelle scuole portoghesi il voto spesso va da 0 a 20. Un 14–16 è considerato molto buono.",
      quizzes:[
        {type:"cloze",prompt:"Completa: Eu ___ (fare) os exercícios online.",answer:"faço"},
        {type:"match",pairs:[{pt:"caderno",it:"quaderno"},{pt:"exame",it:"esame"},{pt:"professora",it:"insegnante (f)"},{pt:"nota",it:"voto"},{pt:"livro",it:"libro"}]},
        {type:"multi",prompt:"Scegli il verbo giusto: A professora ___ uma tarefa.",options:["faz","dá","vai"],answer:"dá"}
      ]
    });

    days.push({ // D11
      title:"Tempo Livre e Hobbies",
      goals:["sport, musica, uscire"],
      vocab:[
        {pt:"música",it:"musica"},{pt:"cantar",it:"cantare"},{pt:"dançar",it:"ballare"},{pt:"nadar",it:"nuotare"},{pt:"caminhar",it:"camminare"},
        {pt:"filme",it:"film"},{pt:"série",it:"serie"},{pt:"jogar",it:"giocare (sport/videogiochi)"},{pt:"passear",it:"passeggiare"},{pt:"concerto",it:"concerto"}
      ],
      phrases:[B("Ao fim de semana, gosto de passear na natureza.","gosto"),B("Às vezes canto com os amigos e danço um pouco.","canto"),B("Prefiro ver um filme a jogar videojogos.","ver")],
      verbs:[{inf:"gostar de",note:"piacere"},{inf:"cantar",note:"cantare"},{inf:"dançar",note:"ballare"},{inf:"ver",note:"vedere"}],
      culture:"Il 'fado' è un genere musicale tradizionale portoghese: testi intensi, chitarra portoghese e molta emozione.",
      quizzes:[
        {type:"truefalse",prompt:"'Jogar' si usa anche per i videogiochi.",answer:true},
        {type:"order",target:B("Gosto de passear na natureza ao fim de semana","Gosto")},
        {type:"multi",prompt:"Traduci 'ver um filme'.",options:["vedere un film","fare un film","filmare"],answer:"vedere un film"}
      ]
    });

    days.push({ // D12
      title:"Saúde e Bem-Estar",
      goals:["malesseri comuni","andare in farmacia"],
      vocab:[
        {pt:"dor",it:"dolore"},{pt:"gripe",it:"influenza"},{pt:"tosse",it:"tosse"},{pt:"febre",it:"febbre"},{pt:"remédio",it:"medicina"},
        {pt:"farmácia",it:"farmacia"},{pt:"receita",it:"ricetta (medica)"},{pt:"consulta",it:"visita medica"},{pt:"descansar",it:"riposare"},{pt:"beber água",it:"bere acqua"}
      ],
      phrases:[B("Estou com febre e preciso de marcar uma consulta.","preciso"),B("Pode indicar um remédio para a tosse?","indicar"),B("Vou descansar e beber muita água.","Vou")],
      verbs:[{inf:"precisar de",note:"aver bisogno di"},{inf:"indicar",note:"indicare"},{inf:"descansar",note:"riposare"},{inf:"beber",note:"bere"}],
      culture:"Le farmacie ('farmácias') sono molto diffuse; cerca la croce verde luminosa. Molte hanno orari estesi.",
      quizzes:[
        {type:"cloze",prompt:"Completa: Eu ___ (aver bisogno) de marcar uma consulta.",answer:"preciso"},
        {type:"match",pairs:[{pt:"tosse",it:"tosse"},{pt:"febre",it:"febbre"},{pt:"farmácia",it:"farmacia"},{pt:"remédio",it:"medicina"},{pt:"consulta",it:"visita medica"}]},
        {type:"truefalse",prompt:"'Beber água' significa 'bere acqua'.",answer:true}
      ]
    });

    days.push({ // D13
      title:"Trabalho e Rotina",
      goals:["parlare del lavoro","riunioni, orari"],
      vocab:[
        {pt:"trabalho",it:"lavoro"},{pt:"emprego",it:"impiego"},{pt:"empresa",it:"azienda"},{pt:"reunião",it:"riunione"},{pt:"projeto",it:"progetto"},
        {pt:"prazo",it:"scadenza"},{pt:"tarefa",it:"compito"},{pt:"horário",it:"orario"},{pt:"equipa",it:"squadra"},{pt:"relatório",it:"report"}
      ],
      phrases:[B("Trabalho numa empresa de tecnologia e participo em reuniões semanais.","Trabalho"),B("Precisamos de terminar o projeto antes do prazo.","terminar"),B("Vou enviar o relatório e falar com a equipa.","Vou")],
      verbs:[{inf:"trabalhar",note:"lavorare"},{inf:"terminar",note:"finire/terminare"},{inf:"enviar",note:"inviare"},{inf:"falar",note:"parlare"}],
      culture:"In Portogallo gli orari sono spesso 9–18 con pausa pranzo verso le 13. Molte aziende usano Teams/Zoom per riunioni ibride.",
      quizzes:[
        {type:"multi",prompt:"Traduci 'reunião'.",options:["riunione","reunione","riunito"],answer:"riunione"},
        {type:"order",target:B("Vou enviar o relatório","Vou")},
        {type:"truefalse",prompt:"'Prazo' significa 'premio'.",answer:false}
      ]
    });

    days.push({ // D14
      title:"Viagens e Planos",
      goals:["prenotazioni, piani, futuro perifrastico"],
      vocab:[
        {pt:"viagem",it:"viaggio"},{pt:"bilhete",it:"biglietto"},{pt:"reserva",it:"prenotazione"},{pt:"hotel",it:"hotel"},{pt:"partida",it:"partenza"},
        {pt:"chegada",it:"arrivo"},{pt:"horário",it:"orario"},{pt:"bagagem",it:"bagaglio"},{pt:"documento",it:"documento"},{pt:"ferias",it:"vacanze"}
      ],
      phrases:[B("Vou viajar no próximo mês e já fiz a reserva do hotel.","Vou"),B("Quero visitar o centro histórico e experimentar a gastronomia local.","Quero"),B("Podemos comprar os bilhetes online para evitar filas.","comprar")],
      verbs:[{inf:"ir + infinitivo",note:"futuro vicino: vou viajar…"},{inf:"querer",note:"volere"},{inf:"comprar",note:"comprare"},{inf:"visitar",note:"visitare"}],
      culture:"Il treno Alfa Pendular collega le principali città; per sconti, compra in anticipo ('promo').",
      quizzes:[
        {type:"cloze",prompt:"Completa: Amanhã eu ___ (andare) visitar o centro.",answer:"vou"},
        {type:"match",pairs:[{pt:"reserva",it:"prenotazione"},{pt:"bilhete",it:"biglietto"},{pt:"bagagem",it:"bagaglio"},{pt:"partida",it:"partenza"},{pt:"chegada",it:"arrivo"}]},
        {type:"multi",prompt:"Scegli la frase al futuro vicino corretta:",options:["Eu viajo amanhã","Eu vou viajar amanhã","Eu viajarei amanhã (PT colloquiale)"],answer:"Eu vou viajar amanhã"}
      ]
    });

    return days;
  }

})(); 
