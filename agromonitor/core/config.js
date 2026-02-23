const currentUserRole = 'MASTER';
const AUTH_STORAGE_KEY = 'agromonitor_access_v1';
const AUTH_LOCK_KEY = 'agromonitor_lock_v1';
const ALERT_SNOOZE_STORAGE_KEY = 'agromonitor_alert_snooze_v1';
const ADMIN_ALERTS_UI_STORAGE_KEY = 'agromonitor_admin_alerts_ui_v1';
const ADMIN_CONFIG_STORAGE_KEY = 'agromonitor_admin_config_v1';
const LOGIN_AUDIT_STORAGE_KEY = 'agromonitor_login_audit_v1';
const MANAGED_ACCOUNTS_STORAGE_KEY = 'agromonitor_managed_accounts_v1';
const ORG_STRUCTURE_STORAGE_KEY = 'agromonitor_org_structure_v1';
const LOCATION_MACHINE_CONFIG_STORAGE_KEY = 'agromonitor_location_machine_config_v1';
const LOGIN_AUDIT_MAX_ENTRIES = 800;
const VIEW_AUDIT_DEDUPE_MS = 15 * 1000;
const MANAGED_ACCOUNTS_CSV_URL = 'data/users/accounts.csv';
const LOCATION_MACHINE_CONFIG_CSV_URL = 'data/users/location-machine-config.csv';
const DEMO_SNOOZE_PRESETS = [
    { label: '1 min', durationMs: 1 * 60 * 1000 },
    { label: '1 h', durationMs: 60 * 60 * 1000 },
    { label: '1 den', durationMs: 24 * 60 * 60 * 1000 }
];
const ACCESS_CODES = {
    '123456': { label: 'Admin', locations: ['melkovice', 'stranecka', 'brniste'], defaultLocation: 'melkovice' },
    '234567': { label: 'ZOD Brniště a.s.', locations: ['brniste'], defaultLocation: 'brniste' },
    '345678': { label: 'Agro Vysočina s.r.o.', locations: ['melkovice', 'stranecka'], defaultLocation: 'melkovice' }
};
const ADMIN_ACCESS_CODE = '123456';
const DEFAULT_ADMIN_THRESHOLDS = {
    tempMin: 5,
    tempMax: 20,
    offlineMinutes: 30,
    cleanserAirflowMin: 20,
    cleanserAirflowMax: 70,
    dryerHeatingTempMin: 55,
    dryerHeatingTempMax: 95,
    dryerDischargeMinutesMin: 8,
    dryerDischargeMinutesMax: 35
};
const BAD_COOLING_MIN_TEMP = 20.5;
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
const USE_SYNTHETIC_HISTORY = false;
const ENABLE_FAULTY_THERMOMETERS = false;
const MAP_CONFIG = {
    melkovice: { image: 'Mělkovice.JPG', markers: [] },
    stranecka: { image: 'Stránecká Zhoř.JPG', markers: [] },
    brniste: { image: 'Brniště.JPG', markers: [] }
};
const MAP_CONFIG_URL = 'map-config.json';
const ONE_DRIVE_FOLDERS = {
    // `url` je odkaz na kořenovou OneDrive složku střediska.
    // Volitelné: `itemUrlTemplate` pro odkazy na konkrétní soubory/složky.
    // Priklad: 'https://contoso.sharepoint.com/.../{path}'
    melkovice: { url: 'https://onedrive.live.com/' },
    stranecka: { url: 'https://onedrive.live.com/' },
    brniste: { url: 'https://onedrive.live.com/' }
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;

