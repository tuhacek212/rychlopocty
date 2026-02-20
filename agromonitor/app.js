// AgroMonitor - Demo version loading from CSV
let currentLocation = '';
let currentEnterprise = '';
let modalPeriod = '1y';
let modalState = { open: false, type: 'overview', siloKey: '', siloName: '' };
let mapState = { open: false, locationId: '' };
const currentUserRole = 'MASTER';
const AUTH_STORAGE_KEY = 'agromonitor_access_v1';
const AUTH_LOCK_KEY = 'agromonitor_lock_v1';
const ACCESS_CODES = {
    '123456': { label: 'Admin', locations: ['melkovice', 'stranecka', 'brniste'], defaultLocation: 'melkovice' },
    '234567': { label: 'ZOD Brniště a.s.', locations: ['brniste'], defaultLocation: 'brniste' },
    '345678': { label: 'Agro Vysočina s.r.o.', locations: ['melkovice', 'stranecka'], defaultLocation: 'melkovice' }
};
const ADMIN_ACCESS_CODE = '123456';
const ADMIN_TEMP_MIN = 5;
const ADMIN_TEMP_MAX = 20;
const BAD_COOLING_MIN_TEMP = 20.5;
const DATA_FRESHNESS_LIMIT_MINUTES = 30;
const LOCATION_CAPACITY_M3 = {
    melkovice: { default: 1092 },
    stranecka: { default: 2746 },
    brniste: { large: 3324, small: 1603 }
};
const COMMODITY_DENSITY_T_PER_M3 = {
    psenice: 0.78,
    jecmen: 0.62,
    repka: 0.67,
    kukurice: 0.72,
    oves: 0.50,
    default: 0.75
};
const LOCATION_DISPLAY_NAMES = {
    melkovice: 'Mělkovice',
    stranecka: 'Stránecká Zhoř',
    brniste: 'Brniště'
};
const ENTERPRISE_DISPLAY_NAMES = {
    agro_vysocina: 'Agro Vysočina s.r.o.',
    agro_monitor: 'ZOD Brniště a.s.'
};
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
let docsRenderToken = 0;
const MAP_CONFIG = {
    melkovice: { image: 'Mělkovice.JPG', markers: [] },
    stranecka: { image: 'Stránecká Zhoř.JPG', markers: [] },
    brniste: { image: 'Brniště.JPG', markers: [] }
};
const MAP_CONFIG_URL = 'map-config.json';
const ONE_DRIVE_FOLDERS = {
    // `url` je odkaz na korenovou OneDrive slozku strediska.
    // Volitelne: `itemUrlTemplate` pro odkazy na konkretni soubory/slozky.
    // Priklad: 'https://contoso.sharepoint.com/.../{path}'
    melkovice: { url: 'https://onedrive.live.com/' },
    stranecka: { url: 'https://onedrive.live.com/' },
    brniste: { url: 'https://onedrive.live.com/' }
};

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
        const info = getLastUpdateInfo(locations[id].lastUpdateTs);
        const statusClass = info.isStale ? ' offline' : '';
        const statusLabel = info.isStale ? 'Offline' : 'Online';
        return `
            <button class="location-item ${isActive ? 'active' : ''}" type="button" data-location="${id}">
                <span>${locations[id].name}</span>
                <span class="status-dot${statusClass}" aria-label="${statusLabel}" title="${statusLabel}"></span>
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
        return { text: 'Data: neznámý čas', isStale: true, minutes: null };
    }
    const diffMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diffMs / 60000);
    let text = '';
    if (minutes <= 0) text = 'Data: právě aktuální';
    else if (minutes === 1) text = 'Data: 1 minuta stará';
    else text = `Data: ${minutes} minut stará`;
    return { text, isStale: minutes >= DATA_FRESHNESS_LIMIT_MINUTES, minutes };
}

function getLocationDisplayName(locationId, fallbackName) {
    return LOCATION_DISPLAY_NAMES[locationId] || fallbackName || locationId;
}

function getEnterpriseDisplayName(enterpriseId, fallbackName) {
    return ENTERPRISE_DISPLAY_NAMES[enterpriseId] || fallbackName || enterpriseId;
}

function normalizeCommodityName(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getCommodityDensityTPerM3(commodity) {
    const normalized = normalizeCommodityName(commodity);
    if (normalized.includes('psenice')) return COMMODITY_DENSITY_T_PER_M3.psenice;
    if (normalized.includes('jecmen')) return COMMODITY_DENSITY_T_PER_M3.jecmen;
    if (normalized.includes('repka')) return COMMODITY_DENSITY_T_PER_M3.repka;
    if (normalized.includes('kukurice')) return COMMODITY_DENSITY_T_PER_M3.kukurice;
    if (normalized.includes('oves')) return COMMODITY_DENSITY_T_PER_M3.oves;
    return COMMODITY_DENSITY_T_PER_M3.default;
}

function resolveSiloCapacityM3(locationId, silo) {
    const config = LOCATION_CAPACITY_M3[locationId];
    if (!config) return 0;
    if (Number.isFinite(config.default)) return config.default;

    if (locationId === 'brniste') {
        const siloIdNum = Number.parseInt(silo.id, 10);
        if (Number.isFinite(siloIdNum)) {
            return siloIdNum <= 2 ? config.large : config.small;
        }
        return silo.thermometers >= 3 ? config.large : config.small;
    }

    return 0;
}

function formatTons(value) {
    const floored = Math.max(0, Math.floor(Number(value) || 0));
    return `${floored} t`;
}

function buildSiloCapacityEstimate(silo, locationId) {
    const capacityM3 = resolveSiloCapacityM3(locationId, silo);
    if (!Number.isFinite(capacityM3) || capacityM3 <= 0) return null;

    const density = getCommodityDensityTPerM3(silo.commodity);
    const safeLevel = clamp(Number(silo.level) || 0, 0, 100) / 100;
    const filledM3 = capacityM3 * safeLevel;
    const remainingM3 = Math.max(0, capacityM3 - filledM3);
    const totalTons = capacityM3 * density;
    const filledTons = totalTons * safeLevel;
    const remainingTons = Math.max(0, totalTons - filledTons);

    return {
        capacityM3,
        filledM3,
        remainingM3,
        density,
        totalTons,
        filledTons,
        remainingTons
    };
}

function getSiloContextByKey(siloKey) {
    const parts = String(siloKey || '').split(':');
    if (parts.length < 2) return null;
    const locationId = parts[0];
    const siloId = parts[1];
    const location = locations[locationId];
    if (!location || !location.siloMap) return null;
    const silo = location.siloMap[siloId];
    if (!silo) return null;
    return { locationId, siloId, location, silo };
}

function formatDensity(value) {
    return `${(Number(value) || 0).toFixed(2)} t/m3`;
}

function formatAgeMinutes(minutes) {
    if (!Number.isFinite(minutes)) return 'neznámý čas';
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
                title: `Středisko ${location.name} je offline`,
                detail: `Poslední data před ${formatAgeMinutes(minutes)}.`
            });
        }

        if (location.hasCleanser) {
            const airflow = Math.round(location.cleanserAirflow || 0);
            if (airflow < 20 || airflow > 70) {
                alerts.push({
                    severity: 'danger',
                    title: `Čistička mimo hodnoty - ${location.name}`,
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
                    detail: `Středisko ${location.name}, senzor hlásí extrémní hodnotu.`
                });
                return;
            }

            if (max > ADMIN_TEMP_MAX || min < ADMIN_TEMP_MIN) {
                alerts.push({
                    severity: 'warning',
                    title: `Silo ${silo.name} - teploty mimo standard`,
                    detail: `Středisko ${location.name}, rozsah ${min.toFixed(1)} - ${max.toFixed(1)} C.`
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
            aria-label="Historie ventilátorů"
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
            aria-label="Historie naplnění sila"
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
    const filtered = filterSeriesForPeriod(series, period);
    return aggregateTempSeriesByDay(filtered);
}

function getFanSeriesForSilo(siloKey, period, maxPoints) {
    const series = fanSeries[siloKey] || [];
    const filtered = filterSeriesForPeriod(series, period);
    return aggregateValueSeriesByDay(filtered);
}

function getLevelSeriesForSilo(siloKey, period, maxPoints) {
    const series = levelSeries[siloKey] || [];
    const filtered = filterSeriesForPeriod(series, period);
    return aggregateValueSeriesByDay(filtered);
}

function getVentBands(siloKey, period) {
    const filtered = getFanSeriesForSilo(siloKey, period);
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
            current.end = next ? next.t : point.t + MS_PER_DAY;
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
    const series = getSeriesForSilo(siloKey, '1y', 90);
    const bands = getVentBands(siloKey, '1y');
    const chartHtml = buildTempChartSvg(series, { cssClass: 'history-chart', showAxes: false, padding: 10, bands, periodDays: 365 });
    const fanSeriesSmall = getFanSeriesForSilo(siloKey, '1y', 60);
    const fanChart = buildFanChartSvg(fanSeriesSmall, { cssClass: 'fan-chart', showAxes: false, height: 90, padding: 10, periodDays: 365 });
    const capacityEstimate = buildSiloCapacityEstimate(silo, locationId);
    const capacityHTML = capacityEstimate
        ? `
            <div class="silo-capacity-estimate" title="Odhad podle objemové hmotnosti ${capacityEstimate.density.toFixed(2)} t/m3">
                <div class="capacity-metric">
                    <span class="capacity-label">Kapacita</span>
                    <span class="capacity-value">${formatTons(capacityEstimate.totalTons)}</span>
                </div>
                <div class="capacity-metric">
                    <span class="capacity-label">Naskladněno</span>
                    <span class="capacity-value">${formatTons(capacityEstimate.filledTons)}</span>
                </div>
                <div class="capacity-metric">
                    <span class="capacity-label">Zbyva</span>
                    <span class="capacity-value">${formatTons(capacityEstimate.remainingTons)}</span>
                </div>
            </div>
        `
        : '';

    return `
        <div class="silo-card">
            <div class="silo-header">
                <div class="silo-name">${silo.name}</div>
                <div class="silo-commodity">${silo.commodity}</div>
            </div>
            ${capacityHTML}

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
                <div class="temp-label">Ventilátory</div>
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
                <div class="silo-name">Čistička</div>
            </div>
            <div class="cleanser-body">
                <div class="cleanser-gauge ${airflowOk ? '' : 'gauge-danger'}">
                    <svg viewBox="0 0 120 120" class="gauge-svg" role="img" aria-label="Čistička - prutok vzduchu ${safeAirflow}%">
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

