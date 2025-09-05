
(function(){
  const id = s => document.getElementById(s);
  const NBSP = '\u00A0';
  const PLN = v => (v==null?'-':(Number(v).toFixed(2) + NBSP + 'zł'));
  const monthsPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  function ratyWord(n){
    n = Math.abs(Math.floor(n));
    const last = n % 10, last2 = n % 100;
    if (n === 1) return 'rata';
    if (last>=2 && last<=4 && !(last2>=12 && last2<=14)) return 'raty';
    return 'rat';
  }

  async function load(){
    let data=null;
    try{ const r=await fetch(window.RAPORT_ENDPOINT,{cache:'no-store'}); if(r.ok) data=await r.json(); }catch(_){}
    if(!data){ id('asOf').textContent='Błąd pobierania danych'; return; }

    // Header + KPI
    id('asOf').textContent = 'Stan na ' + (data.asOf||'—');
    id('wibor').textContent = (data.wibor3m!=null?Number(data.wibor3m).toFixed(2)+'%':'—');
    id('curr').textContent  = PLN(data.currentInstallment);
    id('new').textContent   = PLN(data.newInstallment);
    const diff = Number(data.newInstallment) - Number(data.currentInstallment);
    const up = diff > 0;
    id('diff').textContent = (up ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + NBSP + 'zł';
    id('diff').className = 'value nowrap ' + (up ? 'up' : 'down');

    // Remaining installments card
    const monthsRemaining = Number(data.monthsRemaining || data.months || 0);
    if (monthsRemaining > 0){
      id('raty').textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      id('ratySub').textContent = 'ostatnia rata: ' + monthsPL[last.getMonth()] + ' ' + last.getFullYear();
    } else {
      id('raty').textContent = '—'; id('ratySub').textContent = '—';
    }

    // Progress bar
    const pct = Math.max(0, Math.min(100, Number(data.capitalPaidPct||0)));
    id('bar').style.width = pct.toFixed(1)+'%';
    id('barLabel').textContent = pct.toFixed(1)+'%';
    id('init').textContent = PLN(data.initialLoan);
    id('paid').textContent = PLN(data.capitalPaid);
    id('rem').textContent  = PLN(data.remainingLoan);
    id('pct').textContent  = pct.toFixed(1)+'%';

    // Charts + tables
    drawPie(data.installmentParts?.interest||0, data.installmentParts?.principal||0);
    renderHistoryAndChart(data.history||[]);
    renderFra(data.fraProjections||[]);
  }

  function renderHistoryAndChart(rows){
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
  }

  function renderFra(rows){
    const wrap = id('fraTableWrap');
    if(!rows.length){ wrap.innerHTML = '<div class="muted center">Brak prognoz FRA.</div>'; return; }
    let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    for(const r of rows){
      const label=r[0], val=Number(r[1]||0), ch=Number(r[2]||0);
      const cls = ch<0?'down':(ch>0?'up':'');
      const sym = ch<0?'▼':(ch>0?'▲':'▬');
      html += `<tr>
        <td>${label}</td>
        <td><b class="nowrap">${val.toFixed(2)}${'\u00A0'}zł</b></td>
        <td class="nowrap ${cls}" style="font-weight:800">${sym} ${Math.abs(ch).toFixed(2)}${'\u00A0'}zł</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;

    const labels = rows.map(r=>r[0]);
    const values = rows.map(r=>Number(r[1]||0));
    const ctx = document.getElementById('fraChart');
    new Chart(ctx, { type:'line', data:{ labels, datasets:[{ data:values, tension:.35, fill:true, borderWidth:2, borderColor:'#60a5fa', pointRadius:3, backgroundColor:'rgba(96,165,250,.15)'}]},
      options:{ plugins:{legend:{display:false}}, scales:{ x:{ ticks:{color:getCSS('--muted')}, grid:{display:false}}, y:{ ticks:{color:getCSS('--muted')}, grid:{color:'rgba(100,116,139,.15)'}} } });
  }

  function drawPie(interest, principal){
    const ctx = document.getElementById('pieChart');
    new Chart(ctx, { type:'doughnut', data:{ labels:['Odsetki','Kapitał'], datasets:[{ data:[interest, principal], borderWidth:0, backgroundColor:['#3b82f6','#93c5fd'] }]},
      options:{ plugins:{ legend:{ display:true, labels:{ color:getCSS('--text') } } }, cutout:'60%', responsive:true, maintainAspectRatio:false } });
    id('odsetki').textContent = PLN(interest);
    id('kapital').textContent = PLN(principal);
  }

  function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  load();
})();
