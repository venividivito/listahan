/* === PASTE YOUR FIREBASE CONFIG HERE (Firebase console > Project settings > Your apps) === */
const firebaseConfig={
 apiKey:"AIzaSyDAM6txs1wGfo5txeVuBoRWoOqGjaEU9Gk",
 authDomain:"tab-tracker-94932.firebaseapp.com",
 projectId:"tab-tracker-94932",
 storageBucket:"tab-tracker-94932.firebasestorage.app",
 messagingSenderId:"6857630729",
 appId:"1:6857630729:web:731df10fad6f4f6d0a04d8"
};
/* ============================================================================ */
// Cloudinary receipt storage: cloud name and an UNSIGNED upload preset name
const CLOUDINARY={cloud:'czzsvajf',preset:'listahan'};
// Receipt scanning (Firebase AI Logic): reCAPTCHA Enterprise site key for App Check. Empty = App Check off.
const RECAPTCHA_KEY='6Lf6sgwuAAAAADnFPuNoj23TKd-ML_Z9auBcL80w';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));

/* ---------- security: event delegation (no inline handlers, so the CSP can forbid inline script) ----------
   Markup carries only escaped data-* attributes; the handlers below are the only code that runs. */
const ACT=Object.create(null),INP=Object.create(null),CHG=Object.create(null),KEY=Object.create(null),PTR=Object.create(null);
const at=(t,n,...v)=>`data-${t}="${n}"${v.map((x,i)=>` data-${'abc'[i]}="${esc(x)}"`).join('')}`;
const route=(map,attr)=>e=>{const el=e.target instanceof Element?e.target.closest(`[data-${attr}]`):null,f=el&&map[el.dataset[attr]];if(f)f(el,e)};
document.addEventListener('click',route(ACT,'act'));
document.addEventListener('input',route(INP,'in'));
document.addEventListener('change',route(CHG,'ch'));
document.addEventListener('keydown',route(KEY,'kd'));
document.addEventListener('pointerdown',route(PTR,'pd'));

/* ---------- security: validation of everything that comes back from Firestore ----------
   Rules are the real gate, but any signed-in contributor can write documents, so the UI never trusts
   shapes, lengths or URLs. Everything is coerced to the expected type before it is rendered. */
const ID_RE=/^[A-Za-z0-9_-]{1,64}$/,EMAIL_RE=/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/,DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const LIM={name:100,team:60,place:200,note:200,cat:60,label:100,item:200,email:254,receipts:10,attendees:100,items:200,extras:50};
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const num=(v,max=1e9)=>{v=typeof v==='number'?v:parseFloat(v);return Number.isFinite(v)?Math.min(Math.max(v,-max),max):0};
const strs=(v,n)=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,n).map(x=>x.slice(0,LIM.name)):[];
const list=(v,n)=>Array.isArray(v)?v.slice(0,n).map(x=>x&&typeof x==='object'?x:{}):[];
// Only https images from our Cloudinary account (and Google profile photos) are ever loaded.
function safeUrl(u,avatar){
 try{const x=new URL(String(u));if(x.protocol!=='https:'||x.username||x.password||x.port)return '';
  if(x.hostname==='res.cloudinary.com'&&x.pathname.startsWith('/'+CLOUDINARY.cloud+'/'))return x.href;
  if(avatar&&/^lh[0-9]\.googleusercontent\.com$/.test(x.hostname))return x.href}catch{}
 return ''}
const urls=v=>(Array.isArray(v)?v:[]).slice(0,LIM.receipts).map(u=>safeUrl(u)).filter(Boolean);
const normMember=d=>({id:d.id,name:str(d.name,LIM.name)||'Unnamed',created:num(d.created,1e14)});
const normPay=d=>({id:d.id,from:str(d.from,LIM.name),to:str(d.to,LIM.name),amount:Math.max(num(d.amount,1e7),0),note:str(d.note,LIM.note),date:str(d.date,10),
 created:num(d.created,1e14),meal:str(d.meal,LIM.name),receipts:urls(d.receipts)});
const normMeal=d=>({id:d.id,uid:str(d.uid,128),category:Object.hasOwn(CAT,d.category)?d.category:'meal',catName:str(d.catName,LIM.cat),date:str(d.date,10),place:str(d.place,LIM.place),
 payer:str(d.payer,LIM.name),attendees:strs(d.attendees,LIM.attendees),total:num(d.total),created:num(d.created,1e14),
 items:list(d.items,LIM.items).map(i=>({name:str(i.name,LIM.item),price:num(i.price,1e8),people:strs(i.people,LIM.attendees)})),
 extras:list(d.extras,LIM.extras).map(x=>({label:str(x.label,LIM.label),type:x.type==='amt'?'amt':'pct',value:num(x.value,1e8),sign:x.sign<0?-1:1,mode:x.mode==='equal'?'equal':'prop',people:strs(x.people,LIM.attendees)})),
 receipts:urls(d.receipts||(d.receipt?[d.receipt]:[]))});
const normTeam=d=>({id:d.id,name:str(d.name,LIM.team)||'Team',created:num(d.created,1e14),legacy:d.legacy===true});
const normRole=d=>({role:d.role==='admin'?'admin':'contributor',member:str(d.member,LIM.name),
 teams:Object.fromEntries(Object.entries(d.teams&&typeof d.teams==='object'?d.teams:{}).filter(([k,v])=>ID_RE.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,LIM.name)]))});
const NORM={members:normMember,meals:normMeal,payments:normPay};
const clean=(v,n)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const peso=n=>(n<0?'-':'')+'₱'+(Math.abs(n)/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
let db=null,members=[],meals=[],pays=[],tab='bal',me='',D=null,expd={},armed='',seenM=false;
let pay={from:'',to:'',amount:'',note:'',receipts:[]},paying=false,user=null,role=null,roles=[];
let teams=[],cur=ID_RE.test(localStorage.getItem('team')||'')?localStorage.getItem('team'):'',legacy=false,tsubs=[],gsubs=[];
const T=n=>db.collection('teams').doc(cur).collection(n);
const tname=id=>(teams.find(t=>t.id===id)||{name:'Team'}).name;
function openTeam(id){
 cur=ID_RE.test(id||'')?id:'';tsubs.forEach(f=>f());tsubs=[];localStorage.setItem('team',cur);
 members=[];meals=[];pays=[];seenM=false;D=null;bp=null;expd={};fcat='all';q='';me=role?.teams?.[cur]||'';if(tab==='new')tab='meals';
 if(cur){const s=(n,f)=>tsubs.push(T(n).onSnapshot(x=>{f(x.docs.map(d=>NORM[n]({id:d.id,...d.data()})));
  if(n==='members'&&!seenM){seenM=true;if(!members.length&&isAdmin())tab='people'}onData()},e=>toast('Sync problem: '+(e.code||''))));
  s('members',v=>members=v.sort((a,b)=>(a.created||0)-(b.created||0)));s('meals',v=>meals=v);s('payments',v=>pays=v)}
 draw()}
function setTeams(list){teams=list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
 const id=teams.some(t=>t.id===cur)?cur:(teams[0]?.id||'');
 if(id!==cur||(id&&!tsubs.length))openTeam(id);else{me=role?.teams?.[cur]||'';draw()}}
let autoNet=localStorage.getItem('autoNet')!=='0';
let netT;
function setNet(v){autoNet=v;localStorage.setItem('autoNet',v?'1':'0');clearTimeout(netT);netT=setTimeout(draw,220)}
function setTheme(p,m){palette=p;mode=m;localStorage.setItem('palette',p);localStorage.setItem('mode',m);applyTheme();draw()}
const isAdmin=()=>role?.role==='admin';
const canMeal=m=>isAdmin()||(!!m.uid&&m.uid===user?.uid);
const canPay=(from,to)=>isAdmin()||(!!me&&(from===me||to===me));
const nm=id=>(members.find(m=>m.id===id)||{name:'Former member'}).name;
function toast(t){const e=$('#toast');e.textContent=t;e.className='s';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',2600)}
const opts=(ids,cur,blank)=>(blank?`<option value="">${esc(blank)}</option>`:'')+ids.map(i=>`<option value="${esc(i)}" ${i===cur?'selected':''}>${esc(nm(i))}</option>`).join('');
const sel=(a,b)=>a===b?'selected':'';
const CAT={meal:{icon:'🍽️',name:'Meal',place:'Restaurant',items:'Orders',item:'Item'},transport:{icon:'🚕',name:'Transport',place:'Route or ride (e.g. Grab to office)',items:'Fares & costs',item:'Fare, toll, gas…'},custom:{icon:'🧾',name:'Custom',place:'Description',items:'Items',item:'Item'}};
const catOf=m=>Object.hasOwn(CAT,m.category)?m.category:'meal';
const catName=m=>catOf(m)==='custom'?(m.catName||'Other'):CAT[catOf(m)].name;
const title=m=>`${CAT[catOf(m)].icon} ${m.place||catName(m)}`;
let fcat='all';

/* ---------- calculation ---------- */
function calc(m){
 const A=m.attendees||[],S=Object.create(null),E=Object.create(null),L=[];A.forEach(p=>{S[p]=0;E[p]=0});
 (m.items||[]).forEach(it=>{const ps=(it.people||[]).filter(p=>p in S);if(!ps.length)return;const c=Math.round((+it.price||0)*100)/ps.length;ps.forEach(p=>S[p]+=c)});
 (m.extras||[]).forEach(x=>{const ps=(x.people||[]).filter(p=>p in S);if(!ps.length)return;
  const b=ps.reduce((a,p)=>a+S[p],0),v=+x.value||0,amt=(x.type==='pct'?b*v/100:v*100)*(x.sign<0?-1:1);
  ps.forEach(p=>{const w=(x.mode==='equal'||b===0)?1/ps.length:S[p]/b;E[p]+=amt*w;L.push({p,label:x.label,v:amt*w})})});
 const f=A.map(p=>S[p]+E[p]),sum=Math.round(f.reduce((a,b)=>a+b,0)),t=f.map(Math.floor);let r=sum-t.reduce((a,b)=>a+b,0);
 f.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(r>0){t[i]++;r--}});
 return{S,E,L,tot:t,sum};
}
function ledger(){
 const pool=Object.create(null),dir=Object.create(null),owed=Object.create(null),paid=Object.create(null),st=Object.create(null);
 pays.forEach(p=>{const k=p.from+'>'+p.to,c=Math.round(p.amount*100);paid[k]=(paid[k]||0)+c;
  if(p.meal)dir[p.meal+'|'+p.from]=(dir[p.meal+'|'+p.from]||0)+c;else pool[k]=(pool[k]||0)+c});
 [...meals].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.created||0)-(b.created||0)).forEach(m=>{
  const c=calc(m);st[m.id]=Object.create(null);
  m.attendees.forEach((p,i)=>{if(p===m.payer)return;const k=p+'>'+m.payer,o=c.tot[i];owed[k]=(owed[k]||0)+o;
   const dd=dir[m.id+'|'+p]||0,d=Math.min(o,dd);pool[k]=(pool[k]||0)+(dd-d);
   const x=Math.min(o-d,pool[k]);pool[k]-=x;st[m.id][p]={o,paid:d+x}})});
 const rows=[];
 members.forEach((a,i)=>members.slice(i+1).forEach(b=>{
  let x=(owed[a.id+'>'+b.id]||0)-(paid[a.id+'>'+b.id]||0),y=(owed[b.id+'>'+a.id]||0)-(paid[b.id+'>'+a.id]||0);
  if(autoNet){const n=x-y;if(n>0)rows.push({d:a.id,c:b.id,n});else if(n<0)rows.push({d:b.id,c:a.id,n:-n});return}
  // overpayment in one direction becomes a debt in the other
  if(x<0){y-=x;x=0}if(y<0){x-=y;y=0}
  if(x>0)rows.push({d:a.id,c:b.id,n:x});if(y>0)rows.push({d:b.id,c:a.id,n:y})}));
 return{st,rows};
}
const status=(m,L)=>{const r=Object.values(L.st[m.id]||{});return !r.length?'—':r.every(x=>x.paid>=x.o)?'Settled':r.some(x=>x.paid>0)?'Partial':'Unpaid'};

