// app.js (v3.5.9)
function getCSS(p){return getComputedStyle(document.documentElement).getPropertyValue(p)||'#ffffff'}

(function(){
  const id=s=>document.getElementById(s);
  const NBSP='\u00A0', PLN=v=>v==null?'-':Number(v).toFixed(2)+NBSP+'zł';
  const monthsPL=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  const CHARTS={};
  const RENDERED={progress:false,pie:false,wibor:false,fra:false};
  let LAST=null;

  function makeChart(canvasId,config){
    const cvs=id(canvasId); if(!cvs||typeof Chart==='undefined') return null;
    try{ CHARTS[canvasId]?.destroy?.(); CHARTS[canvasId]=new Chart(cvs,config); return CHARTS[canvasId]; }
    catch(e){ console.warn('Chart',canvasId,e); return null; }
  }
  function num(x){const n=Number(x);return isNaN(n)?null:n}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function ratyWord(n){n=Math.abs(Math.floor(n||0));const l=n%10,l2=n%100;if(n===1)return'rata';if(l>=2&&l<=4&&!(l2>=12&&l2<=14))return'raty';return'rat'}
  async function fetchJson(url){
    const u=new URL(url); u.searchParams.set('_v',window.APP_VERSION||''); u.searchParams.set('_t',Date.now());
    const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  function showError(msg){const b=id('errorBox'); if(!msg){b.style.display='none';return;} b.style.display='block'; b.textContent=msg;}

  async function load(){
    showError(null); id('asOf').textContent='Ładowanie…';
    try{ LAST=await fetchJson(window.RAPORT_ENDPOINT); renderKPI(LAST); renderAllOpen(); }
    catch(e){ console.error(e); showError('Nie udało się pobrać raportu: '+e.message); }
  }

  function renderKPI(d){
    id('asOf').textContent='Stan na '+(d.asOf||'—');
    const wibor = Array.isArray(d.history)&&d.history[0] ? Number(d.history[0][1]) : num(d.wibor3m);
    id('wibor').textContent = wibor!=null ? wibor.toFixed(2)+'%' : '—';
    id('curr').textContent  = PLN(num(d.currentInstallment));
    id('new').textContent   = PLN(num(d.newInstallment));

    const diff=(num(d.newInstallment)||0)-(num(d.currentInstallment)||0);
    const el=id('diff');
    el.textContent=(diff>0?'▲ +':'▼ ')+Math.abs(diff).toFixed(2)+NBSP+'zł';
    el.className='val nowrap '+(diff>0?'value up':'value down');

    const months=num(d.monthsRemaining)||0;
    if(months>0){
      id('raty').textContent=months+NBSP+ratyWord(months);
      const today=new Date(); const last=new Date(today.getFullYear(),today.getMonth()+months,1);
      id('ratySub').textContent='ostatnia rata: '+monthsPL[last.getMonth()]+' '+last.getFullYear();
    }else{ id('raty').textContent='—'; id('ratySub').textContent='' }
  }

  function renderProgress(d){
    if(RENDERED.progress) return;
    const pct=clamp(num(d.capitalPaidPct)||0,0,100);
    id('bar').style.width=pct.toFixed(1)+'%';
    id('barLabel').textContent=pct.toFixed(1)+'%';
    id('init').textContent=PLN(num(d.initialLoan));
    id('paid').textContent=PLN(num(d.capitalPaid));
    id('rem').textContent =PLN(num(d.remainingLoan));
    RENDERED.progress=true;
  }

  function renderPie(d){
    if(RENDERED.pie) return;
    const interest=num(d.installmentParts?.interest)||0;
    const principal=num(d.installmentParts?.principal)||0;
    makeChart('pieChart',{
      type:'doughnut',
      data:{labels:['Odsetki','Kapitał'],datasets:[{data:[interest,principal],borderWidth:0,backgroundColor:['#3b82f6','#93c5fd']}]},
      options:{responsive:false,maintainAspectRatio:true,cutout:'62%',
        plugins:{legend:{labels:{color:getCSS('--text')}}}}
    });
    id('odsetki').textContent=PLN(interest);
    id('kapital').textContent=PLN(principal);
    RENDERED.pie=true;
  }

  function renderWibor(d){
    if(RENDERED.wibor) return;
    const rows=(d.history||[]).slice(0,5).reverse();
    if(rows.length){
      const labels=rows.map(r=>r[0]);
      const values=rows.map(r=>Number(r[1]));
      makeChart('wiborChart',{
        type:'line',
        data:{labels,datasets:[{data:values,tension:.35,pointRadius:3,borderWidth:2}]},
        options:{responsive:false,maintainAspectRatio:true,
          plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:getCSS('--text')},grid:{color:getCSS('--grid')}},
                  y:{ticks:{color:getCSS('--text')},grid:{color:getCSS('--grid')}}}
        }
      });
    }
    renderWiborTable(d.history||[]);
    RENDERED.wibor=true;
  }
  function renderWiborTable(rows){
    const wrap=id('histTableWrap');
    let html='<table class="tbl"><tr><th>Data</th><th>WIBOR 3M (%)</th><th>Zmiana</th></tr>';
    rows.forEach(r=>{
      const d=r[0], val=Number(r[1]), ch=Number(r[2]);
      const sym=ch>0?'▲':(ch<0?'▼':'▬'); const color=ch<0?'#2a9d8f':(ch>0?'#e63946':'#9ca3af');
      html+=`<tr><td>${d}</td><td><b>${val.toFixed(2)}%</b></td><td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}</td></tr>`;
    });
    html+='</table>'; wrap.innerHTML=html;
  }

  function renderFra(d){
    if(RENDERED.fra) return;
    const rows=d.fraProjections||[];
    if(rows.length){
      const labels=rows.map(r=>r[0]);
      const values=rows.map(r=>Number(r[1]));
      makeChart('fraChart',{
        type:'line',
        data:{labels,datasets:[{data:values,tension:.35,pointRadius:3,borderWidth:2}]},
        options:{responsive:false,maintainAspectRatio:true,
          plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:getCSS('--text')},grid:{color:getCSS('--grid')}},
                  y:{ticks:{color:getCSS('--text')},grid:{color:getCSS('--grid')}}}
        }
      });
    }
    renderFraTable(rows);
    RENDERED.fra=true;
  }
  function renderFraTable(rows){
    const wrap=id('fraTableWrap');
    let html='<table class="tbl"><tr><th>Miesiąc raty</th><th>Prognozowana rata</th><th>Zmiana</th></tr>';
    rows.forEach(r=>{
      const label=r[0], val=Number(r[1]), ch=Number(r[2]);
      const sym=ch>0?'▲':(ch<0?'▼':'▬'); const color=ch<0?'#2a9d8f':(ch>0?'#e63946':'#9ca3af');
      html+=`<tr><td>${label}</td><td><b>${val.toFixed(2)}&nbsp;zł</b></td><td style="color:${color};font-weight:700">${sym} ${Math.abs(ch).toFixed(2)}&nbsp;zł</td></tr>`;
    });
    html+='</table>'; wrap.innerHTML=html;
  }

  // otwarte sekcje na starcie – od razu render
  function renderAllOpen(){
    if(!LAST) return;
    renderProgress(LAST); renderPie(LAST); renderWibor(LAST); renderFra(LAST);
  }

  // toggle (bez animacji – pewny rendering)
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.acc-head'); if(!btn) return;
    const trg=id(btn.dataset.target); const open=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded', String(!open));
    trg.classList.toggle('open', !open);
    if(!open && LAST){
      if(trg.id==='acc-progress') renderProgress(LAST);
      if(trg.id==='acc-pie')      renderPie(LAST);
      if(trg.id==='acc-wibor')    renderWibor(LAST);
      if(trg.id==='acc-fra')      renderFra(LAST);
    }
  });

  // SW (bez zmian)
  if('serviceWorker' in navigator){
    window.addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register('./sw.js?v='+(window.APP_VERSION||'v'));
        reg.addEventListener('updatefound',()=>{
          const nw=reg.installing; nw&&nw.addEventListener('statechange',()=>{
            if(nw.state==='installed'&&navigator.serviceWorker.controller){
              reg.active?.postMessage?.('SKIP_WAITING'); setTimeout(()=>location.reload(),250);
            }
          });
        });
        setTimeout(()=>reg.update().catch(()=>{}),1200);
      }catch(e){console.warn('SW',e)}
    });
  }

  load();
})();
