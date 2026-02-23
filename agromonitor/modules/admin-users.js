// Admin users, permissions, thresholds and audits

function isAdminUser() {
    return accessState.code === ADMIN_ACCESS_CODE || !!accessState.isAdmin;
}

function normalizeManagedAccount(record) {
    const code = String(record?.code || '').replace(/\D/g, '').slice(0, 6);
    const label = String(record?.label || '').trim();
    const rawLocations = Array.isArray(record?.locations) ? record.locations : [];
    const normalizedLocations = Array.from(new Set(
        rawLocations
            .map(locId => String(locId || '').trim())
            .filter(locId => !!locations[locId])
    ));
    const defaultLocation = normalizedLocations.includes(record?.defaultLocation)
        ? record.defaultLocation
        : (normalizedLocations[0] || null);
    const enterpriseId = String(record?.enterpriseId || '');
    return {
        code,
        label,
        enterpriseId,
        locations: normalizedLocations,
        defaultLocation,
        active: record?.active !== false,
        isAdmin: record?.isAdmin === true || String(record?.is_admin || '').toLowerCase() === 'true'
    };
}

function getAdminAccessDefinition() {
    const admin = ACCESS_CODES[ADMIN_ACCESS_CODE] || {};
    const allLocations = Object.keys(locations);
    return {
        label: admin.label || 'Admin',
        locations: allLocations,
        defaultLocation: admin.defaultLocation || allLocations[0] || null,
        isAdmin: true
    };
}

function getAllAccessCodes() {
    const map = {};
    map[ADMIN_ACCESS_CODE] = getAdminAccessDefinition();
    Object.keys(ACCESS_CODES).forEach(code => {
        if (code === ADMIN_ACCESS_CODE) return;
        const base = ACCESS_CODES[code] || {};
        const baseLocations = Array.isArray(base.locations)
            ? base.locations.filter(locId => !!locations[locId])
            : [];
        if (!baseLocations.length) return;
        map[code] = {
            label: base.label || 'Uživatel',
            locations: baseLocations,
            defaultLocation: base.defaultLocation && baseLocations.includes(base.defaultLocation)
                ? base.defaultLocation
                : baseLocations[0],
            enterpriseId: '',
            isAdmin: !!base.isAdmin
        };
    });
    managedAccounts.forEach(account => {
        if (!account.active || !account.code) return;
        const isAdmin = !!account.isAdmin;
        const accountLocations = isAdmin
            ? Object.keys(locations)
            : account.locations.slice();
        if (!accountLocations.length) return;
        map[account.code] = {
            label: account.label,
            locations: accountLocations,
            defaultLocation: account.defaultLocation || accountLocations[0] || null,
            enterpriseId: '',
            isAdmin
        };
    });
    return map;
}

function saveManagedAccounts() {
    localStorage.setItem(MANAGED_ACCOUNTS_STORAGE_KEY, JSON.stringify(managedAccounts));
}

function loadManagedAccounts(csvText = '') {
    if (csvText && csvText.trim()) {
        const parsedRows = parseCsv(csvText);
        const fromCsv = parsedRows
            .map(row => normalizeManagedAccount({
                code: row.code,
                label: row.label,
                enterpriseId: row.enterprise_id,
                locations: String(row.locations || '').split('|').map(v => v.trim()).filter(Boolean),
                defaultLocation: row.default_location,
                active: String(row.active || 'true').toLowerCase() !== 'false',
                isAdmin: String(row.is_admin || 'false').toLowerCase() === 'true'
            }))
            .filter(account => account.code && account.label);
        if (fromCsv.length) {
            managedAccounts = fromCsv;
            saveManagedAccounts();
            return;
        }
    }
    try {
        const raw = localStorage.getItem(MANAGED_ACCOUNTS_STORAGE_KEY);
        if (!raw) {
            // Seed from bundled demo accounts except the hard admin account.
            managedAccounts = Object.keys(ACCESS_CODES)
                .filter(code => code !== ADMIN_ACCESS_CODE)
                .map(code => normalizeManagedAccount({ code, ...ACCESS_CODES[code], active: true }))
                .filter(account => account.code && account.label);
            saveManagedAccounts();
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            managedAccounts = [];
            saveManagedAccounts();
            return;
        }
        managedAccounts = parsed
            .map(item => normalizeManagedAccount(item))
            .filter(account => account.code && account.label);
    } catch {
        managedAccounts = [];
    }
}

function upsertManagedAccount(account) {
    const normalized = normalizeManagedAccount(account);
    if (!normalized.code || !normalized.label) return { ok: false };
    if (normalized.code === ADMIN_ACCESS_CODE) return { ok: false, reason: 'admin_code' };
    const duplicate = managedAccounts.find(item => item.code === normalized.code);
    if (duplicate) {
        Object.assign(duplicate, normalized);
    } else {
        managedAccounts.push(normalized);
    }
    managedAccounts.sort((a, b) => a.label.localeCompare(b.label, 'cs-CZ'));
    saveManagedAccounts();
    return { ok: true };
}

function removeManagedAccount(code) {
    if (!code || code === ADMIN_ACCESS_CODE) return;
    const before = managedAccounts.length;
    managedAccounts = managedAccounts.filter(account => account.code !== code);
    if (managedAccounts.length !== before) {
        saveManagedAccounts();
    }
}

function loadAlertSnoozeState() {
    try {
        const raw = localStorage.getItem(ALERT_SNOOZE_STORAGE_KEY);
        if (!raw) {
            alertSnoozeState = {};
            return;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            alertSnoozeState = {};
            return;
        }
        alertSnoozeState = {};
        Object.keys(parsed).forEach(key => {
            const until = Number(parsed[key]?.until);
            if (Number.isFinite(until) && until > 0) {
                alertSnoozeState[key] = { until };
            }
        });
    } catch {
        alertSnoozeState = {};
    }
}

function saveAlertSnoozeState() {
    localStorage.setItem(ALERT_SNOOZE_STORAGE_KEY, JSON.stringify(alertSnoozeState));
}

function normalizeAdminThresholds(input) {
    const toNum = (value, fallback) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };
    const normalized = {
        tempMin: toNum(input?.tempMin, DEFAULT_ADMIN_THRESHOLDS.tempMin),
        tempMax: toNum(input?.tempMax, DEFAULT_ADMIN_THRESHOLDS.tempMax),
        offlineMinutes: Math.max(1, Math.round(toNum(input?.offlineMinutes, DEFAULT_ADMIN_THRESHOLDS.offlineMinutes))),
        cleanserAirflowMin: toNum(input?.cleanserAirflowMin, DEFAULT_ADMIN_THRESHOLDS.cleanserAirflowMin),
        cleanserAirflowMax: toNum(input?.cleanserAirflowMax, DEFAULT_ADMIN_THRESHOLDS.cleanserAirflowMax),
        dryerHeatingTempMin: toNum(input?.dryerHeatingTempMin, DEFAULT_ADMIN_THRESHOLDS.dryerHeatingTempMin),
        dryerHeatingTempMax: toNum(input?.dryerHeatingTempMax, DEFAULT_ADMIN_THRESHOLDS.dryerHeatingTempMax),
        dryerDischargeMinutesMin: Math.max(1, Math.round(toNum(input?.dryerDischargeMinutesMin, DEFAULT_ADMIN_THRESHOLDS.dryerDischargeMinutesMin))),
        dryerDischargeMinutesMax: Math.max(1, Math.round(toNum(input?.dryerDischargeMinutesMax, DEFAULT_ADMIN_THRESHOLDS.dryerDischargeMinutesMax)))
    };

    if (normalized.tempMin >= normalized.tempMax) {
        normalized.tempMin = DEFAULT_ADMIN_THRESHOLDS.tempMin;
        normalized.tempMax = DEFAULT_ADMIN_THRESHOLDS.tempMax;
    }
    if (normalized.cleanserAirflowMin >= normalized.cleanserAirflowMax) {
        normalized.cleanserAirflowMin = DEFAULT_ADMIN_THRESHOLDS.cleanserAirflowMin;
        normalized.cleanserAirflowMax = DEFAULT_ADMIN_THRESHOLDS.cleanserAirflowMax;
    }
    if (normalized.dryerHeatingTempMin >= normalized.dryerHeatingTempMax) {
        normalized.dryerHeatingTempMin = DEFAULT_ADMIN_THRESHOLDS.dryerHeatingTempMin;
        normalized.dryerHeatingTempMax = DEFAULT_ADMIN_THRESHOLDS.dryerHeatingTempMax;
    }
    if (normalized.dryerDischargeMinutesMin >= normalized.dryerDischargeMinutesMax) {
        normalized.dryerDischargeMinutesMin = DEFAULT_ADMIN_THRESHOLDS.dryerDischargeMinutesMin;
        normalized.dryerDischargeMinutesMax = DEFAULT_ADMIN_THRESHOLDS.dryerDischargeMinutesMax;
    }

    return normalized;
}

function loadAdminThresholds() {
    try {
        const raw = localStorage.getItem(ADMIN_CONFIG_STORAGE_KEY);
        if (!raw) {
            adminThresholds = { ...DEFAULT_ADMIN_THRESHOLDS };
            return;
        }
        const parsed = JSON.parse(raw);
        adminThresholds = normalizeAdminThresholds(parsed);
    } catch {
        adminThresholds = { ...DEFAULT_ADMIN_THRESHOLDS };
    }
}

function saveAdminThresholds() {
    localStorage.setItem(ADMIN_CONFIG_STORAGE_KEY, JSON.stringify(adminThresholds));
}

