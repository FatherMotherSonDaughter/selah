/* Selah v1 — Today, Upcoming, input bar, backup. Everything is saved on the phone (docs/02-architecture.md). */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||ICONS.check}</svg>`;

/* colours — docs/03-design-system.md */
const C={R:'#CC1612',O:'#F29200',Y:'#F5CB00',G:'#5BBA59',B:'#249FD4',V:'#652482'};
const CAT_NAMES={R:'People',O:'Routine & health',Y:'Errands',G:'Faith',B:'Work',V:'Trips'};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgba=(h,a)=>`rgba(${rgb(h).join(',')},${a})`;
const mix=(h,m,t)=>{const x=rgb(h),y=rgb(m);return'#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('')};
const lum=h=>{const[r,g,b]=rgb(h);return(.299*r+.587*g+.114*b)/255};
const txt=h=>mix(h,'#000000',lum(h)>.6?.68:.55);

/* dates */
const MS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MF=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const todayD=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const T=()=>ymd(todayD());
const short=s=>{const d=fromYmd(s);return`${MS[d.getMonth()]} ${d.getDate()}`};
const dayLabel=s=>{const d=fromYmd(s);if(s==T())return'Today';if(s==ymd(addDays(todayD(),1)))return'Tomorrow';return`${WD[d.getDay()]}, ${MS[d.getMonth()]} ${d.getDate()}`};
const fmtT=(t,ampm)=>{if(!t)return'';let[h,m]=t.split(':').map(Number);const p=h>=12?'PM':'AM';h=h%12||12;return`${h}:${String(m).padStart(2,'0')}${ampm?' '+p:''}`};

/* ---------- storage (on this phone only) ---------- */
const KEY='selah.v1';
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.tasks))return d}catch(e){}return{v:1,tasks:[],deleted:[],lastBackup:null}}
let db=load();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){toast('Could not save — phone storage is full?')}};
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
db.deleted=(db.deleted||[]).filter(t=>Date.now()-t.deletedAt<30*864e5);save();

const occurs=(t,d)=>{if(!t.repeat)return t.date==d;if(d<t.date&&t.repeat!='yearly')return false; /* birthdays count every year */const a=fromYmd(t.date),b=fromYmd(d);
 return t.repeat=='daily'||(t.repeat=='weekly'&&a.getDay()==b.getDay())||(t.repeat=='monthly'&&a.getDate()==b.getDate())||(t.repeat=='yearly'&&a.getMonth()==b.getMonth()&&a.getDate()==b.getDate())};
const isDone=(t,d)=>t.done.includes(d);
const byTime=(a,b)=>(a.time||'')<(b.time||'')?-1:(a.time||'')>(b.time||'')?1:a.created-b.created;
const itemsOn=d=>db.tasks.filter(t=>occurs(t,d)).sort(byTime);

/* ---------- ui state ---------- */
const wideMq=matchMedia('(min-width:600px)');
let tab='today',solo=false,upView='month',sel=T(),upMonth=(()=>{const d=todayD();d.setDate(1);return d})(),addDate=null,openRow=null;

/* ---------- toast with Undo ---------- */
let toastTimer;
function toast(msg,undo){const el=$('toast');el.innerHTML=`<span>${esc(msg)}</span>${undo?'<button id="undo">Undo</button>':''}`;el.classList.add('on');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('on'),undo?5000:2800);
 if(undo)$('undo').onclick=()=>{undo();el.classList.remove('on');render()}}
const snapshot=()=>{const s=JSON.stringify(db);return()=>{db=JSON.parse(s);save()}};

/* ---------- rows ---------- */
function row(t,d,o={}){
 const c=C[t.cat]||C.Y,done=isDone(t,d),u=t.urgent&&!done;
 const tm=o.tm!=null?o.tm:(t.time?(t.by?'by ':'')+fmtT(t.time,o.ampm):'');
 const sub=o.sub||(t.repeat?{daily:'Every day',weekly:'Every '+WD[fromYmd(t.date).getDay()],monthly:'Every month',yearly:'Every year'}[t.repeat]:'');
 const bStyle=u?`background:${c};color:#fff`:`color:${txt(c)}`;
 const icStyle=u?'background:rgba(255,255,255,.25);color:#fff':`background:${c};color:${lum(c)>.68?txt(c):'#fff'}`;
 return`<div class="rw" data-id="${t.id}" data-d="${d}"><div class="acts"><div class="l">${icon(done?'arrow-back-up':'check')}${done?'Not done':'Done'}</div><div class="r">${t.repeat?'':`<button data-a="later" style="background:#8a867e">${icon('clock')}Later</button>`}<button data-a="del" style="background:${C.R}">${icon('trash')}Delete</button></div></div>
 <div class="b${done?' done':''}" style="${bStyle}">${u?'':`<span class="tint" style="background:${rgba(c,.36)}"></span>`}<span class="ic" style="${icStyle}">${icon(t.icon)}</span><span class="tt">${esc(t.title)}${u?' 🔥':''}${sub?`<small>${esc(sub)}</small>`:''}</span><span class="tm">${esc(tm)}</span></div></div>`}

