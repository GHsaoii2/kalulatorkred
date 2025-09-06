// app.js — v3.7.0
(function () {
  // ================== helpers ==================
  const $ = (id) => document.getElementById(id);
  const NBSP = '\u00A0';
  const PLN = (v) => (v == null ? '—' : Number(v).toFixed(2) + NBSP + 'zł');
  const monthsPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  
  function num(x){ const n = Number(x); return Number.isFinite(n) ? n : null; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  
  // Chart registry
  const CHARTS = {};
  function makeChart(canvasId, config){
    const cvs = $(canvasId);
    if(!cvs || !window.Chart) return null;
    try{
      if (CHARTS[canvasId]) CHARTS[canvasId].destroy();
      CHARTS[canvasId] = new Chart(cvs, config);
      return CHARTS[canvasId];
    }catch(e){ console.warn('Chart error', canvasId, e); return null; }
  }

  // ================== Mock data fallback ==================
  const MOCK_DATA = {
    wibor3m: 4.77,
    currentInstallment: 5173.10,
    newInstallment: 5173.10,
    asOf: "2025-09-06",
    monthsRemaining: 180,
    capitalPaidPct: 15.5,
    initialLoan: 400000,
    capitalPaid: 62000,
    remainingLoan: 338000,
    installmentParts: { interest: 4465.56, principal: 707.54 },
    history: [
      ["2025-09-05", 4.77, -0.02],
      ["2025-09-04", 4.79, -0.02],
      ["2025-09-03", 4.81, -0.01],
      ["2025-09-02", 4.82, 0.00],
      ["2025-09-01", 4.82, 0.00]
    ],
    fraProjections: [
      ["Październik 2025", 5150.20, -22.90],
      ["Listopad 2025", 5145.10, -5.10],
      ["Grudzień 2025", 5140.50, -4.60]
    ]
  };
  
  // ================== fetch ==================
  function abortableFetch(url, ms=12000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    return { promise: fetch(url, { cache:'no-store', signal: ctrl.signal }), cancel: ()=>clearTimeout(t) };
  }
  
  async function fetchJson(url){
    const u = new URL(url);
    u.searchParams.set('v', (window.APP_VERSION||'v'));
    u.searchParams.set('_t', Date.now());
    const {promise, cancel} = abortableFetch(u.toString(), 15000);
    const r = await promise; cancel();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch(e){ throw new Error('Niepoprawny JSON: ' + txt.slice(0,180) + '…'); }
  }
  
  // ================== render ==================
  function renderAll(data){
    console.log('🎨 Rendering data...');
    
    // header
    $('asOf').textContent = 'Stan na ' + (data.asOf || '—');
    
    // WIBOR z ostatniego wpisu historii
    const last5 = Array.isArray(data.history) ? data.history.slice(0,5) : [];
    const wiborLatest = last5.length ? Number(last5[0][1]) : num(data.wibor3m);
    $('wibor').textContent = (wiborLatest != null ? wiborLatest.toFixed(2) + '%' : '—');
    
    // KPI
    const curr = num(data.currentInstallment);
    const next = num(data.newInstallment);
    $('curr').textContent = PLN(curr);
    $('new').textContent  = PLN(next);
    const diff = (next||0) - (curr||0);
    const diffEl = $('diff');
    diffEl.textContent = (diff > 0 ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + NBSP + 'zł';
    diffEl.className = 'val nowrap value ' + (diff > 0 ? 'up' : 'down');
    
    // pozostałe raty
    const monthsRemaining = num(data.monthsRemaining) || 0;
    if (monthsRemaining > 0){
      $('raty').textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      $('ratySub').textContent = 'ostatnia rata: ' + monthsPL[last.getMonth()] + ' ' + last.getFullYear();
    } else {
      $('raty').textContent = '—';
      $('ratySub').textContent = '';
    }
    
    // postęp spłaty - POPRAWIONE ID
    $('init').textContent = PLN(num(data.initialLoan));
    $('paid').textContent = PLN(num(data.capitalPaid));
    $('rem').textContent  = PLN(num(data.remainingLoan));
    const pct = clamp((num(data.capitalPaidPct)||0), 0, 100);
    $('bar').style.width = pct.toFixed(1) + '%'; // ← POPRAWIONE z barFill na bar
    $('barLabel').textContent = pct.toFixed(1) + '%';
    $('pct').textContent = pct.toFixed(1) + '%'; // ← POPRAWIONE - zgodne z HTML
    
    // wykres Struktura raty
    const interest = num(data.installmentParts?.interest) || 0;
    const principal = num(data.installmentParts?.principal) || 0;
    makeChart('pieChart', {
      type:'doughnut',
      data:{
        labels:['Odsetki','Kapitał'],
        datasets:[{ data:[interest, principal], borderWidth:0, backgroundColor:['#3b82f6','#93c5fd'] }]
      },
      options:{ plugins:{ legend:{ labels:{ color:getTextColor() } } }, cutout:'60%', responsive:true, maintainAspectRatio:false }
    });
    $('odsetki').textContent = PLN(interest);
    $('kapital').textContent = PLN(principal);
    
    // WIBOR – tylko 5 ostatnich
    renderWibor(last5);
    
    // FRA
    renderFRA(Array.isArray(data.fraProjections) ? data.fraProjections : []);
    
    console.log('✅ Rendering complete');
  }
  
  function ratyWord(n){
    n = Math.abs(Math.floor(n||0));
    const last = n % 10, last2 = n % 100;
    if (n === 1) return 'rata';
    if (last>=2 && last<=4 && !(last2>=12 && last2<=14)) return 'raty';
    return 'rat';
  }
  
  function getTextColor(){
    return getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e2e6e9';
  }
  
  function renderWibor(rows){
    const wrap = $('histTableWrap');
    if (!rows.length){ wrap.innerHTML = '<p>Brak danych historycznych</p>'; return; }
    
    // wykres
    const chartRows = rows.slice().reverse();
    makeChart('wiborChart', {
      type:'line',
      data:{
        labels: chartRows.map(r => r[0]),
        datasets:[{
          data: chartRows.map(r => Number(r[1])),
          borderColor:'#60A5FA',
          backgroundColor:'rgba(96,165,250,.20)',
          borderWidth:3, tension:.35, pointRadius:4, pointBackgroundColor:'#60A5FA', fill:true
        }]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color:getTextColor(), maxRotation:45, minRotation:45 } },
          y:{ ticks:{ color:getTextColor(), callback:v=> (typeof v==='number'? v.toFixed(2):v) } }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
    
    // tabela
    let html = '<table class="tbl"><thead><tr>'+
      '<th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
    rows.forEach(r=>{
      const d = r[0]; const val = Number(r[1]); const ch = Number(r[2]||0);
      const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
      const color = ch < 0 ? 'var(--good)' : (ch > 0 ? 'var(--bad)' : 'var(--muted)');
      html += `<tr><td>${d}</td>
                   <td><b>${val.toFixed(2)}%</b></td>
                   <td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    console.log('✅ WIBOR rendered');
  }
  
  function renderFRA(rows){
    const wrap = $('fraTableWrap');
    if (!rows.length){ wrap.innerHTML = '<p>Brak prognoz FRA</p>'; return; }
    
    makeChart('fraChart', {
      type:'line',
      data:{
        labels: rows.map(r => r[0]),
        datasets:[{
          data: rows.map(r => Number(r[1]||0)),
          borderColor:'#60A5FA',
          backgroundColor:'rgba(96,165,250,.20)',
          borderWidth:3, tension:.35, pointRadius:4, pointBackgroundColor:'#60A5FA', fill:true
        }]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color:getTextColor(), maxRotation:45, minRotation:45 } },
          y:{ ticks:{ color:getTextColor(), callback:v=> (typeof v==='number'? v.toFixed(0):v) } }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
    
    let html = '<table class="tbl"><thead><tr>'+
      '<th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    rows.forEach(r=>{
      const label = String(r[0]);
      const val = Number(r[1]||0);
      const ch  = Number(r[2]||0);
      const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
      const color = ch < 0 ? 'var(--good)' : (ch > 0 ? 'var(--bad)' : 'var(--muted)');
      html += `<tr>
        <td><span style="white-space:nowrap">${label}</span></td>
        <td><b>${val.toFixed(2)}${NBSP}zł</b></td>
        <td style="color:${color};font-weight:700"><span style="white-space:nowrap">${sym} ${Math.abs(ch).toFixed(2)}${NBSP}zł</span></td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    console.log('✅ FRA rendered');
  }
  
  // ================== accordion ==================
  function setupAccordion(){
    console.log('🔧 Setting up accordions...');
    document.querySelectorAll('.acc-head').forEach(btn=>{
      const targetId = btn.getAttribute('data-target');
      const body = $(targetId);
      
      // domyślnie zamknięte - POPRAWIONE
      const startOpen = btn.getAttribute('aria-expanded') === 'true';
      if (startOpen) {
        body.classList.add('open');
        body.style.display = 'block';
      } else {
        body.classList.remove('open');
        body.style.display = 'none';
      }
      
      btn.addEventListener('click', ()=>{
        const isOpen = body.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        
        // Smooth toggle
        if (isOpen) {
          body.style.display = 'block';
        } else {
          body.style.display = 'none';
        }
        
        console.log('🔄 Accordion:', targetId, isOpen ? 'opened' : 'closed');
      });
    });
    console.log('✅ Accordions setup complete');
  }
  
  // ================== boot ==================
  async function boot(){
    console.log('🚀 Starting app...');
    setupAccordion();
    
    try{
      $('asOf').textContent = 'Ładowanie…';
      console.log('📡 Fetching from API...');
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      console.log('✅ API data received');
      renderAll(data);
    }catch(e){
      console.warn('⚠️ API failed, using mock data:', e);
      renderAll(MOCK_DATA); // ← DODANE: fallback do mock data
      
      const box = $('errorBox'), btn=$('retryBtn');
      if (box) { 
        box.textContent = 'Używam danych testowych - API niedostępne: ' + (e?.message||e); 
        box.style.display = 'block'; 
      }
      if (btn) { 
        btn.style.display = 'inline-block'; 
        btn.onclick = ()=>{ 
          if (box) box.style.display='none'; 
          btn.style.display='none'; 
          boot(); 
        }; 
      }
    }
  }
  
  document.addEventListener('DOMContentLoaded', boot);
})();