/* ---------- navigation ---------- */
const greet=()=>{const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'};
let meHtml='',lgIn=false;
/* A wide pen follows the letter outlines in order, so each letter fills in as if written.
   Driven from JS because browsers don't repaint CSS animations inside an SVG mask reliably. */
let lgRaf=0,lgLens=[],lgTot=0,lgInt=null;
function drawLogo(t){
 const ms=document.querySelectorAll('.mk');if(!ms.length)return;
 const g=Math.min(t/.84,1),u=(1-Math.cos(Math.PI*g))/2*.6+g*.4,w=300+400*Math.max(0,(t-.84)/.16);
 let from=0;ms.forEach((m,i)=>{const L=lgLens[i],p=Math.min(Math.max((u*lgTot-from)/L,0),1);from+=L;
  m.style.strokeDasharray=`${L}px ${L*2}px`;m.style.strokeDashoffset=(L*(1-p))+'px';m.style.strokeWidth=w+'px'})}
function setLogo(mode){const l=$('#logo');if(!l)return;cancelAnimationFrame(lgRaf);clearInterval(lgInt);
 const ms=document.querySelectorAll('.mk');ms.forEach(m=>m.style.cssText='');
 lgLens=[...ms].map((_,i)=>Math.ceil($('#lp'+i).getTotalLength())+2);lgTot=lgLens.reduce((a,b)=>a+b,0);
 if(mode!=='play'||matchMedia('(prefers-reduced-motion: reduce)').matches){l.className='logo still';return}
 drawLogo(0);l.className='logo play';
 const t0=performance.now(),D=2800;
 const step=now=>{const t=Math.min((now-t0)/D,1);drawLogo(t);if(t<1)lgRaf=requestAnimationFrame(step);else{ms.forEach(m=>m.style.cssText='');l.className='logo still'}};
 lgRaf=requestAnimationFrame(step);
 lgInt=setInterval(()=>{if(l){cancelAnimationFrame(lgRaf);drawLogo(0);l.className='logo play';const t0=performance.now(),D=2800;const step=now=>{const t=Math.min((now-t0)/D,1);drawLogo(t);if(t<1)lgRaf=requestAnimationFrame(step);else{ms.forEach(m=>m.style.cssText='');l.className='logo still'}};lgRaf=requestAnimationFrame(step)}},30000)}
const playLogo=()=>setLogo('play'),logoStill=()=>setLogo('still');
function renderMe(){
 const el=$('#me');if(!el)return;
 const name=(me&&members.some(m=>m.id===me)?nm(me):(user?.displayName||user?.email||'').split(/[\s@]/)[0])||'there';
 const h=user?`<span class="gr">${greet()}, ${esc(name)}!</span><button class="av" title="Profile photo" aria-label="Profile photo" ${at('act','openPd')}>${avImg(user.photoURL)}<i>✎</i></button>`:'';
 if(h!==meHtml){meHtml=h;el.innerHTML=h}}

/* ---------- profile photo: view, edit (drag/zoom), update, delete ---------- */
const PH='<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/></svg>';
const avImg=u=>{const s=u&&safeUrl(u,true);return s?`<img src="${esc(s)}" alt="Your photo" referrerpolicy="no-referrer">`:PH};
let pdArm=false,pdBusy=false,E=null;
function openPd(){pdArm=false;pdView();$('#pd').hidden=false;document.body.style.overflow='hidden'}
function closePd(){if(pdBusy)return;dropCrop();$('#pd').hidden=true;document.body.style.overflow=''}
function dropCrop(){if(E?.blobUrl)URL.revokeObjectURL(E.blobUrl);E=null}
function pdView(){dropCrop();const u=user?.photoURL;
 $('#pd .dlg').innerHTML=`<button class="cls" ${at('act','closePd')} aria-label="Close">✕</button><h2 id="pdt">Profile photo</h2><div class="pbig">${avImg(u)}</div>
 <div class="pact">${u?`<button ${at('act','editPhoto')}>Edit</button>`:''}<button ${at('act','pickFile')}>${u?'Update':'Add photo'}</button>${u?`<button class="del" ${at('act','delPhoto')}>${pdArm?'Confirm':'Delete'}</button>`:''}</div>
 <input type="file" id="pdf" accept="image/*" hidden ${at('ch','pickPhoto')}>`}
async function delPhoto(){if(pdBusy)return;
 if(!pdArm){pdArm=true;pdView();setTimeout(()=>{if(pdArm){pdArm=false;if(!E&&!$('#pd').hidden)pdView()}},3000);return}
 pdArm=false;pdBusy=true;
 try{await clearPhoto();meHtml='';renderMe();pdBusy=false;pdView();toast('Photo removed')}
 catch(e){pdBusy=false;toast('Could not remove photo: '+(e.message||e.code||''))}}
// the SDK sends photoURL:null, which the server ignores; deleteAttribute is the documented way to clear it
async function clearPhoto(){const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key='+encodeURIComponent(firebase.app().options.apiKey),
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:await user.getIdToken(),deleteAttribute:['PHOTO_URL']})}),j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.error?.message||r.status);
 await user.reload();if(user.photoURL)throw new Error('photo is still set')}
// photoURL carries the uncropped original and the crop in its #fragment so Edit can re-crop on any device
function photoMeta(u){const [b,h='']=u.split('#'),q=new URLSearchParams(h),o=q.get('o');
 return {src:safeUrl(o,true)||safeUrl(b.replace(/=s\d+-c$/,'=s800-c'),true),z:Math.min(4,Math.max(1,+q.get('z')||1)),x:num(q.get('x'),5),y:num(q.get('y'),5)}}
function editPhoto(){const m=photoMeta(user.photoURL);if(!m.src)return toast('This photo can’t be edited. Use Update to choose a new one.');openCrop({src:m.src,orig:m.src,z:m.z,nx:m.x,ny:m.y})}
async function pickPhoto(inp){const f=inp.files[0];inp.value='';if(!f)return;
 if(!imgOk(f))return;
 try{const b=await shrink(f),u=URL.createObjectURL(b);openCrop({src:u,blob:b,blobUrl:u,z:1,nx:0,ny:0})}
 catch(e){toast(e.message||'Could not open image')}}
function openCrop(o){dropCrop();E=o;
 $('#pd .dlg').innerHTML=`<h2 id="pdt">Adjust photo</h2><div class="mu">Drag to reposition. Pinch, scroll or use the slider to zoom.</div>
 <div class="crop" id="crop"><img id="cimg" alt="" draggable="false"></div>
 <input type="range" id="cz" min="1" max="4" step="0.01" value="${num(E.z,4)}" aria-label="Zoom" ${at('in','cropZoom')}>
 <div class="dact"><button class="tb" ${at('act','pdCancel')}>Cancel</button><button class="fb" id="csv" ${at('act','saveCrop')} disabled>Save</button></div>`;
 const i=$('#cimg');if(!o.blob)i.crossOrigin='anonymous';
 i.onload=()=>{if(E!==o)return;E.w=i.naturalWidth;E.h=i.naturalHeight;E.V=$('#crop').clientWidth;const s=sc();E.tx=E.nx*E.w*s;E.ty=E.ny*E.h*s;cropDraw();$('#csv').disabled=false};
 i.onerror=()=>{if(E!==o)return;toast('Could not load the photo');pdView()};
 i.src=o.src;cropPointers($('#crop'))}
const sc=()=>E.V/Math.min(E.w,E.h)*E.z;
// keep the image covering the circle, then position it
function cropDraw(){const s=sc(),mx=(E.w*s-E.V)/2,my=(E.h*s-E.V)/2,i=$('#cimg'),r=$('#cz');
 E.tx=Math.max(-mx,Math.min(mx,E.tx));E.ty=Math.max(-my,Math.min(my,E.ty));
 i.style.width=E.w*s+'px';i.style.height=E.h*s+'px';i.style.transform=`translate(calc(-50% + ${E.tx}px),calc(-50% + ${E.ty}px))`;
 if(r&&+r.value!==E.z)r.value=E.z}
