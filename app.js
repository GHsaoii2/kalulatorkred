
(function() {
  const PLN = v => (v==null?'-':(Number(v).toFixed(2) + ' zł'));
  const PCT = v => (v==null?'-':(Number(v).toFixed(2) + '%'));
  const id  = s => document.getElementById(s);

  async function load() {
    let data = null;
    try {
      const resp = await fetch(window.RAPORT_ENDPOINT, { cache: 'no-store' });
      if (resp.ok) data = await resp.json();
    } catch (e) { console.warn('Fetch error:', e); }
    if (!data) { id('asOf').textContent = 'Błąd pobierania danych'; return; }

    // Header/KPI
    id('asOf').textContent = 'Stan na ' + (data.asOf || '—');
    id('wibor').textContent = PCT(data.wibor3m);
    id('curr').textContent  = PLN(data.currentInstallment);
    id('new').textContent   = PLN(data.newInstallment);
    const diff = Number(data.newInstallment) - Number(data.currentInstallment);
    const up = diff >= 0; id('diff').textContent = (up ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + ' zł';
    id('diff').style.color = up ? '#ef4444' : '#10b981';

    // Progress
    id('init').textContent = PLN(data.initialLoan);
    id('paid').textContent = PLN(data.capitalPaid);
    id('rem').textContent  = PLN(data.remainingLoan);
    const pct = Number(data.capitalPaidPct); const pctTxt = isNaN(pct) ? '0%' : pct.toFixed(1) + '%';
    id('pct').textContent = pctTxt; id('bar').style.width = pctTxt; id('bar').textContent = pctTxt;

    // Tables
    renderHistoryTable(data.history);
    renderFraTable(data.fraProjections);

    // Charts
    drawPie(data.installmentParts?.interest || 0, data.installmentParts?.principal || 0);
    drawWibor(data.history || []);
    drawFra(data.fraProjections || []);
  }

  function renderHistoryTable(rows) {
    const wrap = id('histTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak danych.</div>'; return; }
    let html = '<table><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const d = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const cls = down ? 'chip chip-down' : (up ? 'chip chip-up' : 'chip');
      const sym = down ? '▼' : (up ? '▲' : '▬');
      html += `<tr>
        <td>${d}</td>
        <td><b>${val.toFixed(2)}%</b></td>
        <td><span class="${cls}">${sym} ${Math.abs(ch).toFixed(2)}</span></td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function renderFraTable(rows) {
    const wrap = id('fraTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak prognoz FRA.</div>'; return; }
    let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const label = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const cls = down ? 'chip chip-down' : (up ? 'chip chip-up' : 'chip');
      const sym = down ? '▼' : (up ? '▲' : '▬');
      html += `<tr>
        <td>${label}</td>
        <td><b>${val.toFixed(2)} zł</b></td>
        <td><span class="${cls}">${sym} ${Math.abs(ch).toFixed(2)} zł</span></td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function drawPie(interest, principal) {
    const ctx = document.getElementById('pieChart');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Odsetki', 'Kapitał'],
        datasets: [{
          data: [interest, principal],
          borderWidth: 0,
          backgroundColor: ['#4f9cf9', '#22c55e']
        }]
      },
      options: {
        plugins: { legend: { display: true, labels: { color: getTextColor() } } },
        cutout: '58%',
        responsive: true,
        maintainAspectRatio: false
      }
    });
    ctx.parentElement.style.minHeight = '240px';
  }

  function drawWibor(rows) {
    const labels = rows.map(r => r[0]).reverse();
    const values = rows.map(r => Number(r[1]||0)).reverse();
    const ctx = document.getElementById('wiborChart');
    new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, tension:.35, fill: true, borderWidth:2, borderColor:'#4f9cf9',
        pointRadius: 2, pointHoverRadius: 4, backgroundColor:'rgba(79,156,249,.12)'}] },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getMutedColor() } , grid: { color: 'rgba(128,128,128,.12)' } },
          y: { ticks: { color: getMutedColor() }, grid: { color: 'rgba(128,128,128,.12)' } }
        }
      }
    });
  }

  function drawFra(rows) {
    const labels = rows.map(r => r[0]);
    const values = rows.map(r => Number(r[1]||0));
    const ctx = document.getElementById('fraChart');
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: '#22c55e' }] },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getMutedColor() } , grid: { display:false } },
          y: { ticks: { color: getMutedColor() }, grid: { color: 'rgba(128,128,128,.12)' } }
        }
      }
    });
  }

  function getTextColor() { return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e5e7eb'; }
  function getMutedColor() { return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#9ca3af'; }

  load();
})();
