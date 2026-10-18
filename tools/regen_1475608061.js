const P1=JSON.parse(JSON.stringify(P0));P1.tasks.find(t=>t.id==='芳-2').fixed=true;
// new segments for 1475608061 (original PO quantities)
const segs=[
 {item:'04-9326',seg:'04-9326#1/3',how:'袋入',qty:8000,box:14},
 {item:'04-9326',seg:'04-9326#2/3',how:'袋入',qty:8000,box:13},
 {item:'04-9326',seg:'04-9326#3/3',how:'袋入',qty:8000,box:13},
 {item:'04-6825',seg:'04-6825',how:'袋入',qty:2400,box:4},
 {item:'04-9317',seg:'04-9317',how:'袋入',qty:3600,box:6}];
for(const s of segs)s.pd=Math.round((s.qty/3400+s.box/17)*100)/100;
const baseTasks=P1.tasks.filter(t=>t.id!=='芳-1');
const W=['芳','智','幫手1','幫手2'];
function evalAssign(a){
  const extra=segs.map((s,i)=>({id:a[i]+'-n'+(i+1),w:a[i],kind:'pack',order:'1475608061',...s,s:'2026-10-16T08:0'+i,e:'2026-10-16T08:0'+i}));
  P={...P1,tasks:[...baseTasks,...extra]};
  const r=simulate();let late=0,minS=1e9,sum=0;
  for(const o of P.orders){const f=r.ord[o.id].fin;const sl=dayEnd(o.due)-f;if(sl<0)late++;minS=Math.min(minS,sl);sum+=sl}
  for(const w in P.helpers){const ts=r.tasks.filter(t=>t.w===w&&t.rem>0);if(ts.length&&Math.max(...ts.map(t=>t.en))>dayEnd(P.helpers[w][1])+1)late++}
  return{late,minS,sum,r,tasks:P.tasks};
}
buildDays();
let best=null;const n=segs.length;
for(let k=0;k<Math.pow(4,n);k++){const a=[];let x=k;for(let i=0;i<n;i++){a.push(W[x%4]);x=Math.floor(x/4)}
  const v=evalAssign(a);const key=[-v.late,v.minS,v.sum];
  if(!best||key[0]>best.key[0]||(key[0]===best.key[0]&&(key[1]>best.key[1]+1||(Math.abs(key[1]-best.key[1])<=1&&key[2]>best.key[2]))))best={a,key,v}}
console.log('best',best.a,'late',best.v.late,'minSlack(d)',(best.v.minS/480).toFixed(2));
const r=best.v.r;
for(const o of P0.orders){const x=r.ord[o.id];console.log(o.id,ft(x.fin,true),'buf',x.buf)}
// build new plan tasks with simulated times
const out=r.tasks.map(t=>{const T=toT(t.st),E=toT(t.en,true);const o={...(t.fixed?{fixed:true}:{}),id:t.id,w:t.w,kind:t.kind,order:t.order,item:t.item,seg:t.seg,how:t.how,qty:t.qty,box:t.box,pd:t.pd,s:T.d+'T'+T.hh,e:E.d+'T'+E.hh};return o});
// renumber new ids per worker
const cnt={};for(const t of out){if(/-n\d$/.test(t.id)){cnt[t.w]=(cnt[t.w]||0)+1;t.id=t.w+'-'+(100+cnt[t.w])}}
P1.tasks=out;
P1.items=P1.items.map(i=>i.order==='1475608061'&&i.item==='04-9326'?{...i,qty:24000}:i);
P1.items.splice(P1.items.findIndex(i=>i.order==='1475608061')+0,0,{order:'1475608061',item:'04-6825',loc:'合欣',qty:2400},{order:'1475608061',item:'04-9317',loc:'合欣',qty:3600});
P1.made='2026-10-18';P1.base='依原始訂單：1475608061 的 04-6825、04-9317、04-9326 全數未包（10/18 重排）';
require('fs').writeFileSync('site/plan.json',JSON.stringify(P1));
for(const t of out.filter(t=>t.order==='1475608061'&&['04-9326','04-6825','04-9317'].includes(t.item)))console.log(t.id,t.seg,t.qty,t.pd,t.s,t.e);
const hs={};for(const t of out){if(!P1.helpers[t.w])continue;hs[t.w]=t.e>(hs[t.w]||'')?t.e:hs[t.w]}console.log('helper last',hs,P1.helpers);
