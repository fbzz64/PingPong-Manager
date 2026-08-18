// ==========================================
// TESTS/CONSISTENCY.TEST.JS - Coherencia entre HTML y JS
// ==========================================
// Detecta referencias rotas: data-tab sin su sección, showTab() a ids que
// no existen, ids críticos faltantes y estructura del menú desplegable.

const fs = require('fs');
const path = require('path');
const { suite, test, assert, assertEqual } = require('./runner');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const JS_FILES = [
    'navigation.js', 'main.js', 'ui.js', 'storage.js', 'fixtures.js',
    'brackets.js', 'stats.js', 'tournaments.js', 'players.js', 'planning.js',
    'sponsors.js', 'logs.js', 'certificates.js', 'changelog.js', 'ranking.js',
    'reglamento.js', 'elo.js', 'charts.js', 'scoreboard.js', 'qr.js', 'tables.js', 'tvboard.js', 'sync.js',
    'i18n.js'
];

function htmlIds() {
    return new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
}

suite('CONSISTENCIA HTML/JS', () => {
    test('todo data-tab tiene su sección (id) correspondiente', () => {
        const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]);
        assert(tabs.length >= 8, 'debe haber al menos 8 pestañas');
        const ids = htmlIds();
        const missing = tabs.filter(t => !ids.has(t));
        assertEqual(missing, [], 'data-tab sin id de contenido: ' + missing.join(', '));
    });

    test('showTab() solo referencia secciones existentes', () => {
        const ids = htmlIds();
        const missing = [];
        for (const f of JS_FILES) {
            const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
            for (const m of code.matchAll(/showTab\('([^']+)'\)/g)) {
                if (m[1].indexOf('${') !== -1) continue; // template literal, no un id real
                if (!ids.has(m[1])) missing.push(f + ' → ' + m[1]);
            }
        }
        assertEqual(missing, [], 'showTab a id inexistente: ' + missing.join(', '));
    });

    test('ids críticos de la UI existen en index.html', () => {
        const ids = htmlIds();
        const critical = [
            'btn-undo', 'btn-redo', 'modal-overlay', 'modal-title',
            'modal-content', 'modal-confirm', 'theme-toggle-btn',
            'shortcuts-panel', 'toast-container', 'fixture-output',
            'new-player-name', 'logs-output'
        ];
        const missing = critical.filter(id => !ids.has(id));
        assertEqual(missing, [], 'faltan ids críticos: ' + missing.join(', '));
    });

    test('menú desplegable: 4 toggles, 4 menús y 9 ítems', () => {
        assertEqual((html.match(/class="dropdown-toggle"/g) || []).length, 4, '4 toggles');
        assertEqual((html.match(/class="dropdown-menu"/g) || []).length, 4, '4 menús');
        assertEqual((html.match(/class="tab dropdown-item"/g) || []).length, 9, '9 ítems');
        assertEqual((html.match(/class="modal-header"/g) || []).length, 1, 'modal con header');
        assertEqual((html.match(/class="modal-close"/g) || []).length, 1, 'modal con botón ✕');
    });

    test('toda función onclick del menú existe en los JS', () => {
        const handlers = new Set();
        for (const f of JS_FILES) {
            const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
            for (const m of code.matchAll(/window\.([A-Za-z0-9_]+)\s*=/g)) handlers.add(m[1]);
            for (const m of code.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)) handlers.add(m[1]);
        }
        // Handlers inline que pisan window.* (definidos como función global)
        const htmlHandlers = [...html.matchAll(/onclick="([A-Za-z0-9_]+)\(/g)].map(m => m[1]);
        const missing = [...new Set(htmlHandlers)].filter(h => !handlers.has(h));
        assertEqual(missing, [], 'handlers onclick sin definición: ' + missing.join(', '));
    });
});
