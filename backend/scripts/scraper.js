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

        let salvosTotais = 0;
        let paginaAtual = 1;
        const MAX_PAGINAS = 5; // Limite de páginas por madrugada para não sobrecarregar

        while (paginaAtual <= MAX_PAGINAS) {
            console.log(`\n[SCRAPER] --- Lendo perfis na Página ${paginaAtual} ---`);

            // Rola a página para baixo em etapas para forçar o Lazy Load do React
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 3));
                await new Promise(r => setTimeout(r, 1000));
            }

            // Injeta código no navegador alvo para buscar os botões de WhatsApp
            const leadsEncontrados = await page.evaluate(() => {
                const resultados = [];
                
                // Busca todos os links que contém "wa.me" ou "api.whatsapp.com"
                const linksWhatsapp = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');

                linksWhatsapp.forEach(link => {
                    const urlWa = link.href;
                    let telefone = '';
                    
                    // Extrai o telefone da URL do Whatsapp
                    if (urlWa.includes('phone=')) {
                        telefone = new URL(urlWa).searchParams.get('phone');
                    } else {
                        telefone = urlWa.split('/').pop().split('?')[0]; 
                    }
                    if (telefone) telefone = telefone.replace(/\D/g, ''); 

                    // Tenta encontrar o card do psicólogo subindo na árvore DOM (Material UI usa classes como MuiPaper)
                    const card = link.closest('div[class*="card"], div[class*="Card"], div[class*="paper"], div[class*="MuiPaper"]') || link.parentElement.parentElement.parentElement;
                    
                    // Procura o nome (Geralmente em h4, h5 ou h6 no Material UI)
                    const nameElement = card ? card.querySelector('h2, h3, h4, h5, h6, p[class*="name"], strong') : null;
                    let nome = nameElement ? nameElement.innerText.trim() : 'Psicólogo(a) Prospectado(a)';

                    // Limpa textos de botões genéricos que podem ter sido pegos por engano
                    if (nome.length > 40 || nome.toLowerCase().includes('comece agora') || nome.toLowerCase().includes('atendimento')) {
                        nome = 'Psicólogo(a) Prospectado(a)';
                    }

                    if (telefone && telefone.length >= 10) {
                        resultados.push({ nome, telefone });
                    }
                });

                return resultados;
            });

            console.log(`[SCRAPER] Encontrados ${leadsEncontrados.length} contatos nesta página.`);
            
            let salvosNaPagina = 0;
            for (const lead of leadsEncontrados) {
                const [registro, created] = await db.Lead.findOrCreate({
                    where: { telefone: lead.telefone },
                    defaults: {
                        nome: lead.nome,
                        telefone: lead.telefone,
                        origem_url: url,
                        status_funil: 'Pendente'
                    }
                });
                
                // Se ele já existia, mas estava sem nome, atualizamos com o nome correto
                if (!created && registro.nome === 'Psicólogo(a) Prospectado(a)' && lead.nome !== 'Psicólogo(a) Prospectado(a)') {
                    await registro.update({ nome: lead.nome });
                }

                if (created) {
                    salvosNaPagina++;
                    salvosTotais++;
                }
            }

            console.log(`[SCRAPER] Salvos ${salvosNaPagina} novos leads da Página ${paginaAtual}.`);

            // Tenta ir para a próxima página
            if (paginaAtual < MAX_PAGINAS) {
                console.log(`[SCRAPER] Tentando avançar para a próxima página...`);
                // Procura botão padrão de paginação do Material UI
                const avançou = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                    const nextBtn = btns.find(b => {
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        return aria.includes('next page') || aria.includes('próxima') || aria.includes('next');
                    });
                    if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('Mui-disabled')) {
                        nextBtn.click();
                        return true;
                    }
                    return false;
                });

                if (avançou) {
                    await new Promise(r => setTimeout(r, 4000)); // Espera carregar a nova página
                    paginaAtual++;
                } else {
                    console.log(`[SCRAPER] Botão de próxima página não encontrado ou desabilitado. Parando por aqui.`);
                    break;
                }
            } else {
                break;
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
    // Passa a URL alvo (Pode ser modificada via Variável de Ambiente também)
    const urlAlvo = process.env.SCRAPER_TARGET_URL || 'https://www.psymeetsocial.com/busca';
    scrapeLeadsPuppeteer(urlAlvo);
}
