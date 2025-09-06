// app.js — stabilny UI (bez animacji wysokości), wykresy + tabele
(function () {
  // ===== Helpers
  const id = (s) => document.getElementById(s);
  const NBSP = "\u00A0";
  const PLN = (v) => (v == null ? "–" : Number(v).toFixed(2) + NBSP + "zł");
  const monthsPL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (x) => { const n = Number(x); return isNaN(n) ? null : n; };

  // wykresy — rejestr aby nie dublować instancji
  const CHARTS = {};
  function makeChart(canvasId, cfg) {
    const cvs = id(canvasId);
    if (!cvs || !window.Chart) return null;
    try {
      if (CHARTS[canvasId]) CHARTS[canvasId].destroy();
      CHARTS[canvasId] = new Chart(cvs, cfg);
      return CHARTS[canvasId];
    } catch (e) { console.warn("Chart error:", canvasId, e); return null; }
  }

  function ratyWord(n){
    n = Math.abs(Math.floor(n||0));
    const last = n%10, last2 = n%100;
    if (n===1) return 'rata';
    if (last>=2 && last<=4 && !(last2>=12 && last2<=14)) return 'raty';
    return 'rat';
  }

  // ===== Fetch z timeoutem oraz cache:no-store
  function abortableFetch(url, ms=15000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    return { promise: fetch(url, {cache:'no-store', signal:ctrl.signal}), cancel:()=>clearTimeout(t) };
  }

  async function fetchJson(url){
    const u = new URL(url);
    u.searchParams.set('v', window.APP_VERSION||'v');
    u.searchParams.set('_t', Date.now());
    const {promise, cancel} = abortableFetch(u.toString(), 15000);
    const r = await promise; cancel();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch(e){ throw new Error('Niepoprawny JSON: ' + txt.slice(0, 180) + '…'); }
  }

  // ===== Error / retry
  function showError(msg){
    const box = id('errorBox');
    if (!msg){ box.style.display='none'; return; }
    box.textContent = msg;
    box.style.display='block';
  }

  // ===== Render
  function render(data){
    id('asOf').textContent = 'Stan na ' + (data.asOf||'—');

    // WIBOR = ostatni odczyt z historii (spójność)
    let wiborFromHistory = null;
    if (Array.isArray(data.history) && data.history.length){
      const v = Number(data.history[0][1]);
      if (!isNaN(v)) wiborFromHistory = v;
    }
    const wibor = wiborFromHistory!=null ? wiborFromHistory : num(data.wibor3m);
    id('wibor').textContent = (wibor!=null ? wibor.toFixed(2)+'%' : '–');

    // KPI: raty
    const curr = num(data.currentInstallment);
    const next = num(data.newInstallment);
    id('curr').textContent = PLN(curr);
    id('new').textContent  = PLN(next);

    const diff = (next||0) - (curr||0);
    const diffNode = id('diff');
    diffNode.textContent = (diff>0?'▲ +':'▼ ') + Math.abs(diff).toFixed(2) + NBSP + 'zł';
    diffNode.className = 'val nowrap value ' + (diff>0?'up':'down');

    // Pozostałe raty (jeśli API zwraca)
    const monthsRemaining = num(data.monthsRemaining) || 0;
    if (monthsRemaining>0){
      id('raty').textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth()+monthsRemaining, 1);
      id('ratySub').textContent = 'ostatnia rata: ' + monthsPL[last.getMonth()] + ' ' + last.getFullYear();
    } else { id('raty').textContent='–'; id('ratySub').textContent=''; }

    // Postęp spłaty
    const pct = clamp((num(data.capitalPaidPct)||0),0,100);
    id('bar').style.width = pct.toFixed(1)+'%';
    id('barLabel').textContent = pct.toFixed(1)+'%';
    id('init').textContent = PLN(num(data.initialLoan));
    id('paid').textContent = PLN(num(data.capitalPaid));
    id('rem').textContent  = PLN(num(data.remainingLoan));
    id('pct').textContent  = pct.toFixed(1)+'%';

    // Donut (jeśli Chart.js jest dostępny)
    safePie(num(data.installmentParts?.interest), num(data.installmentParts?.principal));

    // WIBOR wykres + tabela
    safeWiborChart(data.history||[]);

    // FRA wykres + tabela
    safeFra(data.fraProjections||[]);
  }

  // ===== Wykresy / Tabele
  function safePie(interest, principal){
    try{
      makeChart('pieChart', {
        type:'doughnut',
        data:{
          labels:['Odsetki','Kapitał'],
          datasets:[{ data:[interest||0, principal||0], borderWidth:0, backgroundColor:['#3b82f6','#93c5fd'] }]
        },
        options:{
          cutout:'58%',
          plugins:{ legend:{ labels:{ color:'#cdd6e0', boxWidth:18 } } },
          maintainAspectRatio:false
        }
      });
      id('odsetki').textContent = PLN(interest||0);
      id('kapital').textContent = PLN(principal||0);
    }catch(e){ /* brak Chart.js → po prostu pokaż wartości */ }
  }

  function safeWiborChart(rows){
    try{
      // wykres z ostatnich 5 dni (chronologicznie)
      const m = rows.slice(0,5).map(r=>[String(r[0]), Number(r[1])]).reverse();
      const labels = m.map(x=>x[0]);
      const values = m.map(x=>x[1]);
      makeChart('wiborChart', {
        type:'line',
        data:{ labels, datasets:[{ data:values, borderColor:'#60A5FA', backgroundColor:'rgba(96,165,250,.20)', tension:.35, pointRadius:4, pointBackgroundColor:'#60A5FA', fill:true }] },
        options:{ plugins:{ legend:{display:false}}, scales:{ x:{ticks:{color:'#cdd6e0'},grid:{color:'rgba(255,255,255,.06)'}}, y:{ticks:{color:'#cdd6e0', callback:v=> (typeof v==='number'? v.toFixed(2):v)},grid:{color:'rgba(255,255,255,.06)'}}}, maintainAspectRatio:false }
      });

      // tabela (12 pozycji)
      const wrap = id('histTableWrap');
      if (!rows.length){ wrap.innerHTML = '<p>Brak danych historycznych</p>'; return; }
      const view = rows.slice(0,12);
      let html = '<table class="tbl"><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
      for (const r of view){
        const d = String(r[0]);
        const val = Number(r[1]);
        const ch = Number(r[2]||0);
        const sym = ch>0?'▲':(ch<0?'▼':'▬');
        const color = ch<0?'#16a34a':(ch>0?'#dc2626':'#6b7280');
        html += `<tr>
          <td><span style="white-space:nowrap">${d}</span></td>
          <td><strong>${val.toFixed(2)}%</strong></td>
          <td><span style="white-space:nowrap;color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}</span></td>
        </tr>`;
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }catch(e){ console.warn('WIBOR chart/table error', e); }
  }

  function safeFra(rows){
    try{
      const labels = rows.map(r=>String(r[0]));
      const values = rows.map(r=>Number(r[1]||0));
      makeChart('fraChart', {
        type:'line',
        data:{ labels, datasets:[{ data:values, borderColor:'#60A5FA', backgroundColor:'rgba(96,165,250,.20)', tension:.35, pointRadius:4, pointBackgroundColor:'#60A5FA', fill:true }] },
        options:{ plugins:{ legend:{display:false}}, scales:{ x:{ticks:{color:'#cdd6e0'},grid:{color:'rgba(255,255,255,.06)'}}, y:{ticks:{color:'#cdd6e0', callback:v=> (typeof v==='number'? v.toFixed(0):v)},grid:{color:'rgba(255,255,255,.06)'}}}, maintainAspectRatio:false }
      });

      // tabela
      const wrap = id('fraTableWrap');
      if (!rows.length){ wrap.innerHTML = '<p>Brak prognoz FRA</p>'; return; }
      let html = '<table class="tbl"><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
      for (const r of rows){
        const label = String(r[0]);
        const val = Number(r[1]||0);
        const ch = Number(r[2]||0);
        const sym = ch>0?'▲':(ch<0?'▼':'▬');
        const color = ch<0?'#16a34a':(ch>0?'#dc2626':'#6b7280');
        html += `<tr>
          <td><span style="white-space:nowrap">${label}</span></td>
          <td><strong>${val.toFixed(2)}${NBSP}zł</strong></td>
          <td><span style="white-space:nowrap;color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}${NBSP}zł</span></td>
        </tr>`;
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }catch(e){ console.warn('FRA chart/table error', e); }
  }

  // ===== Akordeony
  function setupAccordions(){
    document.querySelectorAll('.acc-head').forEach(btn=>{
      const body = id(btn.getAttribute('data-target'));
      const startOpen = btn.getAttribute('aria-expanded') === 'true';
      if (startOpen) body.classList.add('open');
      btn.addEventListener('click', ()=>{
        const isOpen = body.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen?'true':'false');
      });
    });
  }

  // ===== Start
  async function load(){
    showError(null);
    id('asOf').textContent = 'Ładowanie…';
    try{
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      render(data);
    }catch(e){
      console.error(e);
      showError('Nie udało się pobrać raportu: ' + (e?.message||e));
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setupAccordions();
    load();
  });
})();
