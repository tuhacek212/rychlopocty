// Data build and app bootstrap

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

    if (ENABLE_FAULTY_THERMOMETERS && !faultyThermometerKeys.length) {
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
        brniste: {
            hasCleanser: true,
            cleanserAirflow: 100,
            hasDryer: true,
            dryerHeatingTemp: 102,
            dryerDischargeMinutes: 42,
            dataAgeMinutes: 20
        },
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
                dryerHeatingTemp: Number(meta.dryerHeatingTemp) || 0,
                dryerDischargeMinutes: Number(meta.dryerDischargeMinutes) || 0,
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
        let temp = parseFloat(row.temp_c);
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
        let temp = parseFloat(row.temp_c);
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

        if (!includeForTemp || !Number.isFinite(temp)) {
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

    // Hard-override the latest timestamp in history with snapshot values,
    // so detail charts always match the live card values.
    const snapshotTempBuckets = {};
    const snapshotFanBuckets = {};
    const snapshotLevelByTs = {};

    snapshotRows.forEach(row => {
        const locId = row.location_id;
        const siloId = row.silo_id;
        const key = `${locId}:${siloId}`;
        const thermId = row.thermometer_id;
        const thermKey = `${locId}:${siloId}:${thermId}`;
        let temp = parseFloat(row.temp_c);
        if (faultySet.has(thermKey)) temp = 255;

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

        if (!snapshotLevelByTs[key]) snapshotLevelByTs[key] = {};
        snapshotLevelByTs[key][ts] = levelPct;

        const fanId = row.fan_id;
        if (fanId) {
            if (!snapshotFanBuckets[key]) snapshotFanBuckets[key] = {};
            if (!snapshotFanBuckets[key][ts]) snapshotFanBuckets[key][ts] = { total: 0, running: 0, seen: {} };
            if (!snapshotFanBuckets[key][ts].seen[fanId]) {
                snapshotFanBuckets[key][ts].seen[fanId] = true;
                snapshotFanBuckets[key][ts].total += 1;
                if (row.fan_running === 'true') snapshotFanBuckets[key][ts].running += 1;
            }
        }

        if (!includeForTemp || !Number.isFinite(temp)) return;

        if (!thermometerChoice[key]) thermometerChoice[key] = thermId;
        if (!snapshotTempBuckets[key]) snapshotTempBuckets[key] = {};
        if (!snapshotTempBuckets[key][ts]) {
            snapshotTempBuckets[key][ts] = { sum: 0, count: 0, min: null, max: null, tMin: null, tMax: null };
        }

        const bucket = snapshotTempBuckets[key][ts];
        bucket.sum += temp;
        bucket.count += 1;
        bucket.min = bucket.min === null ? temp : Math.min(bucket.min, temp);
        bucket.max = bucket.max === null ? temp : Math.max(bucket.max, temp);
        if (thermId === thermometerChoice[key]) {
            bucket.tMin = bucket.tMin === null ? temp : Math.min(bucket.tMin, temp);
            bucket.tMax = bucket.tMax === null ? temp : Math.max(bucket.tMax, temp);
        }
    });

    Object.keys(snapshotTempBuckets).forEach(key => {
        if (!historyBuckets[key]) historyBuckets[key] = {};
        Object.keys(snapshotTempBuckets[key]).forEach(ts => {
            historyBuckets[key][ts] = snapshotTempBuckets[key][ts];
        });
    });

    Object.keys(snapshotFanBuckets).forEach(key => {
        if (!fanSeriesBuckets[key]) fanSeriesBuckets[key] = {};
        Object.keys(snapshotFanBuckets[key]).forEach(ts => {
            fanSeriesBuckets[key][ts] = snapshotFanBuckets[key][ts];
        });
    });

    Object.keys(snapshotLevelByTs).forEach(key => {
        if (!levelBuckets[key]) levelBuckets[key] = {};
        Object.keys(snapshotLevelByTs[key]).forEach(ts => {
            levelBuckets[key][ts] = snapshotLevelByTs[key][ts];
        });
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

    applyCustomOrgStructure();
}

function initApp(snapshotRows, historyRows, usersCsvText = '', locationMachineConfigCsvText = '') {
    try {
        loadAdminThresholds();
        loadAlertSnoozeState();
        loadAdminAlertsUiState();
        loadCustomOrgStructure();
        pruneExpiredAlertSnoozes();
        buildData(snapshotRows, historyRows);
        loadLocationMachineConfigs(locationMachineConfigCsvText);
        ensureLocationMachineConfigsForKnownLocations();
        applyLocationMachineConfigsToLocations();
        setupLogin();
        setupLogout();

        loadManagedAccounts(usersCsvText);
        const accessCodes = getAllAccessCodes();
        const savedCode = readAuthFromStorage();
        if (savedCode && accessCodes[savedCode]) {
            completeLogin(savedCode, accessCodes[savedCode], { skipSave: true });
        } else {
            showLoginScreen();
        }
    } catch (err) {
        showLoadingError(`Inicializace: ${err && err.message ? err.message : String(err)}`);
    }
}

function showLoadingError(details = '') {
    const container = document.getElementById('silosContainer');
    if (container) {
        container.innerHTML = '<div class="load-error">Nepodarilo se nacist data. Zkontroluj data/*/history_20260220.csv</div>';
    }
    const error = document.getElementById('loginError');
    if (error) {
        const suffix = details ? ` Detail: ${details}` : '';
        error.textContent = `Nelze načíst data aplikace. Zkontrolujte, že běžíte přes web server (ne přímo jako soubor).${suffix}`;
    }
    if (details) console.error('[AgroMonitor] Load error:', details);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadMapConfig();
    const locations = ['melkovice', 'stranecka', 'brniste'];
    const dataVersion = String(Date.now());
    const historyRequests = locations.map(loc =>
        fetch(`data/${loc}/history_20260220.csv?v=${dataVersion}`, { cache: 'no-store' }).then(r => {
            if (!r.ok) throw new Error(`history ${loc} ${r.status}`);
            return r.text();
        })
    );
    const usersCsvRequest = fetch(`${MANAGED_ACCOUNTS_CSV_URL}?v=${dataVersion}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.text() : ''))
        .catch(() => '');
    const locationMachineConfigCsvRequest = fetch(`${LOCATION_MACHINE_CONFIG_CSV_URL}?v=${dataVersion}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.text() : ''))
        .catch(() => '');

    Promise.all([...historyRequests, usersCsvRequest, locationMachineConfigCsvRequest]).then((payload) => {
        const locationMachineConfigCsvText = payload[payload.length - 1] || '';
        const usersCsvText = payload[payload.length - 2] || '';
        const histories = payload.slice(0, -2);
        const historyRowsRaw = histories.flatMap(text => parseCsv(text));
        const validHistoryRows = historyRowsRaw.filter(r => r.location_id && r.enterprise_id && r.silo_id);
        if (!validHistoryRows.length) {
            showLoadingError('CSV data neobsahují očekávané sloupce nebo jsou prázdná.');
            return;
        }
        const snapshotRows = buildLatestSnapshotFromHistory(validHistoryRows);
        const historyRows = USE_SYNTHETIC_HISTORY
            ? buildSyntheticHistoryRows(snapshotRows)
            : validHistoryRows;
        initApp(snapshotRows, historyRows, usersCsvText, locationMachineConfigCsvText);
    }).catch((err) => {
        showLoadingError(`Načítání: ${err && err.message ? err.message : String(err)}`);
    });
});


