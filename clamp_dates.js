const fs = require('fs');
const files = [
    'backend/services/growthAcquisitionService.js',
    'backend/services/growthDemandService.js',
    'backend/services/growthMarketingService.js',
    'backend/services/growthService.js'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/periodStart\.setDate\(periodStart\.getDate\(\) - periodDays\);/g, 
        "periodStart.setDate(periodStart.getDate() - periodDays);\n        // Clamp para 1 de Maio de 2026 (não tinha ads antes)\n        if (periodStart < new Date(2026, 4, 1)) periodStart.setTime(new Date(2026, 4, 1).getTime());");
    fs.writeFileSync(file, content);
});

// Admin Growth Controller
let growthCtrl = fs.readFileSync('backend/controllers/adminGrowthController.js', 'utf8');
growthCtrl = growthCtrl.replace(/const start = new Date\(`\$\{startDate\}T00:00:00-03:00`\);/g,
    "const start = new Date(`${startDate}T00:00:00-03:00`);\n            if (start < new Date(2026, 4, 1)) start.setTime(new Date(2026, 4, 1).getTime());");
growthCtrl = growthCtrl.replace(/thirtyDaysAgo\.setDate\(thirtyDaysAgo\.getDate\(\) - 30\);/g,
    "thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);\n            if (thirtyDaysAgo < new Date(2026, 4, 1)) thirtyDaysAgo.setTime(new Date(2026, 4, 1).getTime());");
fs.writeFileSync('backend/controllers/adminGrowthController.js', growthCtrl);

// Admin Dashboard Controller
let dashCtrl = fs.readFileSync('backend/controllers/adminDashboardController.js', 'utf8');
dashCtrl = dashCtrl.replace(/let start = parseDateBRT\(req\.query\.startDate, false\);/g,
    "let start = parseDateBRT(req.query.startDate, false);\n        if (start && start < new Date(2026, 4, 1)) start.setTime(new Date(2026, 4, 1).getTime());");
dashCtrl = dashCtrl.replace(/let startDate = parseDateBRT\(req\.query\.startDate, false\);/g,
    "let startDate = parseDateBRT(req.query.startDate, false);\n        if (startDate && startDate < new Date(2026, 4, 1)) startDate.setTime(new Date(2026, 4, 1).getTime());");

fs.writeFileSync('backend/controllers/adminDashboardController.js', dashCtrl);

console.log('Feito');
