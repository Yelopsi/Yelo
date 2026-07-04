const fs = require('fs');
const codeToInject = fs.readFileSync('tmp_getFinancials.js', 'utf-8');
const targetPath = 'backend/controllers/adminDashboardController.js';
let currentCode = fs.readFileSync(targetPath, 'utf-8');

const startIndex = currentCode.indexOf('exports.getFinancials = async (req, res) => {');
const endIndex = currentCode.indexOf('/**', startIndex); // ends before the next JSDoc

if (startIndex > -1 && endIndex > -1) {
    const updatedCode = currentCode.substring(0, startIndex) + codeToInject + '\n\n' + currentCode.substring(endIndex);
    fs.writeFileSync(targetPath, updatedCode);
    console.log("Success replacing getFinancials!");
} else {
    console.error("Could not find start or end index.");
}
