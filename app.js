
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
    id('diff').style.color = up ? '#ef4444' : '#0ea5e9';

    // Progress (bardziej widoczny)
    id('init').textContent = PLN(data.initialLoan);
    id('paid').textContent = PLN(data.capitalPaid);
    id('rem').textContent  = PLN(data.remainingLoan);
    const pct = Number(data.capitalPaidPct); const pctTxt = isNaN(pct) ? '0%' : pct.toFixed(1) + '%';
    id('pct').textContent = pctTxt; id('bar').style.width = pctTxt; id('bar').textContent = pctTxt;

    // Tables + Charts
    renderHistory(data.history);
    renderFra(data.fraProjections);

    drawPie(data.installmentParts?.interest || 0, data.installmentParts?.principal || 0);
  }

  function renderHistory(rows) {
    const wrap = id('histTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak danych.</div>'; return; }
    // bierzemy TYLKO ostatnie 5 dni
    const last5 = rows.slice(0, 5);
    // tabela
    let html = '<table><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of last5) {
      const d = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const sym = down ? '▼' : (up ? '▲' : '▬');
      const color = down ? '#059669' : (up ? '#ef4444' : '#64748b');
      html += `<tr>
        <td>${d}</td>
        <td><b>${val.toFixed(2)}%</b></td>
        <td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // wykres liniowy: rosnąca oś czasu (najstarszy -> najnowszy)
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
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak prognoz FRA.</div>'; return; }

    // tabela
    let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const label = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const sym = down ? '▼' : (up ? '▲' : '▬');
      const color = down ? '#059669' : (up ? '#ef4444' : '#64748b');
      html += `<tr>
        <td>${label}</td>
        <td><b>${val.toFixed(2)} zł</b></td>
        <td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)} zł</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // wykres liniowy (mniejszy, stylistycznie jak WIBOR)
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
        borderColor: '#60a5fa',          // jaśniejszy niebieski zamiast zielonego
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
          backgroundColor: ['#3b82f6', '#93c5fd'] // dwa odcienie niebieskiego
        }]
      },
      options: {
        plugins: { legend: { display: true, labels: { color: getTextColor() } } },
        cutout: '62%',
        responsive: true,
        maintainAspectRatio: false
      }
    });
    // kwoty pod wykresem
    id('odsetki').textContent = PLN(interest);
    id('kapital').textContent = PLN(principal);
  }

  function getTextColor() { return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a'; }
  function getMutedColor() { return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b'; }

  load();
})();
