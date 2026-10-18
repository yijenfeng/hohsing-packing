const fs=require("fs");const h=fs.readFileSync(process.argv[2],"utf8");
const js=h.slice(h.indexOf("const WK="),h.indexOf("/* ---------- render"));
global.P0=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const test=fs.readFileSync(process.argv[4],"utf8");
eval(js.replace("let P=null","let P=P0")+"\n"+test);
