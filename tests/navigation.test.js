// ==========================================
// TESTS/NAVIGATION.TEST.JS - Menús, pestañas y atajos (js/navigation.js)
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

function makeNavDoc() {
    const registry = {};
    const listeners = {};
    const els = {};
    return {
        els,
        registry,
        listeners,
        getElementById: (id) => {
            if (!els[id]) els[id] = makeEl(id);
            return els[id];
        },
        querySelectorAll: (sel) => registry[sel] || [],
        querySelector: (sel) => (registry[sel] && registry[sel][0]) || null,
        addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
        createElement: (tag) => makeEl(''),
        body: makeEl('body'),
        head: makeEl('head'),
        setSelector: (sel, list) => { registry[sel] = list; }
    };
}

suite('NAVIGATION (navigation.js)', () => {
    const doc = makeNavDoc();
    const env = createEnv({ document: doc });
    const S = env.sandbox;
    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/navigation.js');

    const calls = [];
    const stub = (name) => { S[name] = (m, t) => calls.push(name + (m !== undefined ? ':' + m : '')); };
    ['loadFakeData', 'exportAllData', 'importAllData', 'updateDashboard', 'generateFixture',
        'printFixture', 'saveFixtureData', 'exportStatsExcel', 'toggleShortcuts',
        'setLastPlayerAsFree', 'createBackup', 'undoAction', 'redoAction', 'closeModal',
        'calculateStats', 'showAllPlayers', 'showLogs', 'renderRanking', 'renderBracketsForTab',
        'reloadSettingsInputs', 'renderCategoriesManager', 'updateFixtureNavigator',
        'openScoreboard', 'openTablesLive', 'scanPlayerQR', 'showCheckinModal',
        'showSocialHub', 'showSystemGuide'
    ].forEach(stub);
    S.showToast = (m) => calls.push('toast:' + m);
    S.addLog = (a, d) => calls.push('log:' + d);

    function ctxFn(name, ...args) {
        return vm.runInContext(name, env.ctx)(...args);
    }

    function fireKey(init) {
        const e = Object.assign({ preventDefault: () => {}, key: '', ctrlKey: false, shiftKey: false, altKey: false }, init);
        (doc.listeners['keydown'] || []).forEach(fn => fn(e));
    }

    function baseShowTabSetup() {
        const c1 = makeEl('c1', ['tab-content']);
        const cPlayers = makeEl('players', ['tab-content']);
        const t1 = makeEl('', ['tab']);
        const tPlayers = makeEl('', ['tab']);
        doc.els['players'] = cPlayers;
        doc.setSelector('.tab-content', [c1, cPlayers]);
        doc.setSelector('.tab', [t1, tPlayers]);
        doc.setSelector('.tab[data-tab="players"]', [tPlayers]);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        return { c1, cPlayers, t1, tPlayers };
    }

    test('setupKeyboardShortcuts: loguea la inicialización', () => {
        calls.length = 0;
        S.setupKeyboardShortcuts();
        assert(calls.includes('log:Atajos de teclado inicializados'), 'addLog');
    });

    test('closeAllDropdowns: cierra grupos abiertos y resetea aria-expanded', () => {
        const toggle = makeEl('', []);
        const group = makeEl('', ['tab-group', 'dropdown', 'open']);
        group.querySelector = (sel) => sel === '.dropdown-toggle' ? toggle : null;
        doc.setSelector('.tab-group.dropdown.open', [group]);
        ctxFn('closeAllDropdowns');
        assert(!group.classList.contains('open'), 'quita open');
        assertEqual(toggle.attrs['aria-expanded'], 'false', 'aria-expanded false');
    });

    test('toggleDropdown: abre un grupo cerrado y cierra los demás', () => {
        const toggle = makeEl('', []);
        const group = makeEl('', ['tab-group', 'dropdown']);
        toggle.closest = () => group;
        group.querySelector = (sel) => sel === '.dropdown-toggle' ? toggle : null;
        const otherToggle = makeEl('', []);
        const other = makeEl('', ['tab-group', 'dropdown', 'open']);
        other.querySelector = (sel) => sel === '.dropdown-toggle' ? otherToggle : null;
        doc.setSelector('.tab-group.dropdown.open', [other]);
        S.toggleDropdown(toggle);
        assert(group.classList.contains('open'), 'el target abre');
        assertEqual(toggle.attrs['aria-expanded'], 'true', 'aria true');
        assert(!other.classList.contains('open'), 'los demás se cierran');
        assertEqual(otherToggle.attrs['aria-expanded'], 'false');
    });

    test('toggleDropdown: cierra un grupo abierto y no abre otro', () => {
        const toggle = makeEl('', []);
        const group = makeEl('', ['tab-group', 'dropdown', 'open']);
        toggle.closest = () => group;
        group.querySelector = (sel) => sel === '.dropdown-toggle' ? toggle : null;
        doc.setSelector('.tab-group.dropdown.open', [group]);
        S.toggleDropdown(toggle);
        assert(!group.classList.contains('open'), 'quita open');
    });

    test('toggleDropdown: sin grupo cercano no rompe', () => {
        const toggle = makeEl('', []);
        toggle.closest = () => null;
        S.toggleDropdown(toggle);
        assert(true, 'no lanza');
    });

    test('updateDropdownCurrent: refleja la pestaña activa en el toggle', () => {
        const activeTab = makeEl('', ['tab', 'active']);
        activeTab.textContent = 'Fixture';
        const dd = makeEl('', ['dd-active']);
        const group = makeEl('', ['tab-group', 'dropdown']);
        group.querySelector = (sel) => sel === '.tab.active' ? activeTab : sel === '.dd-active' ? dd : null;
        doc.setSelector('.tab-group.dropdown', [group]);
        ctxFn('updateDropdownCurrent');
        assertEqual(dd.textContent, ' · Fixture', 'texto del toggle');
    });

    test('showTab: activa sección y botón, persiste y renderiza la pestaña', () => {
        const { c1, cPlayers, t1, tPlayers } = baseShowTabSetup();
        calls.length = 0;
        S.showTab('players');
        assert(cPlayers.classList.contains('active'), 'sección activa');
        assert(!c1.classList.contains('active'), 'otras secciones se desactivan');
        assert(tPlayers.classList.contains('active'), 'botón activo');
        assert(!t1.classList.contains('active'), 'otros botones se desactivan');
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'players', 'persiste');
        assert(calls.includes('showAllPlayers'), 'renderiza la pestaña');
    });

    test('showTab: dashboard refresca el dashboard', () => {
        const c = makeEl('dashboard', ['tab-content']);
        const t = makeEl('', ['tab']);
        doc.els['dashboard'] = c;
        doc.setSelector('.tab-content', [c]);
        doc.setSelector('.tab', [t]);
        doc.setSelector('.tab[data-tab="dashboard"]', [t]);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        S.showTab('dashboard');
        assert(calls.includes('updateDashboard'), 'refresca dashboard');
    });

    test('showTab: cada pestaña dispara su renderer', () => {
        doc.setSelector('.tab-content', []);
        doc.setSelector('.tab', []);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        S.showTab('stats');   assert(calls.includes('calculateStats'), 'stats');
        S.showTab('players'); assert(calls.includes('showAllPlayers'), 'players');
        S.showTab('settings'); assert(calls.includes('reloadSettingsInputs') && calls.includes('renderCategoriesManager'), 'settings');
        S.showTab('fixture'); assert(calls.includes('updateFixtureNavigator'), 'fixture');
        S.showTab('ranking'); assert(calls.includes('renderRanking'), 'ranking');
        S.showTab('brackets'); assert(calls.includes('renderBracketsForTab'), 'brackets');
        S.showTab('logs');    assert(calls.includes('showLogs'), 'logs');
    });

    test('setupKeyboardShortcuts: F5 actualiza dashboard y avisa', () => {
        calls.length = 0;
        fireKey({ key: 'F5' });
        assert(calls.includes('updateDashboard'), 'updateDashboard');
        assert(calls.includes('toast:Dashboard actualizado'), 'toast');
    });

    test('setupKeyboardShortcuts: F1/F2/F3 y F11/F12', () => {
        calls.length = 0;
        fireKey({ key: 'F1' }); assert(calls.includes('loadFakeData'), 'F1');
        fireKey({ key: 'F2' }); assert(calls.includes('exportAllData'), 'F2');
        fireKey({ key: 'F3' }); assert(calls.includes('importAllData'), 'F3');
        fireKey({ key: 'F11' }); assert(calls.includes('generateFixture'), 'F11');
        fireKey({ key: 'F12' }); assert(calls.includes('printFixture'), 'F12');
    });

    test('setupKeyboardShortcuts: Ctrl+S/P/E/B/Z/Y', () => {
        calls.length = 0;
        fireKey({ key: 's', ctrlKey: true }); assert(calls.includes('saveFixtureData'), 'Ctrl+S');
        fireKey({ key: 'p', ctrlKey: true }); assert(calls.includes('printFixture'), 'Ctrl+P');
        fireKey({ key: 'e', ctrlKey: true }); assert(calls.includes('exportStatsExcel'), 'Ctrl+E');
        fireKey({ key: 'b', ctrlKey: true }); assert(calls.includes('createBackup'), 'Ctrl+B');
        fireKey({ key: 'z', ctrlKey: true }); assert(calls.includes('undoAction'), 'Ctrl+Z');
        fireKey({ key: 'y', ctrlKey: true }); assert(calls.includes('redoAction'), 'Ctrl+Y');
        fireKey({ key: 'Z', ctrlKey: true, shiftKey: true }); assert(calls.includes('redoAction'), 'Ctrl+Shift+Z');
        calls.length = 0;
        fireKey({ key: 'z', ctrlKey: true });
        assert(calls.includes('undoAction'), 'Ctrl+Z deshace');
        assert(!calls.includes('redoAction'), 'Ctrl+Z no rehace');
    });

    test('setupKeyboardShortcuts: Ctrl+Shift+P foca el input de jugador', () => {
        let focused = false;
        const nameInput = makeEl('new-player-name', []);
        nameInput.focus = () => { focused = true; };
        const c = makeEl('players', ['tab-content']);
        const t = makeEl('', ['tab']);
        doc.els['new-player-name'] = nameInput;
        doc.els['players'] = c;
        doc.setSelector('.tab-content', [c]);
        doc.setSelector('.tab', [t]);
        doc.setSelector('.tab[data-tab="players"]', [t]);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        fireKey({ key: 'P', ctrlKey: true, shiftKey: true });
        assert(focused, 'foca el input');
    });

    test('setupKeyboardShortcuts: Ctrl+Shift navega y Alt+L marca libre', () => {
        const section = makeEl('dashboard', ['tab-content']);
        const t = makeEl('', ['tab']);
        doc.els['dashboard'] = section;
        doc.setSelector('.tab-content', [section]);
        doc.setSelector('.tab', [t]);
        doc.setSelector('.tab[data-tab="dashboard"]', [t]);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        fireKey({ key: 'D', ctrlKey: true, shiftKey: true });
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'dashboard', 'Ctrl+Shift+D a dashboard');
        fireKey({ key: 'l', altKey: true });
        assert(calls.includes('setLastPlayerAsFree'), 'Alt+L');
        fireKey({ key: 'K', ctrlKey: true, shiftKey: true });
        assert(calls.includes('toggleShortcuts'), 'Ctrl+Shift+K');
        fireKey({ key: 'L', ctrlKey: true, shiftKey: true });
        assert(calls.includes('showLogs'), 'Ctrl+Shift+L');
    });

    test('setupKeyboardShortcuts: Ctrl+Shift navega a Ranking, Configuración y Changelog', () => {
        doc.setSelector('.tab-content', []);
        doc.setSelector('.tab', []);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        fireKey({ key: 'R', ctrlKey: true, shiftKey: true });
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'ranking', 'Ctrl+Shift+R a ranking');
        fireKey({ key: 'C', ctrlKey: true, shiftKey: true });
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'settings', 'Ctrl+Shift+C a configuración');
        fireKey({ key: 'H', ctrlKey: true, shiftKey: true });
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'changelog', 'Ctrl+Shift+H a changelog');
    });

    test('setupKeyboardShortcuts: F7/F8/F9 y Ctrl+Shift+Q/W abren funciones nuevas', () => {
        calls.length = 0;
        fireKey({ key: 'F9' }); assert(calls.includes('openScoreboard'), 'F9 scoreboard');
        fireKey({ key: 'F8' }); assert(calls.includes('openTablesLive'), 'F8 mesas en vivo');
        fireKey({ key: 'F7' }); assert(calls.includes('scanPlayerQR'), 'F7 escanear QR');
        fireKey({ key: 'W', ctrlKey: true, shiftKey: true }); assert(calls.includes('showSocialHub'), 'Ctrl+Shift+W difusión');
        fireKey({ key: 'F4' }); assert(calls.includes('showSystemGuide'), 'F4 guía');
    });

    test('setupKeyboardShortcuts: Ctrl+Shift+Q abre check-in rápido en Jugadores', () => {
        doc.setSelector('.tab-content', []);
        doc.setSelector('.tab', []);
        doc.setSelector('.tab-group.dropdown', []);
        doc.setSelector('.tab-group.dropdown.open', []);
        calls.length = 0;
        fireKey({ key: 'Q', ctrlKey: true, shiftKey: true });
        assert(calls.includes('showCheckinModal'), 'abre check-in rápido');
        assertEqual(S.localStorage.getItem('ttmActiveTab'), 'players', 'va a jugadores');
    });

    test('setupKeyboardShortcuts: ESC cierra modal, panel de atajos y menús', () => {
        const modal = makeEl('modal-overlay', []);
        modal.style.display = 'flex';
        const panel = makeEl('shortcuts-panel', ['show']);
        const toggle = makeEl('', []);
        const group = makeEl('', ['tab-group', 'dropdown', 'open']);
        group.querySelector = (sel) => sel === '.dropdown-toggle' ? toggle : null;
        doc.els['modal-overlay'] = modal;
        doc.els['shortcuts-panel'] = panel;
        doc.setSelector('.tab-group.dropdown.open', [group]);
        calls.length = 0;
        fireKey({ key: 'Escape' });
        assert(calls.includes('closeModal'), 'cierra modal');
        assert(!panel.classList.contains('show'), 'cierra panel');
        assert(!group.classList.contains('open'), 'cierra menú');
    });

    test('clic fuera de un menú desplegable lo cierra', () => {
        const toggle = makeEl('', []);
        const group = makeEl('', ['tab-group', 'dropdown', 'open']);
        group.querySelector = (sel) => sel === '.dropdown-toggle' ? toggle : null;
        doc.setSelector('.tab-group.dropdown.open', [group]);
        const e = { target: { closest: () => null } };
        (doc.listeners['click'] || []).forEach(fn => fn(e));
        assert(!group.classList.contains('open'), 'se cierra');
        assertEqual(toggle.attrs['aria-expanded'], 'false');
    });

    test('clic dentro de un menú no lo cierra', () => {
        const group = makeEl('', ['tab-group', 'dropdown', 'open']);
        doc.setSelector('.tab-group.dropdown.open', [group]);
        const e = { target: { closest: () => group } };
        (doc.listeners['click'] || []).forEach(fn => fn(e));
        assert(group.classList.contains('open'), 'sigue abierto');
    });
});
