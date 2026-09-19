const fs = require("fs");
const p = "C:\\Users\\Admin\\Desktop\\ANUM\\Facility Service App\\frontend\\src\\app\\(dashboard)\\dashboard\\page.tsx";
let c = fs.readFileSync(p, "utf8");

c = c.replace(/className=\{\\rounded-lg p-2 \}/g, "className={`rounded-lg p-2 ${accent}`}");
c = c.replace(/width: `\$\{Math\.min/g, "width: `${Math.min");

fs.writeFileSync(p, c);
console.log("Fixed:", !c.includes("{\\rounded-lg p-2 }"));