function cropZoom(z){if(!E?.w)return;z=Math.max(1,Math.min(4,z));E.tx*=z/E.z;E.ty*=z/E.z;E.z=z;cropDraw()}
// one pointer drags; two pointers pinch-zoom and pan around their midpoint
function cropPointers(el){const P=new Map();let st;
 const mid=p=>({x:p.reduce((a,q)=>a+q.x,0)/p.length,y:p.reduce((a,q)=>a+q.y,0)/p.length}),
  dist=p=>p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0,
  snap=()=>{const p=[...P.values()];st={z:E.z,tx:E.tx,ty:E.ty,d:dist(p),m:mid(p)}};
 el.onpointerdown=e=>{if(!E?.w)return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});try{el.setPointerCapture(e.pointerId)}catch{}snap()};
 el.onpointermove=e=>{if(!P.has(e.pointerId)||!E?.w)return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=[...P.values()],m=mid(p),z=p.length>1&&st.d?Math.max(1,Math.min(4,st.z*dist(p)/st.d)):st.z;
  E.z=z;E.tx=st.tx*z/st.z+m.x-st.m.x;E.ty=st.ty*z/st.z+m.y-st.m.y;cropDraw()};
 el.onpointerup=el.onpointercancel=e=>{P.delete(e.pointerId);if(P.size)snap()};
 el.onwheel=e=>{e.preventDefault();if(E?.w)cropZoom(E.z*Math.exp(-e.deltaY*.0015))}}
async function saveCrop(){if(!E?.w||pdBusy)return;const b=$('#csv');pdBusy=true;b.disabled=true;b.textContent='Saving…';
 try{const s=sc(),n=E.V/s,cx=E.w/2-E.tx/s,cy=E.h/2-E.ty/s,c=document.createElement('canvas');c.width=c.height=512;
  c.getContext('2d').drawImage($('#cimg'),cx-n/2,cy-n/2,n,n,0,0,512,512);
  const blob=await new Promise((ok,no)=>c.toBlob(x=>x?ok(x):no(new Error('Could not process image')),'image/jpeg',.88));
  const orig=E.blob?await uploadReceipt(E.blob):E.orig,url=await uploadReceipt(blob);
  const q=new URLSearchParams({o:orig,z:E.z.toFixed(3),x:(E.tx/(E.w*s)).toFixed(4),y:(E.ty/(E.h*s)).toFixed(4)});
  await user.updateProfile({photoURL:url+'#'+q});meHtml='';renderMe();pdBusy=false;pdView();toast('Photo updated')}
 catch(e){pdBusy=false;b.disabled=false;b.textContent='Save';
  toast(e.name==='SecurityError'?'This photo can’t be edited here. Use Update to choose it again.':'Could not save photo: '+(e.message||e.code||''))}}
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pd').hidden)closePd()});

/* ---------- navigation ---------- */
function nav(){
 renderMe();
 const ks=['bal','meals','people'],on=tab==='new'?'meals':tab,nb=$('#nav').children;
 if(nb.length===ks.length)ks.forEach((k,i)=>nb[i].classList.toggle('on',k===on));
 else $('#nav').innerHTML=[['bal','Balances'],['meals','Expenses'],['people','People']].map(([k,l])=>`<button class="${on===k?'on':''}" ${at('act','go',k)}>${l}</button>`).join('')}
function tog(k){expd[k]=!expd[k];draw()}
let goT;
function go(t){if(t==='new'&&!D)D=newDraft();if(t==='bal')bp=null;const same=t===tab;tab=t;clearTimeout(goT);
 const a=$('#app');if(same||matchMedia('(prefers-reduced-motion: reduce)').matches||!a.children.length){draw();return}
 nav();a.classList.add('out');
 goT=setTimeout(()=>{draw();a.classList.remove('out');a.classList.add('in');a.addEventListener('animationend',()=>a.classList.remove('in'),{once:true})},120)}
function draw(){const f=document.activeElement?.id==='q',ev=$('#ed')?.value;nav();
 if(!cur&&tab!=='people'){$('#app').innerHTML='<div class="card">No team selected. Create one under <b>People</b>.</div>';return}
 $('#app').innerHTML=({bal:vBal,meals:vMeals,new:vNew,people:vPeople})[tab]();if(tab==='new')pv();if(tab==='meals'){ml();if(f){const i=$('#q');i?.focus();i?.setSelectionRange(q.length,q.length)}}
 // keep an in-progress rename when live data triggers a redraw
 if(ev!=null&&$('#ed')){$('#ed').value=ev;$('#ed').focus()}}
function onData(){if(tab!=='new')draw()}
function arm(k,fn){if(armed!==k){armed=k;draw();setTimeout(()=>{if(armed===k){armed='';if(tab!=='new')draw()}},3000);return}armed='';fn()}
const dlabel=(k,t)=>armed===k?'Tap again to confirm':t;

/* ---------- balances ---------- */
let bp=null;
const newest=(a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created||0)-(a.created||0);
const owes=(L,id)=>L.rows.filter(r=>r.d===id).reduce((a,r)=>a+r.n,0);
const owedTo=(L,id)=>L.rows.filter(r=>r.c===id).reduce((a,r)=>a+r.n,0);
function det(m,p){const c=calc(m),i=m.attendees.indexOf(p);let h='';
 m.items.forEach(it=>{if(it.people.includes(p)){const n=it.people.length;h+=`<div class="pr"><span>${esc(it.name||'Item')}${n>1?` <span class="mu">(1/${n} of ${peso(it.price*100)})</span>`:''}</span><span>${peso(it.price*100/n)}</span></div>`}});
 c.L.filter(l=>l.p===p).forEach(l=>{h+=`<div class="pr"><span>${esc(l.label||'Extra')}</span><span class="${l.v<0?'ok':''}">${peso(l.v)}</span></div>`});
 return h+`<div class="pr tt"><span>Total</span><b>${peso(c.tot[i])}</b></div>`}
function vBal(){
 const L=ledger(),ids=members.map(m=>m.id);
 if(!ids.length)return '<div class="card">Start by adding your teammates under <b>People</b>.</div>';
 if(bp&&ids.includes(bp))return vPerson(L,bp);
 let h='';
 if(me&&ids.includes(me)){h+=`<div class="card"><h2>${esc(nm(me))}, your summary</h2><div class="pr"><span>You owe</span><b class="${owes(L,me)?'bad':''}">${peso(owes(L,me))}</b></div><div class="pr"><span>Owed to you</span><b class="${owedTo(L,me)?'ok':''}">${peso(owedTo(L,me))}</b></div></div>`}
 const list=ids.map(id=>({id,ow:owes(L,id),ot:owedTo(L,id),net:owedTo(L,id)-owes(L,id)})).sort((a,b)=>autoNet?Math.abs(b.net)-Math.abs(a.net):(b.ow+b.ot)-(a.ow+a.ot));
 const amt=x=>autoNet?`<span class="${x.net<0?'bad':x.net>0?'ok':'mu'}">${x.net<0?'owes '+peso(-x.net):x.net>0?'is owed '+peso(x.net):'settled'}</span>`
  :`<span style="text-align:right">${!x.ow&&!x.ot?'<span class="mu">settled</span>':[x.ow?`<span class="bad">owes ${peso(x.ow)}</span>`:'',x.ot?`<span class="ok">is owed ${peso(x.ot)}</span>`:''].filter(Boolean).join('<br>')}</span>`;
 h+=`<div class="card"><div class="hd" style="cursor:default;margin-bottom:6px"><h2 style="margin:0">Balances</h2><label class="sw"><span>Auto-net</span><input type="checkbox" ${autoNet?'checked':''} ${at('ch','setNet')}><i></i></label></div><div class="mu">${autoNet?'Mutual debts are offset against each other.':'Mutual debts are shown separately, not offset.'} Tap a name to see their breakdown and record payments.</div>`+list.map(x=>`<div class="pr hd" ${at('pd','ripple')} ${at('act','tapRow',x.id)}><span><b>${esc(nm(x.id))}</b></span>${amt(x)}<span class="mu">›</span></div>`).join('')+'</div>';
 const ps=[...pays].sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,10);
 if(ps.length)h+=`<div class="hd" style="margin:16px 2px 8px" ${at('act','tog','rp')}><b>${expd.rp?'▾':'▸'} Recent payments (${ps.length})</b><span class="mu">Latest 10</span></div>`+(expd.rp?`<div class="card">`+ps.map(payRow).join('')+'</div>':'');
 return h;
}
const payRow=p=>`<div class="pr"><span>${esc(nm(p.from))} → ${esc(nm(p.to))}<br><span class="mu">${esc(p.date)} ${esc(p.note||'')}</span>${(p.receipts||[]).length?`<br>${p.receipts.map((u,i)=>`<button class="sm" ${at('act','openPayReceipt',p.id,i)}>📎 Attachment${p.receipts.length>1?' '+(i+1):''}</button>`).join(' ')}`:''}</span><b>${peso(Math.round(p.amount*100))}</b>${canPay(p.from,p.to)?`<button class="sm" ${at('act','delPay',p.id)}>${dlabel('p'+p.id,'✕')}</button>`:''}</div>`;
const openPayReceipt=(id,i)=>viewReceipt(pays.find(p=>p.id===id)?.receipts||[],i);
const blankPay=(f,t,n)=>({from:f,to:t,amount:n?(n/100).toFixed(2):'',note:'',receipts:[]});
// Material touch ripple: a circle grows from the touch point until it covers the row
function ripple(e,el){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const r=el.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,d=2*Math.hypot(Math.max(x,r.width-x),Math.max(y,r.height-y)),s=document.createElement('span');
 s.className='rp';s.style.cssText=`width:${d}px;height:${d}px;left:${x-d/2}px;top:${y-d/2}px`;el.appendChild(s);
 s.addEventListener('animationend',()=>{s.style.transition='opacity .2s';s.style.opacity=0;setTimeout(()=>s.remove(),200)})}
// brief delay so the ripple is seen before the person view replaces the list
function tapRow(el,id){if(!el.querySelector('.rp'))el.classList.add('tapped');setTimeout(()=>openP(id),150)}
function openP(id){bp=id;const r=ledger().rows.filter(x=>canPay(x.d,x.c));const o=r.find(x=>x.d===id)||r.find(x=>x.c===id);
 pay.receipts.forEach(r=>r.prev&&URL.revokeObjectURL(r.prev));
 pay=o?blankPay(o.d,o.c,o.n):blankPay('',isAdmin()?'':me);draw();scrollTo(0,0)}
