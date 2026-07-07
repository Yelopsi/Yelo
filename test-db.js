const db = require('./backend/models');
async function test() {
    try {
        const psi = await db.Psychologist.findOne({
            attributes: ['contractTemplate', 'pixKey', 'cidade', 'cpf', 'cnpj', 'valor_sessao_numero']
        });
        console.log('Success:', psi ? psi.toJSON() : 'null');
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
test();
