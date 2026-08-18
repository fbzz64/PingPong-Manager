// ==========================================
// TESTS/ENV.JS - Carga los módulos del app en un contexto aislado
// ==========================================
// Emula window/document/localStorage mínimos para poder ejecutar
// reglamento.js, storage.js y brackets.js en Node sin navegador.
// window.tournamentData y la variable global tournamentData apuntan al
// MISMO objeto (como en el navegador, donde la declaración global se
// refleja en window), para que reassigns de tournamentData funcionen.
// ==========================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// Console que silencia los mensajes de "X cargado correctamente"
const silentConsole = new Proxy(console, {
    get(t, k) {
        return (...args) => {
            if (k === 'log') {
                const s = args.join(' ');
                if (/cargado correctamente$/.test(s)) return;
            }
            return t[k](...args);
        };
    }
});

function makeFakeDocument() {
    return {
        getElementById: (id) => ({ id, disabled: false, style: {}, value: '', textContent: '' }),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
        head: { appendChild() {} },
        body: { appendChild() {} },
        addEventListener: () => {}
    };
}

function makeFakeStorage() {
    const store = {};
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
}

function defaultTournamentData() {
    return {
        fixtures: [],
        players: [],
        brackets: [],
        waitlist: [],
        logs: [],
        settings: {
            torneoNombre: 'Torneo Test',
            subtitulo: '',
            lugar: '',
            fechaInicio: '',
            fechaFin: '',
            organizadores: '',
            patrocinadores: [],
            mesas: 4,
            formato: 'Todos contra todos + llaves eliminatorias',
            duracionPartido: 15,
            formatoPartidoGrupos: 'bo5',
            formatoPartidoLlaves: 'bo5'
        }
    };
}

/**
 * Crea un entorno aislado con los stubs necesarios para los módulos.
 * @param {Object} extra - Globals adicionales (stubs de funciones de UI, etc.)
 */
function createEnv(extra = {}) {
    const sandbox = {
        console: silentConsole,
        document: makeFakeDocument(),
        localStorage: makeFakeStorage(),
        setTimeout,
        clearTimeout,
        Blob: class { constructor(parts) { this.parts = parts; } },
        File: class { constructor(parts, name) { this.parts = parts; this.name = name; } },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
        FileReader: class {},
        navigator: {},
        DEFAULT_ELO: 1200,
        tournamentData: defaultTournamentData(),
        currentPlayers: [],
        ...extra
    };

    // window === global del sandbox: así window.X = ... queda disponible como
    // global (igual que en el navegador) y bare tournamentData === window.tournamentData.
    sandbox.window = sandbox;

    const ctx = vm.createContext(sandbox);

    return {
        sandbox,
        ctx,
        get window() { return sandbox; },
        get tournamentData() { return sandbox.tournamentData; }
    };
}

/** Ejecuta un archivo del app dentro del contexto del entorno. */
function loadInto(env, relPath) {
    const file = path.join(ROOT, relPath);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, env.ctx, { filename: file });
    return env;
}

/**
 * Carga la app en un mismo contexto con stubs de UI. El entorno base trae
 * reglamento + storage + brackets; con `extraModules` se agregan otros
 * módulos (p. ej. 'js/fixtures.js', 'js/elo.js').
 */
function loadApp(extraModules = []) {
    const env = createEnv();

    const stubs = {
        showToast: () => {},
        addLog: () => {},
        updateDashboard: () => {},
        updateFixtureNavigator: () => {},
        reloadSettingsInputs: () => {},
        loadCustomCategories: () => {},
        renderBracketInteractive: () => {},
        renderBracketsForTab: () => {},
        showModal: () => {},
        calculateStats: () => {},
        showAllPlayers: () => {},
        showLogs: () => {},
        renderChangelogPage: () => {},
        renderCategoriesManager: () => {},
        renderTemplateList: () => {},
        renderWaitlistSection: () => {},
        restoreLastFixtureSelection: () => {},
        setupKeyboardShortcuts: () => {},
        updateInstallAppButton: () => {},
        formatPlayerName: (n) => String(n == null ? '' : n),
        formatPlayerClub: (c) => String(c == null ? '' : c),
        escHtml: (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
        escAttr: (s) => String(s == null ? '' : s).replace(/"/g, '&quot;')
    };

    // Disponibles tanto como global como window.X (los módulos los usan así)
    for (const [k, v] of Object.entries(stubs)) {
        env.sandbox[k] = v;
        env.window[k] = v;
    }

    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/reglamento.js');
    loadInto(env, 'js/storage.js');
    loadInto(env, 'js/brackets.js');
    extraModules.forEach(mod => loadInto(env, mod));
    return env;
}

module.exports = { createEnv, loadInto, loadApp, ROOT };