// contributors must always be one side of the payment
function setPayParty(k,v){pay[k]=v;if(!isAdmin()&&me&&pay.from!==me&&pay.to!==me)pay[k==='from'?'to':'from']=me;draw()}
function mrow({m,p,r}){const k=m.id+p,left=r.o-r.paid,st=left<=0?'Settled':r.paid>0?'Partial':'Unpaid';
 return `<div class="sub"><div class="hd" ${at('act','tog',k)}><div><b>${esc(title(m))}</b><div class="mu">${esc(m.date)} · ${esc(catName(m))} · ${esc(nm(p))} → ${esc(nm(m.payer))}</div></div><div style="text-align:right"><b>${peso(r.o)}</b><br><span class="badge ${st}">${st==='Partial'?'Partial · '+peso(left)+' left':st}</span></div></div>`+
 (expd[k]?`<div style="margin-top:8px">${det(m,p)}<div class="row" style="margin-top:8px"><button class="sm" ${at('act','cp',m.id,p)}>Copy message</button>${left>0&&canPay(p,m.payer)?`<button class="sm" ${at('act','markPaid',m.id,p,left)}>Mark paid</button>`:''}</div></div>`:'')+'</div>'}
function vPerson(L,id){
 const ids=members.map(m=>m.id),ow=L.rows.filter(r=>r.d===id),ot=L.rows.filter(r=>r.c===id);
 let h=`<button class="sm" ${at('act','allBal')}>← All balances</button><div class="card" style="margin-top:10px"><h2>${esc(nm(id))}</h2>`;
 h+=ow.map(r=>`<div class="pr"><span>Owes ${esc(nm(r.c))}</span><b class="bad">${peso(r.n)}</b>${canPay(r.d,r.c)?`<button class="sm" ${at('act','setPay',r.d,r.c,r.n)}>Pay</button>`:''}</div>`).join('');
 h+=ot.map(r=>`<div class="pr"><span>${esc(nm(r.d))} owes them</span><b class="ok">${peso(r.n)}</b>${canPay(r.d,r.c)?`<button class="sm" ${at('act','setPay',r.d,r.c,r.n)}>Receive</button>`:''}</div>`).join('');
 if(!ow.length&&!ot.length)h+='<p class="mu">All settled up. 🎉</p>';
 h+=`<p class="mu">${autoNet?'Totals are netted between each pair of people.':'Auto-net is off: debts in each direction are shown separately.'}</p></div>`;
 if(isAdmin()||id===me||[...ow,...ot].some(r=>canPay(r.d,r.c)))h+=`<div class="card"><h2>Record a payment</h2>${isAdmin()?'':'<div class="mu">You can only log payments to or from you.</div>'}<div class="row"><select ${at('ch','payFrom')}>${opts(ids,pay.from,'From')}</select><select ${at('ch','payTo')}>${opts(ids,pay.to,'To')}</select></div>
 <div class="row"><input inputmode="decimal" maxlength="12" placeholder="Amount ₱" value="${esc(pay.amount)}" ${at('in','payAmount')}><input maxlength="${LIM.note}" placeholder="Note (GCash, cash…)" value="${esc(pay.note)}" ${at('in','payNote')}></div>
 <div class="lb">Attachments</div>${receiptPicker(pay.receipts,'pay')}
 <button class="pri" ${at('act','savePay')}>${paying?'Saving…':'Save payment'}</button></div>`;
 const mine=[],theirs=[];
 [...meals].sort(newest).forEach(m=>{const s=L.st[m.id]||{};
  if(m.payer===id)Object.keys(s).forEach(p=>theirs.push({m,p,r:s[p]}));else if(s[id])mine.push({m,p:id,r:s[id]})});
 const sortOpen=a=>[...a].sort((x,y)=>((y.r.o-y.r.paid>0)-(x.r.o-x.r.paid>0)));
 h+=`<div class="card"><h2>Expenses ${esc(nm(id))} owes for</h2><div class="mu">Tap an expense to see the breakdown.</div>${mine.length?sortOpen(mine).map(mrow).join(''):'<p class="mu">None.</p>'}</div>`;
 h+=`<div class="card"><h2>Expenses ${esc(nm(id))} paid for</h2>${theirs.length?sortOpen(theirs).map(mrow).join(''):'<p class="mu">None.</p>'}</div>`;
 const hp=pays.filter(p=>p.from===id||p.to===id).sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,15);
 if(hp.length)h+=`<div class="card"><h2>Payment history</h2>`+hp.map(payRow).join('')+'</div>';
 return h;
}
function setPay(f,t,n){pay.receipts.forEach(r=>r.prev&&URL.revokeObjectURL(r.prev));pay=blankPay(f,t,n);draw();toast('Payment form filled in')}
async function savePay(){if(paying)return;const a=Math.round(parseFloat(pay.amount)*100)/100;
 if(!pay.from||!pay.to||pay.from===pay.to||!Number.isFinite(a)||!(a>0))return toast('Pick two different people and an amount');
 if(a>=1e7)return toast('Amount is too large');
 if(!members.some(m=>m.id===pay.from)||!members.some(m=>m.id===pay.to))return toast('Pick people from this team');
 if(!canPay(pay.from,pay.to))return toast('You can only record payments to or from you');
 paying=true;
 try{const d={from:pay.from,to:pay.to,amount:a,note:clean(pay.note,LIM.note),date:today(),created:Date.now()},rcs=pay.receipts;
  if(rcs.some(r=>r.file)){toast('Uploading attachments…');draw()}
  const urls=[];for(const r of rcs)urls.push(r.url||await uploadReceipt(await shrink(r.file)));
  if(urls.length)d.receipts=urls;
  await T('payments').add(d);rcs.forEach(r=>r.prev&&URL.revokeObjectURL(r.prev));pay={...pay,amount:'',note:'',receipts:[]};toast('Payment saved')}catch(e){toast('Could not save: '+(e.message||e.code||''))}
 paying=false;draw()}
const delPay=id=>arm('p'+id,()=>T('payments').doc(id).delete().catch(()=>toast('Could not delete')));

/* ---------- expenses list ---------- */
function vMeals(){
 return `<button class="pri" style="margin:0 0 10px" ${at('act','addExpense')}>＋ Add expense</button>`+
  (meals.length?`<input id="q" type="search" maxlength="100" placeholder="Search place, person, item, category, date…" value="${esc(q)}" ${at('in','search')} style="margin-bottom:10px">`:'')+'<div id="ml"></div>';
}
let q='';
function ml(){
 const el=$('#ml');if(!el)return;
 if(!meals.length){el.innerHTML='<div class="card mu">No expenses yet. Tap ＋ Add expense to start.</div>';return}
 const L=ledger(),names=a=>a.length?a.map(nm).join(', '):'nobody';
 const cats=['all',...Object.keys(CAT).filter(k=>meals.some(m=>catOf(m)===k))];if(!cats.includes(fcat))fcat='all';
 const terms=q.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const hit=m=>{const s=[m.place,catName(m),m.date,nm(m.payer),...m.attendees.map(nm),...(m.items||[]).map(i=>i.name)].join(' ').toLowerCase();return terms.every(t=>s.includes(t))};
 const list=[...meals].filter(m=>(fcat==='all'||catOf(m)===fcat)&&hit(m)).sort(newest);
 const done=m=>['Settled','—'].includes(status(m,L)),open=list.filter(m=>!done(m)),closed=list.filter(done);
 const fl=cats.length>2?`<div class="chips" style="margin-bottom:10px">${cats.map(k=>`<button type="button" class="chip ${fcat===k?'on':''}" ${at('act','fcat',k)}>${k==='all'?'All':CAT[k].icon+' '+CAT[k].name}</button>`).join('')}</div>`:'';
 const card=m=>{
  const c=calc(m),s=status(m,L),o=expd[m.id],every=a=>a.length>1&&a.length===m.attendees.length?'Everyone':names(a);
  let h=`<div class="card"><div class="hd" ${at('act','tog',m.id)}><div><b>${esc(title(m))}</b><div class="mu">${esc(m.date)} · ${esc(catName(m))} · paid by ${esc(nm(m.payer))}</div><div class="mu" style="color:var(--ac)">${o?'▾ Hide breakdown':'▸ View breakdown'}</div></div><div style="text-align:right"><b>${peso(c.sum)}</b><br><span class="badge ${s}">${s}</span></div></div>`;
  if(o){
   h+=`<div class="sub"><div class="lb">${CAT[catOf(m)].items}</div>`+m.items.map(it=>`<div class="pr"><span>${esc(it.name||'Item')}<br><span class="mu">${esc(every(it.people))}</span></span><b>${peso(it.price*100)}</b></div>`).join('');
   if(m.extras.length){h+=`<div class="lb">Fees, tax, discounts</div>`+m.extras.map(x=>{const t=calc({...m,extras:[x]}).sum-calc({...m,extras:[]}).sum;
    return `<div class="pr"><span>${esc(x.label||'Extra')} <span class="mu">(${x.type==='pct'?num(x.value)+'%':peso(x.value*100)}${x.sign<0?' off':''})</span><br><span class="mu">${esc(every(x.people))} · ${x.mode==='equal'?'split equally':'by spending'}</span></span><b class="${t<0?'ok':''}">${peso(t)}</b></div>`}).join('')}
   h+=`<div class="pr tt"><span>Bill total</span><b>${peso(c.sum)}</b></div>`;
   const rc=m.receipts||(m.receipt?[m.receipt]:[]);
   if(rc.length)h+=`<div class="row" style="margin-top:8px;flex-wrap:wrap">${rc.map((u,i)=>`<button class="sm" ${at('act','openMealReceipt',m.id,i)}>🧾 Receipt${rc.length>1?' '+(i+1):''}</button>`).join('')}</div>`;
   if(m.total){const d=c.sum-Math.round(m.total*100);h+=d===0?'<p class="ok">✓ Matches the receipt</p>':`<p class="bad">⚠ ${peso(Math.abs(d))} ${d>0?'more':'less'} than the receipt total of ${peso(Math.round(m.total*100))}</p>`}
   h+=`<div class="lb" style="margin-top:12px">Per person</div>`+m.attendees.map(p=>{const r=(L.st[m.id]||{})[p],left=r?r.o-r.paid:0;
    return `<div class="sub"><div class="row"><b class="g1">${esc(nm(p))}</b>${p===m.payer?'<span class="mu">paid the bill</span>':`<button class="sm" ${at('act','cp',m.id,p)}>Copy</button>${left>0?!canPay(p,m.payer)?'':`<button class="sm" ${at('act','markPaid',m.id,p,left)}>Mark paid</button>`:'<span class="ok">✓ Paid</span>'}`}</div>${det(m,p)}</div>`}).join('')+
   (canMeal(m)?`<div class="row" style="margin-top:12px"><button class="sm" ${at('act','editMeal',m.id)}>Edit</button><button class="sm" ${at('act','delMeal',m.id)}>${dlabel('m'+m.id,'Delete')}</button></div>`:'')+'</div>'}
  return h+'</div>'};
 // searching auto-opens the completed section so matches aren't hidden
 const showDone=expd.done||terms.length>0;
 el.innerHTML=fl+(open.length?open.map(card).join(''):`<div class="card mu">${terms.length?'No open expenses match your search.':'Nothing outstanding. 🎉'}</div>`)+
  (closed.length?`<div class="hd" style="margin:16px 2px 8px" ${at('act','tog','done')}><b>${showDone?'▾':'▸'} Completed (${closed.length})</b><span class="mu">Fully paid</span></div>`+(showDone?closed.map(card).join(''):''):'');
}
function msg(m,p){const c=calc(m),i=m.attendees.indexOf(p),ln=[`${title(m)} · ${m.date}`];
 m.items.forEach(it=>{if(it.people.includes(p)){const n=it.people.length;ln.push(`• ${it.name||'Item'}${n>1?` (1/${n} of ${peso(it.price*100)})`:''}: ${peso(it.price*100/n)}`)}});
 c.L.filter(l=>l.p===p).forEach(l=>ln.push(`• ${l.label||'Extra'}: ${peso(l.v)}`));
 ln.push(`Total: ${peso(c.tot[i])}. Please pay ${nm(m.payer)}.`);return ln.join('\n')}
