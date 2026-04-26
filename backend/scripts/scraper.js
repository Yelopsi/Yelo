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

        let cliques = 0;
        const MAX_CLIQUES = 5; // Quantas vezes ele vai clicar em "Ver mais!" por madrugada

        console.log(`\n[SCRAPER] --- Carregando lista de profissionais... ---`);
        while (cliques < MAX_CLIQUES) {
            // Rola até o final para forçar o botão a aparecer
            await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
            await new Promise(r => setTimeout(r, 1500));

            const clicou = await page.evaluate(() => {
                const botoes = Array.from(document.querySelectorAll('button'));
                const verMaisBtn = botoes.find(b => b.innerText && b.innerText.includes('Ver mais!'));
                if (verMaisBtn && !verMaisBtn.disabled) {
                    verMaisBtn.click();
                    return true;
                }
                return false;
            });

            if (clicou) {
                console.log(`[SCRAPER] Clicou em "Ver mais!" (${cliques + 1}/${MAX_CLIQUES}). Aguardando novos perfis...`);
                await new Promise(r => setTimeout(r, 3000)); // Espera os novos cards aparecerem na tela
                cliques++;
            } else {
                console.log(`[SCRAPER] Botão "Ver mais!" não encontrado ou fim da lista alcançado.`);
                break;
            }
        }

        console.log(`[SCRAPER] Lendo todos os perfis carregados na página...`);
        const leadsEncontrados = await page.evaluate(() => {
            const resultados = [];
            const linksWhatsapp = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');

            linksWhatsapp.forEach(link => {
                let telefone = '';
                const urlWa = link.href;
                
                // Extrai o telefone da URL do Whatsapp
                if (urlWa.includes('phone=')) {
                    telefone = new URL(urlWa).searchParams.get('phone');
                } else {
                    telefone = urlWa.split('/').pop().split('?')[0]; 
                }
                if (telefone) telefone = telefone.replace(/\D/g, ''); 

                // NOVO MÉTODO INFALÍVEL DE PEGAR O NOME:
                // Sobe na árvore DOM a partir do botão do WhatsApp nível a nível (até 10 níveis)
                let currentElement = link;
                let nome = 'Psicólogo(a) Prospectado(a)';
                
                for (let i = 0; i < 10; i++) {
                    if (!currentElement) break;
                    
                    const nameElement = currentElement.querySelector('p[class*="name"] a, p[class*="Name"] a, p[class*="name"], p[class*="Name"], h2, h3, strong');
                    
                    if (nameElement && nameElement.innerText.trim().length > 0) {
                        let tempNome = nameElement.innerText.trim();
                        if (tempNome.length < 50 && !tempNome.toLowerCase().includes('comece agora') && !tempNome.toLowerCase().includes('atendimento')) {
                            nome = tempNome;
                            break;
                        }
                    }
                    currentElement = currentElement.parentElement;
                }

                if (telefone && telefone.length >= 10) {
                    resultados.push({ nome, telefone });
                }
            });

            return resultados;
        });

        console.log(`[SCRAPER] Encontrados ${leadsEncontrados.length} contatos válidos. Salvando no banco...`);
            
        let salvosTotais = 0;
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
                
            // Se o lead já existia mas estava com o nome genérico, nós atualizamos agora que o nome funciona!
            if (!created && registro.nome === 'Psicólogo(a) Prospectado(a)' && lead.nome !== 'Psicólogo(a) Prospectado(a)') {
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
    // Passa a URL alvo (Pode ser modificada via Variável de Ambiente também)
    const urlAlvo = process.env.SCRAPER_TARGET_URL || 'https://www.psymeetsocial.com/busca';
    scrapeLeadsPuppeteer(urlAlvo);
}
