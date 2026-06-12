const puppeteer = require('puppeteer');

async function testarJornadaDeMatch() {
    console.log('🤖 Iniciando bateria de testes locais antes do deploy...');
    
    let browser;
    try {
        // Roda de forma invisível (headless)
        browser = await puppeteer.launch({ 
            headless: 'new',
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        }); 
        const page = await browser.newPage();

        console.log('⏳ Verificando se o servidor local está no ar...');
        try {
            // Tenta acessar o sistema localmente
            await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
        } catch (err) {
            throw new Error('O servidor local não está rodando. Inicie o sistema com "npm run dev" em outro terminal antes de tentar fazer um deploy.');
        }

        console.log('⏳ Acessando o questionário de Match...');
        await page.goto('http://localhost:3001/questionario', { waitUntil: 'networkidle2' });
        
        // Verifica se a página carregou em branco procurando se o título carregou
        const tituloExiste = await page.$('h1, h2, h3'); 
        
        if (tituloExiste) {
            console.log('✅ SUCESSO: O questionário está no ar e renderizando sem erros críticos!');
        } else {
            throw new Error('A página carregou em branco ou os elementos principais não foram encontrados.');
        }

        console.log('🚀 Testes E2E finalizados com sucesso! Iniciando envio (Push) para produção...');
        await browser.close();
        process.exit(0); // 0 = Sucesso (Permite que o "git push" aconteça)

    } catch (error) {
        console.error('\n❌ ERRO DE QUALIDADE (QA): O teste falhou!');
        console.error('Motivo:', error.message);
        console.error('🚫 DEPLOY CANCELADO. O código quebrado NÃO foi enviado para o servidor.\n');
        if (browser) await browser.close();
        process.exit(1); // 1 = Erro (Bloqueia o "git push")
    }
}

testarJornadaDeMatch();