<div align="center">

# 🏓 PingPong Manager

### Gestión integral de torneos de ping pong

**PWA offline · 100% en el navegador · Backend Firebase opcional**

[![Version](https://img.shields.io/badge/version-2.31-blue.svg)](https://github.com/fbzz64/PingPong-Manager)
[![Tests](https://img.shields.io/badge/tests-319%20✅-brightgreen.svg)](#tests)
[![License](https://img.shields.io/badge/license-MIT-gray.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-purple.svg)](manifest.json)
[![Offline](https://img.shields.io/badge/offline-100%25-orange.svg)](#stack)
[![I18N](https://img.shields.io/badge/i18n-ES%20|%20EN%20|%20PT-blue.svg)](#idiomas)
[![Docker](https://img.shields.io/badge/node-%3E%3D14-green.svg)](package.json)

![Dark Mode](https://img.shields.io/badge/theme-light%20|%20dark%20|%20auto-gray.svg)
![Firebase](https://img.shields.io/badge/sync-Firebase%20RTDB-ffca28.svg)
![ITTF](https://img.shields.io/badge/reglamento-ITTF-red.svg)

<br>

*Todo lo que necesitás para organizar un torneo de ping pong, desde la inscripción hasta los certificados.*

<br>

</div>

---

## 📖 Tabla de contenidos

- [Qué es](#-qué-es)
- [Características principales](#-características-principales)
- [Flujo del torneo](#-flujo-del-torneo)
- [Módulos del sistema](#-módulos-del-sistema)
- [Funcionalidades detalladas](#-funcionalidades-detalladas)
- [Idiomas](#idiomas)
- [Tema claro y oscuro](#-tema-claro-y-oscuro)
- [Sincronización multi-dispositivo](#-sincronización-multi-dispositivo)
- [Tests](#tests)
- [Stack tecnológico](#-stack-tecnológico)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Cómo empezar](#-cómo-empezar)
- [Atajos de teclado](#-atajos-de-teclado)
- [Compatibilidad](#-compatibilidad)
- [Roadmap](#-roadmap)
- [Licencia](#-licencia)

---

## 🎯 Qué es

**PingPong Manager** es una Progressive Web App (PWA) diseñada para administrar torneos de ping pong de principio a fin. Corre 100% en el navegador, sin necesidad de servidor, y funciona sin conexión a internet después de la primera carga.

¿Un torneo en un club del barrio? ¿Un campeonato regional? ¿Una liga interclubs? PingPong Manager lo resuelve todo: desde la inscripción de los jugadores hasta la generación de certificados y la difusión de resultados en redes sociales.

**Ideal para:**
- 🏢 Clubes de ping pong
- 🏫 Torneos escolares o universitarios
- 🏆 Campeonatos regionales y nacionales
- 🎉 Eventos sociales y reuniones de clubes
- 📺 Proyección en vivo de resultados (TV / proyector)

---

## ✨ Características principales

<table>
<tr>
<td width="50%">

**🔧 Core**
- 📱 PWA instalable (celular, tablet, PC)
- 💾 Auto-guardado cada 10 segundos
- ↩️ Deshacer / Rehacer completo
- 🔒 Datos 100% locales (localStorage)
- 🔄 Checkpoint de recuperación de sesión
- 📦 Backups automáticos (cada 5 min, 6 versiones)

</td>
<td width="50%">

**🌐 Experiencia**
- 🇦🇷 ES · 🇺🇸 EN · 🇧🇷 PT (detección automática)
- ☀️🌙 Tema claro / oscuro / automático
- ⌨️ Atajos de teclado (Ctrl+Z, F1-F12)
- 🔊 Notificaciones sonoras
- 📺 Cartelera TV y Scoreboard en vivo
- 🌐 Sincronización multi-dispositivo

</td>
</tr>
<tr>
<td>

**🏓 Reglamento**
- 📏 Reglamento ITTF completo
- 🎯 Deuce ilimitado
- 🏅 Formato BO3 / BO5 / BO7 configurable
- 🔄 Desempates ITTF (regla 3.7.5)
- ❌ Walk Over (W.O.) con protección ELO

</td>
<td>

**📊 Análisis**
- 📈 Gráficos SVG (barras, líneas, evolución)
- 🏆 Ranking ELO con reversión
- 🤝 Enfrentamientos directos (H2H)
- 🔥 Rachas de victorias
- 📋 Estadísticas por categoría

</td>
</tr>
<tr>
<td>

**📤 Difusión**
- 📄 PDF oficiales (planillas, certificados, reporte)
- 📊 Excel (.xlsx) exportación/importación
- 📱 Web Share API (compartir desde celular)
- 💬 WhatsApp directo (wa.me)
- 🖼️ Imagen de podios (PNG 1080×1080)
- 📝 Plantillas de difusión prearmadas

</td>
<td>

**🔒 Protección**
- 💾 Auto-guardado + checkpoint
- 🗂️ Backups automáticos rotativos
- 📥 Exportación/Importación JSON
- 🔄 Restore desde cualquier backup
- 🌐 Sync multi-dispositivo (Firebase)

</td>
</tr>
</table>

---

## 🔄 Flujo del torneo

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  🏗️ PREPARAR │───▶│ 📋 INSCRIBIR │───▶│ ⚔️ COMPETIR  │───▶│ 📈 ANALIZAR  │───▶│ 🎖️ CERRAR    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

 • Configuración      • Alta jugadores    • Fixture groups     • Estadísticas      • Llaves
 • Reglamento ITTF    • Check-in QR       • Multiplex          • Gráficos          • Podios
 • Formato BO3/5/7    • Categorías        • Scoreboard vivo    • Ranking ELO       • Certificados
 • Patrocinadores     • Import CSV/Excel  • Mesas en vivo      • H2H               • Reporte
 • Espera             • Duplicados        • Cartelera TV       • Rachas            • Difusión
                      • Perfiles          • Cronómetro         • Leaderboard       • Redes
                                          • Incidencias
                                          • Árbitros
```

---

## 🧩 Módulos del sistema

### 📁 Core

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Persistencia** | `js/storage.js` | Normalización de datos, serialización, deshacer/rehacer, backups automáticos, checkpoint de recuperación, hook de sync |
| **Inicialización** | `js/main.js` | Arranque del sistema, auto-guardado (10s datos / 30s config), instalación PWA, auto-refresco |
| **Navegación** | `js/navigation.js` | Pestañas, atajos de teclado, menú desplegable, shortcuts por categoría |
| **Interfaz** | `js/ui.js` | Modal, toast, tema oscuro tri-state (auto/light/dark), animaciones |
| **i18n** | `js/i18n.js` | Diccionarios completos ES/EN/PT, traducción en vivo, detección de idioma del navegador |
| **Firebase** | `js/firebase.js` | Carga diferida del SDK, configuración central y tolerancia offline |
| **Autenticación** | `js/auth.js` | Login, registro, verificación de correo y recuperación de contraseña |

### 👥 Jugadores

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Jugadores** | `js/players.js` | Alta individual/pareja/equipo, edición, perfiles ampliados, check-in, avatares, import CSV/Excel, detección de duplicados, listas por categoría |

### 🏓 Competencia

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Reglamento** | `js/reglamento.js` | Reglas ITTF: sets, deuce, W.O., clasificación, puntos por partido |
| **Fixtures** | `js/fixtures.js` | Todos contra todos, suizo, rondas, head-to-head, validación ITTF |
| **Llaves** | `js/brackets.js` | Eliminación directa, byes automáticos, re-propagación de resultados |
| **Planificación** | `js/planning.js` | Multiplex: mesas, horarios, árbitros, prevención de conflictos |
| **Scoreboard** | `js/scoreboard.js` | Pantalla en vivo para proyección, auto-refresh 3s |
| **Mesas** | `js/tables.js` | Vista por mesa en vivo, estados (EN CURSO / FINALIZADO / PENDIENTE) |
| **Cartelera TV** | `js/tvboard.js` | Full-screen con todos los grupos, reloj en header, refresh 3s |
| **Sincronización** | `js/sync.js` | Firebase RTDB, roles, invitaciones por correo, presencia y reconexión |

### 📊 Análisis

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Estadísticas** | `js/stats.js` | Cálculo ITTF, dashboard, leaderboard, rachas, H2H |
| **ELO** | `js/elo.js` | Rating ELO con delta por partido, idempotencia, reversión, sync |
| **Gráficos** | `js/charts.js` | SVG: barras, líneas, evolución de puntos, win rate por club |
| **Ranking** | `js/ranking.js` | Ranking histórico, podios calculados, puntos acumulados |

### 🎖️ Cierre

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Torneos** | `js/tournaments.js` | Múltiples torneos, records, podios, MVP, difusión |
| **Certificados** | `js/certificates.js` | PDF con podio, participación y plantillas en blanco |
| **Sponsors** | `js/sponsors.js` | Hasta 5 patrocinadores con logo |
| **QR** | `js/qr.js` | Códigos de acreditación por jugador |

### 🔧 Utilidades

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| **Sonidos** | `js/sounds.js` | Notificaciones de partido, wake lock, verificación de horarios |
| **Logs** | `js/logs.js` | Bitácora de acciones con timestamp, exportación TXT |
| **Share** | `js/share.js` | Copiar, Web Share API, WhatsApp, fallback |
| **Changelog** | `js/changelog.js` | Versión actual, historial de cambios |

---

## 🔍 Funcionalidades detalladas

### 🏗️ Configuración del torneo

- **Nombre y subtítulo** del torneo
- **Reglamento ITTF** completo con validación de sets (11 puntos, diferencia de 2, deuce ilimitado)
- **Formato de partido**: Al mejor de 3 (BO3), 5 (BO5) o 7 (BO7) sets — configurable por fase
- **Categorías personalizables**: agregar, renombar, eliminar con renombrado en cascade
- **Cupo máximo** por categoría con lista de espera automática
- **Patrocinadores**: hasta 5 con logo (aparecen en certificados e imagen de podios)

### 👥 Gestión de jugadores

- **Alta individual**: nombre, club, categorías, fecha de nacimiento, licencia
- **Alta por pareja/equipo**: dos o más integrantes con identificación "A - B"
- **Check-in con QR**: código QR por jugador con acreditación el día del evento
- **Importación masiva**: subí un .csv o .xlsx con todos los jugadores
- **Template descargable**: archivo .xlsx con columnas esperadas y ejemplo
- **Detección de duplicados**: fusiona categorías sin repetir jugadores
- **Perfiles ampliados**: foto, estadísticas del torneo, H2H contra cada rival, próximos partidos
- **Filtros y orden**: buscar por nombre/club, ordenar por 7 criterios diferentes
- **Edad calculada** automáticamente desde la fecha de nacimiento
- **Sub-categorías sugeridas** según año de nacimiento (SUB 9 → SUB 23 / MAXI)

### 🏓 Competencia

- **Fixture todos contra todos** con desempates ITTF 3.7.5
- **Fixture suizo** con emparejamiento por ELO
- **Programación Multiplex**: mesas y horarios sin solapar jugadores
- **Árbitros por mesa**: asignación y visualización en grilla e impresión
- **Scoreboard en vivo**: pantalla para proyección con auto-refresh 3s
- **Mesas en vivo**: vista por mesa con estado (EN CURSO / FINALIZADO / PENDIENTE / W.O.)
- **Cartelera TV**: full-screen con todos los grupos, reloj en header
- **Cronómetro de partido**: cuenta regresiva según duración configurada, alarma sonora
- **Incidencias por partido**: retiro, lesión, protesta, tiempo muerto, tarjetas
- **W.O. (Walk Over)**: victoria 11-0 sin afectar rating ELO

### 📊 Estadísticas y análisis

- **Estadísticas ITTF**: puntos, sets, partidos ganados/perdidos
- **Gráficos SVG**: barras por categoría, líneas de evolución, win rate por club
- **Ranking ELO**: delta por partido, reversión al editar, sync entre fixtures
- **Enfrentamientos directos (H2H)**: historial contra cada rival con PJ/G/P
- **Rachas de victorias**: racha actual, mejor racha, forma reciente
- **Dashboard**: podios provisorios, progreso, próximos partidos, alertas

### 🎖️ Cierre y difusión

- **Llaves eliminatorias automáticas** con byes para jugadores impares
- **Tercer puesto** incluido en la llave
- **Podios por categoría** (🥇🥈🥉)
- **Certificados PDF**: podio, participación, plantilla en blanco
- **Reporte final**: pantalla, PDF e impresión
- **Imagen de podios** (PNG 1080×1080) para Instagram/Facebook
- **Plantillas de difusión**: convocatoria, día del torneo, resultados parciales, podios
- **WhatsApp directo**: un clic para enviar a grupo
- **Exportación PDF** de estadísticas, fixture, llaves y planillas

---

## 🌐 Idiomas

La app se traduce en tiempo real entre tres idiomas:

| Idioma | Bandera | Detección automática |
|--------|---------|---------------------|
| **Español** | 🇦🇷 | `es-AR`, `es-*` |
| **English** | 🇺🇸 | `en-US`, `en-*` |
| **Português** | 🇧🇷 | `pt-BR`, `pt-*` |

- El idioma se detecta del `navigator.language` la primera vez
- Se guarda la selección y persiste entre sesiones
- Los modales, tablas, gráficos y overlays se re-traducen al instante
- Las fechas usan el formato del idioma activo

---

## 🌙 Tema claro y oscuro

Tres modos disponibles en Settings → Apariencia:

| Modo | Descripción |
|------|-------------|
| ☀️ **Claro** | Tema claro forzado |
| 🌙 **Oscuro** | Tema oscuro forzado |
| 🖥️ **Automático** | Sigue el tema del sistema operativo en tiempo real |

- Detección automática con `matchMedia('(prefers-color-scheme: dark)')`
- Migración automática desde el toggle legacy (`darkMode` → `themeMode`)
- Persistencia en `localStorage`

---

## 🌐 Sincronización multi-dispositivo

Compartí el torneo en tiempo real entre dispositivos usando Firebase Realtime Database.

| Rol | Descripción |
|-----|-------------|
| 👑 **Anfitrión** | Crea la sala, edita el torneo, administra permisos y puede cerrarla |
| 🧑‍💻 **Operador** | Edita jugadores, fixtures y resultados en tiempo real |
| 👁️ **Espectador** | Consulta el torneo en vivo sin permiso de escritura |

**Cómo funciona:**
1. El organizador crea y verifica su cuenta, luego crea una sala de 6 caracteres
2. Invita por correo a operadores o espectadores mediante un enlace personal
3. Cada destinatario entra con el correo autorizado y reclama una sola vez su permiso
4. Los cambios se reflejan al instante y los dispositivos se reconectan automáticamente

**Requiere:** Firebase Authentication y Realtime Database con las reglas cerradas del repositorio. Consulta [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

---

## 🧪 Tests

```bash
node run-tests.js
```

**319 tests automatizados** que cubren:

| Suite | Tests | Qué valida |
|-------|-------|------------|
| `reglamento.test.js` | 17 | Reglas ITTF, sets, deuce, W.O., desempates |
| `storage.test.js` | 17 | Normalización, deshacer/rehacer, backups |
| `brackets.test.js` | 7 | Llaves, byes, re-propagación |
| `fixtures.test.js` | 13 | Todos contra todos, suizo, H2H, ITTF |
| `elo.test.js` | 13 | Rating, delta, reversión, idempotencia |
| `stats.test.js` | 12 | Estadísticas, rachas, H2H, leaderboard |
| `planning.test.js` | 16 | Multiplex, horarios, árbitros, límites |
| `players.test.js` | 40 | Alta, check-in, import, perfiles, QR |
| `tournaments.test.js` | 16 | Torneos, podios, records, MVP, difusión |
| `dashboard.test.js` | 9 | Dashboard, podios, progreso, flujo |
| `charts.test.js` | 14 | SVG, barras, líneas, evolución |
| `navigation.test.js` | 26 | Pestañas, atajos, menú desplegable |
| `ui.test.js` | 11 | Modal, toast, tema tri-state |
| `main.test.js` | 12 | Inicialización, PWA, auto-guardado |
| `sounds.test.js` | 7 | Sonidos, wake lock, horarios |
| `qr.test.js` | 3 | Acreditación QR |
| `tvboard.test.js` | 4 | Cartelera TV, cronómetro |
| `sync.test.js` | 10 | Sincronización, roles, reconexión y modo local |
| `security.test.js` | 4 | Configuración y reglas de seguridad Firebase |
| `i18n.test.js` | 2 | Claves EN/PT completas, sin duplicados |
| `consistency.test.js` | 5 | HTML/JS consistente, archivos existentes |
| `e2e.test.js` | 8 | Flujo completo: jugadores → fixture → stats → llaves |

---

## 🛠️ Stack tecnológico

<table>
<tr>
<td width="50%">

**Frontend**
- 🧱 HTML5 / CSS3 / JavaScript puro
- 🎨 CSS custom properties (light + dark)
- 📱 Responsive design
- 🖼️ SVG para gráficos e iconos

**Persistencia**
- 💾 localStorage como base de datos
- 🔄 Auto-guardado cada 10 segundos
- 📦 Backups automáticos rotativos
- 📥 Exportación / Importación JSON

</td>
<td width="50%">

**PWA**
- ⚡ Service Worker (cache offline)
- 📱 Manifest (instalable)
- 🔌 Funciona 100% offline

**Librerías (offline)**
- 📄 jsPDF + autotable (PDF)
- 📊 SheetJS / xlsx (Excel)
- 📱 QRCode.js (códigos QR)

**Sync (opcional)**
- 🔥 Firebase Auth + Realtime Database v12.19 compat
- 🔐 Roles por torneo y reglas de mínimo privilegio
- 📡 SDK con carga diferida (no bloquea el modo offline)

</td>
</tr>
</table>

**Sin frameworks y sin build obligatorio.** La aplicación de producción corre en el navegador; Node se usa solo para las pruebas.

---

## 📁 Estructura del proyecto

```
PingPong-Manager/
│
├── index.html              # 🏠 Punto de entrada (PWA)
├── manifest.json           # 📱 PWA manifest
├── sw.js                   # ⚡ Service Worker (cache v62)
├── firebase.json           # 🔥 Configuración de reglas RTDB
├── database.rules.json     # 🔐 Autorización por rol y correo
├── FIREBASE_SETUP.md       # 📘 Guía de configuración segura
├── package.json            # 📦 Metadata del proyecto
├── run-tests.js            # 🧪 Runner de tests
├── LICENSE                 # 📄 Licencia MIT
│
├── css/
│   └── styles.css          # 🎨 Estilos (light + dark, 2500+ líneas)
│
├── js/                     # 🧩 22 módulos
│   ├── storage.js          #    Persistencia y normalización
│   ├── main.js             #    Inicialización
│   ├── navigation.js       #    Pestañas y atajos
│   ├── ui.js               #    Interfaz (modal, toast, tema)
│   ├── i18n.js             #    Multi-idioma (ES/EN/PT)
│   ├── players.js          #    Gestión de jugadores
│   ├── fixtures.js         #    Fixture todos contra todos / suizo
│   ├── brackets.js         #    Llaves eliminatorias
│   ├── planning.js         #    Programación Multiplex
│   ├── scoreboard.js       #    Scoreboard en vivo
│   ├── tables.js           #    Mesas en vivo
│   ├── tvboard.js          #    Cartelera TV
│   ├── stats.js            #    Estadísticas ITTF
│   ├── elo.js              #    Rating ELO
│   ├── charts.js           #    Gráficos SVG
│   ├── ranking.js          #    Ranking histórico
│   ├── tournaments.js      #    Múltiples torneos
│   ├── certificates.js     #    Certificados PDF
│   ├── reglamento.js       #    Reglamento ITTF
│   ├── sounds.js           #    Sonidos y wake lock
│   ├── logs.js             #    Bitácora de acciones
│   ├── share.js            #    Compartir / copiar
│   ├── sponsors.js         #    Patrocinadores
│   ├── qr.js               #    Códigos QR
│   ├── firebase-config.js  #    Configuración web del proyecto
│   ├── firebase.js         #    Carga e inicialización Firebase
│   ├── auth.js             #    Login y verificación de correo
│   ├── sync.js             #    Sync, roles, invitaciones y presencia
│   └── changelog.js        #    Versión y changelog
│
├── lib/                    # 📚 Librerías offline
│   ├── jspdf.umd.min.js
│   ├── jspdf.plugin.autotable.min.js
│   ├── xlsx.full.min.js
│   └── qrcode.min.js
│
├── icons/                  # 🖼️ Iconos PWA
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
│
├── tests/                  # 🧪 319 tests
│   ├── runner.js           #    Motor de tests
│   ├── env.js              #    Entorno de prueba
│   ├── *.test.js           #    Suites por módulo
│   └── smoke/              #    Tests edge case
│
└── Patrocinadores/         # 📸 Logos de patrocinadores
```

---

## 🚀 Cómo empezar

### Uso rápido

1. **Cloná** el repositorio:
   ```bash
   git clone https://github.com/fbzz64/PingPong-Manager.git
   ```
2. **Abrí** `index.html` en tu navegador
3. **(Opcional)** Instalá la PWA desde el botón "Instalar" en la barra superior

### Requisitos

- Cualquier navegador moderno (Chrome, Edge, Firefox, Safari)
- No necesita servidor — abre directamente el `index.html`
- Para sync multi-dispositivo: Firebase Authentication y Realtime Database

### Sincronización (opcional)

Sigue la guía completa [FIREBASE_SETUP.md](FIREBASE_SETUP.md). En resumen: habilita correo/contraseña, crea Realtime Database en modo bloqueado, publica `database.rules.json` y copia el objeto web a `js/firebase-config.js`.

### Ejecutar tests

```bash
node run-tests.js
# Total: 319 pasaron, 0 fallaron
```

---

## ⌨️ Atajos de teclado

### Generales

| Atajo | Acción |
|-------|--------|
| `Ctrl + Z` | Deshacer |
| `Ctrl + Y` | Rehacer |
| `Ctrl + S` | Guardar torneo |
| `Ctrl + P` | Nuevo jugador |
| `Ctrl + E` | Exportar |
| `Ctrl + B` | Importar |
| `Ctrl + Shift + P` | Check-in rápido |
| `F1` | Dashboard |
| `F2` | Jugadores |
| `F3` | Fixture |
| `F5` | Refrescar dashboard |
| `F7` | Ranking |
| `F8` | Configuración |
| `F11` | Notas rápidas |
| `F12` | Bitácora |
| `ESC` | Cerrar modal / panel / menú |

### Navegación

| Atajo | Acción |
|-------|--------|
| `Ctrl + Shift + 1` | Ir a Jugadores |
| `Ctrl + Shift + 2` | Ir a Fixture |
| `Ctrl + Shift + 3` | Ir a Estadísticas |
| `Ctrl + Shift + 4` | Ir a Ranking |
| `Ctrl + Shift + 5` | Ir a Configuración |
| `Alt + L` | Marcar jugador como LIBRE |

---

## 📱 Compatibilidad

| Plataforma | Estado | Notas |
|------------|--------|-------|
| 🖥️ **Chrome / Edge** (desktop) | ✅ Completo | Todas las funciones, PWA instalable |
| 🖥️ **Firefox** (desktop) | ✅ Completo | Todas las funciones |
| 🍎 **Safari** (macOS) | ✅ Completo | Todas las funciones |
| 📱 **Chrome** (Android) | ✅ Completo | PWA instalable, Web Share API |
| 📱 **Safari** (iOS) | ✅ Completo | PWA instalable |
| 📺 **Smart TV** | ✅ Cartelera | Cartelera TV full-screen |
| 💻 **Sin internet** | ✅ Offline | 100% funcional sin conexión |

---

## 🗺️ Roadmap

- [x] 🔥 Firebase Auth y sincronización segura con roles
- [ ] 📊 Dashboard de administración con métricas de múltiples torneos
- [ ] 🏆 Liga con calendario y fase regular
- [ ] 📱 Notificaciones push para recordatorios
- [ ] 🌐 Online multiplayer (edición simultánea con permisos)
- [ ] 📄 Generador de reglamento personalizado
- [ ] 🎨 Themes personalizados
- [ ] 📊 Estadísticas avanzadas (permutaciones, puntos por set)

---

## 📄 Licencia

MIT License — ver [LICENSE](LICENSE).

---

<div align="center">

**Hecho con ❤️ para la comunidad de ping pong**

[![GitHub](https://img.shields.io/badge/GitHub-fbzz64/PingPong--Manager-181717?style=for-the-badge&logo=github)](https://github.com/fbzz64/PingPong-Manager)

</div>
