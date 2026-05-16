// backend/scripts/scraper.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const db = require('../models'); // Ajuste o caminho conforme a estrutura do seu projeto

/**
 * Função principal de Scraping usando Google Dorking com Puppeteer
 * @param {string} searchTerm - A Dork do Google (ex: site:instagram.com "psicólogo" "wa.me")
 */
async function scrapeLeadsPuppeteer(searchTerm) {
    let browser;
    try {
        console.log(`[SCRAPER] Iniciando navegador invisível...`);
        browser = await puppeteer.launch({ 
            headless: 'new', // Roda em background
            executablePath: puppeteer.executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        
        // Finge ser um navegador real para evitar o bloqueio inicial do Google
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // Construindo a URL de busca do Google (pedindo até 50 resultados na primeira página)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&num=50`;
        console.log(`[SCRAPER] Acessando Google Dorking: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Espera de segurança para humanização
        await new Promise(r => setTimeout(r, 5000));

        // Rola a página para baixo aos poucos para imitar comportamento humano
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight - window.innerHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        console.log(`[SCRAPER] Lendo os resultados do Google...`);
        const leadsEncontrados = await page.evaluate(() => {
            const resultados = [];
            // Seleciona as caixas orgânicas padrão do Google Search
            const searchBlocks = document.querySelectorAll('div.g');

            searchBlocks.forEach(block => {
                const titleElement = block.querySelector('h3');
                const linkElement = block.querySelector('a');
                // O texto resumo de onde normalmente pegamos o "wa.me/numero"
                const snippetElement = block.querySelector('div.VwiC3b, div.IsZvec'); 

                if (titleElement && linkElement && snippetElement) {
                    let nome = titleElement.innerText;
                    const url = linkElement.href;
                    const snippetText = snippetElement.innerText;

                    // Limpeza Inteligente do Nome (Remove "(@usuario) • Instagram..." ou " - Psicólogo")
                    nome = nome.split('(@')[0].split('-')[0].split('|')[0].trim();
                    if (nome.toLowerCase().includes('psicólog')) {
                        // Tira a palavra Psicólogo do nome se estiver colada (ex: "Psicóloga Maria")
                        nome = nome.replace(/Psicólog[oa]\s*/i, '').trim();
                    }
                    if (!nome || nome.length > 50) nome = 'Colega do Instagram';

                    // Extração do Telefone via Regex no Snippet
                    let telefone = '';
                    // Tenta achar padrões tipo "wa.me/5511999999999" ou "whatsapp 11999999999"
                    const waMatch = snippetText.match(/wa\.me\/?(\d+)/i) || snippetText.match(/(?:whatsapp|wa).*?(\d{10,11})/i);
                    
                    if (waMatch && waMatch[1]) {
                        telefone = waMatch[1].replace(/\D/g, '');
                        // Se não tiver código do país e for do BR (10 ou 11 dígitos), coloca o 55
                        if (telefone.length === 10 || telefone.length === 11) {
                            telefone = '55' + telefone;
                        }
                    }

                    // Se encontrou um número longo o suficiente para ser WhatsApp
                    if (telefone && telefone.length >= 10) {
                        resultados.push({ nome, telefone, url });
                    }
                }
            });

            return resultados;
        });

        console.log(`[SCRAPER] Encontrados ${leadsEncontrados.length} perfis com WhatsApp visível. Salvando no banco...`);
            
        let salvosTotais = 0;
        for (const lead of leadsEncontrados) {
            const [registro, created] = await db.Lead.findOrCreate({
                where: { telefone: lead.telefone },
                defaults: {
                    nome: lead.nome,
                    telefone: lead.telefone,
                    origem_url: lead.url,
                    status_funil: 'Pendente'
                }
            });
                
            // Atualiza o nome se antes estava genérico
            if (!created && registro.nome.includes('Instagram') && !lead.nome.includes('Instagram')) {
                await registro.update({ nome: lead.nome });
            }

            if (created) {
                salvosTotais++;
            }
        }
         
        console.log(`\n[SCRAPER] Prospecção Concluída! Total de ${salvosTotais} novos leads adicionados com sucesso.`);

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
    // A string de busca do Google (Dork). Você pode mudar a cidade ou parâmetros via variável de ambiente.
    const queryPersonalizada = process.env.SCRAPER_DORK_QUERY || 'site:instagram.com "psicólogo" OR "psicóloga" "crp" "wa.me"';
    scrapeLeadsPuppeteer(queryPersonalizada);
}
