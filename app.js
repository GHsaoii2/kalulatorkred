// app.js (v3.5.4) — WIBOR = history[0] + akordeon z płynną animacją

function getCSS(property) {
  return getComputedStyle(document.documentElement).getPropertyValue(property) || '#ffffff';
}

(function () {
  const id   = (s) => document.getElementById(s);
  const NBSP = "\u00A0";
  const PLN  = (v) => (v == null ? "-" : Number(v).toFixed(2) + NBSP + "zł");
  const monthsPL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

  // stan globalny
  let LAST_DATA = null;
  const RENDERED = { progress:false, pie:false, wibor:false, fra:false };

  // rejestr wykresów
  const CHARTS = {};
  function makeChart(canvasId, config) {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return null;
    try {
      if (CHARTS[canvasId]) CHARTS[canvasId].destroy();
      CHARTS[canvasId] = new Chart(cvs, config);
      return CHARTS[canvasId];
    } catch (e) { console.warn("Chart error for", canvasId, e); return null; }
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
    const u = new URL(url);
    u.searchParams.set('_t', Date.now()); // cache-buster
    const { promise, cancel } = abortableFetch(u.toString(), 12000);
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
      renderKPI(data);      // KPI od razu
      setupAccordions();    // przełączniki
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

  // ===== KPI =====
  function renderKPI(data){
    id("asOf").textContent = "Stan na " + (data.asOf || "—");

    // WIBOR = ostatni odczyt z historii
    const latestFromHistory = Array.isArray(data.history) && data.history[0]
      ? Number(data.history[0][1])
      : null;
    const wibor = latestFromHistory ?? num(data.wibor3m);

    id("wibor").textContent = wibor != null ? wibor.toFixed(2) + "%" : "—";
    id("curr").textContent  = PLN(num(data.currentInstallment));
    id("new").textContent   = PLN(num(data.newInstallment));

    const diff = (num(data.newInstallment)||0) - (num(data.currentInstallment)||0);
    const diffEl = id("diff");
    diffEl.textContent = (diff>0?"▲ +":"▼ ") + Math.abs(diff).toFixed(2) + NBSP + "zł";
    diffEl.className = "value nowrap " + (diff>0?"up":"down");

    const monthsRemaining = num(data.monthsRemaining) || 0;
    if (monthsRemaining > 0) {
      id("raty").textContent = monthsRemaining + NBSP + ratyWord(monthsRemaining);
      const today = new Date();
      const last  = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, 1);
      id("ratySub").textContent = "ostatnia rata: " + monthsPL[last.getMonth()] + " " + last.getFullYear();
    } else { id("raty").textContent = "—"; id("ratySub").textContent = "—"; }
  }

  // ===== render sekcji =====
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
    id("odsetki").textContent = PLN(num(data.installmentParts?.interest)  || 0);
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

  // ===== akordeon =====
  function setupAccordions(){
    document.querySelectorAll('.acc-head').forEach(btn=>{
      const targetId = btn.dataset.target;
      const panel = id(targetId);

      btn.addEventListener('click', ()=>{
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", !isOpen);

        if (!isOpen) {
          panel.classList.add("open");
          if (LAST_DATA) {
            if (targetId === "acc-progress") renderProgress(LAST_DATA);
            if (targetId === "acc-pie")      renderPie(LAST_DATA);
            if (targetId === "acc-wibor")    renderWibor(LAST_DATA);
            if (targetId === "acc-fra")      renderFra(LAST_DATA);
          }
        } else {
          panel.classList.remove("open");
        }
      });
    });
  }

  // ===== helpery =====
  function num(x){ const n = Number(x); return isNaN(n)?null:n; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // ===== wykresy =====
  function safePie(interest, principal){
    try{
      const ctx = document.getElementById('pieChart');
      makeChart('pieChart', {
        type:'doughnut',
        data:{
          labels:['Odsetki','Kapitał'],
          datasets:[{ data:[interest||0, principal||0], borderWidth:0, backgroundColor:['#3b82f6','#93c5fd'] }]
        },
        options:{ plugins:{ legend:{ display:true, labels:{ color:getCSS('--text') } } }, cutout:'60%', responsive:true, maintainAspectRatio:false }
      });
    }catch(e){ console.warn('Pie chart skipped:', e); }
  }

  function safeWiborChart(rows){ /* ... jak wcześniej (tabela + wykres) */ }
  function safeFraChart(rows){ /* ... jak wcześniej (tabela + wykres) */ }

  // ===== hard refresh =====
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

  // ===== SW =====
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
