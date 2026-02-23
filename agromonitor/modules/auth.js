// Login and access flow

function readAuthFromStorage() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const codes = getAllAccessCodes();
        if (!parsed || !parsed.code || !codes[parsed.code]) return null;
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
        if (error.textContent && error.textContent.includes('blokované')) {
            error.textContent = '';
        }
    }
}

function showLoginScreen() {
    const login = document.getElementById('loginScreen');
    const appRoot = document.getElementById('appRoot');
    if (login) login.setAttribute('aria-hidden', 'false');
    if (appRoot) appRoot.setAttribute('aria-hidden', 'true');
    updateEnterprisePickerVisibility(false);
    updateLoginLockUI();
    renderAdminAlerts();
}

function showAppScreen() {
    const login = document.getElementById('loginScreen');
    const appRoot = document.getElementById('appRoot');
    if (login) login.setAttribute('aria-hidden', 'true');
    if (appRoot) appRoot.setAttribute('aria-hidden', 'false');
}

function updateEnterprisePickerVisibility(visible) {
    const enterprisePicker = document.getElementById('enterprisePicker');
    if (!enterprisePicker) return;

    const beforeSep = enterprisePicker.previousElementSibling;
    const afterSep = enterprisePicker.nextElementSibling;
    const trigger = document.getElementById('enterpriseTrigger');

    enterprisePicker.style.display = visible ? '' : 'none';
    if (beforeSep && beforeSep.classList.contains('header-separator')) {
        beforeSep.style.display = visible ? '' : 'none';
    }
    if (afterSep && afterSep.classList.contains('header-separator')) {
        afterSep.style.display = visible ? '' : 'none';
    }

    if (trigger) {
        if (visible) trigger.removeAttribute('disabled');
        else trigger.setAttribute('disabled', 'true');
    }
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
        label: access.label || 'Uživatel',
        allowedLocations: access.locations || null,
        defaultLocation: access.defaultLocation || (access.locations || [])[0] || null,
        isAdmin: !!access.isAdmin
    };
    recordLoginAccess(accessState.label, { source: options.skipSave ? 'auto' : 'manual' });
    if (!options.skipSave) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ code }));
    }
    clearLockState();
    showAppScreen();
    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = accessState.label;
    }
    updateEnterprisePickerVisibility(isAdminUser());
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

        const access = getAllAccessCodes()[code];
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
        accessState = { code: '', label: '', allowedLocations: null, defaultLocation: null, isAdmin: false };
        showLoginScreen();
    });
}


