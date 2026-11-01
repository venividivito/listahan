// [bg,card,tx,mu,ac,on,ln,ok,bad]
const PAL={
 matcha:{name:'Matcha',light:['#f5f7f2','#fff','#1b2118','#66705f','#4d7c0f','#fff','#dfe5d8','#0f766e','#b91c1c'],dark:['#121510','#1b1f18','#e9eee4','#9aa591','#a3e635','#121510','#2e3529','#2dd4bf','#f87171']},
 ube:{name:'Ube',light:['#f8f6fb','#fff','#1e1a26','#6c6478','#7c3aed','#fff','#e6e0ef','#15803d','#b91c1c'],dark:['#15121b','#1e1a26','#eeeaf4','#a39bb0','#a78bfa','#15121b','#332c3f','#4ade80','#f87171']},
 ocean:{name:'Ocean',light:['#f4f7fa','#fff','#15202b','#5f6b78','#0369a1','#fff','#dde4eb','#15803d','#b91c1c'],dark:['#0f151b','#172029','#e6edf3','#93a1ae','#38bdf8','#0f151b','#26323d','#4ade80','#f87171']},
 mango:{name:'Mango',light:['#fffbf2','#fff','#22190c','#75674f','#b45309','#fff','#efe4cc','#15803d','#b91c1c'],dark:['#17130c','#211b12','#f5eee2','#aa9d86','#fbbf24','#17130c','#3a3122','#4ade80','#f87171']},
 slate:{name:'Slate',light:['#f6f6f7','#fff','#18181b','#6b6b73','#18181b','#fff','#e4e4e7','#15803d','#b91c1c'],dark:['#0f0f11','#18181b','#f4f4f5','#a1a1aa','#f4f4f5','#18181b','#2a2a2e','#4ade80','#f87171']}
};
let palette=PAL[localStorage.getItem('palette')]?localStorage.getItem('palette'):'matcha',mode=['light','dark'].includes(localStorage.getItem('mode'))?localStorage.getItem('mode'):'system';
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){const d=mode==='dark'||(mode==='system'&&darkMQ.matches),r=document.documentElement.style;
 PAL[palette][d?'dark':'light'].forEach((v,i)=>r.setProperty('--'+['bg','card','tx','mu','ac','on','ln','ok','bad'][i],v));
 r.colorScheme=d?'dark':'light';document.querySelector('meta[name=theme-color]')?.setAttribute('content',PAL[palette][d?'dark':'light'][0])}
darkMQ.addEventListener('change',()=>{if(mode==='system')applyTheme()});
applyTheme();
