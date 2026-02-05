// AgroMonitor - Demo version loading from CSV
let currentLocation = '';
let currentEnterprise = '';
let modalPeriod = '30d';
let modalState = { open: false, type: 'temp', siloKey: '', siloName: '' };
let mapState = { open: false, locationId: '' };
const currentUserRole = 'MASTER';
const AUTH_STORAGE_KEY = 'agromonitor_access_v1';
const AUTH_LOCK_KEY = 'agromonitor_lock_v1';
const ACCESS_CODES = {
    '123456': { label: 'Agro Vysocina s.r.o.', locations: ['melkovice', 'stranecka'], defaultLocation: 'melkovice' },
    '234567': { label: 'ZOD Brniste a.s.', locations: ['brniste'], defaultLocation: 'brniste' },
    '345678': { label: 'Admin', locations: ['melkovice', 'stranecka', 'brniste'], defaultLocation: 'melkovice' }
};
const ADMIN_ACCESS_CODE = '345678';
const ADMIN_TEMP_MIN = 5;
const ADMIN_TEMP_MAX = 20;
const BAD_COOLING_MIN_TEMP = 20.5;
const BAD_COOLING_SILOS = new Set([
    'melkovice:2',
    'melkovice:6'
]);

let enterprises = {};
let locations = {};
let historySeries = {};
let fanHistory = {};
let fanSeries = {};
let levelSeries = {};
let lastDataTimestamp = 0;
const USE_SYNTHETIC_HISTORY = true;
let faultyThermometerKeys = [];
let accessState = { code: '', label: '', allowedLocations: null, defaultLocation: null };
let isAuthenticated = false;
let lastLoginAttempt = 0;
let uiInitialized = false;
let loginInitialized = false;
let mapConfigLoaded = false;
const MAP_CONFIG = {
    melkovice: { image: 'Mělkovice.JPG', markers: [] },
    stranecka: { image: 'Stránecká Zhoř.JPG', markers: [] },
    brniste: { image: 'Brniště.JPG', markers: [] }
};
const MAP_CONFIG_URL = 'map-config.json';

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

