// app.js (v3.5.6) - kompletna wersja
function getCSS(property) {
  return getComputedStyle(document.documentElement).getPropertyValue(property) || '#ffffff';
}

(function(){
  const id = s => document.getElementById(s);
  const NBSP = '\u00A0';
  const PLN = v => (v == null ? '-' : Number(v).toFixed(2) + NBSP + 'zł');
  const monthsPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  
  let LAST_DATA = null;
  const RENDERED = { progress: false, pie: false, wibor: false, fra: false };
  const CHARTS = {};

  function makeChart(canvasId, config) {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return null;
    try {
      if (CHARTS[canvasId]) CHARTS[canvasId].destroy();
      CHARTS[canvasId] = new Chart(cvs, config);
      return CHARTS[canvasId];
    } catch(e) {
      console.warn('Chart error for', canvasId, e);
      return null;
    }
  }

  function ratyWord(n) {
    n = Math.abs(Math.floor(n || 0));
    const last = n % 10, last2 = n % 100;
    if (n === 1) return 'rata';
    if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return 'raty';
    return 'rat';
  }

  function abortableFetch(url, ms = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return { 
      promise: fetch(url, { cache: 'no-store', signal: ctrl.signal }), 
      cancel: () => clearTimeout(t) 
    };
  }

  async function fetchJson(url) {
    const u = new URL(url);
    u.searchParams.set('_t', Date.now());
    const { promise, cancel } = abortableFetch(u.toString(), 12000);
    const r = await promise;
    cancel();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try {
      return JSON.parse(txt);
    } catch(e) {
      throw new Error('Niepoprawny JSON: ' + txt.slice(0, 200) + '…');
    }
  }

  async function load() {
    showError(null);
    id('asOf').textContent = 'Ładowanie…';
    try {
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      LAST_DATA = data;
      renderKPI(data);
      setupAccordions();
    } catch(e) {
      showError('Nie udało się pobrać raportu: ' + e.message);
      console.error('Load error:', e);
    }
  }

  function showError(msg) {
    const box = id('errorBox');
    const btn = id('retryBtn');
    if (!msg) {
      box.style.display = 'none';
      btn.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.textContent = msg;
    btn.style.display = 'inline-block';
    btn.onclick = load;
  }

  function renderKPI(data) {
    id('asOf').textContent = 'Stan na ' + (data.asOf || '—');
    
    // WIBOR z najnowszego odczytu
    const latestFromHistory = Array.isArray(data.history) && data.history[0] ? 
      Number(data.history[0][1]) : null;
    const wibor = latestFromHistory ?? Number(data.wibor3m);
    id('wibor').textContent = wibor ? wibor.toFixed(2) + '%' : '—';
    
    id('curr').textContent = PLN(Number(data.currentInstallment));
    id('new').textContent = PLN(Number(data.newInstallment));
    
    const diff = (Number(data.newInstallment) || 0) - (Number(data.currentInstallment) || 0);
    const d = id('diff');
    d.textContent = (diff > 0 ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + NBSP + 'zł';
    d.className = 'val nowrap value ' + (diff > 0 ? 'up' : 'down');
    
    const monthsRemaining = Number(data.monthsRemaining) || 0;
    if (monthsRemaining > 0) {
      id('raty').textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      id('ratySub').textContent = 'ostatnia rata: ' + monthsPL[last.getMonth()] + ' ' + last.getFullYear();
    } else {
      id('raty').textContent = '—';
      id('ratySub').textContent = '—';
    }
  }

  function setupAccordions() {
    if (!LAST_DATA) return;
    
    // Setup accordion click handlers
    document.querySelectorAll('.acc-head').forEach(button => {
      button.onclick = () => {
        const target = button.getAttribute('data-target');
        const body = document.getElementById(target);
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        
        if (isOpen) {
          body.classList.remove('open');
          button.setAttribute('aria-expanded', 'false');
        } else {
          body.classList.add('open');
          button.setAttribute('aria-expanded', 'true');
          
          // Render content based on section
          if (target === 'acc-progress' && !RENDERED.progress) {
            renderProgress();
            RENDERED.progress = true;
          } else if (target === 'acc-pie' && !RENDERED.pie) {
            renderPieChart();
            RENDERED.pie = true;
          } else if (target === 'acc-wibor' && !RENDERED.wibor) {
            renderWiborTable();
            RENDERED.wibor = true;
          } else if (target === 'acc-fra' && !RENDERED.fra) {
            renderFraTable();
            RENDERED.fra = true;
          }
        }
      };
    });
  }

  function renderProgress() {
    const pct = Math.max(0, Math.min(100, Number(LAST_DATA.capitalPaidPct) || 0));
    id('bar').style.width = pct.toFixed(1) + '%';
    id('barLabel').textContent = pct.toFixed(1) + '%';
    id('init').textContent = PLN(Number(LAST_DATA.initialLoan));
    id('paid').textContent = PLN(Number(LAST_DATA.capitalPaid));
    id('rem').textContent = PLN(Number(LAST_DATA.remainingLoan));
  }

  function renderPieChart() {
    const interest = Number(LAST_DATA.installmentParts?.interest) || 0;
    const principal = Number(LAST_DATA.installmentParts?.principal) || 0;
    
    makeChart('pieChart', {
      type: 'doughnut',
      data: {
        labels: ['Odsetki', 'Kapitał'],
        datasets: [{
          data: [interest, principal],
          backgroundColor: ['#3b82f6', '#93c5fd'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { 
          legend: { 
            display: true, 
            labels: { color: '#e2e6e9' } 
          } 
        },
        cutout: '60%',
        responsive: true,
        maintainAspectRatio: false
      }
    });
    
    id('odsetki').textContent = PLN(interest);
    id('kapital').textContent = PLN(principal);
  }

  function renderWiborTable() {
    const wrap = id('histTableWrap');
    const rows = LAST_DATA.history || [];
    if (!Array.isArray(rows) || !rows.length) {
      wrap.innerHTML = '<p>Brak danych historycznych</p>';
      return;
    }

    let html = '<table class="tbl"><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr>';
    rows.slice(0, 10).forEach(row => {
      const d = row[0];
      const val = Number(row[1]);
      const ch = Number(row[2]);
      const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
      const color = ch < 0 ? '#40c09e' : (ch > 0 ? '#e65050' : '#e2e6e9');
      html += '<tr>';
      html += '<td>' + d + '</td>';
      html += '<td><b>' + val.toFixed(2) + '%</b></td>';
      html += '<td style="color:' + color + ';font-weight:600">' + sym + ' ' + Math.abs(ch).toFixed(2) + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    wrap.innerHTML = html;
  }

  function renderFraTable() {
    const wrap = id('fraTableWrap');
    const rows = LAST_DATA.fraProjections || [];
    if (!Array.isArray(rows) || !rows.length) {
      wrap.innerHTML = '<p>Brak prognoz FRA</p>';
      return;
    }

    let html = '<table class="tbl"><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr>';
    rows.forEach(r => {
      const label = r[0];
      const val = Number(r[1] || 0);
      const ch = Number(r[2] || 0);
      const sym = ch > 0 ? '▲' : (ch < 0 ? '▼' : '▬');
      const color = ch < 0 ? '#40c09e' : (ch > 0 ? '#e65050' : '#e2e6e9');
      html += '<tr>';
      html += '<td>' + label + '</td>';
      html += '<td><b>' + val.toFixed(2) + ' zł</b></td>';
      html += '<td style="color:' + color + ';font-weight:600">' + sym + ' ' + Math.abs(ch).toFixed(2) + ' zł</td>';
      html += '</tr>';
    });
    html += '</table>';
    wrap.innerHTML = html;
  }

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js?v=v3.5.6');
      } catch(e) {
        console.error('SW registration failed:', e);
      }
    });
  }

  // Start the app
  load();
})();
