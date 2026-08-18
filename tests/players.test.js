// ==========================================
// TESTS/PLAYERS.TEST.JS - Jugadores (js/players.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('JUGADORES (players.js)', () => {
    const env = loadApp(['js/players.js']);
    const P = env.sandbox;

    // Fija la fecha de "ahora" para tests dependientes de la edad.
    function withDate(iso, fn) {
        const RealDate = vm.runInContext('Date', env.ctx);
        class FixedDate extends RealDate {
            constructor(...args) { super(...(args.length ? args : [iso])); }
            static now() { return new RealDate(iso).getTime(); }
        }
        env.sandbox.Date = FixedDate;
        try { return fn(); } finally { env.sandbox.Date = RealDate; }
    }

    test('formatPlayerName: capitaliza y elimina tildes', () => {
        assertEqual(P.formatPlayerName('marcos osorio'), 'Marcos Osorio');
        assertEqual(P.formatPlayerName('MaRIELA GONZÁLEZ'), 'Mariela Gonzalez');
        assertEqual(P.formatPlayerName('  juan  pablo  '), 'Juan Pablo');
        assertEqual(P.formatPlayerName('ANA'), 'Ana');
        assertEqual(P.formatPlayerName(''), '');
        assertEqual(P.formatPlayerName(null), '');
    });

    test('formatPlayerClub: mayúsculas y sin tildes', () => {
        assertEqual(P.formatPlayerClub('cedeMU'), 'CEDEMU');
        assertEqual(P.formatPlayerClub('san martín'), 'SAN MARTIN');
        assertEqual(P.formatPlayerClub('  club atlético  '), 'CLUB ATLETICO');
        assertEqual(P.formatPlayerClub(''), '');
    });

    test('parseLocalDate: parsea en hora local sin corrimiento UTC', () => {
        const d = P.parseLocalDate('2000-01-01');
        assert(d && typeof d.getTime === 'function', 'devuelve Date');
        assertEqual(d.getFullYear(), 2000, 'año local correcto (sin shift a 1999)');
        assertEqual(d.getMonth(), 0, 'mes local correcto');
        assertEqual(d.getDate(), 1, 'día local correcto');
        assertEqual(P.parseLocalDate('2000-12-31').getMonth(), 11);
        assertEqual(P.parseLocalDate(''), null);
        assertEqual(P.parseLocalDate('no-una-fecha'), null);
        assertEqual(P.parseLocalDate(null), null);
    });

    test('getCalendarAge: edad por año calendario', () => {
        const year = new Date().getFullYear();
        assertEqual(P.getCalendarAge('2000-06-30'), year - 2000);
        assertEqual(P.getCalendarAge('1990-01-01'), year - 1990);
        assertEqual(P.getCalendarAge(''), null);
    });

    test('getSuggestedSubcategory: por año de nacimiento', () => {
        const y = new Date().getFullYear();
        const cases = [
            [(y - 9) + '-01-01', 'SUB 9'],
            [(y - 11) + '-01-01', 'SUB 11'],
            [(y - 13) + '-01-01', 'SUB 13'],
            [(y - 15) + '-01-01', 'SUB 15'],
            [(y - 19) + '-01-01', 'SUB 19'],
            [(y - 23) + '-01-01', 'SUB 23'],
            [(y - 24) + '-01-01', 'MAYORES']
        ];
        cases.forEach(([fecha, esperada]) => assertEqual(P.getSuggestedSubcategory(fecha), esperada, fecha));
        assertEqual(P.getSuggestedSubcategory(''), null);
    });

    test('getPlayerAge: edad exacta según fecha fija', () => {
        withDate('2025-06-15T12:00:00Z', () => {
            assertEqual(P.getPlayerAge('2000-01-15'), 25, 'cumplió este año');
            assertEqual(P.getPlayerAge('2000-12-31'), 24, 'no cumplió aún');
            assertEqual(P.getPlayerAge('1985-06-15'), 40, 'cumple hoy');
            assertEqual(P.getPlayerAge('1985-06-16'), 39, 'cumple mañana');
            assertEqual(P.getPlayerAge(''), null);
        });
    });

    test('getSuggestedMaxi: por edad exacta', () => {
        withDate('2025-06-15T12:00:00Z', () => {
            assertEqual(P.getSuggestedMaxi('1965-01-01'), 'MAXI 60');
            assertEqual(P.getSuggestedMaxi('1975-01-01'), 'MAXI 50');
            assertEqual(P.getSuggestedMaxi('1985-06-15'), 'MAXI 40');
            assertEqual(P.getSuggestedMaxi('1985-06-16'), null, '39 años → sin MAXI');
            assertEqual(P.getSuggestedMaxi(''), null);
        });
    });

    test('isValidLicense: vacío o 4-15 alfanuméricos', () => {
        assert(P.isValidLicense(''), 'vacío → válido');
        assert(P.isValidLicense('   '), 'espacios → válido');
        assert(P.isValidLicense('ABC123'), '6 alfanuméricos → válido');
        assert(P.isValidLicense('abcd'), '4 → válido');
        assert(!P.isValidLicense('ABC'), '3 → inválido');
        assert(!P.isValidLicense('ABCDEF12345678901'), '17 → inválido');
        assert(!P.isValidLicense('AB 12'), 'espacio interno → inválido');
        assert(!P.isValidLicense('Número!'), 'símbolos → inválido');
    });

    test('getPersonKey: identidad nombre|club en minúsculas', () => {
        assertEqual(P.getPersonKey({ name: '  Ana  ', club: 'Club X' }), 'ana|club x');
        assertEqual(P.getPersonKey({ name: 'ANA', club: 'CLUB X' }), 'ana|club x', 'case-insensitive');
        assertEqual(P.getPersonKey({ name: '', club: 'X' }), '|x');
        assertEqual(P.getPersonKey(null), '|');
    });

    test('getParticipantMembers: individual, pareja e inválidos', () => {
        assertEqual(P.getParticipantMembers({ name: 'Ana', club: 'X' }), [{ name: 'Ana', club: 'X' }]);
        const pareja = { name: 'P1', club: 'X', members: [{ name: 'M1', club: 'X' }, { name: '-', club: '-' }, { name: 'M3', club: 'Y' }] };
        assertEqual(P.getParticipantMembers(pareja).length, 2, 'filtra integrantes inválidos');
        assertEqual(P.getParticipantMembers({ name: 'TBD', club: '-' }), []);
        assertEqual(P.getParticipantMembers({ name: '-', club: '-' }), []);
        assertEqual(P.getParticipantMembers(null), []);
    });

    test('getParticipantPersonKeys: claves de todos los integrantes', () => {
        const pareja = { name: 'P1', club: 'X', members: [{ name: 'M1', club: 'X' }, { name: 'M2', club: 'X' }] };
        assertEqual(P.getParticipantPersonKeys(pareja), ['m1|x', 'm2|x']);
    });

    test('findPersonInOtherTeams: detecta persona en otra pareja/equipo', () => {
        env.tournamentData.players = [
            { name: 'Indiv', club: 'X' },
            { name: 'Pareja', club: 'Y', members: [{ name: 'M1', club: 'X' }, { name: 'M2', club: 'X' }] }
        ];
        const found = P.findPersonInOtherTeams('m1|x');
        assertEqual(found.length, 1);
        assertEqual(found[0].name, 'Pareja');
        assertEqual(P.findPersonInOtherTeams('nadie|x'), [], 'sin coincidencia');
    });

    test('attachMembersToFixturePlayers: resuelve miembros desde la base', () => {
        env.tournamentData.players = [
            { name: 'Pareja', club: 'Y', members: [{ name: 'M1', club: 'X' }, { name: 'M2', club: 'X' }] },
            { name: 'Indiv', club: 'Z' }
        ];
        const resolved = P.attachMembersToFixturePlayers([
            { name: 'Pareja', club: 'Y' },
            { name: 'Indiv', club: 'Z' },
            { name: '-', club: '-' }
        ]);
        assertEqual(resolved[0].members.length, 2, 'adjunta integrantes de la pareja');
        assert(resolved[1].members === undefined, 'individual sin members');
        assertEqual(resolved[2].name, '-', 'placeholder intacto');
    });

    test('findDuplicatePersonInParticipants: un jugador no puede repetirse', () => {
        const pareja = { name: 'P1', club: 'X', members: [{ name: 'Ana', club: 'X' }, { name: 'M2', club: 'X' }] };
        const conflicts = P.findDuplicatePersonInParticipants([
            { name: 'Ana', club: 'X' },
            pareja
        ]);
        assertEqual(conflicts.length, 1, 'Ana está en individual y en la pareja');
        assertEqual(conflicts[0].person, 'ana|x');

        const limpias = P.findDuplicatePersonInParticipants([
            { name: 'Ana', club: 'X' },
            { name: 'M2', club: 'X' }
        ]);
        assertEqual(limpias, [], 'sin conflictos');
    });

    test('forceAddNewPlayer: alta con defaults correctos', () => {
        env.tournamentData.players = [];
        P.forceAddNewPlayer('  marcos  ', '  club x ', ['PRIMERA'], 'abc', undefined, '2000-01-01', 'LIC123');
        const p = env.tournamentData.players[0];
        assertEqual(p.name, 'Marcos', 'nombre formateado');
        assertEqual(p.club, 'CLUB X', 'club formateado');
        assertEqual(p.categories, ['PRIMERA']);
        assertEqual(p.ranking, null, 'ranking no numérico → null');
        assertEqual(p.fechaNac, '2000-01-01');
        assertEqual(p.licencia, 'LIC123');
        assertEqual(p.checkin, false);
        assertEqual(p.elo, 1200, 'ELO default');
        assertEqual(p.history, []);
        assertEqual(env.tournamentData.players.length, 1);
    });

    test('forceAddNewPlayer: duplicado fusiona categorías sin repetir', () => {
        env.tournamentData.players = [];
        P.forceAddNewPlayer('Ana', 'Club X', ['A', 'B']);
        P.forceAddNewPlayer('ANA', 'CLUB X', ['B', 'C']);
        assertEqual(env.tournamentData.players.length, 1, 'no duplica la entrada');
        assertEqual(env.tournamentData.players[0].categories, ['A', 'B', 'C']);
    });

    test('forceAddNewPlayer: miembros de pareja se normalizan', () => {
        env.tournamentData.players = [];
        P.forceAddNewPlayer('P1', 'Club X', ['A'], 42, [{ name: ' m1 ', club: ' club y ' }, { name: 'M2', club: 'Club Y' }]);
        const p = env.tournamentData.players[0];
        assertEqual(p.members[0].name, 'M1', 'integrante formateado');
        assertEqual(p.members[0].club, 'CLUB Y', 'club del integrante formateado');
        assertEqual(p.ranking, 42, 'ranking numérico se conserva');
    });

    test('toggleCheckin / toggleCheckinAll', () => {
        env.tournamentData.players = [
            { name: 'A', club: 'X', checkin: false },
            { name: 'B', club: 'Y', checkin: false }
        ];
        P.toggleCheckin(0);
        assertEqual(env.tournamentData.players[0].checkin, true, 'marca presente');
        P.toggleCheckin(0);
        assertEqual(env.tournamentData.players[0].checkin, false, 'desmarca');
        P.toggleCheckinAll(true);
        assertEqual(env.tournamentData.players.every(x => x.checkin), true, 'todos presentes');
        P.toggleCheckinAll(false);
        assertEqual(env.tournamentData.players.every(x => !x.checkin), true, 'todos ausentes');
    });

    test('snapshotTournamentResults: registra historial a jugador e integrantes', () => {
        env.tournamentData.players = [
            { name: 'Pareja', club: 'X', members: [{ name: 'M1', club: 'Y' }, { name: 'M2', club: 'Y' }] },
            { name: 'Solo', club: 'Z' },
            { name: 'M1', club: 'Y' },
            { name: 'M2', club: 'Y' }
        ];
        const podiums = {
            'PRIMERA': [{ name: 'Pareja', club: 'X', members: [{ name: 'M1', club: 'Y' }, { name: 'M2', club: 'Y' }], points: 100 }]
        };
        const added = P.snapshotTournamentResults(podiums);
        assertEqual(added, 3, 'pareja + sus 2 integrantes (los 2 existen en la base)');
        assertEqual(env.tournamentData.players[0].history.length, 1);
        assertEqual(env.tournamentData.players[0].history[0].categoria, 'PRIMERA');
        assertEqual(env.tournamentData.players[0].history[0].posicion, 1);
        assertEqual(env.tournamentData.players[0].history[0].pts, 100);

        const added2 = P.snapshotTournamentResults({});
        assertEqual(added2, 0, 'sin podios → 0');
    });

    test('checkBeforeAddingPlayer: detecta duplicados por nombre y club', () => {
        env.tournamentData.players = [
            { name: 'Marcos Osorio', club: 'CEDEMU', categories: ['A'] },
            { name: 'Juan Perez', club: 'OTRO', categories: ['A'] }
        ];
        const exact = P.checkBeforeAddingPlayer('marcos osorio', 'cedemu');
        assertEqual(exact.length, 1, 'duplicado exacto detectado');
        assertEqual(exact[0].confidence, 100);

        const similar = P.checkBeforeAddingPlayer('Marco Osorio', 'CEDEMU');
        assert(similar.length >= 1, 'nombre muy similar con mismo club');

        const distinto = P.checkBeforeAddingPlayer('Federico Gomez', 'LEJOS');
        assertEqual(distinto, [], 'sin parecido → sin duplicados');
    });

    test('calculateNameSimilarity / isPotentialDuplicate', () => {
        assertEqual(P.calculateNameSimilarity('marcos', 'marcos'), 100);
        assertEqual(P.calculateNameSimilarity('marcos', 'juan'), 0);
        assertEqual(P.isPotentialDuplicate({ name: 'Ana', club: 'X' }, { name: 'Ana', club: 'X' }).confidence, 100);
        assertEqual(P.isPotentialDuplicate({ name: 'Ana', club: 'X' }, { name: 'Bob', club: 'Y' }).isDuplicate, false);
    });

    test('avatarHTML: iniciales si no hay foto, img si hay avatar', () => {
        const withAvatar = P.avatarHTML({ name: 'Ana Gomez', club: 'X', avatar: 'data:image/jpeg;base64,AA==' }, 40);
        assert(withAvatar.includes('data:image/jpeg'), 'usa la foto cargada');
        assertEqual(withAvatar.includes('Ana'), true, 'alt con el nombre');

        const initials = P.avatarHTML({ name: 'Ana Gomez', club: 'X' }, 40);
        assert(initials.includes('AG'), 'iniciales del nombre');
        assert(!initials.includes('data:image'), 'sin avatar → iniciales');

        assertEqual(P.avatarHTML(null, 40), '', 'jugador nulo → vacío');
    });

    test('isPlayerInMatch: por nombre/club directo y por miembros de pareja', () => {
        const ana = { name: 'Ana', club: 'X' };
        const pareja = { name: 'P1', club: 'X', members: [{ name: 'M1', club: 'Y' }, { name: 'M2', club: 'Y' }] };
        assertEqual(P.isPlayerInMatch({ name: 'Ana', club: 'X' }, ana, pareja), 1, 'lado 1');
        assertEqual(P.isPlayerInMatch({ name: 'M1', club: 'Y' }, ana, pareja), 2, 'integrante en lado 2');
        assertEqual(P.isPlayerInMatch({ name: 'Nadie', club: 'Z' }, ana, pareja), 0, 'sin coincidencia');
    });

    test('getPlayerFixtureMatches: agrupa partidos del jugador en todos los fixtures', () => {
        env.tournamentData.players = [
            { name: 'Ana', club: 'X' },
            { name: 'Bob', club: 'Y' }
        ];
        const mkMatch = (n, p1, p2, completed, winnerSide) => ({
            match: n, player1: p1, player2: p2,
            sets: { player1: ['11', '9'], player2: ['8', '11'] },
            winnerSide, completed
        });
        const p1 = { name: 'Ana', club: 'X', index: 0 };
        const p2 = { name: 'Bob', club: 'Y', index: 1 };
        env.tournamentData.fixtures = [
            { id: 1, timestamp: '2026-01-01T10:00:00.000Z', categoria: 'PRIMERA', grupo: 'A', matches: [mkMatch(1, p1, p2, true, 1)] },
            { id: 2, timestamp: '2026-02-01T10:00:00.000Z', categoria: 'SEGUNDA', grupo: 'B', matches: [mkMatch(1, p2, p1, true, 1)] }
        ];
        const matches = P.getPlayerFixtureMatches(0);
        assertEqual(matches.length, 2, 'dos partidos con Ana');
        assertEqual(matches[0].timestamp < matches[1].timestamp, true, 'ordenados por fecha de fixture');
        assertEqual(matches[0].opponent.name, 'Bob');
        assertEqual(matches[1].opponent.name, 'Bob');
        assertEqual(matches[1].side, 2, 'Ana en lado 2 del segundo partido');
        assertEqual(P.getPlayerFixtureMatches(99), [], 'índice inexistente → vacío');
    });

    test('getPlayerCurrentTournamentStats: PJ/G/E, sets, puntos, racha y por categoría', () => {
        env.tournamentData.players = [
            { name: 'Ana', club: 'X' }, { name: 'Bob', club: 'Y' },
            { name: 'Carlos', club: 'Z' }, { name: 'Dina', club: 'W' }
        ];
        const mk = (n, p1, p2, s1, s2, winnerSide, completed = true) => ({
            match: n, player1: p1, player2: p2,
            sets: { player1: s1, player2: s2 }, winnerSide, completed
        });
        const A = { name: 'Ana', club: 'X', index: 0 };
        const B = { name: 'Bob', club: 'Y', index: 1 };
        const C = { name: 'Carlos', club: 'Z', index: 2 };
        const D = { name: 'Dina', club: 'W', index: 3 };
        env.tournamentData.fixtures = [
            {
                id: 1, timestamp: '2026-01-01T10:00:00.000Z', categoria: 'PRIMERA', grupo: 'A',
                matches: [
                    mk(1, A, B, ['11', '11'], ['5', '9'], 1),
                    mk(2, A, C, ['11', '11'], ['8', '6'], 1),
                    mk(3, A, D, ['9', '8'], ['11', '11'], 2),
                    mk(4, A, B, [], [], 1, false)
                ]
            },
            {
                id: 2, timestamp: '2026-02-01T10:00:00.000Z', categoria: 'SEGUNDA', grupo: 'B',
                matches: [
                    mk(1, A, B, ['11', '11'], ['7', '4'], 1),
                    mk(2, A, C, ['11', '11', '11'], ['9', '13', '7'], 1)
                ]
            }
        ];

        const s = P.getPlayerCurrentTournamentStats(0);
        assertEqual(s.played, 5, 'excluye el pendiente');
        assertEqual(s.won, 4);
        assertEqual(s.lost, 1);
        assertEqual(s.setsWon, 8, '8-3 en sets');
        assertEqual(s.setsLost, 3);
        assertEqual(s.pointsFor, 116, 'puntos a favor acumulados');
        assertEqual(s.pointsAgainst, 90, 'puntos en contra acumulados');
        assertEqual(s.streak, 2, 'racha de 2G al cierre');
        assertEqual(s.byCategory.PRIMERA, { played: 3, won: 2 });
        assertEqual(s.byCategory.SEGUNDA, { played: 2, won: 2 });
    });

    test('getPlayerHeadToHead: agrega por rival', () => {
        const h = P.getPlayerHeadToHead(0);
        assertEqual(h.length, 3, 'tres rivales');
        const bob = h.find(x => x.name === 'Bob');
        assertEqual(bob.played, 2);
        assertEqual(bob.won, 2);
        assertEqual(bob.setsWon, 4, '2 partidos × 2 sets');
        assertEqual(bob.setsLost, 0);
        const dina = h.find(x => x.name === 'Dina');
        assertEqual(dina.won, 0);
        assertEqual(dina.lost, 1);
    });

    test('getPlayerRecentMatches y getPlayerUpcomingMatches', () => {
        const recent = P.getPlayerRecentMatches(0, 5);
        assertEqual(recent.length, 5, 'últimos 5 completados');
        assertEqual(recent[0].timestamp, '2026-02-01T10:00:00.000Z', 'primero el más reciente');

        const upcoming = P.getPlayerUpcomingMatches(0, 5);
        assertEqual(upcoming.length, 1, 'solo el pendiente');
        assertEqual(upcoming[0].matchNum, 4);
        assertEqual(upcoming[0].fixture.categoria, 'PRIMERA');
    });

    test('scheduleEntryFor: devuelve la programación del partido si existe', () => {
        env.tournamentData.fixtures[0].schedule = [
            { match: 4, player1: 'Ana', player2: 'Bob', mesa: 2, hora: '10:00', slot: 0 }
        ];
        const sch = P.scheduleEntryFor(env.tournamentData.fixtures[0], 4);
        assertEqual(sch.mesa, 2);
        assertEqual(sch.hora, '10:00');
        assertEqual(P.scheduleEntryFor(env.tournamentData.fixtures[0], 99), null, 'sin programación → null');
        assertEqual(P.scheduleEntryFor({}, 1), null, 'sin schedule → null');
    });

    test('buildPlayerEditFormHTML: formulario completo con escape', () => {
        const html = P.buildPlayerEditFormHTML({
            name: 'Ana <Gomez>', club: 'CLUB X', categories: ['PRIMERA', 'CUSTOM'],
            ranking: 2, fechaNac: '2000-01-01', licencia: 'LIC1'
        });
        ['modal-edit-name', 'modal-edit-club', 'modal-edit-ranking', 'modal-edit-birthdate', 'modal-edit-license', 'modal-edit-categories'].forEach(id => {
            assert(html.includes('id="' + id + '"'), 'campo ' + id);
        });
        assert(html.includes('CUSTOM'), 'categoría propia del jugador presente');
        assert(html.includes('PRIMERA'), 'categoría estándar presente');
        assert(!html.includes('Ana <Gomez>'), 'nombre escapado (sin HTML crudo)');
        assert(html.includes('LIC1'), 'licencia precargada');
    });

    test('applyPlayerEditForm: guarda, normaliza y preserva el resto del jugador', () => {
        env.tournamentData.players = [{
            name: 'Ana', club: 'X', categories: ['A'], checkin: true, elo: 1250,
            history: [{ pts: 10 }], avatar: 'data:image/x', members: [{ name: 'M', club: 'Y' }]
        }];
        const inputs = {
            'modal-edit-name': { value: '  Ana Maria ' },
            'modal-edit-club': { value: ' club x ' },
            'modal-edit-ranking': { value: '3' },
            'modal-edit-categories': { selectedOptions: [{ value: 'A' }, { value: 'B' }] },
            'modal-edit-birthdate': { value: '2000-01-01' },
            'modal-edit-license': { value: 'LIC123' }
        };
        const origDoc = env.sandbox.document;
        env.sandbox.document = { ...origDoc, getElementById: (id) => inputs[id] || { value: '' } };
        try {
            assertEqual(P.applyPlayerEditForm(0), true, 'guarda correctamente');
            const p = env.tournamentData.players[0];
            assertEqual(p.name, 'Ana Maria', 'nombre formateado');
            assertEqual(p.club, 'CLUB X', 'club formateado');
            assertEqual(p.categories, ['A', 'B']);
            assertEqual(p.ranking, 3);
            assertEqual(p.fechaNac, '2000-01-01');
            assertEqual(p.licencia, 'LIC123');
            assertEqual(p.checkin, true, 'preserva checkin');
            assertEqual(p.elo, 1250, 'preserva ELO');
            assertEqual(p.avatar, 'data:image/x', 'preserva avatar');
            assertEqual(p.history.length, 1, 'preserva historial');
            assertEqual(p.members.length, 1, 'preserva miembros');
        } finally {
            env.sandbox.document = origDoc;
        }
    });

    test('applyPlayerEditForm: valida y no guarda con campos inválidos', () => {
        env.tournamentData.players = [{ name: 'Ana', club: 'X', categories: ['A'] }];
        const inputs = {
            'modal-edit-name': { value: '' },
            'modal-edit-club': { value: 'X' },
            'modal-edit-categories': { selectedOptions: [{ value: 'A' }] },
            'modal-edit-license': { value: '' }
        };
        const origDoc = env.sandbox.document;
        env.sandbox.document = { ...origDoc, getElementById: (id) => inputs[id] || { value: '' } };
        try {
            assertEqual(P.applyPlayerEditForm(0), false, 'nombre vacío → no guarda');
            assertEqual(env.tournamentData.players[0].name, 'Ana', 'jugador intacto');
        } finally {
            env.sandbox.document = origDoc;
        }
    });

    test('editPlayerFromProfile: carga el formulario en el modal abierto y reconecta botones', () => {
        env.tournamentData.players = [{ name: 'Ana', club: 'X', categories: ['A'] }];
        const content = { innerHTML: '' };
        const title = { textContent: '' };
        const confirmBtn = { style: {}, textContent: '', onclick: null };
        const cancelBtn = { onclick: null };
        const origDoc = env.sandbox.document;
        env.sandbox.document = {
            ...origDoc,
            getElementById: (id) => {
                if (id === 'modal-content') return content;
                if (id === 'modal-title') return title;
                if (id === 'modal-confirm') return confirmBtn;
                if (id === 'modal-cancel') return cancelBtn;
                return { value: '' };
            }
        };
        try {
            P.editPlayerFromProfile(0);
            assert(content.innerHTML.includes('modal-edit-name'), 'formulario dentro del modal de perfil');
            assertEqual(title.textContent, '✏️ Editando: Ana');
            assertEqual(confirmBtn.textContent, '💾 Guardar cambios');
            assertEqual(confirmBtn.style.display, 'inline-flex');
            assertEqual(typeof confirmBtn.onclick, 'function', 'confirmar conectado');
            assertEqual(typeof cancelBtn.onclick, 'function', 'cancelar conectado');
        } finally {
            env.sandbox.document = origDoc;
        }
    });

    test('parseCSVImport: respeta comillas, separadores y saltos', () => {
        const csv = 'Nombre;Club;Categorías\r\n"López, Juan";Club A;"Sub-13, Sub-15"\nMaría;Club B;Sub-19\n';
        const rows = P.parseCSVImport(csv);
        assertEqual(rows.length, 3, 'encabezado + dos filas de datos');
        assertEqual(rows[1][0], 'López, Juan', 'comillas preservan la coma interna');
        assertEqual(rows[1][1], 'Club A');
        assertEqual(rows[1][2], 'Sub-13, Sub-15', 'comillas preservan la coma de categorías');
        assertEqual(rows[2][0], 'María');
    });

    test('applyImportedPlayers: agrega, normaliza y cuenta', () => {
        env.tournamentData.players = [];
        const rows = [
            ['Nombre', 'Club', 'Categorías', 'Ranking', 'Fecha de Nacimiento', 'Licencia'],
            ['  juan pérez  ', '  club verde ', 'Sub-13, Sub-15', '1200', '2012-03-15', 'ABC123'],
            ['ana gomez', 'club azul', 'Sub-19', '', '', '']
        ];
        const res = P.applyImportedPlayers(rows);
        assertEqual(res.rows, 2, 'dos filas procesadas');
        assertEqual(res.added, 2, 'ambas agregadas');
        assertEqual(res.updated, 0);
        assertEqual(res.skipped, 0);
        assertEqual(env.tournamentData.players.length, 2);
        const juan = env.tournamentData.players[0];
        assertEqual(juan.name, 'Juan Perez', 'nombre normalizado (sin tildes)');
        assertEqual(juan.club, 'CLUB VERDE', 'club normalizado');
        assertEqual(juan.categories, ['Sub-13', 'Sub-15'], 'categorías separadas');
        assertEqual(juan.ranking, 1200, 'ranking numérico');
        assertEqual(juan.fechaNac, '2012-03-15');
        assertEqual(juan.licencia, 'ABC123');
        assertEqual(juan.checkin, false);
        assertEqual(juan.elo, 1200);
    });

    test('applyImportedPlayers: duplicados fusionan categorías y cuentan como updated', () => {
        env.tournamentData.players = [];
        P.forceAddNewPlayer('Juan Perez', 'CLUB VERDE', ['Sub-13']);
        const rows = [
            ['Nombre', 'Club', 'Categorías', 'Ranking', 'Fecha de Nacimiento', 'Licencia'],
            ['juan perez', 'club verde', 'Sub-15, Sub-19', '1300', '2012-03-15', 'ABC123']
        ];
        const res = P.applyImportedPlayers(rows);
        assertEqual(res.added, 0, 'no re-agrega');
        assertEqual(res.updated, 1, 'fusiona categorías y campos faltantes');
        assertEqual(env.tournamentData.players.length, 1);
        assertEqual(env.tournamentData.players[0].categories, ['Sub-13', 'Sub-15', 'Sub-19'], 'categorías fusionadas sin repetir');
        assertEqual(env.tournamentData.players[0].fechaNac, '2012-03-15', 'campo faltante completado');
        assertEqual(env.tournamentData.players[0].licencia, 'ABC123');
    });

    test('applyImportedPlayers: salta filas sin nombre o club y encabezados', () => {
        env.tournamentData.players = [];
        const rows = [
            ['Nombre', 'Club', 'Categorías'],
            ['Solo Nombre', '', 'Sub-13'],
            ['', 'Club X', 'Sub-13'],
            ['   ', '   ', ''],
            ['Válido', 'Club Y', 'Sub-19']
        ];
        const res = P.applyImportedPlayers(rows);
        assertEqual(res.rows, 3, 'filas no vacías: 3 (el encabezado se omite)');
        assertEqual(res.added, 1, 'solo la fila válida');
        assertEqual(res.skipped, 2, 'dos sin nombre o club');
        assertEqual(env.tournamentData.players.length, 1);
        assertEqual(env.tournamentData.players[0].name, 'Valido');
    });

    test('applyImportedPlayers: sin encabezados asume el orden posicional', () => {
        env.tournamentData.players = [];
        const rows = [
            ['Pedro', 'Club W', 'Libres'],
            ['Luis', 'Club Z']
        ];
        const res = P.applyImportedPlayers(rows);
        assertEqual(res.rows, 2, 'ambas filas procesadas');
        assertEqual(res.added, 2);
        assertEqual(env.tournamentData.players[0].name, 'Pedro');
        assertEqual(env.tournamentData.players[0].club, 'CLUB W');
        assertEqual(env.tournamentData.players[0].categories, ['Libres']);
        assertEqual(env.tournamentData.players[1].categories, [], 'sin categoría → vacío');
    });
});
