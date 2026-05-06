const fs = require('fs');
const path = require('path');

function fixMath(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                fixMath(fullPath);
            }
        } else if (['.js', '.html', '.ejs'].includes(path.extname(fullPath))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            // Reverte as divisões matemáticas que foram transformadas em comentários
            const mathFixes = [
                // --- 1. REPARA O ERRO DO SCRIPT ANTERIOR ---
                [new RegExp('Math\\\\.ceil\\(count / \\)\\),', 'g'), 'Math.ceil(count / parseInt(limit, 10)),'],
                [new RegExp('Math\\\\.ceil\\(count / \\)\\)', 'g'), 'Math.ceil(count / parseInt(limit, 10))'],
                [new RegExp('Math\\\\.ceil\\(count / \\)', 'g'), 'Math.ceil(count / limit)'],
                [new RegExp('Math\\\\.round\\( / \\)', 'g'), 'Math.round(totalRating / reviews.length)'],
                [new RegExp('Math\\\\.min\\(100, Math\\\\.round\\(totalRating / reviews\\\\.length\\) \\\\* 100\\)\\);', 'g'), 'Math.min(100, Math.round((totalRating / reviews.length) * 100));'],
                [new RegExp('Math\\\\.ceil\\((.*?)\\\\s+//\\\\s+(.*?)\\)', 'g'), 'Math.ceil($1 / $2)'],
                [new RegExp('Math\\\\.round\\((.*?)\\\\s+//\\\\s+(.*?)\\)', 'g'), 'Math.round($1 / $2)'],
                [new RegExp('count // limit', 'g'), 'count / limit'],
                [new RegExp('count // parseInt', 'g'), 'count / parseInt'],
                [new RegExp('mrr // payingActiveCount', 'g'), 'mrr / payingActiveCount'],
                [new RegExp('churnRate // 100', 'g'), 'churnRate / 100'],
                [new RegExp('arpu // \\\\(', 'g'), 'arpu / ('],
                [new RegExp('count // totalPsisForTracking', 'g'), 'count / totalPsisForTracking'],
                [new RegExp('rss // 1024 // 1024', 'g'), 'rss / 1024 / 1024'],
                [new RegExp('avgDuration // 60', 'g'), 'avgDuration / 60'],
                [new RegExp('totalClicks // totalMatches', 'g'), 'totalClicks / totalMatches'],
                [new RegExp('churnedCount // totalStart', 'g'), 'churnedCount / totalStart'],
                [new RegExp('churnedCount // totalUsersAtStartOfMonth', 'g'), 'churnedCount / totalUsersAtStartOfMonth'],
                [new RegExp('currentZoom // 100', 'g'), 'currentZoom / 100'],
                [new RegExp('100 // currentZoom', 'g'), '100 / currentZoom'],
                [new RegExp('48 // 12', 'g'), '48 / 12'],
                [new RegExp('\\\\) // sessoesPorMes', 'g'), ') / sessoesPorMes'],
                [new RegExp('value // \\\\(avg', 'g'), 'value / (avg'],
                [new RegExp('totalRating // reviews\\\\.length', 'g'), 'totalRating / reviews.length'],
                [new RegExp('\\\\) // \\\\(1000', 'g'), ') / (1000'],
                [new RegExp('100vh // 0\\\\.88', 'g'), '100vh / 0.88']
            ];

            for (const [regex, replacement] of mathFixes) {
                content = content.replace(regex, replacement);
            }
            
            // Reverte comentários no meio da linha que ficaram como divisão
            content = content.replace(/0\.15 \/ Atraso/g, '0.15 // Atraso');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Matemática corrigida: ${fullPath}`);
            }
        }
    }
}

fixMath(path.resolve(__dirname, '../'));
console.log("Revisão matemática finalizada com sucesso!");