function cp(id,p){const mm=meals.find(m=>m.id===id);if(!mm||!mm.attendees.includes(p))return;const t=msg(mm,p);
 const fb=()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Copied')}catch(e){toast('Copy failed')}a.remove()};
 navigator.clipboard?.writeText(t).then(()=>toast('Copied')).catch(fb)||fb()}
async function markPaid(mid,p,left){const m=meals.find(x=>x.id===mid);
 if(!m||!m.attendees.includes(p)||!Number.isFinite(left)||left<=0||left>=1e9||!members.some(x=>x.id===m.payer)||!canPay(p,m.payer))return toast('Could not save');
 try{await T('payments').add({from:p,to:m.payer,amount:left/100,meal:mid,note:'Marked paid',date:today(),created:Date.now()});toast('Marked as paid')}catch(e){toast('Could not save')}}
const delMeal=id=>arm('m'+id,()=>T('meals').doc(id).delete().catch(()=>toast('Could not delete')));

/* ---------- add / edit expense ---------- */
const newDraft=()=>({id:null,category:'meal',catName:'',date:today(),place:'',payer:me||'',attendees:[],items:[{name:'',price:'',all:false,people:[]}],extras:[],total:'',receipts:[]});
function shrink(f,max=1600,q=.82){return new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image();
 i.onload=()=>{URL.revokeObjectURL(u);const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*s);c.height=Math.round(i.height*s);
  c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?ok(b):no(new Error('Could not process image')),'image/jpeg',q)};
 i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('Not a valid image'))};i.src=u})}
const MAXR=10,MAXB=15*1024*1024;
function imgOk(f){if(!f.type.startsWith('image/')){toast('Only image files are added');return false}
 if(f.size>MAXB){toast('Images must be under 15 MB');return false}return true}
const recList=t=>t==='pay'?pay.receipts:D.receipts;
function pickReceipts(fs,t){const L=recList(t),l=[...fs],ok=l.filter(imgOk);
 const room=MAXR-L.length;if(ok.length>room)toast(`Up to ${MAXR} attachments`);
 ok.slice(0,Math.max(room,0)).forEach(f=>L.push({file:f,prev:URL.createObjectURL(f)}));draw()}
function dropReceipt(i,t){const L=recList(t),r=L[i];if(r.prev)URL.revokeObjectURL(r.prev);L.splice(i,1);draw()}
async function uploadReceipt(blob){
 if(!CLOUDINARY.cloud||!CLOUDINARY.preset)throw new Error('Cloudinary is not configured');
 const fd=new FormData();fd.append('file',blob);fd.append('upload_preset',CLOUDINARY.preset);
 const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloud)}/image/upload`,{method:'POST',body:fd,credentials:'omit',referrerPolicy:'no-referrer'}),j=await r.json().catch(()=>({}));
 if(!r.ok||!j.secure_url)throw new Error('Receipt upload failed: '+(j.error?.message||r.status));
 // never store a URL we wouldn't be willing to render later
 if(!safeUrl(j.secure_url))throw new Error('Receipt upload returned an unexpected URL');
 return j.secure_url}
let lbList=[],lbI=0;
function showReceipt(){const b=$('#lb'),n=lbList.length;b.querySelector('img').src=safeUrl(lbList[lbI])||(String(lbList[lbI]).startsWith('blob:')?lbList[lbI]:'');
 b.querySelector('span').textContent=n>1?`${lbI+1} / ${n}`:'';b.querySelector('.p').hidden=b.querySelector('.n').hidden=n<2}
function viewReceipt(list,i){lbList=list;lbI=i;showReceipt();$('#lb').hidden=false;document.body.style.overflow='hidden'}
const stepReceipt=d=>{lbI=(lbI+d+lbList.length)%lbList.length;showReceipt()};
const closeReceipt=()=>{const b=$('#lb');b.hidden=true;b.querySelector('img').removeAttribute('src');document.body.style.overflow=''};
addEventListener('keydown',e=>{if($('#lb').hidden)return;if(e.key==='Escape')closeReceipt();else if(lbList.length>1&&e.key==='ArrowLeft')stepReceipt(-1);else if(lbList.length>1&&e.key==='ArrowRight')stepReceipt(1)});
const rcOf=m=>m.receipts||(m.receipt?[m.receipt]:[]);
const openMealReceipt=(id,i)=>viewReceipt(rcOf(meals.find(m=>m.id===id)||{}),i);
const openDraftReceipt=(i,t)=>viewReceipt(recList(t).map(r=>r.prev||r.url),i);
function receiptPicker(L,t){
 return (L.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:8px">${L.map((r,i)=>`<div style="position:relative"><img src="${esc(r.prev||safeUrl(r.url).replace('/upload/','/upload/w_200,c_limit/'))}" alt="Attachment ${i+1}" ${at('act','openDraftReceipt',i,t)} style="width:100%;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--ln);display:block"><button class="x sm" style="position:absolute;top:2px;right:2px;width:28px;min-height:28px" ${at('act','dropReceipt',i,t)}>✕</button></div>`).join('')}</div>`:'<div class="mu" style="margin-bottom:8px">Optional. Take photos or choose images.</div>')+
 (L.length<MAXR?`<label class="sm" style="display:block;margin:0 0 8px;text-align:center;border:1px solid var(--ln);border-radius:8px;padding:6px 10px;cursor:pointer;color:var(--tx)">＋ Add photos<input type="file" accept="image/*" multiple style="display:none" ${at('ch','pickReceipts',t)}></label>`:`<div class="mu">Maximum of ${MAXR} attachments.</div>`)}
/* ---------- receipt scanning: Gemini reads the photo, we fill in the draft (people are still picked by hand) ---------- */
let scanning=false,scanArm=0;
const MAXS=4,SCAN_LBL='📷 Scan receipt';
const money=v=>{v=typeof v==='number'?v:parseFloat(v);return Number.isFinite(v)&&v>0&&v<1e8?Math.round(v*100)/100:0};
const draftFilled=()=>D.items.some(i=>i.name.trim()||String(i.price).trim())||D.extras.length>0;
function scanBtn(){if(scanning)return;
 if(draftFilled()&&!scanArm){scanArm=setTimeout(()=>{scanArm=0;const b=$('#scb');if(b&&!scanning)b.textContent=SCAN_LBL},3000);$('#scb').textContent='Replace current items? Tap again';return}
 clearTimeout(scanArm);scanArm=0;const b=$('#scb');if(b)b.textContent=SCAN_LBL;$('#scf')?.click();
 // get the AI SDK and App Check ready while the photo is being taken or picked
 import('./scan.js').then(m=>m.warm({config:firebaseConfig,recaptchaKey:RECAPTCHA_KEY})).catch(()=>{})}
const scanErr=e=>{const s=String(e?.code||'')+' '+String(e?.message||e||'');
 if(/per day|PerDay/i.test(s))return 'Today’s free receipt-scan limit is used up. Type it in for now, or try again tomorrow.';
 if(/\b(500|502|503|504|429)\b|high demand|overloaded|unavailable|quota|resource.?exhausted|too.?many|timeout/i.test(s))return 'The receipt reader is busy right now. Try again in a minute.';
 if(/app.?check|recaptcha/i.test(s))return 'Receipt scanning was blocked by App Check.';
 if(/api-not-enabled|not.?been.?used|PERMISSION_DENIED|\b403\b/i.test(s))return 'Receipt scanning isn’t enabled for this Firebase project yet.';
 if(!navigator.onLine||/failed to fetch|networkerror|load failed|network.?request|ERR_/i.test(s))return 'Couldn’t reach the receipt reader. Check your connection.';
 return 'Couldn’t read the receipt. Try a clearer photo or type it in.'};
async function scanFiles(fs){
 if(scanning||!D)return;const ok=fs.filter(imgOk);if(!ok.length)return;
 if(ok.length>MAXS)toast(`Only the first ${MAXS} photos are read`);
 const d=D,use=ok.slice(0,MAXS);scanning=true;draw();
 const slow=setTimeout(()=>{const b=$('#scb');if(b&&scanning)b.textContent='Still reading… long receipts take a bit longer'},12000);
 try{const [{readReceipt},imgs]=await Promise.all([import('./scan.js'),Promise.all(use.map(f=>shrink(f,2400,.85)))]);
  const r=await readReceipt(imgs,{config:firebaseConfig,recaptchaKey:RECAPTCHA_KEY});
  if(D===d&&!fillFromScan(r,use))toast('No items found. Try a clearer, flatter photo of the whole receipt.')}
 catch(e){console.error('Receipt scan failed',e);toast(scanErr(e))}
 finally{clearTimeout(slow);scanning=false;if(tab==='new')draw()}}
