const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'backup_yelo_final_v3.sql'), 'utf16le');

// Acha o bloco de COPY public."Psychologists"
const startIndex = content.indexOf('COPY public."Psychologists"');
if (startIndex === -1) {
    console.error("Não achou a tabela Psychologists no dump.");
    process.exit(1);
}

const headerEndIndex = content.indexOf('\n', startIndex);
const header = content.substring(startIndex, headerEndIndex);
console.log(header);

const columnsString = header.match(/\((.*?)\)/)[1];
const columns = columnsString.split(',').map(c => c.trim().replace(/"/g, ''));

const idIndex = columns.indexOf('id');
const nomeIndex = columns.indexOf('nome');
const emailIndex = columns.indexOf('email');
const subIndex = columns.indexOf('subscriptionId');
const expiresIndex = columns.indexOf('planExpiresAt');
const statusIndex = columns.indexOf('status');

const endIndex = content.indexOf('\\.', headerEndIndex);
const dataBlock = content.substring(headerEndIndex + 1, endIndex);

const lines = dataBlock.split('\n').filter(l => l.trim() !== '');
const psis = [];

for (const line of lines) {
    const fields = line.split('\t');
    const psi = {
        id: fields[idIndex],
        nome: fields[nomeIndex],
        email: fields[emailIndex],
        subscriptionId: fields[subIndex] === '\\N' ? null : fields[subIndex],
        planExpiresAt: fields[expiresIndex] === '\\N' ? null : fields[expiresIndex],
        status: fields[statusIndex]
    };
    psis.push(psi);
}

fs.writeFileSync('db_psis.json', JSON.stringify(psis, null, 2));
console.log(`Parsed ${psis.length} psicólogos from SQL dump and saved to db_psis.json`);
