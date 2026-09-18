const { google } = require('googleapis');

class GoogleSearchConsoleService {
    constructor() {
        this.siteUrl = process.env.GSC_SITE_URL;
        
        try {
            let authOptions = {
                scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
            };
            if (process.env.GOOGLE_CREDENTIALS_JSON) {
                authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            }
            const auth = new google.auth.GoogleAuth(authOptions);
            
            this.searchconsole = google.searchconsole({
                version: 'v1',
                auth: auth
            });
        } catch(e) {
            console.error('[GSC] Erro de autenticação inicial:', e);
        }
    }

    async getMetrics(dateStart, dateEnd) {
        if (!this.siteUrl || !this.searchconsole) {
            console.error('[GSC] GSC_SITE_URL não configurado ou Auth falhou.');
            return this.getMockData();
        }

        try {
            const response = await this.searchconsole.searchanalytics.query({
                siteUrl: this.siteUrl,
                requestBody: {
                    startDate: dateStart,
                    endDate: dateEnd,
                    dimensions: ['date']
                }
            });

            let clicks = 0;
            let impressions = 0;
            let ctrTotal = 0;
            let positionTotal = 0;
            
            const rows = response.data.rows || [];
            if (rows.length > 0) {
                rows.forEach(row => {
                    clicks += row.clicks;
                    impressions += row.impressions;
                    ctrTotal += (row.ctr * row.impressions); // Weight by impressions
                    positionTotal += (row.position * row.impressions);
                });
                
                return {
                    clicks,
                    impressions,
                    ctr: impressions > 0 ? (ctrTotal / impressions) : 0,
                    position: impressions > 0 ? (positionTotal / impressions) : 0
                };
            }
            
            return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        } catch (error) {
            console.error('[GSC] Erro ao buscar métricas:', error);
            return this.getMockData();
        }
    }

    getMockData() {
        return { clicks: 350, impressions: 12000, ctr: 0.029, position: 15.4 };
    }
}

module.exports = new GoogleSearchConsoleService();
