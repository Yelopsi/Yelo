'use strict';

// Fuso de Brasília fixo (UTC-3, sem horário de verão desde 2019) para preservar hora exata da agenda
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toBrtParts(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const shifted = new Date(d.getTime() + BRT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

function fromBrtParts(year, month, day, hours = 0, minutes = 0, seconds = 0, ms = 0) {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms) - BRT_OFFSET_MS);
}

function toBrtISODate(dateInput) {
  const { year, month, day } = toBrtParts(dateInput);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function startOfDayBrt(isoDateStr) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  return fromBrtParts(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function endOfDayBeforeBrt(isoDateStr) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  return fromBrtParts(y, (m || 1) - 1, (d || 1) - 1, 23, 59, 59, 999);
}

function daysInMonthUTC(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function parseExceptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serializeExceptions(list) {
  return JSON.stringify(Array.from(new Set((list || []).filter(Boolean).map(String))));
}

function isRecurringRule(row) {
  const rec = row && row.recurrence;
  return rec === 'weekly' || rec === 'biweekly' || rec === 'monthly';
}

function parseAppointmentTargetId(rawId) {
  const str = String(rawId || '');
  if (str.includes('__')) {
    const [masterPart, datePart] = str.split('__');
    return {
      id: Number(masterPart),
      occurrenceDate: datePart || null,
      isVirtualId: true,
    };
  }
  return {
    id: Number(str),
    occurrenceDate: null,
    isVirtualId: false,
  };
}

function buildSingleOccurrenceForDate(masterPlain, isoDateStr) {
  const baseParts = toBrtParts(masterPlain.start);
  const startMs = new Date(masterPlain.start).getTime();
  const endMs = masterPlain.end ? new Date(masterPlain.end).getTime() : startMs + 50 * 60 * 1000;
  const durationMs = Math.max(5 * 60 * 1000, endMs - startMs);

  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  const occStart = fromBrtParts(y, (m || 1) - 1, d || 1, baseParts.hours, baseParts.minutes, 0, 0);
  const occEnd = new Date(occStart.getTime() + durationMs);

  return { occStart, occEnd };
}

/**
 * Expande agendamentos (incluindo regras recorrentes infinitas) dentro do intervalo `[rangeStart, rangeEnd]`.
 */
function expandAppointmentsInRange(rows, rangeStart, rangeEnd) {
  const fromTime = rangeStart instanceof Date ? rangeStart.getTime() : new Date(rangeStart).getTime();
  const toTime = rangeEnd instanceof Date ? rangeEnd.getTime() : new Date(rangeEnd).getTime();
  const result = [];

  for (const rawRow of rows) {
    const row = typeof rawRow.toJSON === 'function' ? rawRow.toJSON() : { ...rawRow };
    if (!row.start) continue;

    if (!isRecurringRule(row)) {
      const t = new Date(row.start).getTime();
      if (t >= fromTime && t <= toTime) {
        result.push(row);
      }
      continue;
    }

    const exceptions = new Set(parseExceptions(row.recurrenceExceptions));
    const untilTime = row.recurrenceUntil ? new Date(row.recurrenceUntil).getTime() : Infinity;
    const effectiveEnd = Math.min(toTime, untilTime);

    const startDateObj = new Date(row.start);
    const startMs = startDateObj.getTime();
    if (startMs > effectiveEnd) continue;

    const endMs = row.end ? new Date(row.end).getTime() : startMs + 50 * 60 * 1000;
    const durationMs = Math.max(5 * 60 * 1000, endMs - startMs);
    const base = toBrtParts(startDateObj);
    const baseDayUTC = Date.UTC(base.year, base.month, base.day);
    const baseStatus = row.status === 'available' ? 'available' : 'scheduled';

    if (row.recurrence === 'weekly' || row.recurrence === 'biweekly') {
      const stepDays = row.recurrence === 'weekly' ? 7 : 14;
      const fromParts = toBrtParts(new Date(Math.max(fromTime, startMs)));
      const fromDayUTC = Date.UTC(fromParts.year, fromParts.month, fromParts.day);
      const diffDays = Math.floor((fromDayUTC - baseDayUTC) / DAY_MS);
      let k = diffDays > 0 ? Math.floor(diffDays / stepDays) : 0;

      while (true) {
        const occStart = fromBrtParts(
          base.year,
          base.month,
          base.day + k * stepDays,
          base.hours,
          base.minutes,
          0,
          0
        );
        const occTime = occStart.getTime();
        if (occTime > effectiveEnd) break;

        if (occTime >= fromTime) {
          const occISO = toBrtISODate(occStart);
          if (!exceptions.has(occISO)) {
            const occEnd = new Date(occTime + durationMs);
            result.push({
              ...row,
              id: `${row.id}__${occISO}`,
              masterId: row.id,
              occurrenceDate: occISO,
              isRecurring: true,
              status: baseStatus,
              start: occStart.toISOString(),
              end: occEnd.toISOString(),
            });
          }
        }
        k++;
      }
    } else if (row.recurrence === 'monthly') {
      const fromParts = toBrtParts(new Date(Math.max(fromTime, startMs)));
      const monthsDiff = (fromParts.year - base.year) * 12 + (fromParts.month - base.month);
      let k = Math.max(0, monthsDiff - 1);

      while (true) {
        const totalMonths = base.month + k;
        const targetYear = base.year + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const clampedDay = Math.min(base.day, daysInMonthUTC(targetYear, targetMonth));

        const occStart = fromBrtParts(
          targetYear,
          targetMonth,
          clampedDay,
          base.hours,
          base.minutes,
          0,
          0
        );
        const occTime = occStart.getTime();
        if (occTime > effectiveEnd) break;

        if (occTime >= startMs && occTime >= fromTime) {
          const occISO = toBrtISODate(occStart);
          if (!exceptions.has(occISO)) {
            const occEnd = new Date(occTime + durationMs);
            result.push({
              ...row,
              id: `${row.id}__${occISO}`,
              masterId: row.id,
              occurrenceDate: occISO,
              isRecurring: true,
              status: baseStatus,
              start: occStart.toISOString(),
              end: occEnd.toISOString(),
            });
          }
        }
        k++;
      }
    }
  }

  return result;
}

module.exports = {
  toBrtISODate,
  startOfDayBrt,
  endOfDayBeforeBrt,
  parseExceptions,
  serializeExceptions,
  isRecurringRule,
  parseAppointmentTargetId,
  buildSingleOccurrenceForDate,
  expandAppointmentsInRange,
};
