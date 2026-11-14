export interface SimMathParams {
  targetMonths: number;
  currentBase: number;
  arpu: number;
  demandEligibilityRate: number;
  futureDemandEligibilityRate: number;
  demandEligiblePaidBase: number;
  contactsPerPaidPsiMonth: number;
  verifiedOrganicContacts: number;
  cplGoogle: number;
  reinvestRate: number;
  extraCash: number;
  rolloverCash: number;
  histMetaMonthlySpendAvg: number;
  cacMeta: number;
  trialConversionRate: number;
  monthlyChurn: number;
  newOrganicActive: number;
  mechanicallyRenewableBase: number;
  manualLegacyBase: number;
  knownScheduledChurn: number;
  retroMonths: number;
  realCurrentBase: number;
  operationalForwardBase: number;
  cacDegradation: number;
  cplDegradation: number;
  fixedOPEX: number;
  taxRate: number;
  gatewayRate: number;
  varCostRate: number;
  metaScalePenalty: number;
}

export interface SimMathResult {
  labels: string[];
  dataExpectedBase: number[];
  dataRevenue: number[];
  dataMetaBudget: (number | null)[];
  dataGoogleBudget: (number | null)[];
  dataLTV: (number | null)[];
  dataPayback: (number | null)[];
  dataMetaExtrapolationMultiple: (number | null)[];
  mrrAt12: number;
  baseAt12: number;
  metaBudgetAt12: number;
  googleBudgetAt12: number;
  actionMetaSpend: number;
  actionGoogleMaintenance: number;
  actionTrialGoogleSpend: number;
  actionUnspentCash: number;
  actionCACPenalized: number;
}

export interface SimulatorSettingsInput {
  reinvestRate: number;
  extraCash: number;
  includeOrganic: boolean;
  fixedOPEX?: number;
  taxRate?: number;
  varCostRate?: number;
  cacDegradation?: number;
  cplDegradation?: number;
  metaScalePenalty?: number;
}

export interface SimulatorHorizonSnapshot {
  isPossible: boolean;
  blockReason: string | null;
  currentPaidAccessBase: number;
  operationalForwardBase: number;
  currentMrr: number;
  targetMonth: number;
  projectedMRR: number;
  projectedBase: number;
  projectedMeta: number;
  projectedGoogle: number;
  projectedLTV: number;
  projectedPayback: number;
  projectedExtrapolation: number;
  m1Google: number;
  m1Ltv: number;
  m1Payback: number;
  metaBudgetAt12: number;
  baseAt12: number;
  monthlyChurn: number;
  cacMeta: number;
  histMetaMonthlySpend: number;
  contactsPerPaidPsiMonth: number;
  arpu: number;
  gatewayRate: number;
}

/**
 * Unwraps backend metric envelopes ({ value, type }) or raw values safely,
 * returning null for missing/invalid/N/A markers instead of coercing to 0.
 */
export function parseOptionalMetric(raw: any): number | null {
  const unwrapped = typeof raw === 'object' && raw !== null && raw.value !== undefined ? raw.value : raw;
  if (
    unwrapped === null ||
    unwrapped === undefined ||
    unwrapped === '' ||
    unwrapped === 'N/A' ||
    unwrapped === 'MISSING_INPUT' ||
    unwrapped === 'INVALID_INPUT'
  ) {
    return null;
  }
  const num = Number(unwrapped);
  return Number.isFinite(num) ? num : null;
}

function getSimValue(obj: any): number | null {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.type === 'MISSING_INPUT') return null;
  const v = Number(obj.value);
  if (obj.value === undefined || obj.value === null || !Number.isFinite(v)) return null;
  return v;
}

/**
 * Exact TypeScript port of runGrowthSimulationMath from admin/admin_cmo_metrics.js (Motor V6.1).
 */
