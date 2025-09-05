// app.js (v3.5.8) — stałe wymiary canvas; WIBOR/FRA jako wykresy + tabele
function getCSS(p){return getComputedStyle(document.documentElement).getPropertyValue(p)||'#ffffff'}

(function(){
  const id=s=>document.getElementById(s);
  const NBSP='\u00A0', PLN=v=>v==null?'-':Number(v).toFixed(2)+NBSP+'zł';
  const monthsPL=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  let LAST_DATA=null;
  const RENDERED={progress:false,pie:false,wibor:false,fra:false};
  const CHARTS={};

  function makeChart(canvasId,config){
    const cvs=document.getElementById(canvasId); if(!cvs||typeof Chart==='undefined') return null;
    try{ if(CHARTS[canvasId]) CHARTS[canvasId].destroy(); CHARTS[canvasId]=new Chart(cvs,config); return CHARTS[canvasId]; }
    catch(e){ console.warn('Chart error', canvasId, e); return null; }
  }
  function ratyWord(n){n=Math.abs(Math.floor(n||0));const l=n%10,l2=n%100; if(n===1)return'rata'; if(l>=2&&l<=4&&!(l2>=12&&l2<=14))return'raty'; return'rat'}
  function num(x){const n=Number(x);return isNaN(n)?null:n}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function abortableFetch(url,ms=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return{promise:fetch(url,{cache:'no-store',signal:c.signal}),cancel:()=>clearTimeout(t)}}
  async function fetchJson(url){const u=new URL(url);u.searchParams.set('_v',window.APP_VERSION||'');u.searchParams.set('_t',Date.now());const {promise,cancel}=abortableFetch(u,12000);const r=await promise.catch(e=>{throw new Error('Fetch error: '+e.message)});cancel();if(!r.ok)throw new Error('HTTP '+r.status);const t=await r.text();try{return JSON.parse(t)}catch(e){throw new Error('Bad JSON: '+t.slice(0,180)+'…')}}
  function showError(msg){const b=id('errorBox'),btn=id('retryBtn');if(!msg){b.style.display='none';btn.style.display='none';return}b.style.display='block';b.textContent=msg;btn.style.display='inline-block';btn.onclick=load}

  async function load(){
    showError(null); id('asOf').textContent='Ładowanie…';
    try{const data=await fetchJson(window.RAPORT_ENDPOINT); LAST_DATA=data; renderKPI(data); setupAccordions();}
    catch(e){console.error(e);showError('Nie udało się pobrać raportu: '+e.message)}
  }

  function renderKPI(data){
    id('asOf').textContent='Stan na '+(data.asOf||'—');
    const wibor=Array.isArray(data.history)&&data.history[0]?Number(data.history[0][1]):num(data.wibor3m);
    id('wibor').textContent=wibor!=null? wibor.toFixed(2)+'%':'—';
    id('curr').textContent=PLN(num(data.currentInstallment));
    id('new').textContent =PLN(num(data.newInstallment));
    const diff=(num(data.newInstallment)||0)-(num(data.currentInstallment)||0);
    const d=id('diff'); d.textContent=(diff>0?'▲ +':'▼ ')+Math.abs(diff).toFixed(2)+NBSP+'zł'; d.className='val nowrap value '+(diff>0?'up':'down');

    const monthsRemaining=num(data.monthsRemaining)||0;
    if(monthsRemaining>0){ id('raty').textContent=monthsRemaining+NBSP+ratyWord(monthsRemaining); const today=new Date(); const last=new Date(today.getFullYear(),today.getMonth()+monthsRemaining,1); id('ratySub').textContent='ostatnia rata: '+monthsPL[last.getMonth()]+' '+last.getFullYear(); } else { id('raty').textContent='—'; id('ratySub').textContent='—'}
  }

  function renderProgress(data){
    if(RENDERED.progress) return;
    const pct=clamp(num(data.capitalPaidPct)||0,0,100);
    id('bar').style.width=pct.toFixed(1)+'%';
    id('barLabel').textContent=pct.toFixed(1)+'%';
    id('init').textContent=PLN(num(data.initialLoan));
    id('paid').textContent=PLN(num(data.capitalPaid));
    id('rem').textContent =PLN(num(data.remainingLoan));
    RENDERED.progress=true;
  }

  function renderPie(data){
    if(RENDERED.pie) return;
    const interest=num(data.installmentParts?.interest)||0;
    const principal=num(data.installmentParts?.principal)||0;
    makeChart('pieChart',{
      type:'doughnut',
      data:{labels:['Odsetki','Kapitał'],datasets:[{data:[interest,principal],borderWidth:0,backgroundColor:['#3b82f6','#93c5fd']}]},
      options:{responsive:false,maintainAspectRatio:true,cutout:'60%',plugins:{legend:{labels:{color:getCSS('--text')}}}}
    });
    id('odsetki').textContent=PLN(interest);
    id('kapital').textContent=PLN(principal);
    RENDERED.pie=true;
  }

  function renderWibor(data){
    if(RENDERED.wibor) return;
    const rows=(data.history||[]).slice(0,5).reverse(); // do wykresu od najstarszego
    if(rows.length){
      const labels=rows.map(r=>r[0]);
      const values=rows.map(r=>Number(r[1]));
      makeChart('wiborChart',{type:'line',
        data:{labels,datasets:[{data:values,tension:.35,pointRadius:3,borderWidth:2}]},
        options:{responsive:false,maintainAspectRatio:true,
          plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:getCSS('--text')}},y:{ticks:{color:getCSS('--text')}}}
        }
      });
    }
    // tabela (pełna historia)
    safeWiborTable(data.history||[]);
    RENDERED.wibor=true;
  }

  function renderFra(data){
    if(RENDERED.fra) return;
    const rows=data.fraProjections||[];
    if(rows.length){
      const labels=rows.map(r=>r[0]);
      const values=rows.map(r=>Number(r[1]));
      makeChart('fraChart',{type:'line',
        data:{labels,datasets:[{data:values,tension:.35,pointRadius:3,borderWidth:2}]},
        options:{responsive:false,maintainAspectRatio:true,
          plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:getCSS('--text')}},y:{ticks:{color:getCSS('--text')}}}
        }
      });
    }
    safeFraTable(rows);
    RENDERED.fra=true;
  }

  function safeWiborTable(rows){
    const wrap=id('histTableWrap');
    if(!rows.length){wrap.innerHTML='<p>Brak danych historycznych</p>';return;}
    let html='<table class="tbl"><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr>';
    rows.forEach(r=>{
      const d=r[0], val=Number(r[1]), ch=Number(r[2]);
      const sym = ch>0?'▲':(ch<0?'▼':'▬');
      const color = ch<0?'#2a9d8f':(ch>0?'#e63946':'#9ca3af');
      html+=`<tr><td>${d}</td><td><b>${val.toFixed(2)}%</b></td><td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)}</td></tr>`;
    });
    html+='</table>'; wrap.innerHTML=html;
  }
  function safeFraTable(rows){
    const wrap=id('fraTableWrap');
    if(!rows.length){wrap.innerHTML='<p>Brak prognoz FRA</p>';return;}
    let html='<table class="tbl"><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr>';
    rows.forEach(r=>{
      const label=r[0], val=Number(r[1]), ch=Number(r[2]);
      const sym = ch>0?'▲':(ch<0?'▼':'▬');
      const color = ch<0?'#2a9d8f':(ch>0?'#e63946':'#9ca3af');
      html+=`<tr><td>${label}</td><td><b>${val.toFixed(2)}&nbsp;zł</b></td><td style="color:${color};font-weight:600">${sym} ${Math.abs(ch).toFixed(2)}&nbsp;zł</td></tr>`;
    });
    html+='</table>'; wrap.innerHTML=html;
  }

  function setupAccordions(){
    document.querySelectorAll('.acc-head').forEach(btn=>{
      const targetId=btn.dataset.target; const panel=id(targetId);
      btn.addEventListener('click', ()=>{
        const open=btn.getAttribute('aria-expanded')==='true';
        btn.setAttribute('aria-expanded', !open);
        if(!open){
          panel.classList.add('open');
          if(LAST_DATA){
            if(targetId==='acc-progress') renderProgress(LAST_DATA);
            if(targetId==='acc-pie')      renderPie(LAST_DATA);
            if(targetId==='acc-wibor')    renderWibor(LAST_DATA);
            if(targetId==='acc-fra')      renderFra(LAST_DATA);
          }
        } else { panel.classList.remove('open'); }
      });
    });
  }

  if('serviceWorker' in navigator){
    window.addEventListener('load', async ()=>{
      try{
        const reg=await navigator.serviceWorker.register('./sw.js?v='+(window.APP_VERSION||'v'));
        reg.addEventListener('updatefound', ()=>{
          const nw=reg.installing; nw&&nw.addEventListener('statechange', ()=>{
            if(nw.state==='installed' && navigator.serviceWorker.controller){
              reg.active?.postMessage?.('SKIP_WAITING'); setTimeout(()=>window.location.reload(),300);
            }
          });
        });
        setTimeout(()=>reg.update().catch(()=>{}),1500);
      }catch(e){console.warn('SW register error',e)}
    });
  }

  load();
})();