function buildSyntheticHistoryRows(snapshotRows, options = {}) {
    const days = options.days || 365;
    const msPerDay = 24 * 60 * 60 * 1000;
    const endTs = snapshotRows.reduce((max, row) => {
        const ts = Date.parse(row.timestamp);
        return Number.isFinite(ts) && ts > max ? ts : max;
    }, Date.now());
    const endDate = new Date(endTs);
    const startDate = new Date(endTs - (days - 1) * msPerDay);

    const siloMap = {};
    snapshotRows.forEach(row => {
        const key = `${row.location_id}:${row.silo_id}`;
        if (!siloMap[key]) {
            siloMap[key] = {
                enterprise_id: row.enterprise_id,
                enterprise_name: row.enterprise_name,
                location_id: row.location_id,
                location_name: row.location_name,
                silo_id: row.silo_id,
                silo_name: row.silo_name,
                sensors: [],
                fanIds: new Set(),
                targetLevel: parseFloat(row.level_pct || '0')
            };
        }
        siloMap[key].sensors.push({
            thermometer_id: row.thermometer_id,
            sensor_id: row.sensor_id,
            depth_m: parseFloat(row.depth_m || '0')
        });
        if (row.fan_id) siloMap[key].fanIds.add(row.fan_id);
        const level = parseFloat(row.level_pct || '0');
        if (!Number.isNaN(level)) {
            siloMap[key].targetLevel = level;
        }
    });

    const rows = [];
    const dayTime = new Date(endDate);
    const hh = dayTime.getUTCHours();
    const mm = dayTime.getUTCMinutes();

    Object.keys(siloMap).forEach(key => {
        const silo = siloMap[key];
        const rng = mulberry32(hashStringToSeed(key));
        const sensors = silo.sensors;
        const fanIds = Array.from(silo.fanIds);

        let targetLevel;
        if (rng() < 0.8) {
            targetLevel = 90 + rng() * 10;
        } else {
            targetLevel = 55 + rng() * 30;
        }
        targetLevel = clamp(targetLevel, 20, 100);
        const harvestStart = 190;
        const harvestEnd = 250;
        const fillDuration = 12 + Math.floor(rng() * 18);
        const stagger = Math.floor(rng() * 25);
        const fillStart = clamp(harvestStart + stagger, 150, harvestEnd - fillDuration);
        const fillEnd = fillStart + fillDuration;
        const postHold = 10 + Math.floor(rng() * 40);
        const dischargeStart = fillEnd + postHold;
        const willDischarge = rng() < 0.55;
        const dischargeDuration = 20 + Math.floor(rng() * 60);
        const dischargeEnd = dischargeStart + dischargeDuration;

        let baseTemp = 22 + rng() * 4;

        let levelState = 0;
        let postAction = willDischarge ? 'discharge' : 'hold';
        let dischargePhase = 0;

        for (let d = 0; d < days; d++) {
            const date = new Date(startDate.getTime() + d * msPerDay);
            date.setUTCHours(hh, mm, 0, 0);

            let levelPct = 0;
            if (d < fillStart) {
                levelState = 0;
                levelPct = 0;
            } else if (d < fillEnd) {
                // Step-wise filling with occasional plateaus and small dips
                const stepChance = 0.55;
                const dipChance = 0.08;
                if (rng() < stepChance) {
                    const step = 6 + rng() * 14;
                    levelState = Math.min(targetLevel, levelState + step);
                } else if (rng() < dipChance) {
                    levelState = Math.max(0, levelState - (rng() * 6));
                }
                const jitter = (rng() - 0.5) * 3.5;
                levelPct = levelState + jitter;
            } else if (willDischarge && d >= dischargeStart && d <= dischargeEnd) {
                // Discharge in waves (sometimes pause or partial refill)
                if (dischargePhase === 0) dischargePhase = 1;
                const moveChance = 0.6;
                if (rng() < moveChance) {
                    const step = 3 + rng() * 9;
                    levelState = Math.max(0, levelState - step);
                } else if (rng() < 0.1) {
                    levelState = Math.min(targetLevel, levelState + (rng() * 4));
                }
                const jitter = (rng() - 0.5) * 2.0;
                levelPct = levelState + jitter;
            } else {
                if (postAction === 'discharge') {
                    const drift = (rng() - 0.5) * 1.2;
                    levelState = Math.max(0, Math.min(targetLevel, levelState + drift));
                } else {
                    const drift = (rng() - 0.5) * 0.8;
                    levelState = Math.max(0, Math.min(targetLevel, targetLevel + drift));
                }
                levelPct = levelState;
            }
            levelPct = clamp(levelPct, 0, 100);

            const hasGrain = levelPct > 2;
            const month = date.getUTCMonth(); // 0=Jan
            const fanSeasonBlocked = month >= 1 && month <= 7; // Feb-Aug

            const fanRuns = fanIds.map(() => {
                if (!hasGrain || fanSeasonBlocked) return false;
                const isAutumnWinter = month >= 8 || month === 0; // Sep-Jan
                const pRun = isAutumnWinter ? (hasGrain ? 0.45 : 0) : 0.08;
                return rng() < pRun;
            });

            const anyFan = fanRuns.some(Boolean);

            const maxStep = rng() < 0.05 ? 0.35 : 0.12;
            const delta = (rng() * 2 - 1) * maxStep;

            // Cooling only when ventilation runs; slower in autumn, stronger in winter.
            let coolingBias = 0;
            if (anyFan) {
                if (month >= 8 && month <= 9) { // Sep-Oct
                    coolingBias = -0.08 - rng() * 0.06;
                } else if (month === 10) { // Nov
                    coolingBias = -0.12 - rng() * 0.08;
                } else if (month === 11) { // Dec
                    coolingBias = -0.16 - rng() * 0.10;
                } else { // Jan
                    coolingBias = -0.20 - rng() * 0.12;
                }
            } else {
                coolingBias = -0.01 + (rng() - 0.5) * 0.03;
            }

            baseTemp = clamp(baseTemp + delta + coolingBias, 5.0, 26);
            const seasonal = 0.45 * Math.sin((2 * Math.PI * (d - 210)) / 365);
            const dayTemp = baseTemp + seasonal;

            sensors.forEach((sensor, idx) => {
                const depthOffset = -0.03 * sensor.depth_m;
                const noise = (rng() - 0.5) * 0.15;
                const temp = clamp(dayTemp + depthOffset + noise, 2, 26);

                const fanId = idx < fanIds.length ? fanIds[idx] : '';
                const fanRunning = idx < fanIds.length ? fanRuns[idx] : '';

                rows.push({
                    timestamp: date.toISOString(),
                    enterprise_id: silo.enterprise_id,
                    enterprise_name: silo.enterprise_name,
                    location_id: silo.location_id,
                    location_name: silo.location_name,
                    silo_id: silo.silo_id,
                    silo_name: silo.silo_name,
                    thermometer_id: sensor.thermometer_id,
                    sensor_id: sensor.sensor_id,
                    depth_m: sensor.depth_m.toFixed(1),
                    temp_c: temp.toFixed(1),
                    fan_id: fanId,
                    fan_running: fanRunning === '' ? '' : String(fanRunning),
                    level_pct: levelPct.toFixed(1)
                });
            });
        }
    });

    return rows;
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

function getAllowedLocationSet() {
    if (!accessState.allowedLocations || !accessState.allowedLocations.length) return null;
    return new Set(accessState.allowedLocations);
}

function getAllowedEnterprises() {
    const allowedSet = getAllowedLocationSet();
    return Object.keys(enterprises).filter(entId =>
        enterprises[entId].locations.some(locId => !allowedSet || allowedSet.has(locId))
    );
}

function getEnterpriseLocationKeys() {
    let keys = [];
    if (!currentEnterprise || !enterprises[currentEnterprise]) {
        keys = Object.keys(locations);
    } else {
        keys = enterprises[currentEnterprise].locations.slice();
    }
    const allowedSet = getAllowedLocationSet();
    if (allowedSet) {
        keys = keys.filter(key => allowedSet.has(key));
    }
    return keys;
}

function renderEnterpriseMenu() {
    const menu = document.getElementById('enterpriseMenu');
    if (!menu) return;

    const allowedEnterprises = getAllowedEnterprises();
    const itemsHTML = allowedEnterprises.map(id => {
        const isActive = id === currentEnterprise;
        return `
            <button class="location-item ${isActive ? 'active' : ''}" type="button" data-enterprise="${id}">
                <span>${enterprises[id].name}</span>
            </button>
        `;
    }).join('');

    menu.innerHTML = itemsHTML;
}

function renderLocationMenu() {
    const menu = document.getElementById('locationMenu');
    if (!menu) return;

    const locationKeys = getEnterpriseLocationKeys();
    const itemsHTML = locationKeys.map(id => {
        const isActive = id === currentLocation;
        return `
            <button class="location-item ${isActive ? 'active' : ''}" type="button" data-location="${id}">
                <span>${locations[id].name}</span>
                <span class="status-dot" aria-hidden="true"></span>
            </button>
        `;
    }).join('');

    menu.innerHTML = itemsHTML;
}

function getTemperatureClass(temp) {
    temp = parseFloat(temp);
    if (temp < 5) return 'temp-very-cold';
    if (temp < 10) return 'temp-cold';
    if (temp < 15) return 'temp-optimal';
    if (temp < 18) return 'temp-normal';
    if (temp < 20) return 'temp-warm';
    return 'temp-hot';
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getLastUpdateInfo(timestamp) {
    if (!timestamp) {
        return { text: 'Data: neznamy cas', isStale: true, minutes: null };
    }
    const diffMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diffMs / 60000);
    let text = '';
    if (minutes <= 0) text = 'Data: prave aktualni';
    else if (minutes === 1) text = 'Data: 1 minuta stara';
    else text = `Data: ${minutes} minut stara`;
    return { text, isStale: minutes >= 263, minutes };
}

function formatAgeMinutes(minutes) {
    if (!Number.isFinite(minutes)) return 'neznamy cas';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} d`;
}

function isAdminUser() {
    const label = (accessState.label || '').toLowerCase();
    return accessState.code === ADMIN_ACCESS_CODE || label === 'admin';
}

function collectAdminAlerts() {
    const alerts = [];
    const allowedSet = getAllowedLocationSet();
    const locationsToCheck = Object.values(locations).filter(loc =>
        !allowedSet || allowedSet.has(loc.id)
    );

    locationsToCheck.forEach(location => {
        const info = getLastUpdateInfo(location.lastUpdateTs);
        if (info.isStale) {
            const minutes = Number.isFinite(info.minutes)
                ? info.minutes
                : Math.round((Date.now() - location.lastUpdateTs) / 60000);
            alerts.push({
                severity: 'danger',
                title: `Stredisko ${location.name} je offline`,
                detail: `Posledni data pred ${formatAgeMinutes(minutes)}.`
            });
        }

        if (location.hasCleanser) {
            const airflow = Math.round(location.cleanserAirflow || 0);
            if (airflow < 20 || airflow > 70) {
                alerts.push({
                    severity: 'danger',
                    title: `Cisticka mimo hodnoty - ${location.name}`,
                    detail: `Vzduch ${airflow}%, mimo bezny rozsah 20-70%.`
                });
            }
        }

        location.silos.forEach(silo => {
            const temps = [];
            const levelPct = Number.isFinite(silo.level) ? silo.level : 0;
            const maxDepth = Number.isFinite(silo.depth) ? silo.depth : 0;
            const levelMeters = (levelPct / 100) * maxDepth;
            if (levelPct < 5 || levelMeters <= 0) {
                return;
            }
            Object.values(silo.temperatureData || {}).forEach(sensorMap => {
                Object.values(sensorMap).forEach(sensor => {
                    if (sensor.depth > levelMeters) return;
                    const value = parseFloat(sensor.temperature);
                    if (Number.isFinite(value)) temps.push(value);
                });
            });
            if (!temps.length) return;

            const max = Math.max(...temps);
            const min = Math.min(...temps);
            const hasInvalid = temps.some(value => value >= 200);

            if (hasInvalid) {
                alerts.push({
                    severity: 'danger',
                    title: `Silo ${silo.name} - neplatna teplota`,
                    detail: `Stredisko ${location.name}, senzor hlasi extremni hodnotu.`
                });
                return;
            }

            if (max > ADMIN_TEMP_MAX || min < ADMIN_TEMP_MIN) {
                alerts.push({
                    severity: 'warning',
                    title: `Silo ${silo.name} - teploty mimo standard`,
                    detail: `Stredisko ${location.name}, rozsah ${min.toFixed(1)} - ${max.toFixed(1)} C.`
                });
            }
        });
    });

    return alerts;
}

function renderAdminAlerts() {
    const panel = document.getElementById('adminAlerts');
    if (!panel) return;
    if (!isAuthenticated || !isAdminUser()) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    const alerts = collectAdminAlerts();
    const maxItems = 8;
    const shown = alerts.slice(0, maxItems);
    const remainder = alerts.length - shown.length;
    const countLabel = alerts.length ? `${alerts.length} problemu` : 'Vse v norme';

    const itemsHtml = shown.length ? `
        <div class="admin-alerts-list">
            ${shown.map(alert => `
                <div class="admin-alert-item ${alert.severity || ''}">
                    <div class="admin-alert-title">${alert.title}</div>
                    <div class="admin-alert-sep">•</div>
                    <div class="admin-alert-detail">${alert.detail}</div>
                </div>
            `).join('')}
            ${remainder > 0 ? `<div class="admin-alert-detail">A dalsich ${remainder} polozek...</div>` : ''}
        </div>
    ` : `
        <div class="admin-alerts-empty">Zadne problematicke mereni nebylo nalezeno.</div>
    `;

    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="admin-alerts-head">
            <div class="admin-alerts-title">Problematicka mereni</div>
            <div class="admin-alerts-count">${countLabel}</div>
        </div>
        ${itemsHtml}
    `;
}

