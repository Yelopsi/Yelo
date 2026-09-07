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
        try {
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
        } catch (error) {
            console.error('[GoogleAdsService] Erro na API:', error.response?.data || error.message);
            return [];
        }
    }

    async getAccountSpend(dateStart, dateEnd) {
        if (this.developerToken === 'MOCK_DEV_TOKEN') return this.mockAccountSpend();
        
        const accessToken = await this.getAccessToken();
        if (!accessToken) return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };

        const query = `
            SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.average_cpc 
            FROM customer 
            WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
        `;

        const data = await this.queryGoogleAds(query, accessToken);
        
        let spend = 0, impressions = 0, clicks = 0, cpc = 0;
        
        if (data && data.length > 0 && data[0].results) {
            data.forEach(batch => {
                if (batch.results) {
                    batch.results.forEach(row => {
                        const m = row.metrics;
                        if (m) {
                            spend += (parseInt(m.costMicros) || 0) / 1000000;
                            impressions += (parseInt(m.impressions) || 0);
                            clicks += (parseInt(m.clicks) || 0);
                        }
                    });
                }
            });
            if (clicks > 0) cpc = spend / clicks;
        }

        return { spend, impressions, clicks, cpc };
    }

    async getCampaignInsights(dateStart, dateEnd) {
        if (this.developerToken === 'MOCK_DEV_TOKEN') return this.mockCampaignInsights();

        const accessToken = await this.getAccessToken();
        if (!accessToken) return [];

        const query = `
            SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.average_cpc 
            FROM campaign 
            WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
            AND metrics.cost_micros > 0
        `;

        const data = await this.queryGoogleAds(query, accessToken);
        
        const campaigns = [];
        
        if (data && data.length > 0 && data[0].results) {
            data.forEach(batch => {
                if (batch.results) {
                    batch.results.forEach(row => {
                        const c = row.campaign;
                        const m = row.metrics;
                        if (c && m) {
                            campaigns.push({
                                campaign_id: c.id,
                                campaign_name: c.name,
                                spend: (parseInt(m.costMicros) || 0) / 1000000,
                                impressions: parseInt(m.impressions) || 0,
                                clicks: parseInt(m.clicks) || 0,
                                cpc: (parseInt(m.averageCpc) || 0) / 1000000
                            });
                        }
                    });
                }
            });
        }

        return campaigns;
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
