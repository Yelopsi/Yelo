const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('const prevEndDateObj = new Date(prevDateEnd);')) {
    content = content.replace(
        "const prevDateEnd = req.query.prevDateEnd || prevDefaultEnd.toISOString().split('T')[0];",
        "const prevDateEnd = req.query.prevDateEnd || prevDefaultEnd.toISOString().split('T')[0];\n        const prevEndDateObj = new Date(prevDateEnd);\n        prevEndDateObj.setDate(prevEndDateObj.getDate() + 1);\n        const prevNextDayStr = prevEndDateObj.toISOString().split('T')[0];"
    );
}

// 1. replace <= :dateEnd with < :nextDayStr
content = content.replace(/<= :dateEnd/g, "< :nextDayStr");

// 2. replace replacements for dateEnd
content = content.replace(/dateEnd: dateEnd \+ ' 23:59:59'/g, "nextDayStr");

// 3. replace replacements for prevDateEnd
content = content.replace(/dateEnd: prevDateEnd \+ ' 23:59:59'/g, "nextDayStr: prevNextDayStr");
content = content.replace(/<= :prevDateEnd/g, "< :prevNextDayStr"); // wait, prevDateEnd uses dateEnd param in the query string usually, let's look:
// "replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }"
// Wait, the SQL says `<= :dateEnd` and the replacements map `dateEnd`.
// If I changed the SQL to `< :nextDayStr`, then the replacements should be `nextDayStr`.

// Fix b2cQuery90 and globalChurn90
content = content.replace(/dateEnd: dateEnd \+ ' 23:59:59'/g, "nextDayStr");

fs.writeFileSync(path, content);
