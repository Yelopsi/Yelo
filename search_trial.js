const fs = require('fs');
const files = fs.readdirSync('./backend/controllers');
files.forEach(f => {
    const code = fs.readFileSync(`./backend/controllers/${f}`, 'utf8');
    if (code.toLowerCase().includes('trial') || code.toLowerCase().includes('expi')) {
        console.log(`Found in ${f}`);
    }
});
