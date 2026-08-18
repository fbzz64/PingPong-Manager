// ==========================================
// TESTS/LOGS.TEST.JS - Registro de actividad (js/logs.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('LOGS (logs.js)', () => {
    const env = loadApp(['js/logs.js']);
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
        env.tournamentData.logs = [];
    }

    test('addLog: registra entrada con timestamp, fecha, acción y descripción y persiste', () => {
        reset();
        capture();
        let saves = 0;
        S.saveTournamentData = () => { saves++; };
        S.addLog('JUGADOR', 'Alta: Juan');
        assertEqual(env.tournamentData.logs.length, 1, 'agrega');
        const log = env.tournamentData.logs[0];
        assertEqual(log.action, 'JUGADOR');
        assertEqual(log.description, 'Alta: Juan');
        assert(log.timestamp.length > 0, 'timestamp presente');
        assert(log.date.length > 0, 'fecha local presente');
        assertEqual(saves, 1, 'persiste con saveTournamentData');
    });

    test('addLog: no rompe si el guardado falla', () => {
        reset();
        S.saveTournamentData = () => { throw new Error('storage lleno'); };
        S.addLog('SISTEMA', 'x');
        assertEqual(env.tournamentData.logs.length, 1, 'igual registra la entrada');
        assertEqual(env.tournamentData.logs[0].action, 'SISTEMA');
    });

    test('showLogs: sin registros muestra el mensaje vacío', () => {
        reset();
        const get = capture();
        S.showLogs();
        assert(get('logs-output').innerHTML.includes('No hay registros'), 'mensaje vacío');
    });

    test('showLogs: arma la tabla en orden reverso y escapa el contenido', () => {
        reset();
        capture();
        S.saveTournamentData = () => {};
        S.addLog('SISTEMA', 'Primero');
        S.addLog('JUGADOR', 'Segundo <script>');
        S.showLogs();
        const html = els['logs-output'].innerHTML;
        assert(html.includes('data-table'), 'tabla');
        assert(html.includes('<th>Fecha y Hora</th>'), 'cabecera');
        assert(html.indexOf('Segundo') < html.indexOf('Primero'), 'orden reverso (último primero)');
        assert(html.includes('Segundo &lt;script&gt;'), 'escHtml en descripción');
    });

    test('exportLogs: sin registros muestra warning y no descarga', () => {
        reset();
        capture();
        let toast = null;
        S.showToast = (m, t) => { toast = { m, t }; };
        let clicks = 0;
        S.document.createElement = () => ({ click: () => { clicks++; }, href: '', download: '' });
        S.exportLogs();
        assertEqual(toast.m, 'No hay registros para exportar');
        assertEqual(toast.t, 'warning');
        assertEqual(clicks, 0, 'no descarga');
    });

    test('exportLogs: arma el TXT, descarga y registra EXPORTAR', () => {
        reset();
        const get = capture();
        S.saveTournamentData = () => {};
        S.addLog('SISTEMA', 'Arranque');
        let clicks = 0, appended = null, removed = null, created = null, revoked = null;
        const toasts = [];
        S.showToast = (m, t) => toasts.push({ m, t });
        const link = { href: '', download: '', click: () => { clicks++; } };
        S.document.createElement = (tag) => tag === 'a' ? link : {};
        S.document.body.appendChild = (el) => { appended = el; };
        S.document.body.removeChild = (el) => { removed = el; };
        S.Blob = class { constructor(parts, opts) { created = { parts, opts }; } };
        S.URL.createObjectURL = (blob) => { S._lastBlob = blob; return 'blob:logs'; };
        S.URL.revokeObjectURL = (url) => { revoked = url; };
        S.exportLogs();
        assertEqual(clicks, 1, 'click de descarga');
        assert(link.download.startsWith('Registro_'), 'nombre de archivo');
        assert(link.download.endsWith('.txt'), 'extensión txt');
        assertEqual(appended, link, 'append');
        assertEqual(removed, link, 'remove');
        assertEqual(revoked, 'blob:logs', 'revoca el objeto URL');
        assert(created.parts[0].includes('BIT') && created.parts[0].includes('Arranque'), 'contenido del TXT');
        assertEqual(toasts[0].m, 'Registro exportado correctamente', 'toast éxito');
        assertEqual(env.tournamentData.logs[env.tournamentData.logs.length - 1].action, 'EXPORTAR', 'registra exportación');
    });

    test('clearLogs: pide confirmación y al aceptar limpia, guarda y re-renderiza', () => {
        reset();
        capture();
        const calls = [];
        S.saveTournamentData = () => calls.push('save');
        S.showLogs = () => calls.push('showLogs');
        S.showToast = (m) => calls.push('toast:' + m);
        S.showModal = (t, b, cb) => { calls.push('modal:' + t); S._modalCb = cb; };
        S.addLog('SISTEMA', 'x');
        els['logs-output'].innerHTML = '<table>...</table>';
        S.clearLogs();
        assert(calls.some(c => c.startsWith('modal:')), 'abre confirmación');
        S._modalCb();
        assertEqual(env.tournamentData.logs.length, 0, 'limpia');
        assert(calls.includes('save') && calls.includes('showLogs'), 'guarda y re-renderiza');
        assert(calls.includes('toast:Registro limpiado'), 'avisa');
    });

    test('clearLogs: si el guardado falla al confirmar muestra error', () => {
        reset();
        capture();
        S.saveTournamentData = () => { throw new Error('x'); };
        S.showLogs = () => {};
        const toasts = [];
        S.showToast = (m, t) => toasts.push({ m, t });
        S.showModal = (t, b, cb) => { S._modalCb2 = cb; };
        S.clearLogs();
        S._modalCb2();
        assertEqual(toasts[toasts.length - 1].m, 'Error al limpiar registros');
        assertEqual(toasts[toasts.length - 1].t, 'error');
    });
});