export function runGrowthSimulationMath(p: SimMathParams): SimMathResult {
  function calculatePaidAcquisition(
    availableGrowthFund: number,
    organicTrialCost: number,
    currentCacMeta: number,
    trialGoogleCostPerPaid: number,
    effectiveHistSpend: number,
    metaScalePenalty: number,
    trialConversionRate: number
  ) {
    const cashAvailableForPaidAcquisition = Math.max(0, availableGrowthFund - organicTrialCost);

    let newPaidActive = 0;
    let actualMetaSpend = 0;
    let paidTrialGoogleSpend = 0;
    let metaCACPenalized = currentCacMeta;
    let blendedAcquisitionCost = currentCacMeta + trialGoogleCostPerPaid;
    let metaExtrapolationMultiple = 0;
    let scaleFactor = 1;
    let isConverged = true;

    if (currentCacMeta > 0 && effectiveHistSpend > 0 && trialConversionRate > 0) {
      let iteratedMetaCAC = currentCacMeta;

      for (let i = 1; i <= 50; i++) {
        const iteratedBlendedCAC = iteratedMetaCAC + trialGoogleCostPerPaid;
        const candidatePaidByCash = cashAvailableForPaidAcquisition / iteratedBlendedCAC;
        const candidateMetaSpend = candidatePaidByCash * iteratedMetaCAC;

        scaleFactor = Math.max(1, candidateMetaSpend / effectiveHistSpend);
        const newMetaCAC = currentCacMeta * (1 + Math.max(0, scaleFactor - 1) * metaScalePenalty);

        if (Math.abs(newMetaCAC - iteratedMetaCAC) < 0.01) {
          iteratedMetaCAC = newMetaCAC;
          break;
        }
        iteratedMetaCAC = newMetaCAC;

        if (i === 50) {
          isConverged = false;
          iteratedMetaCAC = NaN;
        }
      }

      if (Number.isNaN(iteratedMetaCAC)) {
        newPaidActive = 0;
        actualMetaSpend = 0;
        paidTrialGoogleSpend = 0;
      } else {
        metaCACPenalized = iteratedMetaCAC;
        blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

        const maxPaidByCash = cashAvailableForPaidAcquisition / blendedAcquisitionCost;
        newPaidActive = maxPaidByCash;
        actualMetaSpend = newPaidActive * metaCACPenalized;
        paidTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;

        if (effectiveHistSpend > 0) {
          metaExtrapolationMultiple = actualMetaSpend / effectiveHistSpend;
        }
      }
    }

    return {
      newPaidActive,
      metaCACPenalized,
      blendedAcquisitionCost,
      actualMetaSpend,
      paidTrialGoogleSpend,
      scaleFactor,
      metaExtrapolationMultiple,
      isConverged,
    };
  }

  const labels: string[] = [];
  const dataExpectedBase: number[] = [];
  const dataRevenue: number[] = [];
  const dataMetaBudget: (number | null)[] = [];
  const dataGoogleBudget: (number | null)[] = [];
  const dataLTV: (number | null)[] = [];
  const dataPayback: (number | null)[] = [];
  const dataMetaExtrapolationMultiple: (number | null)[] = [];

  let currentBase = p.currentBase;
  const retroMonths = p.retroMonths || 0;
  const totalPoints = retroMonths + 1 + p.targetMonths;

  labels.push(retroMonths > 0 ? `-${retroMonths}M` : 'Hoje');
  dataExpectedBase.push(Math.round(p.realCurrentBase ?? currentBase));
  dataRevenue.push(p.mechanicallyRenewableBase * p.arpu || currentBase * p.arpu);
  dataMetaBudget.push(null);
  dataGoogleBudget.push(null);
  dataLTV.push(null);
  dataPayback.push(null);
  dataMetaExtrapolationMultiple.push(null);

  let rolloverCash = p.rolloverCash;
  let actionMetaSpend = 0;
  let actionGoogleMaintenance = 0;
  let actionTrialGoogleSpend = 0;
  let actionUnspentCash = 0;
  let actionCACPenalized = 0;
  let mrrAt12 = 0;
  let baseAt12 = 0;
  let metaBudgetAt12 = 0;
  let googleBudgetAt12 = 0;

  for (let step = 1; step < totalPoints; step++) {
    const isHoje = retroMonths > 0 && step === retroMonths;
    const isM1 = step === retroMonths + 1;

    const baseStart = currentBase;
    let revenueBase = baseStart;
    if (isM1) {
      revenueBase = p.mechanicallyRenewableBase ?? baseStart;
    }
    const startingMrr = revenueBase * p.arpu;

    const degradationStep = Math.max(0, step - (retroMonths + 1));
    const currentCplGoogle = p.cplGoogle * Math.pow(1 + (p.cplDegradation || 0), degradationStep);
    const currentCacMeta = p.cacMeta * Math.pow(1 + (p.cacDegradation || 0), degradationStep);

    const projectedDemandEligibleBase = isM1
      ? (p.demandEligiblePaidBase ?? baseStart)
      : baseStart * (p.futureDemandEligibilityRate || p.demandEligibilityRate || 0);

    const totalContactDemand = projectedDemandEligibleBase * p.contactsPerPaidPsiMonth;
    const requiredGoogleContacts = Math.max(0, totalContactDemand - p.verifiedOrganicContacts);
    const googleMaintenanceCost = requiredGoogleContacts * currentCplGoogle;

    const taxes = startingMrr * p.taxRate;
    const gatewayFees = startingMrr * p.gatewayRate;
    const varOPEX = startingMrr * p.varCostRate;

    const operatingCashAvailable = Math.max(
      0,
      startingMrr - taxes - gatewayFees - varOPEX - p.fixedOPEX - googleMaintenanceCost
    );
    const contributionMarginPerPsi =
      (startingMrr - taxes - gatewayFees - varOPEX - googleMaintenanceCost) / (baseStart || 1);

    const currentMonthGrowthAllocation = operatingCashAvailable * (p.reinvestRate / 100);
    const retainedOperatingCash = operatingCashAvailable - currentMonthGrowthAllocation;
    const growthFund = currentMonthGrowthAllocation + p.extraCash + rolloverCash;
    const effectiveHistSpend = p.histMetaMonthlySpendAvg || 0;

    // Motor V6.1: Google Ads pago e 100% exclusivo para assinantes pagantes ativos.
    const trialGoogleCostPerPaid = 0;
    const projectedOrganicPaidAdditions = p.newOrganicActive || 0;
    const organicTrialCost = 0;

    const organicCostCoveredByGrowth = Math.min(growthFund, organicTrialCost);
    const organicCostDeficit = Math.max(0, organicTrialCost - growthFund);
    const organicCostCoveredByRetained = Math.min(Math.max(0, retainedOperatingCash), organicCostDeficit);
    const retainedOperatingCashAfterMandatoryOrganic = retainedOperatingCash - organicCostCoveredByRetained;

    const fundedOrganicCost = organicCostCoveredByGrowth + organicCostCoveredByRetained;
    const organicFundingRatio =
      organicTrialCost > 0 ? Math.min(1, Math.max(0, fundedOrganicCost / organicTrialCost)) : 1;
    const fundedOrganicPaidAdditions = projectedOrganicPaidAdditions * organicFundingRatio;

    const genericChurnBase = isM1 ? (p.mechanicallyRenewableBase ?? baseStart) : baseStart;
    const expectedGenericChurn = genericChurnBase * p.monthlyChurn;
    const manualLegacyRunoff = isM1 ? (p.manualLegacyBase || 0) : 0;

    const grossReplacementNeed = expectedGenericChurn + manualLegacyRunoff;
    const replacementGap = Math.max(0, grossReplacementNeed - fundedOrganicPaidAdditions);

    const initialAcq = calculatePaidAcquisition(
      growthFund,
      organicTrialCost,
      currentCacMeta,
      trialGoogleCostPerPaid,
      effectiveHistSpend,
      p.metaScalePenalty,
      p.trialConversionRate
    );

    const paidReplacementShortfall = Math.max(0, replacementGap - initialAcq.newPaidActive);

    let additionalStabilityFundingRequired: number | null = 0;
    let finalAcq = initialAcq;

    if (paidReplacementShortfall > 0) {
      let upperBound = Math.max(1, growthFund, retainedOperatingCashAfterMandatoryOrganic);
      let lowerBound = 0;
      let expansionConverged = false;

      for (let iter = 0; iter < 50; iter++) {
        const testAcq = calculatePaidAcquisition(
          growthFund + upperBound,
          organicTrialCost,
          currentCacMeta,
          trialGoogleCostPerPaid,
          effectiveHistSpend,
          p.metaScalePenalty,
          p.trialConversionRate
        );

        if (!testAcq.isConverged || !Number.isFinite(testAcq.actualMetaSpend) || !Number.isFinite(testAcq.metaCACPenalized)) {
          break;
        }
        if (testAcq.newPaidActive >= replacementGap) {
          expansionConverged = true;
          break;
        }
        lowerBound = upperBound;
        upperBound *= 2;
      }

      if (!expansionConverged) {
        additionalStabilityFundingRequired = null;
      } else {
        let low = lowerBound;
        let high = upperBound;
        let best: number | null = null;

        for (let iter = 0; iter < 100; iter++) {
          const mid = (low + high) / 2;
          const testAcq = calculatePaidAcquisition(
            growthFund + mid,
            organicTrialCost,
            currentCacMeta,
            trialGoogleCostPerPaid,
            effectiveHistSpend,
            p.metaScalePenalty,
            p.trialConversionRate
          );
          if (!testAcq.isConverged) break;

          if (testAcq.newPaidActive >= replacementGap) {
            best = mid;
            high = mid;
          } else {
            low = mid;
          }
          if (high - low < 0.01) break;
        }
        additionalStabilityFundingRequired = best;
      }
    }

    let stabilityFundingUsed = 0;
    if (!(additionalStabilityFundingRequired === null && paidReplacementShortfall > 0)) {
      stabilityFundingUsed = Math.min(
        additionalStabilityFundingRequired || 0,
        Math.max(0, retainedOperatingCashAfterMandatoryOrganic)
      );
      if ((additionalStabilityFundingRequired || 0) > 0) {
        finalAcq = calculatePaidAcquisition(
          growthFund + stabilityFundingUsed,
          organicTrialCost,
          currentCacMeta,
          trialGoogleCostPerPaid,
          effectiveHistSpend,
          p.metaScalePenalty,
          p.trialConversionRate
        );
      }
    }

    const newPaidActive = finalAcq.newPaidActive;
    const actualMetaSpend = finalAcq.actualMetaSpend;
    const paidTrialGoogleSpend = finalAcq.paidTrialGoogleSpend;
    const metaCACPenalized = finalAcq.metaCACPenalized;
    const blendedAcquisitionCost = finalAcq.blendedAcquisitionCost;
    const metaExtrapolationMultiple = finalAcq.metaExtrapolationMultiple;

    const actualGrowthSpendFromGrowthFund = actualMetaSpend + paidTrialGoogleSpend + organicCostCoveredByGrowth;
    const finalGrowthFund = growthFund + stabilityFundingUsed;
    rolloverCash = Math.max(0, finalGrowthFund - actualGrowthSpendFromGrowthFund);

    const actualTrialGoogleSpend = paidTrialGoogleSpend + organicTrialCost;
    currentBase = baseStart + newPaidActive + fundedOrganicPaidAdditions - grossReplacementNeed;
    const endOfMonthMRR = currentBase * p.arpu;
    const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;

    let labelStr = '';
    if (retroMonths > 0) {
      if (step < retroMonths) labelStr = `-${retroMonths - step}M`;
      else if (step === retroMonths) labelStr = 'Hoje';
      else labelStr = `Mês ${step - retroMonths}`;
    } else {
      labelStr = `Mês ${step}`;
    }
    labels.push(labelStr);

    dataExpectedBase.push(Math.round(currentBase));
    dataRevenue.push(endOfMonthMRR);
    dataMetaBudget.push(actualMetaSpend);
    dataGoogleBudget.push(totalGoogleBudget);
    dataMetaExtrapolationMultiple.push(metaExtrapolationMultiple);

    const LTV = contributionMarginPerPsi > 0 ? contributionMarginPerPsi * (1 / p.monthlyChurn) : 0;
    const payback = contributionMarginPerPsi > 0 ? blendedAcquisitionCost / contributionMarginPerPsi : 0;
    dataLTV.push(LTV);
    dataPayback.push(payback);

    if (isM1) {
      actionMetaSpend = actualMetaSpend;
      actionGoogleMaintenance = googleMaintenanceCost;
      actionTrialGoogleSpend = actualTrialGoogleSpend;
      actionUnspentCash = rolloverCash;
      actionCACPenalized = metaCACPenalized;
    }
    if (step === totalPoints - 1) {
      mrrAt12 = endOfMonthMRR;
      baseAt12 = currentBase;
      metaBudgetAt12 = actualMetaSpend;
      googleBudgetAt12 = totalGoogleBudget;
    }

    if (isHoje && p.operationalForwardBase != null) {
      currentBase = p.operationalForwardBase;
    }
  }

  return {
    labels,
    dataExpectedBase,
    dataRevenue,
    dataMetaBudget,
    dataGoogleBudget,
    dataLTV,
    dataPayback,
    dataMetaExtrapolationMultiple,
    mrrAt12,
    baseAt12,
    metaBudgetAt12,
    googleBudgetAt12,
    actionMetaSpend,
    actionGoogleMaintenance,
    actionTrialGoogleSpend,
    actionUnspentCash,
    actionCACPenalized,
  };
}

