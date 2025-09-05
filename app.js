
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

  function safeWiborChart(rows){
    try{
      const wrap = id('histTableWrap');
      if(!rows.length){ wrap.innerHTML = '<div class="muted center">Brak danych.</div>'; return; }
      const last5 = rows.slice(0,5);
      let html = '<table><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
      for(const r of last5){
        const d=r[0], val=Number(r[1]||0), ch=Number(r[2]||0);
        const cls = ch<0?'down':(ch>0?'up':'');
        const sym = ch<0?'▼':(ch>0?'▲':'▬');
        html += `<tr>
          <td>${d}</td>
          <td><b class="nowrap">${val.toFixed(2)}%</b></td>
          <td class="nowrap ${cls}" style="font-weight:800">${sym} ${Math.abs(ch).toFixed(2)}</td>
        </tr>`;
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;

      const labels = last5.map(r=>r[0]).reverse();
      const values = last5.map(r=>Number(r[1]||0)).reverse();
      const ctx = document.getElementById('wiborChart');
      new Chart(ctx, { type:'line', data:{ labels, datasets:[{ data:values, tension:.35, fill:true, borderWidth:2, borderColor:'#3b82f6', pointRadius:3, backgroundColor:'rgba(59,130,246,.15)'}]},
        options:{ plugins:{legend:{display:false}}, scales:{ x:{ ticks:{color:getCSS('--muted')}, grid:{display:false}}, y:{ ticks:{color:getCSS('--muted')}, grid:{color:'rgba(100,116,139,.15)'}} } });
    }catch(e){ console.warn('WIBOR chart skipped:', e); }
  }

  function safeFraChart(rows){
    try{
      const wrap = id('fraTableWrap');
      if(!rows.length){ wrap.innerHTML = '<div class="muted center">Brak prognoz FRA.</div>'; return; }
      let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
      for(const r of rows){
        const label=r[0], val=Number(r[1]||0), ch=Number(r[2]||0);
        const cls = ch<0?'down':(ch>0?'up':'');
        const sym = ch<0?'▼':(ch>0?'▲':'▬');
        html += `<tr>
          <td>${label}</td>
          <td><b class="nowrap">${val.toFixed(2)}${'\\u00A0'}zł</b></td>
          <td class="nowrap ${cls}" style="font-weight:800">${sym} ${Math.abs(ch).toFixed(2)}${'\\u00A0'}zł</td>
        </tr>`;
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;

      const labels = rows.map(r=>r[0]);
      const values = rows.map(r=>Number(r[1]||0));
      const ctx = document.getElementById('fraChart');
      new Chart(ctx, { type:'line', data:{ labels, datasets:[{ data:values, tension:.35, fill:true, borderWidth:2, borderColor:'#60a5fa', pointRadius:3, backgroundColor:'rgba(96,165,250,.15)'}]},
        options:{ plugins:{legend:{display:false}}, scales:{ x:{ ticks:{color:getCSS('--muted')}, grid:{display:false}}, y:{ ticks:{color:getCSS('--muted')}, grid:{color:'rgba(100,116,139,.15)'}} } });
    }catch(e){ console.warn('FRA chart skipped:', e); }
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