function loadAdminAlertsUiState() {
    try {
        const raw = localStorage.getItem(ADMIN_ALERTS_UI_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const rawActiveView = String(parsed?.activeView || '');
        let activeView = 'alerts';
        if (['alerts', 'config', 'users', 'enterprises', 'locations'].includes(rawActiveView)) {
            activeView = rawActiveView;
        } else if (rawActiveView === 'access') {
            activeView = 'users';
        } else if (rawActiveView === 'accounts') {
            activeView = 'enterprises';
        }
        const panelVisible = typeof parsed?.panelVisible === 'boolean'
            ? parsed.panelVisible
            : !parsed?.collapsed;
        adminAlertsUiState = {
            collapsed: !!parsed?.collapsed,
            showSnoozed: !!parsed?.showSnoozed,
            showConfig: !!parsed?.showConfig,
            showAccessLog: !!parsed?.showAccessLog,
            panelVisible,
            activeView,
            accessUserFilter: String(parsed?.accessUserFilter || 'all'),
            accessLocationFilter: String(parsed?.accessLocationFilter || 'all')
        };
        if (adminAlertsUiState.collapsed) {
            adminAlertsUiState.showSnoozed = false;
            adminAlertsUiState.showConfig = false;
            adminAlertsUiState.showAccessLog = false;
        }
    } catch {
        adminAlertsUiState = {
            collapsed: false,
            showSnoozed: false,
            showConfig: false,
            showAccessLog: false,
            panelVisible: false,
            activeView: 'alerts',
            accessUserFilter: 'all',
            accessLocationFilter: 'all'
        };
    }
}

function saveAdminAlertsUiState() {
    localStorage.setItem(ADMIN_ALERTS_UI_STORAGE_KEY, JSON.stringify(adminAlertsUiState));
}

function getDeviceTypeFromUserAgent() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isPhone = /android|iphone|ipod|windows phone|mobile|blackberry|opera mini/.test(ua);
    return isPhone ? 'Telefon' : 'PC';
}

function getDevicePlatformFromUserAgent() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipod')) return 'iOS (iPhone)';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('windows nt')) return 'Windows';
    if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    return 'Neznámá platforma';
}

function readLoginAuditEntries() {
    try {
        const raw = localStorage.getItem(LOGIN_AUDIT_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => ({
                id: String(item?.id || ''),
                timestamp: Number(item?.timestamp),
                userLabel: String(item?.userLabel || ''),
                deviceType: String(item?.deviceType || ''),
                platform: String(item?.platform || ''),
                source: String(item?.source || 'manual'),
                action: String(item?.action || 'login'),
                locationId: String(item?.locationId || ''),
                locationName: String(item?.locationName || '')
            }))
            .filter(item => item.id && Number.isFinite(item.timestamp) && item.userLabel)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, LOGIN_AUDIT_MAX_ENTRIES);
    } catch {
        return [];
    }
}

function writeLoginAuditEntries(entries) {
    const safeEntries = Array.isArray(entries) ? entries.slice(0, LOGIN_AUDIT_MAX_ENTRIES) : [];
    localStorage.setItem(LOGIN_AUDIT_STORAGE_KEY, JSON.stringify(safeEntries));
}

function recordLoginAccess(accessLabel, options = {}) {
    if (!accessLabel) return;
    const source = options.source === 'auto' ? 'auto' : 'manual';
    const entries = readLoginAuditEntries();
    const now = Date.now();
    const entry = {
        id: `${now}-${Math.floor(Math.random() * 1000000)}`,
        timestamp: now,
        userLabel: accessLabel,
        deviceType: getDeviceTypeFromUserAgent(),
        platform: getDevicePlatformFromUserAgent(),
        source,
        action: 'login',
        locationId: String(options.locationId || ''),
        locationName: String(options.locationName || '')
    };
    entries.unshift(entry);
    writeLoginAuditEntries(entries);
}

function recordLocationView(locationId, options = {}) {
    if (!locationId || !locations[locationId] || !isAuthenticated) return;
    const userLabel = String(accessState.label || '').trim();
    if (!userLabel) return;
    const source = options.source === 'auto' ? 'auto' : 'manual';
    const now = Date.now();
    const dedupeKey = `${userLabel}:${locationId}:${source}`;
    if (lastViewAudit.key === dedupeKey && (now - lastViewAudit.timestamp) < VIEW_AUDIT_DEDUPE_MS) {
        return;
    }

    lastViewAudit = { key: dedupeKey, timestamp: now };
    const entries = readLoginAuditEntries();
    const entry = {
        id: `${now}-${Math.floor(Math.random() * 1000000)}`,
        timestamp: now,
        userLabel,
        deviceType: getDeviceTypeFromUserAgent(),
        platform: getDevicePlatformFromUserAgent(),
        source,
        action: 'view',
        locationId,
        locationName: locations[locationId]?.name || locationId
    };
    entries.unshift(entry);
    writeLoginAuditEntries(entries);
}

function clearLoginAuditEntries() {
    writeLoginAuditEntries([]);
}

function buildLoginAuditCsv(entries) {
    const header = ['cas', 'akce', 'stredisko', 'uzivatel', 'zarizeni', 'platforma', 'typ_pristupu'];
    const lines = [header.join(';')];
    entries.forEach(entry => {
        const values = [
            formatDateTimeWithYear(entry.timestamp),
            entry.action === 'view' ? 'nahled_strediska' : 'prihlaseni',
            entry.locationName || entry.locationId || '-',
            entry.userLabel,
            entry.deviceType,
            entry.platform,
            entry.source === 'auto' ? 'automaticky' : 'rucne'
        ].map(v => String(v).replaceAll(';', ','));
        lines.push(values.join(';'));
    });
    return lines.join('\n');
}

function downloadLoginAuditCsv(entries) {
    const csv = '\uFEFF' + buildLoginAuditCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agromonitor-prihlaseni-log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildManagedAccountsCsv() {
    const header = ['code', 'label', 'enterprise_id', 'locations', 'default_location', 'active', 'is_admin'];
    const lines = [header.join(',')];
    managedAccounts
        .slice()
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'cs-CZ'))
        .forEach(account => {
            const values = [
                String(account.code || '').replaceAll(',', ' '),
                String(account.label || '').replaceAll(',', ' '),
                String(account.enterpriseId || '').replaceAll(',', ' '),
                (Array.isArray(account.locations) ? account.locations.join('|') : '').replaceAll(',', ' '),
                String(account.defaultLocation || '').replaceAll(',', ' '),
                account.active === false ? 'false' : 'true',
                account.isAdmin ? 'true' : 'false'
            ];
            lines.push(values.join(','));
        });
    return lines.join('\n');
}

function downloadManagedAccountsCsv() {
    const csv = '\uFEFF' + buildManagedAccountsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'accounts.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function pruneExpiredAlertSnoozes(now = Date.now()) {
    let changed = false;
    Object.keys(alertSnoozeState).forEach(alertId => {
        const until = Number(alertSnoozeState[alertId]?.until);
        if (!Number.isFinite(until) || until <= now) {
            delete alertSnoozeState[alertId];
            changed = true;
        }
    });
    if (changed) {
        saveAlertSnoozeState();
    }
    scheduleAlertSnoozeRefresh();
}

function isAlertSnoozed(alertId, now = Date.now()) {
    if (!alertId) return false;
    const until = Number(alertSnoozeState[alertId]?.until);
    if (!Number.isFinite(until)) return false;
    if (until <= now) {
        delete alertSnoozeState[alertId];
        saveAlertSnoozeState();
        scheduleAlertSnoozeRefresh();
        return false;
    }
    return true;
}

function scheduleAlertSnoozeRefresh() {
    if (alertSnoozeTimeout) {
        clearTimeout(alertSnoozeTimeout);
        alertSnoozeTimeout = null;
    }
    const now = Date.now();
    let nextUntil = Infinity;
    Object.values(alertSnoozeState).forEach(entry => {
        const until = Number(entry?.until);
        if (Number.isFinite(until) && until > now && until < nextUntil) {
            nextUntil = until;
        }
    });
    if (!Number.isFinite(nextUntil)) return;

    const delayMs = Math.max(250, Math.min(2147483647, nextUntil - now + 250));
    alertSnoozeTimeout = setTimeout(() => {
        pruneExpiredAlertSnoozes();
        renderAdminAlerts();
    }, delayMs);
}

function snoozeAlert(alertId, durationMs) {
    const ms = Number(durationMs);
    if (!alertId || !Number.isFinite(ms) || ms <= 0) return;
    alertSnoozeState[alertId] = { until: Date.now() + ms };
    saveAlertSnoozeState();
    scheduleAlertSnoozeRefresh();
}

function clearAlertSnooze(alertId) {
    if (!alertId || !alertSnoozeState[alertId]) return;
    delete alertSnoozeState[alertId];
    saveAlertSnoozeState();
    scheduleAlertSnoozeRefresh();
}

