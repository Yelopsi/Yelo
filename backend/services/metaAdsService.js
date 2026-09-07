const axios = require('axios');

class MetaAdsService {
    constructor() {
        this.accessToken = process.env.META_ACCESS_TOKEN || 'MOCK_META_TOKEN';
        this.adAccountId = process.env.META_AD_ACCOUNT_ID || 'MOCK_ACCOUNT_ID';
        this.graphApiUrl = 'https://graph.facebook.com/v19.0';
    }

    /**
     * Retorna os gastos gerais da conta por período.
     */
    async getAccountSpend(dateStart, dateEnd) {
        try {
            if (this.accessToken === 'MOCK_META_TOKEN') {
                return this.mockAccountSpend();
            }

            const response = await axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/insights`, {
                params: {
                    access_token: this.accessToken,
                    time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
                    fields: 'spend,impressions,clicks,cpc,cpm'
                }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const data = response.data.data[0];
                return {
                    spend: parseFloat(data.spend) || 0,
                    impressions: parseInt(data.impressions) || 0,
                    clicks: parseInt(data.clicks) || 0,
                    cpc: parseFloat(data.cpc) || 0
                };
            }
            return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };
        } catch (error) {
            console.error('[MetaAdsService] Erro ao buscar gastos:', error.response?.data || error.message);
            return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };
        }
    }

    /**
     * Retorna gastos segmentados por campanha.
     */
    async getCampaignInsights(dateStart, dateEnd) {
        try {
            if (this.accessToken === 'MOCK_META_TOKEN') {
                return this.mockCampaignInsights();
            }

            const response = await axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/insights`, {
                params: {
                    access_token: this.accessToken,
                    level: 'campaign',
                    time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
                    fields: 'campaign_name,campaign_id,spend,impressions,clicks,cpc'
                }
            });

            return response.data.data || [];
        } catch (error) {
            console.error('[MetaAdsService] Erro ao buscar campanhas:', error.response?.data || error.message);
            return [];
        }
    }

    mockAccountSpend() {
        return {
            spend: 1450.50,
            impressions: 250000,
            clicks: 4500,
            cpc: 0.32
        };
    }

    mockCampaignInsights() {
        return [
            { campaign_name: '[B2B] Captacao Psicologos - Nacional', campaign_id: '123456789', spend: 800.00, impressions: 120000, clicks: 2100 },
            { campaign_name: '[B2C] Terapia Ansiedade - SP', campaign_id: '987654321', spend: 650.50, impressions: 130000, clicks: 2400 }
        ];
    }
}

module.exports = new MetaAdsService();
