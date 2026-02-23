// Enterprises, locations and structure/config data

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

function getLocationComputedDefaults(locationId) {
    const location = locations[locationId];
    const silos = Array.isArray(location?.silos) ? location.silos : [];
    const silosCount = silos.length;
    let thermometersPerSilo = 0;
    let sensorsPerThermometer = 0;
    silos.forEach(silo => {
        thermometersPerSilo = Math.max(thermometersPerSilo, toSafeInt(silo?.thermometers, 0, 0));
        sensorsPerThermometer = Math.max(sensorsPerThermometer, toSafeInt(silo?.sensorsPerThermometer, 0, 0));
    });
    const baseCapacity = LOCATION_CAPACITY_M3[locationId];
    const siloCapacityM3 = Number.isFinite(baseCapacity?.default) ? baseCapacity.default : 0;
    return {
        silosCount,
        thermometersPerSilo,
        sensorsPerThermometer,
        siloCapacityM3,
        hasCleanser: !!location?.hasCleanser,
        cleanserAirflow: toSafeInt(location?.cleanserAirflow, 0, 0),
        hasDryer: !!location?.hasDryer,
        dryerHeatingTemp: toSafeNumber(location?.dryerHeatingTemp, 0, 0),
        dryerDischargeMinutes: toSafeInt(location?.dryerDischargeMinutes, 0, 0)
    };
}

function normalizeLocationMachineConfig(input, fallbackLocationId = '') {
    const locationId = normalizeOrgId(
        input?.locationId || input?.location_id || fallbackLocationId,
        'location'
    );
    if (!locationId) return null;
    const defaults = getLocationComputedDefaults(locationId);
    const enterpriseFallback = locations[locationId]?.enterprise || '';
    const enterpriseRaw = String(input?.enterpriseId || input?.enterprise_id || enterpriseFallback || '').trim();
    return {
        locationId,
        enterpriseId: enterpriseRaw ? normalizeOrgId(enterpriseRaw, 'enterprise') : '',
        locationName: String(
            input?.locationName ||
            input?.location_name ||
            locations[locationId]?.name ||
            locationId
        ).trim(),
        silosCount: toSafeInt(input?.silosCount ?? input?.silos_count, defaults.silosCount, 0),
        thermometersPerSilo: toSafeInt(
            input?.thermometersPerSilo ?? input?.thermometers_per_silo,
            defaults.thermometersPerSilo,
            0
        ),
        sensorsPerThermometer: toSafeInt(
            input?.sensorsPerThermometer ?? input?.sensors_per_thermometer,
            defaults.sensorsPerThermometer,
            0
        ),
        siloCapacityM3: toSafeNumber(
            input?.siloCapacityM3 ?? input?.silo_capacity_m3,
            defaults.siloCapacityM3,
            0
        ),
        hasCleanser: parseBooleanFlag(input?.hasCleanser ?? input?.has_cleanser, defaults.hasCleanser),
        cleanserAirflow: toSafeInt(
            input?.cleanserAirflow ?? input?.cleanser_airflow,
            defaults.cleanserAirflow,
            0
        ),
        hasDryer: parseBooleanFlag(input?.hasDryer ?? input?.has_dryer, defaults.hasDryer),
        dryerHeatingTemp: toSafeNumber(
            input?.dryerHeatingTemp ?? input?.dryer_heating_temp,
            defaults.dryerHeatingTemp,
            0
        ),
        dryerDischargeMinutes: toSafeInt(
            input?.dryerDischargeMinutes ?? input?.dryer_discharge_minutes,
            defaults.dryerDischargeMinutes,
            0
        ),
        notes: String(input?.notes || '').trim().slice(0, 240)
    };
}

function saveLocationMachineConfigs() {
    localStorage.setItem(LOCATION_MACHINE_CONFIG_STORAGE_KEY, JSON.stringify(locationMachineConfigs));
}

function loadLocationMachineConfigs(csvText = '') {
    if (csvText && csvText.trim()) {
        const rows = parseCsv(csvText);
        const parsed = {};
        rows.forEach(row => {
            const normalized = normalizeLocationMachineConfig(row, row.location_id || '');
            if (!normalized) return;
            parsed[normalized.locationId] = normalized;
        });
        locationMachineConfigs = parsed;
        saveLocationMachineConfigs();
        return;
    }

    try {
        const raw = localStorage.getItem(LOCATION_MACHINE_CONFIG_STORAGE_KEY);
        if (!raw) {
            locationMachineConfigs = {};
            return;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            locationMachineConfigs = {};
            return;
        }
        const normalizedMap = {};
        Object.keys(parsed).forEach(key => {
            const normalized = normalizeLocationMachineConfig(parsed[key], key);
            if (!normalized) return;
            normalizedMap[normalized.locationId] = normalized;
        });
        locationMachineConfigs = normalizedMap;
    } catch {
        locationMachineConfigs = {};
    }
}

