const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

// The ttfcQuery has:
// { replacements: { dateStart: startDate, dateEnd: endDate }
// Let's replace endDate with nextDayStr. Wait, nextDayStr is defined in getEfficiencyMetrics? No, nextDayStr is defined globally in the route.
// Wait! getEfficiencyMetrics receives dateStart and dateEnd as strings. It needs to compute nextDayStr internally!

content = content.replace(
    /const getEfficiencyMetrics = async \(startDate, endDate\) => \{/g,
    `const getEfficiencyMetrics = async (startDate, endDate) => {
                const edObj = new Date(endDate);
                edObj.setDate(edObj.getDate() + 1);
                const nextDayStrEff = edObj.toISOString().split('T')[0];`
);

content = content.replace(
    /replacements: \{ dateStart: startDate, dateEnd: endDate \}/g,
    "replacements: { dateStart: startDate, nextDayStr: nextDayStrEff }"
);

fs.writeFileSync(path, content);
