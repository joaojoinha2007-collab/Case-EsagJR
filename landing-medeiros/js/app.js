/* Dashboard Medeiros Construção · Esag Júnior */
const SEGCOLOR={'Infraestrutura':'var(--mark)','Serviços especializados':'var(--blue)','Serviços técnicos e apoio':'var(--earth)','Edificações':'var(--grey)'};
const pct=v=>(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const brl=v=>{if(v>=1e9)return 'R$ '+(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})+' bi';if(v>=1e6)return 'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi';return 'R$ '+(v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mil'};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOP2=['Pavimentação asfáltica','Sondagem e investigação geotécnica'];

/* ================= shared tooltip ================= */
const tip=$('tip');let tipTimer=null;
function showTip(html,x,y){tip.innerHTML=html;tip.classList.add('on');
  const r=tip.getBoundingClientRect();let L=x+14,T=y+16;
  if(L+r.width>innerWidth-8)L=x-r.width-14;if(L<8)L=8;
  if(T+r.height>innerHeight-8)T=y-r.height-14;if(T<8)T=8;
  tip.style.left=L+'px';tip.style.top=T+'px'}
function hideTip(){tip.classList.remove('on')}
document.addEventListener('pointerover',e=>{const t=e.target.closest('[data-tip]');if(t&&e.pointerType!=='touch')showTip(t.dataset.tip,e.clientX,e.clientY)});
document.addEventListener('pointermove',e=>{const t=e.target.closest('[data-tip]');if(t&&e.pointerType!=='touch')showTip(t.dataset.tip,e.clientX,e.clientY)});
document.addEventListener('pointerout',e=>{const t=e.target.closest('[data-tip]');if(t&&!t.contains(e.relatedTarget))hideTip()});
document.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-tip]');if(e.pointerType==='touch'&&t){const r=t.getBoundingClientRect();showTip(t.dataset.tip,e.clientX,Math.max(r.top-8,e.clientY-60));clearTimeout(tipTimer);tipTimer=setTimeout(hideTip,2600)}else if(!t)hideTip()});
document.addEventListener('focusin',e=>{const t=e.target.closest('[data-tip]');if(t&&t.matches(':focus-visible')){const r=t.getBoundingClientRect();showTip(t.dataset.tip,r.left+Math.min(r.width/2,120),r.bottom)}});
document.addEventListener('focusout',hideTip);
addEventListener('scroll',hideTip,{passive:true});

/* ================= donut (persistent, animated) ================= */
function donut(el,slices,center,opts={}){
  const r=70,sw=32,C=2*Math.PI*r,total=slices.reduce((a,s)=>a+s.v,0);
  if(!el._d){
    el.innerHTML=`<svg class="donut" viewBox="-100 -100 200 200" width="100%" style="max-width:${opts.size||210}px;display:block;margin:0 auto" role="img"><g transform="rotate(-90)">${slices.map((s,i)=>`<circle class="slice" data-i="${i}" r="${r}" fill="none" stroke="${s.c}" stroke-width="${sw}" tabindex="${opts.static?-1:0}"></circle>`).join('')}</g><text class="cv" x="0" y="-3" text-anchor="middle" font-size="24" font-weight="800" fill="var(--ink)"></text><text class="cl" x="0" y="15" text-anchor="middle" font-size="10" fill="var(--muted)"></text></svg><div class="dlegend">${slices.map((s,i)=>`<button type="button" class="lg" data-i="${i}" aria-pressed="false"><i class="sw" style="background:${s.c}"></i>${s.l} <b></b></button>`).join('')}</div>`;
    const svg=el.querySelector('svg'),d=el._d={svg,pinned:null,slices,center};
    const hl=i=>{svg.classList.toggle('hl',i!=null);svg.querySelectorAll('.slice').forEach(c=>c.classList.toggle('on',+c.dataset.i===i));
      el.querySelectorAll('.lg').forEach(b=>{b.classList.toggle('dim',i!=null&&+b.dataset.i!==i)});
      const cv=svg.querySelector('.cv'),cl=svg.querySelector('.cl');
      if(i==null){cv.textContent=d.center[0];cl.textContent=d.center[1]}else{const s=d.slices[i];cv.textContent=d.fmt?d.fmt(s,d.total)[0]:pct(s.v/d.total);cl.textContent=d.fmt?d.fmt(s,d.total)[1]:s.l.toLowerCase()}};
    d.hl=hl;const rest=()=>hl(d.pinned);
    const pin=i=>{d.pinned=d.pinned===i?null:i;el.querySelectorAll('.lg').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.i===d.pinned));rest()};
    el.querySelectorAll('.slice,.lg').forEach(n=>{const i=+n.dataset.i;
      n.addEventListener('pointerenter',()=>hl(i));n.addEventListener('pointerleave',rest);
      n.addEventListener('focus',()=>hl(i));n.addEventListener('blur',rest);
      n.addEventListener('click',()=>pin(i));
      n.addEventListener('keydown',e=>{if(n.tagName==='circle'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pin(i)}})});
  }
  const d=el._d;d.slices=slices;d.center=center;d.total=total;d.fmt=opts.fmt;let acc=0;
  el.querySelectorAll('.slice').forEach((c,i)=>{const s=slices[i],f=s.v/total,len=f*C;
    c.style.strokeDasharray=`${len.toFixed(2)} ${(C-len).toFixed(2)}`;c.style.strokeDashoffset=(-acc*C).toFixed(2);acc+=f;
    const lab=d.fmt?d.fmt(s,total):[pct(f),s.l];c.setAttribute('aria-label',`${s.l}: ${lab[0]} ${lab[1]}`)});
  el.querySelectorAll('.lg b').forEach((b,i)=>b.textContent=pct(slices[i].v/total));
  d.svg.setAttribute('aria-label',slices.map(s=>`${s.l} ${pct(s.v/total)}`).join(', '));
  d.hl(d.pinned)}

