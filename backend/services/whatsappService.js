// Estas variáveis virão do seu arquivo .env posteriormente
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID || '';
const API_VERSION = 'v18.0'; // Versão atual da Cloud API

/**
 * Envia um Template de Mensagem (Obrigatório para mensagens ativas como Lembretes)
 * @param {string} phone - Número do destinatário (ex: 5511999999999)
 * @param {string} templateName - Nome do template aprovado na Meta
 * @param {string} languageCode - Código do idioma (ex: 'pt_BR')
 * @param {Array} components - Variáveis e botões dinâmicos do template
 */
exports.sendTemplateMessage = async (phone, templateName, languageCode = 'pt_BR', components = []) => {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        console.log(`[WHATSAPP MOCK] Template '${templateName}' para ${phone}`);
        return true; // Simula sucesso se as credenciais não estiverem configuradas
    }

    try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components: components // Variáveis que substituem os {{1}}, {{2}} no texto
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[WHATSAPP API ERROR]', data);
            return false;
        }
        
        console.log(`[WHATSAPP API] Template '${templateName}' enviado para ${phone}. MessageID:`, data.messages?.[0]?.id);
        return true;
    } catch (error) {
        console.error('[WHATSAPP API EXCEPTION]', error.message);
        return false;
    }
};

/**
 * Envia uma mensagem de texto livre (Só funciona se o paciente respondeu nas últimas 24h)
 */
exports.sendMessage = async (phone, message) => {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        console.log(`\n📱 [WHATSAPP MOCK TEXTO] Para ${phone}:`);
        console.log(`   "${message}"\n`);
        return true;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phone,
                type: 'text',
                text: { preview_url: true, body: message }
            })
        });

        if (!response.ok) console.error('[WHATSAPP API ERROR]', await response.json());
        return response.ok;
    } catch (error) {
        console.error('[WHATSAPP API EXCEPTION]', error.message);
        return false;
    }
};

/**
 * Wrapper legado para compatibilidade com o código antigo do server.js
 * Usaremos isso temporariamente até você aprovar os templates oficiais.
 */
exports.sendInteractiveMessage = async (phone, text, options) => {
    // No futuro, isso será substituído por uma chamada real de template com botões
    console.log(`\n📱 [WHATSAPP MOCK INTERATIVO] Para ${phone}:`);
    console.log(`   Texto: "${text}"`);
    console.log(`   Opções: [ ${options.join(' | ')} ]\n`);
    return true;
};

exports.formatDate = (date) => {
    return new Date(date).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
};