function resolveOneDriveItemUrl(locationId, itemPath, item) {
    if (item && item.oneDriveUrl) return item.oneDriveUrl;
    const config = ONE_DRIVE_FOLDERS[locationId] || {};
    if (config.itemUrlTemplate) {
        return config.itemUrlTemplate.replace('{path}', encodeURIComponent(itemPath));
    }
    return config.url || '';
}

function renderOneDriveTree(locationId, items, depth = 0, parentPath = '') {
    if (!items || !items.length) {
        return depth === 0
            ? '<div class="docs-empty">Složka je prázdná.</div>'
            : '';
    }

    const html = items.map(item => {
        const rawName = item.name || 'Bez názvu';
        const safeName = escapeHtml(rawName);
        const itemPath = parentPath ? `${parentPath}/${rawName}` : rawName;
        const itemUrl = resolveOneDriveItemUrl(locationId, itemPath, item);
        if (item.type === 'folder') {
            const childHtml = renderOneDriveTree(locationId, item.items || [], depth + 1, itemPath);
            const folderAction = itemUrl
                ? `<a class="doc-node-action onedrive-link" href="${escapeHtml(itemUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">OneDrive</a>`
                : '';
            return `
                <details class="doc-node folder depth-${depth}">
                    <summary class="doc-node-row doc-summary"><span class="doc-summary-main"><span class="doc-icon">SLOZKA</span><span class="doc-name">${safeName}</span></span>${folderAction}</summary>
                    <div class="doc-children">${childHtml}</div>
                </details>
            `;
        }

        const downloadUrl = appendDownloadParam(itemUrl);
        if (downloadUrl) {
            return `
                <a class="doc-node file depth-${depth} doc-file-link onedrive-link" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">
                    <div class="doc-node-row"><span class="doc-icon">SOUBOR</span><span class="doc-name">${safeName}</span><span class="doc-node-action">Stahnout</span></div>
                </a>
            `;
        }

        return `
            <div class="doc-node file depth-${depth}">
                <div class="doc-node-row"><span class="doc-icon">SOUBOR</span><span class="doc-name">${safeName}</span></div>
            </div>
        `;
    }).join('');

    return `<div class="doc-tree depth-${depth}">${html}</div>`;
}

