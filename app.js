// app.js (v3.5.6) — akordeon bez animacji, WIBOR = history[0]

function getCSS(property){
  return getComputedStyle(document.documentElement).getPropertyValue(property) || '#ffffff';
}

(function(){
  const id   = s => document.getElementById(s);
  const NBSP = '\u00A0';
  const PLN  = v => (v==null?'-':Number(v).toFixed(2)+NBSP+'zł');
  const monthsPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  let LAST_DATA = null;
  const RENDERED = { progress:false, pie:false, wibor:false, fra:false };
  const CHARTS = {};

  function makeChart(canvasId, config){
    const cvs = document.getElementById(canvasId);
    if(!cvs) return null;
    try{ if(CHARTS[canvasId]) CHARTS[canvasId].destroy(); CHARTS[canvasId] = new Chart(cvs, config); return CHARTS[canvasId]; }
    catch(e){ console.warn('Chart error for', canvasId, e); return null; }
  }

  function ratyWord(n){
    n = Math.abs(Math.floor(n||0));
    const last = n%10, last2 = n%100;
    if(n===1) return 'rata';
    if(last>=2 && last<=4 && !(last2>=12 && last2<=14)) return 'raty';
    return 'rat';
  }

  function abortableFetch(url, ms=12000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    return { promise: fetch(url, {cache:'no-store', signal:ctrl.signal}), cancel:()=>clearTimeout(t) };
  }

  async function fetchJson(url){
    const u = new URL(url);
    u.searchParams.set('_t', Date.now()); // cache-buster
    const {promise, cancel} = abortableFetch(u.toString(), 12000);
    const r = await promise; cancel();
    if(!r.ok) throw new Error('HTTP '+r.status);
    const txt = await r.text();
    try{ return JSON.parse(txt); }
    catch(e){ throw new Error('Niepoprawny JSON: '+txt.slice(0,200)+'…'); }
  }

  async function load(){
    showError(null);
    id('asOf').textContent = 'Ładowanie…';
    try{
      const data = await fetchJson(window.RAPORT_ENDPOINT);
      LAST_DATA = data;
      renderKPI(data);
      setupAccordions();
    }catch(e){
      showError('Nie udało się pobrać raportu: '+e.message);
      console.error(e);
    }
  }

  function showError(msg){
    const box = id('errorBox'), btn = id('retryBtn');
    if(!msg){ box.style.display='none'; btn.style.display='none'; return; }
    box.style.display='block'; box.textContent = msg;
    btn.style.display='inline-block'; btn.onclick = load;
  }

  // ===== KPI =====
  function renderKPI(data){
    id('asOf').textContent = 'Stan na ' + (data.asOf || '—');

    // WIBOR = najnowszy odczyt z historii
    const latestFromHistory = Array.isArray(data.history) && data.history[0] ? Number(data.history[0][1]) : null;
    const wibor = latestFromHistory ?? num(data.wibor3m);

    id('wibor').textContent = wibor!=null ? wibor.toFixed(2)+'%' : '—';
    id('curr').textContent  = PLN(num(data.currentInstallment));
    id('new').textContent   = PLN(num(data.newInstallment));

    const diff = (num(data.newInstallment)||0) - (num(data.currentInstallment)||0);
    const d = id('diff');
    d.textContent = (diff>0?'▲ +':'▼ ')+Math.abs(diff).toFixed(2)+NBSP+'zł';
    d.className = 'val nowrap value ' + (diff>0?'up':'down');

    const monthsRemaining = num(data.monthsRemaining)||0;
    if(monthsRe