function renderVentilationTimeline(fans) {
    const now = new Date();
    const currentTime = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    const currentMinutes = timeToMinutes(currentTime);
    const dayEnd = 24 * 60;

    let html = '<div class="vent-list">';

    fans.forEach(fan => {
        let historyBars = '';

        fan.history.forEach((period) => {
            const startMinutes = timeToMinutes(period.start);
            const endMinutes = period.end ? timeToMinutes(period.end) : currentMinutes;

            const startPercent = (startMinutes / dayEnd) * 100;
            const width = ((endMinutes - startMinutes) / dayEnd) * 100;

            historyBars += `<div class="vent-bar ${!period.end ? 'running' : ''}"
                style="left: ${startPercent}%; width: ${width}%;"></div>`;
        });

        const lastPeriod = fan.history[fan.history.length - 1];
        let timeText = '-';
        if (lastPeriod) {
            timeText = lastPeriod.end ?
                `${lastPeriod.start} - ${lastPeriod.end}` :
                `od ${lastPeriod.start}`;
        }

        html += `
            <div class="vent-item">
                <div class="vent-name">${fan.name}</div>
                <div class="vent-timeline">${historyBars}</div>
                <div class="vent-time">${timeText}</div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function buildTempChartSvg(series, options = {}) {
    const width = options.width || 520;
    const height = options.height || 120;
    const padding = options.padding || 18;
    const showAxes = options.showAxes !== false;
    const cssClass = options.cssClass || 'history-chart';
    const bands = options.bands || [];
    const periodDays = options.periodDays;

    if (!series || series.length < 2) {
        return '<div class="chart-empty">Neni k dispozici historie</div>';
    }

    const temps = series.flatMap(p => [p.avg, p.min, p.max]);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = Math.max(1, maxTemp - minTemp);

    const scaleX = (t, tMin, tMax) => padding + ((t - tMin) / Math.max(1, tMax - tMin)) * (width - padding * 2);
    const scaleY = (value) => height - padding - ((value - minTemp) / range) * (height - padding * 2);

    const rangeTimes = getTimeRange(series, periodDays);
    const tMin = rangeTimes.tMin;
    const tMax = rangeTimes.tMax;

    const pointsAvg = series.map(p => `${scaleX(p.t, tMin, tMax)},${scaleY(p.avg)}`).join(' ');
    const pointsMin = series.map(p => `${scaleX(p.t, tMin, tMax)},${scaleY(p.min)}`).join(' ');
    const pointsMax = series.map(p => `${scaleX(p.t, tMin, tMax)},${scaleY(p.max)}`).join(' ');

    let axes = '';
    if (showAxes) {
        const yTicks = 4;
        const yStep = range / yTicks;
        let yAxis = '';
        for (let i = 0; i <= yTicks; i++) {
            const value = minTemp + yStep * i;
            const y = scaleY(value);
            yAxis += `<line class="chart-tick" x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" />`;
            yAxis += `<text class="chart-label" x="${padding - 6}" y="${y + 3}" text-anchor="end">${value.toFixed(1)}°C</text>`;
        }

        const xAxis = buildMonthAxis(tMin, tMax, (t) => scaleX(t, tMin, tMax), padding, height, width);

        axes = `
            <line class="chart-axis" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" />
            <line class="chart-axis" x1="${padding}" x2="${width - padding}" y1="${height - padding}" y2="${height - padding}" />
            ${yAxis}
            ${xAxis}
        `;
    }

    const bandRects = bands.map(band => {
        const x1 = scaleX(band.start, tMin, tMax);
        const x2 = scaleX(band.end, tMin, tMax);
        const x = Math.min(x1, x2);
        const w = Math.max(2, Math.abs(x2 - x1));
        return `<rect class="chart-band" x="${x}" y="${padding}" width="${w}" height="${height - padding * 2}" />`;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
            class="${cssClass} chart-interactive"
            role="img"
            aria-label="Teplotni historie"
            data-chart="time"
            data-t-min="${tMin}"
            data-t-max="${tMax}"
            data-width="${width}"
            data-height="${height}"
            data-padding="${padding}">
            ${bandRects}
            ${axes}
            <polyline class="chart-line chart-line-soft" points="${pointsMin}" />
            <polyline class="chart-line chart-line-soft" points="${pointsMax}" />
            <polyline class="chart-line chart-line-strong" points="${pointsAvg}" />
            <rect class="chart-hover-capture" x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" />
            <line class="chart-hover-line" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" visibility="hidden" />
            <text class="chart-hover-label" x="${padding}" y="${padding + 12}" text-anchor="start" visibility="hidden"></text>
        </svg>
    `;
}

function buildFanChartSvg(series, options = {}) {
    const width = options.width || 520;
    const height = options.height || 90;
    const padding = options.padding || 18;
    const showAxes = options.showAxes !== false;
    const cssClass = options.cssClass || 'fan-chart';
    const periodDays = options.periodDays;

    if (!series || series.length < 2) {
        return '<div class="chart-empty">Neni k dispozici historie</div>';
    }

    const values = series.map(p => p.value);
    const minVal = 0;
    const maxVal = 100;

    const rangeTimes = getTimeRange(series, periodDays);
    const tMin = rangeTimes.tMin;
    const tMax = rangeTimes.tMax;

    const scaleX = (t) => padding + ((t - tMin) / Math.max(1, tMax - tMin)) * (width - padding * 2);
    const scaleY = (value) => height - padding - ((value - minVal) / Math.max(1, maxVal - minVal)) * (height - padding * 2);

    const points = series.map(p => `${scaleX(p.t)},${scaleY(p.value)}`).join(' ');

    let axes = '';
    if (showAxes) {
        let yAxis = '';
        [0, 50, 100].forEach(val => {
            const y = scaleY(val);
            yAxis += `<line class="chart-tick" x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" />`;
            yAxis += `<text class="chart-label" x="${padding - 6}" y="${y + 3}" text-anchor="end">${val}%</text>`;
        });

        const xAxis = buildMonthAxis(tMin, tMax, scaleX, padding, height, width);

        axes = `
            <line class="chart-axis" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" />
            <line class="chart-axis" x1="${padding}" x2="${width - padding}" y1="${height - padding}" y2="${height - padding}" />
            ${yAxis}
            ${xAxis}
        `;
    }

    return `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
            class="${cssClass} chart-interactive"
            role="img"
            aria-label="Historie ventilatoru"
            data-chart="time"
            data-t-min="${tMin}"
            data-t-max="${tMax}"
            data-width="${width}"
            data-height="${height}"
            data-padding="${padding}">
            ${axes}
            <polyline class="fan-line" points="${points}" />
            <rect class="chart-hover-capture" x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" />
            <line class="chart-hover-line" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" visibility="hidden" />
            <text class="chart-hover-label" x="${padding}" y="${padding + 12}" text-anchor="start" visibility="hidden"></text>
        </svg>
    `;
}

function buildLevelChartSvg(series, options = {}) {
    const width = options.width || 520;
    const height = options.height || 120;
    const padding = options.padding || 18;
    const showAxes = options.showAxes !== false;
    const cssClass = options.cssClass || 'level-chart';
    const periodDays = options.periodDays;

    if (!series || series.length < 2) {
        return '<div class="chart-empty">Neni k dispozici historie</div>';
    }

    const rangeTimes = getTimeRange(series, periodDays);
    const tMin = rangeTimes.tMin;
    const tMax = rangeTimes.tMax;

    const scaleX = (t) => padding + ((t - tMin) / Math.max(1, tMax - tMin)) * (width - padding * 2);
    const scaleY = (value) => height - padding - ((value - 0) / 100) * (height - padding * 2);

    const points = series.map(p => `${scaleX(p.t)},${scaleY(p.value)}`).join(' ');

    let axes = '';
    if (showAxes) {
        let yAxis = '';
        [0, 25, 50, 75, 100].forEach(val => {
            const y = scaleY(val);
            yAxis += `<line class="chart-tick" x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" />`;
            yAxis += `<text class="chart-label" x="${padding - 6}" y="${y + 3}" text-anchor="end">${val}%</text>`;
        });

        const xAxis = buildMonthAxis(tMin, tMax, scaleX, padding, height, width);

        axes = `
            <line class="chart-axis" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" />
            <line class="chart-axis" x1="${padding}" x2="${width - padding}" y1="${height - padding}" y2="${height - padding}" />
            ${yAxis}
            ${xAxis}
        `;
    }

    return `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
            class="${cssClass} chart-interactive"
            role="img"
            aria-label="Historie naplneni sila"
            data-chart="time"
            data-t-min="${tMin}"
            data-t-max="${tMax}"
            data-width="${width}"
            data-height="${height}"
            data-padding="${padding}">
            ${axes}
            <polyline class="level-line" points="${points}" />
            <rect class="chart-hover-capture" x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" />
            <line class="chart-hover-line" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" visibility="hidden" />
            <text class="chart-hover-label" x="${padding}" y="${padding + 12}" text-anchor="start" visibility="hidden"></text>
        </svg>
    `;
}

function getSeriesForSilo(siloKey, period, maxPoints) {
    const series = historySeries[siloKey] || [];
    if (!series.length) return [];

    const now = series[series.length - 1].t;
    const days = period === '1y' ? 365 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = series.filter(p => p.t >= cutoff);

    if (filtered.length <= maxPoints) return filtered;

    const step = Math.ceil(filtered.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < filtered.length; i += step) {
        sampled.push(filtered[i]);
    }
    return sampled;
}

function getFanSeriesForSilo(siloKey, period, maxPoints) {
    const series = fanSeries[siloKey] || [];
    if (!series.length) return [];
    const now = series[series.length - 1].t;
    const days = period === '1y' ? 365 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = series.filter(p => p.t >= cutoff);
    if (filtered.length <= maxPoints) return filtered;
    const step = Math.ceil(filtered.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < filtered.length; i += step) {
        sampled.push(filtered[i]);
    }
    return sampled;
}

