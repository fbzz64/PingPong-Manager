// ==========================================
// TESTS/VERSION.TEST.JS - Coherencia de versiones y PWA
// ==========================================
// Verifica que la versión sea coherente entre package.json, changelog.js
// e index.html, y que el Service Worker (sw.js) cachee TODO lo que la
// página carga (si no, el modo offline rompe silenciosamente).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const pkg = JSON.parse(read('package.json'));
const html = read('index.html');
const swCode = read('sw.js');

function appVersion() {
    const m = read('js/changelog.js').match(/APP_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
}

function swCacheName() {
    const m = swCode.match(/CACHE_NAME\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
}

function swShell() {
    const m = swCode.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
    if (!m) return [];
    // Los nombres internos usan './' como prefijo; se normaliza para comparar
    // con los src relativos de index.html.
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1].replace(/^\.\//, ''));
}

function scriptSrcs() {
    return [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
}

suite('VERSIONES Y PWA', () => {
    test('package.json coincide con APP_VERSION de changelog.js', () => {
        const av = appVersion();
        assert(av, 'APP_VERSION presente en changelog.js');
        const norm = (v) => v.replace(/\.0+$/, '');
        assertEqual(norm(pkg.version), norm(av), 'package.json (' + pkg.version + ') vs APP_VERSION (' + av + ')');
    });

    test('CHANGELOG[0].version es la versión actual', () => {
        const env = loadApp(['js/changelog.js']);
        const av = env.sandbox.APP_VERSION;
        const CHANGELOG = vm.runInContext('CHANGELOG', env.ctx);
        assert(Array.isArray(CHANGELOG) && CHANGELOG.length > 0, 'CHANGELOG presente');
        assertEqual(CHANGELOG[0].version, av, 'primera entrada vs APP_VERSION');
    });

    test('botón de versión del header está al día', () => {
        const av = appVersion();
        const btn = html.match(/id="version-button"[^>]*>([^<]*)</);
        assert(btn, '#version-button presente en index.html');
        assert(btn[1].includes('v' + av), 'texto del botón (' + btn[1] + ') incluye v' + av);
    });

    test('sw.js: CACHE_NAME con sufijo numérico (bump por release)', () => {
        const name = swCacheName();
        assert(name, 'CACHE_NAME presente en sw.js');
        assert(/\d+$/.test(name), 'CACHE_NAME debe terminar en un número (bump por release): ' + name);
    });

    test('sw.js: todos los <script src> de index.html están en APP_SHELL', () => {
        const shell = swShell();
        const missing = scriptSrcs().filter(s => !shell.includes(s));
        assertEqual(missing, [], 'scripts sin cachear en el SW: ' + missing.join(', '));
    });

    test('sw.js: APP_SHELL cubre index, css, manifest e iconos', () => {
        const shell = swShell();
        const required = ['index.html', 'css/styles.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];
        const missing = required.filter(r => !shell.includes(r));
        assertEqual(missing, [], 'faltan en APP_SHELL: ' + missing.join(', '));
    });

    test('sw.js: todo archivo de APP_SHELL existe en disco', () => {
        const shell = swShell();
        const missing = shell.filter(p => !fs.existsSync(path.join(ROOT, p)));
        assertEqual(missing, [], 'APP_SHELL referencia archivos inexistentes: ' + missing.join(', '));
    });
});