// The model's answer is untrusted input: coerce every field before it touches the draft.
function fillFromScan(r,files){
 if(!r||typeof r!=='object'||r.isReceipt===false)return false;
 const items=list(r.items,LIM.items).map(i=>{const n=Math.round(num(i.quantity,1e4)),lb=clean(i.name,LIM.item-6)||'Item';
  return{name:n>1?`${lb} ×${n}`:lb,price:String(money(i.price)),all:false,people:[]}}).filter(i=>+i.price>0);
 if(!items.length)return false;
 const extras=list(r.extras,LIM.extras).map(x=>{const a=money(x.amount),p=money(x.percent),dsc=x.kind==='discount';
  return a||p?{label:clean(x.label,LIM.label)||(dsc?'Discount':'Charge'),type:a?'amt':'pct',value:String(a||p),sign:dsc?-1:1,mode:'prop',all:true,people:[]}:null}).filter(Boolean);
 D.items=items;D.extras=extras;
 const pl=clean(r.place,LIM.place);if(pl&&!D.place.trim())D.place=pl;
 const dt=str(r.date,10);if(DATE_RE.test(dt)&&!Number.isNaN(Date.parse(dt))&&dt<=today())D.date=dt;
 const t=money(r.total);if(t)D.total=String(t);
 files.forEach(f=>{if(D.receipts.length<MAXR)D.receipts.push({file:f,prev:URL.createObjectURL(f)})});
 const e=extras.length;toast(`Added ${items.length} item${items.length>1?'s':''}${e?` and ${e} fee/discount${e>1?'s':''}`:''}. Check them, then pick who had what.`);
 return true}
const scanCard=()=>`<div class="card"><h2>Scan receipt</h2><div class="mu">Take or choose a photo of the receipt to fill in the place, date, items, fees and discounts. You still pick who’s splitting and who had what.</div>
 <div class="sub"><button id="scb" ${scanning?'disabled':''} ${at('act','scanBtn')}>${scanning?'Reading receipt…':scanArm?'Replace current items? Tap again':SCAN_LBL}</button></div>
 <input type="file" id="scf" accept="image/*" multiple hidden ${at('ch','scanFiles')}></div>`;