function getLevelSeriesForSilo(siloKey, period, maxPoints) {
    const series = levelSeries[siloKey] || [];
    if (!series.length) return [];
    const now = series[series.length - 1].t;
    const days = period === '1y' ? 365 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = series.filter(p => p.t >= cutoff);
    if (filtered.length <= maxPoints) return filtered;
    const step = Math.ceil(filtered.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < filtered.length; i += step) {
        sampled.push(filtered[i]);
    }
    return sampled;
}

function getVentBands(siloKey, period) {
    const series = fanSeries[siloKey] || [];
    if (!series.length) return [];
    const now = series[series.length - 1].t;
    const days = period === '1y' ? 365 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = series.filter(p => p.t >= cutoff);
    if (filtered.length < 2) return [];

    const bands = [];
    let current = null;
    for (let i = 0; i < filtered.length; i++) {
        const point = filtered[i];
        const next = filtered[i + 1];
        const isOn = point.value > 0;
        if (isOn && !current) {
            current = { start: point.t, end: point.t };
        }
        if (isOn && current) {
            current.end = next ? next.t : point.t + 24 * 60 * 60 * 1000;
        }
        if (!isOn && current) {
            bands.push(current);
            current = null;
        }
    }
    if (current) bands.push(current);
    return bands;
}

function renderSilo(silo, locationId) {
    const sensorsPerThermometer = silo.sensorsPerThermometer;
    const maxDepth = silo.depth;
    const levelMeters = (silo.level / 100) * maxDepth;

    let probesHTML = '';

    const thermometerIds = silo.thermometerIds;
    thermometerIds.forEach((thermId) => {
        let sensorsHTML = '';
        const sensorIds = silo.sensorIdsByThermometer[thermId] || [];

        sensorIds.forEach((sensorId) => {
            let temp = 0, depth = 0;
            if (silo.temperatureData[thermId] && silo.temperatureData[thermId][sensorId]) {
                temp = silo.temperatureData[thermId][sensorId].temperature;
                depth = silo.temperatureData[thermId][sensorId].depth;
            }

            const tempClass = getTemperatureClass(temp);
            const isActive = depth <= levelMeters;

            sensorsHTML += `<div class="sensor ${tempClass} ${!isActive ? 'inactive' : ''}"
                data-temp="${temp}"
                data-depth="${depth}"
                title="${isActive ? `Hloubka ${depth}m: ${temp}C` : 'Neaktivni - nad hladinou'}">
                ${isActive ? temp : '-'}
            </div>`;
        });

        probesHTML += `
            <div class="probe">
                <div class="probe-label">${thermId}</div>
                <div class="probe-sensors">${sensorsHTML}</div>
            </div>
        `;
    });

    const ventilationHTML = renderVentilationTimeline(silo.fans);
    const siloKey = `${locationId}:${silo.id}`;
    const series = getSeriesForSilo(siloKey, '30d', 90);
    const bands = getVentBands(siloKey, '30d');
    const chartHtml = buildTempChartSvg(series, { cssClass: 'history-chart', showAxes: true, padding: 18, bands, periodDays: 30 });
    const fanSeriesSmall = getFanSeriesForSilo(siloKey, '30d', 60);
    const fanChart = buildFanChartSvg(fanSeriesSmall, { cssClass: 'fan-chart', showAxes: true, height: 90, padding: 18, periodDays: 30 });

    return `
        <div class="silo-card">
            <div class="silo-header">
                <div class="silo-name">${silo.name}</div>
                <div class="silo-commodity">${silo.commodity}</div>
            </div>

            <div class="temp-section">
                <div class="temp-visual">
                    <div class="level-display" data-silo-key="${siloKey}" data-silo-name="${silo.name}">
                        <div class="level-bar-vertical">
                            <div class="level-fill-vertical" style="height: ${silo.level}%;"></div>
                        </div>
                        <div class="level-percentage">${silo.level}%</div>
                    </div>
                    <div class="probes-container">${probesHTML}</div>
                </div>
            </div>

            <div class="history-section" data-silo-key="${siloKey}" data-silo-name="${silo.name}">
                <div class="temp-label">Teploty</div>
                ${chartHtml}
            </div>

            <div class="fan-section" data-silo-key="${siloKey}" data-silo-name="${silo.name}">
                <div class="temp-label">Ventilatory</div>
                ${fanChart}
            </div>

            ${''}
        </div>
    `;
}

function renderCleanserCard(location) {
    const airflow = Math.round(location.cleanserAirflow || 0);
    const safeAirflow = clamp(airflow, 0, 100);
    const airflowOk = safeAirflow >= 20 && safeAirflow <= 70;
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - safeAirflow / 100);

    return `
        <div class="silo-card cleanser-card">
            <div class="silo-header">
                <div class="silo-name">Cisticka</div>
            </div>
            <div class="cleanser-body">
                <div class="cleanser-gauge ${airflowOk ? '' : 'gauge-danger'}">
                    <svg viewBox="0 0 120 120" class="gauge-svg" role="img" aria-label="Cisticka - prutok vzduchu ${safeAirflow}%">
                        <circle class="gauge-track" cx="60" cy="60" r="${radius}" />
                        <circle class="gauge-value" cx="60" cy="60" r="${radius}"
                            style="stroke-dasharray:${circumference}; stroke-dashoffset:${offset};" />
                        <text class="gauge-value-text" x="60" y="62" text-anchor="middle">${safeAirflow}%</text>
                        <text class="gauge-label" x="60" y="78" text-anchor="middle">Vzduch</text>
                    </svg>
                </div>
            </div>
        </div>
    `;
}

function changeLocation() {
    const locationKeys = getEnterpriseLocationKeys();
    const locationKey = currentLocation || locationKeys[0];
    const location = locations[locationKey];

    if (!location) return;

    currentLocation = locationKey;
    const locationName = document.getElementById('locationName');
    if (locationName) {
        locationName.textContent = location.name;
    }

    const lastUpdateLabel = document.getElementById('lastUpdateLabel');
    if (lastUpdateLabel) {
        const info = getLastUpdateInfo(location.lastUpdateTs);
        lastUpdateLabel.textContent = info.text;
        lastUpdateLabel.classList.toggle('is-stale', info.isStale);
    }

    const isOnline = true;
    const statusDot = document.getElementById('locationStatusDot');

    if (statusDot) {
        if (isOnline) {
            statusDot.classList.remove('offline');
            statusDot.setAttribute('aria-label', 'Online');
            statusDot.title = 'Online';
        } else {
            statusDot.classList.add('offline');
            statusDot.setAttribute('aria-label', 'Offline');
            statusDot.title = 'Offline';
        }
    }

    const silosHTML = location.silos.map(silo => renderSilo(silo, locationKey)).join('');
    const cleanserHTML = location.hasCleanser ? renderCleanserCard(location) : '';
    document.getElementById('silosContainer').innerHTML = `<div class="silos-grid">${silosHTML}${cleanserHTML}</div>`;

    const logHTML = location.log.map(entry =>
        `<div class="log-entry">
            <div class="log-time">${entry.time}</div>
            <div class="log-message">${entry.message}</div>
        </div>`
    ).join('');
    document.getElementById('logEntries').innerHTML = logHTML;

    if (mapState.open) {
        renderMap(currentLocation);
    }

    renderLocationMenu();
    setupChartInteractions();
    setupChartHover();
    renderAdminAlerts();
}

function changeEnterprise() {
    const accountName = document.getElementById('accountName');
    if (accountName && currentEnterprise && enterprises[currentEnterprise]) {
        accountName.textContent = enterprises[currentEnterprise].name;
    }
    const locationKeys = getEnterpriseLocationKeys();
    if (!locationKeys.length) {
        showNoAccess();
        return;
    }
    currentLocation = locationKeys[0];
    changeLocation();
    renderEnterpriseMenu();
}

function showNoAccess() {
    const container = document.getElementById('silosContainer');
    if (container) {
        container.innerHTML = '<div class="load-error">Pro tento kod nejsou prirazena zadna strediska.</div>';
    }
}

function readAuthFromStorage() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.code || !ACCESS_CODES[parsed.code]) return null;
        return parsed.code;
    } catch {
        return null;
    }
}

function readLockState() {
    try {
        const raw = localStorage.getItem(AUTH_LOCK_KEY);
        if (!raw) return { failed: 0, lockUntil: 0 };
        const parsed = JSON.parse(raw);
        return {
            failed: parsed.failed || 0,
            lockUntil: parsed.lockUntil || 0
        };
    } catch {
        return { failed: 0, lockUntil: 0 };
    }
}

