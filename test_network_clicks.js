const puppeteer = require('puppeteer');

async function testClickWithThrottling(url, networkConfig, name) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Emula um dispositivo móvel
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');

    // Configura o CDP para o throttling
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', networkConfig);

    console.log(`\n=== INICIANDO TESTE DE CONEXÃO: ${name} ===`);
    
    let apiCalls = 0;
    page.on('request', request => {
        if (request.url().includes('/api/public/whatsapp/link')) {
            apiCalls++;
        }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    console.log(`[${name}] Página carregada. Procurando botão de agendar...`);
    
    const btnSelector = 'a[id*="btn-agendar-whatsapp"]';
    await page.waitForSelector(btnSelector);

    // Tentamos dar 3 cliques rápidos (Double/Triple click spamming)
    console.log(`[${name}] Simulando 3 cliques rápidos no botão...`);
    const button = await page.$(btnSelector);
    
    await button.click();
    await button.click();
    await button.click();

    // Verifica o texto logo após clicar
    const textAfterClick = await page.evaluate(el => el.textContent, button);
    console.log(`[${name}] Texto no botão imediatamente após o clique: "${textAfterClick.trim()}"`);

    // Aguarda um tempo para a requisição terminar
    await new Promise(r => setTimeout(r, 4000));
    
    console.log(`[${name}] Total de requisições de link feitas para a API: ${apiCalls} (Deveria ser 1)`);
    
    if (apiCalls === 1) {
        console.log(`[${name}] ✅ SUCESSO: Apenas 1 clique foi processado pelo servidor.`);
    } else {
        console.log(`[${name}] ❌ ERRO: O botão permitiu cliques múltiplos (${apiCalls} requisições).`);
    }

    await browser.close();
}

const url = 'http://localhost:3000/crisiana-aparecida-campos-9102'; // O slug que extraímos

const networkConditions = {
    'Wi-Fi': {
        offline: false,
        downloadThroughput: 30 * 1024 * 1024 / 8,
        uploadThroughput: 15 * 1024 * 1024 / 8,
        latency: 2
    },
    '4G (Fast)': {
        offline: false,
        downloadThroughput: 1.5 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        latency: 40
    },
    '3G (Slow)': {
        offline: false,
        downloadThroughput: 500 * 1024 / 8,
        uploadThroughput: 500 * 1024 / 8,
        latency: 400
    }
};

(async () => {
    try {
        await testClickWithThrottling(url, networkConditions['Wi-Fi'], 'Wi-Fi');
        await testClickWithThrottling(url, networkConditions['4G (Fast)'], '4G');
        await testClickWithThrottling(url, networkConditions['3G (Slow)'], '3G');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
