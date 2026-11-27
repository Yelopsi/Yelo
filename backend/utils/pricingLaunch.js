const NEW_PRICING_DEFAULT_ISO = '2027-01-01T00:00:00-03:00';

/**
 * Returns the configured rollout timestamp for the January 2027 pricing & Freemium model.
 * Defaults to 2027-01-01 00:00:00-03:00 (Brasilia time).
 */
function getNewPricingLaunchDate() {
    const raw = process.env.NEW_PRICING_LAUNCH_DATE;
    if (raw && String(raw).trim()) {
        const parsed = new Date(String(raw).trim());
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date(NEW_PRICING_DEFAULT_ISO);
}

/**
 * Returns true when the January 2027 pricing & Freemium model is active.
 */
function isNewPricingActive(now = new Date()) {
    const ref = now instanceof Date ? now : new Date(now);
    return ref.getTime() >= getNewPricingLaunchDate().getTime();
}

module.exports = {
    NEW_PRICING_DEFAULT_ISO,
    getNewPricingLaunchDate,
    isNewPricingActive
};
