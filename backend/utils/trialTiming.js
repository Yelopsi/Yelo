const SAO_PAULO_TZ = 'America/Sao_Paulo';

function getSaoPauloDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SAO_PAULO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = Number(part.value);
        }
    }
    return map;
}

function formatDateSaoPaulo(date) {
    return new Date(date).toLocaleDateString('pt-BR', {
        timeZone: SAO_PAULO_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Converte o fim de um dia calendário (23:59:59.999) no fuso America/Sao_Paulo para Date (UTC).
 */
function endOfDaySaoPaulo(year, month, day) {
    const approxUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    const sp = getSaoPauloDateParts(new Date(approxUtc));
    const spHour = sp.hour === 24 ? 0 : sp.hour;
    const spAsUtc = Date.UTC(sp.year, sp.month - 1, sp.day, spHour, sp.minute, sp.second, 999);
    const offsetMs = spAsUtc - approxUtc;
    return new Date(approxUtc - offsetMs);
}

/**
 * Retorna o instante limite (23:59:59.999 de AMANHÃ em America/Sao_Paulo)
 * para disponibilizar mensagens de Trial Expirando exatamente 1 dia antes no horário de SP.
 */
function getEndOfTomorrowSaoPaulo(now = new Date()) {
    const spToday = getSaoPauloDateParts(now);
    const tomorrowUtc = new Date(Date.UTC(spToday.year, spToday.month - 1, spToday.day + 1));
    return endOfDaySaoPaulo(
        tomorrowUtc.getUTCFullYear(),
        tomorrowUtc.getUTCMonth() + 1,
        tomorrowUtc.getUTCDate()
    );
}

/**
 * Determina o texto temporal exato da expiração do Trial segundo o calendário de São Paulo.
 */
function getTrialExpiryTiming(expDateInput, now = new Date()) {
    const expDate = new Date(expDateInput);
    const diffHours = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const spToday = getSaoPauloDateParts(now);
    const tomorrowUtc = new Date(Date.UTC(spToday.year, spToday.month - 1, spToday.day + 1));

    const todayStr = formatDateSaoPaulo(now);
    const tomorrowStr = `${String(tomorrowUtc.getUTCDate()).padStart(2, '0')}/${String(tomorrowUtc.getUTCMonth() + 1).padStart(2, '0')}/${tomorrowUtc.getUTCFullYear()}`;
    const expDateStr = formatDateSaoPaulo(expDate);

    const isToday = expDateStr === todayStr;
    const isTomorrow = expDateStr === tomorrowStr;

    return {
        isToday,
        isTomorrow,
        diffHours,
        todayStr,
        tomorrowStr,
        expDateStr,
        reasonTiming: isToday
            ? 'Trial expira nas próximas horas'
            : isTomorrow
            ? 'Trial expira amanhã'
            : `Trial expira em ${expDateStr}`,
        expiryPhrase: isToday
            ? 'expira nas próximas horas'
            : isTomorrow
            ? 'expirará amanhã'
            : `expirará em ${expDateStr}`,
        promptTimingSituation: isToday
            ? 'expira HOJE, nas próximas horas'
            : isTomorrow
            ? 'expirará AMANHÃ'
            : `expirará em ${expDateStr}`,
        promptTimingInstruction: isToday
            ? '- Como o período expira hoje/em breve, mencione que o período gratuito "expira nas próximas horas" ou "está encerrando nas próximas horas".'
            : isTomorrow
            ? '- Como o período expira amanhã, mencione que o período gratuito "expirará amanhã".'
            : `- Mencione claramente que o período gratuito "expirará em ${expDateStr}".`
    };
}

module.exports = {
    SAO_PAULO_TZ,
    formatDateSaoPaulo,
    getEndOfTomorrowSaoPaulo,
    getTrialExpiryTiming
};