function writeLockState(state) {
    localStorage.setItem(AUTH_LOCK_KEY, JSON.stringify(state));
}

function clearLockState() {
    writeLockState({ failed: 0, lockUntil: 0 });
}

function registerFailedAttempt() {
    const state = readLockState();
    const failed = (state.failed || 0) + 1;
    let lockUntil = state.lockUntil || 0;
    if (failed >= 5) {
        const penaltyMinutes = Math.min(60, Math.pow(2, Math.min(4, failed - 5)));
        lockUntil = Date.now() + penaltyMinutes * 60 * 1000;
    }
    writeLockState({ failed, lockUntil });
    return { failed, lockUntil };
}

function getLockRemainingMs() {
    const state = readLockState();
    return Math.max(0, (state.lockUntil || 0) - Date.now());
}

function updateLoginLockUI() {
    const input = document.getElementById('accessCodeInput');
    const button = document.getElementById('loginButton');
    const error = document.getElementById('loginError');
    if (!input || !button || !error) return;
    const remainingMs = getLockRemainingMs();
    if (remainingMs > 0) {
        const minutes = Math.ceil(remainingMs / 60000);
        input.setAttribute('disabled', 'true');
        button.setAttribute('disabled', 'true');
        error.textContent = `Prihlaseni je docasne blokovane. Zkuste to za ${minutes} min.`;
    } else {
        input.removeAttribute('disabled');
        button.removeAttribute('disabled');
        if (error.textContent && error.textContent.includes('blokovane')) {
            error.textContent = '';
        }
    }
}

function showLoginScreen() {
    const login = document.getElementById('loginScreen');
    const appRoot = document.getElementById('appRoot');
    if (login) login.setAttribute('aria-hidden', 'false');
    if (appRoot) appRoot.setAttribute('aria-hidden', 'true');
    updateLoginLockUI();
    renderAdminAlerts();
}

function showAppScreen() {
    const login = document.getElementById('loginScreen');
    const appRoot = document.getElementById('appRoot');
    if (login) login.setAttribute('aria-hidden', 'true');
    if (appRoot) appRoot.setAttribute('aria-hidden', 'false');
}

function applyAccessDefaults() {
    const allowedSet = getAllowedLocationSet();
    const available = Object.keys(locations).filter(locId => !allowedSet || allowedSet.has(locId));
    if (!available.length) {
        showNoAccess();
        return false;
    }
    const preferred = accessState.defaultLocation && (!allowedSet || allowedSet.has(accessState.defaultLocation))
        ? accessState.defaultLocation
        : available[0];
    currentLocation = preferred;
    currentEnterprise = locations[preferred].enterprise;
    return true;
}

function completeLogin(code, access, options = {}) {
    isAuthenticated = true;
    accessState = {
        code,
        label: access.label || 'Uzivatel',
        allowedLocations: access.locations || null,
        defaultLocation: access.defaultLocation || (access.locations || [])[0] || null
    };
    if (!options.skipSave) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ code }));
    }
    clearLockState();
    showAppScreen();
    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = accessState.label;
    }
    if (!applyAccessDefaults()) {
        return;
    }
    if (!uiInitialized) {
        setupPickers();
        setupModal();
        setupMap();
        uiInitialized = true;
    }
    changeEnterprise();
}

function setupLogin() {
    if (loginInitialized) return;
    const form = document.getElementById('loginForm');
    const input = document.getElementById('accessCodeInput');
    const error = document.getElementById('loginError');
    if (!form || !input || !error) return;

    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        error.textContent = '';
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const now = Date.now();
        if (now - lastLoginAttempt < 800) {
            error.textContent = 'Chvili pockejte a zkuste to znovu.';
            return;
        }
        lastLoginAttempt = now;
        updateLoginLockUI();
        if (getLockRemainingMs() > 0) return;

        const code = input.value.trim();
        if (!/^\d{6}$/.test(code)) {
            error.textContent = 'Kod musi mit 6 cislic.';
            return;
        }

        const access = ACCESS_CODES[code];
        if (!access) {
            registerFailedAttempt();
            updateLoginLockUI();
            error.textContent = 'Neplatny kod. Zkuste to znovu.';
            input.value = '';
            return;
        }

        completeLogin(code, access);
    });

    updateLoginLockUI();
    setInterval(updateLoginLockUI, 15000);
    loginInitialized = true;
}

function setupLogout() {
    const button = document.getElementById('logoutButton');
    if (!button) return;
    button.addEventListener('click', () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        isAuthenticated = false;
        accessState = { code: '', label: '', allowedLocations: null, defaultLocation: null };
        showLoginScreen();
    });
}

function buildFanHistory(siloKey, fanId) {
    const records = (fanHistory[siloKey] && fanHistory[siloKey][fanId]) || [];
    if (!records.length) {
        return [];
    }

    const now = records[records.length - 1].t;
    const cutoff = now - 24 * 60 * 60 * 1000;
    const filtered = records.filter(r => r.t >= cutoff);

    const intervals = [];
    let current = null;
    filtered.forEach(r => {
        if (r.running && !current) {
            current = { start: r.label, end: null };
        }
        if (!r.running && current) {
            current.end = r.label;
            intervals.push(current);
            current = null;
        }
    });
    if (current) intervals.push(current);
    return intervals.length ? intervals : [{ start: filtered[0].label, end: filtered[filtered.length - 1].label }];
}