/* ---------- Today ---------- */
function renderToday(){
 const d=T(),now=new Date(),items=itemsOn(d),left=items.filter(t=>!isDone(t,d));
 const doy=Math.floor((todayD()-new Date(todayD().getFullYear(),0,0))/864e5),[vt,vr]=VERSES[doy%VERSES.length];
 const nowHM=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
 const next=left.find(t=>t.time&&t.time>nowHM);let nextTxt='';
 if(next){const[h,m]=next.time.split(':').map(Number),mins=h*60+m-(now.getHours()*60+now.getMinutes());nextTxt=` · next is ${next.title} in ${mins>=60?Math.floor(mins/60)+'h ':''}${mins%60}m`}
 const overdue=db.tasks.filter(t=>!t.repeat&&t.date<d&&!isDone(t,t.date)).sort((a,b)=>a.date<b.date?-1:1);
 const groups=[['Anytime',t=>!t.time],['Morning',t=>t.time&&t.time<'12:00'],['Afternoon',t=>t.time>='12:00'&&t.time<'17:00'],['Tonight',t=>t.time>='17:00']];
 let h=`<p class="hd">Today</p><p class="sub">${WD[now.getDay()]}, ${MF[now.getMonth()]} ${now.getDate()}</p>
 <div class="card"><p class="verse">“${esc(vt)}”</p><p class="ref">${esc(vr)} · ESV</p></div>
 <div class="sum"><b>${items.length?(left.length?left.length+' left':'All done'):'A clear day'}</b><span>${items.length?`of ${items.length}${nextTxt}`:'Type below to add something'}</span></div>`;
 if(overdue.length)h+=`<p class="lab">From before</p>`+overdue.map(t=>row(t,t.date,{tm:short(t.date)})).join('');
 for(const[name,f]of groups){const g=items.filter(f);if(g.length)h+=`<p class="lab">${name}</p>`+g.map(t=>row(t,d)).join('')}
 /* coming up: next birthdays and trips */
 const soon=[];for(let i=1;i<=30&&soon.length<3;i++){const dd=ymd(addDays(todayD(),i));for(const t of db.tasks)if((t.cat=='V'||['cake','gift'].includes(t.icon))&&occurs(t,dd)&&!soon.some(s=>s[0]==t)&&soon.length<3)soon.push([t,dd])}
 if(soon.length)h+=`<p class="lab">Coming up</p>`+soon.map(([t,dd])=>row(t,dd,{tm:short(dd)})).join('');
 $('v-today').innerHTML=h}