function ensureLocationMachineConfigsForKnownLocations() {
    let changed = false;
    Object.keys(locations).forEach(locId => {
        const normalized = normalizeLocationMachineConfig(
            {
                ...(locationMachineConfigs[locId] || {}),
                locationId: locId,
                enterpriseId: locationMachineConfigs[locId]?.enterpriseId || locations[locId]?.enterprise || '',
                locationName: locationMachineConfigs[locId]?.locationName || locations[locId]?.name || locId
            },
            locId
        );
        if (!normalized) return;
        const current = locationMachineConfigs[locId];
        if (!current || JSON.stringify(current) !== JSON.stringify(normalized)) {
            locationMachineConfigs[locId] = normalized;
            changed = true;
        }
    });
    if (changed) saveLocationMachineConfigs();
}

function ensureConfiguredSilosOnLocation(location, config) {
    if (!location || !config) return;
    if (!location.siloMap || typeof location.siloMap !== 'object') location.siloMap = {};
    if (!Array.isArray(location.silos)) location.silos = [];

    const requiredSilos = toSafeInt(config.silosCount, 0, 0);
    if (requiredSilos <= 0) return;

    const existingIds = new Set(
        Object.keys(location.siloMap)
            .map(id => String(id))
            .filter(Boolean)
    );
    const thermometersPerSilo = toSafeInt(config.thermometersPerSilo, 0, 0);
    const sensorsPerThermometer = toSafeInt(config.sensorsPerThermometer, 0, 0);

    const buildThermometerIds = () =>
        Array.from({ length: thermometersPerSilo }, (_, idx) => `T${idx + 1}`);
    const buildSensorIds = () =>
        Array.from({ length: sensorsPerThermometer }, (_, idx) => `C${idx + 1}`);

    let nextNumericId = 1;
    while (existingIds.has(String(nextNumericId))) nextNumericId += 1;

    while (existingIds.size < requiredSilos) {
        const siloId = String(nextNumericId);
        nextNumericId += 1;
        while (existingIds.has(String(nextNumericId))) nextNumericId += 1;

        const thermometerIds = buildThermometerIds();
        const sensorIds = buildSensorIds();
        const sensorIdsByThermometer = {};
        const temperatureData = {};
        thermometerIds.forEach(thermId => {
            sensorIdsByThermometer[thermId] = sensorIds.slice();
            temperatureData[thermId] = {};
            sensorIds.forEach((sensorId, sensorIdx) => {
                temperatureData[thermId][sensorId] = {
                    temperature: 0,
                    depth: (sensorIdx + 1) * 2
                };
            });
        });

        location.siloMap[siloId] = {
            id: siloId,
            name: `Silo ${siloId}`,
            level: 0,
            commodity: 'Nezadano',
            isVirtual: true,
            thermometers: thermometersPerSilo,
            sensorsPerThermometer,
            thermometerIds,
            sensorIdsByThermometer,
            temperatureData,
            depth: sensorsPerThermometer > 0 ? sensorsPerThermometer * 2 : 0,
            fans: [],
            fanMap: {}
        };
        existingIds.add(siloId);
    }

    location.silos = Object.values(location.siloMap).sort((a, b) => {
        const aNum = Number.parseInt(String(a.id), 10);
        const bNum = Number.parseInt(String(b.id), 10);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
        return String(a.id).localeCompare(String(b.id), 'cs-CZ');
    });
}

function applyLocationMachineConfigsToLocations() {
    Object.keys(locations).forEach(locId => {
        const location = locations[locId];
        if (!location) return;
        const config = locationMachineConfigs[locId];
        if (!config) return;
        location.machineConfig = { ...config };
        location.hasCleanser = !!config.hasCleanser;
        location.cleanserAirflow = toSafeInt(config.cleanserAirflow, 0, 0);
        location.hasDryer = !!config.hasDryer;
        location.dryerHeatingTemp = toSafeNumber(config.dryerHeatingTemp, 0, 0);
        location.dryerDischargeMinutes = toSafeInt(config.dryerDischargeMinutes, 0, 0);
        ensureConfiguredSilosOnLocation(location, config);
    });
}

function upsertLocationMachineConfig(configInput) {
    const normalized = normalizeLocationMachineConfig(configInput, configInput?.locationId || '');
    if (!normalized) return { ok: false };
    locationMachineConfigs[normalized.locationId] = normalized;
    saveLocationMachineConfigs();
    applyLocationMachineConfigsToLocations();
    return { ok: true, locationId: normalized.locationId };
}

