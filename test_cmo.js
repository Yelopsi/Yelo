const { sequelize } = require('./backend/models');
const metaAdsService = require('./backend/services/metaAdsService');
const googleAdsService = require('./backend/services/googleAdsService');

async function test() {
    try {
        const dateStart = '2026-09-01';
        const dateEnd = '2026-09-30';
        const prevDateStart = '2026-08-01';
        const prevDateEnd = '2026-08-31';
        
        console.log("Fetching insights...");
        const res = await Promise.all([
            metaAdsService.getCampaignInsights(dateStart, dateEnd),
            googleAdsService.getCampaignInsights(dateStart, dateEnd),
            metaAdsService.getCampaignInsights(prevDateStart, prevDateEnd),
            googleAdsService.getCampaignInsights(prevDateStart, prevDateEnd),
            metaAdsService.getCampaignInsights('2026-05-01', dateEnd),
            googleAdsService.getCampaignInsights('2026-05-01', dateEnd)
        ]);
        console.log("Success");
    } catch(e) {
        console.error("FAILED: ", e);
    }
    process.exit(0);
}
test();