/* ---------- Upcoming ---------- */
function renderUpcoming(){
 let n=0;for(let i=0;i<=30;i++){const dd=ymd(addDays(todayD(),i));n+=itemsOn(dd).filter(t=>!isDone(t,dd)&&t.repeat!='daily').length} /* daily habits would swamp the count */
 let h=`<p class="hd">Upcoming</p><p class="sub">${n} thing${n==1?'':'s'} in the next 30 days</p>
 <div class="seg">${['month','week','list'].map(v=>`<button data-up="${v}" class="${upView==v?'on':''}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div>`;
 const addBtn=d=>`<button class="add" data-add="${d}">${icon('plus')} Add to ${short(d)}</button>`;
 if(upView=='month'){
  const y=upMonth.getFullYear(),m=upMonth.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),t0=T();
  h+=`<div class="mnav"><button data-nav="-1" aria-label="Previous month">${icon('chevron-left')}</button><span>${MF[m]} ${y}</span><button data-nav="1" aria-label="Next month">${icon('chevron-right')}</button></div>
  <div class="cal wd">${'SMTWTFS'.split('').map(c=>`<span>${c}</span>`).join('')}</div><div class="cal">${'<span></span>'.repeat(first)}`;
  for(let i=1;i<=days;i++){const dd=ymd(new Date(y,m,i)),cats=[...new Set(itemsOn(dd).map(t=>t.cat))].slice(0,3);
   h+=`<button class="d${dd<t0?' past':''}${dd==t0?' today':''}${dd==sel?' sel':''}" data-day="${dd}">${i}<span class="dt">${cats.map(c=>`<i style="background:${C[c]}"></i>`).join('')}</span></button>`}
  h+=`</div><p class="lab">${dayLabel(sel)}</p>`+itemsOn(sel).map(t=>row(t,sel,{ampm:1})).join('')+addBtn(sel);
  const selD=fromYmd(sel),rest=[];
  if(selD.getMonth()==m&&selD.getFullYear()==y)for(let i=selD.getDate()+1;i<=days&&rest.length<15;i++){const dd=ymd(new Date(y,m,i));for(const t of itemsOn(dd))if(t.repeat!='daily')rest.push(row(t,dd,{tm:short(dd)+(t.time?' · '+fmtT(t.time,1):'')}))}
  if(rest.length)h+=`<p class="lab">Rest of ${MF[m]}</p>`+rest.slice(0,15).join('');
 }else if(upView=='week'){
  const s=addDays(fromYmd(sel),-fromYmd(sel).getDay());
  h+=`<div class="mnav"><button data-wk="-7" aria-label="Previous week">${icon('chevron-left')}</button><span>${short(ymd(s))} – ${short(ymd(addDays(s,6)))}</span><button data-wk="7" aria-label="Next week">${icon('chevron-right')}</button></div>`;
  for(let i=0;i<7;i++){const dd=ymd(addDays(s,i)),it=itemsOn(dd);h+=`<p class="lab">${dayLabel(dd)}</p>`+(it.length?it.map(t=>row(t,dd,{ampm:1})).join(''):'')+addBtn(dd)}
 }else{
  let any=false;
  for(let i=0;i<=30;i++){const dd=ymd(addDays(todayD(),i)),it=itemsOn(dd);if(it.length){any=true;h+=`<p class="lab">${dayLabel(dd)}</p>`+it.map(t=>row(t,dd,{ampm:1})).join('')}}
  if(!any)h+=`<p class="empty" style="margin-top:18px">Nothing in the next 30 days.</p>`;
 }
 $('v-upcoming').innerHTML=h}

/* ---------- Notes (next) ---------- */
function renderNotes(){$('v-notes').innerHTML=`<p class="hd">Notes</p><div class="soon">${icon('notes')}The Notes whiteboard is being built next.<br>For now, add thoughts as tasks or keep them in Apple Notes.</div>`}

/* ---------- Me: backup + recently deleted ---------- */
function ago(ts){if(!ts)return'never';const d=Math.floor((Date.now()-ts)/864e5);return d<1?'today':d==1?'yesterday':d+' days ago'}
function renderMe(){
 const del=db.deleted.slice().sort((a,b)=>b.deletedAt-a.deletedAt);
 $('v-me').innerHTML=`<p class="hd">Me</p><p class="sub">Settings and backup</p>
 <p class="lab">Backup</p>
 <button class="mrow" id="exp">${icon('download')}<span>Save a backup<small>Last backup: ${ago(db.lastBackup)}</small></span></button>
 <button class="mrow" id="imp">${icon('upload')}<span>Restore from a backup<small>Replaces what's in Selah now</small></span></button>
 <p class="note">Everything in Selah lives only on this phone. Save a backup now and then to Files or iCloud Drive.</p>
 <p class="lab">Recently deleted</p>
 ${del.length?del.map(t=>`<div class="mrow"><span class="ic" style="background:${C[t.cat]||C.Y};color:#fff">${icon(t.icon)}</span><span>${esc(t.title)}<small>${short(t.date)} · deleted ${ago(t.deletedAt)}</small></span><button class="tm" data-restore="${t.id}">Restore</button></div>`).join(''):'<p class="empty">Nothing deleted. Deleted things stay here for 30 days.</p>'}
 <p class="lab">About</p>
 <p class="note">Selah · version 1 · works offline.<br>The rest of Me (about me, habits, Claude) comes once its design is drawn.<br>Scripture quotations are from the ESV® Bible, © 2001 by Crossway. Used by permission.</p>
 <input type="file" id="impf" accept="application/json,.json" hidden>`;
 $('exp').onclick=exportBackup;$('imp').onclick=()=>$('impf').click();$('impf').onchange=importBackup}