function buildLocationMachineConfigCsv() {
    const header = [
        'location_id',
        'enterprise_id',
        'location_name',
        'silos_count',
        'thermometers_per_silo',
        'sensors_per_thermometer',
        'silo_capacity_m3',
        'has_cleanser',
        'cleanser_airflow',
        'has_dryer',
        'dryer_heating_temp',
        'dryer_discharge_minutes',
        'notes'
    ];
    const lines = [header.join(',')];
    Object.keys(locationMachineConfigs)
        .sort((a, b) => a.localeCompare(b, 'cs-CZ'))
        .forEach(locId => {
            const item = locationMachineConfigs[locId];
            const values = [
                item.locationId,
                item.enterpriseId,
                item.locationName,
                item.silosCount,
                item.thermometersPerSilo,
                item.sensorsPerThermometer,
                item.siloCapacityM3,
                item.hasCleanser ? 'true' : 'false',
                item.cleanserAirflow,
                item.hasDryer ? 'true' : 'false',
                item.dryerHeatingTemp,
                item.dryerDischargeMinutes,
                String(item.notes || '').replaceAll(',', ' ')
            ];
            lines.push(values.join(','));
        });
    return lines.join('\n');
}

function downloadLocationMachineConfigCsv() {
    const csv = '\uFEFF' + buildLocationMachineConfigCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'location-machine-config.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildLatestSnapshotFromHistory(historyRows) {
    const latestBySilo = {};

    historyRows.forEach(row => {
        if (!row.location_id || !row.silo_id) return;
        const ts = Date.parse(row.timestamp || '');
        if (!Number.isFinite(ts)) return;
        const key = `${row.location_id}:${row.silo_id}`;

        if (!latestBySilo[key] || ts > latestBySilo[key].ts) {
            latestBySilo[key] = { ts, rows: [row] };
            return;
        }
        if (ts === latestBySilo[key].ts) {
            latestBySilo[key].rows.push(row);
        }
    });

    return Object.values(latestBySilo).flatMap(entry => entry.rows);
}

