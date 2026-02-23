let currentLocation = '';
let currentEnterprise = '';
let modalPeriod = '1y';
let modalState = { open: false, type: 'overview', siloKey: '', siloName: '' };
let mapState = { open: false, locationId: '' };

let enterprises = {};
let locations = {};
let historySeries = {};
let fanHistory = {};
let fanSeries = {};
let levelSeries = {};
let lastDataTimestamp = 0;
let faultyThermometerKeys = [];

let accessState = { code: '', label: '', allowedLocations: null, defaultLocation: null, isAdmin: false };
let isAuthenticated = false;
let lastLoginAttempt = 0;
let uiInitialized = false;
let loginInitialized = false;
let mapConfigLoaded = false;
let docsRenderToken = 0;
let alertSnoozeState = {};
let alertSnoozeTimeout = null;
let adminThresholds = { ...DEFAULT_ADMIN_THRESHOLDS };
let managedAccounts = [];
let customOrgStructure = { enterprises: [], locations: [], removedLocations: [] };
let locationMachineConfigs = {};
let lastViewAudit = { key: '', timestamp: 0 };
let adminAlertsUiState = {
    collapsed: false,
    showSnoozed: false,
    showConfig: false,
    showAccessLog: false,
    panelVisible: false,
    activeView: 'alerts',
    accessUserFilter: 'all',
    accessLocationFilter: 'all'
};

