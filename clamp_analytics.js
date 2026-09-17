const fs = require('fs');

let analyticsCtrl = fs.readFileSync('backend/controllers/adminAnalyticsController.js', 'utf8');
analyticsCtrl = analyticsCtrl.replace(/const { startDate, endDate } = req\.query;/g,
    "let { startDate, endDate } = req.query;\n        if (startDate && new Date(startDate) < new Date(2026, 6, 1)) startDate = '2026-07-01';");

fs.writeFileSync('backend/controllers/adminAnalyticsController.js', analyticsCtrl);
console.log('Feito');
