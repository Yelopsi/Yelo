const fs = require('fs');
const content = fs.readFileSync('/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js', 'utf8');

// Identify all sequelize.query replacements and ensure nextDayStr is used properly
const matches = [...content.matchAll(/replacements:\s*\{[^}]*\}/g)];
matches.forEach(m => {
    // just check if they have nextDayStr but it's not defined
    if (m[0].includes('nextDayStr') || m[0].includes('dateEnd')) {
        // console.log(m[0]);
    }
});