async function renderDocuments(locationId) {
    const container = document.getElementById('docsEntries');
    if (!container) return;

    const token = ++docsRenderToken;
    const folder = ONE_DRIVE_FOLDERS[locationId] || {};
    const openButton = folder.url
        ? `<a class="doc-link onedrive-link" href="${folder.url}" target="_blank" rel="noopener noreferrer"><span class="doc-link-label">Otevřít složku střediska v OneDrive</span><span class="doc-link-arrow">Microsoft</span></a>`
        : '<div class="docs-empty">OneDrive složka pro toto středisko zatím není nastavena.</div>';

    container.innerHTML = `${openButton}<div class="docs-loading">Načítám ukázkovou strukturu...</div>`;

    try {
        const response = await fetch(`data/${locationId}/Onedrive/structure.json`);
        if (!response.ok) {
            throw new Error('Structure file missing');
        }

        const structure = await response.json();
        if (token !== docsRenderToken) return;

        const items = Array.isArray(structure.items) ? structure.items : [];
        container.innerHTML = `${openButton}${renderOneDriveTree(locationId, items)}`;
    } catch {
        if (token !== docsRenderToken) return;
        container.innerHTML = `${openButton}<div class="docs-empty">Ukázková struktura není k dispozici.</div>`;
    }
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
    const updateInfo = getLastUpdateInfo(location.lastUpdateTs);
    if (lastUpdateLabel) {
        lastUpdateLabel.textContent = updateInfo.text;
        lastUpdateLabel.classList.toggle('is-stale', updateInfo.isStale);
    }

    const isOnline = !updateInfo.isStale;
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

    renderDocuments(locationKey);

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
        error.textContent = `Přihlášení je dočasně blokované. Zkuste to za ${minutes} min.`;
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
    const tempPointSeen = new Set();
    const siloDepthByKey = {};
    const shallowestDepthByKey = {};
    const fanSeriesBuckets = {};
    const levelBuckets = {};

    const locationMeta = {
        melkovice: { hasCleanser: false, hasDryer: false, dataAgeMinutes: 20 },
        stranecka: { hasCleanser: true, cleanserAirflow: 40, hasDryer: false, dataAgeMinutes: 263 },
        brniste: { hasCleanser: true, cleanserAirflow: 100, hasDryer: true, dataAgeMinutes: 20 },
    };

    const commodities = [
        'Pšenice potravinářská',
        'Pšenice krmná',
        'Ječmen jarní',
        'Řepka',
        'Kukuřice',
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
        const entName = getEnterpriseDisplayName(entId, row.enterprise_name);
        if (!enterprises[entId]) {
            enterprises[entId] = { name: entName, locations: [] };
        }

        const locId = row.location_id;
        const locName = getLocationDisplayName(locId, row.location_name);
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
                    { time: '16:23', message: 'Silo 4 - Ventilátor 1 aktivovan' },
                    { time: '14:15', message: 'Silo 2 - Kontrola teploty OK' },
                    { time: '12:40', message: 'Systém připojen' },
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
        if (!Number.isFinite(shallowestDepthByKey[siloKey]) || depth < shallowestDepthByKey[siloKey]) {
            shallowestDepthByKey[siloKey] = depth;
        }
        silo.sensorsPerThermometer = Math.max(silo.sensorsPerThermometer, silo.sensorIdsByThermometer[thermId].length);
        silo.thermometers = Math.max(silo.thermometers, silo.thermometerIds.length);

        if (fanId) {
            if (!silo.fanMap[fanId]) {
                silo.fanMap[fanId] = { name: `Ventilátor ${fanId.replace('F', '')}`, running: false, history: [] };
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
        const shallowestDepth = shallowestDepthByKey[key];
        const isFallbackActive = levelPct > 0 && Number.isFinite(shallowestDepth) && depth <= shallowestDepth + 1e-9;
        const includeForTemp = isActive || isFallbackActive;

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

        if (!includeForTemp) {
            return;
        }

        const sensorId = row.sensor_id || '';
        const tempPointKey = `${key}|${ts}|${thermId}|${sensorId}`;
        if (tempPointSeen.has(tempPointKey)) {
            return;
        }
        tempPointSeen.add(tempPointKey);

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

    // Ensure modal history reflects current snapshot values too (history.csv can lag behind).
    snapshotRows.forEach(row => {
        const locId = row.location_id;
        const siloId = row.silo_id;
        const key = `${locId}:${siloId}`;
        const thermId = row.thermometer_id;
        const thermKey = `${locId}:${siloId}:${thermId}`;
        const sensorId = row.sensor_id || '';
        let temp = parseFloat(row.temp_c || '0');
        if (faultySet.has(thermKey)) {
            temp = 255;
        }
        const ts = Date.parse(row.timestamp);
        if (!Number.isFinite(ts)) return;
        const depth = parseFloat(row.depth_m || '0');
        const levelPct = parseFloat(row.level_pct || '0');
        const maxDepth = Math.max(siloDepthByKey[key] || 0, depth);
        const levelMeters = (levelPct / 100) * maxDepth;
        const isActive = depth <= levelMeters;
        const shallowestDepth = shallowestDepthByKey[key];
        const isFallbackActive = levelPct > 0 && Number.isFinite(shallowestDepth) && depth <= shallowestDepth + 1e-9;
        const includeForTemp = isActive || isFallbackActive;

        if (!levelBuckets[key]) levelBuckets[key] = {};
        if (!levelBuckets[key][ts]) {
            levelBuckets[key][ts] = levelPct;
        }

        const fanId = row.fan_id;
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

        if (!includeForTemp) return;

        const tempPointKey = `${key}|${ts}|${thermId}|${sensorId}`;
        if (tempPointSeen.has(tempPointKey)) return;
        tempPointSeen.add(tempPointKey);

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
        modalState = { open: false, type: 'overview', siloKey: '', siloName: '' };
        updateBodyModalLock();
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

function openSiloDetailFromMap(marker, locationId) {
    if (!marker || !locationId) return;
    const siloKey = `${locationId}:${marker.siloId}`;
    closeMapModal();
    openModal('overview', siloKey, marker.name || `Silo ${marker.siloId}`);
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
        legend.innerHTML = '<div class="map-help">Středisko není dostupné.</div>';
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
    mapImage.alt = `Mapa areálu - ${location.name}`;
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
        legend.innerHTML = '<div class="map-help">Žádné dostupné silo pro mapu.</div>';
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
    const helpText = canEdit
        ? 'Admin: marker lze posouvat tažením. Klik otevře detail sila.'
        : 'Klikněte na silo pro otevření detailu.';
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
        <div
            class="map-marker-label"
            style="--x:${marker.x}%; --y:${marker.y}%;"
            aria-hidden="true">${marker.name}</div>
    `).join('');

    legend.innerHTML = markers.map(marker => `
        <div class="map-legend-item" data-id="${marker.id}" role="button" tabindex="0">
            <div class="map-legend-marker"></div>
            <span>${marker.name}</span>
        </div>
    `).join('');

    overlay.querySelectorAll('.map-marker').forEach(marker => {
        const markerId = marker.getAttribute('data-id');
        const markerData = markers.find(item => String(item.id) === String(markerId));
        marker.addEventListener('click', () => {
            setActiveMapMarker(markerId);
            openSiloDetailFromMap(markerData, locationId);
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
        const markerId = item.getAttribute('data-id');
        const markerData = markers.find(marker => String(marker.id) === String(markerId));
        item.addEventListener('click', () => {
            setActiveMapMarker(markerId);
            openSiloDetailFromMap(markerData, locationId);
        });
        item.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveMapMarker(markerId);
                openSiloDetailFromMap(markerData, locationId);
            }
        });
    });

}

function openMapModal(locationId) {
    const modal = document.getElementById('mapModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    mapState = { open: true, locationId };
    updateBodyModalLock();
    loadMapConfig().then(() => {
        renderMap(locationId);
    });
}

function buildOverviewChartSvg(tempSeries, fanSeriesData, levelSeriesData, options = {}) {
    const width = options.width || 760;
    const height = options.height || 220;
    const leftPad = options.leftPad || 56;
    const rightPad = options.rightPad || 64;
    const topPad = options.topPad || 30;
    const bottomPad = options.bottomPad || 32;
    const periodDays = options.periodDays || 365;

    const hasTemp = Array.isArray(tempSeries) && tempSeries.length > 1;
    const hasFan = Array.isArray(fanSeriesData) && fanSeriesData.length > 1;
    const hasLevel = Array.isArray(levelSeriesData) && levelSeriesData.length > 1;
    if (!hasTemp && !hasFan && !hasLevel) {
        return '<div class="chart-empty">Není k dispozici historie</div>';
    }

    const allTimes = []
        .concat((tempSeries || []).map(p => p.t))
        .concat((fanSeriesData || []).map(p => p.t))
        .concat((levelSeriesData || []).map(p => p.t))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const tMax = allTimes.length ? allTimes[allTimes.length - 1] : Date.now();
    const tMin = tMax - periodDays * MS_PER_DAY;

    const tempMin = 0;
    const tempMax = 30;
    const tempRange = tempMax - tempMin;

    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;
    const scaleX = (t) => leftPad + ((t - tMin) / Math.max(1, tMax - tMin)) * plotWidth;
    const scaleTempY = (value) => topPad + (1 - ((value - tempMin) / tempRange)) * plotHeight;
    const scalePctY = (value) => topPad + (1 - (clamp(value, 0, 100) / 100)) * plotHeight;

    const inRange = (t) => t >= tMin && t <= tMax;
    const tempInRange = (tempSeries || []).filter(p => inRange(p.t));
    const fanInRange = (fanSeriesData || []).filter(p => inRange(p.t));
    const levelInRange = (levelSeriesData || []).filter(p => inRange(p.t));

    const tempAvgSeries = tempInRange.map(p => ({
        t: p.t,
        x: scaleX(p.t),
        y: scaleTempY(p.avg)
    }));
    const tempMinSeries = tempInRange.map(p => ({
        t: p.t,
        x: scaleX(p.t),
        y: scaleTempY(p.min)
    }));
    const tempMinYByTime = new Map(tempMinSeries.map(p => [p.t, p.y]));
    const pointsTempAvg = tempAvgSeries.map(p => `${p.x},${p.y}`).join(' ');
    const pointsTempMin = tempInRange.map(p => `${scaleX(p.t)},${scaleTempY(p.min)}`).join(' ');
    const pointsTempMax = tempInRange.map(p => `${scaleX(p.t)},${scaleTempY(p.max)}`).join(' ');
    const smoothFanSeries = fanInRange.map((point, index, arr) => {
        const from = Math.max(0, index - 2);
        const to = Math.min(arr.length - 1, index + 2);
        let sum = 0;
        let count = 0;
        for (let i = from; i <= to; i++) {
            sum += arr[i].value;
            count += 1;
        }
        return { t: point.t, value: sum / Math.max(1, count) };
    });
    const firstTempT = tempMinSeries.length ? tempMinSeries[0].t : 0;
    const lastTempT = tempMinSeries.length ? tempMinSeries[tempMinSeries.length - 1].t : 0;
    const getVentAnchorY = (t) => {
        if (t < firstTempT || t > lastTempT) return null;
        if (tempMinYByTime.has(t)) return tempMinYByTime.get(t);

        for (let i = 0; i < tempMinSeries.length - 1; i++) {
            const a = tempMinSeries[i];
            const b = tempMinSeries[i + 1];
            if (t >= a.t && t <= b.t) {
                const ratio = (t - a.t) / Math.max(1, b.t - a.t);
                return a.y + (b.y - a.y) * ratio;
            }
        }
        return null;
    };
    const fanAreaSegments = smoothFanSeries.length && tempMinSeries.length
        ? (() => {
            const baseY = height - bottomPad;
            const threshold = 1;
            const ventilatingSegments = [];
            let current = [];

            smoothFanSeries.forEach(point => {
                const y = getVentAnchorY(point.t);
                const isOn = point.value > threshold && Number.isFinite(y);
                if (isOn) {
                    current.push({
                        t: point.t,
                        x: scaleX(point.t),
                        y,
                        value: point.value
                    });
                } else if (current.length) {
                    ventilatingSegments.push(current);
                    current = [];
                }
            });
            if (current.length) ventilatingSegments.push(current);

            let shapes = '';
            ventilatingSegments.forEach(segment => {
                if (!segment.length) return;

                const avgValue = segment.reduce((sum, p) => sum + p.value, 0) / segment.length;
                const opacity = 0.14 + clamp(avgValue / 100, 0, 1) * 0.30;

                if (segment.length === 1) {
                    const x1 = Math.max(leftPad, segment[0].x - 2);
                    const x2 = Math.min(width - rightPad, segment[0].x + 2);
                    const y = segment[0].y;
                    const d = `M ${x1} ${baseY} L ${x1} ${y} L ${x2} ${y} L ${x2} ${baseY} Z`;
                    shapes += `<path class="overview-fan-band" data-series="fan" d="${d}" style="opacity:${opacity.toFixed(3)}" />`;
                    return;
                }

                const top = segment.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const bottom = segment.slice().reverse().map(p => `L ${p.x} ${baseY}`).join(' ');
                const d = `${top} ${bottom} Z`;
                shapes += `<path class="overview-fan-band" data-series="fan" d="${d}" style="opacity:${opacity.toFixed(3)}" />`;
            });
            return shapes;
        })()
        : '';
    const pointsLevel = levelInRange.map(p => `${scaleX(p.t)},${scalePctY(p.value)}`).join(' ');

    let yAxisLeft = '';
    const leftTicks = 4;
    for (let i = 0; i <= leftTicks; i++) {
        const val = tempMin + (tempRange / leftTicks) * i;
        const y = scaleTempY(val);
        yAxisLeft += `<line class="chart-tick" x1="${leftPad}" x2="${width - rightPad}" y1="${y}" y2="${y}" />`;
        yAxisLeft += `<text class="chart-label" x="${leftPad - 8}" y="${y + 3}" text-anchor="end">${val.toFixed(1)}°C</text>`;
    }

    let yAxisRight = '';
    [0, 25, 50, 75, 100].forEach(val => {
        const y = scalePctY(val);
        yAxisRight += `<text class="chart-label" x="${width - 8}" y="${y + 3}" text-anchor="end">${val}%</text>`;
    });

    const xAxis = buildMonthAxis(tMin, tMax, scaleX, leftPad, height, width - rightPad);
    const encodeSeries = (arr, pickValue) => arr.map(p => `${p.t}:${pickValue(p).toFixed(2)}`).join('|');
    const encodedTempAvg = encodeSeries(tempInRange, p => p.avg);
    const encodedFan = encodeSeries(fanInRange, p => p.value);
    const encodedLevel = encodeSeries(levelInRange, p => p.value);

    return `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
            class="overview-chart chart-interactive"
            role="img"
            aria-label="Souhrnný graf sila"
            data-chart="time"
            data-t-min="${tMin}"
            data-t-max="${tMax}"
            data-width="${width}"
            data-height="${height}"
            data-padding="${leftPad}"
            data-overview-temp="${encodedTempAvg}"
            data-overview-fan="${encodedFan}"
            data-overview-level="${encodedLevel}">
            <line class="chart-axis" x1="${leftPad}" x2="${leftPad}" y1="${topPad}" y2="${height - bottomPad}" />
            <line class="chart-axis" x1="${width - rightPad}" x2="${width - rightPad}" y1="${topPad}" y2="${height - bottomPad}" />
            <line class="chart-axis" x1="${leftPad}" x2="${width - rightPad}" y1="${height - bottomPad}" y2="${height - bottomPad}" />
            <text class="chart-label" x="${leftPad}" y="${topPad - 10}" text-anchor="start">Teplota (°C)</text>
            <text class="chart-label" x="${width - rightPad}" y="${topPad - 10}" text-anchor="end">Ventilátory / Naplnění (%)</text>
            ${yAxisLeft}
            ${yAxisRight}
            ${xAxis}

            <polyline class="overview-line overview-temp-min" data-series="tempMin" points="${pointsTempMin}" />
            <polyline class="overview-line overview-temp-max" data-series="tempMax" points="${pointsTempMax}" />
            <polyline class="overview-line overview-temp-avg" data-series="tempAvg" points="${pointsTempAvg}" />
            ${fanAreaSegments}
            <polyline class="overview-line overview-level" data-series="level" points="${pointsLevel}" />

            <rect class="chart-hover-capture" x="${leftPad}" y="${topPad}" width="${plotWidth}" height="${plotHeight}" />
            <line class="chart-hover-line" x1="${leftPad}" x2="${leftPad}" y1="${topPad}" y2="${height - bottomPad}" visibility="hidden" />
            <text class="chart-hover-label" x="${leftPad}" y="${topPad + 12}" text-anchor="start" visibility="hidden"></text>
            <g class="overview-tooltip" visibility="hidden">
                <rect class="overview-tooltip-bg" x="0" y="0" width="168" height="48" rx="8" ry="8"></rect>
                <text class="overview-tooltip-text overview-tooltip-date" x="8" y="15">Datum</text>
                <text class="overview-tooltip-text overview-tooltip-line1" x="8" y="30">Teplota: -</text>
                <text class="overview-tooltip-text overview-tooltip-line3" x="8" y="44">Naplnění: -</text>
            </g>
        </svg>
    `;
}

function setupOverviewChartToggles() {
    const groups = document.querySelectorAll('.overview-toggle-group');
    groups.forEach(group => {
        const chart = group.closest('.overview-section')?.querySelector('.overview-chart');
        if (!chart) return;
        const toggles = group.querySelectorAll('input[type="checkbox"][data-series]');
        const syncSeriesVisibility = (toggle) => {
            const key = toggle.getAttribute('data-series');
            const visible = toggle.checked;
            chart.querySelectorAll(`[data-series="${key}"]`).forEach(line => {
                line.classList.toggle('hidden-series', !visible);
            });
        };
        toggles.forEach(toggle => {
            // Apply initial checkbox state right after modal render.
            syncSeriesVisibility(toggle);
            toggle.addEventListener('change', () => {
                syncSeriesVisibility(toggle);
            });
        });
    });
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    mapState = { open: false, locationId: '' };
    updateBodyModalLock();
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
            openModal('overview', siloKey, siloName);
        });
    });

    fanSections.forEach(section => {
        section.addEventListener('click', () => {
            const siloKey = section.getAttribute('data-silo-key');
            const siloName = section.getAttribute('data-silo-name');
            openModal('overview', siloKey, siloName);
        });
    });

    levelDisplays.forEach(display => {
        display.addEventListener('click', () => {
            const siloKey = display.getAttribute('data-silo-key');
            const siloName = display.getAttribute('data-silo-name');
            openModal('overview', siloKey, siloName);
        });
    });
}

function parseEncodedSeries(encoded) {
    if (!encoded) return [];
    return encoded.split('|').map(chunk => {
        const idx = chunk.indexOf(':');
        if (idx <= 0) return null;
        const t = parseInt(chunk.slice(0, idx), 10);
        const v = parseFloat(chunk.slice(idx + 1));
        if (!Number.isFinite(t) || !Number.isFinite(v)) return null;
        return { t, v };
    }).filter(Boolean);
}

function getNearestSeriesValue(series, t) {
    if (!series || !series.length) return null;
    let lo = 0;
    let hi = series.length - 1;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (series[mid].t < t) lo = mid + 1;
        else hi = mid;
    }
    const right = series[lo];
    const left = lo > 0 ? series[lo - 1] : right;
    return Math.abs(right.t - t) < Math.abs(left.t - t) ? right.v : left.v;
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
            const year = d.getFullYear();
            return `${day}.${month}.${year}`;
        };

        const isOverview = svg.classList.contains('overview-chart');
        let overviewTemp = [];
        let overviewFan = [];
        let overviewLevel = [];
        let tooltipGroup = null;
        let tooltipDate = null;
        let tooltipL1 = null;
        let tooltipL3 = null;
        let tooltipBg = null;
        const tooltipWidth = 168;
        const tooltipHeight = 48;
        if (isOverview) {
            overviewTemp = parseEncodedSeries(svg.getAttribute('data-overview-temp'));
            overviewFan = parseEncodedSeries(svg.getAttribute('data-overview-fan'));
            overviewLevel = parseEncodedSeries(svg.getAttribute('data-overview-level'));
            tooltipGroup = svg.querySelector('.overview-tooltip');
            tooltipDate = svg.querySelector('.overview-tooltip-date');
            tooltipL1 = svg.querySelector('.overview-tooltip-line1');
            tooltipL3 = svg.querySelector('.overview-tooltip-line3');
            tooltipBg = svg.querySelector('.overview-tooltip-bg');
        }

        const update = (evt) => {
            const pt = svg.createSVGPoint();
            pt.x = evt.clientX;
            pt.y = evt.clientY;
            const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
            const rawX = clamp(cursor.x, padding, width - padding);
            const ratio = (rawX - padding) / Math.max(1, (width - padding * 2));
            const rawT = tMin + ratio * (tMax - tMin);
            const snappedT = clamp(getUtcDayStart(rawT), tMin, tMax);
            const snappedRatio = (snappedT - tMin) / Math.max(1, (tMax - tMin));
            const x = padding + snappedRatio * (width - padding * 2);

            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('visibility', 'visible');

            if (isOverview) {
                label.setAttribute('visibility', 'hidden');
            } else {
                label.textContent = toDateLabel(snappedT);
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
            }

            if (isOverview && tooltipGroup && tooltipDate && tooltipL1 && tooltipL3 && tooltipBg) {
                const tempVal = getNearestSeriesValue(overviewTemp, snappedT);
                const levelVal = getNearestSeriesValue(overviewLevel, snappedT);

                tooltipDate.textContent = toDateLabel(snappedT);
                tooltipL1.textContent = `Teplota: ${Number.isFinite(tempVal) ? tempVal.toFixed(1) + ' °C' : '-'}`;
                tooltipL3.textContent = `Naplnění: ${Number.isFinite(levelVal) ? levelVal.toFixed(0) + ' %' : '-'}`;

                const tx = x > width - padding - tooltipWidth - 8 ? x - tooltipWidth - 8 : x + 8;
                const ty = padding + 18;
                tooltipBg.setAttribute('x', tx);
                tooltipBg.setAttribute('y', ty);
                tooltipDate.setAttribute('x', tx + 8);
                tooltipDate.setAttribute('y', ty + 15);
                tooltipL1.setAttribute('x', tx + 8);
                tooltipL1.setAttribute('y', ty + 30);
                tooltipL3.setAttribute('x', tx + 8);
                tooltipL3.setAttribute('y', ty + 44);
                tooltipGroup.setAttribute('visibility', 'visible');
            }
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
            if (tooltipGroup) tooltipGroup.setAttribute('visibility', 'hidden');
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
    updateBodyModalLock();
    const buttons = modal.querySelectorAll('.history-btn');
    buttons.forEach(b => b.classList.remove('active'));
    const active = modal.querySelector(`.history-btn[data-period="${modalPeriod}"]`);
    if (active) active.classList.add('active');
    renderModalContent();
}

function updateBodyModalLock() {
    const detailModal = document.getElementById('detailModal');
    const mapModal = document.getElementById('mapModal');
    const detailOpen = detailModal && !detailModal.classList.contains('hidden');
    const mapOpen = mapModal && !mapModal.classList.contains('hidden');
    document.body.classList.toggle('modal-open', !!(detailOpen || mapOpen));
}

function renderModalContent() {
    if (!modalState.open) return;
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if (!modal || !title || !body) return;

    title.textContent = `Detail sila - ${modalState.siloName}`;

    const periodDays = modalPeriod === '1y' ? 365 : 30;
    const siloContext = getSiloContextByKey(modalState.siloKey);
    const estimate = siloContext ? buildSiloCapacityEstimate(siloContext.silo, siloContext.locationId) : null;

    const tempSeries = getSeriesForSilo(modalState.siloKey, modalPeriod, 200);
    const fanSeriesData = getFanSeriesForSilo(modalState.siloKey, modalPeriod, 200);
    const levelSeriesData = getLevelSeriesForSilo(modalState.siloKey, modalPeriod, 200);
    const overviewChart = buildOverviewChartSvg(tempSeries, fanSeriesData, levelSeriesData, {
        width: 760,
        height: 220,
        leftPad: 56,
        rightPad: 64,
        topPad: 30,
        bottomPad: 32,
        periodDays
    });

    const fanCount = siloContext && Array.isArray(siloContext.silo.fans) ? siloContext.silo.fans.length : 0;
    const runningFans = fanCount ? siloContext.silo.fans.filter(fan => fan.running).length : 0;
    const detailsHtml = estimate && siloContext
        ? `
            <div class="commodity-summary">
                <div class="commodity-summary-head">
                    <strong>${siloContext.silo.commodity} <span>(objemová hmotnost ${formatDensity(estimate.density)})</span></strong>
                    <span>${locations[siloContext.locationId]?.name || '-'}</span>
                </div>
                <div class="commodity-summary-grid">
                    <div class="commodity-item"><span>Kapacita v tunách</span><strong>${formatTons(estimate.totalTons)}</strong></div>
                    <div class="commodity-item"><span>Naskladněno</span><strong>${formatTons(estimate.filledTons)}</strong></div>
                    <div class="commodity-item"><span>Volný prostor</span><strong>${formatTons(estimate.remainingTons)}</strong></div>
                    <div class="commodity-item"><span>Ventilátory v provozu</span><strong>${runningFans}/${fanCount}</strong></div>
                    <div class="commodity-item"><span>Kapacita sila</span><strong>${Math.floor(estimate.capacityM3)} m3</strong></div>
                    <div class="commodity-item"><span>Volný objem</span><strong>${Math.floor(estimate.remainingM3)} m3</strong></div>
                </div>
            </div>
        `
        : '';

    body.innerHTML = `
        <div class="overview-section">
            ${overviewChart}
            <div class="overview-toggle-group" role="group" aria-label="Viditelné křivky">
                <label class="overview-toggle"><input type="checkbox" data-series="tempAvg" checked> Teplota průměr</label>
                <label class="overview-toggle"><input type="checkbox" data-series="tempMin" checked> Teplota minimum</label>
                <label class="overview-toggle"><input type="checkbox" data-series="tempMax" checked> Teplota maximum</label>
                <label class="overview-toggle"><input type="checkbox" data-series="fan" checked> Ventilátory (%)</label>
                <label class="overview-toggle"><input type="checkbox" data-series="level" checked> Naplnění (%)</label>
            </div>
            <div class="overview-line-legend" aria-hidden="true">
                <span class="overview-legend-item"><span class="overview-swatch overview-swatch-temp-avg"></span>Teplota průměr</span>
                <span class="overview-legend-item"><span class="overview-swatch overview-swatch-temp-min"></span>Teplota min</span>
                <span class="overview-legend-item"><span class="overview-swatch overview-swatch-temp-max"></span>Teplota max</span>
                <span class="overview-legend-item"><span class="overview-swatch overview-swatch-fan"></span>Ventilátory</span>
                <span class="overview-legend-item"><span class="overview-swatch overview-swatch-level"></span>Naplnění</span>
            </div>
            ${detailsHtml}
            <div class="modal-legend">
                <div><strong>Levá osa</strong> = teplota (°C), <strong>pravá osa</strong> = ventilátory/naplnění (%)</div>
                <div>Kliknutím na zaškrtávátka nahoře můžeš jednotlivé křivky skrýt nebo zobrazit.</div>
            </div>
        </div>
    `;
    setupOverviewChartToggles();
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
    const dataVersion = '20260220_histfix1';
    const snapshotRequests = locations.map(loc =>
        fetch(`data/${loc}/snapshot.csv?v=${dataVersion}`).then(r => {
            if (!r.ok) throw new Error(`snapshot ${loc} ${r.status}`);
            return r.text();
        })
    );
    const historyRequests = locations.map(loc =>
        fetch(`data/${loc}/history.csv?v=${dataVersion}`).then(r => {
            if (!r.ok) throw new Error(`history ${loc} ${r.status}`);
            return r.text();
        })
    );

    Promise.all(snapshotRequests).then((snapshots) => {
        const snapshotRows = snapshots.flatMap(text => parseCsv(text));
        const validSnapshotRows = snapshotRows.filter(r => r.location_id && r.enterprise_id && r.silo_id);
        if (!validSnapshotRows.length) {
            showLoadingError();
            return;
        }
        initApp(validSnapshotRows, []);

        Promise.all(historyRequests).then((histories) => {
            const historyRows = USE_SYNTHETIC_HISTORY
                ? buildSyntheticHistoryRows(validSnapshotRows)
                : histories.flatMap(text => parseCsv(text));
            initApp(validSnapshotRows, historyRows);
        }).catch(() => {
            // keep snapshot-only view if history fails
        });
    }).catch(() => {
        showLoadingError();
    });
});