async function exportBackup(){
 const name=`selah-backup-${T()}.json`,blob=new Blob([JSON.stringify({...db,exportedAt:new Date().toISOString()},null,1)],{type:'application/json'});
 const file=new File([blob],name,{type:'application/json'});
 try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name})}
  else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
  db.lastBackup=Date.now();save();render();toast('Backup saved')}
 catch(e){if(e.name!='AbortError')toast('Backup did not save')}}
function importBackup(e){const f=e.target.files[0];e.target.value='';if(!f)return;
 f.text().then(s=>{const d=JSON.parse(s);if(!d||!Array.isArray(d.tasks))throw 0;
  if(!confirm(`Replace everything in Selah with this backup (${d.tasks.length} items)?`))return;
  const undo=snapshot();db={v:1,tasks:d.tasks,deleted:d.deleted||[],lastBackup:d.lastBackup||null};save();render();toast('Backup restored',undo)})
 .catch(()=>toast("That file isn't a Selah backup"))}

/* ---------- edit sheet ---------- */
function openSheet(id){
 const t=db.tasks.find(x=>x.id==id);if(!t)return;
 let cat=t.cat,urg=!!t.urgent,by=!!t.by;
 $('sheet').innerHTML=`<h2>Change</h2>
 <div class="fld"><input type="text" id="s-title" value="${esc(t.title)}" aria-label="Title"></div>
 <div class="fld">Date<input type="date" id="s-date" value="${t.date}"></div>
 <div class="fld">Time<span style="display:flex;gap:8px;align-items:center"><label><span class="tog${by?' on':''}" id="s-by" role="switch" aria-checked="${by}"></span>by</label><input type="time" id="s-time" value="${t.time||''}"></span></div>
 <div class="fld">Repeat<select id="s-rep">${[['','Never'],['daily','Every day'],['weekly','Every week'],['monthly','Every month'],['yearly','Every year']].map(([v,l])=>`<option value="${v}"${(t.repeat||'')==v?' selected':''}>${l}</option>`).join('')}</select></div>
 <div class="fld">Category<span class="cats">${Object.keys(C).map(k=>`<button data-cat="${k}" class="${k==cat?'on':''}" style="background:${C[k]}" aria-label="${CAT_NAMES[k]}"></button>`).join('')}</span></div>
 <div class="fld">Urgent<span class="tog${urg?' on':''}" id="s-urg" role="switch" aria-checked="${urg}"></span></div>
 <div class="btns"><button class="btn-del" id="s-del">Delete</button><button class="btn-save" id="s-save">Save</button></div>`;
 $('sheet').hidden=$('sheet-bg').hidden=false;
 $('sheet').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;$('sheet').querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('on',x==b))});
 $('s-urg').onclick=()=>{urg=!urg;$('s-urg').classList.toggle('on',urg)};
 $('s-by').onclick=()=>{by=!by;$('s-by').classList.toggle('on',by)};
 $('s-save').onclick=()=>{const undo=snapshot();
  t.title=$('s-title').value.trim()||t.title;t.date=$('s-date').value||t.date;t.time=$('s-time').value||null;t.by=by&&!!t.time;
  t.repeat=$('s-rep').value||null;if(t.cat!=cat){t.cat=cat;t.icon=guessCatFor(t.title,cat)}t.urgent=urg;
  save();closeSheet();render();toast('Saved',undo)};
 $('s-del').onclick=()=>{closeSheet();del(t.id)}}
/* keep the keyword icon if it belongs to the new category, otherwise use that category's first icon */
function guessCatFor(title,cat){const g=guessCat(title);if(g.cat==cat)return g.icon;return({R:'users',O:'alarm',Y:'check',G:'heart',B:'briefcase',V:'plane'})[cat]}
function closeSheet(){$('sheet').hidden=$('sheet-bg').hidden=true}
$('sheet-bg').onclick=closeSheet;

