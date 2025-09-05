// app.js (v3.5.2) — akordeon + lazy render sekcji

function getCSS(property) {
  return getComputedStyle(document.documentElement).getPropertyValue(property) || '#ffffff';
}

(function () {
  const id = (s) => document.getElementById(s);
  const NBSP = "\u00A0";
  const PLN = (v) => (v == null ? "-" : Number(v).toFixed(2) + NBSP + "zł");
  const monthsPL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

  // ostatnie dane i statusy renderów sekcji
  let LAST_DATA = null;
  const RENDERED = { progress:false, pie:false, wibor:false, fra:false };

  // Rejestr wykresów (by unikać dublowania)
  const CHARTS = {};
  function makeChart(canvasId, config) {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return null;
    try {
      if (CHARTS[canvasId]) CHARTS[canvasId].destroy();
      CHARTS[canvasId] = new Chart(cvs, config);
      return CHARTS[canvasId];
    } catch (e) {
      console.warn("Chart error for", canvasId, e);
      return null;
    }
  }

  function ratyWord(n) {
    n = Math.abs(Math.floor(n || 0));
    const last = n % 10, last2 = n % 100;
    if (n === 1) return "rata";
    if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return "raty";
    return "rat";
  }

  function abortableFetch(url, ms = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return { promise: fetch(url, { cache: "no-store", signal: ctrl.signal }), cancel: () => clearTimeout(t) };
  }

  async function fetchJson(url) {
    const { promise, cancel } = abortableFetch(url, 12000);
    const r = await promise; cancel();
    if (!r.ok) throw new Error("HTTP " + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch (e) { throw new Error("Niepoprawny JSON: " + txt.slice(0, 200) + "…"); }
  }

  async function load() {
    showError(null);
    id("asOf").textContent = "Ładowanie…";
    try {
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      LAST_DATA = data;
      renderKPI(data);      // tylko KPI od razu
      setupAccordions();    // podpinamy przełączniki
    } catch (e) {
      showError("Nie udało się pobrać raportu: " + e.message);
      console.error(e);
    }
  }

  function showError(msg) {
    const box = id("errorBox");
    const btn = id("retryBtn");
    if (!msg) { box.style.display = "none"; btn.style.display = "none"; return; }
    box.style.display = "block";
    const pad = box.querySelector(".pad");
    if (pad) pad.textContent = msg; else box.textContent = msg;
    btn.style.display = "inline-block";
    btn.onclick = load;
  }

  // ----- KPI + teksty bazowe -----
  function renderKPI(data){
    id("asOf").textContent = "Stan na " + (data.asOf || "—");

    const wibor = num(data.wibor3m);
    id("wibor").textContent = wibor != null ? wibor.toFixed(2) + "%" : "—";
    id("curr").textContent = PLN(num(data.currentInstallment));
    id("new").textContent  = PLN(num(data.newInstallment));

    const diff = (num(data.newInstallment)||0) - (num(data.currentInstallment)||0);
    const diffEl = id("diff");
    diffEl.textContent = (diff>0?"▲ +":"▼ ") + Math.abs(diff).toFixed(2) + NBSP + "zł";
    diffEl.className = "value nowrap " + (diff>0?"up":"down");

    const monthsRemaining = num(data.monthsRemaining) || 0;
    if (monthsRemaining > 0) {
      id("raty").textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      id("ratySub").textContent = "ostatnia rata: " + monthsPL[last.getMonth()] + " " + last.getFullYear();
    } else { id("raty").textContent = "—"; id("ratySub").textContent = "—"; }
  }

  // ----- Render poszczególnych sekcji (na żądanie) -----
  function renderProgress(data){
    if (RENDERED.progress) return;
    const pct = clamp(num(data.capitalPaidPct)||0, 0, 100);
    id("bar").style.width = pct.toFixed(1) + "%";
    id("barLabel").textContent = pct.toFixed(1) + "%";
    id("init").textContent = PLN(num(data.initialLoan));
    id("paid").textContent = PLN(num(data.capitalPaid));
    id("rem").textContent  = PLN(num(data.remainingLoan));
    id("pct").textContent  = pct.toFixed(1) + "%";
    RENDERED.progress = true;
  }

  function renderPie(data){
    if (RENDERED.pie) return;
    safePie(num(data.installmentParts?.interest), num(data.installmentParts?.principal));
    id("odsetki").textContent = PLN(num(data.installmentParts?.interest) || 0);
    id("kapital").textContent = PLN(num(data.installmentParts?.principal) || 0);
    RENDERED.pie = true;
  }

  function renderWibor(data){
    if (RENDERED.wibor) return;
    safeWiborChart(data.history||[]);
    RENDERED.wibor = true;
  }

  function renderFra(data){
    if (RENDERED.fra) return;
    safeFraChart(data.fraProjections||[]);
    RENDERED.fra = true;
  }

  // ----- Akordeon -----
  function setupAccordions(){
    document.querySelectorAll('.acc-head').forEach(btn=>{
      const targetId = btn.dataset.target;
      const panel = id(targetId);
      const expand = (open) => {
        btn.setAttribute('aria-expanded', String(open));
        panel.classList.toggle('open', open);
        if (open) {
          // Lazy render
          if (targetId==='acc-progress') renderProgress(LAST_DATA);
          if (targetId==='acc-pie')      renderPie(LAST_DATA);
          if (targetId==='acc-wibor')    renderWibor(LAST_DATA);
          if (targetId==='acc-fra')      renderFra(LAST_DATA);
          // po otwarciu można zawołać resize wykresów
          setTimeout(()=>Object.values(CHARTS).forEach(ch=>ch?.resize?.()), 50);
        }
      };
      // domyślnie zamknięte
      btn.setAttribute('aria-expanded','false');
      panel.classList.remove('open');

      btn.addEventListener('click', ()=>{
        const isOpen = btn.getAttribute('aria-expanded')==='true';
        expand(!isOpen);
      });
    });
  }

  // ----- Charts & helpers -----
  function num(x){ const n = Number(x); return isNaN(n)?null:n; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function safePie(interest, principal) {
    try {
      makeChart("pieChart", {
        type: "doughnut",
        data: {
          labels: ["Odsetki", "Kapitał"],
          datasets: [{ data: [interest||0, principal||0], backgroundColor: ["#3b82f6","#93c5fd"], borderWidth: 0 }]
        },
        options: {
          plugins:{ legend:{ display:true, labels:{ color:getCSS("--text") || "#e2e6e9" } } },
          cutout: "60%", responsive: true, maintainAspectRatio: false
        }
      });
    } catch (e) { console.warn("Pie chart skipped:", e); }
  }

  function safeWiborChart(rows) {
    try {
      const wrap = id("histTableWrap");
      if (!Array.isArray(rows) || !rows.length) { wrap.innerHTML = "<p>Brak danych historycznych</p>"; return; }

      const last5 = rows.slice(0,5).reverse();
      const labels = last5.map(r=>r[0]);
      const values = last5.map(r=>Number(r[1]||0));

      makeChart("wiborChart", {
        type:"line",
        data:{ labels, datasets:[{ data:values, tension:.35, fill:true, borderWidth:2, borderColor:"#3b82f6", pointRadius:3, backgroundColor:"rgba(59,130,246,.15)"}]},
        options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{color:"#94a3b8"}}, y:{grid:{color:"rgba(100,116,139,.15)"},ticks:{color:"#94a3b8"}} }, responsive:true, maintainAspectRatio:false }
      });

      const table5 = rows.slice(0,5);
      let html = '<table class="tbl"><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr>';
      table5.forEach(row=>{
        const d=row[0], val=Number(row[1]), ch=Number(row[2]);
        const sym = ch>0 ? "▲" : ch<0 ? "▼" : "▬";
        const color = ch<0 ? "#40c09e" : ch>0 ? "#ef4444" : "#e2e6e9";
        html += `<tr><td>${d}</td><td><b>${val.toFixed(2)}%</b></td><td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)}</td></tr>`;
      });
      html += "</table>";
      wrap.innerHTML = html;
    } catch (e) { console.warn("WIBOR chart error:", e); }
  }

  function safeFraChart(rows) {
    try {
      const wrap = id("fraTableWrap");
      if (!Array.isArray(rows) || !rows.length) { wrap.innerHTML = "<p>Brak prognoz FRA</p>"; return; }

      const labels = rows.map(r=>r[0]);
      const values = rows.map(r=>Number(r[1]||0));

      makeChart("fraChart", {
        type:"line",
        data:{ labels, datasets:[{ data:values, tension:.35, fill:true, borderWidth:2, borderColor:"#60a5fa", pointRadius:3, backgroundColor:"rgba(96,165,250,.15)"}]},
        options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{color:"#94a3b8"}}, y:{grid:{color:"rgba(100,116,139,.15)"},ticks:{color:"#94a3b8"}} }, responsive:true, maintainAspectRatio:false }
      });

      let html = '<table class="tbl"><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr>';
      rows.forEach(r=>{
        const label=r[0], val=Number(r[1]||0), ch=Number(r[2]||0);
        const sym = ch>0 ? "▲" : ch<0 ? "▼" : "▬";
        const color = ch<0 ? "#40c09e" : ch>0 ? "#ef4444" : "#e2e6e9";
        html += `<tr><td>${label}</td><td><b>${val.toFixed(2)}&nbsp;zł</b></td><td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)}&nbsp;zł</td></tr>`;
      });
      html += "</table>";
      wrap.innerHTML = html;
    } catch (e) { console.warn("FRA chart error:", e); }
  }

  // Hard refresh
  async function hardRefresh() {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {}
    const u = new URL(window.location.href);
    u.searchParams.set("v", Date.now());
    window.location.replace(u.toString());
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("forceRefresh");
    if (btn) btn.addEventListener("click", hardRefresh);
  });

  // SW auto-update
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("./sw.js?v=" + (window.APP_VERSION || "v"));
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              reg.active?.postMessage?.("SKIP_WAITING");
              setTimeout(() => window.location.reload(), 300);
            }
          });
        });
        setTimeout(() => reg.update().catch(() => {}), 2000);
      } catch (e) {}
    });
  }

  load();
})();
