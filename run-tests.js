// ==========================================
// RUN-TESTS.JS - Ejecuta la suite de tests de regresión
// Uso: node run-tests.js  (o: npm test)
// ==========================================

const { run } = require('./tests/runner');

require('./tests/reglamento.test.js');
require('./tests/storage.test.js');
require('./tests/brackets.test.js');
require('./tests/fixtures.test.js');
require('./tests/elo.test.js');
require('./tests/stats.test.js');
require('./tests/planning.test.js');
require('./tests/players.test.js');
require('./tests/tournaments.test.js');
require('./tests/dashboard.test.js');
require('./tests/changelog.test.js');
require('./tests/share.test.js');
require('./tests/sponsors.test.js');
require('./tests/certificates.test.js');
require('./tests/logs.test.js');
require('./tests/charts.test.js');
require('./tests/navigation.test.js');
require('./tests/ui.test.js');
require('./tests/main.test.js');
require('./tests/sounds.test.js');
require('./tests/qr.test.js');
require('./tests/tvboard.test.js');
require('./tests/sync.test.js');
require('./tests/security.test.js');
require('./tests/flow-test.test.js');
require('./tests/consistency.test.js');
require('./tests/version.test.js');
require('./tests/i18n.test.js');
require('./tests/e2e.test.js');

run();