function buildData(snapshotRows, historyRows) {
    enterprises = {};
    locations = {};
    historySeries = {};
    fanHistory = {};
    fanSeries = {};
    levelSeries = {};

    if (!faultyThermometerKeys.length) {
        faultyThermometerKeys = pickRandomThermometerKeys(snapshotRows, 2);
    }
    const faultySet = new Set(faultyThermometerKeys);

    const historyBuckets = {};
    const thermometerChoice = {};
    const fanDedup = {};
    const siloDepthByKey = {};
    const fanSeriesBuckets = {};
    const levelBuckets = {};

    const locationMeta = {
        melkovice: { hasCleanser: false, hasDryer: false, dataAgeMinutes: 20 },
        stranecka: { hasCleanser: true, cleanserAirflow: 40, hasDryer: false, dataAgeMinutes: 263 },
        brniste: { hasCleanser: true, cleanserAirflow: 100, hasDryer: true, dataAgeMinutes: 20 },
    };

    const commodities = [
        'Psenice potravina',
        'Psenice krmna',
        'Jecmen jarni',
        'Repka',
        'Kukurice',
        'Oves'
    ];

    const pickCommodity = (locId, siloId) => {
        const seed = (locId + ':' + siloId).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return commodities[seed % commodities.length];
    };

    const snapshotLevels = {};

    lastDataTimestamp = snapshotRows.reduce((max, row) => {
        const ts = Date.parse(row.timestamp);
        return Number.isFinite(ts) && ts > max ? ts : max;
    }, lastDataTimestamp || 0);

    snapshotRows.forEach(row => {
        const entId = row.enterprise_id;
        const entName = row.enterprise_name;
        if (!enterprises[entId]) {
            enterprises[entId] = { name: entName, locations: [] };
        }

        const locId = row.location_id;
        const locName = row.location_name;
        if (!locations[locId]) {
            const meta = locationMeta[locId] || {};
            const baseTs = lastDataTimestamp || Date.now();
            const forcedAge = Number.isFinite(meta.dataAgeMinutes) ? meta.dataAgeMinutes : null;
            const lastUpdateTs = forcedAge !== null ? Date.now() - forcedAge * 60000 : baseTs;

            locations[locId] = {
                id: locId,
                name: locName,
                enterprise: entId,
                silos: [],
                siloMap: {},
                hasCleanser: !!meta.hasCleanser,
                cleanserAirflow: meta.cleanserAirflow || 0,
                hasDryer: !!meta.hasDryer,
                lastUpdateTs,
                log: [
                    { time: '16:23', message: 'Silo 4 - Ventilator 1 aktivovan' },
                    { time: '14:15', message: 'Silo 2 - Kontrola teploty OK' },
                    { time: '12:40', message: 'System pripojen' },
                ],
            };
            enterprises[entId].locations.push(locId);
        }

        const location = locations[locId];
        const siloId = row.silo_id;
        const siloKey = `${locId}:${siloId}`;
        snapshotLevels[siloKey] = parseInt(row.level_pct || '0', 10);
        if (!location.siloMap[siloId]) {
            location.siloMap[siloId] = {
                id: siloId,
                name: row.silo_name || `Silo ${siloId}`,
                level: parseInt(row.level_pct || '0', 10),
                commodity: pickCommodity(locId, siloId),
                thermometers: 0,
                sensorsPerThermometer: 0,
                thermometerIds: [],
                sensorIdsByThermometer: {},
                temperatureData: {},
                depth: 0,
                fans: [],
                fanMap: {},
            };
        }

        const silo = location.siloMap[siloId];
        const thermId = row.thermometer_id;
        const sensorId = row.sensor_id;
        const depth = parseFloat(row.depth_m || '0');
        const thermKey = `${locId}:${siloId}:${thermId}`;
        let temp = parseFloat(row.temp_c || '0');
        if (faultySet.has(thermKey)) {
            temp = 255;
        }
        const fanId = row.fan_id;
        const fanRunning = row.fan_running === 'true';

        if (!silo.temperatureData[thermId]) {
            silo.temperatureData[thermId] = {};
            silo.thermometerIds.push(thermId);
            silo.sensorIdsByThermometer[thermId] = [];
        }

        silo.temperatureData[thermId][sensorId] = { temperature: temp, depth };
        if (!silo.sensorIdsByThermometer[thermId].includes(sensorId)) {
            silo.sensorIdsByThermometer[thermId].push(sensorId);
        }

        silo.depth = Math.max(silo.depth, depth);
        siloDepthByKey[siloKey] = Math.max(siloDepthByKey[siloKey] || 0, depth);
        silo.sensorsPerThermometer = Math.max(silo.sensorsPerThermometer, silo.sensorIdsByThermometer[thermId].length);
        silo.thermometers = Math.max(silo.thermometers, silo.thermometerIds.length);

        if (fanId) {
            if (!silo.fanMap[fanId]) {
                silo.fanMap[fanId] = { name: `Ventilator ${fanId.replace('F', '')}`, running: false, history: [] };
            }
            silo.fanMap[fanId].running = silo.fanMap[fanId].running || fanRunning;
        }
    });

    Object.values(locations).forEach(location => {
        location.silos = Object.values(location.siloMap).map(silo => {
            silo.thermometerIds.sort();
            Object.keys(silo.fanMap).forEach(fanId => {
                const siloKey = `${location.id}:${silo.id}`;
                silo.fanMap[fanId].history = buildFanHistory(siloKey, fanId);
            });
            silo.fans = Object.values(silo.fanMap);
            return silo;
        });
    });

    historyRows.forEach(row => {
        const locId = row.location_id;
        const siloId = row.silo_id;
        const key = `${locId}:${siloId}`;
        const thermId = row.thermometer_id;
        const thermKey = `${locId}:${siloId}:${thermId}`;
        let temp = parseFloat(row.temp_c || '0');
        if (faultySet.has(thermKey)) {
            temp = 255;
        }
        const ts = Date.parse(row.timestamp);
        const depth = parseFloat(row.depth_m || '0');
        const levelPct = parseFloat(row.level_pct || '0');
        const maxDepth = Math.max(siloDepthByKey[key] || 0, depth);
        const levelMeters = (levelPct / 100) * maxDepth;
        const isActive = depth <= levelMeters;

        if (!levelBuckets[key]) levelBuckets[key] = {};
        if (!levelBuckets[key][ts]) {
            levelBuckets[key][ts] = levelPct;
        }

        const fanId = row.fan_id;
        if (fanId) {
            if (!fanHistory[key]) fanHistory[key] = {};
            if (!fanHistory[key][fanId]) fanHistory[key][fanId] = [];
            if (!fanDedup[key]) fanDedup[key] = {};
            if (!fanDedup[key][fanId] || fanDedup[key][fanId] !== ts) {
                fanHistory[key][fanId].push({
                    t: ts,
                    running: row.fan_running === 'true',
                    label: new Date(ts).toTimeString().slice(0,5)
                });
                fanDedup[key][fanId] = ts;
            }
        }

        if (fanId) {
            if (!fanSeriesBuckets[key]) fanSeriesBuckets[key] = {};
            if (!fanSeriesBuckets[key][ts]) {
                fanSeriesBuckets[key][ts] = { total: 0, running: 0, seen: {} };
            }
            if (!fanSeriesBuckets[key][ts].seen[fanId]) {
                fanSeriesBuckets[key][ts].seen[fanId] = true;
                fanSeriesBuckets[key][ts].total += 1;
                if (row.fan_running === 'true') {
                    fanSeriesBuckets[key][ts].running += 1;
                }
            }
        }

        if (!isActive) {
            return;
        }

        if (!thermometerChoice[key]) {
            thermometerChoice[key] = thermId;
        }

        if (!historyBuckets[key]) historyBuckets[key] = {};
        if (!historyBuckets[key][ts]) {
            historyBuckets[key][ts] = { sum: 0, count: 0, min: null, max: null, tMin: null, tMax: null };
        }

        const bucket = historyBuckets[key][ts];
        bucket.sum += temp;
        bucket.count += 1;
        bucket.min = bucket.min === null ? temp : Math.min(bucket.min, temp);
        bucket.max = bucket.max === null ? temp : Math.max(bucket.max, temp);

        if (thermId === thermometerChoice[key]) {
            bucket.tMin = bucket.tMin === null ? temp : Math.min(bucket.tMin, temp);
            bucket.tMax = bucket.tMax === null ? temp : Math.max(bucket.tMax, temp);
        }
    });

    Object.keys(historyBuckets).forEach(key => {
        const series = Object.keys(historyBuckets[key]).map(tsStr => {
            const ts = parseInt(tsStr, 10);
            const bucket = historyBuckets[key][tsStr];
            if (!bucket.count) return null;
            return {
                t: ts,
                avg: bucket.sum / bucket.count,
                min: bucket.tMin !== null ? bucket.tMin : bucket.min,
                max: bucket.tMax !== null ? bucket.tMax : bucket.max,
            };
        }).filter(Boolean).sort((a, b) => a.t - b.t);

        historySeries[key] = series;
    });

    Object.keys(fanSeriesBuckets).forEach(key => {
        const series = Object.keys(fanSeriesBuckets[key]).map(tsStr => {
            const ts = parseInt(tsStr, 10);
            const bucket = fanSeriesBuckets[key][tsStr];
            const ratio = bucket.total ? (bucket.running / bucket.total) * 100 : 0;
            return { t: ts, value: ratio };
        }).sort((a, b) => a.t - b.t);
        fanSeries[key] = series;
    });

    Object.keys(levelBuckets).forEach(key => {
        const series = Object.keys(levelBuckets[key]).map(tsStr => {
            const ts = parseInt(tsStr, 10);
            return { t: ts, value: parseFloat(levelBuckets[key][tsStr]) };
        }).sort((a, b) => a.t - b.t);

        if (series.length && snapshotLevels[key] !== undefined) {
            series[series.length - 1].value = snapshotLevels[key];
        }
        levelSeries[key] = series;
    });
}

function setupPickers() {
    const picker = document.getElementById('locationPicker');
    const trigger = document.getElementById('locationTrigger');
    const menu = document.getElementById('locationMenu');

    if (picker && trigger && menu) {
        let closeTimeout = null;

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            picker.classList.toggle('open');
            trigger.setAttribute('aria-expanded', picker.classList.contains('open') ? 'true' : 'false');
        });

        picker.addEventListener('mouseenter', () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
            picker.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
        });

        picker.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
                picker.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }, 250);
        });

        menu.addEventListener('click', (event) => {
            const button = event.target.closest('.location-item');
            if (!button) return;
            currentLocation = button.getAttribute('data-location');
            changeLocation();
            picker.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        });

        document.addEventListener('click', () => {
            picker.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        });
    }

    const enterprisePicker = document.getElementById('enterprisePicker');
    const enterpriseTrigger = document.getElementById('enterpriseTrigger');
    const enterpriseMenu = document.getElementById('enterpriseMenu');

    if (enterprisePicker && enterpriseTrigger && enterpriseMenu) {
        if (currentUserRole !== 'MASTER') {
            enterprisePicker.classList.remove('open');
            enterpriseMenu.style.display = 'none';
            enterpriseTrigger.setAttribute('aria-expanded', 'false');
            enterpriseTrigger.setAttribute('disabled', 'true');
        } else {
            enterpriseMenu.style.display = '';
            enterpriseTrigger.removeAttribute('disabled');
            let closeTimeout = null;

            enterpriseTrigger.addEventListener('click', (event) => {
                event.stopPropagation();
                enterprisePicker.classList.toggle('open');
                enterpriseTrigger.setAttribute('aria-expanded', enterprisePicker.classList.contains('open') ? 'true' : 'false');
            });

            enterprisePicker.addEventListener('mouseenter', () => {
                if (closeTimeout) {
                    clearTimeout(closeTimeout);
                    closeTimeout = null;
                }
                enterprisePicker.classList.add('open');
                enterpriseTrigger.setAttribute('aria-expanded', 'true');
            });

            enterprisePicker.addEventListener('mouseleave', () => {
                closeTimeout = setTimeout(() => {
                    enterprisePicker.classList.remove('open');
                    enterpriseTrigger.setAttribute('aria-expanded', 'false');
                }, 250);
            });

            enterpriseMenu.addEventListener('click', (event) => {
                const button = event.target.closest('.location-item');
                if (!button) return;
                currentEnterprise = button.getAttribute('data-enterprise');
                changeEnterprise();
                enterprisePicker.classList.remove('open');
                enterpriseTrigger.setAttribute('aria-expanded', 'false');
            });

            document.addEventListener('click', () => {
                enterprisePicker.classList.remove('open');
                enterpriseTrigger.setAttribute('aria-expanded', 'false');
            });
        }
    }
}

