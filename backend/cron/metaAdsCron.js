// Removed node-cron logic. This is now orchestrated by cronScheduler.js

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

module.exports = { setCampaignStatus };
