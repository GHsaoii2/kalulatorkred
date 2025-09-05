
(function() {
  const PLN = v => (v==null?'-':(Number(v).toFixed(2) + ' zł'));
  const PCT = v => (v==null?'-':(Number(v).toFixed(2) + '%'));
  const byId = id => document.getElementById(id);

  const demo = {
    asOf: "2025-09-05",
    wibor3m: 4.79,
    currentInstallment: 5402.34,
    newInstallment: 5173.10,
    installmentDiff: 5173.10 - 5402.34,
    initialLoan: 786376.00,
    remainingLoan: 781147.39,
    capitalPaid: 5228.61,
    capitalPaidPct: 0.7,
    installmentParts: { interest: 2310.12, principal: 2526.47 },
    history: [
      ["2025-09-05", 4.77, -0.02],
      ["2025-09-04", 4.79, -0.02],
      ["2025-09-03", 4.81, -0.01],
      ["2025-09-02", 4.82, 0.00],
      ["2025-09-01", 4.82, 0.00],
      ["2025-08-31", 4.82, 0.00],
      ["2025-08-30", 4.81, 0.00]
    ],
    fraProjections: [
      ["Styczeń 2026", 4998.54, -403.80],
      ["Kwiecień 2026", 4836.59, -565.75],
      ["Lipiec 2026", 4696.80, -705.54],
      ["Wrzesień 2026", 4696.80, -705.54]
    ]
  };

  async function load() {
    let data = demo;
    try {
      const endpoint = window.RAPORT_ENDPOINT;
      if (endpoint && endpoint.indexOf('YOUR-APPS-SCRIPT-WEBAPP-URL') === -1) {
        const resp = await fetch(endpoint, { cache: 'no-store' });
        if (resp.ok) data = await resp.json();
      }
    } catch (e) { console.warn('Fallback to demo data:', e); }

    // Fill header/KPI
    byId('asOf').textContent = 'Stan na ' + (data.asOf || '—');
    byId('wibor').textContent = PCT(data.wibor3m);
    byId('curr').textContent = PLN(data.currentInstallment);
    byId('new').textContent = PLN(data.newInstallment);
    const diff = Number(data.newInstallment) - Number(data.currentInstallment);
    const diffUp = diff >= 0;
    byId('diff').textContent = (diffUp ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + ' zł';
    byId('diff').style.color = diffUp ? '#e11d48' : '#059669';

    // Progress
    byId('init').textContent = PLN(data.initialLoan);
    byId('paid').textContent = PLN(data.capitalPaid);
    byId('rem').textContent  = PLN(data.remainingLoan);
    const pct = Number(data.capitalPaidPct);
    const pctTxt = isNaN(pct) ? '0%' : pct.toFixed(1) + '%';
    byId('pct').textContent = pctTxt;
    byId('bar').style.width = pctTxt;
    byId('bar').textContent = pctTxt;

    // Tables
    renderHistoryTable(data.history);
    renderFraTable(data.fraProjections);

    // Charts (optional images from your mailer; provide URLs or leave blank)
    // You can later pipe your PNGs from Apps Script, e.g. ?path=/api/charts/wibor
    byId('wiborChart').src = '';
    byId('fraChart').src = '';
    byId('pie').src = '';
    byId('odsetki').textContent = PLN(data.installmentParts?.interest);
    byId('kapital').textContent = PLN(data.installmentParts?.principal);
  }

  function renderHistoryTable(rows) {
    const wrap = document.getElementById('histTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak danych.</div>'; return; }
    let html = '<table><thead><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const d = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const color = down ? '#059669' : (up ? '#e11d48' : '#111827');
      const sym = down ? '▼' : (up ? '▲' : '▬');
      html += `<tr>
        <td>${d}</td>
        <td><b>${val.toFixed(2)}%</b></td>
        <td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function renderFraTable(rows) {
    const wrap = document.getElementById('fraTableWrap');
    if (!rows || !rows.length) { wrap.innerHTML = '<div class="muted">Brak prognoz FRA.</div>'; return; }
    let html = '<table><thead><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr></thead><tbody>';
    for (const r of rows) {
      const label = r[0], val = Number(r[1]||0), ch = Number(r[2]||0);
      const up = ch > 0, down = ch < 0;
      const color = down ? '#059669' : (up ? '#e11d48' : '#111827');
      const sym = down ? '▼' : (up ? '▲' : '▬');
      html += `<tr>
        <td>${label}</td>
        <td><b>${val.toFixed(2)} zł</b></td>
        <td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)} zł</td>
      </tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  load();
})();