function setupModal() {
    const modal = document.getElementById('detailModal');
    const closeBtn = modal ? modal.querySelector('.modal-close') : null;
    const backdrop = modal ? modal.querySelector('.modal-backdrop') : null;
    const buttons = modal ? modal.querySelectorAll('.history-btn') : [];

    if (!modal) return;

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        modalState = { open: false, type: 'temp', siloKey: '', siloName: '' };
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            modalPeriod = btn.getAttribute('data-period');
            renderModalContent();
        });
    });
}

function buildAutoMarkers(silos) {
    const count = silos.length;
    if (!count) return [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const margin = 10;
    const stepX = cols === 1 ? 0 : (100 - margin * 2) / (cols - 1);
    const stepY = rows === 1 ? 0 : (100 - margin * 2) / (rows - 1);

    return silos.map((silo, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
            id: String(silo.id || index + 1),
            siloId: String(silo.id || index + 1),
            name: silo.name || `Silo ${index + 1}`,
            x: margin + col * stepX,
            y: margin + row * stepY,
            shape: 'circle'
        };
    });
}

async function loadMapConfig() {
    if (mapConfigLoaded) return;
    mapConfigLoaded = true;
    try {
        const response = await fetch(MAP_CONFIG_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data || !data.locations) return;
        Object.keys(data.locations).forEach(key => {
            const external = data.locations[key] || {};
            if (!MAP_CONFIG[key]) {
                MAP_CONFIG[key] = { image: '', markers: [] };
            }
            if (external.image) {
                MAP_CONFIG[key].image = external.image;
            }
            if (Array.isArray(external.markers)) {
                MAP_CONFIG[key].markers = external.markers.map(marker => ({
                    id: marker.id || marker.siloId || '',
                    siloId: marker.siloId || marker.id || '',
                    name: marker.name || '',
                    x: marker.x,
                    y: marker.y,
                    shape: 'circle'
                }));
            }
        });
    } catch {
        // ignore missing or invalid config
    }
}

function setActiveMapMarker(markerId) {
    const overlay = document.getElementById('mapOverlay');
    const legend = document.getElementById('mapLegend');
    if (!overlay || !legend) return;
    overlay.querySelectorAll('.map-marker').forEach(marker => {
        marker.classList.toggle('active', marker.getAttribute('data-id') === markerId);
    });
    legend.querySelectorAll('.map-legend-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-id') === markerId);
    });
}

function renderMap(locationId) {
    const mapImage = document.getElementById('mapImage');
    const overlay = document.getElementById('mapOverlay');
    const legend = document.getElementById('mapLegend');
    const label = document.getElementById('mapLocationLabel');

    const stage = document.getElementById('mapStage');
    const help = document.getElementById('mapHelp');
    const exportButton = document.getElementById('mapExportButton');
    if (!mapImage || !overlay || !legend || !label || !stage) return;

    const location = locations[locationId];
    if (!location) {
        mapImage.removeAttribute('src');
        overlay.innerHTML = '';
        legend.innerHTML = '<div class="map-help">Stredisko neni dostupne.</div>';
        return;
    }

    const config = MAP_CONFIG[locationId] || {};
    const canEdit = isAuthenticated && isAdminUser();
    if (exportButton) {
        exportButton.disabled = !canEdit;
        exportButton.style.display = canEdit ? '' : 'none';
    }
    if (config.image) {
        mapImage.src = config.image;
    } else {
        mapImage.removeAttribute('src');
    }
    mapImage.alt = `Mapa arealu - ${location.name}`;
    label.textContent = location.name;

    const silos = location.silos || [];
    let markers = Array.isArray(config.markers) && config.markers.length
        ? config.markers.map((marker, index) => {
            const siloMatch = silos.find(silo => String(silo.id) === String(marker.siloId));
            return {
                id: marker.id || String(marker.siloId || index + 1),
                siloId: String(marker.siloId || marker.id || index + 1),
                name: marker.name || (siloMatch ? siloMatch.name : `Silo ${index + 1}`),
                x: marker.x,
                y: marker.y,
                shape: 'circle'
            };
        })
        : buildAutoMarkers(silos);

    if (!markers.length) {
        overlay.innerHTML = '';
        legend.innerHTML = '<div class="map-help">Zadne dostupne silo pro mapu.</div>';
        return;
    }

    if (!Array.isArray(config.markers) || !config.markers.length) {
        config.markers = markers.map(marker => ({
            id: marker.id,
            siloId: marker.siloId,
            name: marker.name,
            x: marker.x,
            y: marker.y,
            shape: 'circle'
        }));
    }

    overlay.classList.toggle('is-editable', canEdit);
    legend.classList.toggle('is-editable', canEdit);
    const helpText = canEdit ? 'Admin: marker lze posouvat tazenim.' : 'Kliknete na silo pro zvyrazneni.';
    if (help) help.textContent = helpText;
    overlay.innerHTML = markers.map(marker => `
        <button
            class="map-marker"
            style="--x:${marker.x}%; --y:${marker.y}%;"
            data-id="${marker.id}"
            data-silo-id="${marker.siloId}"
            data-label="${marker.name}"
            type="button"
            aria-label="${marker.name}">
        </button>
    `).join('');

    legend.innerHTML = markers.map(marker => `
        <div class="map-legend-item" data-id="${marker.id}" role="button" tabindex="0">
            <div class="map-legend-marker"></div>
            <span>${marker.name}</span>
        </div>
    `).join('');

    overlay.querySelectorAll('.map-marker').forEach(marker => {
        const markerId = marker.getAttribute('data-id');
        marker.addEventListener('click', () => {
            setActiveMapMarker(markerId);
        });

        if (canEdit) {
            marker.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                const rect = stage.getBoundingClientRect();
                const configMarker = config.markers.find(m => String(m.id) === String(markerId));
                if (!configMarker) return;

                const move = (evt) => {
                    const rawX = ((evt.clientX - rect.left) / rect.width) * 100;
                    const rawY = ((evt.clientY - rect.top) / rect.height) * 100;
                    const x = Math.round(clamp(rawX, 0, 100) * 10) / 10;
                    const y = Math.round(clamp(rawY, 0, 100) * 10) / 10;
                    configMarker.x = x;
                    configMarker.y = y;
                    marker.style.setProperty('--x', `${x}%`);
                    marker.style.setProperty('--y', `${y}%`);
                };

                const stop = () => {
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', stop);
                };

                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', stop);
            });
        }
    });

    legend.querySelectorAll('.map-legend-item').forEach(item => {
        item.addEventListener('click', () => {
            setActiveMapMarker(item.getAttribute('data-id'));
        });
        item.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveMapMarker(item.getAttribute('data-id'));
            }
        });
    });

    if (markers.length) {
        setActiveMapMarker(markers[0].id);
    }
}

function openMapModal(locationId) {
    const modal = document.getElementById('mapModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    mapState = { open: true, locationId };
    loadMapConfig().then(() => {
        renderMap(locationId);
    });
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    mapState = { open: false, locationId: '' };
}

function setupMap() {
    const button = document.getElementById('mapButton');
    const modal = document.getElementById('mapModal');
    const exportButton = document.getElementById('mapExportButton');
    if (!button || !modal) return;
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');

    button.addEventListener('click', () => {
        const locationId = currentLocation || getEnterpriseLocationKeys()[0];
        if (locationId) {
            openMapModal(locationId);
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', closeMapModal);
    if (backdrop) backdrop.addEventListener('click', closeMapModal);

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            if (!isAuthenticated || !isAdminUser()) return;
            downloadMapConfig();
        });
    }
}

function buildExportPayload() {
    const locationsPayload = {};
    Object.keys(MAP_CONFIG).forEach(key => {
        const cfg = MAP_CONFIG[key] || {};
        locationsPayload[key] = {
            image: cfg.image || '',
            markers: Array.isArray(cfg.markers) ? cfg.markers.map(marker => ({
                id: marker.id || '',
                siloId: marker.siloId || marker.id || '',
                name: marker.name || '',
                x: marker.x,
                y: marker.y,
                shape: 'circle'
            })) : []
        };
    });

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        locations: locationsPayload
    };
}

