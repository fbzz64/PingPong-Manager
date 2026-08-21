// ==========================================
// TESTS/UI.TEST.JS - Toast, modales y tema (js/ui.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

function makeUiEl(id) {
    const el = {
        id: id || '',
        textContent: '',
        innerHTML: '',
        style: {},
        className: '',
        title: '',
        disabled: false,
        onclick: null,
        parentNode: null,
        children: [],
        attributes: {},
        setAttribute(k, v) { el.attributes[k] = String(v); },
        hasAttribute(k) { return k in el.attributes; },
        getAttribute(k) { return el.attributes[k] || null; },
        classList: {
            add(c) { (el._added = el._added || []).push(c); },
            remove() {},
            contains(c) { return (el._added || []).includes(c); },
            toggle(c) { (el._toggled = el._toggled || []).push(c); }
        },
        appendChild(c) { c.parentNode = el; el.children.push(c); },
        removeChild(c) { el.children = el.children.filter(x => x !== c); }
    };
    return el;
}

suite('UI (ui.js)', () => {
    const timeouts = [];
    const els = {};
    const doc = {
        getElementById: (id) => {
            if (!els[id]) els[id] = makeUiEl(id);
            return els[id];
        },
        createElement: (tag) => makeUiEl(''),
        body: makeUiEl('body'),
        head: makeUiEl('head'),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    };
    const env = createEnv({
        document: doc,
        darkMode: false,
        setTimeout: (fn) => { timeouts.push(fn); return 1; }
    });
    const S = env.sandbox;
    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/ui.js');

    function darkModeOf() { return vm.runInContext('darkMode', env.ctx); }
    function themeModeOf() { return vm.runInContext('typeof themeMode !== "undefined" ? themeMode : "undefined"', env.ctx); }
    function updateThemeButton() { return vm.runInContext('updateThemeButton', env.ctx)(); }

    test('al cargar inyecta el estilo de animación shake', () => {
        assert(doc.head.children[0], 'style al head');
        assert(doc.head.children[0].textContent.includes('@keyframes shake'), 'animación shake');
    });

    test('showToast: crea el toast, lo estiliza y se autodestruye', () => {
        timeouts.length = 0;
        doc.getElementById('toast-container').children = [];
        S.showToast('Hola', 'success');
        const toast = els['toast-container'].children[0];
        assert(toast, 'toast creado');
        assertEqual(toast.className, 'toast success', 'clase con tipo');
        assertEqual(toast.textContent, 'Hola', 'mensaje');
        assertEqual(els['toast-container'].children.length, 1, 'en el contenedor');
        assertEqual(timeouts.length, 1, 'programa el auto-removido');
        timeouts[0]();
        assertEqual(els['toast-container'].children.length, 0, 'se autodestruye');
    });

    test('showModal: rellena el modal y el confirmar ejecuta onConfirm', () => {
        let confirmed = 0;
        S.showModal('Título', '<p>Contenido</p>', () => { confirmed++; }, 'Aceptar');
        assertEqual(els['modal-title'].textContent, 'Título');
        assertEqual(els['modal-content'].innerHTML, '<p>Contenido</p>');
        assertEqual(els['modal-confirm'].textContent, 'Aceptar');
        assertEqual(els['modal-confirm'].style.display, 'inline-flex');
        assertEqual(els['modal-overlay'].style.display, 'flex');
        els['modal-confirm'].onclick();
        assertEqual(confirmed, 1, 'ejecuta onConfirm');
        // Flushear el setTimeout del closeModal
        timeouts[timeouts.length - 1]();
        assertEqual(els['modal-overlay'].style.display, 'none', 'closeModal tras confirmar');
    });

    test('showModal: sin onConfirm oculta el botón confirmar', () => {
        S.showModal('T', 'C');
        assertEqual(els['modal-confirm'].style.display, 'none', 'botón oculto');
    });

    test('closeModal: oculta el overlay y restaura el botón', () => {
        els['modal-overlay'].style.display = 'flex';
        els['modal-confirm'].style.display = 'none';
        S.closeModal();
        // Flushear el setTimeout del closeModal
        timeouts[timeouts.length - 1]();
        assertEqual(els['modal-overlay'].style.display, 'none');
        assertEqual(els['modal-confirm'].style.display, 'inline-flex');
    });

    test('showModal full: agrega modal--full y closeModal lo quita', () => {
        const modalEl = makeUiEl('modal');
        const removed = [];
        modalEl.classList.remove = (c) => { removed.push(c); };
        const origQS = doc.querySelector;
        doc.querySelector = () => modalEl;
        try {
            S.showModal('T', 'C', null, null, { full: true });
            assert(modalEl.classList.contains('modal--full'), 'modo full activo');
            S.closeModal();
            assertEqual(removed, ['modal--full'], 'closeModal quita el modo full');
        } finally {
            doc.querySelector = origQS;
        }
    });

    test('showModal: reconecta el botón cancelar a closeModal', () => {
        els['modal-cancel'].onclick = () => {};
        S.showModal('T', 'C');
        assertEqual(els['modal-cancel'].onclick, S.closeModal, 'cancelar vuelve a closeModal');
    });

    test('toggleTheme: ciclo tri-state auto→light→dark→auto', () => {
        const toasts = [];
        S.showToast = (m) => toasts.push(m);
        vm.runInContext('themeMode = "auto"; darkMode = false', env.ctx);
        S.toggleTheme();
        assertEqual(themeModeOf(), 'light', 'auto → light');
        assertEqual(darkModeOf(), false, 'light no activa darkMode');
        S.toggleTheme();
        assertEqual(vm.runInContext('themeMode', env.ctx), 'dark', 'light → dark');
        assertEqual(darkModeOf(), true, 'dark activa darkMode');
        S.toggleTheme();
        assertEqual(vm.runInContext('themeMode', env.ctx), 'auto', 'dark → auto');
    });

    test('applyTheme: restaura themeMode guardado y migra darkMode legacy', () => {
        S.localStorage.setItem('themeMode', 'dark');
        vm.runInContext('themeMode = "auto"; darkMode = false', env.ctx);
        S.applyTheme();
        assertEqual(darkModeOf(), true, 'darkMode activado con themeMode=dark');
        assertEqual(vm.runInContext('themeMode', env.ctx), 'dark', 'themeMode restaurado');

        // Migración de darkMode legacy
        S.localStorage.removeItem('themeMode');
        S.localStorage.setItem('darkMode', 'true');
        vm.runInContext('themeMode = "auto"; darkMode = false', env.ctx);
        S.applyTheme();
        assertEqual(vm.runInContext('themeMode', env.ctx), 'dark', 'migración legacy true→dark');

        // Default sin nada guardado → auto
        S.localStorage.removeItem('themeMode');
        S.localStorage.removeItem('darkMode');
        vm.runInContext('themeMode = "dark"; darkMode = true', env.ctx);
        S.applyTheme();
        assertEqual(vm.runInContext('themeMode', env.ctx), 'auto', 'sin guardado → auto');
    });

    test('updateThemeButton: refleja el temaMode actual', () => {
        vm.runInContext('themeMode = "dark"; darkMode = true', env.ctx);
        updateThemeButton();
        assertEqual(els['theme-toggle-btn'].textContent, '🌙', 'dark → luna');
        vm.runInContext('themeMode = "light"; darkMode = false', env.ctx);
        updateThemeButton();
        assertEqual(els['theme-toggle-btn'].textContent, '☀️', 'light → sol');
        vm.runInContext('themeMode = "auto"', env.ctx);
        updateThemeButton();
        assertEqual(els['theme-toggle-btn'].textContent, '🖥️', 'auto → monitor');
    });

    test('toggleShortcuts: alterna el panel', () => {
        S.toggleShortcuts();
        assert((els['shortcuts-panel']._toggled || []).includes('show'), 'alterna show');
    });
});