/* ---------- actions ---------- */
function toggleDone(id,d){const t=db.tasks.find(x=>x.id==id);if(!t)return;const undo=snapshot(),was=isDone(t,d);
 if(was)t.done=t.done.filter(x=>x!=d);else t.done.push(d);save();render();toast(was?'Marked not done':'Done',undo)}
function later(id){const t=db.tasks.find(x=>x.id==id);if(!t)return;const undo=snapshot();
 t.date=ymd(addDays(fromYmd(t.date<T()?T():t.date),1));save();render();toast('Moved to '+dayLabel(t.date),undo)}
function del(id){const i=db.tasks.findIndex(x=>x.id==id);if(i<0)return;const undo=snapshot();
 const[t]=db.tasks.splice(i,1);db.deleted.push({...t,deletedAt:Date.now()});save();render();toast('Deleted',undo)}

function add(text){
 const p=parseInput(text,addDate?fromYmd(addDate):null),undo=snapshot();
 const t={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:p.title,date:p.date,time:p.time,by:p.by,repeat:p.repeat,cat:p.cat,icon:p.icon,urgent:p.urgent,done:[],created:Date.now()};
 db.tasks.push(t);save();setAddDate(null);
 if(tab=='upcoming'||(wideMq.matches&&tab=='today')){sel=t.date;const d=fromYmd(t.date);upMonth=new Date(d.getFullYear(),d.getMonth(),1)}
 render();toast(`Added to ${dayLabel(t.date)}${t.time?' · '+(t.by?'by ':'')+fmtT(t.time,1):''}`,undo)}

/* ---------- swipe: right = done, left = Later / Delete; tap = change ---------- */
let sw=null;
const openW=rw=>rw.querySelector('.acts .r').offsetWidth;
const closeOpen=()=>{if(openRow){const b=openRow.querySelector('.b');if(b){b.style.transition='transform .2s';b.style.transform=''}openRow=null}};
document.addEventListener('pointerdown',e=>{
 if(e.target.closest('.acts button'))return;
 const b=e.target.closest('.rw .b');
 if(!b){closeOpen();return}
 const rw=b.parentNode;sw={b,rw,x:e.clientX,y:e.clientY,dx:0,drag:false,base:openRow==rw?-openW(rw):0,pid:e.pointerId};
 if(openRow&&openRow!=rw)closeOpen()});
document.addEventListener('pointermove',e=>{if(!sw||e.pointerId!=sw.pid)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
 if(!sw.drag){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){sw.drag=true;try{sw.b.setPointerCapture(e.pointerId)}catch(_){}sw.b.style.transition='none'}else if(Math.abs(dy)>10){sw=null;return}else return}
 sw.dx=dx;const x=Math.max(-170,Math.min(200,sw.base+dx));sw.b.style.transform=`translateX(${x}px)`});
document.addEventListener('pointerup',e=>{if(!sw||e.pointerId!=sw.pid)return;const s=sw;sw=null;
 const{id,d}=s.rw.dataset;
 if(!s.drag){if(s.base)closeOpen();else openSheet(id);return}
 const x=s.base+s.dx;s.b.style.transition='transform .2s';
 if(x>90){s.b.style.transform='';openRow=null;setTimeout(()=>toggleDone(id,d),150)}
 else if(x<-60){s.b.style.transform=`translateX(${-openW(s.rw)}px)`;openRow=s.rw}
 else{s.b.style.transform='';if(openRow==s.rw)openRow=null}});
document.addEventListener('pointercancel',()=>{if(sw&&sw.drag){sw.b.style.transition='transform .2s';sw.b.style.transform=sw.base?`translateX(${sw.base}px)`:''}sw=null});