/**
 * Mirrors Web simulator parameter extraction, blocking rules, and horizon selection.
 */
export function computeCmoSimulatorSnapshot(
  dashboardData: any,
  settings: SimulatorSettingsInput,
  selectedHorizon: number
): SimulatorHorizonSnapshot | null {
  if (!dashboardData) return null;

  const sim = dashboardData.simulator || {};
  const b2b = dashboardData.platform?.b2b || {};
  const historical = dashboardData.historical || {};

  const currentPaidAccessBase = Number(sim.currentPaidAccessBase ?? b2b.total_active ?? 0);
  const operationalForwardBase = Number(
    sim.operationalForwardBase ?? Math.max(0, currentPaidAccessBase - Number(sim.knownScheduledChurn || 0))
  );
  const mechanicallyRenewableBase = Number(sim.mechanicallyRenewableBase?.value ?? operationalForwardBase);
  const manualLegacyBase = Number(sim.manualLegacyBase?.value ?? 0);
  const demandEligiblePaidBase = Number(sim.demandEligiblePaidBase ?? 0);
  const futureDemandEligibilityRate = Number(sim.futureDemandEligibilityRate?.value ?? 0);
  const knownScheduledChurn = Number(sim.knownScheduledChurn ?? 0);
  const arpu = Number(b2b.arpu || 99);

  const trialConversionRate = getSimValue(sim.trialConv);
  const effectiveCacMeta = getSimValue(sim.cac);
  const cplGoogle = getSimValue(sim.cpl) ?? 5.0;
  const monthlyChurn = getSimValue(sim.churn);
  const effectiveHistMetaSpend = getSimValue(historical.meta?.monthly_spend_avg);
  const contactsPerPaidPsiMonth = sim.contactsPerPaidPsiMonth?.value ?? null;

  const rawGateway = dashboardData.platform?.pnl?.managerial?.projectedGatewayRate?.value;
  const gatewayRate =
    typeof rawGateway === 'number' && Number.isFinite(rawGateway) ? rawGateway : 0.0265;

  const fixedOPEX = settings.fixedOPEX ?? 0;
  const taxRate = settings.taxRate ?? 0;
  const varCostRate = settings.varCostRate ?? 0;
  const cacDegradation = settings.cacDegradation ?? 0.02;
  const cplDegradation = settings.cplDegradation ?? 0.02;
  const metaScalePenalty = settings.metaScalePenalty ?? 0.20;

  let demandEligibilityRate = sim.demandEligibilityRate;
  if (demandEligibilityRate === 'MISSING_INPUT' || demandEligibilityRate === undefined || demandEligibilityRate === null) {
    demandEligibilityRate = 0;
  }

  let simBlockReason: string | null = null;
  if (monthlyChurn !== null && (monthlyChurn < 0 || monthlyChurn >= 1)) {
    simBlockReason = 'INVALID_INPUT';
  } else if (contactsPerPaidPsiMonth !== null && (contactsPerPaidPsiMonth <= 0 || !Number.isFinite(contactsPerPaidPsiMonth))) {
    simBlockReason = 'INVALID_INPUT';
  } else if (
    effectiveCacMeta === null ||
    trialConversionRate === null ||
    monthlyChurn === null ||
    cplGoogle === null ||
    effectiveHistMetaSpend === null ||
    sim.demandEligibilityRate === 'MISSING_INPUT' ||
    contactsPerPaidPsiMonth === null
  ) {
    simBlockReason = 'MISSING_API';
  } else if (effectiveCacMeta === 0 || effectiveHistMetaSpend === 0) {
    simBlockReason = 'INSUFFICIENT_BASELINE';
  }

  const currentMrr = operationalForwardBase * arpu;

  if (simBlockReason !== null) {
    return {
      isPossible: false,
      blockReason: simBlockReason,
      currentPaidAccessBase,
      operationalForwardBase,
      currentMrr,
      targetMonth: selectedHorizon,
      projectedMRR: 0,
      projectedBase: 0,
      projectedMeta: 0,
      projectedGoogle: 0,
      projectedLTV: 0,
      projectedPayback: 0,
      projectedExtrapolation: 0,
      m1Google: 0,
      m1Ltv: 0,
      m1Payback: 0,
      metaBudgetAt12: 0,
      baseAt12: 0,
      monthlyChurn: monthlyChurn ?? 0,
      cacMeta: effectiveCacMeta ?? 0,
      histMetaMonthlySpend: effectiveHistMetaSpend ?? 0,
      contactsPerPaidPsiMonth: contactsPerPaidPsiMonth ?? 3,
      arpu,
      gatewayRate,
    };
  }

  const verifiedOrganicContacts = settings.includeOrganic && sim.organicContacts?.value ? Number(sim.organicContacts.value) : 0;
  const newOrganicActive = settings.includeOrganic && sim.organicActive?.value ? Number(sim.organicActive.value) : 0;
  const pastHistory: number[] = Array.isArray(historical.platform?.b2b?.past_base_history)
    ? historical.platform.b2b.past_base_history
    : [];
  const retroMonths = pastHistory.length;
  const startingRetroBase = retroMonths > 0 ? Number(pastHistory[0]) : operationalForwardBase;

  const simResult = runGrowthSimulationMath({
    targetMonths: 12,
    currentBase: startingRetroBase,
    arpu,
    demandEligibilityRate: Number(demandEligibilityRate),
    futureDemandEligibilityRate,
    demandEligiblePaidBase,
    contactsPerPaidPsiMonth: Number(contactsPerPaidPsiMonth),
    verifiedOrganicContacts,
    cplGoogle,
    reinvestRate: settings.reinvestRate,
    extraCash: settings.extraCash,
    rolloverCash: 0,
    histMetaMonthlySpendAvg: Number(effectiveHistMetaSpend),
    cacMeta: Number(effectiveCacMeta),
    trialConversionRate: Number(trialConversionRate),
    monthlyChurn: Number(monthlyChurn),
    newOrganicActive,
    mechanicallyRenewableBase,
    manualLegacyBase,
    knownScheduledChurn,
    retroMonths,
    realCurrentBase: currentPaidAccessBase,
    operationalForwardBase,
    cacDegradation,
    cplDegradation,
    fixedOPEX,
    taxRate,
    gatewayRate,
    varCostRate,
    metaScalePenalty,
  });

  const clampedMonth = Math.min(Math.max(1, selectedHorizon), 12);
  const m1Index = retroMonths + 1;
  const index = retroMonths + clampedMonth;

  return {
    isPossible: true,
    blockReason: null,
    currentPaidAccessBase,
    operationalForwardBase,
    currentMrr,
    targetMonth: clampedMonth,
    projectedMRR: simResult.dataRevenue[index] ?? 0,
    projectedBase: simResult.dataExpectedBase[index] ?? 0,
    projectedMeta: simResult.dataMetaBudget[index] ?? 0,
    projectedGoogle: simResult.dataGoogleBudget[index] ?? 0,
    projectedLTV: simResult.dataLTV[index] ?? 0,
    projectedPayback: simResult.dataPayback[index] ?? 0,
    projectedExtrapolation: simResult.dataMetaExtrapolationMultiple[index] ?? 0,
    m1Google: simResult.dataGoogleBudget[m1Index] ?? 0,
    m1Ltv: simResult.dataLTV[m1Index] ?? 0,
    m1Payback: simResult.dataPayback[m1Index] ?? 0,
    metaBudgetAt12: simResult.metaBudgetAt12,
    baseAt12: simResult.baseAt12,
    monthlyChurn: Number(monthlyChurn),
    cacMeta: Number(effectiveCacMeta),
    histMetaMonthlySpend: Number(effectiveHistMetaSpend),
    contactsPerPaidPsiMonth: Number(contactsPerPaidPsiMonth),
    arpu,
    gatewayRate,
  };
}
