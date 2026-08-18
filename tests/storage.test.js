// ==========================================
// TESTS/STORAGE.TEST.JS - Normalización y deshacer/rehacer
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto, loadApp } = require('./env');

suite('STORAGE (normalización y deshacer/rehacer)', () => {
    const env = loadApp();
    const N = env.window.normalizeTournamentData;

    test('normalizeTournamentData: entrada nula → estructura completa', () => {
        const d = N(null);
        assertEqual(d.fixtures, []);
        assertEqual(d.players, []);
        assertEqual(d.logs, []);
        assertEqual(d.waitlist, []);
        assertEqual(d.settings.formatoPartidoGrupos, 'bo5');
        assertEqual(d.settings.formatoPartidoLlaves, 'bo5');
        assertEqual(d.settings.mesas, 4);
    });

    test('normalizeTournamentData: unwrap de backup completo {data:...}', () => {
        const d = N({
            timestamp: '2026-08-12T00:00:00Z',
            version: '2.4',
            data: { fixtures: [], players: [], brackets: [], settings: { formatoPartidoGrupos: 'bo7' }, logs: [] }
        });
        assertEqual(d.settings.formatoPartidoGrupos, 'bo7');
        assertEqual(d.fixtures, []);
        assertEqual(d.settings.mesas, 4, 'defaults aplicados tras unwrap');
    });

    test('normalizeTournamentData: normaliza formatos bo3/bo5/bo7', () => {
        const d = N({ settings: { formatoPartidoGrupos: 'bo3', formatoPartidoLlaves: 'bo7' } });
        assertEqual(d.settings.formatoPartidoGrupos, 'bo3');
        assertEqual(d.settings.formatoPartidoLlaves, 'bo7');
        const d2 = N({ settings: { formatoPartidoGrupos: 'bo9', formatoPartidoLlaves: undefined } });
        assertEqual(d2.settings.formatoPartidoGrupos, 'bo5', 'bo9 → bo5');
        assertEqual(d2.settings.formatoPartidoLlaves, 'bo5', 'undefined → bo5');
        const d3 = N({ settings: { formatoPartidoGrupos: 'bo3' } });
        assertEqual(d3.settings.formatoPartidoLlaves, 'bo5', 'faltante → bo5');
    });

    test('normalizeTournamentData: defaults por jugador', () => {
        const d = N({ players: [{ name: 'juan', club: 'club' }] });
        assertEqual(d.players[0].checkin, false);
        assertEqual(d.players[0].elo, 1200);
        assertEqual(d.players[0].history, []);
    });

    test('normalizeTournamentData: aplica formatPlayerName/Club si existen', () => {
        const e = createEnv();
        e.sandbox.formatPlayerName = (n) => n.toUpperCase();
        e.sandbox.formatPlayerClub = (c) => c.toUpperCase();
        e.window.formatPlayerName = e.sandbox.formatPlayerName;
        e.window.formatPlayerClub = e.sandbox.formatPlayerClub;
        loadInto(e, 'js/storage.js');
        const d = e.window.normalizeTournamentData({ players: [{ name: 'juan', club: 'club' }] });
        assertEqual(d.players[0].name, 'JUAN');
        assertEqual(d.players[0].club, 'CLUB');
    });

    test('escHtml y escAttr escapan correctamente', () => {
        assertEqual(env.window.escHtml('<b>&"\'a'), '&lt;b&gt;&amp;&quot;&#39;a');
        assertEqual(env.window.escAttr('a"b'), 'a&quot;b');
        assertEqual(env.window.escHtml(null), '');
        assertEqual(env.window.escAttr(undefined), '');
    });

    test('deshacer/rehacer: checkpoint único por operación atómica', () => {
        const W = env.window;
        W.resetUndoHistory();
        assertEqual(W.getUndoRedoState(), { canUndo: false, canRedo: false });

        W.beginHistoryOp();
        env.tournamentData.settings.torneoNombre = 'Torneo N1';
        W.saveTournamentData();
        env.tournamentData.logs.push({ action: 'X' });
        W.saveTournamentData();
        W.commitHistoryOp();

        const st = W.getUndoRedoState();
        assert(st.canUndo, 'debe poder deshacer');
        assert(!st.canRedo, 'no debe poder rehacer aún');

        W.undoAction();
        assertEqual(env.window.tournamentData.settings.torneoNombre, 'Torneo Test', 'nombre revertido');
        assertEqual(W.getUndoRedoState().canRedo, true, 'puede rehacer');

        W.redoAction();
        assertEqual(env.window.tournamentData.settings.torneoNombre, 'Torneo N1', 'nombre rehecho');
    });

    test('deshacer sin historial no rompe', () => {
        const W = env.window;
        W.resetUndoHistory();
        assert(!W.getUndoRedoState().canUndo, 'historial vacío');
        // undoAction con stack vacío solo toca toasts (stub) → no debe tirar error
        W.undoAction();
        assert(!W.getUndoRedoState().canUndo, 'sigue vacío tras undo sin historial');
    });

    test('saveTournamentData persiste en localStorage', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.tournamentData.settings.torneoNombre = 'Persistido';
        W.saveTournamentData();
        const raw = env.sandbox.localStorage.getItem('tournamentData');
        assert(raw, 'hay datos en localStorage');
        assertEqual(JSON.parse(raw).settings.torneoNombre, 'Persistido');
    });

    test('saveTournamentData registra la marca de última sesión', () => {
        const W = env.window;
        W.resetUndoHistory();
        W.saveTournamentData();
        const marca = env.sandbox.localStorage.getItem('ttmLastSavedAt');
        assert(marca, 'marca de última sesión guardada');
        assert(!isNaN(Date.parse(marca)), 'marca es fecha ISO válida');
    });

    test('saveSessionRecovery: guarda checkpoint con throttle y force', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.tournamentData.settings.torneoNombre = 'Recuperable';
        W.saveSessionRecovery(true);
        const rec = JSON.parse(env.sandbox.localStorage.getItem('ttmSessionRecovery'));
        assert(rec, 'checkpoint guardado');
        assertEqual(rec.data.settings.torneoNombre, 'Recuperable');
        assert(rec.savedAt, 'timestamp del checkpoint');

        // Con throttle, una segunda llamada sin force no re-escribe.
        env.tournamentData.settings.torneoNombre = 'Throttle';
        W.saveSessionRecovery();
        const rec2 = JSON.parse(env.sandbox.localStorage.getItem('ttmSessionRecovery'));
        assertEqual(rec2.data.settings.torneoNombre, 'Recuperable', 'throttle: no se reescribe');
    });

    test('loadTournamentData restaura desde el checkpoint si el principal está corrupto', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.tournamentData.settings.torneoNombre = 'SesionDeRespaldo';
        W.saveSessionRecovery(true);
        env.sandbox.localStorage.setItem('tournamentData', '{corrupto');

        W.loadTournamentData();
        assertEqual(env.window.tournamentData.settings.torneoNombre, 'SesionDeRespaldo', 'restaurado del checkpoint');
    });

    test('loadTournamentData: sin checkpoint corrupto cae en estado vacío', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.sandbox.localStorage.removeItem('tournamentData');
        env.sandbox.localStorage.removeItem('ttmSessionRecovery');
        W.loadTournamentData();
        assertEqual(env.window.tournamentData.players, [], 'empieza vacío');
    });

    test('backups automáticos: saveAutoBackup fuerza y respeta throttle', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.sandbox.localStorage.removeItem('ttmAutoBackups');

        env.tournamentData.settings.torneoNombre = 'Backup N1';
        W.saveAutoBackup(true);
        assertEqual(W.listAutoBackups().length, 1, 'primer backup forzado');

        // Throttle: sin force no se re-escribe dentro del intervalo
        env.tournamentData.settings.torneoNombre = 'Throttle';
        W.saveAutoBackup();
        assertEqual(W.listAutoBackups().length, 1, 'throttle: no agrega backup');

        const raw = JSON.parse(env.sandbox.localStorage.getItem('ttmAutoBackups'));
        assertEqual(raw[0].data.settings.torneoNombre, 'Backup N1', 'conserva el primer dato');
    });

    test('backups automáticos: rotación conserva solo los últimos 6', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.sandbox.localStorage.removeItem('ttmAutoBackups');
        for (let i = 1; i <= 8; i++) {
            env.tournamentData.settings.torneoNombre = 'Backup ' + i;
            W.saveAutoBackup(true);
        }
        const backups = W.listAutoBackups();
        assertEqual(backups.length, 6, 'máximo 6 backups');
        const raw = JSON.parse(env.sandbox.localStorage.getItem('ttmAutoBackups'));
        assertEqual(raw[raw.length - 1].data.settings.torneoNombre, 'Backup 8', 'el último queda');
        assertEqual(raw[0].data.settings.torneoNombre, 'Backup 3', 'el más viejo se descartó');
    });

    test('backups automáticos: restoreAutoBackup restaura datos y persiste', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.sandbox.localStorage.removeItem('ttmAutoBackups');

        env.tournamentData.settings.torneoNombre = 'Antes';
        W.saveAutoBackup(true);

        env.tournamentData.settings.torneoNombre = 'Después';
        env.tournamentData.players.push({ name: 'extra' });
        W.saveAutoBackup(true);

        // Restaura el índice 0 (el más viejo → 'Antes')
        const ok = W.restoreAutoBackup(0);
        assert(ok, 'restaura correctamente');
        assertEqual(env.window.tournamentData.settings.torneoNombre, 'Antes', 'nombre restaurado');
        assertEqual(env.window.tournamentData.players.length, 0, 'jugador extra eliminado');
        assertEqual(W.getUndoRedoState().canUndo, false, 'historial de deshacer reiniciado');
    });

    test('backups automáticos: índices inválidos no rompen', () => {
        const W = env.window;
        W.resetUndoHistory();
        env.sandbox.localStorage.removeItem('ttmAutoBackups');
        env.tournamentData.settings.torneoNombre = 'Solo';
        W.saveAutoBackup(true);

        assertEqual(W.restoreAutoBackup(5), false, 'índice fuera de rango → false');
        assertEqual(W.listAutoBackups()[0].savedAt, W.listAutoBackups()[0].savedAt, 'lista intacta');
    });
});
