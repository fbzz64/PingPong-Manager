// ==========================================
// TESTS/CHANGELOG.TEST.JS - Bitácora y guía (js/changelog.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('CHANGELOG (changelog.js)', () => {
    const env = loadApp(['js/changelog.js']);
    const S = env.sandbox;
    // CHANGELOG es `const` de nivel de módulo: NO es propiedad de window/sandbox,
    // así que se accede con runInContext (igual que el Date del realm).
    const CHANGELOG = vm.runInContext('CHANGELOG', env.ctx);

    test('APP_VERSION y estructura del CHANGELOG', () => {
        assert(typeof S.APP_VERSION === 'string' && S.APP_VERSION.length > 0, 'versión actual definida');
        assert(Array.isArray(CHANGELOG) && CHANGELOG.length >= 15, 'historial con muchas versiones');
        assertEqual(CHANGELOG[0].version, S.APP_VERSION, 'la primera entrada es la versión actual');
        for (const v of CHANGELOG) {
            assert(typeof v.version === 'string' && v.version.length > 0, 'version presente');
            assert(typeof v.date === 'string' && v.date.length > 0, 'date presente');
            assert(typeof v.title === 'string' && v.title.length > 0, 'title presente');
            assert(Array.isArray(v.changes) && v.changes.length > 0, 'cambios no vacíos');
            assert(v.changes.every(c => typeof c === 'string' && c.trim().length > 0), 'cada cambio es texto');
        }
    });

    test('versiones ordenadas de más reciente a más antigua', () => {
        for (let i = 1; i < CHANGELOG.length; i++) {
            assert(
                CHANGELOG[i].date <= CHANGELOG[i - 1].date,
                'fechas descendentes en ' + i + ': ' + CHANGELOG[i].date + ' > ' + CHANGELOG[i - 1].date
            );
        }
    });

    test('buildChangelogHTML: badge, título, fecha y cambios', () => {
        const html = S.buildChangelogHTML();
        assert(html.includes('Ver ' + S.APP_VERSION), 'badge de la versión actual');
        assert(html.includes(CHANGELOG[0].title), 'título de la versión actual');
        assert(html.includes(CHANGELOG[0].date), 'fecha visible');
        assert(html.includes('<li>📂 El menú principal ahora es una lista desplegable'), 'cambios como <li>');
        assert(html.includes('Ver 1.2'), 'última versión presente');
        assertEqual((html.match(/Ver /g) || []).length, CHANGELOG.length, 'un bloque por versión');
    });

    test('renderChangelogPage: pinta el output y la versión actual', () => {
        const els = {};
        env.sandbox.document.getElementById = (id) => {
            if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '' };
            return els[id];
        };
        S.renderChangelogPage();
        assertEqual(els['changelog-current-version'].textContent, S.APP_VERSION, 'versión en el encabezado');
        assert(els['changelog-output'].innerHTML.includes('Guía del Sistema'), 'botón guía');
        assert(els['changelog-output'].innerHTML.includes('Ver ' + S.APP_VERSION), 'lista de cambios');
        assert(els['changelog-output'].innerHTML.includes('Ver 1.2'), 'historial completo');
    });

    test('showChangelog: abre el modal con la bitácora', () => {
        let title = null, body = null;
        env.sandbox.showModal = (t, b) => { title = t; body = b; };
        S.showChangelog();
        assertEqual(title, '📋 Bitácora de Cambios');
        assert(body.includes('Ver ' + S.APP_VERSION));
    });

    test('guideModule: genera un bloque plegable', () => {
        const html = S.guideModule('⚙️ Configuración', '<p>contenido</p>');
        assert(html.includes('<details'), 'details');
        assert(html.includes('<summary'), 'summary');
        assert(html.includes('⚙️ Configuración'), 'título');
        assert(html.includes('<p>contenido</p>'), 'cuerpo');
    });

    test('buildSystemGuideHTML: fases, módulos y regla de oro', () => {
        const html = S.buildSystemGuideHTML();
        assert(html.includes('Flujo recomendado para el administrador'), 'flujo');
        assert(html.includes('🏗️ Preparación'), 'fase preparación');
        assert(html.includes('⚔️ Competencia'), 'fase competencia');
        assert(html.includes('📈 Análisis'), 'fase análisis');
        assert(html.includes('🎖️ Cierre y mantenimiento'), 'fase cierre');
        assert(html.includes('⚙️ Configuración'), 'módulo configuración');
        assert(html.includes('Detección de duplicados'), 'módulo jugadores');
        assert(html.includes('Programación Multiplex'), 'módulo multiplex');
        assert(html.includes('Regla de oro'), 'regla de oro');
        assert(html.includes('una persona no puede'), 'texto de la regla');
    });

    test('showSystemGuide: abre el modal de la guía', () => {
        let title = null, body = null;
        env.sandbox.showModal = (t, b) => { title = t; body = b; };
        S.showSystemGuide();
        assertEqual(title, '🧭 Guía del Sistema');
        assert(body.includes('Flujo recomendado'));
    });
});
