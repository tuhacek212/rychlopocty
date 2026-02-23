// Map and silo detail modal

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
    const tempGapBreakMs = 2 * MS_PER_DAY;
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
    const tempSegments = splitByGap(tempInRange, tempGapBreakMs);
    const renderTempLineSegments = (segments, className, dataSeries, pickValue) =>
        segments.map(segment => {
            const points = segment.map(p => `${scaleX(p.t)},${scaleTempY(pickValue(p))}`).join(' ');
            return `<polyline class="overview-line ${className}" data-series="${dataSeries}" points="${points}" />`;
        }).join('');

    const tempMinSeries = tempInRange.map(p => ({
        t: p.t,
        x: scaleX(p.t),
        y: scaleTempY(p.min)
    }));
    const tempMinYByTime = new Map(tempMinSeries.map(p => [p.t, p.y]));
    const tempMinPolylines = renderTempLineSegments(tempSegments, 'overview-temp-min', 'tempMin', p => p.min);
    const tempMaxPolylines = renderTempLineSegments(tempSegments, 'overview-temp-max', 'tempMax', p => p.max);
    const tempAvgPolylines = renderTempLineSegments(tempSegments, 'overview-temp-avg', 'tempAvg', p => p.avg);
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
            if ((b.t - a.t) > tempGapBreakMs) continue;
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

            ${tempMinPolylines}
            ${tempMaxPolylines}
            ${tempAvgPolylines}
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
    const buttons = document.querySelectorAll('[data-open-map]');
    const modal = document.getElementById('mapModal');
    const exportButton = document.getElementById('mapExportButton');
    if (!modal) return;
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-open-map');
            const detailLocation = modalState.siloKey ? String(modalState.siloKey).split(':')[0] : '';
            const locationId = mode === 'detail'
                ? (detailLocation || currentLocation || getEnterpriseLocationKeys()[0])
                : (currentLocation || getEnterpriseLocationKeys()[0]);
            if (locationId) {
                openMapModal(locationId);
            }
        });
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


