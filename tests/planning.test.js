// ==========================================
// TESTS/PLANNING.TEST.JS - Planificación (js/planning.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('PLANNING (planning.js)', () => {
    const env = loadApp(['js/planning.js']);
    const P = env.sandbox;

    const p = (name, club) => ({ name, club });

    test('timeToMin / minToTime conversión', () => {
        assertEqual(P.timeToMin('09:00'), 540);
        assertEqual(P.timeToMin('08:30'), 510);
        assertEqual(P.timeToMin(null), 540, 'sin hora → 9:00');
        assertEqual(P.minToTime(540), '09:00');
        assertEqual(P.minToTime(605), '10:05');
        assertEqual(P.minToTime(0), '00:00');
        assertEqual(P.minToTime(P.timeToMin('14:20')), '14:20', 'round trip');
    });

    test('assignMesasAndTimes: reparte en mesas paralelas sin solapar jugadores', () => {
        const matches = [
            { match: 1, player1: p('A', 'X'), player2: p('B', 'X') },
            { match: 2, player1: p('C', 'X'), player2: p('D', 'X') },
            { match: 3, player1: p('A', 'X'), player2: p('C', 'X') },
            { match: 4, player1: p('B', 'X'), player2: p('D', 'X') }
        ];
        const sched = P.assignMesasAndTimes(matches, 2, '09:00', 15);
        const byMatch = {};
        sched.forEach(s => { byMatch[s.match] = s; });

        assertEqual(byMatch[1].mesa, 1, 'm1 mesa 1');
        assertEqual(byMatch[1].hora, '09:00');
        assertEqual(byMatch[2].mesa, 2, 'm2 mesa 2 (paralela)');
        assertEqual(byMatch[2].hora, '09:00');
        assertEqual(byMatch[3].mesa, 1, 'm3 en mesa 1');
        assertEqual(byMatch[3].hora, '09:15');
        assertEqual(byMatch[4].mesa, 2, 'm4 en mesa 2');
        assertEqual(byMatch[4].hora, '09:15');
    });

    test('assignMesasAndTimes: el mismo jugador no juega a la vez', () => {
        const matches = [
            { match: 1, player1: p('A', 'X'), player2: p('B', 'X') },
            { match: 2, player1: p('A', 'X'), player2: p('C', 'X') }
        ];
        const sched = P.assignMesasAndTimes(matches, 1, '09:00', 15);
        assertEqual(sched[1].slot, 1, 'A ocupa el slot 0');
        assertEqual(sched[1].hora, '09:15');
    });

    test('assignMesasAndTimes: dobles bloquean horario de todos los integrantes', () => {
        const pareja1 = { name: 'Pareja 1', club: 'X', members: [p('M1', 'X'), p('M2', 'X')] };
        const matches = [
            { match: 1, player1: pareja1, player2: { name: 'Pareja 2', club: 'X', members: [p('M3', 'X'), p('M4', 'X')] } },
            { match: 2, player1: p('M1', 'X'), player2: p('Y', 'X') }
        ];
        const sched = P.assignMesasAndTimes(matches, 1, '09:00', 15);
        assertEqual(sched[1].slot, 1, 'M1 ya jugó en el slot 0');
        assertEqual(sched[1].hora, '09:15');
    });

    test('assignMesasAndTimes: sin mesas → Sin cupo', () => {
        const sched = P.assignMesasAndTimes([{ match: 1, player1: p('A', 'X'), player2: p('B', 'X') }], 0, '09:00', 15);
        assertEqual(sched[0].hora, 'Sin cupo');
        assertEqual(sched[0].mesa, '-');
    });

    test('assignMesasAndTimes: participante LIBRE no se agenda', () => {
        const sched = P.assignMesasAndTimes([
            { match: 1, player1: p('A', 'X'), player2: p('-', '-') }
        ], 2, '09:00', 15);
        assertEqual(sched[0].player1, 'LIBRE');
        assertEqual(sched[0].mesa, '-');
        assertEqual(sched[0].hora, '-');
    });

    test('assignMesasAndTimes: cap de 200 slots → Sin cupo', () => {
        const matches = [];
        for (let i = 1; i <= 201; i++) matches.push({ match: i, player1: p('A', 'X'), player2: p('B', 'X') });
        const sched = P.assignMesasAndTimes(matches, 1, '09:00', 15);
        assertEqual(sched.length, 201);
        assertEqual(sched[0].slot, 0);
        assertEqual(sched[199].slot, 199, 'el 200to entra en el último slot');
        assertEqual(sched[200].hora, 'Sin cupo', 'el 201ro no tiene cupo');
        assertEqual(sched[199].hora, '58:45', 'slot 199: 09:00 + 199*15min');
    });

    test('assignMesasAndTimes: referee por mesa (índice = mesa - 1)', () => {
        const matches = [
            { match: 1, player1: p('A', 'X'), player2: p('B', 'X') },
            { match: 2, player1: p('C', 'X'), player2: p('D', 'X') },
            { match: 3, player1: p('E', 'X'), player2: p('F', 'X') }
        ];
        const sched = P.assignMesasAndTimes(matches, 2, '09:00', 15, ['Juez Uno', 'Juez Dos']);
        const byMatch = {};
        sched.forEach(s => { byMatch[s.match] = s; });
        assertEqual(byMatch[1].referee, 'Juez Uno', 'mesa 1 → referees[0]');
        assertEqual(byMatch[2].referee, 'Juez Dos', 'mesa 2 → referees[1]');
        assertEqual(byMatch[3].referee, 'Juez Uno', 'm3 en mesa 1 → referees[0]');
    });

    test('assignMesasAndTimes: sin referees no agrega campo referee', () => {
        const sched = P.assignMesasAndTimes(
            [{ match: 1, player1: p('A', 'X'), player2: p('B', 'X') }], 1, '09:00', 15
        );
        assertEqual(sched[0].referee, '', 'sin referees → referee vacío');
    });

    test('assignMesasAndTimes: referee fuera de rango queda vacío', () => {
        const sched = P.assignMesasAndTimes(
            [{ match: 1, player1: p('A', 'X'), player2: p('B', 'X') }], 2, '09:00', 15, ['Solo Uno']
        );
        assertEqual(sched[0].referee, 'Solo Uno', 'mesa 1 ok');
    });

    test('checkCategoryLimits: detecta categorías llenas', () => {
        env.tournamentData.players = [
            { name: 'A', categories: ['C1', 'C2'] },
            { name: 'B', categories: ['C1'] }
        ];
        env.sandbox.localStorage.setItem('categoryLimits', JSON.stringify({ C1: 3, C2: 1 }));
        assertEqual(P.checkCategoryLimits(['C1', 'C2', 'C3']), ['C2'], 'C2 llena; C1 con cupo; C3 sin límite');
        assertEqual(P.checkCategoryLimits(['C1']), []);
        env.sandbox.localStorage.removeItem('categoryLimits');
        assertEqual(P.checkCategoryLimits(['C1', 'C2']), [], 'sin límites guardados');
    });

    test('renameCategoryEverywhere: renombra en jugadores, espera, fixtures y llaves', () => {
        env.tournamentData.players = [{ name: 'A', categories: ['VIEJA', 'OTRA'] }];
        env.tournamentData.waitlist = [{ name: 'W', categories: ['VIEJA'] }];
        env.tournamentData.fixtures = [{ categoria: 'VIEJA' }, { categoria: 'OTRA' }];
        env.tournamentData.brackets = [{ categoria: 'VIEJA' }];
        P.renameCategoryEverywhere('VIEJA', 'NUEVA');
        assertEqual(env.tournamentData.players[0].categories, ['NUEVA', 'OTRA']);
        assertEqual(env.tournamentData.waitlist[0].categories, ['NUEVA']);
        assertEqual(env.tournamentData.fixtures[0].categoria, 'NUEVA');
        assertEqual(env.tournamentData.fixtures[1].categoria, 'OTRA', 'no toca otras categorías');
        assertEqual(env.tournamentData.brackets[0].categoria, 'NUEVA');
    });

    test('getCustomCategories: siembra defaults la primera vez, defaults ante JSON corrupto', () => {
        env.sandbox.localStorage.removeItem('customCategories');
        const seeded = P.getCustomCategories();
        assert(seeded.length >= 14, 'sin inicializar → siembra las estándar');
        assert(env.sandbox.localStorage.getItem('customCategories') !== null, 'persiste la siembra en localStorage');
        env.sandbox.localStorage.setItem('customCategories', '{{{no-json');
        const defs = P.getCustomCategories();
        assert(defs.includes('PRIMERA'), 'defaults ante JSON corrupto');
        assert(defs.includes('SUB 11'), 'defaults ante JSON corrupto');
        assert(defs.includes('MAXI 40'), 'defaults ante JSON corrupto');
        env.sandbox.localStorage.setItem('customCategories', JSON.stringify(['X1', 'X2']));
        assertEqual(P.getCustomCategories(), ['X1', 'X2']);
    });

    test('ensureCustomCategories: siembra defaults la primera vez', () => {
        env.sandbox.localStorage.removeItem('customCategories');
        const seeded = P.ensureCustomCategories();
        assert(seeded.length >= 14, 'siembra todas las estándar');
        assert(env.sandbox.localStorage.getItem('customCategories') !== null, 'persiste en localStorage');
    });

    test('getTemplates: lee plantillas guardadas', () => {
        env.sandbox.localStorage.removeItem('tournamentTemplates');
        assertEqual(P.getTemplates(), []);
        env.sandbox.localStorage.setItem('tournamentTemplates', JSON.stringify([{ name: 'T' }]));
        assertEqual(P.getTemplates(), [{ name: 'T' }]);
    });

    test('addPlayerToWaitlist: guarda la entrada normalizada', () => {
        env.tournamentData.waitlist = [];
        P.addPlayerToWaitlist('Ana', 'Club X', ['C1'], 'abc', ['M1'], '2000-01-01', 'L123');
        const w = env.tournamentData.waitlist[0];
        assertEqual(w.name, 'Ana');
        assertEqual(w.club, 'Club X');
        assertEqual(w.categories, ['C1']);
        assertEqual(w.ranking, null, 'ranking no numérico → null');
        assertEqual(w.members, ['M1']);
        assertEqual(w.licencia, 'L123');
        assertEqual(w.fechaNac, '2000-01-01');
        assert(w.addedAt, 'fecha de alta presente');

        env.tournamentData.waitlist = [];
        P.addPlayerToWaitlist('Bob', 'Club Y', ['C2'], '42', undefined, '', '');
        const w2 = env.tournamentData.waitlist[0];
        assertEqual(w2.ranking, '42', 'ranking numérico se conserva');
        assert(w2.members === undefined, 'sin integrantes → undefined');
        assert(w2.fechaNac === undefined, 'sin fecha → undefined');
    });

    test('buildScheduleDiffusionMessage: arma programación con mesas y horarios', () => {
        env.tournamentData.settings.torneoNombre = 'Torneo Test';
        const fixture = {
            categoria: 'SUB 13',
            grupo: 'A',
            schedule: [
                { match: 1, player1: 'Ana', player2: 'Beto', mesa: 1, hora: '09:00', slot: 0 },
                { match: 2, player1: 'Caro', player2: 'Dani', mesa: 2, hora: '09:00', slot: 0 }
            ]
        };
        const msg = P.buildScheduleDiffusionMessage(fixture);
        assert(msg.includes('Torneo Test'), 'nombre');
        assert(msg.includes('SUB 13'), 'categoría');
        assert(msg.includes('Grupo A'), 'grupo');
        assert(msg.includes('09:00 · Mesa 1'), 'hora y mesa');
        assert(msg.includes('Ana'), 'jugador 1');
        assert(msg.includes('Beto'), 'jugador 2');
    });

    test('buildScheduleDiffusionMessage: partido sin cupo y sin schedule', () => {
        env.tournamentData.settings.torneoNombre = 'Torneo Test';
        const sinCupo = P.buildScheduleDiffusionMessage({
            categoria: 'C1', grupo: 'A',
            schedule: [{ match: 1, player1: 'Ana', player2: 'Beto', mesa: '-', hora: 'Sin cupo', slot: -1 }]
        });
        assert(sinCupo.includes('sin cupo'), 'avisa partido sin cupo');

        const vacio = P.buildScheduleDiffusionMessage({ categoria: 'C1', grupo: 'A', schedule: [] });
        assert(vacio.includes('Sin partidos programados'), 'schedule vacío');
        assertEqual(P.buildScheduleDiffusionMessage({ categoria: 'C1', grupo: 'A' }), vacio, 'sin schedule → mismo mensaje');
    });
});
