// ==========================================
// TESTS/SPONSORS.TEST.JS - Patrocinadores (js/sponsors.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('SPONSORS (sponsors.js)', () => {
    const env = loadApp(['js/sponsors.js']);
    const S = env.sandbox;

    const els = {};
    function capture() {
        env.sandbox.document.getElementById = (id) => {
            if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '', style: {}, files: [] };
            return els[id];
        };
        return (id) => env.sandbox.document.getElementById(id);
    }

    function reset() {
        env.tournamentData.settings.patrocinadores = [];
    }

    test('loadPatrocinadoresList: sin sponsors muestra mensaje', () => {
        reset();
        capture();
        S.loadPatrocinadoresList();
        assert(els['patrocinadores-list'].innerHTML.includes('No hay patrocinadores agregados aún'), 'mensaje vacío');
    });

    test('loadPatrocinadoresList: renderiza tarjetas con escape y botones', () => {
        reset();
        capture();
        env.tournamentData.settings.patrocinadores = [
            { nombre: 'Coca-Cola', logo: 'data:image/png;base64,xxx' },
            { nombre: '<Pepsi> & Co', logo: null }
        ];
        S.loadPatrocinadoresList();
        const html = els['patrocinadores-list'].innerHTML;
        assert(html.includes('Coca-Cola'), 'primer sponsor');
        assert(html.includes('✅ Logo cargado'), 'con logo');
        assert(html.includes('src="data:image/png;base64,xxx"'), 'src del logo');
        assert(html.includes('&lt;Pepsi&gt; &amp; Co'), 'escHtml aplicado al nombre');
        assert(html.includes('Sin logo'), 'sin logo');
        assert(html.includes('editPatrocinador(0)'), 'editar index 0');
        assert(html.includes('deletePatrocinador(1)'), 'eliminar index 1');
    });

    test('addPatrocinador: bloquea en el máximo de 5', () => {
        reset();
        let toast = null, modal = null;
        S.showToast = (m, t) => { toast = { m, t }; };
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        env.tournamentData.settings.patrocinadores = [1, 2, 3, 4, 5].map(n => ({ nombre: 'P' + n, logo: null }));
        S.addPatrocinador();
        assertEqual(toast.m, 'Máximo 5 patrocinadores permitidos');
        assertEqual(toast.t, 'warning');
        assertEqual(modal, null, 'no abre modal');
    });

    test('addPatrocinador: abre el modal con el formulario', () => {
        reset();
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        S.setTimeout = (cb) => { cb(); return 0; };
        S.addPatrocinador();
        assertEqual(modal.t, '➕ Agregar Patrocinador');
        assert(modal.b.includes('pat-nombre'), 'input nombre');
        assert(modal.b.includes('pat-logo'), 'input logo');
        assert(modal.b.includes('logo-preview'), 'preview de logo');
    });

    test('executeAddPatrocinador: sin nombre → error', () => {
        reset();
        const get = capture();
        let toast = null, saves = 0;
        S.showToast = (m, t) => { toast = { m, t }; };
        S.saveTournamentData = () => { saves++; };
        get('pat-nombre').value = '   ';
        S.executeAddPatrocinador();
        assertEqual(toast.m, 'Por favor ingresa el nombre del patrocinador');
        assertEqual(toast.t, 'error');
        assertEqual(saves, 0, 'no guarda');
    });

    test('executeAddPatrocinador: sin logo agrega con logo null', () => {
        reset();
        const get = capture();
        const calls = [];
        S.showToast = () => calls.push('toast');
        S.saveTournamentData = () => calls.push('save');
        S.loadPatrocinadoresList = () => calls.push('reload');
        S.addLog = (a, d) => calls.push('log:' + d);
        get('pat-nombre').value = 'Nike';
        get('pat-logo').files = [];
        S.executeAddPatrocinador();
        assertEqual(env.tournamentData.settings.patrocinadores.length, 1, 'agrega uno');
        assertEqual(env.tournamentData.settings.patrocinadores[0].nombre, 'Nike');
        assertEqual(env.tournamentData.settings.patrocinadores[0].logo, null);
        assert(calls.includes('save') && calls.includes('reload'), 'guarda y recarga');
        assert(calls.some(c => c.startsWith('log:Agregado: Nike')), 'loguea');
    });

    test('executeAddPatrocinador: con logo guarda el dataURL del FileReader', () => {
        reset();
        const get = capture();
        S.FileReader = class {
            readAsDataURL() {
                this.onload({ target: { result: 'data:image/png;base64,AAA' } });
            }
        };
        const calls = [];
        S.showToast = () => calls.push('toast');
        S.saveTournamentData = () => calls.push('save');
        S.loadPatrocinadoresList = () => calls.push('reload');
        S.addLog = (a, d) => calls.push('log:' + d);
        get('pat-nombre').value = 'Nike';
        get('pat-logo').files = [{}];
        S.executeAddPatrocinador();
        assertEqual(env.tournamentData.settings.patrocinadores[0].logo, 'data:image/png;base64,AAA', 'logo leído');
        assertEqual(env.tournamentData.settings.patrocinadores[0].nombre, 'Nike');
    });

    test('editPatrocinador: modal con valor pre-cargado y escapado', () => {
        reset();
        env.tournamentData.settings.patrocinadores = [{ nombre: 'Nike', logo: null }];
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        S.setTimeout = (cb) => { cb(); return 0; };
        S.editPatrocinador(0);
        assertEqual(modal.t, '✏️ Editar Patrocinador');
        assert(modal.b.includes('value="Nike"'), 'valor pre-cargado');
        assert(modal.b.includes('pat-logo-edit'), 'input nuevo logo');
    });

    test('executeEditPatrocinador: actualiza el nombre y loguea', () => {
        reset();
        const get = capture();
        const calls = [];
        env.tournamentData.settings.patrocinadores = [{ nombre: 'Nike', logo: null }];
        S.showToast = () => calls.push('toast');
        S.saveTournamentData = () => calls.push('save');
        S.loadPatrocinadoresList = () => calls.push('reload');
        S.addLog = (a, d) => calls.push('log:' + d);
        get('pat-nombre-edit').value = 'Adidas';
        get('pat-logo-edit').files = [];
        S.executeEditPatrocinador(0);
        assertEqual(env.tournamentData.settings.patrocinadores[0].nombre, 'Adidas');
        assert(calls.includes('save') && calls.includes('reload'), 'guarda y recarga');
        assert(calls.includes('log:Editado: Adidas'), 'loguea editado');
    });

    test('deletePatrocinador: confirma, elimina y loguea', () => {
        reset();
        capture();
        const calls = [];
        env.tournamentData.settings.patrocinadores = [{ nombre: 'X', logo: null }, { nombre: 'Y', logo: null }];
        S.showToast = () => calls.push('toast');
        S.saveTournamentData = () => calls.push('save');
        S.loadPatrocinadoresList = () => calls.push('reload');
        S.addLog = (a, d) => calls.push('log:' + d);
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        S.deletePatrocinador(1);
        assertEqual(modal.t, '⚠️ ¿Eliminar Patrocinador?');
        assert(modal.b.includes('Y'), 'nombre en la confirmación');
        modal.cb();
        assertEqual(env.tournamentData.settings.patrocinadores.length, 1, 'eliminó');
        assertEqual(env.tournamentData.settings.patrocinadores[0].nombre, 'X', 'quedó el otro');
        assert(calls.includes('save') && calls.includes('reload'), 'guarda y recarga');
        assert(calls.includes('log:Eliminado: Y'), 'loguea eliminado');
    });
});
