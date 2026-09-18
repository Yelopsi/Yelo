const { BetaAnalyticsDataClient } = require('@google-analytics/data');

class GoogleAnalyticsService {
    constructor() {
        this.propertyId = process.env.GA4_PROPERTY_ID;
        
        let clientOptions = {};
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            clientOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        }
        this.analyticsDataClient = new BetaAnalyticsDataClient(clientOptions);
    }

    async getMetrics(dateStart, dateEnd) {
        if (!this.propertyId) {
            console.error('[GA4] GA4_PROPERTY_ID não configurado.');
            return this.getMockData();
        }

        try {
            const [response] = await this.analyticsDataClient.runReport({
                property: `properties/${this.propertyId}`,
                dateRanges: [
                    {
                        startDate: dateStart,
                        endDate: dateEnd,
                    },
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'screenPageViews' },
                    { name: 'bounceRate' }
                ],
            });

            if (response.rows && response.rows.length > 0) {
                const row = response.rows[0];
                return {
                    sessions: parseInt(row.metricValues[0].value) || 0,
                    users: parseInt(row.metricValues[1].value) || 0,
                    pageviews: parseInt(row.metricValues[2].value) || 0,
                    bounceRate: parseFloat(row.metricValues[3].value) || 0
                };
            }

            return { sessions: 0, users: 0, pageviews: 0, bounceRate: 0 };
        } catch (error) {
            console.error('[GA4] Erro ao buscar métricas:', error);
            return this.getMockData();
        }
    }

    getMockData() {
        return { sessions: 1250, users: 980, pageviews: 3400, bounceRate: 0.45 };
    }
}

module.exports = new GoogleAnalyticsService();
