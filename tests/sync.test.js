// ==========================================
// TESTS/SYNC.TEST.JS - Sincronización multi-dispositivo
// (js/sync.js — lógica pura, sin Firebase real)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('SYNC (sincronización multi-dispositivo)', () => {
    const env = loadApp(['js/sync.js']);
    const S = env.sandbox;

    test('syncGetStatus: estado inicial es desconectado', () => {
        const st = S.syncGetStatus();
        assertEqual(st.active, false, 'no activo');
        assertEqual(st.role, null, 'sin rol');
        assertEqual(st.roomId, null, 'sin sala');
        assertEqual(st.connected, false, 'sin conexión');
        assertEqual(st.viewers, 0, 'sin viewers');
    });

    test('syncCreateRoom: sin Firebase configurado avisa', () => {
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        const result = S.syncCreateRoom();
        assertEqual(result, null, 'retorna null');
        assert(toastMsg && /no configurad/i.test(toastMsg), 'muestra warning de config');
    });

    test('syncJoinRoom: código inválido avisa', () => {
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        S.syncJoinRoom('ABC');  // muy corto
        assert(toastMsg && /inválido/i.test(toastMsg), 'código muy corto avisa');
    });

    test('syncJoinRoom: código vacío avisa', () => {
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        S.syncJoinRoom('');
        assert(toastMsg, 'muestra toast');
    });

    test('syncPush: no falla cuando no hay sync activo', () => {
        // syncPush es noop cuando syncState.active = false
        S.syncPush();  // no debe tirar error
        assert(true, 'no lanza excepción');
    });

    test('syncStopHost: sin conexión no falla', () => {
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        S.syncStopHost();
        assert(toastMsg, 'muestra toast de desconexión');
    });

    test('syncDisconnectClient: sin conexión no falla', () => {
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        S.syncDisconnectClient();
        assert(toastMsg, 'muestra toast');
    });

    test('syncReconnect: sin room guardado no hace nada', () => {
        S.localStorage.removeItem('ttmSyncRoom');
        S.syncReconnect();  // noop, no debe fallar
        const st = S.syncGetStatus();
        assertEqual(st.active, false, 'sigue desconectado');
    });

    test('syncCanEdit: el modo local permite editar', () => {
        assertEqual(S.syncCanEdit(), true, 'edicion local habilitada');
    });

    test('syncAutoReconnect: sin Firebase configurado no intenta conectar', () => {
        assertEqual(S.syncAutoReconnect(), false, 'no reconecta sin config');
    });
});
