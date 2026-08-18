// ==========================================
// TESTS/CERTIFICATES.TEST.JS - Certificados (js/certificates.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('CERTIFICADOS (certificates.js)', () => {
    const env = loadApp(['js/certificates.js']);
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
        env.tournamentData.fixtures = [];
        env.tournamentData.players = [];
        env.tournamentData.settings.torneoNombre = 'Torneo Test';
        env.tournamentData.settings.subtitulo = 'Subtítulo';
    }

    // Ventana de impresión fake: captura el documento escrito.
    function stubPrintWindow() {
        let written = null;
        S.open = () => ({ document: { write: (s) => { written = s; }, close: () => {} } });
        return () => written;
    }

    test('generateCertificatesModal: sin datos → toast warning', () => {
        reset();
        let toast = null, modal = null;
        S.showToast = (m, t) => { toast = { m, t }; };
        S.showModal = () => { modal = true; };
        S.generateCertificatesModal();
        assertEqual(toast.m, 'No hay datos suficientes para generar certificados');
        assertEqual(toast.t, 'warning');
        assertEqual(modal, null, 'no abre modal');
    });

    test('generateCertificatesModal: categorías desde podios ordenadas con ganadores', () => {
        reset();
        env.tournamentData.players = [{ name: 'Ana', categories: ['C1'] }];
        S.calculatePodiums = () => ({
            C2: [{ name: 'Beto', points: 5 }],
            C1: [{ name: 'Ana', points: 7 }, { name: 'Beto', points: 3 }]
        });
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        S.generateCertificatesModal();
        assert(modal, 'abre modal');
        assertEqual(modal.t, '🎓 Generar Certificados');
        assert(modal.b.includes('value="all"'), 'opción todas');
        const iC1 = modal.b.indexOf('>C1 (2 ganadores)<');
        const iC2 = modal.b.indexOf('>C2 (1 ganadores)<');
        assert(iC1 > 0 && iC2 > 0 && iC1 < iC2, 'opciones ordenadas con conteo de ganadores');
        assert(modal.b.includes('cert-type'), 'selector de tipo');
        assert(modal.b.includes('cert-blank-section'), 'sección plantilla en blanco');
        assert(modal.b.includes('shareCertificatesSummary'), 'botón compartir');
    });

    test('generateCertificatesModal: sin podios usa categorías de inscritos', () => {
        reset();
        env.tournamentData.players = [{ name: 'Ana', categories: ['SUB 11', 'PRIMERA'] }];
        S.calculatePodiums = () => ({});
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        S.generateCertificatesModal();
        assert(modal.b.includes('>PRIMERA (0 ganadores)<'), 'PRIMERA');
        assert(modal.b.includes('>SUB 11 (0 ganadores)<'), 'SUB 11');
        const iP = modal.b.indexOf('PRIMERA');
        const iS = modal.b.indexOf('SUB 11');
        assert(iP > 0 && iS > 0 && iP < iS, 'orden alfabético');
    });

    test('generateCertificatesModal: sin categorías → toast warning', () => {
        reset();
        env.tournamentData.players = [{ name: 'Ana', categories: [] }];
        S.calculatePodiums = () => ({});
        let toast = null, modal = null;
        S.showToast = (m, t) => { toast = { m, t }; };
        S.showModal = () => { modal = true; };
        S.generateCertificatesModal();
        assertEqual(toast.m, 'No hay jugadores inscritos para generar certificados');
        assertEqual(modal, null);
    });

    test('generateCertificatesModal: el confirmar lee el formulario y genera', () => {
        reset();
        const get = capture();
        env.tournamentData.players = [{ name: 'Ana', club: 'X', categories: ['C1'] }];
        S.calculatePodiums = () => ({});
        let modal = null;
        S.showModal = (t, b, cb) => { modal = { t, b, cb }; };
        let gen = null;
        const original = S.generateCertificates;
        S.generateCertificates = (a, b, c, d) => { gen = { a, b, c, d }; };
        try {
            S.generateCertificatesModal();
            get('cert-category').value = 'C1';
            get('cert-type').value = 'blank';
            get('cert-position').value = '1';
            get('cert-player-name').value = '  Juan  ';
            modal.cb();
            assert(gen, 'llama generateCertificates');
            assertEqual(gen.a, 'C1', 'categoría seleccionada');
            assertEqual(gen.c, 'blank', 'tipo');
            assertEqual(gen.d.position, '1', 'posición');
            assertEqual(gen.d.playerName, 'Juan', 'nombre recortado');
        } finally {
            S.generateCertificates = original;
        }
    });

    test('toggleBlankCertControls: muestra/oculta la sección en blanco', () => {
        reset();
        const get = capture();
        get('cert-type').value = 'blank';
        S.toggleBlankCertControls();
        assertEqual(get('cert-blank-section').style.display, 'block');
        get('cert-type').value = 'both';
        S.toggleBlankCertControls();
        assertEqual(get('cert-blank-section').style.display, 'none');
    });

    test('generateCertificates: podios genera uno por top3', () => {
        reset();
        const getWritten = stubPrintWindow();
        let toast = null, log = null;
        S.showToast = (m) => { toast = m; };
        S.addLog = (a, d) => { log = { a, d }; };
        const podiums = {
            C1: [
                { name: 'Ana', club: 'X', points: 7, groups: ['G1'] },
                { name: 'Beto', club: 'Y', points: 3, groups: ['G1'] },
                { name: 'Carla', club: 'Z', points: 2, groups: ['G1'] },
                { name: 'Dani', club: 'W', points: 1, groups: ['G1'] }
            ]
        };
        S.generateCertificates('all', podiums, 'podium', {});
        const written = getWritten();
        assertEqual((written.match(/class="certificate-page"/g) || []).length, 3, 'top3, no 4°');
        assert(written.includes('PRIMER LUGAR'), '1° lugar');
        assert(written.includes('SEGUNDO LUGAR'), '2° lugar');
        assert(written.includes('TERCER LUGAR'), '3° lugar');
        assert(!written.includes('Dani'), '4° fuera del podio');
        assert(written.includes('Puntos obtenidos'), 'stats en podio');
        assert(written.includes('Torneo Test'), 'nombre del torneo');
        assertEqual(log.d, '3 certificados generados y enviados a impresora', 'log');
        assert(toast.includes('3 certificados'), 'toast');
    });

    test('generateCertificates: participación para todos los inscritos válidos', () => {
        reset();
        const getWritten = stubPrintWindow();
        S.showToast = () => {};
        S.addLog = () => {};
        env.tournamentData.players = [
            { name: 'Ana', club: 'X', categories: ['C1', 'C2'] },
            { name: 'Beto', club: 'Y', categories: ['C1'] },
            { name: '-', club: '-', categories: ['C1'] }
        ];
        S.generateCertificates('C1', {}, 'participation', {});
        const written = getWritten();
        assertEqual((written.match(/class="certificate-page"/g) || []).length, 2, '2 inscritos válidos');
        assert(written.includes('CERTIFICADO DE PARTICIPACIÓN'), 'título participación');
        assert(!written.includes('Puntos obtenidos'), 'sin stats');
    });

    test('generateCertificates: both genera podios + participación', () => {
        reset();
        const getWritten = stubPrintWindow();
        S.showToast = () => {};
        S.addLog = () => {};
        env.tournamentData.players = [
            { name: 'Ana', club: 'X', categories: ['C1'] },
            { name: 'Beto', club: 'Y', categories: ['C1'] }
        ];
        const podiums = { C1: [{ name: 'Ana', club: 'X', points: 5, groups: ['G1'] }] };
        S.generateCertificates('C1', podiums, 'both', {});
        const written = getWritten();
        assertEqual((written.match(/class="certificate-page"/g) || []).length, 3, '1 podio + 2 participación');
        assert(written.includes('CERTIFICADO DE RECONOCIMIENTO'), 'podio');
        assert(written.includes('CERTIFICADO DE PARTICIPACIÓN'), 'participación');
    });

    test('generateCertificates: blank genera uno por categoría con puesto y nombre', () => {
        reset();
        const getWritten = stubPrintWindow();
        S.showToast = () => {};
        S.addLog = () => {};
        S.generateCertificates('all', { C1: [], C2: [] }, 'blank', { position: '2', playerName: 'Carlos' });
        const written = getWritten();
        assertEqual((written.match(/class="certificate-page"/g) || []).length, 2, 'uno por categoría');
        assert(written.includes('SEGUNDO LUGAR'), 'puesto elegido');
        assert(written.includes('Carlos'), 'nombre escrito');
        assert(written.includes('C2'), 'segunda categoría');
    });

    test('generateCertificates: sin certificados → toast warning', () => {
        reset();
        let toast = null;
        S.showToast = (m, t) => { toast = { m, t }; };
        S.generateCertificates('C1', {}, 'podium', {});
        assertEqual(toast.m, 'No hay certificados para generar con la selección actual');
        assertEqual(toast.t, 'warning');
    });

    test('blankPositionConfig: mapea cada puesto', () => {
        assertEqual(S.blankPositionConfig('1').medalla, '🥇');
        assertEqual(S.blankPositionConfig('2').textoLugar, 'SEGUNDO LUGAR');
        assertEqual(S.blankPositionConfig('3').medalla, '🥉');
        assertEqual(S.blankPositionConfig('4').color, '#9B59B6');
        assertEqual(S.blankPositionConfig('4').textoLugar, 'CUARTO LUGAR');
        assertEqual(S.blankPositionConfig('participation').titulo, 'CERTIFICADO DE PARTICIPACIÓN');
        assertEqual(S.blankPositionConfig(undefined).medalla, '🥇', 'default 1°');
        assertEqual(S.blankPositionConfig('99').textoLugar, 'PRIMER LUGAR', 'default desconocido');
    });

    test('buildCertificateHTML: estructura, escape y condicionales', () => {
        const html = S.buildCertificateHTML(
            { name: '<Ana>', club: 'X', points: 7, groups: ['G1', 'G2'] },
            'C1',
            {
                medalla: '🥇', colorBorde: '#FFD700', titulo: 'CERTIFICADO DE RECONOCIMIENTO',
                textoLugar: 'PRIMER LUGAR', cuerpoFrase: 'Por haber obtenido el <strong>PRIMER LUGAR</strong>',
                mostrarStats: true, mostrarClub: true, fechaActual: '12 de agosto de 2026',
                torneoNombre: 'T', subtitulo: 'S'
            }
        );
        assert(html.includes('class="certificate-page"'), 'página');
        assert(html.includes('border-color: #FFD700'), 'borde');
        assert(html.includes('🥇'), 'medalla');
        assert(html.includes('&lt;Ana&gt;'), 'nombre escapado');
        assert(html.includes('>7<'), 'puntos');
        assert(html.includes('G1, G2'), 'grupos');
        assert(html.includes('12 de agosto de 2026'), 'fecha');
        assert(html.includes('>X<'), 'club');

        const sinStats = S.buildCertificateHTML(
            { name: 'Ana', club: 'Y' }, 'C1',
            { medalla: '📜', colorBorde: '#28a745', titulo: 'P', textoLugar: 'PARTICIPACIÓN',
                cuerpoFrase: 'f', mostrarStats: false, mostrarClub: false, fechaActual: 'f',
                torneoNombre: 'T', subtitulo: '' }
        );
        assert(!sinStats.includes('Puntos obtenidos'), 'sin stats');
        assert(!sinStats.includes('footer-club'), 'sin club');
    });

    test('shareCertificatesSummary: arma resumen y lo comparte', () => {
        reset();
        let shared = null, title = null, log = null;
        S.calculatePodiums = () => ({
            C1: [{ name: 'Ana', club: 'X', points: 7 }, { name: 'Beto', club: 'Y', points: 3 }]
        });
        S.shareText = (t, ti) => { shared = t; title = ti; };
        S.addLog = (a, d) => { log = { a, d }; };
        S.shareCertificatesSummary();
        assert(shared.includes('TORNEO TEST'), 'nombre en mayúsculas');
        assert(shared.includes('C1'), 'categoría');
        assert(shared.includes('🥇 1° Ana — X'), 'podio 1°');
        assert(shared.includes('🥈 2° Beto — Y'), 'podio 2°');
        assert(shared.includes('Generado con SGTM'), 'firma');
        assertEqual(title, 'Resultados — Torneo Test', 'título');
        assertEqual(log.a, 'CERTIFICADOS', 'log');
    });

    test('shareCertificatesSummary: sin podios anuncia participación', () => {
        reset();
        let shared = null;
        S.calculatePodiums = () => ({});
        S.shareText = (t) => { shared = t; };
        S.addLog = () => {};
        env.tournamentData.players = [
            { name: 'Ana', club: 'X' },
            { name: 'Beto', club: 'Y' },
            { name: '-', club: '-' }
        ];
        S.shareCertificatesSummary();
        assert(shared.includes('certificados de participación a 2 jugadores'), 'cuenta inscritos válidos');
    });
});
