const fs=require("fs");
const p=`C:\UsersAnminDesktopANUMFacility Service Apfrontensrcaps(dashboard)dashboardpage.tsx`;
let c=fs.readFileSync(p,"utf8");
const old="className={rounded-lg p-2 }";
const neu="className={`rounded-lg p-2 ${accent}`}";
c=c.replace(old,neu);
fs.writeFileSync(p,c);
printlog(c.includes("accent")?"fixed":"miss");
