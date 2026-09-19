require('dotenv').config({ path: '.env' });
const ga4 = require('./backend/services/googleAnalyticsService');
const gsc = require('./backend/services/googleSearchConsoleService');

async function test() {
    try {
        console.log("GA4 Property ID:", process.env.GA4_PROPERTY_ID);
        console.log("GSC Site URL:", process.env.GSC_SITE_URL);
        console.log("Creds:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
        
        const dateStart = '2026-09-01';
        const dateEnd = '2026-09-30';
        
        console.log("Testing GA4...");
        const gaData = await ga4.getMetrics(dateStart, dateEnd);
        console.log("GA4 Data:", gaData);
        
        console.log("\nTesting GSC...");
        const gscData = await gsc.getMetrics(dateStart, dateEnd);
        console.log("GSC Data:", gscData);
        
    } catch(e) {
        console.error(e);
    }
}
test();
