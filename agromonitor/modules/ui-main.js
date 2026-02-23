// Main UI rendering and interactions

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
        return '<div class="chart-empty">Není k dispozici historie</div>';
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
    const gapBreakMs = 2 * MS_PER_DAY;
    const splitByGap = (arr, breakMs) => {
        if (!arr.length) return [];
        const segments = [];
        let current = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
            if ((arr[i].t - arr[i - 1].t) > breakMs) {
                if (current.length > 1) segments.push(current);
                current = [arr[i]];
                continue;
            }
            current.push(arr[i]);
        }
        if (current.length > 1) segments.push(current);
        return segments;
    };
    const segments = splitByGap(series, gapBreakMs);
    const renderTempSegments = (pickValue, className) =>
        segments.map(segment => {
            const points = segment.map(p => `${scaleX(p.t, tMin, tMax)},${scaleY(pickValue(p))}`).join(' ');
            return `<polyline class="${className}" points="${points}" />`;
        }).join('');

    const avgPolylines = renderTempSegments(p => p.avg, 'chart-line chart-line-strong');
    const minPolylines = renderTempSegments(p => p.min, 'chart-line chart-line-soft');
    const maxPolylines = renderTempSegments(p => p.max, 'chart-line chart-line-soft');

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
            aria-label="Teplotní historie"
            data-chart="time"
            data-t-min="${tMin}"
            data-t-max="${tMax}"
            data-width="${width}"
            data-height="${height}"
            data-padding="${padding}">
            ${bandRects}
            ${axes}
            ${minPolylines}
            ${maxPolylines}
            ${avgPolylines}
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
        return '<div class="chart-empty">Není k dispozici historie</div>';
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
        return '<div class="chart-empty">Není k dispozici historie</div>';
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
    const siloKey = `${locationId}:${silo.id}`;
    const hasHistoryData = Array.isArray(historySeries[siloKey]) && historySeries[siloKey].length > 0;
    const isVirtualNoData = !!silo.isVirtual && !hasHistoryData;

    let probesHTML = '';

    const thermometerIds = silo.thermometerIds;
    thermometerIds.forEach((thermId) => {
        let sensorsHTML = '';
        const sensorIds = silo.sensorIdsByThermometer[thermId] || [];

        sensorIds.forEach((sensorId) => {
            let temp = 0, depth = 0;
            let hasSensorData = false;
            if (silo.temperatureData[thermId] && silo.temperatureData[thermId][sensorId]) {
                temp = silo.temperatureData[thermId][sensorId].temperature;
                depth = silo.temperatureData[thermId][sensorId].depth;
                hasSensorData = Number.isFinite(parseFloat(temp));
            }

            const tempClass = hasSensorData ? getTemperatureClass(temp) : 'temp-normal';
            const isActive = depth <= levelMeters;
            const sensorLabel = isActive
                ? (hasSensorData ? temp : 'N/A')
                : '-';
            const sensorTitle = isActive
                ? (hasSensorData ? `Hloubka ${depth}m: ${temp}C` : `Hloubka ${depth}m: data chybi`)
                : 'Neaktivni - nad hladinou';

            sensorsHTML += `<div class="sensor ${tempClass} ${!isActive ? 'inactive' : ''}"
                data-temp="${temp}"
                data-depth="${depth}"
                title="${sensorTitle}">
                ${sensorLabel}
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
    const series = getSeriesForSilo(siloKey, '30d', 90);
    const bands = getVentBands(siloKey, '30d');
    const chartHtml = buildTempChartSvg(series, { cssClass: 'history-chart', showAxes: false, padding: 10, bands, periodDays: 30 });
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
        <div class="silo-card" data-problem-target="silo:${silo.id}">
            <div class="silo-header">
                <div class="silo-name">${silo.name}</div>
                <div class="silo-commodity">${silo.commodity}</div>
            </div>
            ${isVirtualNoData ? '<div class="load-error">Virtuální komponenta: data zatím chybí.</div>' : ''}
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

            ${''}
        </div>
    `;
}

function renderCleanserCard(location) {
    const airflow = Math.round(location.cleanserAirflow || 0);
    const safeAirflow = clamp(airflow, 0, 100);
    const airflowOk = safeAirflow >= adminThresholds.cleanserAirflowMin && safeAirflow <= adminThresholds.cleanserAirflowMax;
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - safeAirflow / 100);

    return `
        <div class="silo-card cleanser-card" data-problem-target="cleanser">
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
    const virtualMissingCount = location.silos.filter(silo => {
        const key = `${locationKey}:${silo.id}`;
        const hasHistory = Array.isArray(historySeries[key]) && historySeries[key].length > 0;
        return !!silo.isVirtual && !hasHistory;
    }).length;
    const missingDataNotice = virtualMissingCount > 0
        ? `<div class="load-error">Středisko obsahuje ${virtualMissingCount} virtuálních sil bez dat. Vizualizace je připravena, čekám na telemetrii.</div>`
        : '';
    document.getElementById('silosContainer').innerHTML = `${missingDataNotice}<div class="silos-grid">${silosHTML}${cleanserHTML}</div>`;

    const allowedLocations = isAdminUser()
        ? Object.keys(locations)
        : (Array.isArray(accessState.allowedLocations) && accessState.allowedLocations.length
            ? accessState.allowedLocations
            : Object.keys(locations));
    const alarmHistoryParams = new URLSearchParams({
        location: location.id,
        allowed: allowedLocations.join(',')
    });
    const alarmHistoryUrl = `alarm-history.html?${alarmHistoryParams.toString()}`;
    const logHTML = `
        <div class="alarm-summary">Každá linka sbírá všechny poruchy a závady do centrální tabulky.</div>
        <a class="alarm-history-link" href="${alarmHistoryUrl}" target="_blank" rel="noopener noreferrer">Otevřít historii alarmů</a>
    `;
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
    recordLocationView(currentLocation, { source: 'auto' });
    renderEnterpriseMenu();
}

function showNoAccess() {
    const container = document.getElementById('silosContainer');
    if (container) {
        container.innerHTML = '<div class="load-error">Pro tento kód nejsou přiřazena žádná střediska.</div>';
    }
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
            recordLocationView(currentLocation, { source: 'manual' });
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

function setupChartInteractions() {
    const tempSections = document.querySelectorAll('.history-section');
    const levelDisplays = document.querySelectorAll('.level-display');

    tempSections.forEach(section => {
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