function formatDateTime(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTimeWithYear(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function focusElementWithPulse(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('problem-focus');
    setTimeout(() => element.classList.remove('problem-focus'), 2200);
}

function openAlertTarget(locationId, targetType, targetId) {
    if (!locationId || !locations[locationId]) return;

    const targetEnterprise = locations[locationId].enterprise;
    if (targetEnterprise && currentEnterprise !== targetEnterprise) {
        currentEnterprise = targetEnterprise;
        const accountName = document.getElementById('accountName');
        if (accountName && enterprises[currentEnterprise]) {
            accountName.textContent = enterprises[currentEnterprise].name;
        }
        renderEnterpriseMenu();
    }
    currentLocation = locationId;
    changeLocation();
    recordLocationView(locationId, { source: 'manual' });

    setTimeout(() => {
        if (targetType === 'silo' && targetId) {
            const selector = `.silo-card[data-problem-target="silo:${targetId}"]`;
            focusElementWithPulse(document.querySelector(selector));
            return;
        }
        if (targetType === 'cleanser') {
            focusElementWithPulse(document.querySelector('.silo-card[data-problem-target="cleanser"]'));
            return;
        }
        focusElementWithPulse(document.getElementById('lastUpdateLabel'));
    }, 80);
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
                id: `offline:${location.id}`,
                severity: 'danger',
                title: `Středisko ${location.name} je offline`,
                detail: `Poslední data před ${formatAgeMinutes(minutes)}.`,
                locationId: location.id,
                targetType: 'location',
                targetId: ''
            });
        }

        if (location.hasCleanser) {
            const airflow = Math.round(location.cleanserAirflow || 0);
            if (airflow < adminThresholds.cleanserAirflowMin || airflow > adminThresholds.cleanserAirflowMax) {
                alerts.push({
                    id: `cleanser:${location.id}`,
                    severity: 'danger',
                    title: `Čistička mimo hodnoty - ${location.name}`,
                    detail: `Vzduch ${airflow}%, mimo bezny rozsah ${adminThresholds.cleanserAirflowMin}-${adminThresholds.cleanserAirflowMax}%.`,
                    locationId: location.id,
                    targetType: 'cleanser',
                    targetId: ''
                });
            }
        }
        if (location.hasDryer) {
            const heatingTemp = Number(location.dryerHeatingTemp);
            const dischargeMinutes = Number(location.dryerDischargeMinutes);
            if (Number.isFinite(heatingTemp) && (
                heatingTemp < adminThresholds.dryerHeatingTempMin ||
                heatingTemp > adminThresholds.dryerHeatingTempMax
            )) {
                alerts.push({
                    id: `dryer-heat:${location.id}`,
                    severity: 'warning',
                    title: `Sušárna mimo náhřev - ${location.name}`,
                    detail: `Náhřev ${heatingTemp.toFixed(1)} C, mimo rozsah ${adminThresholds.dryerHeatingTempMin}-${adminThresholds.dryerHeatingTempMax} C.`,
                    locationId: location.id,
                    targetType: 'location',
                    targetId: ''
                });
            }
            if (Number.isFinite(dischargeMinutes) && (
                dischargeMinutes < adminThresholds.dryerDischargeMinutesMin ||
                dischargeMinutes > adminThresholds.dryerDischargeMinutesMax
            )) {
                alerts.push({
                    id: `dryer-discharge:${location.id}`,
                    severity: 'warning',
                    title: `Sušárna mimo dobu odsypu - ${location.name}`,
                    detail: `Odsyp ${Math.round(dischargeMinutes)} min, mimo rozsah ${adminThresholds.dryerDischargeMinutesMin}-${adminThresholds.dryerDischargeMinutesMax} min.`,
                    locationId: location.id,
                    targetType: 'location',
                    targetId: ''
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
                    id: `temp-invalid:${location.id}:${silo.id}`,
                    severity: 'danger',
                    title: `Silo ${silo.name} - neplatna teplota`,
                    detail: `Středisko ${location.name}, senzor hlásí extrémní hodnotu.`,
                    locationId: location.id,
                    targetType: 'silo',
                    targetId: silo.id
                });
                return;
            }

            if (max > adminThresholds.tempMax || min < adminThresholds.tempMin) {
                alerts.push({
                    id: `temp-range:${location.id}:${silo.id}`,
                    severity: 'warning',
                    title: `Silo ${silo.name} - teploty mimo standard`,
                    detail: `Středisko ${location.name}, rozsah ${min.toFixed(1)} - ${max.toFixed(1)} C (limit ${adminThresholds.tempMin}-${adminThresholds.tempMax} C).`,
                    locationId: location.id,
                    targetType: 'silo',
                    targetId: silo.id
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
        scheduleAlertSnoozeRefresh();
        return;
    }

    pruneExpiredAlertSnoozes();
    const alerts = collectAdminAlerts();
    const now = Date.now();
    const activeAlerts = alerts.filter(alert => !isAlertSnoozed(alert.id, now));
    const maxItems = 8;
    const shown = activeAlerts.slice(0, maxItems);
    const remainder = activeAlerts.length - shown.length;
    const snoozedCount = alerts.length - activeAlerts.length;
    const snoozedAlerts = alerts
        .filter(alert => isAlertSnoozed(alert.id, now))
        .map(alert => ({
            ...alert,
            snoozedUntil: Number(alertSnoozeState[alert.id]?.until)
        }))
        .sort((a, b) => a.snoozedUntil - b.snoozedUntil);
    const countLabel = !alerts.length
        ? 'Vše v normě'
        : snoozedCount > 0
            ? `${activeAlerts.length} aktivní / ${snoozedCount} odložené`
            : `${activeAlerts.length} problémů`;
    const loginAuditEntries = readLoginAuditEntries();
    const visible = !!adminAlertsUiState.panelVisible;
    const activeView = ['alerts', 'config', 'users', 'enterprises', 'locations'].includes(adminAlertsUiState.activeView)
        ? adminAlertsUiState.activeView
        : 'alerts';

    const alertsMenuLabel = !alerts.length
        ? 'Měření (0)'
        : snoozedCount > 0
            ? `Měření (${activeAlerts.length}/${alerts.length})`
            : `Měření (${activeAlerts.length})`;
    const usersMenuLabel = `Uživatele (${managedAccounts.length})`;
    const enterprisesMenuLabel = `Podniky (${Object.keys(enterprises).length})`;
    const locationsMenuLabel = `Střediska (${Object.keys(locations).length})`;

    const accessEventEntries = loginAuditEntries.filter(entry => {
        const action = String(entry?.action || 'login');
        return action === 'view' || action === 'login';
    });
    const accessUsers = Array.from(new Set(accessEventEntries.map(entry => entry.userLabel)))
        .sort((a, b) => a.localeCompare(b, 'cs-CZ'));
    const normalizedUserFilter = accessUsers.includes(adminAlertsUiState.accessUserFilter)
        ? adminAlertsUiState.accessUserFilter
        : 'all';
    const allLocationIds = Object.keys(locations);
    const normalizedLocationFilter = allLocationIds.includes(adminAlertsUiState.accessLocationFilter)
        ? adminAlertsUiState.accessLocationFilter
        : 'all';
    const filteredAuditEntries = accessEventEntries.filter(entry => {
        if (normalizedUserFilter !== 'all' && entry.userLabel !== normalizedUserFilter) return false;
        if (normalizedLocationFilter === 'all') return true;
        return entry.locationId === normalizedLocationFilter;
    });
    const accessRows = filteredAuditEntries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 500)
        .map(entry => ({
            timestamp: entry.timestamp,
            userLabel: entry.userLabel,
            locationName: entry.locationId ? (locations[entry.locationId]?.name || entry.locationName || entry.locationId) : (entry.locationName || '-'),
            actionLabel: entry.action === 'view' ? 'Náhled střediska' : 'Přihlášení',
            sourceLabel: entry.source === 'auto' ? 'Automaticky' : 'Ručně',
            platform: entry.platform || '-'
        }));

    const alertsSectionHtml = `
        <div class="admin-section-head">
            <div class="admin-section-title">Problematická měření</div>
            <div class="admin-section-tools">
                <button class="admin-tool-btn" type="button" data-toggle-snoozed="1">
                    ${adminAlertsUiState.showSnoozed ? 'Skryt odložené' : `Odložené (${snoozedCount})`}
                </button>
            </div>
        </div>
        ${shown.length ? `
            <div class="admin-alerts-list">
                ${shown.map(alert => `
                    <div class="admin-alert-item ${alert.severity || ''}">
                        <button
                            class="admin-alert-link admin-alert-title"
                            type="button"
                            data-open-location="${alert.locationId || ''}"
                            data-open-target-type="${alert.targetType || 'location'}"
                            data-open-target-id="${alert.targetId || ''}"
                        >
                            ${alert.title}
                        </button>
                        <div class="admin-alert-sep">•</div>
                        <div class="admin-alert-detail">${alert.detail}</div>
                        <div class="admin-alert-actions">
                            ${DEMO_SNOOZE_PRESETS.map(preset => `
                                <button
                                    class="admin-snooze-btn"
                                    type="button"
                                    data-alert-id="${alert.id}"
                                    data-snooze-ms="${preset.durationMs}"
                                >
                                    +${preset.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                ${remainder > 0 ? `<div class="admin-alert-detail">A dalších ${remainder} položek...</div>` : ''}
            </div>
        ` : `
            <div class="admin-alerts-empty">
                ${alerts.length ? 'Vsechny aktualni podnety jsou docasne odložené.' : 'Žádné problematické měření nebylo nalezeno.'}
            </div>
        `}
        ${adminAlertsUiState.showSnoozed ? `
            <div class="admin-snoozed-list">
                ${snoozedAlerts.length ? snoozedAlerts.map(alert => `
                    <div class="admin-alert-item ${alert.severity || ''}">
                        <button
                            class="admin-alert-link admin-alert-title"
                            type="button"
                            data-open-location="${alert.locationId || ''}"
                            data-open-target-type="${alert.targetType || 'location'}"
                            data-open-target-id="${alert.targetId || ''}"
                        >
                            ${alert.title}
                        </button>
                        <div class="admin-alert-sep">•</div>
                        <div class="admin-alert-detail">${alert.detail}</div>
                        <div class="admin-alert-detail admin-alert-snooze-until">Odloženo do ${formatDateTime(alert.snoozedUntil)}</div>
                        <div class="admin-alert-actions">
                            <button
                                class="admin-snooze-btn admin-snooze-reset-btn"
                                type="button"
                                data-unsnooze-id="${alert.id}"
                            >
                                Obnovit
                            </button>
                            ${DEMO_SNOOZE_PRESETS.map(preset => `
                                <button
                                    class="admin-snooze-btn"
                                    type="button"
                                    data-alert-id="${alert.id}"
                                    data-snooze-ms="${preset.durationMs}"
                                >
                                    +${preset.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `).join('') : '<div class="admin-alerts-empty">Žádné odložené podněty.</div>'}
            </div>
        ` : ''}
    `;

    const configSectionHtml = `
        <form class="admin-config-panel" id="adminConfigForm">
            <div class="admin-config-title">Admin konfigurace limitů</div>
            <div class="admin-config-machine-grid">
                <div class="admin-config-group">
                    <div class="admin-config-group-title">Sila</div>
                    <div class="admin-config-grid">
                        <label class="admin-config-field">
                            <span>Teplota min (C)</span>
                            <input type="number" step="0.1" name="tempMin" value="${adminThresholds.tempMin}">
                        </label>
                        <label class="admin-config-field">
                            <span>Teplota max (C)</span>
                            <input type="number" step="0.1" name="tempMax" value="${adminThresholds.tempMax}">
                        </label>
                    </div>
                </div>
                <div class="admin-config-group">
                    <div class="admin-config-group-title">Čistička</div>
                    <div class="admin-config-grid">
                        <label class="admin-config-field">
                            <span>Vzduch min (%)</span>
                            <input type="number" step="1" name="cleanserAirflowMin" value="${adminThresholds.cleanserAirflowMin}">
                        </label>
                        <label class="admin-config-field">
                            <span>Vzduch max (%)</span>
                            <input type="number" step="1" name="cleanserAirflowMax" value="${adminThresholds.cleanserAirflowMax}">
                        </label>
                    </div>
                </div>
                <div class="admin-config-group">
                    <div class="admin-config-group-title">Spojení</div>
                    <div class="admin-config-grid single">
                        <label class="admin-config-field">
                            <span>Offline limit (min)</span>
                            <input type="number" step="1" min="1" name="offlineMinutes" value="${adminThresholds.offlineMinutes}">
                        </label>
                    </div>
                </div>
                <div class="admin-config-group">
                    <div class="admin-config-group-title">Sušárna</div>
                    <div class="admin-config-grid">
                        <label class="admin-config-field">
                            <span>Náhřev min (C)</span>
                            <input type="number" step="0.1" name="dryerHeatingTempMin" value="${adminThresholds.dryerHeatingTempMin}">
                        </label>
                        <label class="admin-config-field">
                            <span>Náhřev max (C)</span>
                            <input type="number" step="0.1" name="dryerHeatingTempMax" value="${adminThresholds.dryerHeatingTempMax}">
                        </label>
                        <label class="admin-config-field">
                            <span>Odsyp min (min)</span>
                            <input type="number" step="1" min="1" name="dryerDischargeMinutesMin" value="${adminThresholds.dryerDischargeMinutesMin}">
                        </label>
                        <label class="admin-config-field">
                            <span>Odsyp max (min)</span>
                            <input type="number" step="1" min="1" name="dryerDischargeMinutesMax" value="${adminThresholds.dryerDischargeMinutesMax}">
                        </label>
                    </div>
                </div>
            </div>
            <div class="admin-config-actions">
                <button class="admin-tool-btn" type="submit">Uložit</button>
                <button class="admin-tool-btn" type="button" data-admin-config-reset="1">Reset</button>
            </div>
            <div class="admin-config-error" id="adminConfigError"></div>
        </form>
    `;

    const accessSectionHtml = `
        <div class="admin-access-log" id="adminAccessLog">
            <div class="admin-access-log-head">
                <div class="admin-access-log-title">Záznamy přístupů</div>
                <div class="admin-access-log-filters">
                    <label class="admin-access-filter">
                        <span>Uživatel</span>
                        <select id="adminAccessUserFilter">
                            <option value="all">Všichni</option>
                            ${accessUsers.map(user => `
                                <option value="${escapeHtml(user)}" ${normalizedUserFilter === user ? 'selected' : ''}>${escapeHtml(user)}</option>
                            `).join('')}
                        </select>
                    </label>
                    <label class="admin-access-filter">
                        <span>Středisko</span>
                        <select id="adminAccessLocationFilter">
                            <option value="all">Všechna</option>
                            ${allLocationIds.map(locId => `
                                <option value="${escapeHtml(locId)}" ${normalizedLocationFilter === locId ? 'selected' : ''}>${escapeHtml(locations[locId]?.name || locId)}</option>
                            `).join('')}
                        </select>
                    </label>
                </div>
                <div class="admin-access-log-tools">
                    <button class="admin-tool-btn" type="button" data-export-access-log="1">CSV export</button>
                    <button class="admin-tool-btn" type="button" data-clear-access-log="1">Vymazat</button>
                </div>
            </div>
            <div class="admin-access-log-list">
                ${accessRows.length ? accessRows.map(row => `
                    <div class="admin-access-row-one">
                        <div class="admin-access-time">${escapeHtml(formatDateTimeWithYear(row.timestamp))}</div>
                        <div class="admin-access-user">${escapeHtml(row.userLabel)}</div>
                        <div class="admin-access-location-name">${escapeHtml(row.locationName)}</div>
                        <div class="admin-access-action">${escapeHtml(row.actionLabel)}</div>
                        <div class="admin-access-source">${escapeHtml(row.sourceLabel)}</div>
                        <div class="admin-access-platform">${escapeHtml(row.platform)}</div>
                    </div>
                `).join('') : '<div class="admin-alerts-empty">Pro zvolený filtr nejsou k dispozici žádné přístupy.</div>'}
            </div>
        </div>
    `;

    const enterpriseIds = Object.keys(enterprises);
    const customEnterpriseIds = new Set(customOrgStructure.enterprises.map(item => item.id));
    const customLocationIds = new Set(customOrgStructure.locations.map(item => item.id));
    const usersPermissionsHtml = `
        <form class="admin-users-form" id="adminUserCreateForm">
            <div class="admin-config-title">Krok 1: Založit uživatele</div>
            <div class="admin-config-grid">
                <label class="admin-config-field">
                    <span>Název uživatele</span>
                    <input type="text" name="label" maxlength="80" placeholder="Např. Skladník Brniště">
                </label>
                <label class="admin-config-field">
                    <span>Přístupový kód (6 čísel)</span>
                    <input type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" name="code" placeholder="123456">
                </label>
            </div>
            <label class="admin-users-location-item">
                <input type="checkbox" name="isAdmin">
                <span>Uživatel ma prava admin</span>
            </label>
            <div class="admin-config-actions">
                <button class="admin-tool-btn" type="submit">Založit uživatele</button>
            </div>
            <div class="admin-config-error" id="adminUserCreateError"></div>
        </form>
        <form class="admin-users-form" id="adminUserRightsForm">
            <div class="admin-config-title">Krok 2: Přiřadit střediska a výchozí středisko</div>
            <input type="hidden" name="editCode" value="">
            <div class="admin-config-grid">
                <label class="admin-config-field">
                    <span>Uživatel</span>
                    <select name="userCode" id="adminRightsUserCode">
                        <option value="">Vyber uživatele</option>
                        ${managedAccounts.map(account => `
                            <option value="${escapeHtml(account.code)}">${escapeHtml(account.label)} (${escapeHtml(account.code)})</option>
                        `).join('')}
                    </select>
                </label>
                <label class="admin-config-field">
                    <span>Výchozí středisko</span>
                    <select name="defaultLocation" id="adminAccountDefaultLocation"></select>
                </label>
            </div>
            <div class="admin-users-locations">
                <div class="admin-users-locations-title">Přiřazená střediska</div>
                <div class="admin-users-locations-list" id="adminUsersLocationsList">
                    ${Object.keys(locations).map(locId => {
                        const loc = locations[locId];
                        const sourceClass = customLocationIds.has(locId) ? 'custom' : '';
                        return `
                            <label class="admin-users-location-item ${sourceClass}">
                                <input type="checkbox" name="locations" value="${escapeHtml(locId)}">
                                <span>${escapeHtml(loc.name)}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="admin-config-actions">
                <button class="admin-tool-btn" type="submit">Uložit prava</button>
                <button class="admin-tool-btn" type="button" data-account-form-reset="1">Vymazat výběr</button>
            </div>
            <div class="admin-config-error" id="adminUsersError"></div>
        </form>
        <div class="admin-config-actions">
            <button class="admin-tool-btn" type="button" data-export-managed-accounts="1">CSV export uživatelů</button>
        </div>
        <div class="admin-users-list">
            ${managedAccounts.length ? managedAccounts.map(account => {
                const locationNames = account.locations.map(locId => locations[locId]?.name || locId).join(', ');
                return `
                    <div class="admin-user-row">
                        <div class="admin-user-name">${escapeHtml(account.label)}</div>
                        <div class="admin-user-code">${escapeHtml(account.code)}</div>
                        <div class="admin-user-role">${account.isAdmin ? 'ADMIN' : 'UŽIVATEL'}</div>
                        <div class="admin-user-locations" title="${escapeHtml(locationNames)}">${account.isAdmin ? 'všechna střediska' : escapeHtml(locationNames || 'bez středisek')}</div>
                        <div class="admin-user-actions">
                            <button class="admin-tool-btn" type="button" data-edit-account="${escapeHtml(account.code)}">Upravit práva</button>
                            <button class="admin-tool-btn" type="button" data-delete-account="${escapeHtml(account.code)}">Smazat</button>
                        </div>
                    </div>
                `;
            }).join('') : '<div class="admin-alerts-empty">Zatím nejsou založeni žádní uživatelé.</div>'}
        </div>
    `;
    const usersSectionHtml = `
        <div class="admin-users-tab">
            <div class="admin-users-panel">
                ${usersPermissionsHtml}
            </div>
            ${accessSectionHtml}
        </div>
    `;
    const enterprisesSectionHtml = `
        <div class="admin-users-panel admin-enterprises-panel">
            <div class="admin-users-form">
                <form class="admin-structure-form" id="adminEnterpriseForm">
                    <div class="admin-config-title">Podniky</div>
                    <div class="admin-config-grid">
                        <label class="admin-config-field">
                            <span>ICO</span>
                            <input type="text" name="enterpriseIco" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="Např. 27074358">
                        </label>
                        <label class="admin-config-field">
                            <span>Název podniku</span>
                            <input type="text" name="enterpriseName" maxlength="120" placeholder="Načte se z ARES podle IČO">
                        </label>
                    </div>
                    <div class="admin-config-actions">
                        <button class="admin-tool-btn" type="button" data-fetch-ares="1">Načíst z ARES</button>
                        <button class="admin-tool-btn" type="submit">Přidat podnik</button>
                    </div>
                    <div class="admin-config-error" id="adminEnterpriseError"></div>
                </form>
                <div class="admin-structure-list">
                    ${enterpriseIds.map(entId => {
                        const locNames = (enterprises[entId]?.locations || []).map(locId => locations[locId]?.name || locId).join(', ');
                        const sourceTag = customEnterpriseIds.has(entId) ? 'Vlastní' : 'System';
                        const icoLabel = enterprises[entId]?.ico ? `ICO: ${enterprises[entId].ico}` : 'ICO: -';
                        return `
                            <div class="admin-structure-item">
                                <div class="admin-user-name">${escapeHtml(enterprises[entId]?.name || entId)}</div>
                                <div class="admin-user-meta">ID: ${escapeHtml(entId)} • ${sourceTag}</div>
                                <div class="admin-user-meta">${escapeHtml(icoLabel)}</div>
                                <div class="admin-user-meta">Střediska: ${escapeHtml(locNames || '-')}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    const locationsSectionHtml = `
        <div class="admin-users-panel admin-enterprises-panel">
            <div class="admin-users-form">
                <form class="admin-structure-form" id="adminLocationForm">
                    <div class="admin-config-title">Střediska a konfigurace vizualizace</div>
                    <input type="hidden" name="editLocationId" value="">
                    <div class="admin-config-grid">
                        <label class="admin-config-field admin-config-field-full">
                            <span>Podnik</span>
                            <select name="enterpriseId">
                                ${enterpriseIds.map(entId => `<option value="${escapeHtml(entId)}">${escapeHtml(enterprises[entId].name)}</option>`).join('')}
                            </select>
                        </label>
                        <label class="admin-config-field">
                            <span>Stávající středisko (pro úpravu)</span>
                            <select name="existingLocationId" id="adminExistingLocationId">
                                <option value="">Vyber středisko</option>
                            </select>
                        </label>
                        <label class="admin-config-field">
                            <span>Nové středisko (pro založení)</span>
                            <input type="text" name="newLocationName" maxlength="80" placeholder="Např. Středisko Jih">
                        </label>
                        <label class="admin-config-field">
                            <span>Počet sil</span>
                            <input type="number" min="0" step="1" name="silosCount" placeholder="0">
                        </label>
                        <label class="admin-config-field">
                            <span>Teploměrů na silo</span>
                            <input type="number" min="0" step="1" name="thermometersPerSilo" placeholder="0">
                        </label>
                        <label class="admin-config-field">
                            <span>Čidel na teploměr</span>
                            <input type="number" min="0" step="1" name="sensorsPerThermometer" placeholder="0">
                        </label>
                        <label class="admin-config-field">
                            <span>Kapacita sila (m3)</span>
                            <input type="number" min="0" step="1" name="siloCapacityM3" placeholder="0">
                        </label>
                        <label class="admin-users-location-item">
                            <input type="checkbox" name="hasCleanser">
                            <span>Středisko má čističku</span>
                        </label>
                        <label class="admin-config-field">
                            <span>Vzduch čističky (%)</span>
                            <input type="number" min="0" max="100" step="1" name="cleanserAirflow" placeholder="0">
                        </label>
                        <label class="admin-users-location-item">
                            <input type="checkbox" name="hasDryer">
                            <span>Středisko má sušárnu</span>
                        </label>
                        <label class="admin-config-field">
                            <span>Náhřev susarny (C)</span>
                            <input type="number" min="0" step="0.1" name="dryerHeatingTemp" placeholder="0">
                        </label>
                        <label class="admin-config-field">
                            <span>Odsyp sušárny (min)</span>
                            <input type="number" min="0" step="1" name="dryerDischargeMinutes" placeholder="0">
                        </label>
                        <label class="admin-config-field">
                            <span>Poznámka pro vizualizaci</span>
                            <input type="text" name="notes" maxlength="240" placeholder="Volitelné">
                        </label>
                    </div>
                    <div class="admin-config-actions">
                        <button class="admin-tool-btn" type="submit">Uložit stredisko</button>
                        <button class="admin-tool-btn" type="button" data-location-form-reset="1">Vymazat formulář</button>
                        <button class="admin-tool-btn" type="button" data-export-location-config="1">CSV export</button>
                    </div>
                    <div class="admin-config-error" id="adminLocationError"></div>
                </form>
                <div class="admin-structure-list">
                    ${Object.keys(locations).map(locId => {
                        const loc = locations[locId];
                        const cfg = locationMachineConfigs[locId] || normalizeLocationMachineConfig({ locationId: locId }, locId);
                        return `
                            <div class="admin-structure-item">
                                <div class="admin-user-name">${escapeHtml(loc?.name || locId)}</div>
                                <div class="admin-user-meta">ID: ${escapeHtml(locId)}</div>
                                <div class="admin-user-meta">Podnik: ${escapeHtml(enterprises[loc?.enterprise]?.name || loc?.enterprise || '-')}</div>
                                <div class="admin-user-meta">Sila: ${escapeHtml(String(cfg?.silosCount ?? 0))} • Teploměry/silo: ${escapeHtml(String(cfg?.thermometersPerSilo ?? 0))} • Čidla/teploměr: ${escapeHtml(String(cfg?.sensorsPerThermometer ?? 0))}</div>
                                <div class="admin-user-meta">Kapacita sila: ${escapeHtml(String(cfg?.siloCapacityM3 ?? 0))} m3 • Čistička: ${cfg?.hasCleanser ? 'ano' : 'ne'} • Sušárna: ${cfg?.hasDryer ? 'ano' : 'ne'}</div>
                                <div class="admin-user-actions">
                                    <button class="admin-tool-btn" type="button" data-edit-location="${escapeHtml(locId)}">Upravit</button>
                                    <button class="admin-tool-btn" type="button" data-delete-location="${escapeHtml(locId)}">Smazat</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    let activeSectionHtml = alertsSectionHtml;
    if (activeView === 'config') activeSectionHtml = configSectionHtml;
    if (activeView === 'users') activeSectionHtml = usersSectionHtml;
    if (activeView === 'enterprises') activeSectionHtml = enterprisesSectionHtml;
    if (activeView === 'locations') activeSectionHtml = locationsSectionHtml;

    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="admin-alerts-head">
            <div class="admin-alerts-title">Administrační panel</div>
            <div class="admin-alerts-tools">
                <button class="admin-tool-btn" type="button" data-toggle-admin-panel="1">
                    ${visible ? 'Skrýt panel' : 'Zobrazit panel'}
                </button>
            </div>
        </div>
        ${visible ? `
            <div class="admin-workspace">
                <aside class="admin-nav" aria-label="Admin menu">
                    <button class="admin-nav-item ${activeView === 'alerts' ? 'active' : ''}" type="button" data-admin-view="alerts">${alertsMenuLabel}</button>
                    <button class="admin-nav-item ${activeView === 'config' ? 'active' : ''}" type="button" data-admin-view="config">Konfigurace</button>
                    <button class="admin-nav-item ${activeView === 'users' ? 'active' : ''}" type="button" data-admin-view="users">${usersMenuLabel}</button>
                    <button class="admin-nav-item ${activeView === 'enterprises' ? 'active' : ''}" type="button" data-admin-view="enterprises">${enterprisesMenuLabel}</button>
                    <button class="admin-nav-item ${activeView === 'locations' ? 'active' : ''}" type="button" data-admin-view="locations">${locationsMenuLabel}</button>
                </aside>
                <section class="admin-content">
                    ${activeSectionHtml}
                </section>
            </div>
        ` : ''}
    `;

    const toggleAdminPanelButton = panel.querySelector('[data-toggle-admin-panel="1"]');
    if (toggleAdminPanelButton) {
        toggleAdminPanelButton.addEventListener('click', () => {
            adminAlertsUiState.panelVisible = !adminAlertsUiState.panelVisible;
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    }
    panel.querySelectorAll('[data-admin-view]').forEach(button => {
        button.addEventListener('click', () => {
            adminAlertsUiState.activeView = button.getAttribute('data-admin-view') || 'alerts';
            adminAlertsUiState.panelVisible = true;
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    });
    panel.querySelectorAll('[data-alert-id][data-snooze-ms]').forEach(button => {
        button.addEventListener('click', () => {
            const alertId = button.getAttribute('data-alert-id') || '';
            const snoozeMs = Number(button.getAttribute('data-snooze-ms'));
            snoozeAlert(alertId, snoozeMs);
            renderAdminAlerts();
        });
    });
    panel.querySelectorAll('[data-unsnooze-id]').forEach(button => {
        button.addEventListener('click', () => {
            const alertId = button.getAttribute('data-unsnooze-id') || '';
            clearAlertSnooze(alertId);
            renderAdminAlerts();
        });
    });
    panel.querySelectorAll('[data-open-location]').forEach(button => {
        button.addEventListener('click', () => {
            const locationId = button.getAttribute('data-open-location') || '';
            const targetType = button.getAttribute('data-open-target-type') || 'location';
            const targetId = button.getAttribute('data-open-target-id') || '';
            openAlertTarget(locationId, targetType, targetId);
        });
    });
    const configForm = panel.querySelector('#adminConfigForm');
    if (configForm) {
        const configError = panel.querySelector('#adminConfigError');
        configForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(configForm);
            const rawConfig = {
                tempMin: Number(formData.get('tempMin')),
                tempMax: Number(formData.get('tempMax')),
                offlineMinutes: Number(formData.get('offlineMinutes')),
                cleanserAirflowMin: Number(formData.get('cleanserAirflowMin')),
                cleanserAirflowMax: Number(formData.get('cleanserAirflowMax')),
                dryerHeatingTempMin: Number(formData.get('dryerHeatingTempMin')),
                dryerHeatingTempMax: Number(formData.get('dryerHeatingTempMax')),
                dryerDischargeMinutesMin: Number(formData.get('dryerDischargeMinutesMin')),
                dryerDischargeMinutesMax: Number(formData.get('dryerDischargeMinutesMax'))
            };

            if (!Number.isFinite(rawConfig.tempMin) || !Number.isFinite(rawConfig.tempMax)) {
                if (configError) configError.textContent = 'Teplotní limity musí být čísla.';
                return;
            }
            if (!Number.isFinite(rawConfig.offlineMinutes) || rawConfig.offlineMinutes < 1) {
                if (configError) configError.textContent = 'Offline limit musí být kladné číslo.';
                return;
            }
            if (!Number.isFinite(rawConfig.cleanserAirflowMin) || !Number.isFinite(rawConfig.cleanserAirflowMax)) {
                if (configError) configError.textContent = 'Limity čističky musí být čísla.';
                return;
            }
            if (!Number.isFinite(rawConfig.dryerHeatingTempMin) || !Number.isFinite(rawConfig.dryerHeatingTempMax)) {
                if (configError) configError.textContent = 'Limity náhřevu sušárny musí být čísla.';
                return;
            }
            if (!Number.isFinite(rawConfig.dryerDischargeMinutesMin) || !Number.isFinite(rawConfig.dryerDischargeMinutesMax)) {
                if (configError) configError.textContent = 'Limity odsypu sušárny musí být čísla.';
                return;
            }
            if (rawConfig.tempMin >= rawConfig.tempMax) {
                if (configError) configError.textContent = 'Teplota min musí být menší než teplota max.';
                return;
            }
            if (rawConfig.cleanserAirflowMin >= rawConfig.cleanserAirflowMax) {
                if (configError) configError.textContent = 'Vzduch min musí být menší než vzduch max.';
                return;
            }
            if (rawConfig.dryerHeatingTempMin >= rawConfig.dryerHeatingTempMax) {
                if (configError) configError.textContent = 'Náhřev min musí být menší než náhřev max.';
                return;
            }
            if (rawConfig.dryerDischargeMinutesMin >= rawConfig.dryerDischargeMinutesMax) {
                if (configError) configError.textContent = 'Odsyp min musí být menší než odsyp max.';
                return;
            }

            adminThresholds = normalizeAdminThresholds(rawConfig);
            saveAdminThresholds();
            if (configError) configError.textContent = '';
            changeLocation();
        });
    }
    const configResetButton = panel.querySelector('[data-admin-config-reset="1"]');
    if (configResetButton) {
        configResetButton.addEventListener('click', () => {
            adminThresholds = { ...DEFAULT_ADMIN_THRESHOLDS };
            saveAdminThresholds();
            renderAdminAlerts();
            changeLocation();
        });
    }
    const toggleSnoozedButton = panel.querySelector('[data-toggle-snoozed="1"]');
    if (toggleSnoozedButton) {
        toggleSnoozedButton.addEventListener('click', () => {
            adminAlertsUiState.showSnoozed = !adminAlertsUiState.showSnoozed;
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    }
    const clearAccessLogButton = panel.querySelector('[data-clear-access-log="1"]');
    if (clearAccessLogButton) {
        clearAccessLogButton.addEventListener('click', () => {
            const confirmed = window.confirm('Opravdu chcete vymazat historii přihlášení?');
            if (!confirmed) return;
            clearLoginAuditEntries();
            renderAdminAlerts();
        });
    }
    const exportAccessLogButton = panel.querySelector('[data-export-access-log="1"]');
    if (exportAccessLogButton) {
        exportAccessLogButton.addEventListener('click', () => {
            const entries = readLoginAuditEntries();
            if (!entries.length) return;
            downloadLoginAuditCsv(entries);
        });
    }
    const exportManagedAccountsButton = panel.querySelector('[data-export-managed-accounts="1"]');
    if (exportManagedAccountsButton) {
        exportManagedAccountsButton.addEventListener('click', () => {
            downloadManagedAccountsCsv();
        });
    }
    const accessUserFilter = panel.querySelector('#adminAccessUserFilter');
    if (accessUserFilter) {
        accessUserFilter.addEventListener('change', () => {
            adminAlertsUiState.accessUserFilter = accessUserFilter.value || 'all';
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    }
    const accessLocationFilter = panel.querySelector('#adminAccessLocationFilter');
    if (accessLocationFilter) {
        accessLocationFilter.addEventListener('change', () => {
            adminAlertsUiState.accessLocationFilter = accessLocationFilter.value || 'all';
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    }
    const enterpriseForm = panel.querySelector('#adminEnterpriseForm');
    if (enterpriseForm) {
        const enterpriseError = panel.querySelector('#adminEnterpriseError');
        const enterpriseIcoInput = enterpriseForm.querySelector('input[name="enterpriseIco"]');
        const enterpriseNameInput = enterpriseForm.querySelector('input[name="enterpriseName"]');
        const fetchAresButton = enterpriseForm.querySelector('[data-fetch-ares="1"]');

        const hydrateEnterpriseNameFromAres = async () => {
            const ico = normalizeIco(enterpriseIcoInput?.value || '');
            if (enterpriseIcoInput) enterpriseIcoInput.value = ico;
            if (!/^\d{8}$/.test(ico)) {
                if (enterpriseError) enterpriseError.textContent = 'IČO musí mít přesně 8 číslic.';
                return null;
            }
            if (fetchAresButton) fetchAresButton.setAttribute('disabled', 'true');
            if (enterpriseError) enterpriseError.textContent = 'Načítám data z ARES...';
            const result = await fetchAresEnterpriseByIco(ico);
            if (fetchAresButton) fetchAresButton.removeAttribute('disabled');
            if (!result.ok) {
                if (enterpriseError) enterpriseError.textContent = 'Podnik pro zadané IČO nebyl v ARES nalezen.';
                return null;
            }
            if (enterpriseNameInput) enterpriseNameInput.value = result.name;
            if (enterpriseError) enterpriseError.textContent = '';
            return result;
        };

        if (enterpriseIcoInput) {
            enterpriseIcoInput.addEventListener('input', () => {
                enterpriseIcoInput.value = normalizeIco(enterpriseIcoInput.value);
                if (enterpriseError) enterpriseError.textContent = '';
            });
        }
        if (fetchAresButton) {
            fetchAresButton.addEventListener('click', async () => {
                await hydrateEnterpriseNameFromAres();
            });
        }
        enterpriseForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const run = async () => {
                const formData = new FormData(enterpriseForm);
                const inputIco = normalizeIco(formData.get('enterpriseIco') || '');
                let enterpriseName = String(formData.get('enterpriseName') || '').trim();
                let resolvedIco = inputIco;
                if (inputIco && !enterpriseName) {
                    const hydrated = await hydrateEnterpriseNameFromAres();
                    if (!hydrated) return;
                    enterpriseName = hydrated.name;
                    resolvedIco = hydrated.ico;
                }
                if (!enterpriseName) {
                    if (enterpriseError) enterpriseError.textContent = 'Vyplň název podniku nebo načti data z ARES.';
                    return;
                }
                if (inputIco && !/^\d{8}$/.test(inputIco)) {
                    if (enterpriseError) enterpriseError.textContent = 'IČO musí mít přesně 8 číslic.';
                    return;
                }
                const existingEnterpriseIds = new Set(Object.keys(enterprises));
                const suggestedEnterpriseId = resolvedIco
                    ? `ico_${resolvedIco}`
                    : normalizeOrgId(enterpriseName, 'enterprise');
                if (resolvedIco && existingEnterpriseIds.has(suggestedEnterpriseId)) {
                    if (enterpriseError) enterpriseError.textContent = 'Podnik s tímto IČO už existuje.';
                    return;
                }
                const enterpriseId = makeUniqueOrgId(suggestedEnterpriseId, 'enterprise', existingEnterpriseIds);
                ensureCustomEnterprise({ id: enterpriseId, name: enterpriseName, ico: resolvedIco });
                applyCustomOrgStructure();
                if (enterpriseError) enterpriseError.textContent = '';
                renderEnterpriseMenu();
                adminAlertsUiState.activeView = 'enterprises';
                saveAdminAlertsUiState();
                renderAdminAlerts();
            };
            run();
        });
    }
    const locationForm = panel.querySelector('#adminLocationForm');
    if (locationForm) {
        const locationError = panel.querySelector('#adminLocationError');
        const locationSubmitButton = locationForm.querySelector('button[type="submit"]');
        const editLocationInput = locationForm.querySelector('input[name="editLocationId"]');
        const enterpriseSelect = locationForm.querySelector('select[name="enterpriseId"]');
        const existingLocationSelect = locationForm.querySelector('select[name="existingLocationId"]');
        const newLocationNameInput = locationForm.querySelector('input[name="newLocationName"]');
        const silosCountInput = locationForm.querySelector('input[name="silosCount"]');
        const thermometersInput = locationForm.querySelector('input[name="thermometersPerSilo"]');
        const sensorsInput = locationForm.querySelector('input[name="sensorsPerThermometer"]');
        const capacityInput = locationForm.querySelector('input[name="siloCapacityM3"]');
        const hasCleanserInput = locationForm.querySelector('input[name="hasCleanser"]');
        const cleanserAirflowInput = locationForm.querySelector('input[name="cleanserAirflow"]');
        const hasDryerInput = locationForm.querySelector('input[name="hasDryer"]');
        const dryerHeatingInput = locationForm.querySelector('input[name="dryerHeatingTemp"]');
        const dryerDischargeInput = locationForm.querySelector('input[name="dryerDischargeMinutes"]');
        const notesInput = locationForm.querySelector('input[name="notes"]');
        const getEnterpriseLocationIds = (enterpriseId) =>
            Object.keys(locations).filter(locId => locations[locId]?.enterprise === enterpriseId);
        const refreshExistingLocationOptions = (preferredLocationId = '') => {
            if (!existingLocationSelect) return;
            const enterpriseId = String(enterpriseSelect?.value || '');
            const allowedLocationIds = getEnterpriseLocationIds(enterpriseId);
            const selectedLocationId = preferredLocationId || existingLocationSelect.value || '';
            const optionsHtml = [
                '<option value="">Vyber středisko</option>',
                ...allowedLocationIds.map(locId =>
                    `<option value="${escapeHtml(locId)}">${escapeHtml(locations[locId]?.name || locId)} (${escapeHtml(locId)})</option>`
                )
            ].join('');
            existingLocationSelect.innerHTML = optionsHtml;
            if (selectedLocationId && allowedLocationIds.includes(selectedLocationId)) {
                existingLocationSelect.value = selectedLocationId;
            } else {
                existingLocationSelect.value = '';
                if (editLocationInput) editLocationInput.value = '';
                setLocationFormMode('create');
            }
        };
        const fillLocationFields = (locationId) => {
            const location = locations[locationId];
            if (!location) return false;
            const cfg = normalizeLocationMachineConfig(locationMachineConfigs[locationId] || { locationId }, locationId);
            if (editLocationInput) editLocationInput.value = locationId;
            if (enterpriseSelect) enterpriseSelect.value = location.enterprise || '';
            refreshExistingLocationOptions(locationId);
            if (silosCountInput) silosCountInput.value = String(cfg?.silosCount ?? 0);
            if (thermometersInput) thermometersInput.value = String(cfg?.thermometersPerSilo ?? 0);
            if (sensorsInput) sensorsInput.value = String(cfg?.sensorsPerThermometer ?? 0);
            if (capacityInput) capacityInput.value = String(cfg?.siloCapacityM3 ?? 0);
            if (hasCleanserInput) hasCleanserInput.checked = !!cfg?.hasCleanser;
            if (cleanserAirflowInput) cleanserAirflowInput.value = String(cfg?.cleanserAirflow ?? 0);
            if (hasDryerInput) hasDryerInput.checked = !!cfg?.hasDryer;
            if (dryerHeatingInput) dryerHeatingInput.value = String(cfg?.dryerHeatingTemp ?? 0);
            if (dryerDischargeInput) dryerDischargeInput.value = String(cfg?.dryerDischargeMinutes ?? 0);
            if (notesInput) notesInput.value = String(cfg?.notes || '');
            return true;
        };
        const setLocationFormMode = (mode = 'create', locationLabel = '') => {
            if (!locationSubmitButton) return;
            if (mode === 'edit') {
                locationSubmitButton.textContent = 'Uložit zmeny strediska';
                if (locationError) locationError.textContent = `Upravuješ středisko: ${locationLabel || '-'}.`;
                return;
            }
            locationSubmitButton.textContent = 'Uložit stredisko';
        };
        const clearLocationForm = () => {
            locationForm.reset();
            if (editLocationInput) editLocationInput.value = '';
            refreshExistingLocationOptions();
            if (locationError) locationError.textContent = '';
            setLocationFormMode('create');
        };
        if (enterpriseSelect) {
            enterpriseSelect.addEventListener('change', () => {
                refreshExistingLocationOptions();
            });
        }
        if (existingLocationSelect) {
            existingLocationSelect.addEventListener('change', () => {
                const locationId = existingLocationSelect.value;
                if (!locationId) {
                    if (editLocationInput) editLocationInput.value = '';
                    setLocationFormMode('create');
                    return;
                }
                if (newLocationNameInput) newLocationNameInput.value = '';
                const location = locations[locationId];
                fillLocationFields(locationId);
                setLocationFormMode('edit', location?.name || locationId);
            });
        }
        if (newLocationNameInput) {
            newLocationNameInput.addEventListener('input', () => {
                const hasNewName = !!String(newLocationNameInput.value || '').trim();
                if (hasNewName && existingLocationSelect && existingLocationSelect.value) {
                    existingLocationSelect.value = '';
                }
                if (hasNewName) {
                    if (editLocationInput) editLocationInput.value = '';
                    setLocationFormMode('create');
                }
            });
        }

        panel.querySelectorAll('[data-edit-location]').forEach(button => {
            button.addEventListener('click', () => {
                const locationId = button.getAttribute('data-edit-location') || '';
                const location = locations[locationId];
                if (!location) return;
                if (newLocationNameInput) newLocationNameInput.value = '';
                fillLocationFields(locationId);
                setLocationFormMode('edit', location.name || locationId);
                adminAlertsUiState.activeView = 'locations';
                saveAdminAlertsUiState();
                locationForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
        panel.querySelectorAll('[data-delete-location]').forEach(button => {
            button.addEventListener('click', () => {
                const locationId = button.getAttribute('data-delete-location') || '';
                const location = locations[locationId];
                if (!location) return;

                const confirmed = window.confirm(`Smazat středisko ${location.name || locationId}?`);
                if (!confirmed) return;

                removeCustomLocation(locationId);
                delete locationMachineConfigs[locationId];
                saveLocationMachineConfigs();

                managedAccounts = managedAccounts
                    .map(account => {
                        const filteredLocations = (account.locations || []).filter(locId => locId !== locationId);
                        let defaultLocation = account.defaultLocation;
                        if (defaultLocation === locationId) {
                            defaultLocation = filteredLocations[0] || null;
                        }
                        return normalizeManagedAccount({
                            ...account,
                            locations: filteredLocations,
                            defaultLocation
                        });
                    })
                    .filter(account => account.isAdmin || account.locations.length > 0);
                saveManagedAccounts();

                Object.keys(enterprises).forEach(entId => {
                    enterprises[entId].locations = (enterprises[entId].locations || []).filter(locId => locId !== locationId);
                });
                delete locations[locationId];

                if (currentLocation === locationId) {
                    const fallback = getEnterpriseLocationKeys()[0] || Object.keys(locations)[0] || '';
                    currentLocation = fallback;
                }
                if (currentEnterprise && (!enterprises[currentEnterprise] || !(enterprises[currentEnterprise].locations || []).length)) {
                    currentEnterprise = getAllowedEnterprises()[0] || '';
                }

                clearLocationForm();
                if (locationError) locationError.textContent = '';
                adminAlertsUiState.activeView = 'locations';
                saveAdminAlertsUiState();
                renderAdminAlerts();
                renderEnterpriseMenu();
                changeLocation();
            });
        });

        const resetLocationFormButton = panel.querySelector('[data-location-form-reset="1"]');
        if (resetLocationFormButton) {
            resetLocationFormButton.addEventListener('click', () => {
                clearLocationForm();
            });
        }

        const exportLocationConfigButton = panel.querySelector('[data-export-location-config="1"]');
        if (exportLocationConfigButton) {
            exportLocationConfigButton.addEventListener('click', () => {
                downloadLocationMachineConfigCsv();
            });
        }

        locationForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(locationForm);
            const enterpriseId = String(formData.get('enterpriseId') || '').trim();
            const selectedLocationId = String(formData.get('existingLocationId') || '').trim();
            const newLocationName = String(formData.get('newLocationName') || '').trim();
            const existingLocationIds = new Set(Object.keys(locations));
            let locationId = '';
            let locationName = '';
            if (selectedLocationId && newLocationName) {
                if (locationError) locationError.textContent = 'Vyber stávající středisko nebo zadej nové, ne oboje současně.';
                return;
            }
            if (selectedLocationId) {
                if (!locations[selectedLocationId]) {
                    if (locationError) locationError.textContent = 'Vyber existující středisko pro úpravu.';
                    return;
                }
                locationId = normalizeOrgId(selectedLocationId, 'location');
                locationName = locations[selectedLocationId]?.name || selectedLocationId;
                if (editLocationInput) editLocationInput.value = locationId;
            } else {
                if (!newLocationName) {
                    if (locationError) locationError.textContent = 'Vyplň název nového střediska.';
                    return;
                }
                locationName = newLocationName;
                const locationSeed = `${enterpriseId}_${locationName}`;
                locationId = makeUniqueOrgId(locationSeed, 'location', existingLocationIds);
            }

            if (!enterpriseId || !enterprises[enterpriseId]) {
                if (locationError) locationError.textContent = 'Vyber existující podnik.';
                return;
            }
            if (!customOrgStructure.enterprises.some(item => item.id === enterpriseId) && !enterprises[enterpriseId]) {
                if (locationError) locationError.textContent = 'Podnik neexistuje.';
                return;
            }
            // If location is attached to a built-in enterprise, keep enterprise catalog in custom state in sync.
            if (!customOrgStructure.enterprises.some(item => item.id === enterpriseId) && enterprises[enterpriseId]) {
                ensureCustomEnterprise({ id: enterpriseId, name: enterprises[enterpriseId].name || enterpriseId });
            }
            ensureCustomLocation({ id: locationId, name: locationName, enterpriseId });
            applyCustomOrgStructure();
            const cfgResult = upsertLocationMachineConfig({
                locationId,
                enterpriseId,
                locationName,
                silosCount: formData.get('silosCount'),
                thermometersPerSilo: formData.get('thermometersPerSilo'),
                sensorsPerThermometer: formData.get('sensorsPerThermometer'),
                siloCapacityM3: formData.get('siloCapacityM3'),
                hasCleanser: formData.get('hasCleanser') === 'on',
                cleanserAirflow: formData.get('cleanserAirflow'),
                hasDryer: formData.get('hasDryer') === 'on',
                dryerHeatingTemp: formData.get('dryerHeatingTemp'),
                dryerDischargeMinutes: formData.get('dryerDischargeMinutes'),
                notes: formData.get('notes')
            });
            if (!cfgResult.ok) {
                if (locationError) locationError.textContent = 'Konfiguraci střediska se nepodařilo uložit.';
                return;
            }
            if (locationError) locationError.textContent = '';
            adminAlertsUiState.activeView = 'locations';
            saveAdminAlertsUiState();
            renderAdminAlerts();
            renderEnterpriseMenu();
            changeLocation();
        });
        refreshExistingLocationOptions();
        setLocationFormMode('create');
    }
    const createUserForm = panel.querySelector('#adminUserCreateForm');
    const rightsForm = panel.querySelector('#adminUserRightsForm');
    let fillAccountForm = null;
    if (rightsForm) {
        const locationItems = Array.from(rightsForm.querySelectorAll('.admin-users-location-item'));
        const defaultLocationSelect = rightsForm.querySelector('#adminAccountDefaultLocation');
        const editCodeInput = rightsForm.querySelector('input[name="editCode"]');
        const rightsUserSelect = rightsForm.querySelector('#adminRightsUserCode');
        const usersError = rightsForm.querySelector('#adminUsersError');
        const resetFormButton = rightsForm.querySelector('[data-account-form-reset="1"]');

        const getLocationCheckboxes = () =>
            locationItems
                .map(item => item.querySelector('input[type="checkbox"][name="locations"]'))
                .filter(Boolean);

        const syncDefaultLocationSelect = (preferredValue = '') => {
            if (!defaultLocationSelect) return;
            const checked = getLocationCheckboxes().filter(cb => cb.checked);
            const options = checked.map(cb => cb.value);
            const targetValue = options.includes(preferredValue)
                ? preferredValue
                : (options[0] || '');
            defaultLocationSelect.innerHTML = options.length
                ? options.map(locId => `<option value="${escapeHtml(locId)}">${escapeHtml(locations[locId]?.name || locId)}</option>`).join('')
                : '<option value="">Vyber středisko</option>';
            defaultLocationSelect.value = targetValue;
        };

        const clearRightsForm = () => {
            if (editCodeInput) editCodeInput.value = '';
            if (rightsUserSelect) rightsUserSelect.value = '';
            if (usersError) usersError.textContent = '';
            locationItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"][name="locations"]');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = false;
                }
            });
            if (defaultLocationSelect) defaultLocationSelect.value = '';
            if (defaultLocationSelect) defaultLocationSelect.disabled = false;
            syncDefaultLocationSelect('');
        };

        fillAccountForm = (account) => {
            if (!account) return;
            if (editCodeInput) editCodeInput.value = account.code;
            if (rightsUserSelect) rightsUserSelect.value = account.code;
            const isAdmin = !!account.isAdmin;
            locationItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"][name="locations"]');
                if (!checkbox) return;
                checkbox.checked = isAdmin ? true : account.locations.includes(checkbox.value);
                checkbox.disabled = isAdmin;
            });
            if (isAdmin) {
                if (defaultLocationSelect) {
                    const allLocs = Object.keys(locations);
                    defaultLocationSelect.innerHTML = allLocs.length
                        ? allLocs.map(locId => `<option value="${escapeHtml(locId)}">${escapeHtml(locations[locId]?.name || locId)}</option>`).join('')
                        : '<option value="">Vyber středisko</option>';
                    defaultLocationSelect.value = account.defaultLocation || allLocs[0] || '';
                    defaultLocationSelect.disabled = false;
                }
            } else {
                if (defaultLocationSelect) defaultLocationSelect.disabled = false;
                syncDefaultLocationSelect(account.defaultLocation || '');
            }
            if (usersError) usersError.textContent = '';
        };

        if (rightsUserSelect) {
            rightsUserSelect.addEventListener('change', () => {
                const code = String(rightsUserSelect.value || '');
                const account = managedAccounts.find(item => item.code === code);
                if (!account) {
                    clearRightsForm();
                    return;
                }
                fillAccountForm(account);
            });
        }
        locationItems.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"][name="locations"]');
            if (!checkbox) return;
            checkbox.addEventListener('change', () => {
                syncDefaultLocationSelect(defaultLocationSelect?.value || '');
            });
        });
        if (resetFormButton) {
            resetFormButton.addEventListener('click', () => {
                clearRightsForm();
            });
        }
        rightsForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const code = String(editCodeInput?.value || '').trim();
            const selectedLocations = getLocationCheckboxes().filter(cb => cb.checked).map(cb => cb.value);
            const defaultLocation = String(defaultLocationSelect?.value || '');
            const account = managedAccounts.find(item => item.code === code);
            const isAdmin = !!account?.isAdmin;

            if (!account) {
                if (usersError) usersError.textContent = 'Vyber nejdřív existujícího uživatele.';
                return;
            }
            if (!isAdmin && !selectedLocations.length) {
                if (usersError) usersError.textContent = 'Vyber aspoň jedno středisko.';
                return;
            }
            if (!isAdmin && !selectedLocations.includes(defaultLocation)) {
                if (usersError) usersError.textContent = 'Výchozí středisko musí být z vybraných středisek.';
                return;
            }

            const result = upsertManagedAccount({
                code,
                label: account.label,
                enterpriseId: '',
                locations: isAdmin ? Object.keys(locations) : selectedLocations,
                defaultLocation: isAdmin ? (defaultLocation || Object.keys(locations)[0] || null) : defaultLocation,
                active: account.active !== false,
                isAdmin
            });
            if (!result.ok) {
                if (usersError) usersError.textContent = 'Uživatele se nepodařilo uložit.';
                return;
            }
            if (usersError) usersError.textContent = '';
            adminAlertsUiState.activeView = 'users';
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });

        clearRightsForm();
    }
    if (createUserForm) {
        const createError = createUserForm.querySelector('#adminUserCreateError');
        const createCodeInput = createUserForm.querySelector('input[name="code"]');
        const createLabelInput = createUserForm.querySelector('input[name="label"]');
        const createAdminInput = createUserForm.querySelector('input[name="isAdmin"]');
        if (createCodeInput) {
            createCodeInput.addEventListener('input', () => {
                createCodeInput.value = createCodeInput.value.replace(/\D/g, '').slice(0, 6);
            });
        }
        createUserForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const code = String(createCodeInput?.value || '').replace(/\D/g, '').slice(0, 6);
            const label = String(createLabelInput?.value || '').trim();
            const isAdmin = !!createAdminInput?.checked;
            if (!label) {
                if (createError) createError.textContent = 'Vyplň název uživatele.';
                return;
            }
            if (!/^\d{6}$/.test(code)) {
                if (createError) createError.textContent = 'Kód musí mít přesně 6 číslic.';
                return;
            }
            if (code === ADMIN_ACCESS_CODE) {
                if (createError) createError.textContent = 'Tento kód je vyhrazený pro hlavní admin účet.';
                return;
            }
            if (managedAccounts.some(acc => acc.code === code)) {
                if (createError) createError.textContent = 'Kód je už použitý.';
                return;
            }
            const result = upsertManagedAccount({
                code,
                label,
                enterpriseId: '',
                locations: [],
                defaultLocation: null,
                active: true,
                isAdmin
            });
            if (!result.ok) {
                if (createError) createError.textContent = 'Uživatele se nepodařilo založit.';
                return;
            }
            if (createError) createError.textContent = '';
            adminAlertsUiState.activeView = 'users';
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    }
    panel.querySelectorAll('[data-edit-account]').forEach(button => {
        button.addEventListener('click', () => {
            const code = button.getAttribute('data-edit-account') || '';
            const account = managedAccounts.find(item => item.code === code);
            if (!account || !fillAccountForm) return;
            fillAccountForm(account);
        });
    });
    panel.querySelectorAll('[data-delete-account]').forEach(button => {
        button.addEventListener('click', () => {
            const code = button.getAttribute('data-delete-account') || '';
            const account = managedAccounts.find(item => item.code === code);
            if (!account) return;
            if (accessState.code === code) {
                window.alert('Nemůžeš smazat účet, pod kterým jsi právě přihlášen.');
                return;
            }
            const confirmed = window.confirm(`Smazat účet ${account.label} (${account.code})?`);
            if (!confirmed) return;
            removeManagedAccount(code);
            adminAlertsUiState.activeView = 'users';
            saveAdminAlertsUiState();
            renderAdminAlerts();
        });
    });
    scheduleAlertSnoozeRefresh();
}