const eff=x=>x.all?D.attendees:x.people.filter(p=>D.attendees.includes(p));
const res=()=>({...D,items:D.items.map(i=>({name:i.name,price:parseFloat(i.price)||0,people:eff(i)})),extras:D.extras.map(x=>({label:x.label,type:x.type,value:parseFloat(x.value)||0,sign:x.sign,mode:x.mode,people:eff(x)}))});
function chips(ids,sel,fn,l,i){return ids.map(id=>`<button type="button" class="chip ${sel.includes(id)?'on':''}" ${l?at('act',fn,l,i,id):at('act',fn,id)}>${esc(nm(id))}</button>`).join('')}
function togA(id){const a=D.attendees;D.attendees=a.includes(id)?a.filter(x=>x!==id):[...a,id];draw()}
function togL(l,i,id){const x=D[l][i];let ps=eff(x);ps=ps.includes(id)?ps.filter(p=>p!==id):[...ps,id];x.people=ps;x.all=ps.length>1&&ps.length===D.attendees.length;draw()}
function allL(l,i){const x=D[l][i];x.all=!x.all;x.people=[];draw()}
function vNew(){
 const ids=members.map(m=>m.id);if(!ids.length)return '<div class="card">Add your teammates under <b>People</b> first.</div>';
 const C=CAT[catOf(D)],customs=[...new Set(meals.filter(m=>catOf(m)==='custom'&&m.catName).map(m=>m.catName))];
 const it=(x,i)=>`<div class="sub"><div class="row"><input class="g2" maxlength="${LIM.item}" placeholder="${esc(C.item)}" value="${esc(x.name)}" ${at('in','itName',i)}><input class="g1" inputmode="decimal" maxlength="12" placeholder="Price" value="${esc(x.price)}" ${at('in','itPrice',i)}><button class="x" ${at('act','itDel',i)}>✕</button></div>
  <div class="chips"><button type="button" class="chip ${x.all?'on':''}" ${at('act','allL','items',i)}>Everyone</button>${chips(D.attendees,eff(x),'togL','items',i)}</div></div>`;
 const ex=(x,i)=>`<div class="sub"><div class="row"><input class="g2" maxlength="${LIM.label}" placeholder="Label" value="${esc(x.label)}" ${at('in','exLabel',i)}><input class="g1" inputmode="decimal" maxlength="12" placeholder="Value" value="${esc(x.value)}" ${at('in','exValue',i)}><select style="width:84px;padding-left:12px" ${at('ch','exType',i)}><option value="pct" ${sel(x.type,'pct')}>%</option><option value="amt" ${sel(x.type,'amt')}>₱</option></select><button class="x" ${at('act','exDel',i)}>✕</button></div>
  <div class="row"><select ${at('ch','exSign',i)}><option value="1" ${x.sign>0?'selected':''}>Charge</option><option value="-1" ${x.sign<0?'selected':''}>Discount</option></select><select ${at('ch','exMode',i)}><option value="prop" ${sel(x.mode,'prop')}>Split by spending</option><option value="equal" ${sel(x.mode,'equal')}>Split equally</option></select></div>
  <div class="lb">Applies to</div><div class="chips"><button type="button" class="chip ${x.all?'on':''}" ${at('act','allL','extras',i)}>Everyone</button>${chips(D.attendees,eff(x),'togL','extras',i)}</div></div>`;
 return `<button class="sm" style="margin-bottom:10px" ${at('act','cancelExpense')}>${D.id?'← Cancel edit':'← Expenses'}</button>${scanCard()}<div class="card"><h2>${D.id?'Edit expense':'New expense'}</h2>
 <div class="lb">Category</div><div class="chips">${Object.entries(CAT).map(([k,c])=>`<button type="button" class="chip ${catOf(D)===k?'on':''}" ${at('act','setCat',k)}>${c.icon} ${c.name}</button>`).join('')}</div>
 ${catOf(D)==='custom'?`<label>Category name<input list="cn" maxlength="${LIM.cat}" placeholder="e.g. Groceries, Lodging, Gift" value="${esc(D.catName)}" ${at('in','dCatName')}></label><datalist id="cn">${customs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`:''}
 <div class="row"><label class="g1">Date<input type="date" value="${esc(D.date)}" ${at('in','dDate')}></label><label class="g1">${catOf(D)==='meal'?'Place':'Description'}<input maxlength="${LIM.place}" placeholder="${esc(C.place)}" value="${esc(D.place)}" ${at('in','dPlace')}></label></div>
 <label>Who paid?<select ${at('ch','dPayer')}>${opts(ids,D.payer,'Choose…')}</select></label>
 <div class="lb">Who's splitting?</div><div class="chips">${chips(ids,D.attendees,'togA')}</div></div>
 <div class="card"><h2>${C.items}</h2><div class="mu">One person = only theirs. Pick several (or Everyone) for a shared cost; it splits equally among them.</div>${D.items.map(it).join('')}<div class="sub"><button ${at('act','itAdd')}>＋ Add item</button></div></div>
 <div class="card"><h2>Fees, tax, discounts</h2><div class="mu">Each one only applies to the people you select. Percentages are taken from those people’s own orders.</div>${D.extras.map(ex).join('')}<div class="sub row"><button class="g1" ${at('act','addX',1)}>＋ Charge</button><button class="g1" ${at('act','addX',-1)}>＋ Discount</button></div></div>
 <div class="card"><h2>Receipts</h2>${receiptPicker(D.receipts,'D')}</div>
 <div class="card"><h2>Breakdown</h2><div class="mu">Items + extras = total</div><div id="pv"></div><label style="margin-top:10px">Receipt total (optional, for checking)<input inputmode="decimal" maxlength="14" value="${esc(D.total)}" ${at('in','dTotal')}></label><button class="pri" ${at('act','saveMeal')}>Save expense</button></div>`;
}
function addX(s){D.extras.push({label:s>0?'Service charge':'Discount',type:'pct',value:s>0?'10':'',sign:s,mode:'prop',all:true,people:[]});draw()}
function pv(){const el=document.getElementById('pv');if(!el||!D)return;const m=res(),c=calc(m);let h='';
 m.attendees.forEach((p,i)=>{h+=`<div class="pr"><span>${esc(nm(p))}</span><span class="mu">${peso(c.S[p])} + ${peso(c.E[p])}</span><b>${peso(c.tot[i])}</b></div>`});
 if(!m.attendees.length)h='<p class="mu">Pick who\'s splitting.</p>';else h+=`<div class="pr tt"><span>Total</span><span></span><b>${peso(c.sum)}</b></div>`;
 const r=Math.round((parseFloat(D.total)||0)*100);
 if(r){const d=c.sum-r;h+=d===0?'<p class="ok">✓ Matches the receipt</p>':`<p class="bad">⚠ ${peso(Math.abs(d))} ${d>0?'more':'less'} than the receipt. Check items and extras.</p>`}
 const un=m.items.filter(i=>i.price&&!i.people.length).length;if(un)h+=`<p class="bad">${un} item(s) not assigned to anyone.</p>`;
 el.innerHTML=h}
async function saveMeal(){
 if(!D.payer)return toast('Choose who paid');if(!D.attendees.length)return toast('Choose who\'s splitting');
 if(catOf(D)==='custom'&&!clean(D.catName,LIM.cat))return toast('Name the custom category');
 const known=new Set(members.map(x=>x.id));
 if(!known.has(D.payer)||!D.attendees.every(p=>known.has(p)))return toast('Pick people from this team');
 if(!DATE_RE.test(D.date)||Number.isNaN(Date.parse(D.date)))return toast('Enter a valid date');
 const nums=[...D.items.map(i=>i.price),...D.extras.map(x=>x.value),D.total].map(v=>String(v??'').trim()).filter(Boolean);
 if(nums.some(v=>!Number.isFinite(+v)||+v<0||+v>=1e8))return toast('Amounts must be numbers between 0 and 99,999,999');
 if(D.items.length>LIM.items||D.extras.length>LIM.extras)return toast('Too many items');
 const m=res(),rcs=D.receipts;delete m.id;delete m.receipts;delete m.receipt;m.category=catOf(D);m.catName=m.category==='custom'?clean(D.catName,LIM.cat):'';m.total=parseFloat(D.total)||0;m.items=m.items.filter(i=>i.price>0);m.extras=m.extras.filter(x=>x.value>0);
 m.place=clean(m.place,LIM.place);m.items.forEach(i=>i.name=clean(i.name,LIM.item));m.extras.forEach(x=>x.label=clean(x.label,LIM.label));
 if(m.items.some(i=>!i.people.length))return toast('Assign every item to someone');
 if(!D.id)m.uid=user.uid;Object.keys(m).forEach(k=>m[k]===undefined&&delete m[k]);
 try{let id=D.id;
  if(rcs.some(r=>r.file))toast('Uploading receipts…');
  const urls=[];for(const r of rcs)urls.push(r.url||await uploadReceipt(await shrink(r.file)));
  if(urls.length)m.receipts=urls;
  if(id)await T('meals').doc(id).set(m);else{m.created=Date.now();id=(await T('meals').add(m)).id}
  rcs.forEach(r=>r.prev&&URL.revokeObjectURL(r.prev));
  expd[id]=true;D=null;tab='meals';draw();toast('Expense saved')}catch(e){toast('Could not save: '+(e.message||e.code||''))}}
function editMeal(id){const m=meals.find(x=>x.id===id),n=m.attendees.length,f=l=>l.length>1&&l.length===n;
 if(!canMeal(m))return toast('You can only edit expenses you created');
 D={id,uid:m.uid||undefined,created:m.created||undefined,category:catOf(m),catName:m.catName||'',date:m.date,place:m.place||'',payer:m.payer,attendees:[...m.attendees],total:m.total?String(m.total):'',receipts:(m.receipts||(m.receipt?[m.receipt]:[])).map(url=>({url})),
  items:m.items.map(i=>({name:i.name,price:String(i.price),all:f(i.people),people:[...i.people]})),
  extras:m.extras.map(x=>({label:x.label,type:x.type,value:String(x.value),sign:x.sign,mode:x.mode,all:f(x.people),people:[...x.people]}))};
 if(!D.items.length)D.items.push({name:'',price:'',all:false,people:[]});go('new')}

/* ---------- people ---------- */
function vPeople(){
 const used=id=>meals.some(m=>m.payer===id||m.attendees.includes(id))||pays.some(p=>p.from===id||p.to===id),ids=members.map(m=>m.id),A=isAdmin();
 let h=`<div class="card"><h2>You</h2><div class="pr"><span>${esc(user.email)}</span><span class="mu">${me?esc(nm(me))+' · ':''}${A?'Admin (all teams)':'Contributor'}</span></div><button class="sm" style="margin-top:8px" ${at('act','signOut')}>Sign out</button></div>
 <div class="card"><h2>Appearance</h2><div class="lb">Mode</div><div class="chips">${[['system','System'],['light','Light'],['dark','Dark']].map(([k,l])=>`<button type="button" class="chip ${mode===k?'on':''}" ${at('act','setMode',k)}>${l}</button>`).join('')}</div>
 <div class="lb">Palette</div><div class="chips">${Object.entries(PAL).map(([k,p])=>`<button type="button" class="chip ${palette===k?'on':''}" ${at('act','setPalette',k)}><span class="sw2" style="background:${p[(mode==='dark'||(mode==='system'&&darkMQ.matches))?'dark':'light'][4]}"></span>${p.name}</button>`).join('')}</div></div>`;
 if(!A&&teams.length>1)h+=`<div class="card"><h2>Team</h2><select ${at('ch','openTeam')}>${teams.map(t=>`<option value="${esc(t.id)}" ${sel(t.id,cur)}>${esc(t.name)}</option>`).join('')}</select></div>`;
 if(A&&legacy&&!teams.some(t=>t.legacy))h+=`<div class="card"><h2>Move existing data into a team</h2><div class="mu">People, expenses and payments from before teams existed are hidden until moved. Existing access entries are linked to the new team too. The original data is left untouched.</div><div class="row sub"><input id="lg" maxlength="${LIM.team}" placeholder="Team name"><button ${at('act','migrate')}>Move</button></div></div>`;
 if(A)h+=`<div class="card"><h2>Teams</h2>${teams.map(t=>nameRow('t:'+t.id,t.name,`${t.id===cur?'<span class="mu">current</span>':`<button class="sm" ${at('act','openTeam',t.id)}>Open</button>`}<button class="sm" ${at('act','editName','t:'+t.id)}>Rename</button><button class="sm" ${at('act','delTeam',t.id)}>Delete</button>`)).join('')||'<p class="mu">No teams yet.</p>'}
 <div class="row sub"><input id="tn" maxlength="${LIM.team}" placeholder="New team name" ${at('kd','teamKey')}><button ${at('act','addTeam')}>Create</button></div></div>`;
 if(!cur)return h;
 h+=`<div class="card"><h2>${esc(tname(cur))} · people</h2>${members.map(m=>nameRow('m:'+m.id,m.name,!A?'':`<button class="sm" ${at('act','editName','m:'+m.id)}>Rename</button>${used(m.id)?'<span class="mu">in use</span>':`<button class="sm" ${at('act','delMember',m.id)}>${dlabel('u'+m.id,'Remove')}</button>`}`)).join('')||'<p class="mu">No one yet.</p>'}
 ${A?`<div class="row sub"><input id="nn" maxlength="${LIM.name}" placeholder="Name" ${at('kd','memberKey')}><button ${at('act','addMember')}>Add</button></div>`:''}</div>`;
 const acc=roles.filter(r=>r.role==='admin'||(r.teams&&cur in r.teams));
 if(A)h+=`<div class="card"><h2>Access to ${esc(tname(cur))}</h2><div class="mu">Contributors only see teams they're added to. Admins see every team.</div>${acc.map(r=>`<div class="pr"><span>${esc(r.id)}<br><span class="mu">${r.teams?.[cur]?esc(nm(r.teams[cur]))+' · ':''}${r.role==='admin'?'Admin (all teams)':'Contributor'}</span></span>${r.id===user.email.toLowerCase()?'':`<button class="sm" ${at('act','delRole',r.id)}>${dlabel('r'+r.id,r.role==='admin'?'Remove access':'Remove from team')}</button>`}</div>`).join('')}
 <div class="sub"><input id="re" type="email" maxlength="${LIM.email}" placeholder="Google email"><div class="row" style="margin-top:6px"><select id="rm">${opts(ids,'','Person…')}</select><select id="rr"><option value="contributor">Contributor</option><option value="admin">Admin</option></select></div><button ${at('act','addRole')}>Grant access</button></div></div>`;
 return h}
async function addRole(){const e=$('#re').value.trim().toLowerCase(),m=$('#rm').value,r=$('#rr').value;if(!EMAIL_RE.test(e)||e.length>LIM.email||!['admin','contributor'].includes(r)||(r==='contributor'&&!m)||(m&&!members.some(x=>x.id===m)))return toast('Enter an email and pick a person');
 const d={role:r};if(m)d.teams={[cur]:m};
 try{await db.collection('roles').doc(e).set(d,{merge:true});toast('Access granted')}catch(x){toast('Could not save')}}
const delRole=id=>arm('r'+id,async()=>{const r=roles.find(x=>x.id===id),ref=db.collection('roles').doc(id);if(!r)return;
 try{if(r.role!=='admin'&&Object.keys(r.teams||{}).some(k=>k!==cur))await ref.update({['teams.'+cur]:firebase.firestore.FieldValue.delete()});else await ref.delete()}catch(e){toast('Could not remove')}});
async function addMember(){const v=clean($('#nn').value,LIM.name);if(!v)return;if(members.some(m=>m.name.toLowerCase()===v.toLowerCase()))return toast('Already added');
 try{await T('members').add({name:v,created:Date.now()});$('#nn').value=''}catch(e){toast('Could not add')}}
const delMember=id=>arm('u'+id,()=>T('members').doc(id).delete().catch(()=>toast('Could not remove')));
let ed='';
const nameRow=(k,name,btns)=>ed===k?`<div class="row" style="padding:6px 0"><input id="ed" class="g1" maxlength="${LIM.name}" value="${esc(name)}" ${at('kd','nameKey',k)}><button class="sm" ${at('act','saveName',k)}>Save</button><button class="sm" ${at('act','cancelEdit')}>Cancel</button></div>`
 :`<div class="pr"><span>${esc(name)}</span>${btns}</div>`;
function editName(k){ed=k;draw();$('#ed')?.focus()}
async function saveName(k){const [type,id]=k.split(':'),v=clean($('#ed').value,type==='t'?LIM.team:LIM.name);if(!v)return toast('Name can\'t be empty');if(!ID_RE.test(id||''))return;
 const list=type==='t'?teams:members;if(list.some(x=>x.id!==id&&(x.name||'').toLowerCase()===v.toLowerCase()))return toast('That name is already used');
 try{await(type==='t'?db.collection('teams').doc(id):T('members').doc(id)).update({name:v});ed='';draw();toast('Renamed')}catch(e){toast('Could not rename')}}
async function delTeam(id){const t=teams.find(x=>x.id===id);if(!t)return;
 const v=prompt(`This permanently deletes "${t.name}" and all its people, expenses and payments. Access to it is removed for everyone.\n\nType the team name to confirm:`);
 if(v==null)return;if(v.trim()!==t.name)return toast('Name didn\'t match. Nothing deleted.');
 try{toast('Deleting…');const tr=db.collection('teams').doc(id),ops=[];
  for(const n of ['members','meals','payments'])(await tr.collection(n).get()).docs.forEach(d=>ops.push(b=>b.delete(d.ref)));
  roles.filter(r=>r.teams&&id in r.teams).forEach(r=>ops.push(b=>b.update(db.collection('roles').doc(r.id),{['teams.'+id]:firebase.firestore.FieldValue.delete()})));
  // team doc last, so a failed run can be retried from the list
  ops.push(b=>b.delete(tr));
  for(let i=0;i<ops.length;i+=400){const b=db.batch();ops.slice(i,i+400).forEach(f=>f(b));await b.commit()}
  toast('Team deleted')}catch(e){toast('Delete failed: '+(e.code||e.message||''))}}
async function addTeam(){const v=clean($('#tn').value,LIM.team);if(!v)return;if(teams.some(t=>(t.name||'').toLowerCase()===v.toLowerCase()))return toast('Team already exists');
 try{const r=await db.collection('teams').add({name:v,created:Date.now()});openTeam(r.id);toast('Team created')}catch(e){toast('Could not create team')}}
async function migrate(){const name=clean($('#lg').value,LIM.team);if(!name)return toast('Name the team');
 try{toast('Moving…');const tr=db.collection('teams').doc(),ops=[];
  for(const n of ['members','meals','payments'])(await db.collection(n).get()).docs.forEach(d=>ops.push(b=>b.set(tr.collection(n).doc(d.id),d.data())));
  roles.filter(r=>r.member).forEach(r=>ops.push(b=>b.set(db.collection('roles').doc(r.id),{teams:{[tr.id]:r.member},member:firebase.firestore.FieldValue.delete()},{merge:true})));
  // team doc last, so the move card only disappears once everything is copied
  ops.push(b=>b.set(tr,{name,created:Date.now(),legacy:true}));
  for(let i=0;i<ops.length;i+=400){const b=db.batch();ops.slice(i,i+400).forEach(f=>f(b));await b.commit()}
  openTeam(tr.id);toast('Moved into '+name)}catch(e){toast('Move failed: '+(e.code||e.message||''))}}

/* ---------- event handlers (wired through data-* attributes, see `at`) ---------- */
const ix=(a,v)=>{const i=+v;return Number.isInteger(i)&&i>=0&&i<a.length?i:-1};
const A0=el=>el.dataset.a,B0=el=>el.dataset.b,C0=el=>el.dataset.c;
Object.assign(ACT,{
 openPd,closePd,editPhoto,delPhoto,saveCrop,closeReceipt,
 pickFile:()=>$('#pdf')?.click(),
 pdCancel:()=>{if(!pdBusy)pdView()},
 pdBackdrop:(el,e)=>{if(e.target===el)closePd()},
 lbBackdrop:(el,e)=>{if(e.target===el)closeReceipt()},
 stepReceipt:el=>{if(lbList.length)stepReceipt(+A0(el)<0?-1:1)},
 go:el=>go(A0(el)),
 tapRow:el=>tapRow(el,A0(el)),
 tog:el=>tog(A0(el)),
 openPayReceipt:el=>openPayReceipt(A0(el),+B0(el)),
 delPay:el=>delPay(A0(el)),
 cp:el=>cp(A0(el),B0(el)),
 markPaid:el=>markPaid(A0(el),B0(el),+C0(el)),
 allBal:()=>{bp=null;draw()},
 setPay:el=>setPay(A0(el),B0(el),+C0(el)),
 savePay,saveMeal,addTeam,addMember,addRole,migrate,scanBtn,
 addExpense:()=>{if(D&&D.id)D=null;go('new')},
 fcat:el=>{fcat=A0(el)==='all'||Object.hasOwn(CAT,A0(el))?A0(el):'all';draw()},
 openMealReceipt:el=>openMealReceipt(A0(el),+B0(el)),
 editMeal:el=>editMeal(A0(el)),
 delMeal:el=>delMeal(A0(el)),
 openDraftReceipt:el=>{if(['pay','D'].includes(B0(el)))openDraftReceipt(+A0(el),B0(el))},
 dropReceipt:el=>{if(['pay','D'].includes(B0(el)))dropReceipt(+A0(el),B0(el))},
 togA:el=>togA(A0(el)),
 togL:el=>{if(['items','extras'].includes(A0(el))&&D[A0(el)][+B0(el)])togL(A0(el),+B0(el),C0(el))},
 allL:el=>{if(['items','extras'].includes(A0(el))&&D[A0(el)][+B0(el)])allL(A0(el),+B0(el))},
 itDel:el=>{const i=ix(D.items,A0(el));if(i>=0){D.items.splice(i,1);draw()}},
 exDel:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras.splice(i,1);draw()}},
 itAdd:()=>{if(D.items.length<LIM.items){D.items.push({name:'',price:'',all:false,people:[]});draw()}},
 addX:el=>{if(D.extras.length<LIM.extras)addX(+A0(el)<0?-1:1)},
 cancelExpense:()=>{if(D.id)D=null;go('meals')},
 setCat:el=>{if(Object.hasOwn(CAT,A0(el))){D.category=A0(el);draw()}},
 signOut:()=>firebase.auth().signOut(),
 setMode:el=>{if(['system','light','dark'].includes(A0(el)))setTheme(palette,A0(el))},
 setPalette:el=>{if(Object.hasOwn(PAL,A0(el)))setTheme(A0(el),mode)},
 openTeam:el=>openTeam(A0(el)),
 editName:el=>editName(A0(el)),
 delTeam:el=>delTeam(A0(el)),
 delMember:el=>delMember(A0(el)),
 delRole:el=>delRole(A0(el)),
 saveName:el=>saveName(A0(el)),
 cancelEdit:()=>{ed='';draw()},
 signIn:async()=>{
  // client-side friction only; Firebase Auth/Google enforce the real server-side throttling
  const wait=signLock-Date.now();if(wait>0)return toast(`Too many attempts. Try again in ${Math.ceil(wait/1000)}s`);
  const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
  try{await firebase.auth().signInWithPopup(p);signFails=0}
  catch(e){if(['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(e.code))return;
   if(++signFails>=5){signFails=0;signLock=Date.now()+60000}toast(e.message||'Sign-in failed')}}
});
let signFails=0,signLock=0;
Object.assign(INP,{
 cropZoom:el=>cropZoom(+el.value),
 payAmount:el=>{pay.amount=el.value},
 payNote:el=>{pay.note=el.value},
 search:el=>{q=el.value;ml()},
 itName:el=>{const i=ix(D.items,A0(el));if(i>=0)D.items[i].name=el.value},
 itPrice:el=>{const i=ix(D.items,A0(el));if(i>=0){D.items[i].price=el.value;pv()}},
 exLabel:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras[i].label=el.value;pv()}},
 exValue:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras[i].value=el.value;pv()}},
 dCatName:el=>{D.catName=el.value},
 dDate:el=>{D.date=el.value},
 dPlace:el=>{D.place=el.value},
 dTotal:el=>{D.total=el.value;pv()}
});
Object.assign(CHG,{
 pickPhoto:el=>pickPhoto(el),
 setNet:el=>setNet(el.checked),
 payFrom:el=>setPayParty('from',el.value),
 payTo:el=>setPayParty('to',el.value),
 pickReceipts:el=>{if(['pay','D'].includes(A0(el)))pickReceipts(el.files,A0(el))},
 scanFiles:el=>{const fs=[...el.files];el.value='';scanFiles(fs)},
 exType:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras[i].type=el.value==='amt'?'amt':'pct';pv()}},
 exSign:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras[i].sign=+el.value<0?-1:1;pv()}},
 exMode:el=>{const i=ix(D.extras,A0(el));if(i>=0){D.extras[i].mode=el.value==='equal'?'equal':'prop';pv()}},
 dPayer:el=>{D.payer=el.value},
 openTeam:el=>openTeam(el.value)
});
Object.assign(KEY,{
 teamKey:(el,e)=>{if(e.key==='Enter')addTeam()},
 memberKey:(el,e)=>{if(e.key==='Enter')addMember()},
 nameKey:(el,e)=>{if(e.key==='Enter')saveName(A0(el));else if(e.key==='Escape'){ed='';draw()}}
});
PTR.ripple=(el,e)=>ripple(e,el);

