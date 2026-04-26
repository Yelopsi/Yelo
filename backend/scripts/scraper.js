// backend/scripts/scraper.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const db = require('../models'); // Ajuste o caminho conforme a estrutura do seu projeto

/**
 * Função principal de Scraping com Puppeteer
 * @param {string} url - A URL alvo (ex: PsyMeet)
 */
async function scrapeLeadsPuppeteer(url) {
    let browser;
    try {
        console.log(`[SCRAPER] Iniciando navegador invisível...`);
        browser = await puppeteer.launch({ 
            headless: 'new', // Roda em background
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        
        // Finge ser um navegador real (evita alguns bloqueios básicos)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        console.log(`[SCRAPER] Acessando URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Espera uns segundos a mais para garantir que os cards em React carregaram
        await new Promise(r => setTimeout(r, 5000));

        // Rola a página para baixo para carregar imagens e itens via "Lazy Load"
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        console.log(`[SCRAPER] Lendo perfis na página...`);

        // Injeta código no navegador alvo para buscar os botões de WhatsApp
        const leadsEncontrados = await page.evaluate(() => {
            const resultados = [];
            
            // Busca todos os links que contém "wa.me" ou "api.whatsapp.com"
            const linksWhatsapp = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');

            linksWhatsapp.forEach(link => {
                const urlWa = link.href;
                let telefone = '';
                
                // Extrai o telefone da URL do Whatsapp (ex: api.whatsapp.com/send?phone=5511999999999)
                if (urlWa.includes('phone=')) {
                    telefone = new URL(urlWa).searchParams.get('phone');
                } else {
                    telefone = urlWa.split('/').pop().split('?')[0]; // Pega do formato wa.me/5511999...
                }
                
                if (telefone) telefone = telefone.replace(/\D/g, ''); // Deixa só números

                // Tenta adivinhar o nome do psicólogo subindo na árvore DOM (AJUSTAR SE NECESSÁRIO)
                const card = link.closest('div[class*="card"], div[class*="Card"], div[class*="paper"]') || link.parentElement.parentElement;
                const nameElement = card ? card.querySelector('h2, h3, h4, h5, p strong') : null;
                const nome = nameElement ? nameElement.innerText.trim() : 'Psicólogo(a) Prospectado(a)';

                if (telefone && telefone.length >= 10) {
                    resultados.push({ nome, telefone });
                }
            });

            return resultados;
        });

        let salvos = 0;
        console.log(`[SCRAPER] Encontrados ${leadsEncontrados.length} botões de WhatsApp. Salvando no banco...`);
        
        for (const lead of leadsEncontrados) {
            // O findOrCreate impede que salvemos o mesmo profissional duas vezes
            const [registro, created] = await db.Lead.findOrCreate({
                where: { telefone: lead.telefone },
                defaults: {
                    nome: lead.nome,
                    telefone: lead.telefone,
                    origem_url: url,
                    status_funil: 'Pendente'
                }
            });
            if (created) salvos++;
        }

        console.log(`[SCRAPER] Concluído! ${salvos} novos leads adicionados com sucesso.`);

    } catch (error) {
        console.error('[SCRAPER] Erro fatal:', error.message);
    } finally {
        if (browser) await browser.close();
        await db.sequelize.close();
        process.exit(0);
    }
}

// === Execução do Script ===
if (require.main === module) {
    // Passa a URL alvo (Pode ser modificada via Variável de Ambiente também)
    const urlAlvo = process.env.SCRAPER_TARGET_URL || 'https://www.psymeetsocial.com/busca';
    scrapeLeadsPuppeteer(urlAlvo);
}
