const nodemailer = require('nodemailer');
nodemailer.createTestAccount().then(a => {
  console.log('USER=' + a.user);
  console.log('PASS=' + a.pass);
  console.log('HOST=' + a.smtp.host);
  console.log('PORT=' + a.smtp.port);
  console.log('SECURE=' + (a.smtp.secure ? 'true' : 'false'));
}).catch(e => { console.error(e); process.exit(1); });