function downloadMapConfig() {
    const payload = buildExportPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = 'map-config.json';

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function setupChartInteractions() {
    const tempSections = document.querySelectorAll('.history-section');
    const fanSections = document.querySelectorAll('.fan-section');
    const levelDisplays = document.querySelectorAll('.level-display');

    tempSections.forEach(section => {
        section.addEventListener('click', () => {
            const siloKey = section.getAttribute('data-silo-key');
            const siloName = section.getAttribute('data-silo-name');
            openModal('temp', siloKey, siloName);
        });
    });

    fanSections.forEach(section => {
        section.addEventListener('click', () => {
            const siloKey = section.getAttribute('data-silo-key');
            const siloName = section.getAttribute('data-silo-name');
            openModal('fan', siloKey, siloName);
        });
    });

    levelDisplays.forEach(display => {
        display.addEventListener('click', () => {
            const siloKey = display.getAttribute('data-silo-key');
            const siloName = display.getAttribute('data-silo-name');
            openModal('level', siloKey, siloName);
        });
    });
}

function setupChartHover() {
    const svgs = document.querySelectorAll('svg.chart-interactive[data-chart="time"]');
    svgs.forEach(svg => {
        if (svg.getAttribute('data-hover-init') === '1') return;
        svg.setAttribute('data-hover-init', '1');

        const line = svg.querySelector('.chart-hover-line');
        const label = svg.querySelector('.chart-hover-label');
        const capture = svg.querySelector('.chart-hover-capture');
        if (!line || !label || !capture) return;

        const tMin = parseInt(svg.getAttribute('data-t-min'), 10);
        const tMax = parseInt(svg.getAttribute('data-t-max'), 10);
        const padding = parseFloat(svg.getAttribute('data-padding'));
        const width = parseFloat(svg.getAttribute('data-width'));
        const height = parseFloat(svg.getAttribute('data-height'));
        if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return;

        const toDateLabel = (t) => {
            const d = new Date(t);
            const day = d.getDate();
            const month = d.getMonth() + 1;
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}. ${hours}:${mins}`;
        };

        const update = (evt) => {
            const pt = svg.createSVGPoint();
            pt.x = evt.clientX;
            pt.y = evt.clientY;
            const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
            const x = clamp(cursor.x, padding, width - padding);
            const ratio = (x - padding) / Math.max(1, (width - padding * 2));
            const t = tMin + ratio * (tMax - tMin);

            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('visibility', 'visible');

            label.textContent = toDateLabel(t);
            const labelY = padding + 12;
            const labelWidth = 80;
            if (x > width - padding - labelWidth) {
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('x', x - 6);
            } else {
                label.setAttribute('text-anchor', 'start');
                label.setAttribute('x', x + 6);
            }
            label.setAttribute('y', labelY);
            label.setAttribute('visibility', 'visible');
        };

        const showDefault = () => {
            const x = padding;
            const ratio = (x - padding) / Math.max(1, (width - padding * 2));
            const t = tMin + ratio * (tMax - tMin);
            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('visibility', 'visible');
            label.textContent = toDateLabel(t);
            label.setAttribute('text-anchor', 'start');
            label.setAttribute('x', x + 6);
            label.setAttribute('y', padding + 12);
            label.setAttribute('visibility', 'visible');
        };

        const hide = () => {
            showDefault();
        };

        capture.addEventListener('mousemove', update);
        capture.addEventListener('mouseenter', update);
        capture.addEventListener('mouseleave', hide);

        showDefault();
    });
}

function openModal(type, siloKey, siloName) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modalState = { open: true, type, siloKey, siloName };
    const buttons = modal.querySelectorAll('.history-btn');
    buttons.forEach(b => b.classList.remove('active'));
    const active = modal.querySelector(`.history-btn[data-period="${modalPeriod}"]`);
    if (active) active.classList.add('active');
    renderModalContent();
}

function renderModalContent() {
    if (!modalState.open) return;
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if (!modal || !title || !body) return;

    if (modalState.type === 'temp') {
        title.textContent = `Detail teplot - ${modalState.siloName}`;
        const series = getSeriesForSilo(modalState.siloKey, modalPeriod, 200);
        const periodDays = modalPeriod === '1y' ? 365 : 30;
        const bands = getVentBands(modalState.siloKey, modalPeriod);
        const chart = buildTempChartSvg(series, { width: 860, height: 260, padding: 36, cssClass: 'history-chart history-chart-large', bands, periodDays });
        body.innerHTML = `
            <div class="history-section">
                ${chart}
                <div class="chart-legend">
                    <span class="legend-soft">Min/Max teplomer</span>
                    <span class="legend-strong">Prumer sila</span>
                </div>
                <div class="modal-legend">
                    <div><strong>Prumer teplot</strong> = prumer teplot zaplnenych cidel.</div>
                    <div><strong>Min/Max teplomer</strong> = minimum a maximum z jednoho vybraneho teplomeru.</div>
                    <div><strong>Zelene oblasti</strong> = casy, kdy bezela ventilace.</div>
                    <div>Nezaplnena cidla (nad hladinou) se do vypoctu nezahrnuji.</div>
                </div>
            </div>
        `;
    } else {
        if (modalState.type === 'fan') {
            title.textContent = `Detail ventilatoru - ${modalState.siloName}`;
            const series = getFanSeriesForSilo(modalState.siloKey, modalPeriod, 200);
            const periodDays = modalPeriod === '1y' ? 365 : 30;
            const chart = buildFanChartSvg(series, { width: 860, height: 220, padding: 36, cssClass: 'fan-chart fan-chart-large', periodDays });
            body.innerHTML = `
                <div class="fan-section">
                    ${chart}
                    <div class="chart-legend">
                        <span class="legend-strong">Podil aktivnich ventilatoru</span>
                    </div>
                </div>
            `;
        } else {
            title.textContent = `Detail naplneni sila - ${modalState.siloName}`;
            const series = getLevelSeriesForSilo(modalState.siloKey, modalPeriod, 200);
            const periodDays = modalPeriod === '1y' ? 365 : 30;
            const chart = buildLevelChartSvg(series, { width: 860, height: 220, padding: 36, cssClass: 'level-chart level-chart-large', periodDays });
            body.innerHTML = `
                <div class="level-section">
                    ${chart}
                    <div class="chart-legend">
                        <span class="legend-strong">Naplneni sila v %</span>
                    </div>
                </div>
            `;
        }
    }
    setupChartHover();
}

function initApp(snapshotRows, historyRows) {
    try {
        buildData(snapshotRows, historyRows);
        setupLogin();
        setupLogout();

        const savedCode = readAuthFromStorage();
        if (savedCode && ACCESS_CODES[savedCode]) {
            completeLogin(savedCode, ACCESS_CODES[savedCode], { skipSave: true });
        } else {
            showLoginScreen();
        }
    } catch (err) {
        showLoadingError();
    }
}

function showLoadingError() {
    const container = document.getElementById('silosContainer');
    if (container) {
        container.innerHTML = '<div class="load-error">Nepodarilo se nacist data. Zkontroluj data/snapshot.csv a data/history.csv</div>';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadMapConfig();
    const locations = ['melkovice', 'stranecka', 'brniste'];
    const snapshotRequests = locations.map(loc => fetch(`data/${loc}/snapshot.csv`).then(r => r.text()));
    const historyRequests = locations.map(loc => fetch(`data/${loc}/history.csv`).then(r => r.text()));

    Promise.all(snapshotRequests).then((snapshots) => {
        const snapshotRows = snapshots.flatMap(text => parseCsv(text));
        initApp(snapshotRows, []);

        Promise.all(historyRequests).then((histories) => {
            const historyRows = USE_SYNTHETIC_HISTORY
                ? buildSyntheticHistoryRows(snapshotRows)
                : histories.flatMap(text => parseCsv(text));
            initApp(snapshotRows, historyRows);
        }).catch(() => {
            // keep snapshot-only view if history fails
        });
    }).catch(() => {
        showLoadingError();
    });
});

