function getCSS(property) {
    return getComputedStyle(document.documentElement).getPropertyValue(property) || '#ffffff';
}
(function(){
  const id = s => document.getElementById(s);
  const NBSP = '\u00A0';
  const PLN = v => (v==null?'-':(Number(v).toFixed(2) + NBSP + 'zł'));
  const monthsPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  function ratyWord(n){
    n = Math.abs(Math.floor(n||0));
    const last = n % 10, last2 = n % 100;
    if (n === 1) return 'rata';
    if (last>=2 && last<=4 && !(last2>=12 && last2<=14)) return 'raty';
    return 'rat';
  }

  function abortableFetch(url, ms=12000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    return { promise: fetch(url, {cache:'no-store', signal: ctrl.signal}), cancel: ()=>clearTimeout(t) };
  }

  async function fetchJson(url){
    const u = new URL(url);
    u.searchParams.set('v', window.APP_VERSION||'v');
    u.searchParams.set('_t', Date.now());
    const {promise, cancel} = abortableFetch(u.toString(), 12000);
    const r = await promise; cancel();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); } catch(e){ throw new Error('Niepoprawny JSON: ' + txt.slice(0,200) + '…'); }
  }

  async function load(){
    showError(null);
    id('asOf').textContent = 'Ładowanie… • ' + (window.APP_VERSION||'');
    try{
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      try { render(data); }
      catch(err){
        showError('Błąd renderowania UI: ' + (err?.message||err));
        console.error(err);
      }
    }catch(e){
      showError('Nie udało się pobrać raportu: ' + e.message);
      console.error(e);
    }
  }

  function showError(msg){
    const box = id('errorBox'); const btn = id('retryBtn');
    if(!msg){ box.style.display='none'; btn.style.display='none'; return; }
    box.textContent = msg; box.style.display='block';
    btn.style.display='inline-block';
    btn.onclick = load;
  }

  function render(data){
    id('asOf').textContent = 'Stan na ' + (data.asOf||'—') + ' • ' + (window.APP_VERSION||'');
    const wibor = num(data.wibor3m);
    id('wibor').textContent = (wibor!=null? wibor.toFixed(2)+'%' : '—');
    id('curr').textContent  = PLN(num(data.currentInstallment));
    id('new').textContent   = PLN(num(data.newInstallment));
    const diff = (num(data.newInstallment)||0) - (num(data.currentInstallment)||0);
    id('diff').textContent = (diff>0?'▲ +':'▼ ') + Math.abs(diff).toFixed(2) + NBSP + 'zł';
    id('diff').className = 'value nowrap ' + (diff>0?'up':'down');

    const monthsRemaining = num(data.monthsRemaining) || 0;
    if (monthsRemaining > 0){
      id('raty').textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      id('ratySub').textContent = 'ostatnia rata: ' + monthsPL[last.getMonth()] + ' ' + last.getFullYear();
    } else { id('raty').textContent='—'; id('ratySub').textContent='—'; }

    const pct = clamp(num(data.capitalPaidPct)||0, 0, 100);
    id('bar').style.width = pct.toFixed(1)+'%';
    id('barLabel').textContent = pct.toFixed(1)+'%';
    id('init').textContent = PLN(num(data.initialLoan));
    id('paid').textContent = PLN(num(data.capitalPaid));
    id('rem').textContent  = PLN(num(data.remainingLoan));
    id('pct').textContent  = pct.toFixed(1)+'%';

    // charts guarded
    safePie(num(data.installmentParts?.interest), num(data.installmentParts?.principal));
    safeWiborChart(data.history||[]);
    safeFraChart(data.fraProjections||[]);
  }

  function num(x){ const n = Number(x); return isNaN(n)?null:n; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function safePie(interest, principal){
    try{
      if (!(window.Chart && Chart.Doughnut)) {/*noop*/}
      const ctx = document.getElementById('pieChart');
      new Chart(ctx, { type:'doughnut', data:{ labels:['Odsetki','Kapitał'], datasets:[{ data:[interest||0, principal||0], borderWidth:0, backgroundColor:['#3b82f6','#93c5fd'] }]},
        options:{ plugins:{ legend:{ display:true, labels:{ color:getCSS('--text') } } }, cutout:'60%', responsive:true, maintainAspectRatio:false } });
      id('odsetki').textContent = PLN(interest||0);
      id('kapital').textContent = PLN(principal||0);
    }catch(e){ console.warn('Pie chart skipped:', e); }
  }

 function safeWiborChart(rows) {
    try {
        const wrap = id('histTableWrap');
        if (!rows.length) {
            wrap.innerHTML = '<p>Brak danych historycznych</p>';
            return;
        }
        
        let html = '<table style="width:100%;border-collapse:collapse;border:1px solid #dee2e6;border-radius:10px">';
        html += '<tr>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">Data</th>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">WIBOR 3M (%)</th>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">Zmiana</th>';
        html += '</tr>';
        
        rows.forEach(row => {
            const d = row[0];
            const val = Number(row[1]);
            const ch = Number(row[2]);
            const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
            const color = ch < 0 ? '#2a9d8f' : (ch > 0 ? '#e63946' : '#111827');
            
            html += '<tr>';
            html += '<td style="border:1px solid #dee2e6;padding:12px">' + d + '</td>';
            html += '<td style="border:1px solid #dee2e6;padding:12px"><b>' + val.toFixed(2) + '%</b></td>';
            html += '<td style="border:1px solid #dee2e6;padding:12px;color:' + color + ';font-weight:600">' + sym + ' ' + Math.abs(ch).toFixed(2) + '</td>';
            html += '</tr>';
        });
        
        html += '</table>';
        wrap.innerHTML = html;
    } catch (e) {
        console.warn('WIBOR chart error:', e);
    }
}

 function safeFraChart(rows) {
    try {
        const wrap = id('fraTableWrap');
        if (!rows.length) {
            wrap.innerHTML = '<p>Brak prognoz FRA</p>';
            return;
        }
        
        let html = '<table style="width:100%;border-collapse:collapse;border:1px solid #dee2e6;border-radius:10px">';
        html += '<tr>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">Miesiąc raty</th>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">Prognozowana rata</th>';
        html += '<th style="border:1px solid #dee2e6;padding:12px;background:#f8f9fa">Zmiana</th>';
        html += '</tr>';
        
        rows.forEach(row => {
            const label = row[0];
            const val = Number(row[1]);
            const ch = Number(row[2]);
            const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
            const color = ch < 0 ? '#2a9d8f' : (ch > 0 ? '#e63946' : '#111827');
            
            html += '<tr>';
            html += '<td style="border:1px solid #dee2e6;padding:12px">' + label + '</td>';
            html += '<td style="border:1px solid #dee2e6;padding:12px"><b>' + val.toFixed(2) + '\u00A0zł</b></td>';
            html += '<td style="border:1px solid #dee2e6;padding:12px;color:' + color + ';font-weight:600">' + sym + ' ' + Math.abs(ch).toFixed(2) + '\u00A0zł</td>';
            html += '</tr>';
        });
        
        html += '</table>';
        wrap.innerHTML = html;
    } catch (e) {
        console.warn('FRA chart error:', e);
    }
}

  function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  // Hard refresh
  async function hardRefresh() {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch(e) {}
    const u = new URL(window.location.href);
    u.searchParams.set('v', Date.now());
    window.location.replace(u.toString());
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('forceRefresh');
    if (btn) btn.addEventListener('click', hardRefresh);
  });

  // SW
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js?v='+(window.APP_VERSION||'v'));
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              reg.active?.postMessage?.('SKIP_WAITING');
              setTimeout(() => window.location.reload(), 300);
            }
          });
        });
        setTimeout(() => reg.update().catch(()=>{}), 2000);
      } catch(e){}
    });
  }

  load();
})();
