const fs = require('fs');
const p = 'src/analytics/analytics.service.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('decision: { not: "PENDING" }', 'decision: "APPROVED"');
fs.writeFileSync(p, c);
console.log('Fixed');
