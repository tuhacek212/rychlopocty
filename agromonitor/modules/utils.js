// Shared utility helpers

function hashStringToSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getUtcDayStart(ts) {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function aggregateTempSeriesByDay(series) {
    const byDay = {};
    series.forEach(point => {
        const dayTs = getUtcDayStart(point.t);
        if (!byDay[dayTs]) {
            byDay[dayTs] = { sumAvg: 0, count: 0, min: null, max: null };
        }
        const bucket = byDay[dayTs];
        bucket.sumAvg += point.avg;
        bucket.count += 1;
        bucket.min = bucket.min === null ? point.min : Math.min(bucket.min, point.min);
        bucket.max = bucket.max === null ? point.max : Math.max(bucket.max, point.max);
    });

    return Object.keys(byDay).map(tsStr => {
        const t = parseInt(tsStr, 10);
        const bucket = byDay[tsStr];
        return {
            t,
            avg: bucket.sumAvg / Math.max(1, bucket.count),
            min: bucket.min,
            max: bucket.max,
        };
    }).sort((a, b) => a.t - b.t);
}

function aggregateValueSeriesByDay(series) {
    const byDay = {};
    series.forEach(point => {
        const dayTs = getUtcDayStart(point.t);
        if (!byDay[dayTs]) {
            byDay[dayTs] = { sum: 0, count: 0 };
        }
        byDay[dayTs].sum += point.value;
        byDay[dayTs].count += 1;
    });

    return Object.keys(byDay).map(tsStr => {
        const bucket = byDay[tsStr];
        return {
            t: parseInt(tsStr, 10),
            value: bucket.sum / Math.max(1, bucket.count),
        };
    }).sort((a, b) => a.t - b.t);
}

function filterSeriesForPeriod(series, period) {
    if (!series.length) return [];
    const now = series[series.length - 1].t;
    const days = period === '1y' ? 365 : 30;
    const cutoff = now - days * MS_PER_DAY;
    return series.filter(point => point.t >= cutoff);
}

function pickRandomThermometerKeys(rows, count) {
    const keys = Array.from(new Set(
        rows
            .map(r => `${r.location_id}:${r.silo_id}:${r.thermometer_id}`)
            .filter(k => !k.endsWith(':') && !k.includes('undefined'))
            .filter(k => {
                const parts = k.split(':');
                const siloKey = `${parts[0]}:${parts[1]}`;
                return !BAD_COOLING_SILOS.has(siloKey);
            })
    ));
    if (keys.length <= count) return keys;
    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys.slice(0, count);
}

function buildMonthAxis(tMin, tMax, scaleX, padding, height, width) {
    const monthLabels = ['led', 'uno', 'bre', 'dub', 'kve', 'cvn', 'cvc', 'srp', 'zar', 'rij', 'lis', 'pro'];
    const start = new Date(tMin);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    if (start.getTime() > tMin) {
        start.setMonth(start.getMonth() - 1);
    }

    let xAxis = '';
    for (let cur = new Date(start); cur.getTime() <= tMax; cur.setMonth(cur.getMonth() + 1)) {
        const curTime = cur.getTime();
        const x = scaleX(curTime);
        if (x >= padding && x <= width - padding) {
            xAxis += `<line class="chart-month" x1="${x}" x2="${x}" y1="${padding}" y2="${height - padding}" />`;
        }

        const next = new Date(cur);
        next.setMonth(next.getMonth() + 1);
        const mid = (scaleX(curTime) + scaleX(next.getTime())) / 2;
        if (mid >= padding && mid <= width - padding) {
            const label = monthLabels[cur.getMonth()];
            xAxis += `<text class="chart-month-label" x="${mid}" y="${height - 4}" text-anchor="middle">${label}</text>`;
        }
    }

    return xAxis;
}

function getTimeRange(series, periodDays) {
    if (!series || !series.length) return { tMin: 0, tMax: 0 };
    const tMax = series[series.length - 1].t;
    if (periodDays && Number.isFinite(periodDays)) {
        const msPerDay = 24 * 60 * 60 * 1000;
        return { tMin: tMax - periodDays * msPerDay, tMax };
    }
    return { tMin: series[0].t, tMax };
}

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(',');
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (cols[idx] || '').trim();
        });
        rows.push(row);
    }

    return rows;
}

function parseBooleanFlag(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    const raw = String(value ?? '').trim().toLowerCase();
    if (['1', 'true', 'ano', 'yes'].includes(raw)) return true;
    if (['0', 'false', 'ne', 'no'].includes(raw)) return false;
    return !!fallback;
}

function toSafeInt(value, fallback = 0, min = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.round(n));
}

function toSafeNumber(value, fallback = 0, min = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, n);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function appendDownloadParam(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url, window.location.href);
        parsed.searchParams.set('download', '1');
        return parsed.toString();
    } catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}download=1`;
    }
}


