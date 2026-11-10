const axios = require('axios');

class MetaAdsService {
    constructor() {
        this.accessToken = process.env.META_ACCESS_TOKEN || 'MOCK_META_TOKEN';
        this.adAccountId = process.env.META_AD_ACCOUNT_ID || 'MOCK_ACCOUNT_ID';
        this.graphApiUrl = 'https://graph.facebook.com/v19.0';
        this.cache = new Map();
        this.cacheTTL = 30 * 60 * 1000; // 30 minutos
    }

    _getCache(key) {
        const item = this.cache.get(key);
        if (item && item.expiry > Date.now()) return item.value;
        return null;
    }

    _setCache(key, value) {
        this.cache.set(key, { value, expiry: Date.now() + this.cacheTTL });
    }

    /**
     * Retorna os gastos gerais da conta por período.
     */
    async getAccountSpend(dateStart, dateEnd) {
        try {
            if (this.accessToken === 'MOCK_META_TOKEN') {
                return this.mockAccountSpend();
            }

            const cacheKey = `accountSpend_${dateStart}_${dateEnd}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const response = await axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/insights`, {
                params: {
                    access_token: this.accessToken,
                    time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
                    fields: 'spend,impressions,clicks,cpc,cpm'
                }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const data = response.data.data[0];
                const result = {
                    spend: parseFloat(data.spend) || 0,
                    impressions: parseInt(data.impressions) || 0,
                    clicks: parseInt(data.clicks) || 0,
                    cpc: parseFloat(data.cpc) || 0
                };
                this._setCache(cacheKey, result);
                return result;
            }
            this._setCache(cacheKey, { spend: 0, impressions: 0, clicks: 0, cpc: 0 });
            return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error('[MetaAdsService] Erro ao buscar gastos:', errorMsg);
            return { spend: 0, impressions: 0, clicks: 0, cpc: 0, error: errorMsg };
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

            const cacheKey = `campaignInsights_${dateStart}_${dateEnd}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const response = await axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/insights`, {
                params: {
                    access_token: this.accessToken,
                    level: 'campaign',
                    time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
                    fields: 'campaign_name,campaign_id,spend,impressions,clicks,cpc,actions'
                }
            });

            const result = (response.data.data || []).map(c => {
                let conversions = 0;
                if (c.actions) {
                    // Soma as ações de conversão relevantes (leads e cadastros)
                    const conversionActions = c.actions.filter(a => 
                        a.action_type === 'lead' || 
                        a.action_type === 'complete_registration' || 
                        a.action_type === 'contact' ||
                        a.action_type === 'purchase'
                    );
                    conversions = conversionActions.reduce((sum, a) => sum + parseInt(a.value || 0), 0);
                }
                return {
                    ...c,
                    conversions
                };
            });
            this._setCache(cacheKey, result);
            return result;
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error('[MetaAdsService] Erro ao buscar campanhas:', errorMsg);
            return [{ id: 'ERRO', campaign_name: `[ERRO META] ${errorMsg.substring(0,100)}`, spend: 0 }];
        }
    }

    async getCampaignBudgets() {
        try {
            if (this.accessToken === 'MOCK_META_TOKEN') {
                return [{ campaign_id: '120251213168140531', daily_budget: 35.00 }];
            }

            const cacheKey = `campaignBudgets`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const [campRes, adsetRes] = await Promise.all([
                axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/campaigns`, {
                    params: { access_token: this.accessToken, fields: 'id,daily_budget' }
                }),
                axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/adsets`, {
                    params: { access_token: this.accessToken, fields: 'campaign_id,daily_budget,status', effective_status: "['ACTIVE']" }
                })
            ]);

            const campaigns = campRes.data?.data || [];
            const adsets = adsetRes.data?.data || [];

            const result = campaigns.map(c => {
                let daily_budget = 0;
                if (c.daily_budget) {
                    daily_budget = parseInt(c.daily_budget) / 100;
                } else {
                    const cAdsets = adsets.filter(a => a.campaign_id === c.id && a.daily_budget);
                    daily_budget = cAdsets.reduce((sum, a) => sum + (parseInt(a.daily_budget) / 100), 0);
                }
                return { campaign_id: c.id, daily_budget };
            });
            this._setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('[MetaAdsService] Erro ao buscar budgets:', error.message);
            return [];
        }
    }

    /**
     * Atualiza o orçamento diário da campanha ou conjuntos de anúncio Meta Ads.
     * @param {number} newBudgetReais - Novo orçamento diário em Reais (ex: 29.00 ou 35.00)
     */
    async updateCampaignDailyBudget(newBudgetReais) {
        try {
            if (!this.accessToken || this.accessToken === 'MOCK_META_TOKEN') {
                return { success: false, reason: 'MOCK_TOKEN', message: 'Token Meta Ads mock ou não configurado.' };
            }

            const budgetCents = Math.round(newBudgetReais * 100);
            const campaignId = process.env.META_CAMPAIGN_ID || '120251213168140531';

            // 1. Tentar atualizar a campanha diretamente (caso utilize CBO)
            try {
                const response = await axios.post(`${this.graphApiUrl}/${campaignId}`, {
                    daily_budget: budgetCents
                }, {
                    params: { access_token: this.accessToken }
                });

                if (response.data && response.data.success) {
                    this.cache.delete('campaignBudgets');
                    console.log(`[MetaAdsService] Orçamento da campanha ${campaignId} atualizado para R$ ${newBudgetReais}/dia.`);
                    return { success: true, target: 'campaign', budgetReais: newBudgetReais };
                }
            } catch (campErr) {
                console.log(`[MetaAdsService] Atualização CBO no nível de campanha não aplicável ou falhou: ${campErr.message}. Tentando adsets...`);
            }

            // 2. Tentar atualizar no nível dos conjuntos de anúncio (AdSets) ativos
            const adsetsRes = await axios.get(`${this.graphApiUrl}/act_${this.adAccountId}/adsets`, {
                params: {
                    access_token: this.accessToken,
                    fields: 'id,campaign_id,status,daily_budget',
                    effective_status: "['ACTIVE']"
                }
            });

            const activeAdsets = (adsetsRes.data?.data || []).filter(a => a.campaign_id === campaignId || !campaignId);
            if (activeAdsets.length > 0) {
                const budgetPerAdset = Math.round(budgetCents / activeAdsets.length);
                for (const adset of activeAdsets) {
                    await axios.post(`${this.graphApiUrl}/${adset.id}`, {
                        daily_budget: budgetPerAdset
                    }, {
                        params: { access_token: this.accessToken }
                    });
                }
                this.cache.delete('campaignBudgets');
                console.log(`[MetaAdsService] Orçamento de ${activeAdsets.length} adsets atualizado para R$ ${newBudgetReais}/dia.`);
                return { success: true, target: 'adsets', budgetReais: newBudgetReais };
            }

            return { success: false, reason: 'NO_ACTIVE_ADSETS', message: 'Nenhum conjunto de anúncios ativo encontrado.' };
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error('[MetaAdsService] Falha ao atualizar orçamento Meta Ads:', errorMsg);
            return { success: false, error: errorMsg };
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
