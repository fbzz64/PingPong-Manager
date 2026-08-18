// ==========================================
// TESTS/MAIN.TEST.JS - Inicialización, PWA y auto-guardado (js/main.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

function makeEl(id, classes) {
    const el = {
        id: id || '',
        classes: new Set(classes || []),
        textContent: '',
        attrs: {},
        style: {},
        value: '',
        classList: {
            add: (c) => el.classes.add(c),
            remove: (c) => el.classes.delete(c),
            contains: (c) => el.classes.has(c),
            toggle: (c) => el.classes.has(c) ? el.classes.delete(c) : el.classes.add(c)
        },
        setAttribute(k, v) { el.attrs[k] = v; },
        getAttribute(k) { return el.attrs[k]; },
        appendChild() {},
        removeChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        closest() { return null; },
        focus() {},
        children: []
    };
    return el;
}

suite('MAIN (main.js)', () => {
    const docListeners = {};
    const winListeners = {};
    const intervals = [];
    const doc = {
        els: {},
        getElementById: (id) => {
            if (!doc.els[id]) doc.els[id] = makeEl(id);
            return doc.els[id];
        },
        querySelector: (sel) => null,
        querySelectorAll: () => [],
        addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
        createElement: () => makeEl(''),
        body: makeEl('body'),
        head: makeEl('head'),
        setSelector: (sel, list) => {
            doc.querySelector = (q) => q === sel ? (list[0] || null) : null;
            doc.querySelectorAll = (q) => q === sel ? list : [];
        }
    };
    const env = createEnv({
        document: doc,
        addEventListener: (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return 0; },
        matchMedia: () => ({ matches: false }),
        location: { protocol: 'https:' },
        navigator: { serviceWorker: {} }
    });
    const S = env.sandbox;
    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/main.js');

    const TD = () => vm.runInContext('tournamentData', env.ctx);
    const initSys = () => vm.runInContext('initializeSystem', env.ctx)();
    const updBtn = () => vm.runInContext('updateInstallAppButton', env.ctx)();
    const setDeferred = (expr) => vm.runInContext('deferredInstallPrompt = ' + expr, env.ctx);

    function fireWindow(ev, data) {
        (winListeners[ev] || []).forEach(fn => fn(data));
    }
    function fireDoc(ev, data) {
        (docListeners[ev] || []).forEach(fn => fn(data));
    }
    function resetBtnCalls() { vm.runInContext('_updBtnCalls = 0', env.ctx); }
    // Sustituye updateInstallAppButton por un contador (debe correr dentro de un
    // test: el runner difiere la ejecución y un reassign a nivel de suite correría
    // antes que TODOS los tests, rompiendo el test de estados reales).
    function useBtnCounter() {
        vm.runInContext('updateInstallAppButton = function() { _updBtnCalls = (_updBtnCalls || 0) + 1; };', env.ctx);
    }

    const toasts = [];
    S.showToast = (m, t) => toasts.push({ m, t });

    function setupInitStubs(calls) {
        S.loadTournamentData = () => calls.push('loadTournamentData');
        S.applyTheme = () => calls.push('applyTheme');
        S.updateDashboard = () => calls.push('updateDashboard');
        S.loadCustomCategories = () => calls.push('loadCustomCategories');
        S.renderCategoriesManager = () => calls.push('renderCategoriesManager');
        S.renderTemplateList = () => calls.push('renderTemplateList');
        S.renderWaitlistSection = () => calls.push('renderWaitlistSection');
        S.renderChangelogPage = () => calls.push('renderChangelogPage');
        S.restoreLastFixtureSelection = () => calls.push('restoreLastFixtureSelection');
        S.setupKeyboardShortcuts = () => calls.push('setupKeyboardShortcuts');
        S.loadPatrocinadoresList = () => calls.push('loadPatrocinadoresList');
        S.resetUndoHistory = () => calls.push('resetUndoHistory');
    }

    test('initializeSystem: inicializa todo y abre dashboard por defecto', () => {
        const calls = [];
        setupInitStubs(calls);
        let shown = null;
        S.showTab = (t) => { shown = t; };
        toasts.length = 0;
        S.localStorage.removeItem('ttmActiveTab');
        initSys();
        assert(calls.includes('loadTournamentData'), 'carga datos');
        assert(calls.includes('applyTheme'), 'aplica tema');
        assert(calls.includes('updateDashboard'), 'dashboard');
        assert(calls.includes('renderCategoriesManager') && calls.includes('renderTemplateList') && calls.includes('renderWaitlistSection'), 'planificación');
        assert(calls.includes('renderChangelogPage'), 'bitácora');
        assert(calls.includes('setupKeyboardShortcuts'), 'atajos');
        assert(calls.includes('loadPatrocinadoresList'), 'sponsors');
        assert(calls.includes('resetUndoHistory'), 'historial');
        assertEqual(shown, 'dashboard', 'default dashboard');
        assertEqual(toasts[toasts.length - 1].m, 'Sistema listo para usar');
    });

    test('initializeSystem: restaura la última pestaña guardada', () => {
        const calls = [];
        setupInitStubs(calls);
        let shown = null;
        S.showTab = (t) => { shown = t; };
        S.localStorage.setItem('ttmActiveTab', 'stats');
        doc.setSelector('.tab[data-tab="stats"]', [makeEl('', ['tab'])]);
        initSys();
        assertEqual(shown, 'stats', 'restaura stats');
    });

    test('updateInstallAppButton: instalado, protocolo, soporte y prompt', () => {
        vm.runInContext('isAppInstalled = true', env.ctx);
        updBtn();
        assertEqual(doc.els['btn-install-app'].textContent, '✅ Aplicación instalada');
        assertEqual(doc.els['btn-install-app'].disabled, true);

        vm.runInContext('isAppInstalled = false; deferredInstallPrompt = null', env.ctx);
        S.location.protocol = 'file:';
        updBtn();
        assertEqual(doc.els['btn-install-app'].textContent, '⚠️ Abrí la app por HTTP para poder instalarla', 'file:');

        S.location.protocol = 'https:';
        updBtn();
        assertEqual(doc.els['btn-install-app'].textContent, '⏳ Preparando instalación…', 'sin prompt');
        assertEqual(doc.els['btn-install-app'].disabled, true);

        setDeferred('{}');
        updBtn();
        assertEqual(doc.els['btn-install-app'].textContent, '📲 Instalar la App (PWA)');
        assertEqual(doc.els['btn-install-app'].disabled, false);
    });

    test('installPWA: sin prompt avisa que no es instalable', () => {
        toasts.length = 0;
        setDeferred('null');
        S.installPWA();
        assertEqual(toasts[toasts.length - 1].m, 'La app ya está instalada o aún no es instalable desde este navegador');
        assertEqual(toasts[toasts.length - 1].t, 'info');
    });

    test('installPWA: con prompt aceptado instala, limpia y actualiza el botón', () => {
        toasts.length = 0;
        useBtnCounter();
        resetBtnCalls();
        setDeferred('{ prompt: function() { window._prompted = true; }, userChoice: { then: function(cb) { cb({ outcome: "accepted" }); } } }');
        S.installPWA();
        assertEqual(vm.runInContext('_prompted', env.ctx), true, 'llama a prompt');
        assertEqual(toasts[toasts.length - 1].m, '📲 Aplicación instalada correctamente');
        assertEqual(vm.runInContext('deferredInstallPrompt', env.ctx), null, 'limpia el prompt');
        assertEqual(vm.runInContext('_updBtnCalls', env.ctx), 1, 'actualiza botón');
    });

    test('installPWA: prompt cancelado avisa cancelación', () => {
        toasts.length = 0;
        setDeferred('{ prompt: function() {}, userChoice: { then: function(cb) { cb({ outcome: "dismissed" }); } } }');
        S.installPWA();
        assertEqual(toasts[toasts.length - 1].m, 'Instalación cancelada');
        assertEqual(toasts[toasts.length - 1].t, 'info');
        assertEqual(vm.runInContext('deferredInstallPrompt', env.ctx), null, 'limpia el prompt');
    });

    test('beforeinstallprompt: guarda el evento y actualiza el botón', () => {
        useBtnCounter();
        resetBtnCalls();
        const e = { preventDefault: () => {} };
        fireWindow('beforeinstallprompt', e);
        assertEqual(vm.runInContext('deferredInstallPrompt', env.ctx), e, 'guarda el evento');
        assertEqual(vm.runInContext('_updBtnCalls', env.ctx), 1, 'actualiza botón');
    });

    test('appinstalled: marca instalada, limpia el prompt y avisa', () => {
        toasts.length = 0;
        useBtnCounter();
        resetBtnCalls();
        vm.runInContext('isAppInstalled = false; deferredInstallPrompt = { x: 1 }', env.ctx);
        fireWindow('appinstalled', {});
        assertEqual(vm.runInContext('isAppInstalled', env.ctx), true, 'marca instalada');
        assertEqual(vm.runInContext('deferredInstallPrompt', env.ctx), null, 'limpia prompt');
        assertEqual(toasts[toasts.length - 1].m, '📲 Aplicación instalada correctamente');
        assertEqual(vm.runInContext('_updBtnCalls', env.ctx), 1, 'actualiza botón');
    });

    test('DOMContentLoaded: inicializa el sistema y actualiza el botón PWA', () => {
        vm.runInContext('_initN = 0; _btnN = 0', env.ctx);
        vm.runInContext('initializeSystem = function() { _initN++; }; updateInstallAppButton = function() { _btnN++; };', env.ctx);
        fireDoc('DOMContentLoaded', {});
        assertEqual(vm.runInContext('_initN', env.ctx), 1, 'inicializa');
        assertEqual(vm.runInContext('_btnN', env.ctx), 1, 'actualiza botón');
    });

    test('auto-guardado: registra un intervalo de 30 s y sincroniza en settings', () => {
        const interval = intervals.find(i => i.ms === 30000);
        assert(interval, 'intervalo de 30 s');
        const active = makeEl('', []);
        active.attrs['data-tab'] = 'settings';
        doc.setSelector('.tab.active', [active]);

        const setInput = (id, value) => { doc.getElementById(id).value = value; };
        setInput('torneoNombre', 'Nuevo Torneo');
        setInput('subtitulo', '');
        setInput('torneoLugar', '');
        setInput('torneoFechaInicio', '');
        setInput('torneoFechaFin', '');
        setInput('torneoOrganizadores', '');
        setInput('torneoMesas', '6');
        setInput('torneoFormato', 'Todos contra todos + llaves eliminatorias');
        setInput('torneoFormatoGrupos', 'bo5');
        setInput('torneoFormatoLlaves', 'bo5');
        setInput('torneoDuracion', '20');

        const st = TD().settings;
        st.torneoNombre = 'Viejo';
        st.mesas = 4;
        st.duracionPartido = 15;
        st.formato = 'Todos contra todos + llaves eliminatorias';

        let saves = 0, refresh = 0;
        S.saveTournamentData = () => saves++;
        S.refreshDashboardHeader = () => refresh++;

        interval.fn();
        assertEqual(st.torneoNombre, 'Nuevo Torneo', 'texto');
        assertEqual(st.mesas, 6, 'int');
        assertEqual(st.duracionPartido, 20, 'duración');
        assertEqual(saves, 1, 'guarda');
        assertEqual(refresh, 1, 'refresca header');
    });

    test('auto-guardado: fuera de settings no guarda', () => {
        const interval = intervals.find(i => i.ms === 30000);
        const active = makeEl('', []);
        active.attrs['data-tab'] = 'dashboard';
        doc.setSelector('.tab.active', [active]);
        let saves = 0;
        S.saveTournamentData = () => saves++;
        interval.fn();
        assertEqual(saves, 0, 'no guarda');
    });

    test('auto-guardado de datos: registra un intervalo de 10 s y persiste', () => {
        const interval = intervals.find(i => i.ms === 10000);
        assert(interval, 'intervalo de 10 s');
        let saves = 0, recoveries = 0;
        S.saveTournamentData = () => saves++;
        S.saveSessionRecovery = () => recoveries++;
        interval.fn();
        assertEqual(saves, 1, 'guarda datos del torneo');
        assertEqual(recoveries, 1, 'actualiza el checkpoint de recuperación');
    });

    test('auto-guardado de datos: al ocultar la app fuerza el checkpoint', () => {
        let forced = 0;
        S.saveSessionRecovery = (force) => { if (force) forced++; };
        assert(winListeners['pagehide'], 'listener pagehide registrado');
        fireWindow('pagehide', {});
        assertEqual(forced, 1, 'checkpoint forzado al cerrar/ocultar');
    });

    test('auto-refresco: registra 15 s y actualiza el dashboard', () => {
        const interval = intervals.find(i => i.ms === 15000);
        assert(interval, 'intervalo de 15 s');
        const active = makeEl('', []);
        active.attrs['data-tab'] = 'dashboard';
        doc.setSelector('.tab.active', [active]);
        const calls = [];
        S.renderLiveScores = () => calls.push('live');
        S.renderDashboardNextMatches = () => calls.push('next');
        interval.fn();
        assert(calls.includes('live') && calls.includes('next'), 'refresca en dashboard');
        calls.length = 0;
        active.attrs['data-tab'] = 'fixture';
        interval.fn();
        assertEqual(calls.length, 0, 'no refresca fuera');
    });
});
