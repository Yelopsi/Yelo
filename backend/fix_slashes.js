const fs = require('fs');
const path = require('path');

function fixSlashes(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                fixSlashes(fullPath);
            }
        } else if (['.js', '.html', '.ejs', '.css'].includes(path.extname(fullPath))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            content = content.replace(/^(\s*)\/ /gm, '$1// ');
            content = content.replace(/([;{}(,a-zA-Z0-9'"])\s+\/ /g, '$1 // ');
            content = content.replace(/https:\/([^\/])/g, 'https://$1');
            content = content.replace(/http:\/([^\/])/g, 'http://$1');
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Corrigido: ${fullPath}`);
            }
        }
    }
}

fixSlashes(path.resolve(__dirname, '../'));
console.log("Todos os arquivos foram corrigidos com sucesso!");