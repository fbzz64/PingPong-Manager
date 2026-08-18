// ==========================================
// TESTS/QR.TEST.JS - Planilla de acreditación masiva (js/qr.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

suite('QR / PLANILLA DE ACREDITACIÓN (qr.js)', () => {
    const toasts = [];
    const logs = [];
    let written = [];

    function buildEnv() {
        toasts.length = 0;
        logs.length = 0;
        written.length = 0;
        const env = createEnv();
        const S = env.sandbox;
        S.showToast = (msg) => toasts.push(msg);
        S.addLog = (a, d) => logs.push([a, d]);
        S.escHtml = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        S.window.open = () => {
            const w = {
                document: {
                    write: (html) => { written.push(html); },
                    close: () => {}
                }
            };
            return w;
        };
        S.window.qrDataURL = () => 'data:image/png;base64,QUJD';
        S.qrcode = () => ({ addData: () => {}, make: () => {}, createDataURL: () => 'data:image/png;base64,QUJD' });
        loadInto(env, 'js/i18n.js');
        loadInto(env, 'js/qr.js');
        return env;
    }

    test('sin jugadores válidos → toast de warning y no imprime', () => {
        const env = buildEnv();
        const S = env.sandbox;
        S.tournamentData.players = [{ name: '-', club: '-' }];
        S.printAccreditationSheet();
        assertEqual(written.length, 0, 'no abre la ventana de impresión');
        assert(toasts.some(t => t.includes('No hay jugadores para acreditar')), 'toast de advertencia');
    });

    test('con jugadores genera las tarjetas QR y llama print', () => {
        const env = buildEnv();
        const S = env.sandbox;
        S.tournamentData.settings.torneoNombre = 'Torneo Test';
        S.tournamentData.players = [
            { name: 'Juan', club: 'Club A', categories: ['Sub-13'] },
            { name: 'María', club: 'Club B', categories: [] },
            { name: '-', club: '-', categories: [] }
        ];
        S.printAccreditationSheet();
        assertEqual(written.length, 1, 'abre la ventana de impresión');
        const html = written[0];
        assert(html.includes('qr-grid'), 'grilla de tarjetas');
        assert(html.includes('Torneo Test'), 'nombre del torneo');
        assert(html.includes('Planilla de Acreditación'), 'título de la planilla');
        assert(html.includes('Juan'), 'nombre del jugador');
        assert(html.includes('María'), 'segundo jugador');
        assert(html.includes('Sub-13'), 'categorías visibles');
        assert(html.includes('data:image/png'), 'imagen QR embebida');
        assertEqual((html.match(/class="qr-card"/g) || []).length, 2, 'solo jugadores válidos (sin placeholders)');
        assert(html.includes('window.print'), 'dispara la impresión al cargar');
    });

    test('registra el log de la planilla generada', () => {
        const env = buildEnv();
        const S = env.sandbox;
        S.tournamentData.players = [{ name: 'Ana', club: 'Club X' }];
        S.printAccreditationSheet();
        assert(logs.some(([a]) => a === 'QR'), 'log con acción QR');
    });
});
