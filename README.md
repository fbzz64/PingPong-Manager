# PingPong Manager

**Gestión completa de torneos de ping pong** — una PWA offline que corre 100% en el navegador, sin servidor.

v2.28 · 313 tests · ES / EN / PT

---

## Qué hace

Todo lo que necesitás para organizar un torneo de ping pong de principio a fin:

| Fase | Qué incluye |
|------|-------------|
| **Preparación** | Configuración del torneo (nombre, reglamento ITTF, formato BO3/BO5/BO7), alta de jugadores individual/pareja/equipo, check-in con QR, categorías personalizables con cupo máximo |
| **Competencia** | Fixture todos contra todos, suizo o por rondas, programación Multiplex (mesas y horarios), Scoreboard en vivo, Mesas en vivo, Cartelera TV, cronómetro de partido, incidencias, árbitros |
| **Análisis** | Estadísticas ITTF, gráficos (barras, líneas), ranking ELO, enfrentamientos directos (H2H), rachas, leaderboard por categoría |
| **Cierre** | Llaves eliminatorias automáticas, podios, certificados (PDF + participate), reporte final, difusión para redes sociales (WhatsApp, Instagram) |

---

## Características principales

- **100% offline** — funciona sin internet después de la primera carga. La PWA se instala en el celular o PC como una app nativa.
- **Multi-idioma** — Español, English e Português con un solo clic. El idioma se detecta automáticamente del navegador.
- **Tema claro/oscuro/auto** — se adapta al tema del sistema operativo en tiempo real.
- **Deshacer/Rehacer** — historial completo de ediciones con Ctrl+Z / Ctrl+Y.
- **Auto-guardado** — cada 10 segundos, más checkpoint de recuperación al cerrar la pestaña.
- **Backups automáticos** — copia completa cada 5 minutos (rotativo, 6 versiones).
- **Sincronización multi-dispositivo** — compartí el torneo en tiempo real vía Firebase RTDB (host edita, viewers solo ven).
- **313 tests automatizados** — cobertura de lógica pura, i18n, consistencia HTML/JS y flujo end-to-end.

---

## Módulos del sistema

| Archivo | Función |
|---------|---------|
| `js/storage.js` | Persistencia localStorage, normalización, deshacer/rehacer, backups, sync hook |
| `js/main.js` | Inicialización, auto-guardado, PWA install |
| `js/navigation.js` | Pestañas, atajos de teclado, menú desplegable |
| `js/ui.js` | Modal, toast, tema oscuro tri-state |
| `js/i18n.js` | Diccionarios ES/EN/PT, traducción en vivo |
| `js/players.js` | Alta, edición, check-in, QR, perfiles, duplicados, import CSV/Excel |
| `js/fixtures.js` | Todos contra todos, suizo, head-to-head, ITTF |
| `js/brackets.js` | Llaves eliminatorias automáticas con byes |
| `js/scoreboard.js` | Scoreboard en vivo para proyección |
| `js/tables.js` | Mesas en vivo por grupo |
| `js/tvboard.js` | Cartelera TV full-screen, refresh 3s |
| `js/planning.js` | Multiplex: programación de mesas, horarios y árbitros |
| `js/stats.js` | Estadísticas ITTF, dashboard, ranking |
| `js/elo.js` | Rating ELO con delta por partido, reversión y sync |
| `js/charts.js` | Gráficos SVG (barras, líneas, evolución) |
| `js/tournaments.js` | Torneos múltiples, ranking histórico |
| `js/certificates.js` | Certificados PDF (podio + participación + blanco) |
| `js/reglamento.js` | Reglamento ITTF: sets, deuce, W.O., clasificación |
| `js/sounds.js` | Notificaciones sonoras, wake lock |
| `js/logs.js` | Bitácora de acciones con timestamp |
| `js/share.js` | Copiar, compartir (Web Share API), WhatsApp |
| `js/sponsors.js` | Patrocinadores (hasta 5, con logo) |
| `js/qr.js` | Códigos QR de acreditación por jugador |
| `js/sync.js` | Sincronización multi-dispositivo (Firebase RTDB) |
| `js/changelog.js` | Versión y bitácora de cambios |
| `js/ranking.js` | Ranking histórico y podios calculados |

---

## Estructura

```
PingPong-Manager/
├── index.html          ← punto de entrada (PWA)
├── css/styles.css      ← estilos (light + dark)
├── js/                 ← 22 módulos JS
├── lib/                ← jsPDF, SheetJS, QR (offline)
├── icons/              ← iconos PWA (SVG + PNG)
├── tests/              ← 313 tests (node run-tests.js)
├── sw.js               ← Service Worker (cache offline)
├── manifest.json       ← PWA manifest
└── package.json        ← metadata
```

---

## Cómo usar

1. Abrí `index.html` en un navegador (o instalá la PWA).
2. Configurá el torneo (nombre, reglamento, formato).
3. Cargá jugadores (manual, CSV o Excel).
4. Hacé check-in el día del evento.
5. Generá fixtures y programá con Multiplex.
6. Cargá resultados → estadísticas y rankings se calculan solos.
7. Generá llaves, podios y certificados.
8. Difundí en redes sociales.

---

## Tests

```bash
node run-tests.js
```

Suite completa: reglamento, storage, brackets, fixtures, elo, stats, planning, players, tournaments, dashboard, charts, navigation, ui, main, sounds, qr, tvboard, sync, i18n, consistency, e2e.

---

## Stack

- **HTML/CSS/JS** puro (sin frameworks, sin build tools)
- **localStorage** como base de datos local
- **Service Worker** para offline completo
- **Firebase RTDB** (opcional) para sync multi-dispositivo
- **jsPDF + SheetJS** para PDF y Excel offline
- **QRCode.js** para códigos de acreditación

---

## Licencia

MIT
