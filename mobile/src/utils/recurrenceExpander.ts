export type RecurrenceFrequency = 'none' | 'weekly' | 'biweekly' | 'monthly';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseExceptions(raw: unknown): Set<string> {
  if (!raw) return new Set();
  if (Array.isArray(raw)) return new Set(raw.map(String));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
    } catch {
      return new Set();
    }
  }
  return new Set();
}

export function isRecurringRuleRow(row: any): boolean {
  const rec = row?.recurrence;
  return rec === 'weekly' || rec === 'biweekly' || rec === 'monthly';
}

/**
 * Expande em O(1) as regras de recorrência infinita dentro do intervalo `[rangeStart, rangeEnd]`.
 * Cada ocorrência gerada recebe um ID composto `<masterId>__<YYYY-MM-DD>` aceito nativamente pela API.
 */
export function expandAppointmentsInLocalRange(
  rows: any[],
  rangeStart: Date,
  rangeEnd: Date
): any[] {
  const fromTime = rangeStart.getTime();
  const toTime = rangeEnd.getTime();
  const result: any[] = [];

  for (const row of rows) {
    if (!row || !row.start) continue;

    if (!isRecurringRuleRow(row)) {
      const t = new Date(row.start).getTime();
      if (!isNaN(t) && t >= fromTime && t <= toTime) {
        result.push(row);
      }
      continue;
    }

    const startDt = new Date(row.start);
    const startMs = startDt.getTime();
    if (isNaN(startMs)) continue;

    const untilTime = row.recurrenceUntil ? new Date(row.recurrenceUntil).getTime() : Infinity;
    const effectiveEnd = Math.min(toTime, untilTime);
    if (startMs > effectiveEnd) continue;

    const endMs = row.end ? new Date(row.end).getTime() : startMs + 50 * 60 * 1000;
    const durationMs = Math.max(5 * 60 * 1000, endMs - startMs);
    const exceptions = parseExceptions(row.recurrenceExceptions);

    const baseYear = startDt.getFullYear();
    const baseMonth = startDt.getMonth();
    const baseDay = startDt.getDate();
    const baseHours = startDt.getHours();
    const baseMinutes = startDt.getMinutes();
    const baseStatus = row.status === 'available' ? 'available' : 'scheduled';

    if (row.recurrence === 'weekly' || row.recurrence === 'biweekly') {
      const stepDays = row.recurrence === 'weekly' ? 7 : 14;
      const anchorMidnight = new Date(baseYear, baseMonth, baseDay, 0, 0, 0, 0).getTime();
      const windowStartRef = new Date(Math.max(fromTime, startMs));
      const windowMidnight = new Date(
        windowStartRef.getFullYear(),
        windowStartRef.getMonth(),
        windowStartRef.getDate(),
        0,
        0,
        0,
        0
      ).getTime();

      const diffDays = Math.round((windowMidnight - anchorMidnight) / DAY_MS);
      let k = diffDays > 0 ? Math.floor(diffDays / stepDays) : 0;

      while (true) {
        const occStart = new Date(
          baseYear,
          baseMonth,
          baseDay + k * stepDays,
          baseHours,
          baseMinutes,
          0,
          0
        );
        const occTime = occStart.getTime();
        if (occTime > effectiveEnd) break;

        if (occTime >= fromTime) {
          const occISO = toLocalISODate(occStart);
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
      const windowStartRef = new Date(Math.max(fromTime, startMs));
      const monthsDiff =
        (windowStartRef.getFullYear() - baseYear) * 12 +
        (windowStartRef.getMonth() - baseMonth);
      let k = Math.max(0, monthsDiff - 1);

      while (true) {
        const totalMonths = baseMonth + k;
        const targetYear = baseYear + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const clampedDay = Math.min(baseDay, daysInMonth(targetYear, targetMonth));

        const occStart = new Date(
          targetYear,
          targetMonth,
          clampedDay,
          baseHours,
          baseMinutes,
          0,
          0
        );
        const occTime = occStart.getTime();
        if (occTime > effectiveEnd) break;

        if (occTime >= startMs && occTime >= fromTime) {
          const occISO = toLocalISODate(occStart);
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

export function expandAppointmentsForLocalDay(rows: any[], day: Date): any[] {
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return expandAppointmentsInLocalRange(rows, startOfDay, endOfDay);
}
