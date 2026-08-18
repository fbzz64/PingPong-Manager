# Tests — Sistema de Gestión de Torneos de Tenis de Mesa

Suite de regresión para el SGTM, **sin dependencias externas**: solo Node.js (>= 12, sin npm install). El `package.json` expone `npm test` → `node run-tests.js`.

Además hay un **smoke test en navegador real** (`tests/smoke/smoke-edge.js`) que es la única excepción a "sin dependencias": usa `playwright-core` + el Edge instalado del sistema. Ver sección [Smoke test en Edge](#smoke-test-en-edge) más abajo.

## Ejecutar

```bash
node run-tests.js   # o: npm test
```

Salida: un bloque por suite, `OK`/`FALLO` por test y un total al final. `process.exitCode = 1` si algo falla (útil para CI). Estado actual: **237/237 verdes**.

## Arquitectura

```
tests/
  runner.js            framework mínimo: suite()/test()/assert()/assertEqual()/assertClose()
  env.js               sandbox vm con window/document/localStorage falsos; loadApp()
  *.test.js            una suite por módulo de js/
run-tests.js           registra las suites y llama runner.run()
```

### runner.js

- `suite(nombre, fn)` / `test(nombre, fn)`: declaran casos.
- `assert(cond, msg)`, `assertEqual(actual, esperado, msg)` (comparación estricta vía `JSON.stringify`), `assertClose(actual, esperado, eps, msg)`.
- `run()` es **async**: los `test()` pueden declararse `async function` y usar `await` (útil para Promesas, p. ej. `copyText` en share.js).
- `suite()`/`test()` **difieren la ejecución**: los callbacks corren después de registrar todas las suites. Por eso un `vm.runInContext(...)` a nivel de suite (fuera de un `test()`) se ejecuta ANTES que cualquier test — para reasignar una función lexical por el contador, hacelo dentro del primer test que lo necesite (ver `useBtnCounter()` en main.test.js).

### env.js

- `loadApp([módulos])` carga `js/reglamento.js` + `js/storage.js` + `js/brackets.js` siempre, y los módulos extra en orden, dentro de un contexto `vm` aislado.
- `env.sandbox` expone los globals del contexto (`S.showModal`, `S.generateCertificates`, etc.); `window === sandbox`, así que `window.X = ...` y el global desnudo son la misma cosa.
- `env.tournamentData` es el MISMO objeto que la global `tournamentData` (como en el navegador).
- Stubs incluidos: `document` (getElementById/querySelector/createElement + head/body), `localStorage`, `navigator`, `Blob`, `File`, `FileReader`, `URL`, `setTimeout`, y funciones de UI (`showToast`, `showModal`, `addLog`, `escHtml`, `escAttr`, etc.).
- `createEnv(extra)` permite un entorno sin `loadApp` (para tests de reglamento/storage que no necesitan stubs).

## Suites

| Archivo | Módulo(s) cubierto(s) | Tests |
|---|---|---|
| `reglamento.test.js` | `js/reglamento.js` (ITTF rules) | 17 |
| `storage.test.js` | `js/storage.js` (normalización, deshacer/rehacer) | 9 |
| `brackets.test.js` | `js/brackets.js` (llaves) | 7 |
| `fixtures.test.js` | `js/fixtures.js` (grupos, suizo, desempates) | 13 |
| `elo.test.js` | `js/elo.js` | 13 |
| `stats.test.js` | `js/stats.js` (cálculos) | 12 |
| `planning.test.js` | `js/planning.js` (multiplex, categorías, templates) | 13 |
| `players.test.js` | `js/players.js` (normalización, duplicados, alta) | 21 |
| `tournaments.test.js` | `js/tournaments.js` + `js/ranking.js` | 9 |
| `dashboard.test.js` | `js/stats.js` (renderers del dashboard) | 9 |
| `changelog.test.js` | `js/changelog.js` (bitácora + guía) | 8 |
| `share.test.js` | `js/share.js` (Web Share / portapapeles) | 8 |
| `sponsors.test.js` | `js/sponsors.js` | 10 |
| `certificates.test.js` | `js/certificates.js` | 15 |
| `logs.test.js` | `js/logs.js` (bitácora, exportación, limpieza) | 8 |
| `charts.test.js` | `js/charts.js` (gráficos SVG) | 14 |
| `navigation.test.js` | `js/navigation.js` (menús, pestañas, atajos de teclado) | 17 |
| `ui.test.js` | `js/ui.js` (toast, modales, tema, panel de atajos) | 9 |
| `main.test.js` | `js/main.js` (inicialización, PWA, auto-guardado) | 12 |
| `consistency.test.js` | `index.html` ↔ JS (pestañas, ids, onclick) | 5 |
| `version.test.js` | Coherencia de versión (package.json ↔ changelog ↔ header) y PWA (`sw.js`: cache bump, app shell completo) | 7 |
| `e2e.test.js` | `js/*` en orden real (flujo completo: jugadores→fixture→stats→llaves→podios→export + formato configurado) | 8 |

## Convenciones y patrones

**Estado compartido:** cada suite carga su entorno una sola vez (`const env = loadApp([...])`) y modifica `env.tournamentData` dentro de cada test. Definí un `reset()` por suite para aislar tests.

**Captura del DOM:** sobrescribí `document.getElementById` con un map por id. `capture()` devuelve un getter `get(id)` — usalo para fijar `.value`/`.files` (el elemento solo existe tras el primer `getElementById(id)`, no antes):

```js
function capture() {
    env.sandbox.document.getElementById = (id) => {
        if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '', style: {}, files: [] };
        return els[id];
    };
    return (id) => env.sandbox.document.getElementById(id);
}

const get = capture();
get('pat-nombre').value = 'Nike';
S.loadPatrocinadoresList();
assert(get('patrocinadores-list').innerHTML.includes('Nike'));
```

**assertEqual es estricto:** los `textContent` numéricos hay que envolverlos con `String(...)` (ej. `assertEqual(String(els['stat-groups'].textContent), '1')`).

**Date del realm:** el `Date` del sandbox NO está en `env.sandbox.Date`; usá `vm.runInContext('Date', env.ctx)`. Para congelar "hora actual" dentro del contexto, sobreescribí `env.sandbox.Date` con una subclase de fecha fija (ver `withDate` en `players.test.js`). Las `const` de nivel de módulo (`CHANGELOG` en changelog.js) tampoco son propiedades de window: también van por `vm.runInContext`.

**Stubs de globals:** reasigná `env.sandbox.showToast` / `showModal` / `shareText` / etc. por test. Si el stub es necesario solo para un test, **restauralo** (guarda el original y volvé a asignarlo en un `finally`) para no contaminar los tests siguientes — ej. `S.generateCertificates` en certificates.test.js.

**Promesas:** los tests que esperan resultados de Promesas se declaran `async`. Si la función probada es síncrona pero dispara un `.then()` (p. ej. `shareText` → `copyText` → `showToast`), drená las microtasks con un `flushPromises()` antes de las aserciones (ver share.test.js).

**Escritura de ventana de impresión / descarga:** para `window.open`, stub `S.open` para capturar `document.write(...)`; para `window.print`/descarga de `shareFileBlob`, stub `document.createElement('a')` con `click()` y verificá el `href`/`download`.

## Smoke test en Edge

```bash
npm install        # instala playwright-core (dependencia dev opcional)
npm run test:smoke # o: node tests/smoke/smoke-edge.js
```

Levanta un servidor estático temporal sobre la raíz del proyecto y recorre el flujo real en un Edge headless: jugadores → check-in → listas por categoría → duplicados → exports de jugadores → fixture → programación Multiplex (+difusión) → resultados → estadísticas → H2H → ranking (+CSV) → llaves → podios/difusión WhatsApp (wa.me) → plantillas de difusión → hub de redes → imagen de podios → certificados → exportaciones (Excel/PDF/JSON/Backup/reporte final) → persistencia tras recarga → configuración (patrocinadores, plantillas, tema, nuevo torneo) → changelog → logs → undo/redo → **PWA offline** (SW activo, app shell cacheado, recarga sin red con datos intactos). Falla (`exit code 1`) ante cualquier error de consola, `pageerror`, request fallido o respuesta HTTP ≥ 400.

- Detección automática del ejecutable de Edge (`Edge/Application` o `EdgeCore/*`); si no aparece, editá `EDGE_CANDIDATES` en `tests/smoke/smoke-edge.js`.
- Algunas acciones se ejercitan sin confirmar modales destructivos (p. ej. `startNewTournament` solo verifica que el modal abra y lo cierra) para no alterar el estado del flujo.
- **Primera corrida tras un bump de cache del service worker**: el navegador sirve los archivos viejos cacheados (verás la versión anterior). Es normal; una segunda corrida (o ventana privada) ya usa la nueva.
- Complementa a la suite de node: detecta errores de navegador real (consola, red, PWA) que el sandbox de `env.js` no reproduce — p. ej. el bug de categorías vacías y el 404 del favicon.

## Bugs reales detectados por la suite

- `js/tournaments.js` (~503): `calculateTournamentRecords` sumaba sets como strings (fix con `parseInt`).
- `js/stats.js` (~1076): `renderDashboardNextMatches` tenía muerto el mensaje "todos completados" porque `hasSchedule` ignoraba partidos completados.
- `js/ui.js` / `js/tournaments.js`: `const style` duplicado a nivel de módulo — en el navegador el segundo script tira `SyntaxError` y mata TODO `tournaments.js` (podios, records, reset, restauración). Detectado por el E2E al cargar los módulos en el orden real; fix: renombrar a `shakeStyle` en `tournaments.js`.
- `js/reglamento.js`: `groupFormat()`/`bracketFormat()` leían `window.tournamentData`, pero `tournamentData` es `let` en `main.js` (no crea propiedad en `window`) → siempre `bo5`. Fix: leer el global desnudo con guarda `typeof`. Con test de regresión en el E2E (configura `bo3` y verifica que reglas y fixture lo respetan).
- `js/planning.js`: `getCustomCategories()` devolvía `[]` si no había categorías guardadas en `localStorage` (primer uso en navegador limpio). Eso dejaba los `<select>` de categorías (fixture y jugadores) **vacíos** y la app se rompía. Detección: smoke test real en Edge (no la suite de node, que asumía `[]` como esperado — el test fue corregido). Fix: sembrar las `DEFAULT_CATEGORIES` y persistirlas ante `null` o JSON corrupto. Test de regresión actualizado en `planning.test.js`.
- `index.html`: faltaba `<link rel="icon">` → 404 de `/favicon.ico` en la consola. Fix: apuntar a `icons/icon-192.png`.

## Agregar una suite nueva

1. Creá `tests/<modulo>.test.js` con `require('./runner')` y `require('./env')`.
2. Cargá solo los módulos que necesita la función: `loadApp(['js/<modulo>.js'])`.
3. Registrala en `run-tests.js` (el orden de los `require` define el orden de ejecución).
4. Corré `node run-tests.js` hasta 0 fallos.