/* ---------- start ---------- */
(async function(){
 const fail=()=>{logoStill();$('#app').innerHTML='<div class="card">Couldn’t connect to Firebase. Check the firebaseConfig at the top of the script and your Firestore rules.</div>'};
 const t=setTimeout(()=>{if(!db)fail()},10000);
 try{firebase.initializeApp(firebaseConfig);db=firebase.firestore()}catch(e){db=null}
 clearTimeout(t);if(!db||firebaseConfig.projectId==='PASTE_PROJECT_ID')return fail();
 let rsub=null,mode0=null;
 const gate=h=>{meHtml='';$('#me').innerHTML='';$('#nav').innerHTML='';$('#app').innerHTML=`<div class="card">${h}</div>`};
 const err=e=>toast('Sync problem: '+(e.code||''));
 const stop=()=>{[...gsubs,...tsubs].forEach(f=>f());gsubs=[];tsubs=[];mode0=null;teams=[]};
 firebase.auth().onAuthStateChanged(u=>{
  rsub?.();rsub=null;stop();user=u;role=null;me='';members=[];meals=[];pays=[];roles=[];legacy=false;seenM=false;tab='bal';bp=null;D=null;
  if(u&&!lgIn)playLogo();else if(!u)logoStill();lgIn=!!u;
  if(!u)return gate('<h2>Sign in</h2><p class="mu">Use the Google account your admin gave access to.</p><button class="pri" data-act="signIn">Sign in with Google</button>');
  if(!u.emailVerified){gate(`<h2>Email not verified</h2><p class="mu">${esc(u.email)} hasn’t been verified by Google, so it can’t be used here.</p><button data-act="signOut">Sign out</button>`);return}
  $('#app').innerHTML='<div class="card mu">Loading…</div>';
  const noAccess=()=>{stop();gate(`<h2>No access yet</h2><p class="mu">${esc(u.email)} isn’t on a team. Ask an admin to grant access.</p><button data-act="signOut">Sign out</button>`)};
  rsub=db.collection('roles').doc((u.email||'').toLowerCase()).onSnapshot(r=>{
   role=r.exists?normRole(r.data()):null;
   if(!role||(!isAdmin()&&!Object.keys(role.teams||{}).length))return noAccess();
   if(isAdmin()){
    if(mode0==='admin'){me=role.teams?.[cur]||'';return draw()}
    stop();mode0='admin';
    gsubs.push(db.collection('teams').onSnapshot(s=>setTeams(s.docs.map(d=>normTeam({id:d.id,...d.data()}))),err));
    gsubs.push(db.collection('roles').onSnapshot(s=>{roles=s.docs.map(d=>({id:d.id,...normRole(d.data())}));onData()},err));
    Promise.all(['members','meals','payments'].map(n=>db.collection(n).limit(1).get())).then(x=>{legacy=x.some(s=>!s.empty);onData()}).catch(()=>{});
    return}
   if(mode0==='admin')stop();mode0='contributor';
   Promise.all(Object.keys(role.teams).map(id=>db.collection('teams').doc(id).get()))
    .then(ds=>setTeams(ds.filter(d=>d.exists).map(d=>normTeam({id:d.id,...d.data()})))).catch(err);
  },noAccess);
 });
})();
