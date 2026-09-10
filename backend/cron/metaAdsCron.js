const cron = require('node-cron');

function startMetaAdsCron() {
    // Liga a campanha (ACTIVE): toda segunda-feira às 00:00
    cron.schedule('0 0 * * 1', async () => {
        console.log('▶️ [CRON META ADS] Ligando campanha...');
        await setCampaignStatus('ACTIVE');
    }, { timezone: 'America/Sao_Paulo' });

    // Pausa a campanha (PAUSED): toda terça-feira às 23:59
    cron.schedule('59 23 * * 2', async () => {
        console.log('⏸️ [CRON META ADS] Pausando campanha...');
        await setCampaignStatus('PAUSED');
    }, { timezone: 'America/Sao_Paulo' });
    
    console.log('⏱️ [CRON META ADS] Agendador de Liga/Desliga da Meta inicializado (Fuso: America/Sao_Paulo).');
}

async function setCampaignStatus(status) {
    const campaignId = process.env.META_CAMPAIGN_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!campaignId || !accessToken) {
        console.error('🚨 [CRON META ADS] Variáveis META_CAMPAIGN_ID ou META_ACCESS_TOKEN ausentes no arquivo .env.');
        return;
    }

    try {
        const url = `https://graph.facebook.com/v19.0/${campaignId}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                access_token: accessToken
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error(`❌ [CRON META ADS] Erro retornado pela Graph API ao mudar status para ${status}:`, data.error?.message || data);
            return;
        }

        console.log(`✅ [CRON META ADS] Status da campanha ${campaignId} alterado com sucesso para: ${status}`);
    } catch (error) {
        console.error(`❌ [CRON META ADS] Erro de rede ou indisponibilidade ao tentar mudar status para ${status}:`, error.message);
    }
}

module.exports = { startMetaAdsCron };
