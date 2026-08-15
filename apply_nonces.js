const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

let modifiedFiles = 0;

walkDir(viewsDir, function(filePath) {
    if (filePath.endsWith('.ejs')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Substitui <script> e <script type="..."> para incluir o nonce
        // Evitando substituir <script src="..."> que já tem src, embora não fizesse mal
        let newContent = content.replace(/<script(?![^>]*nonce=)([^>]*)>/g, '<script nonce="<%= nonce %>"$1>');
        
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            modifiedFiles++;
        }
    }
});

console.log(`✅ Adicionado atributo nonce a scripts inline em ${modifiedFiles} arquivos .ejs.`);