const PORTE_CLI=[{l:'Micro',v:.33,c:'var(--grey)'},{l:'Pequena',v:.43,c:'var(--blue)'},{l:'Média',v:.1825,c:'var(--earth)'},{l:'Grande',v:.0575,c:'var(--mark)'}];
const PORTE_FAT=[{l:'Micro',v:.000937,c:'var(--grey)'},{l:'Pequena',v:.015308,c:'var(--blue)'},{l:'Média',v:.36076,c:'var(--earth)'},{l:'Grande',v:.622995,c:'var(--mark)'}];
const PLURAL={Micro:'micro',Pequena:'pequenas','Média':'médias',Grande:'grandes'};
let porteMode='cli';
function drawPorte(v){porteMode=v;const cli=v==='cli';
  document.querySelectorAll('#donutToggle button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===v));
  donut($('porteDonut'),cli?PORTE_CLI:PORTE_FAT,cli?['400','clientes']:['100%','do faturamento'],
    {fmt:cli?(s=>[String(Math.round(s.v*400)),`${PLURAL[s.l]} · ${pct(s.v)}`]):(s=>[pct(s.v),`do fat. · ${PLURAL[s.l]}`])})}
drawPorte('cli');
$('donutToggle').onclick=e=>{const b=e.target.closest('button');if(b)drawPorte(b.dataset.v)};

/* ================= global state: segment filter + selected service ================= */
const segs=['Todos','Infraestrutura','Serviços especializados','Serviços técnicos e apoio','Edificações'];
let cur='Todos',selId=null;
const listeners=[];
function setSeg(s){cur=(s===cur&&s!=='Todos')?'Todos':s;if(selId&&cur!=='Todos'&&S.find(x=>x.s===selId).seg!==cur)selId=null;refresh()}
function setSel(s){selId=(selId===s)?null:s;refresh()}
function refresh(){listeners.forEach(f=>f())}

/* ================= segment bars (clickable → filter) ================= */
const SEGROWS=[['Infraestrutura','Infraestrutura',.25,11],['Especializados','Serviços especializados',.3825,7],['Téc. e apoio','Serviços técnicos e apoio',.165,3],['Edificações','Edificações',.2025,2]];
function drawSegBars(){const max=.5,el=$('segBars');
  el.classList.toggle('has-sel',cur!=='Todos');
  el.innerHTML=SEGROWS.map(r=>{const cl=r[2],g=r[3]/23,on=cur===r[1];
    return `<button type="button" class="row" data-seg="${r[1]}" aria-pressed="${on}" data-tip="<b>${r[1]}</b>&#10;${Math.round(cl*400)} de 400 clientes (${pct(cl)})&#10;${r[3]} de 23 grandes contas (${pct(g)})&#10;${on?'Clique para remover o filtro':'Clique para filtrar ranking e ICP'}"><span>${r[0]}</span><span><span class="track"><span class="fill" style="width:${cl/max*100}%;background:var(--blue)"></span></span><span class="track" style="margin-top:4px"><span class="fill" style="width:${g/max*100}%;background:var(--mark)"></span></span></span><span class="rowval">${pct(cl)} clientes<br>${pct(g)} grandes</span></button>`}).join('')
    +`<div class="legend" style="margin-top:6px"><span><i class="sw" style="background:var(--blue)"></i>% dos clientes</span><span><i class="sw" style="background:var(--mark)"></i>% das grandes contas</span></div>`;
  $('segState').innerHTML=cur==='Todos'
    ?`<span class="hint" style="margin:0">Selecione um segmento para filtrar o ranking e o gráfico de ICP.</span>`
    :`<span>Filtro ativo: <b>${esc(cur)}</b></span><button type="button" class="btn" data-go="ranking">Ver no ranking ↓</button><button type="button" class="btn ghost" data-clear>Limpar filtro</button>`}
$('segBars').addEventListener('click',e=>{const b=e.target.closest('button.row');if(b){setSeg(b.dataset.seg);hideTip()}});
$('segState').addEventListener('click',e=>{if(e.target.closest('[data-clear]'))setSeg('Todos')});
listeners.push(drawSegBars);

document.getElementById('whyBars').innerHTML=[['Clientes da base',.25,'100 de 400 clientes estão em infraestrutura'],['Médias/grandes da base',28/96,'28 de 96 clientes médios e grandes'],['Grandes da base',11/23,'11 de 23 grandes contas'],['Valor de obras no Brasil',.384,'Participação da infraestrutura no valor de obras (IBGE, PAIC 2024)']].map(r=>`<div class="row" data-tip="<b>${r[0]}: ${pct(r[1])}</b>&#10;${r[2]}"><span>${r[0]}</span><div class="track"><div class="fill" style="width:${r[1]/.5*100}%;background:${r[0].includes('Brasil')?'var(--earth)':'var(--asphalt)'}"></div></div><span class="rowval">${pct(r[1])}</span></div>`).join('');

/* ================= filters ================= */
const fEl=$('filters');
function drawFilters(){fEl.innerHTML=`<span class="flabel">Macrossegmento:</span>`+segs.map(s=>{return `<button type="button" aria-pressed="${s===cur}" data-s="${s}">${s}</button>`}).join('')}
fEl.onclick=e=>{const b=e.target.closest('button');if(b)setSeg(b.dataset.s)};
listeners.push(drawFilters);
function drawNavFilter(){const on=cur!=='Todos';$('navfilter').classList.toggle('on',on);$('navfilterTxt').textContent=cur;$('navfilter').setAttribute('aria-label',`Remover filtro de segmento: ${cur}`)}
$('navfilter').onclick=()=>setSeg('Todos');
listeners.push(drawNavFilter);

/* ================= ranking ================= */
function drawRank(){
  const all=S.filter(r=>cur==='Todos'||r.seg===cur);
  let d=all.slice().sort((a,b)=>b.score-a.score).slice(0,10);
  const max=Math.max(...d.map(r=>r.score));
  $('rankCap').textContent=(cur==='Todos'?'Top 10 de 25 serviços':`${d.length===all.length?'Todos os':'Top '+d.length+' de'} ${all.length} serviços · ${cur}`);
  $('rankwrap').classList.toggle('has-sel',!!selId&&d.some(r=>r.s===selId));
  $('rankChart').innerHTML=d.map((r,i)=>{
    const top=TOP2.includes(r.s),on=r.s===selId;
    return `<button type="button" class="rbar" data-s="${esc(r.s)}" aria-pressed="${on}" data-tip="<b>${esc(r.s)}</b>&#10;${i+1}º ${cur==='Todos'?'no ranking geral':'em '+esc(cur)} · índice ${r.score.toLocaleString('pt-BR')}&#10;${r.n} clientes · ${r.mg} médias+grandes (${pct(r.pmg)})&#10;Fat. mediano ${brl(r.med)}">
      <span class="rlabel">${esc(r.s)}</span>
      <span class="rtrack"><span class="rfill" style="width:${r.score/max*100}%;background:${top?'var(--mark)':'var(--asphalt)'}"></span></span>
      <span class="rscore">${r.score.toLocaleString('pt-BR',{maximumFractionDigits:0})}</span></button>`}).join('')}
$('rankChart').addEventListener('click',e=>{const b=e.target.closest('.rbar');if(b){hideTip();setSel(b.dataset.s)}});
function drawDetail(){
  const box=$('rdetail');
  $('rankHint').textContent=selId?'Clique de novo no serviço ou em “Fechar” para voltar':'Selecione um serviço para ver o detalhe';
  if(!selId){box.classList.remove('on');box.innerHTML='';box._last=null;return}
  const r=S.find(x=>x.s===selId);
  if(box._last===selId)return;box._last=selId;box.classList.add('on');
  const rank=S.slice().sort((a,b)=>b.score-a.score).findIndex(x=>x.s===r.s)+1;
  box.innerHTML=`<div><h4>${esc(r.s)}<br><small style="color:var(--muted);font-weight:400">${esc(r.seg)} · ${rank}º de 25 no índice (${r.score.toLocaleString('pt-BR')})</small></h4>
    <div class="stats"><span>Clientes<b>${r.n}</b></span><span>Médias+grandes<b>${r.mg} (${pct(r.pmg)})</b></span><span>Grandes<b>${r.gr}</b></span><span>Fat. mediano<b>${brl(r.med)}</b></span></div>
    <div class="actions"><button type="button" class="btn ghost" data-go="icp">Ver posição no gráfico de ICP →</button><button type="button" class="btn ghost" data-close>✕ Fechar detalhe</button></div></div>
    <div class="detailDonut" id="detailDonut"></div>`;
  donut($('detailDonut'),[{l:'Micro',v:r.mi,c:'var(--grey)'},{l:'Pequena',v:r.pe,c:'var(--blue)'},{l:'Média',v:r.me,c:'var(--earth)'},{l:'Grande',v:r.gr,c:'var(--mark)'}],[String(r.n),'clientes'],{size:180,fmt:s=>[String(s.v),`${PLURAL[s.l]} · ${pct(s.v/r.n)}`]})}
$('rdetail').addEventListener('click',e=>{if(e.target.closest('[data-close]'))setSel(selId)});
listeners.push(drawRank,drawDetail);

/* ================= table ================= */
$('showTbl').onclick=()=>{const w=$('tblWrap'),on=w.classList.toggle('on');$('showTbl').setAttribute('aria-expanded',on);$('showTblTxt').textContent=on?'Ocultar tabela completa':'Ver tabela completa dos 25 serviços'};
let key='score',dir=-1;
document.querySelectorAll('#tbl th[data-k] button').forEach(bt=>bt.onclick=()=>{const k=bt.parentNode.dataset.k;dir=(key===k)?-dir:(k==='s'?1:-1);key=k;drawTbl()});
function drawTbl(){let d=S.filter(r=>cur==='Todos'||r.seg===cur);d=d.slice().sort((a,b)=>(a[key]>b[key]?1:-1)*dir);
  $('showTblTxt').textContent=$('tblWrap').classList.contains('on')?'Ocultar tabela completa':(cur==='Todos'?'Ver tabela completa dos 25 serviços':`Ver tabela dos ${d.length} serviços · ${cur}`);
  document.querySelectorAll('#tbl th[data-k]').forEach(th=>{const on=th.dataset.k===key;if(on)th.setAttribute('aria-sort',dir>0?'ascending':'descending');else th.removeAttribute('aria-sort');th.querySelector('.dir').textContent=on?(dir>0?'▲':'▼'):''});
  document.querySelector('#tbl tbody').innerHTML=d.map(r=>{const n=r.n;const st=[[r.mi,'var(--grey)','Micro'],[r.pe,'var(--blue)','Pequena'],[r.me,'var(--earth)','Média'],[r.gr,'var(--mark)','Grande']].map(x=>`<i style="width:${x[0]/n*100}%;background:${x[1]}"></i>`).join('');
  const mix=`Micro ${r.mi} · Pequena ${r.pe} · Média ${r.me} · Grande ${r.gr}`;
  return `<tr class="${TOP2.includes(r.s)?'top':''} ${r.s===selId?'sel':''}" data-s="${esc(r.s)}" tabindex="0" aria-selected="${r.s===selId}"><td>${esc(r.s)}<br><small style="color:var(--muted)">${esc(r.seg)}</small></td><td>${r.score.toLocaleString('pt-BR')}</td><td>${n}</td><td>${r.mg}</td><td>${r.gr}</td><td>${pct(r.pmg)}</td><td>${brl(r.med)}</td><td><span class="stack" data-tip="${mix}">${st}</span></td></tr>`}).join('')}
const tb=document.querySelector('#tbl tbody');
tb.addEventListener('click',e=>{const tr=e.target.closest('tr');if(!tr)return;setSel(tr.dataset.s);
  if(selId){const r=$('rdetail').getBoundingClientRect();if(r.top<navH()||r.bottom>innerHeight)scrollTo({top:scrollY+r.top-navH()-24,behavior:REDUCED?'auto':'smooth'})}});
tb.addEventListener('keydown',e=>{const tr=e.target.closest('tr');if(tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tr.click()}});
listeners.push(drawTbl);

/* ================= scatter ================= */
const SC={W:560,H:330,pad:{l:66,r:14,t:14,b:38}};
function scatter(el,data){
  const {W,H,pad}=SC;const xMax=0.6,yMin=Math.log10(2e5),yMax=Math.log10(6e7);
  const x=v=>pad.l+(v/xMax)*(W-pad.l-pad.r);
  const y=v=>H-pad.b-((Math.log10(v)-yMin)/(yMax-yMin))*(H-pad.t-pad.b);
  const rr=n=>4+Math.sqrt(n)*1.9;
  const xt=[0,.2,.4,.6],yt=[2e5,2e6,2e7];
  let g=`<svg class="scat" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:100%" role="group" aria-label="Dispersão dos 25 serviços">`;
  yt.forEach(v=>g+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="2 4"/>`);
  g+=`<line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/><line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>`;
  xt.forEach(v=>g+=`<text class="axlab" x="${x(v)}" y="${H-pad.b+16}" text-anchor="middle">${pct(v)}</text>`);
  yt.forEach(v=>g+=`<text class="axlab" x="${pad.l-6}" y="${y(v)+3}" text-anchor="end">${brl(v)}</text>`);
  g+=`<text class="axlab" x="${(W+pad.l)/2}" y="${H-6}" text-anchor="middle">% de clientes médios/grandes →</text>`;
  g+=`<text class="axlab" transform="translate(10 ${(H-pad.b+pad.t)/2}) rotate(-90)" text-anchor="middle">Faturamento mediano (escala log) →</text>`;
  data.slice().sort((a,b)=>b.n-a.n).forEach(r=>{const top=TOP2.includes(r.s);
    g+=`<circle data-s="${esc(r.s)}" tabindex="0" role="button" aria-label="${esc(r.s)}: ${r.n} clientes, ${pct(r.pmg)} médias e grandes, mediana ${brl(r.med)}" cx="${x(r.pmg).toFixed(1)}" cy="${y(r.med).toFixed(1)}" r="${rr(r.n).toFixed(1)}" fill="${SEGCOLOR[r.seg]}" fill-opacity="${top?0.95:0.68}" stroke="${top?'var(--ink)':'var(--panel)'}" stroke-width="${top?2:1}" data-tip="<b>${esc(r.s)}</b>&#10;${esc(r.seg)}&#10;${r.n} clientes · ${pct(r.pmg)} médias/grandes&#10;Fat. mediano ${brl(r.med)}"></circle>`});
  g+='</svg>';
  el.innerHTML=g+`<div class="dlegend" id="scatLegend">${Object.entries(SEGCOLOR).map(([k,c])=>`<button type="button" class="lg" data-seg="${k}" aria-pressed="false"><i class="sw" style="background:${c}"></i>${k}</button>`).join('')}</div>`;
  const svg=el.querySelector('svg');
  svg.addEventListener('pointerover',e=>{const c=e.target.closest('circle');svg.querySelectorAll('circle.hov').forEach(n=>n.classList.remove('hov'));if(c){c.classList.add('hov');svg.classList.add('hovering');readout(c.dataset.s,true)}});
  svg.addEventListener('pointerleave',()=>{svg.classList.remove('hovering');svg.querySelectorAll('circle.hov').forEach(n=>n.classList.remove('hov'));readout(selId,false)});
  svg.addEventListener('click',e=>{const c=e.target.closest('circle');if(c)setSel(c.dataset.s)});
  svg.addEventListener('keydown',e=>{const c=e.target.closest('circle');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setSel(c.dataset.s)}});
  svg.addEventListener('focusin',e=>{const c=e.target.closest('circle');if(c)readout(c.dataset.s,true)});
  el.querySelector('#scatLegend').addEventListener('click',e=>{const b=e.target.closest('.lg');if(b)setSeg(b.dataset.seg)})}
function readout(s,hover){const el=$('readout');
  if(!s){el.classList.remove('on');el.innerHTML=cur==='Todos'?'Passe o cursor ou toque numa bolha para ver o serviço; clique para selecioná-lo.':`Filtro <b>${esc(cur)}</b> ativo — os demais segmentos ficam esmaecidos. <button type="button" class="btn ghost" data-clear style="margin-left:6px;padding:3px 9px">Limpar</button>`;return}
  const r=S.find(x=>x.s===s),isSel=s===selId;el.classList.toggle('on',isSel);
  el.innerHTML=`<b>${esc(r.s)}</b> · ${esc(r.seg)}<br>${r.n} clientes · ${r.mg} médias+grandes (${pct(r.pmg)}) · fat. mediano ${brl(r.med)}`+(isSel?` <button type="button" class="btn ghost" data-go="ranking" style="margin-left:6px;padding:3px 9px">Ver no ranking ↑</button> <button type="button" class="btn ghost" data-unsel style="padding:3px 9px">✕</button>`:(hover?' <span style="color:var(--esag)">· clique para selecionar</span>':''))}
$('readout').addEventListener('click',e=>{if(e.target.closest('[data-clear]'))setSeg('Todos');if(e.target.closest('[data-unsel]'))setSel(selId)});
scatter($('scatter'),S);
function syncScatter(){document.querySelectorAll('#scatter circle').forEach(c=>{const r=S.find(x=>x.s===c.dataset.s);c.classList.toggle('out',cur!=='Todos'&&r.seg!==cur);c.classList.toggle('sel',r.s===selId)});
  document.querySelectorAll('#scatLegend .lg').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.seg===cur);b.classList.toggle('dim',cur!=='Todos'&&b.dataset.seg!==cur)});readout(selId,false)}
listeners.push(syncScatter);

/* ================= funnel ================= */
const FUN=[['1 · Primeiro contato','Sondagem e investigação geotécnica, na fase de projeto',100],['2 · Execução da obra','Serviço principal contratado (ex.: pavimentação)',74],['3 · Gerenciamento','Fiscalização e gestão de aditivos durante a obra',50],['4 · Conta plena','Cliente com múltiplos serviços recorrentes',28]];
$('funnel').innerHTML=FUN.map((f,i)=>`<div class="fstage" style="width:${f[2]}%;background:${i<2?'var(--asphalt)':'var(--blue)'}"><b>${f[0]}</b><small>${f[1]}</small></div>`).join('');

/* ================= TAM/SAM/SOM ================= */
const V=522.5e9,BASE={fee:'2',reg:'0.055',segSel:'0.384',som:'3'};let lastVals=null;
function calc(){const fee=+$('fee').value/100,reg=+$('reg').value,sg=+$('segSel').value,som=+$('som').value/100;
  $('oFee').textContent=pct(fee);$('oSom').textContent=pct(som);
  const tam=V*fee,sam=tam*reg*sg,so=sam*som;
  const rows=[['TAM','Brasil, toda a construção',tam,`R$ 522,5 bi de valor de obras × ${pct(fee)}`],['SAM','Recorte de região e segmento',sam,`TAM × ${pct(reg)} × ${pct(sg)}`],['SOM','Meta alcançável em 3 anos',so,`SAM × ${pct(som)} · ≈ ${Math.round(so/180000)} contratos de R$ 180 mil/ano`]];
  const w=[100,Math.max(34,Math.sqrt(sam/tam)*100),Math.max(22,Math.sqrt(so/tam)*100)];
  const lanes=$('lanes');
  if(!lanes.children.length)lanes.innerHTML=rows.map(()=>`<div class="lane"><div class="t"><span></span><b></b></div><small></small><small></small></div>`).join('');
  [...lanes.children].forEach((ln,i)=>{const r=rows[i];ln.style.width=w[i]+'%';ln.querySelector('.t span').textContent=r[0];
    const b=ln.querySelector('b');b.innerHTML=`${brl(r[2])}<span style="font-size:.9rem;font-weight:500">/ano</span>`;
    if(lastVals&&lastVals[i]!==r[2]){b.classList.add('flash');requestAnimationFrame(()=>requestAnimationFrame(()=>b.classList.remove('flash')))}
    const sm=ln.querySelectorAll('small');sm[0].textContent=r[1];sm[1].textContent=r[3]});
  lastVals=rows.map(r=>r[2]);
  const isBase=Object.entries(BASE).every(([k,v])=>$(k).value===v);
  $('scenBadge').textContent=isBase?'Cenário base':'Cenário personalizado';$('scenBadge').classList.toggle('custom',!isBase);$('resetScen').disabled=isBase}
['fee','reg','segSel','som'].forEach(id=>$(id).addEventListener('input',calc));
$('resetScen').onclick=()=>{Object.entries(BASE).forEach(([k,v])=>$(k).value=v);calc()};
calc();

/* ================= KPI drill-down ================= */
function mini(rows,max){return `<div class="bars">${rows.map(r=>`<div class="row" data-tip="${r[3]||''}"><span>${r[0]}</span><div class="track"><div class="fill" style="width:${r[1]/max*100}%;background:${r[2]}"></div></div><span class="rowval">${r[4]}</span></div>`).join('')}</div>`}
const KPI={
  base:{h:'Composição da base por porte',p:'Os 400 clientes, classificados pelas faixas de receita do BNDES.',
    viz:()=>mini([['Micro',132,'var(--grey)','132 clientes (33%)','132'],['Pequena',172,'var(--blue)','172 clientes (43%)','172'],['Média',73,'var(--earth)','73 clientes (18,3%)','73'],['Grande',23,'var(--mark)','23 clientes (5,8%)','23']],172),
    act:`<button type="button" class="btn" data-porte="cli" data-go="clientes">Ver distribuição por porte ↓</button>`},
  mpe:{h:'Muitos clientes, pouco faturamento',p:'304 dos 400 clientes são micro ou pequenas empresas, mas respondem por só 1,6% do faturamento da base.',
    viz:()=>mini([['% dos clientes',.76,'var(--blue)','Micro + pequenas: 304 de 400 clientes','76%'],['% do faturamento',.016245,'var(--grey)','Micro 0,1% + pequenas 1,5% do faturamento','1,6%']],1),
    act:`<button type="button" class="btn" data-porte="fat" data-go="clientes">Comparar clientes × faturamento ↓</button>`},
  fat:{h:'Onde está o faturamento',p:'96 clientes médios e grandes (24% da base) concentram 98,4% do faturamento.',
    viz:()=>mini([['Grandes',.622995,'var(--mark)','23 clientes · 62,3% do faturamento','62,3%'],['Médias',.36076,'var(--earth)','73 clientes · 36,1% do faturamento','36,1%'],['Pequenas',.015308,'var(--blue)','172 clientes · 1,5% do faturamento','1,5%'],['Micro',.000937,'var(--grey)','132 clientes · 0,1% do faturamento','0,1%']],.7),
    act:`<button type="button" class="btn" data-porte="fat" data-go="clientes">Ver faturamento por porte ↓</button>`},
  gr:{h:'As 23 grandes contas por macrossegmento',p:'Infraestrutura concentra quase metade das grandes contas, com só 25% dos clientes.',
    viz:()=>mini(SEGROWS.map(r=>[r[0],r[3],r[1]==='Infraestrutura'?'var(--mark)':'var(--asphalt)',`${r[1]}: ${r[3]} de 23 grandes (${pct(r[3]/23)})`,String(r[3])]),11),
    act:`<button type="button" class="btn" data-seg="Infraestrutura" data-go="ranking">Filtrar ranking por infraestrutura ↓</button>`}};
let openK=null;
function openKpi(k){openK=(openK===k)?null:k;
  document.querySelectorAll('.kpi').forEach(b=>b.setAttribute('aria-expanded',b.dataset.k===openK));
  const box=$('kdetail');
  if(!openK){box.classList.remove('on');$('kpiHint').textContent='Clique num indicador para ver o detalhe, ou use as abas acima para percorrer a análise.';return}
  const K=KPI[openK];
  $('kdetailIn').innerHTML=`<div><h3>${K.h}</h3><p>${K.p}</p><div class="actions">${K.act}<button type="button" class="btn ghost" data-kclose>Fechar</button></div></div><div>${K.viz()}</div>`;
  box.classList.add('on');$('kpiHint').textContent='Clique no mesmo indicador ou em “Fechar” para recolher.'}
$('kpis').addEventListener('click',e=>{const b=e.target.closest('.kpi');if(b)openKpi(b.dataset.k)});
$('kdetail').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.kclose!==undefined){const k=openK;openKpi(openK);document.querySelector(`.kpi[data-k="${k}"]`).focus();return}
  if(b.dataset.porte)drawPorte(b.dataset.porte);
  if(b.dataset.seg&&cur!==b.dataset.seg)setSeg(b.dataset.seg)});

/* ================= generic "go to section" actions ================= */
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(!g||g.classList.contains('tab'))return;e.preventDefault();go(g.dataset.go)});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(openK){const k=openK;openKpi(openK);document.querySelector(`.kpi[data-k="${k}"]`).focus()}else if(selId)setSel(selId)});

/* ================= tab navigation + scroll spy ================= */
const nav=$('tabs'),tabs=[...document.querySelectorAll('.tab')],ind=$('tabind'),scroller=$('tabscroll');
const ids=tabs.map(t=>t.dataset.t);
const secs=[...document.querySelectorAll('[data-tab]')];
let active=null,lockTo=null,lockTimer=null;
const navH=()=>nav.getBoundingClientRect().height;
function moveInd(t){ind.style.width=t.offsetWidth+'px';ind.style.transform=`translateX(${t.offsetLeft}px)`}
function setActive(id,fromClick){if(id===active)return;active=id;
  tabs.forEach(t=>{const on=t.dataset.t===id;if(on)t.setAttribute('aria-current','true');else t.removeAttribute('aria-current')});
  const t=tabs.find(t=>t.dataset.t===id);moveInd(t);
  const sl=t.offsetLeft-(scroller.clientWidth-t.offsetWidth)/2;
  scroller.scrollTo({left:Math.max(0,sl),behavior:REDUCED?'auto':'smooth'})}
function go(id){const el=$(id);if(!el)return;
  if(id!=='visao-geral')el.classList.add('seen');
  const top=id==='visao-geral'?0:el.getBoundingClientRect().top+scrollY-navH()-12;
  lockTo=id;setActive(id,true);clearTimeout(lockTimer);lockTimer=setTimeout(()=>{lockTo=null;compute()},REDUCED?60:1100);
  scrollTo({top,behavior:REDUCED?'auto':'smooth'});
  history.replaceState(null,'','#'+id)}
tabs.forEach(t=>{t.addEventListener('click',e=>{e.preventDefault();go(t.dataset.t)});
  t.addEventListener('keydown',e=>{const i=tabs.indexOf(t);let j=null;
    if(e.key==='ArrowRight')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;
    if(j!=null){e.preventDefault();tabs[j].focus()}})});
if('onscrollend' in window)addEventListener('scrollend',()=>{if(lockTo){lockTo=null;compute()}});
function compute(){if(lockTo)return;
  const line=Math.max(navH()+8,innerHeight*.4);let id=ids[0];
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-4){id=ids[ids.length-1]}
  else for(const s of secs){if(s.getBoundingClientRect().top<=line)id=s.dataset.tab}
  setActive(id)}
// IntersectionObserver drives the active tab
const spy=new IntersectionObserver(()=>compute(),{rootMargin:`-${Math.round(navH())}px 0px -60% 0px`,threshold:[0,1]});
secs.forEach(s=>spy.observe(s));
const endSentinel=document.createElement('div');document.querySelector('.wrap').appendChild(endSentinel);new IntersectionObserver(()=>compute(),{threshold:0}).observe(endSentinel);
// "stuck" state shows the compact brand once the header scrolls away
new IntersectionObserver(([en])=>nav.classList.toggle('stuck',!en.isIntersecting),{threshold:0}).observe(document.querySelector('header'));
const prog=$('progress');
addEventListener('scroll',()=>{const h=document.documentElement.scrollHeight-innerHeight;prog.style.transform=`scaleX(${h>0?scrollY/h:0})`},{passive:true});
addEventListener('resize',()=>{const t=tabs.find(t=>t.dataset.t===active);if(t)moveInd(t)});
document.fonts&&document.fonts.ready.then(()=>{const t=tabs.find(t=>t.dataset.t===active);if(t)moveInd(t)});

refresh();
const h0=location.hash.slice(1);
if(ids.includes(h0)){requestAnimationFrame(()=>go(h0))}else compute();