function getAllowedLocationSet() {
    if (isAdminUser()) return null;
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
    if (!isAdminUser()) {
        keys = Object.keys(locations);
    } else if (!currentEnterprise || !enterprises[currentEnterprise]) {
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
    return { text, isStale: minutes >= adminThresholds.offlineMinutes, minutes };
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
    const locationConfig = locationMachineConfigs[locationId];
    const configuredCapacity = Number(locationConfig?.siloCapacityM3);
    if (Number.isFinite(configuredCapacity) && configuredCapacity > 0) {
        return configuredCapacity;
    }

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

function inferEnterpriseForLocations(locationIds) {
    if (!Array.isArray(locationIds) || !locationIds.length) return '';
    const enterpriseIds = Array.from(new Set(
        locationIds
            .map(locId => locations[locId]?.enterprise || '')
            .filter(Boolean)
    ));
    return enterpriseIds.length === 1 ? enterpriseIds[0] : '';
}

function normalizeOrgId(value, fallbackPrefix = 'item') {
    const raw = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (raw) return raw;
    return `${fallbackPrefix}_${Math.floor(Date.now() / 1000)}`;
}

function normalizeIco(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 8);
}

async function fetchAresEnterpriseByIco(ico) {
    const normalizedIco = normalizeIco(ico);
    if (!/^\d{8}$/.test(normalizedIco)) {
        return { ok: false, reason: 'invalid_ico' };
    }
    try {
        const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${normalizedIco}`, {
            cache: 'no-store'
        });
        if (!response.ok) {
            return { ok: false, reason: 'not_found' };
        }
        const data = await response.json();
        const name = String(data?.obchodniJmeno || '').trim();
        if (!name) {
            return { ok: false, reason: 'no_name' };
        }
        return { ok: true, ico: normalizedIco, name };
    } catch {
        return { ok: false, reason: 'network' };
    }
}

function makeUniqueOrgId(baseValue, fallbackPrefix, usedIds) {
    const used = usedIds instanceof Set ? usedIds : new Set();
    const base = normalizeOrgId(baseValue, fallbackPrefix);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
        candidate = `${base}_${suffix}`;
        suffix += 1;
    }
    return candidate;
}

function saveCustomOrgStructure() {
    localStorage.setItem(ORG_STRUCTURE_STORAGE_KEY, JSON.stringify(customOrgStructure));
}

function loadCustomOrgStructure() {
    try {
        const raw = localStorage.getItem(ORG_STRUCTURE_STORAGE_KEY);
        if (!raw) {
            customOrgStructure = { enterprises: [], locations: [], removedLocations: [] };
            return;
        }
        const parsed = JSON.parse(raw);
        const enterprisesList = Array.isArray(parsed?.enterprises) ? parsed.enterprises : [];
        const locationsList = Array.isArray(parsed?.locations) ? parsed.locations : [];
        const removedLocationsList = Array.isArray(parsed?.removedLocations) ? parsed.removedLocations : [];
        customOrgStructure = {
            enterprises: enterprisesList
                .map(item => ({
                    id: normalizeOrgId(item?.id, 'enterprise'),
                    name: String(item?.name || '').trim(),
                    ico: normalizeIco(item?.ico || '')
                }))
                .filter(item => item.id && item.name),
            locations: locationsList
                .map(item => ({
                    id: normalizeOrgId(item?.id, 'location'),
                    name: String(item?.name || '').trim(),
                    enterpriseId: normalizeOrgId(item?.enterpriseId, 'enterprise')
                }))
                .filter(item => item.id && item.name && item.enterpriseId),
            removedLocations: Array.from(new Set(
                removedLocationsList
                    .map(item => normalizeOrgId(item, 'location'))
                    .filter(Boolean)
            ))
        };
    } catch {
        customOrgStructure = { enterprises: [], locations: [], removedLocations: [] };
    }
}

function ensureCustomEnterprise(input) {
    const id = normalizeOrgId(input?.id || input?.name, 'enterprise');
    const name = String(input?.name || '').trim();
    const ico = normalizeIco(input?.ico || '');
    if (!id || !name) return { ok: false };
    const existing = customOrgStructure.enterprises.find(item => item.id === id);
    if (existing) {
        existing.name = name;
        existing.ico = ico;
    } else {
        customOrgStructure.enterprises.push({ id, name, ico });
    }
    saveCustomOrgStructure();
    return { ok: true, id };
}

function ensureCustomLocation(input) {
    const id = normalizeOrgId(input?.id || input?.name, 'location');
    const name = String(input?.name || '').trim();
    const enterpriseId = normalizeOrgId(input?.enterpriseId, 'enterprise');
    if (!id || !name || !enterpriseId) return { ok: false };
    const existing = customOrgStructure.locations.find(item => item.id === id);
    if (existing) {
        existing.name = name;
        existing.enterpriseId = enterpriseId;
    } else {
        customOrgStructure.locations.push({ id, name, enterpriseId });
    }
    customOrgStructure.removedLocations = (customOrgStructure.removedLocations || []).filter(locId => locId !== id);
    saveCustomOrgStructure();
    return { ok: true, id };
}

function removeCustomLocation(locationId) {
    const normalizedId = normalizeOrgId(locationId, 'location');
    if (!normalizedId) return { ok: false };
    const beforeLocations = customOrgStructure.locations.length;
    const beforeRemoved = (customOrgStructure.removedLocations || []).length;
    customOrgStructure.locations = customOrgStructure.locations.filter(item => item.id !== normalizedId);
    customOrgStructure.removedLocations = Array.from(new Set([...(customOrgStructure.removedLocations || []), normalizedId]));
    if (customOrgStructure.locations.length !== beforeLocations || customOrgStructure.removedLocations.length !== beforeRemoved) {
        saveCustomOrgStructure();
        return { ok: true };
    }
    return { ok: false };
}

function applyCustomOrgStructure() {
    customOrgStructure.enterprises.forEach(item => {
        if (!enterprises[item.id]) {
            enterprises[item.id] = { name: item.name, locations: [], ico: item.ico || '' };
        } else if (!enterprises[item.id].name) {
            enterprises[item.id].name = item.name;
        }
        if (item.ico) enterprises[item.id].ico = item.ico;
    });

    customOrgStructure.locations.forEach(item => {
        if (!enterprises[item.enterpriseId]) {
            enterprises[item.enterpriseId] = { name: item.enterpriseId, locations: [] };
        }
        Object.keys(enterprises).forEach(entId => {
            enterprises[entId].locations = (enterprises[entId].locations || []).filter(locId => locId !== item.id);
        });
        if (!locations[item.id]) {
            locations[item.id] = {
                id: item.id,
                name: item.name,
                enterprise: item.enterpriseId,
                silos: [],
                siloMap: {},
                hasCleanser: false,
                cleanserAirflow: 0,
                hasDryer: false,
                dryerHeatingTemp: 0,
                dryerDischargeMinutes: 0,
                lastUpdateTs: Date.now(),
                log: []
            };
        } else {
            locations[item.id].name = item.name;
            locations[item.id].enterprise = item.enterpriseId;
        }

        const locArr = enterprises[item.enterpriseId].locations;
        if (!locArr.includes(item.id)) {
            locArr.push(item.id);
        }
    });

    Object.keys(enterprises).forEach(entId => {
        enterprises[entId].locations = Array.from(new Set(enterprises[entId].locations || []));
    });

    const removedLocationSet = new Set(customOrgStructure.removedLocations || []);
    if (removedLocationSet.size) {
        removedLocationSet.forEach(locId => {
            delete locations[locId];
        });
        Object.keys(enterprises).forEach(entId => {
            enterprises[entId].locations = (enterprises[entId].locations || []).filter(locId => !removedLocationSet.has(locId));
        });
    }
}


