const axios = require('axios');

class GoogleAdsService {
    constructor() {
        this.developerToken = process.env.GOOGLE_DEVELOPER_TOKEN || 'MOCK_DEV_TOKEN';
        this.clientId = process.env.GOOGLE_ADS_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
        this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        this.customerId = process.env.GOOGLE_CUSTOMER_ID || 'MOCK_CUSTOMER_ID';
    }

    async getAccessToken() {
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                }
            });
            return response.data.access_token;
        } catch (error) {
            console.error('[GoogleAdsService] Erro ao obter access token:', error.response?.data || error.message);
            return null;
        }
    }

    async queryGoogleAds(query, accessToken) {
        const customerIdRaw = this.customerId.replace(/-/g, '');
        const response = await axios.post(
            `https://googleads.googleapis.com/v16/customers/${customerIdRaw}/googleAds:search`,
            { query },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': this.developerToken
                }
            }
        );
        return response.data;
    }

    async getAccountSpend(dateStart, dateEnd) {
        if (this.developerToken === 'MOCK_DEV_TOKEN') return this.mockAccountSpend();

        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) return { spend: 0, impressions: 0, clicks: 0, cpc: 0, error: 'Sem Access Token' };

            const query = `
                SELECT metrics.cost_micros, metrics.impressions, metrics.clicks 
                FROM customer 
                WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
            `;

            const result = await this.queryGoogleAds(query, accessToken);
            if (!result.results || result.results.length === 0) return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };

            const metrics = result.results[0].metrics;
            const spend = (metrics.cost_micros || 0) / 1000000;
            const clicks = metrics.clicks || 0;
            
            return {
                spend: spend,
                impressions: metrics.impressions || 0,
                clicks: clicks,
                cpc: clicks > 0 ? (spend / clicks) : 0
            };
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.response?.data || error.message;
            console.error('[GoogleAdsService] Erro ao buscar gastos:', errorMsg);
            return { spend: 0, impressions: 0, clicks: 0, cpc: 0, error: `[ERRO GOOGLE] ${JSON.stringify(errorMsg).substring(0,100)}` };
        }
    }

    async getCampaignInsights(dateStart, dateEnd) {
        if (this.developerToken === 'MOCK_DEV_TOKEN') return this.mockCampaignInsights();

        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) return [{ id: 'ERRO', campaign_name: '[ERRO GOOGLE] Sem Access Token', spend: 0 }];

            const query = `
                SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks 
                FROM campaign 
                WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
                ORDER BY metrics.cost_micros DESC
            `;

            const result = await this.queryGoogleAds(query, accessToken);
            if (!result.results) return [];

            return result.results.map(row => ({
                id: row.campaign.id,
                campaign_name: row.campaign.name,
                spend: (row.metrics.cost_micros || 0) / 1000000,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0
            }));
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.response?.data || error.message;
            console.error('[GoogleAdsService] Erro ao buscar campanhas:', errorMsg);
            return [{ id: 'ERRO_API', campaign_name: `[ERRO GOOGLE] ${JSON.stringify(errorMsg).substring(0,100)}`, spend: 0 }];
        }
    }

    mockAccountSpend() {
        return { spend: 850.20, impressions: 110000, clicks: 3200, cpc: 0.26 };
    }

    mockCampaignInsights() {
        return [
            { campaign_name: '[B2B] Rede de Pesquisa - Psicologos', campaign_id: 'G123', spend: 300.20, impressions: 45000, clicks: 1200 },
            { campaign_name: '[B2C] Rede de Pesquisa - Psicoterapia', campaign_id: 'G456', spend: 550.00, impressions: 65000, clicks: 2000 }
        ];
    }
}

module.exports = new GoogleAdsService();
