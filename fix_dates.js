const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

// The current interval code for cashIn:
// const resCashIn = await sequelize.query(`
//    SELECT SUM(value) as cash_in FROM "Payments" 
//    WHERE status IN ('CONFIRMED', 'RECEIVED') 
//    AND "paymentDate" >= :dateStart AND "paymentDate" <= :dateEnd
// `, { replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT });

// We need to define nextDayStr at the start of the route
if (!content.includes('const nextDayStr')) {
    content = content.replace(
        "const dateEnd = req.query.dateEnd || new Date().toISOString().split('T')[0];",
        "const dateEnd = req.query.dateEnd || new Date().toISOString().split('T')[0];\n        const endDateObj = new Date(dateEnd);\n        endDateObj.setDate(endDateObj.getDate() + 1);\n        const nextDayStr = endDateObj.toISOString().split('T')[0];"
    );
}

// Replace cashIn dates
content = content.replace(
    /AND "paymentDate" >= :dateStart AND "paymentDate" <= :dateEnd\s*`, { replacements: { dateStart, dateEnd: dateEnd \+ ' 23:59:59' }/g,
    `AND "paymentDate" >= :dateStart AND "paymentDate" < :nextDayStr\n            \`, { replacements: { dateStart, nextDayStr }`
);

// Do the same for b2bQuery
// WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
// { replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }
content = content.replace(
    /WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd\s*`, { replacements: { dateStart, dateEnd: dateEnd \+ ' 23:59:59' }/g,
    `WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr\n            \`, { replacements: { dateStart, nextDayStr }`
);

// Check if any other ' 23:59:59' remains
fs.writeFileSync(path, content);
