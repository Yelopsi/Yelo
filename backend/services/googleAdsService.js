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
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': this.developerToken
        };
        if (process.env.GOOGLE_LOGIN_CUSTOMER_ID) {
            headers['login-customer-id'] = process.env.GOOGLE_LOGIN_CUSTOMER_ID.replace(/-/g, '');
        }

        const response = await axios.post(
            `https://googleads.googleapis.com/v25/customers/${customerIdRaw}/googleAds:search`,
            { query },
            { headers }
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
            console.log('\n========== CMO GOOGLE DEBUG CONFIG ==========');
            console.log('customerId:', this.customerId);
            console.log('loginCustomerId:', process.env.GOOGLE_LOGIN_CUSTOMER_ID || 'NÃO CONFIGURADO');
            console.log('developerTokenConfigured:', this.developerToken !== 'MOCK_DEV_TOKEN');
            console.log('=============================================\n');

            let errorObj = error.response?.data || error.message;
            console.error('\n💥 [GoogleAdsService] ERRO ORIGINAL COMPLETO:\n', JSON.stringify(errorObj, null, 2));
            
            let cleanMsg = "Erro desconhecido";
            if (typeof errorObj === 'string' && errorObj.includes('<!DOCTYPE html>')) {
                cleanMsg = "404 Not Found (URL incorreta ou API desativada)";
            } else if (errorObj && errorObj[0] && errorObj[0].error) {
                cleanMsg = errorObj[0].error.message;
            } else if (errorObj && errorObj.error) {
                cleanMsg = errorObj.error.message || errorObj.error;
            } else {
                cleanMsg = error.message;
            }

            return { spend: 0, impressions: 0, clicks: 0, cpc: 0, error: `[ERRO GOOGLE] ${cleanMsg}` };
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
            let errorObj = error.response?.data || error.message;
            let cleanMsg = "Erro desconhecido";
            
            if (typeof errorObj === 'string' && errorObj.includes('<!DOCTYPE html>')) {
                cleanMsg = "404 Not Found (URL incorreta ou API desativada)";
            } else if (errorObj && errorObj[0] && errorObj[0].error) {
                cleanMsg = errorObj[0].error.message;
            } else if (errorObj && errorObj.error) {
                cleanMsg = errorObj.error.message || errorObj.error;
            } else {
                cleanMsg = error.message;
            }

            return [{ id: 'ERRO_API', campaign_name: `[ERRO GOOGLE] ${cleanMsg}`, spend: 0 }];
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