/* ---------- clicks ---------- */
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-a]');if(a){const rw=a.closest('.rw');openRow=null;a.dataset.a=='later'?later(rw.dataset.id):del(rw.dataset.id);return}
 const up=e.target.closest('[data-up]');if(up){upView=up.dataset.up;renderUpcoming();return}
 const nav=e.target.closest('[data-nav]');if(nav){upMonth=new Date(upMonth.getFullYear(),upMonth.getMonth()+ +nav.dataset.nav,1);
  const t=todayD();sel=upMonth.getFullYear()==t.getFullYear()&&upMonth.getMonth()==t.getMonth()?T():ymd(upMonth);renderUpcoming();return}
 const wk=e.target.closest('[data-wk]');if(wk){sel=ymd(addDays(fromYmd(sel),+wk.dataset.wk));const d=fromYmd(sel);upMonth=new Date(d.getFullYear(),d.getMonth(),1);renderUpcoming();return}
 const day=e.target.closest('[data-day]');if(day){sel=day.dataset.day;renderUpcoming();return}
 const ad=e.target.closest('[data-add]');if(ad){setAddDate(ad.dataset.add);$('q').focus();return}
 const rs=e.target.closest('[data-restore]');if(rs){const i=db.deleted.findIndex(t=>t.id==rs.dataset.restore);if(i>=0){const[t]=db.deleted.splice(i,1);delete t.deletedAt;db.tasks.push(t);save();render();toast('Restored to '+dayLabel(t.date))}return}
 const tb=e.target.closest('[data-tab]');if(tb){const n=tb.dataset.tab;
  /* inner screen: Today button slides the Today side in and out */
  if(n=='today')solo=wideMq.matches&&(tab=='today'||tab=='upcoming')?!solo:false;tab=n;closeSheet();render();const v=$('v-'+n);if(v)v.scrollTop=0}});
$('sw').onclick=()=>{solo=!solo;render()};

/* ---------- input bar ---------- */
function setAddDate(d){addDate=d;const c=$('chip');if(d){c.hidden=false;c.innerHTML=`${short(d)}<button type="button" aria-label="Clear date">${icon('x')}</button>`;c.querySelector('button').onclick=()=>setAddDate(null)}else c.hidden=true}
let micHint=false;
function syncGo(){$('go').innerHTML=icon($('q').value.trim()?'arrow-up':'microphone');$('go').setAttribute('aria-label',$('q').value.trim()?'Add':'Speak')}
$('q').addEventListener('input',syncGo);
$('inp').addEventListener('submit',e=>{e.preventDefault();const v=$('q').value.trim();
 if(!v){$('q').focus();if(!micHint){micHint=true;toast('Tap the 🎤 on the keyboard to speak')}return}
 add(v);$('q').value='';syncGo();$('q').blur()});

/* ---------- layout + tab bar ---------- */
/* soft foggy fade when the tab changes (screens only — buttons never animate) */
const calm=matchMedia('(prefers-reduced-motion: reduce)');let shownTab=tab;
function fog(){if(tab==shownTab)return;const was=shownTab;shownTab=tab;
 const inSplit=n=>n=='today'||n=='upcoming';if(wideMq.matches&&inSplit(was)&&inSplit(tab))return;
 const el=inSplit(tab)?(wideMq.matches?$('split'):$('v-'+tab)):$('v-'+tab);if(!el.animate||calm.matches)return;
 el.animate([{opacity:0,filter:'blur(10px)'},{opacity:1,filter:'blur(0)'}],{duration:280,easing:'cubic-bezier(.2,.6,.3,1)'})}
function render(){
 const wide=wideMq.matches,inSplit=tab=='today'||tab=='upcoming';
 $('split').classList.toggle('on',inSplit);$('split').classList.toggle('solo',wide&&solo);
 $('v-today').classList.toggle('on',tab=='today');$('v-upcoming').classList.toggle('on',tab=='upcoming');
 $('v-notes').classList.toggle('on',tab=='notes');$('v-me').classList.toggle('on',tab=='me');
 $('sw').innerHTML=icon(solo?'layout-sidebar-left-expand':'layout-sidebar-left-collapse');
 const lit=n=>wide&&inSplit?(n=='upcoming'||(n=='today'&&!solo)):n==tab;
 $('tb').innerHTML=[['today','sun','Today'],['upcoming','calendar','Upcoming'],['notes','notes','Notes'],['me','user','Me']].map(([n,i,l])=>`<button data-tab="${n}" class="${lit(n)?'on':''}">${icon(i)}${l}</button>`).join('');
 openRow=null;renderToday();renderUpcoming();renderNotes();renderMe();fog()}
wideMq.addEventListener('change',render);

/* keep "next is … in 1h 20m" and the date fresh */
let lastDay=T();
setInterval(()=>{if(document.hidden||sw||openRow||!$('sheet').hidden)return;if(T()!=lastDay){lastDay=T();sel=T();render()}else renderToday()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('sheet').hidden){if(T()!=lastDay){lastDay=T();sel=T()}render()}});

syncGo();render();
if('serviceWorker' in navigator&&location.protocol!='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
