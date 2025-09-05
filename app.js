
(function() {
  const PLN = v => (v==null?'-':(Number(v).toFixed(2) + ' zł'));
  const PCT = v => (v==null?'-':(Number(v).toFixed(1) + '%'));
  const id  = s => document.getElementById(s);

  async function load() {
    let data = null;
    try {
      const resp = await fetch(window.RAPORT_ENDPOINT, { cache: 'no-store' });
      if (resp.ok) data = await resp.json();
    } catch (e) { console.warn('Fetch error:', e); }
    if (!data) { id('asOf').textContent = 'Błąd pobierania danych'; return; }

    // KPI
    id('asOf').textContent = 'Stan na ' + (data.asOf || '—');
    id('wibor').textContent = (data.wibor3m != null ? Number(data.wibor3m).toFixed(2)+'%' : '—');
    id('curr').textContent  = PLN(data.currentInstallment);
    id('new').textContent   = PLN(data.newInstallment);
    const diff = Number(data.newInstallment) - Number(data.currentInstallment);
    const up = diff >= 0; id('diff').textContent = (up ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + ' zł';
    id('diff').style.color = up ? '#ef4444' : '#0ea5e9';

    // Gauge (radial)
    const pct = Math.max(0, Math.min(100, Number(data.capitalPaidPct || 0)));
    id('init').textContent = PLN(data.initialLoan);
    id('paid').textContent = PLN(data.capitalPaid);
    id('rem').textContent  = PLN(data.remainingLoan);
    id('pct').textContent  = PCT(pct);
    id('gaugeLabel').textContent = PCT(pct);
    const deg = (pct) * 3.6; // 100% -> 360deg
    id('gauge').style.background = `conic-gradient(var(--accent) ${deg}deg, var(--pill) 0)`;

    // Struktura raty
    drawPie(data.installmentParts?.interest || 0, data.installmentParts?.principal || 0);

    // WIBOR: ostatnie 5 dni
    renderHistoryAndChart(data.history || []);

    // FRA: line chart
    renderFra(data.fraProjections || []);
  }

  function renderHistoryAndChart(rows) {
    const wrap = id('histTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted center">Brak danych.</div>'; return; }
    const last5 = rows.slice(0, 5);
    let html = '<table><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of last5) {
      const d = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const sym = down ? '▼' : (up ? '▲' : '▬');
      const color = down ? '#0ea5e9' : (up ? '#ef4444' : '#64748b');
      html += `<tr>
        <td>${d}</td>
        <td><b>${val.toFixed(2)}%</b></td>
        <td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;

    const labels = last5.map(r => r[0]).reverse();
    const values = last5.map(r => Number(r[1]||0)).reverse();
    const ctx = document.getElementById('wiborChart');
    new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        data: values,
        tension: .35,
        fill: true,
        borderWidth: 2,
        borderColor: '#3b82f6',
        pointRadius: 3,
        pointHoverRadius: 5,
        backgroundColor: 'rgba(59,130,246,.15)'
      }]},
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getMutedColor() }, grid: { display: false } },
          y: { ticks: { color: getMutedColor() }, grid: { color: 'rgba(100,116,139,.15)' } }
        }
      }
    });
  }

  function renderFra(rows) {
    const wrap = id('fraTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted center">Brak prognoz FRA.</div>'; return; }

    // tabela
    let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const label = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const sym = down ? '▼' : (up ? '▲' : '▬');
      const color = down ? '#0ea5e9' : (up ? '#ef4444' : '#64748b');
      html += `<tr>
        <td>${label}</td>
        <td><b>${val.toFixed(2)} zł</b></td>
        <td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)} zł</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // wykres liniowy (styl jak WIBOR)
    const labels = rows.map(r => r[0]);
    const values = rows.map(r => Number(r[1]||0));
    const ctx = document.getElementById('fraChart');
    new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        data: values,
        tension: .35,
        fill: true,
        borderWidth: 2,
        borderColor: '#60a5fa',
        pointRadius: 3,
        pointHoverRadius: 5,
        backgroundColor: 'rgba(96,165,250,.15)'
      }]},
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getMutedColor() }, grid: { display:false } },
          y: { ticks: { color: getMutedColor() }, grid: { color: 'rgba(100,116,139,.15)' } }
        }
      }
    });
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
          backgroundColor: ['#3b82f6', '#93c5fd']
        }]
      },
      options: {
        plugins: { legend: { display: true, labels: { color: getTextColor() } } },
        cutout: '60%',
        responsive: true,
        maintainAspectRatio: false
      }
    });
    id('odsetki').textContent = PLN(interest);
    id('kapital').textContent = PLN(principal);
  }

  function getTextColor() { return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a'; }
  function getMutedColor() { return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#667085'; }

  load();
})();
