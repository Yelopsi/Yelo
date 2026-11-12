const axios = require('axios');

class GoogleAdsService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 30 * 60 * 1000; // 30 minutos
    }

    // Lê sempre em tempo real do ambiente (Render em produção, .env apenas se não estiver definido no ambiente)
    get developerToken() { return process.env.GOOGLE_DEVELOPER_TOKEN; }
    get clientId() { return process.env.GOOGLE_ADS_CLIENT_ID; }
    get clientSecret() { return process.env.GOOGLE_ADS_CLIENT_SECRET; }
    get refreshToken() { return process.env.GOOGLE_REFRESH_TOKEN; }
    get customerId() { return process.env.GOOGLE_CUSTOMER_ID; }

    _getCache(key) {
        const item = this.cache.get(key);
        if (item && item.expiry > Date.now()) return item.value;
        return null;
    }

    _setCache(key, value) {
        this.cache.set(key, { value, expiry: Date.now() + this.cacheTTL });
    }

    isConfigured() {
        return !!(this.clientId && this.clientSecret && this.refreshToken && this.customerId);
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

    _buildHeaders(accessToken) {
        const headers = {
            'Authorization': `Bearer ${accessToken}`
        };
        if (this.developerToken) {
            headers['developer-token'] = this.developerToken;
        }
        if (process.env.GOOGLE_LOGIN_CUSTOMER_ID) {
            headers['login-customer-id'] = process.env.GOOGLE_LOGIN_CUSTOMER_ID.replace(/-/g, '');
        }
        return headers;
    }

    async queryGoogleAds(query, accessToken) {
        const customerIdRaw = this.customerId.replace(/-/g, '');
        const headers = this._buildHeaders(accessToken);

        const response = await axios.post(
            `https://googleads.googleapis.com/v25/customers/${customerIdRaw}/googleAds:search`,
            { query },
            { headers }
        );
        return response.data;
    }

    async getAccountSpend(dateStart, dateEnd) {
        if (!this.isConfigured()) {
            const err = new Error('GOOGLE_ADS_CONFIGURATION_MISSING');
            err.code = 'GOOGLE_ADS_CONFIGURATION_MISSING';
            throw err;
        }

        try {
            const cacheKey = `googleSpend_${dateStart}_${dateEnd}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                const err = new Error('Sem Access Token');
                err.code = 'GOOGLE_ADS_AUTH_FAILED';
                throw err;
            }

            const query = `
                SELECT metrics.cost_micros, metrics.impressions, metrics.clicks 
                FROM customer 
                WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
            `;

            const result = await this.queryGoogleAds(query, accessToken);
            if (!result.results || result.results.length === 0) return { spend: 0, impressions: 0, clicks: 0, cpc: 0 };

            const metrics = result.results[0].metrics;
            const spend = (metrics.costMicros || 0) / 1000000;
            const clicks = metrics.clicks || 0;
            
            const cachedResult = {
                spend: spend,
                impressions: metrics.impressions || 0,
                clicks: clicks,
                cpc: clicks > 0 ? (spend / clicks) : 0
            };
            this._setCache(cacheKey, cachedResult);
            return cachedResult;
        } catch (error) {
            console.log('\n========== CMO GOOGLE DEBUG CONFIG ==========');
            console.log('customerId:', this.customerId);
            console.log('loginCustomerId:', process.env.GOOGLE_LOGIN_CUSTOMER_ID || 'NÃO CONFIGURADO');
            console.log('developerTokenConfigured:', !!this.developerToken);
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

            const err = new Error(`[ERRO GOOGLE] ${cleanMsg}`);
            err.code = 'GOOGLE_ADS_API_ERROR';
            throw err;
        }
    }

    async getCampaignInsights(dateStart, dateEnd) {
        if (!this.isConfigured()) {
            const err = new Error('GOOGLE_ADS_CONFIGURATION_MISSING');
            err.code = 'GOOGLE_ADS_CONFIGURATION_MISSING';
            throw err;
        }

        try {
            const cacheKey = `googleCampaignInsights_${dateStart}_${dateEnd}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                const err = new Error('Sem Access Token');
                err.code = 'GOOGLE_ADS_AUTH_FAILED';
                throw err;
            }

            const query = `
                SELECT campaign.id, campaign.name, campaign_budget.amount_micros, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions 
                FROM campaign 
                WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
                ORDER BY metrics.cost_micros DESC
            `;

            const result = await this.queryGoogleAds(query, accessToken);
            if (!result.results) return [];

            const resultMapped = result.results.map(row => ({
                id: row.campaign.id,
                campaign_name: row.campaign.name,
                spend: (row.metrics.costMicros || 0) / 1000000,
                daily_budget: (row.campaignBudget?.amountMicros || 0) / 1000000,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                conversions: row.metrics.conversions || 0
            }));
            this._setCache(cacheKey, resultMapped);
            return resultMapped;
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

            const err = new Error(`[ERRO GOOGLE] ${cleanMsg}`);
            err.code = 'GOOGLE_ADS_API_ERROR';
            throw err;
        }
    }

    /**
     * Retorna detalhes da campanha ativa incluindo resource_name do budget e impression share perdido por orçamento.
     */
    async getActiveCampaignDetails(dateStart, dateEnd) {
        if (!this.isConfigured()) {
            const err = new Error('GOOGLE_ADS_CONFIGURATION_MISSING');
            err.code = 'GOOGLE_ADS_CONFIGURATION_MISSING';
            throw err;
        }

        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            const err = new Error('Sem Access Token');
            err.code = 'GOOGLE_ADS_AUTH_FAILED';
            throw err;
        }

        const dateClause = (dateStart && dateEnd)
            ? `AND segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'`
            : 'AND segments.date DURING LAST_7_DAYS';

        const query = `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign_budget.resource_name,
                campaign_budget.amount_micros,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.search_impression_share,
                metrics.search_budget_lost_impression_share,
                metrics.search_rank_lost_impression_share
            FROM campaign
            WHERE campaign.status = 'ENABLED' ${dateClause}
            ORDER BY metrics.cost_micros DESC
        `;

        const result = await this.queryGoogleAds(query, accessToken);
        const rows = result.results || [];
        return rows.map(row => ({
            id: String(row.campaign?.id || ''),
            campaign_name: row.campaign?.name || '',
            status: row.campaign?.status || 'UNKNOWN',
            budgetResourceName: row.campaignBudget?.resourceName || null,
            dailyBudgetReais: Number(((Number(row.campaignBudget?.amountMicros || 0)) / 1000000).toFixed(2)),
            spend: Number(((Number(row.metrics?.costMicros || 0)) / 1000000).toFixed(2)),
            impressions: Number(row.metrics?.impressions || 0),
            clicks: Number(row.metrics?.clicks || 0),
            conversions: Number(row.metrics?.conversions || 0),
            searchImpressionShare: Number(row.metrics?.searchImpressionShare || 0),
            searchBudgetLostImpressionShare: Number(row.metrics?.searchBudgetLostImpressionShare || 0),
            searchRankLostImpressionShare: Number(row.metrics?.searchRankLostImpressionShare || 0)
        }));
    }

    /**
     * Atualiza o orçamento diário da campanha Google Ads dentro dos limites seguros [R$ 90, R$ 200].
     * @param {number} newBudgetReais Valor diário desejado em R$
     * @param {Object} options { validateOnly, dryRun, budgetResourceName, minBudgetReais, maxBudgetReais }
     */
    async updateCampaignDailyBudget(newBudgetReais, options = {}) {
        const minBudget = Number.isFinite(Number(options.minBudgetReais)) ? Number(options.minBudgetReais) : 90;
        const maxBudget = Number.isFinite(Number(options.maxBudgetReais)) ? Number(options.maxBudgetReais) : 200;
        const numericTarget = Number(newBudgetReais);
        if (!Number.isFinite(numericTarget)) {
            return { success: false, reason: 'INVALID_BUDGET', message: 'Valor de orçamento inválido.' };
        }

        const clampedReais = Math.round(Math.min(maxBudget, Math.max(minBudget, numericTarget)) * 100) / 100;
        const amountMicros = String(Math.round(clampedReais * 1000000));
        const validateOnly = Boolean(options.validateOnly || options.dryRun);

        if (!this.isConfigured()) {
            return {
                success: false,
                reason: 'GOOGLE_ADS_CONFIGURATION_MISSING',
                clampedReais,
                validateOnly
            };
        }

        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return { success: false, reason: 'GOOGLE_ADS_AUTH_FAILED', clampedReais, validateOnly };
            }

            let budgetResourceName = options.budgetResourceName || process.env.GOOGLE_CAMPAIGN_BUDGET_RESOURCE || null;
            let previousBudgetReais = null;

            if (!budgetResourceName) {
                const details = await this.getActiveCampaignDetails();
                const primary = details[0];
                if (!primary || !primary.budgetResourceName) {
                    return { success: false, reason: 'NO_ENABLED_CAMPAIGN_BUDGET', clampedReais, validateOnly };
                }
                budgetResourceName = primary.budgetResourceName;
                previousBudgetReais = primary.dailyBudgetReais;
            }

            const customerIdRaw = this.customerId.replace(/-/g, '');
            const headers = this._buildHeaders(accessToken);

            const payload = {
                operations: [
                    {
                        updateMask: 'amountMicros',
                        update: {
                            resourceName: budgetResourceName,
                            amountMicros
                        }
                    }
                ],
                validateOnly
            };

            const response = await axios.post(
                `https://googleads.googleapis.com/v25/customers/${customerIdRaw}/campaignBudgets:mutate`,
                payload,
                { headers }
            );

            if (!validateOnly) {
                this.cache.clear();
            }

            return {
                success: true,
                validateOnly,
                budgetResourceName,
                previousBudgetReais,
                appliedBudgetReais: clampedReais,
                amountMicros,
                apiResponse: response.data || {}
            };
        } catch (error) {
            const detail = error.response?.data?.error?.message || error.response?.data?.[0]?.error?.message || error.message;
            console.error('[GoogleAdsService] Falha em updateCampaignDailyBudget:', detail);
            return {
                success: false,
                validateOnly,
                clampedReais,
                reason: 'GOOGLE_ADS_MUTATE_FAILED',
                error: detail
            };
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
