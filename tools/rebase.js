// 依 plan.json 的人天重新推算每段工作的開始／結束時間（不含任何進度記錄），寫回 plan.json。
// 用法：node tools/rebase.js plan.json
const fs=require("fs");const h=fs.readFileSync(__dirname+"/../index.html","utf8");
const js=h.slice(h.indexOf("const WK="),h.indexOf("function renderOrders"));
const file=process.argv[2];global.P0=JSON.parse(fs.readFileSync(file,"utf8"));
eval(js.replace("let P=null","let P=P0")+`
buildDays();const r=simulate();
for(const t of r.tasks){const pt=P.tasks.find(x=>x.id===t.id);const a=toT(t.st),b=toT(t.en,true);pt.s=a.d+'T'+a.hh;pt.e=b.d+'T'+b.hh}
fs.writeFileSync(file,JSON.stringify(P));
for(const o of P.orders){const x=r.ord[o.id];console.log(o.id,ft(x.fin,true),'buf',x.buf)}
`);
