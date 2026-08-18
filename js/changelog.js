// ==========================================
// CHANGELOG.JS - Bitácora de cambios por versión
// ==========================================

// Versión actual del sistema
window.APP_VERSION = '2.28';

// Botón de versión del header sincronizado con APP_VERSION
function syncVersionButton() {
    const btn = document.getElementById('version-button');
    if (btn) btn.textContent = '📜 v' + APP_VERSION;
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncVersionButton);
} else {
    syncVersionButton();
}

// Historial de cambios (más reciente primero)
const CHANGELOG = [
    {
        version: '2.28',
        date: '2026-08-17',
        title: 'Sincronización multi-dispositivo',
        changes: [
            '🌐 Sincronización multi-dispositivo: compartí el torneo en tiempo real entre dispositivos. Un dispositivo edita (host) y los demás lo ven actualizarse al instante. Ideal para proyectar en una TV mientras se edita desde la notebook.',
            '📡 Host y Viewer: la sección "Sincronizar Torneo" en Settings permite crear una sala (host) o unirse con un código de 6 caracteres (viewer). El host es la fuente de verdad; los clientes son solo lectura.',
            '🔗 Firebase RTDB: usa Firebase Realtime Database v9 compat vía CDN (carga dinámica, no falla offline). Configurá FBASE_CONFIG en js/sync.js con los datos de tu proyecto Firebase.',
            '🔄 Auto-reconexión: si el browser se reconecta, retoma la sala anterior automáticamente.',
            '🧪 Tests: 313 tests en total — sync, i18n y consistencia.'
        ]
    },
    {
        version: '2.27',
        date: '2026-08-17',
        title: 'Tema oscuro automático y selector de idioma con banderas',
        changes: [
            '🎨 Tema oscuro automático: el toggle ahora tiene 3 modos — ☀️ Claro, 🌙 Oscuro y 🖥️ Automático. En modo automático, la app sigue el tema de tu sistema operativo (light/dark) y se adapta en tiempo real si lo cambiás desde las preferencias del SO.',
            '🌐 Selector de idioma con banderas: el botón de idioma ahora muestra un panel flotante con 🇦🇷 ES, 🇺🇸 EN y 🇧🇷 PT. La bandera activa se resalta. Se detecta automáticamente el idioma del navegador la primera vez que se abre la app.',
            '⚙️ Settings de apariencia renovado: la sección "Apariencia" ahora muestra los 3 botones de tema con el activo resaltado, en lugar de un solo botón de toggle.',
            '🧪 Tests de tema tri-state y detección de idioma: 305 tests en total.'
        ]
    },
    {
        version: '2.26',
        date: '2026-08-16',
        title: 'Cartelera TV, cronómetro, árbitros, incidencias y backups',
        changes: [
            '🖥️ Cartelera TV: pantalla completa con todos los grupos del torneo y sus resultados en vivo, actualizándose sola cada 3 segundos. Ideal para un proyector o una TV del club.',
            '⏱️ Cronómetro de partido: el Scoreboard y las Mesas en vivo muestran la cuenta regresiva según la duración configurada; al llegar a cero suena una alarma, marca el tiempo extra y podés reiniciarlo con un botón.',
            '🧑⚖️ Árbitros por mesa en Multiplex: al programar los partidos ahora podés asignar un árbitro a cada mesa; aparece en la grilla, en la impresión y en el mensaje de difusión.',
            '📝 Incidencias por partido: cada partido tiene su campo de incidencias (retiro, lesión, protesta, tiempo muerto, tarjetas…) que se muestra en el Scoreboard, las Mesas y la Cartelera.',
            '🔄 Backups automáticos: la app guarda una copia completa del torneo cada 5 minutos (hasta 6 versiones). Desde Configuración podés ver la lista y restaurar cualquier backup.',
            '🧪 Tests de las mejoras: 305 tests en total.'
        ]
    },
    {
        version: '2.25',
        date: '2026-08-16',
        title: 'Asistente de fin de torneo con checklist',
        changes: [
            '🏁 Asistente de fin de torneo: antes de cerrar el torneo se muestra un checklist interactivo con todas las fases: configuración, jugadores, check-in, fixtures, partidos completados, llaves y estadísticas.',
            '✅ Estado de cada paso: cada fase muestra si está lista o pendiente, con botón "Ir" para saltar a la pestaña correspondiente y completarla.',
            '🛑 Protección: el asistente no deja generar el reporte final si no hay fixtures guardados; avisa con un resumen de pasos completados (X/Y).',
            '🧪 Tests del asistente: 294 tests en total.'
        ]
    },
    {
        version: '2.24',
        date: '2026-08-16',
        title: 'Importación masiva de jugadores (CSV/Excel)',
        changes: [
            '📊 Importación masiva: subí un archivo .csv o .xlsx con los jugadores y se agregan todos de una vez, normalizando nombres y clubs como el sistema.',
            '📋 Plantilla de importación descargable: botón nuevo que baja un .xlsx con las columnas esperadas (Nombre, Club, Categorías, Ranking, Fecha de Nacimiento, Licencia) y una fila de ejemplo.',
            '🔀 Sin duplicados: si un jugador ya existe (mismo nombre y club), se fusionan las categorías y se completan los campos faltantes en lugar de repetirlo. Al terminar se muestra cuántos se agregaron, actualizaron y omitieron.',
            '🧪 Tests de la importación: 292 tests en total.'
        ]
    },
    {
        version: '2.23',
        date: '2026-08-16',
        title: 'Experiencia de torneo: acreditación masiva, sonidos y Wake Lock',
        changes: [
            '🖨️ Planilla de acreditación: imprimí todos los códigos QR de los jugadores en una sola hoja (con nombre, club y categorías) para el día del torneo.',
            '🔔 Notificaciones sonoras: la app suena al finalizar un partido y cuando llega la hora de un partido programado (Multiplex). Se pueden activar o desactivar desde Configuración.',
            '💡 Wake Lock: el Scoreboard 📺 y las Mesas en vivo 🪑 mantienen la pantalla encendida mientras se proyectan, para que el celular no se apague a mitad de ronda.',
            '🧪 Tests de la nueva experiencia: 287 tests en total.'
        ]
    },
    {
        version: '2.22',
        date: '2026-08-16',
        title: 'Auto-guardado y recuperación de sesión',
        changes: [
            '💾 Auto-guardado cada 10 segundos: los cambios en el torneo se persisten solos, sin esperar a guardar manualmente. Un corte de luz o cierre brusco pierde como mucho los últimos segundos.',
            '🔄 Checkpoint de recuperación: se guarda una copia de la sesión (con timestamp) al cerrar u ocultar la app, y si el archivo principal se corrompe al abrir, se restaura automáticamente desde la última copia.',
            '⏱️ Al cerrar/ocultar la pestaña se fuerza el guardado final para dejar la sesión lista para reabrir.',
            '🧪 Tests de la nueva protección: 277 tests en total.'
        ]
    },
    {
        version: '2.21',
        date: '2026-08-16',
        title: 'Traducción en vivo',
        changes: [
            '🌐 Los paneles en vivo se re-traducen al instante al cambiar de idioma: el Scoreboard 📺 y las Mesas en vivo 🪑 re-renderizan su contenido abierto, y los modales abiertos actualizan su título y textos.',
            '🗓️ Las fechas y horas ahora usan el formato del idioma activo (es-AR, en-US o pt-BR) en certificados, exportaciones, PDF, logs, estadísticas, fixture, jugadores y planificación.',
            '🏷️ Nuevas traducciones para el Scoreboard y Mesas en vivo: FINALIZADO, EN CURSO, PENDIENTE, Partido, Mesa, sets, Árbitro, mesas y partidos finalizados.',
            '⏱️ El reloj del Scoreboard y de las Mesas en vivo responde al idioma seleccionado.'
        ]
    },
    {
        version: '2.20',
        date: '2026-08-16',
        title: 'Calidad del soporte de idiomas',
        changes: [
            '🧹 Limpieza: eliminados 16 mensajes de debug en la consola.',
            '🔍 Diccionarios EN/PT sin claves duplicadas (161 líneas eliminadas; en JS el último valor ganaba silenciosamente).',
            '🩹 Traducciones faltantes completadas (5 claves: abreviaturas G/P, "y", check-in rápido y edad con emoji).',
            '🧪 Nueva suite de tests de idiomas: detecta claves duplicadas y claves usadas sin traducción (271 tests en total).'
        ]
    },
    {
        version: '2.19',
        date: '2026-08-16',
        title: 'Soporte de idiomas (Español, Inglés, Portugués)',
        changes: [
            '🌐 Nuevo botón de idioma en el encabezado: cambia entre Español, English y Português con un solo toque; la elección se guarda y se aplica al instante.',
            '📦 Infraestructura i18n: diccionarios completos EN/PT y función de traducción con respaldo automático al español si falta una clave.',
            '🏠 Interfaz estática traducida: menús, botones, títulos, pestañas, logros del dashboard y textos del sistema en los tres idiomas.',
            '📋 Módulos traducidos: navegación, logs, configuración y almacenamiento (backups, exportación/importación, archivos, borrado total).',
            '👥 Gestión de jugadores traducida: alta, perfiles completos, check-in, avatares, edición, exportación/importación, listas por categoría y detección de duplicados.',
            '🏆 Torneos traducidos: nuevo torneo, finalización, reporte final (pantalla/PDF/impresión), difusión por plantillas/WhatsApp/redes, imagen de podios, reset completo y puntos de restauración.',
            '🔧 Pruebas de regresión ampliadas (267) con el motor de idiomas integrado; Service Worker actualizado (v50).'
        ]
    },
    {
        version: '2.18',
        date: '2026-08-15',
        title: 'Mesas en vivo para proyección',
        changes: [
            '🪑 Nueva vista "Mesas en vivo" (botón en ⚡ Fixture): proyecta en pantalla completa la programación Multiplex de un grupo organizada por mesa.',
            '🕐 Cada mesa muestra su partido en curso o el próximo pendiente resaltado, con horario, sets y estado (EN CURSO / FINALIZADO / PENDIENTE / W.O.).',
            '🔄 Se actualiza sola cada 3 segundos y lee los resultados en tiempo real si el grupo está visible en la pestaña Fixture (misma lógica que el scoreboard).',
            '⌨️ Se cierra con ESC o con el botón ✕ Cerrar.',
            '⚙️ Service Worker actualizado (v47) con el módulo nuevo.'
        ]
    },
    {
        version: '2.17',
        date: '2026-08-15',
        title: 'Acreditación con QR y check-in rápido',
        changes: [
            '📱 QR de acreditación por jugador: desde el perfil, con la acción "Mostrar QR", se genera el código con nombre, club y licencia, listo para imprimir o mostrar en el celular.',
            '📷 Escanear QR desde el tab Jugadores: con la cámara del dispositivo (BarcodeDetector) se lee el QR y se marca al jugador presente automáticamente; si la cámara no está disponible, se busca al jugador manualmente.',
            '🔔 Check-in rápido: al abrir el tab Jugadores se muestra una barra con los que todavía no se acreditaron y el porcentaje de presencia, con botones para marcarlos presentes al instante.',
            '⌨️ ESC ahora cierra también el scoreboard en vivo (además de modales, atajos y menús).',
            '⚙️ Service Worker actualizado (v46): precachea los módulos nuevos (scoreboard, QR) y la librería de códigos QR.'
        ]
    },
    {
        version: '2.16',
        date: '2026-08-15',
        title: 'Perfil de jugador ampliado y edición unificada',
        changes: [
            '👤 El perfil de jugador ahora se abre a pantalla completa y agrega: estadísticas del torneo actual (partidos, ganados/perdidos, % efectividad, sets a favor/en contra, puntos totales, racha y desglose por categoría).',
            '📊 Enfrentamientos directos (H2H) contra cada rival con PJ/G/P, sets y porcentaje.',
            '📅 Próximos partidos con mesa y hora (si el fixture fue programado) y últimos resultados con sets y fecha.',
            '📷 Foto de perfil: cargala desde el dispositivo (se redimensiona a 128px) o usá el avatar automático con iniciales; aparece en la lista de jugadores y en el perfil.',
            '✏️ Edición unificada en el perfil: "Editar datos" abre el formulario dentro del mismo modal sin cerrarlo; Guardar/Cancelar vuelven al perfil. También reabre el perfil al guardar desde la tabla de jugadores.',
            '🎨 Los modales con contenido extenso (como el perfil) aprovechan toda la pantalla; la barra de botones queda fija abajo.'
        ]
    },
    {
        version: '2.15',
        date: '2026-08-15',
        title: 'Funciones para redes sociales',
        changes: [
            '📲 Abrir WhatsApp directo (enlace wa.me): botones en difusión de podios, plantillas y programación Multiplex abren WhatsApp con el mensaje ya cargado, sin pasar por el portapapeles. Funciona en PC (WhatsApp Web) y celular.',
            '📝 Plantillas de difusión: mensajes prearmados por ocasión (convocatoria a inscripción, día del torneo, resultados parciales con líderes, y podios finales), editables antes de copiar o enviar.',
            '🕒 Difundir programación Multiplex: botón en el modal de programación que arma el texto con mesas y horarios de cada partido.',
            '🖼️ Imagen de podios (PNG 1080×1080): genera una imagen con los podios de todas las categorías y el nombre de los patrocinadores, lista para publicar en Instagram/Facebook.',
            '📣 Nuevo hub "Difundir en Redes" en el dashboard que agrupa las opciones de difusión.'
        ]
    },
    {
        version: '2.14',
        date: '2026-08-14',
        title: 'Correcciones: categorías en navegador limpio y favicon',
        changes: [
            '🐛 Fix: en un navegador sin datos guardados, los selectores de categoría (fixture y jugadores) quedaban vacíos. Ahora se siembran automáticamente con las categorías estándar.',
            '🖼️ Agregado el favicon (icons/icon-192.png) para eliminar el 404 de /favicon.ico en la consola.',
            '🔢 El botón de versión del header ahora se sincroniza automáticamente con la versión real del sistema (antes quedaba fijo en la última versión tipeada a mano).',
            '✅ Verificación completa del flujo real en navegador (Edge): jugadores → check-in → listas → fixture → Multiplex → resultados → estadísticas → H2H → ranking → llaves → podios → certificados → exportaciones → configuración → persistencia y modo OFFLINE (PWA), sin errores.'
        ]
    },
    {
        version: '2.13',
        date: '2026-08-12',
        title: 'Menú principal en lista desplegable',
        changes: [
            '📂 El menú principal ahora es una lista desplegable estilo menú profesional: cada sección (Preparación, Competencia, Análisis, Cierre y mantenimiento) abre sus opciones al hacer clic.',
            '▾ El toggle muestra la sección activa (p. ej. "Competencia · 📊 Dashboard") y la opción activa queda resaltada dentro del menú.',
            '🖱️ Se cierra al elegir una opción, al hacer clic fuera o con ESC; un solo menú abierto a la vez.'
        ]
    },
    {
        version: '2.12',
        date: '2026-08-12',
        title: 'Encabezados de modales estilo menú profesional',
        changes: [
            '🎛️ Los modales ahora abren con una barra superior de color (estilo menú desplegable): ícono + título a la izquierda, chevron ▾ y botón ✕ para cerrar a la derecha.',
            '🚀 Aplicado a todas las ventanas del sistema: bitácora, guía, check-in, configuración, backups y más.'
        ]
    },
    {
        version: '2.11',
        date: '2026-08-12',
        title: 'Deshacer/Rehacer flotantes',
        changes: [
            '↩️↪️ Los botones de Deshacer y Rehacer ahora flotan en la esquina inferior derecha (junto al estilo del toggle de tema y los atajos de teclado), siempre visibles y a mano.',
            '🧭 El header queda más limpio: la bitácora y la guía se mantienen arriba, los controles de historial se mudan al margen.'
        ]
    },
    {
        version: '2.10',
        date: '2026-08-12',
        title: 'Partidos al mejor de 7 sets (BO7)',
        changes: [
            '🏓 Nuevo formato de partido "Al mejor de 7 sets (BO7)" disponible en grupos y llaves, junto a BO3 y BO5.',
            '📊 Las planillas, tablas de resultados, llaves y W.O. se adaptan automáticamente a 7 columnas de sets (el ganador necesita 4 sets).',
            '🖨️ Las planillas oficiales impresas indican el formato correcto (BO3, BO5 o BO7).'
        ]
    },
    {
        version: '2.9',
        date: '2026-08-12',
        title: 'Administrador de categorías en Configuración',
        changes: [
            '🏷️ Nueva sección "Categorías y Límites de Inscripción" en ⚙️ Configuración: agregá, modificá y eliminá categorías del torneo.',
            '✏️ Al modificar una categoría se renombra en todos lados: jugadores, fixture, llaves, lista de espera y límites.',
            '🗑️ Al eliminar se quita de jugadores y lista de espera; se bloquea si la categoría ya tiene fixtures o llaves generadas.',
            '📶 Cupo máximo de inscriptos por categoría (opcional): al alcanzar el límite, los nuevos jugadores van a la lista de espera.',
            '🔎 Los selectores de categoría (Fixture y alta de jugadores) ahora se reconstruyen desde una única lista canónica, y el botón ➕ del Fixture abre el mismo administrador.'
        ]
    },
    {
        version: '2.8',
        date: '2026-08-12',
        title: 'Exportaciones PDF y Excel 100% offline',
        changes: [
            '📦 jsPDF, autotable y SheetJS (xlsx) ahora se cargan desde el propio sitio (carpeta lib/), no desde CDN.',
            '📄 Exportar a PDF (estadísticas, fixture, llaves, planillas) y a Excel (.xlsx) funciona sin conexión a internet.',
            '🔌 Service Worker actualizado para precachear las librerías locales y los módulos nuevos.'
        ]
    },
    {
        version: '2.7',
        date: '2026-08-12',
        title: 'Filtros y orden de la lista de jugadores',
        changes: [
            '🔎 Barra "Filtrar y Ordenar" sobre la lista de jugadores: buscador por nombre o club en tiempo real.',
            '📶 Orden por Nombre (A-Z / Z-A), Club, Edad, ELO, Ranking, Check-in o Categorías, con botón para invertir la dirección.',
            'Edad, ELO y Check-in arrancan de mayor a menor (más viejo, mejor ELO, presentes primero); Ranking de mejor a peor puesto; el resto alfabético A-Z.',
            'El orden y la búsqueda se conservan al re-renderizar la lista (check-in, edición, perfil).',
            'Indicador de "Mostrando X de Y jugadores" y aviso cuando la búsqueda no coincide.',
            'Corrección: la versión actual ya no se repite en la bitácora de cambios (quedaba duplicada en el encabezado y en la lista de versiones).'
        ]
    },
    {
        version: '2.6',
        date: '2026-08-12',
        title: 'Landing renovado: dashboard con flujo guiado, podios, progreso y mesas',
        changes: [
            '🏷️ Encabezado con el nombre real del torneo (y su subtítulo) en lugar del título genérico del sistema.',
            '🧭 Flujo del torneo guiado: 5 pasos (Configurar → Registrar → Generar fixture → Completar partidos → Llaves) con el paso actual marcado y acceso directo a cada uno.',
            '🥇 Podios provisionales por categoría (top 3) calculados en vivo desde los partidos completados.',
            '📊 Progreso del torneo: barra de avance por categoría y total de partidos completados.',
            '🕒 Próximos partidos en mesa según la programación Multiplex, con hora, mesa y enfrentamiento.',
            '🏷️ Chips de jugadores por categoría con cantidad de inscriptos; un clic lleva a Fixture con esa categoría preseleccionada.',
            '🕘 Últimos registros de la bitácora en la home, con acceso a la vista completa.',
            '⚠️ Alertas ampliadas: check-in de presencia pendiente y categorías con grupos completados sin llaves generadas.',
            '🔴 Auto-refresco de partidos en vivo y próximas mesas cada 15 segundos mientras el Dashboard está activo.',
            'Tarjetas de resumen inicializadas en 0 (sin números de ejemplo) y datos reales del torneo en todo momento.'
        ]
    },
    {
        version: '2.5',
        date: '2026-08-11',
        title: 'Paquete de correcciones de auditoría (ELO, llaves y estabilidad)',
        changes: [
            '🔄 Rating ELO sin pérdidas: cada partido guarda el delta aplicado y la huella de su resultado. Re-guardar o editar un resultado revierte solo lo de ese partido: no duplica puntos ni borra el rating que aportaron otros grupos con jugadores en común.',
            '🏆 Llaves: al editar el resultado de una llave ya jugada se re-propagan automáticamente ganadores y perdedores a las rondas siguientes (incluido el Tercer Puesto), sin jugadores duplicados entre la Final y el Bronce.',
            'W.O. sin distorsión en Estadísticas: los partidos ganados por incomparecencia ya no cuentan como partidos jugados ni en las rachas (no suman sets, puntos ni victorias). El ranking de grupos sigue otorgando 2/0 puntos como manda el reglamento.',
            '📊 Dashboard: eliminados los bloques estáticos obsoletos; solo muestra información real del torneo, sin alertas fantasma de partidos pendientes.',
            '↩️ Deshacer/Rehacer atómico: editar un fixture (resultados, jugadores, ELO y registro) se deshace/rehace como una sola operación y la vista de Fixture y Llaves se refresca al deshacer.',
            '🧭 Registro, ranking y gráficos: la pestaña Registro se actualiza al navegar; el ranking y el gráfico de evolución filtran por categoría y atribuyen los puntos a cada integrante de dobles/equipos.',
            '🔍 Otras correcciones: fecha de nacimiento sin corrimiento de zona horaria, licencia y fecha conservadas al forzar el alta de un jugador de la lista de espera, impresión de fixture a prueba de bloqueos de popup y respaldo antes de un nuevo torneo correctamente versionado.'
        ]
    },
    {
        version: '2.4',
        date: '2026-08-11',
        title: 'Compartir planillas y certificados en redes + plantilla en blanco',
        changes: [
            '📤 Compartir en un click: botones de compartir en cada planilla de partido y en el paquete de planillas. En el celular usa la Web Share API (comparte el PDF directo a WhatsApp, correo, Instagram, etc.); en la PC descarga el archivo y copia un mensaje listo para pegar en la red social.',
            '📤 Compartir resultados: botón en el modal de certificados que arma un resumen de podios (🥇🥈🥉 por categoría) listo para WhatsApp/Instagram o portapapeles.',
            '🖨️ Plantilla en blanco de certificado: nueva opción en el modal que genera un certificado solo con los datos del torneo, con espacio para escribir el nombre del jugador a mano y puesto a elección (1°, 2°, 3°, 4° o Participación).',
            'Certificado de 4° lugar (🎖️) agregado al selector de plantillas en blanco.'
        ]
    },
    {
        version: '2.3',
        date: '2026-08-10',
        title: 'Sorteo 3.7.5.4, planilla oficial de partido y correcciones',
        changes: [
            'Sorteo de desempates (regla ITTF 3.7.5.4): botón 🎲 en la tabla resumen del grupo que, cuando tras el mini-torneo quedan jugadores igualados, sortea las posiciones compartidas y las convierte en posiciones consecutivas.',
            'El orden sorteado se persiste con el fixture (campo sorteo) y se respeta al recargar, al recalcular posiciones y al sembrar las llaves.',
            'Planilla oficial de partido en PDF (📄 por partido): incluye elección inicial por sorteo (2.13.1), orden de saque alternado cada 2 puntos y de a 1 en deuce (2.13.3), resultado por set, tiempo muerto de 1 minuto por jugador (3.5.2), sistema de aceleración/expedite (2.15), tarjetas de conducta amarilla/roja (3.5.3) y firmas del árbitro y los jugadores.',
            'Paquete de planillas en blanco (📄 Planillas PDF): un solo click exporta las planillas oficiales de TODOS los partidos del grupo (una por página) para entregar al árbitro antes de la jornada.',
            'Corrección: la lista de jugadores ya no es una foto estática de la base de datos (se actualiza dinámicamente al abrir la pestaña).',
            'Corrección: el botón Editar/Eliminar del jugador 4 (VIER EMANUEL) en el inicio apuntaba a un índice incorrecto.',
            'Corrección: se eliminó la acumulación de listeners al actualizar los campos de jugadores del fixture (el cierre de sugerencias se registra una sola vez).',
            'Corrección: el auto-guardado de configuración ya no queda bloqueado si falta alguno de los campos (guarda cada campo disponible).',
            'Corrección: limpiar todos los datos ahora conserva la estructura completa (incluida la lista de espera) y el mensaje ya no contradice el deshacer con Ctrl+Z.',
            'Corrección: se eliminó el campo muerto tournamentData.matches que no se usaba en ningún flujo.'
        ]
    },
    {
        version: '2.2',
        date: '2026-08-10',
        title: 'Edad, sub-categorías y licencia',
        changes: [
            'Campo fecha de nacimiento en el registro y edición de jugadores.',
            'Edad calculada automáticamente (exacta) y mostrada en la lista de jugadores, la tabla y el perfil.',
            'Sub-categoría sugerida según el año de nacimiento (SUB 9 → SUB 23 / MAYORES) y categorías MAXI 40/50/60 opcionales para mayores de 40.',
            'Al cargar la fecha de nacimiento se preseleccionan automáticamente las categorías SUB/MAXI correspondientes en el formulario.',
            'Campo número de licencia (opcional) con validación de formato (letras y números, 4-15 caracteres), visible en la lista de jugadores y el perfil.',
            'Los campos de edad y licencia se propagan también a la lista de espera y al flujo de cupo completo/duplicados.',
            'Cálculo de edad robusto frente a zonas horarias (evita el corrimiento UTC que desplazaba la fecha de nacimiento).'
        ]
    },
    {
        version: '2.1',
        date: '2026-08-10',
        title: 'Correcciones de la ronda de control de calidad',
        changes: [
            'Fixture/Resumen: validación de cantidad de puntos por partido (múltiplos de 10, de 30 a 300) en B2 y B3.',
            'Ingreso de sets: validación de puntajes de set según reglamento y botón W.O. para victoria 11-0 (los sets W.O. no se pierden).',
            'Fixture: paso de configuración bloquea continuar sin participantes; no se pueden saltar partidos incompletos al avanzar de ronda.',
            'Exportar/Importar JSON (F2/F3): ronda completa del estado (participantes, planillas, historial, estadísticas) y reintegro exacto.',
            'Brackets: carga automática de los partidos del torneo (F3) y edición de resultados (F4) con columnas de sets dinámicas.',
            'Bracket de grupos: al editar el último partido se usa el conteo de sets jugados por el ganador, no un valor fijo.',
            'Swiss: sembrado determinista por ELO en la 1ª ronda y recálculo de rondas posteriores según desempeño real.',
            'PDF/Imprimir: el fixture refleja los resultados reales de grupos (usando la clasificación ITTF) y el ganador del bracket.',
            'Gráfico de evolución: solo cuenta partidos completados y usa puntos ITTF (2-1-0).',
            'Unir jugadores: fusiona también estadísticas y resultados acumulados, no solo los nombres.',
            'Restablecer sistema: limpia por completo brackets, planillas y datos de prueba.',
            'Backup: se corrige el nombre del archivo dentro del ZIP (antes quedaba con nombre erróneo).',
            'Manifest: color de tema alineado con la interfaz y rango de jugadores de 2 a 8.',
            'Copia monolítica HTML corregida para incluir todos los recursos.'
        ]
    },
    {
        version: '2.0',
        date: '2026-08-07',
        title: 'Desempates ITTF (regla 3.7.5)',
        changes: [
            'Clasificación de grupos según reglamento oficial ITTF 3.7.5: 2 puntos por victoria, 1 por derrota jugada y 0 por derrota W.O. o partido sin decidir.',
            'Desempate entre igualados solo con los partidos jugados entre ellos (mini-torneo, 3.7.5.2), aplicando en orden: puntos de partido, cociente de sets y cociente de puntos (11-0 se cuenta como 11 puntos a favor y 0 en contra).',
            'Resolución recursiva (3.7.5.3): una vez un jugador del mini-torneo queda en solitario, se excluye del desempate de los restantes y se vuelve a recalcular.',
            'Empates que persisten tras los cocientes quedan con posición compartida en la tabla y se resuelven por sorteo (3.7.5.4), tal como exige el reglamento.',
            'Las posiciones (Pos.) de las planillas y la comparación entre jugadores usan automáticamente la clasificación ITTF.',
            'Las estadísticas de fase de grupos suman puntos ITTF (2-1-0) y partidos jugados/ganados/perdidos.',
            'Los sets de un partido W.O. no ingresan en los cocientes (no son sets jugados).'
        ]
    },
    {
        version: '1.9',
        date: '2026-08-07',
        title: 'Reglamento de juego ITTF',
        changes: [
            'Validación ITTF de planillas: un set se gana con 11 puntos y diferencia mínima de 2. Se rechazan resultados imposibles (1-0, 11-10, empates).',
            'Deuce ilimitado: si ambos llegan a 10 o más, el set continúa hasta que uno obtenga 2 puntos de ventaja (ej: 12-10, 13-11, 30-28).',
            'Formato de partido configurable por fase: al mejor de 3 (BO3) o al mejor de 5 (BO5) para partidos de grupos y para llaves eliminatorias, desde ⚙️ Configuración.',
            'Las planillas se generan con la cantidad de sets del formato (BO3 → 3 columnas, BO5 → 5 columnas).',
            'Detección de partidos sin ganador: un partido solo se considera completado cuando tiene un ganador válido; los partidos empatados o sin decidir se marcan y no cuentan en tablas, estadísticas ni dashboard.',
            'Resultado W.O. (incomparecencia): botón por partido en planillas y llaves para declarar la no presentación de un jugador. El rival gana 11-0 en todos los sets, el partido se completa y el ELO no se ve afectado.',
            'Se puede deshacer un W.O. para volver a cargar el partido normalmente.'
        ]
    },
    {
        version: '1.8',
        date: '2026-08-07',
        title: 'Guía del sistema y correcciones de datos',
        changes: [
            'Nuevo modal 🧭 Guía del Sistema: describe todas las funciones del sistema y el flujo recomendado para gestionar el torneo.',
            'Funciones agrupadas por fase del torneo para encontrarlas rápido: 🏗️ Preparación, ⚔️ Competencia, 📈 Análisis y 🎖️ Cierre y mantenimiento.',
            'Pestañas principales categorizadas por fase (Preparación, Competencia, Análisis, Cierre y mantenimiento).',
            'Tooltips en las pestañas: al pasar el mouse se muestra una breve descripción de cada módulo.',
            'Incluye el flujo del administrador paso a paso, de la configuración del torneo hasta el cierre con podios y certificados.',
            'Accesible desde el botón 🧭 Guía de la barra superior y desde la sección 📋 Bitácora de Cambios de Configuración.',
            'Correcciones de datos: al guardar un fixture ya existente se actualiza en vez de duplicarse (evita puntos y partidos repetidos).',
            'Los podios por llave ya filtran los puntos por categoría y conservan los integrantes de parejas/equipos, además de mantener la clasificación completa.',
            'La importación de archivos JSON ahora detecta el formato (exportación plana o backup completo) y normaliza los datos al cargar.',
            'Al editar un jugador se muestran las categorías personalizadas y se conservan las ya asignadas.',
            'Se protegen las acciones de alta (lista de espera, forzar alta, fusionar) y los autocompletados contra nombres con caracteres especiales.'
        ]
    },
    {
        version: '1.7',
        date: '2026-08-05',
        title: 'Dobles, equipos y conflictos',
        changes: [
            'Modo pareja/dobles y por equipos: alta de participantes con integrantes (nombre y club de cada uno).',
            'El participante se identifica como "A - B" y conserva su lista de integrantes en fixtures, estadísticas y ranking.',
            'Puntuación específica para dobles/equipos: los puntos, el rating ELO, las estadísticas y el historial se atribuyen a cada integrante.',
            'Validación de conflictos: un jugador no puede estar en dos parejas/equipos, ni en dos participantes del mismo grupo, ni jugar dos partidos a la misma hora.',
            'La programación de mesas (Multiplex) bloquea el horario para todos los integrantes de una pareja/equipo.'
        ]
    },
    {
        version: '1.6',
        date: '2026-08-05',
        title: 'Comunicación y cierre',
        changes: [
            'Difusión WhatsApp: mensaje armado con los podios del día para copiar al portapapeles y compartir.',
            'Certificados de participación para todos los inscritos, incluso sin resultados (antes solo con ganadores).',
            'Resumen del torneo al finalizar: récords (partido más largo y set más cerrado) y MVP por categoría.',
            'Lista de inscripción imprimible con columna "Presente" para el control de la mesa de entrada.'
        ]
    },
    {
        version: '1.5',
        date: '2026-08-05',
        title: 'Estadísticas y Reportes',
        changes: [
            'Gráficos SVG en Estadísticas: participación por categoría, evolución de puntos (top 5) y % de victorias por club.',
            'Historial Cara a Cara (H2H) entre dos jugadores: partidos, sets y ganador de cada cruce.',
            'Rachas y forma reciente: racha actual ganadora/perdedora, mejores rachas y últimos 5 resultados por jugador.',
            'Exportación a PDF con jsPDF (tablas de estadísticas) además de imprimir y Excel.',
            'El export a Excel ahora incluye las hojas de Categorías y Rachas.',
            'Botón "Instalar la App (PWA)" en Configuración: instalar como app para usarla offline en la cancha.',
            'Toggles flotantes de tema (claro/oscuro) y de atajos de teclado, fijos en la esquina superior derecha.'
        ]
    },
    {
        version: '1.4',
        date: '2026-08-05',
        title: 'Jugadores y Rankings',
        changes: [
            'Perfil de jugador: historial de torneos, puntos acumulados y evolución por fecha (gráfico).',
            'Ranking global por club, categoría y torneo en la nueva pestaña 🏆 Ranking, con exportación a CSV.',
            'Rating ELO dinámico: se actualiza automáticamente al cargar resultados (base 1200, K=32) y persiste entre torneos.',
            'Check-in de presencia: marcar presentes/ausentes desde Jugadores y detección de ausentes antes de armar el fixture.',
            'Al finalizar un torneo se registra automáticamente la actuación de cada jugador en su historial.'
        ]
    },
    {
        version: '1.3.b',
        date: '2026-08-04',
        title: 'Datos consistentes + Bitácora',
        changes: [
            'Nombres de jugadores: capitalizados y sin tildes (ej: marcos osorio → Marcos Osorio).',
            'Clubs siempre en mayúsculas (ej: cedeMU → CEDEMU).',
            'Normalización aplicada al cargar la app y en cada alta, edición o importación.',
            'Nueva bitácora de cambios versionada, disponible como pestaña principal 📜 Changelog.',
            'Columna RÉFERI en los fixtures para cargar el nombre del árbitro por partido (también en la impresión).'
        ]
    },
    {
        version: '1.3.a',
        date: '2026-08-03',
        title: 'Torneo en vivo',
        changes: [
            'Playoff de bronce: ronda "Tercer Puesto" en las llaves con los perdedores de semifinales.',
            'Sistema Suizo para categorías con muchos jugadores.',
            'Resultado en vivo: carga de sets desde el Dashboard con el partido en curso resaltado.',
            'Desempates mejorados: enfrentamiento directo, diferencia de sets y puntos a favor.',
            'Exportar backup monolítico (HTML autocontenido) desde Configuración.'
        ]
    },
    {
        version: '1.3',
        date: '2026-08-02',
        title: 'Planificación del torneo',
        changes: [
            'Plantillas de torneo reutilizables.',
            'Límites de inscripción por categoría con lista de espera.',
            'Siembra de grupos por ranking (manual o por puntos).',
            'Programación de partidos en múltiples mesas (Multiplex).'
        ]
    },
    {
        version: '1.2',
        date: '2026-07',
        title: 'Gestión completa de jugadores',
        changes: [
            'Registro y edición de jugadores con detección de duplicados.',
            'Grupos automáticos con siembra y fixtures todos contra todos.',
            'Llaves eliminatorias con carga de resultados y podios.',
            'Certificados, sponsors, alertas y log de actividades.',
            'Deshacer/Rehacer (50 pasos) y respaldo de datos.'
        ]
    }
];

/**
 * Construye el HTML de la bitácora (compartido por pestaña y modal).
 */
function buildChangelogHTML() {
    let html = `
        <div style="color: var(--text-color);">
    `;

    CHANGELOG.forEach(v => {
        html += `
            <div style="margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <span style="background: var(--accent); color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">Ver ${v.version}</span>
                    <strong>${v.title}</strong>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin: 0 0 6px 0;">${v.date}</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.7;">
                    ${v.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>`;
    });

    html += '</div>';
    return html;
}

/**
 * Muestra la bitácora como pestaña principal (panel principal).
 */
window.renderChangelogPage = function() {
    const output = document.getElementById('changelog-output');
    if (!output) return;
    const versionEl = document.getElementById('changelog-current-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    output.innerHTML = `
        <div style="margin-bottom: 15px;">
            <button class="btn btn-info" onclick="showSystemGuide()">🧭 Guía del Sistema</button>
        </div>
    ` + buildChangelogHTML();
};

/**
 * Muestra la bitácora de cambios en un modal.
 */
window.showChangelog = function() {
    showModal('📋 Bitácora de Cambios', buildChangelogHTML(), null);
};

// ==========================================
// GUÍA DEL SISTEMA (funciones y flujo del administrador)
// ==========================================

/**
 * HTML de un módulo plegable de la guía.
 * @param {string} title - Título del módulo
 * @param {string} body - HTML del contenido
 */
function guideModule(title, body) {
    return `
        <details style="margin-bottom: 8px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-alt);">
            <summary style="cursor: pointer; padding: 10px 12px; font-weight: bold; font-size: 13px; color: var(--text-color);">${title}</summary>
            <div style="padding: 4px 14px 12px 14px; font-size: 13px; line-height: 1.7; color: var(--text-color);">
                ${body}
            </div>
        </details>`;
}

/**
 * HTML completo de la guía del sistema: funciones y flujo del administrador.
 */
function buildSystemGuideHTML() {
    const categories = [
        {
            title: '🏗️ 1. Preparación (antes del torneo)',
            hint: 'Definí el torneo y registrá a los participantes.',
            modules: [
                {
                    title: '⚙️ Configuración',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Datos del torneo: nombre, subtítulo, lugar, organizadores y categorías.</li>
                        <li>Plantillas de torneo reutilizables y límites de inscripción por categoría (lista de espera).</li>
                        <li>Sponsors y atajos de teclado.</li>
                    </ul>`
                },
                {
                    title: '👥 Jugadores',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Alta de participantes: <strong>individual</strong>, <strong>pareja/dobles</strong> y <strong>equipo</strong> (con nombre y club de cada integrante). Atajo: Ctrl+Shift+P.</li>
                        <li>Normalización automática de nombres (capitalizados, sin tildes) y clubs (mayúsculas).</li>
                        <li>Detección de duplicados y <strong>validación de conflictos</strong>: una persona no puede estar en dos parejas/equipos.</li>
                        <li>Check-in de presencia (presentes/ausentes) y detección de ausentes antes de armar grupos.</li>
                        <li>Listas por categoría, perfil con historial y gráfico de evolución.</li>
                        <li>Exportar/importar jugadores (Excel y JSON).</li>
                    </ul>`
                }
            ]
        },
        {
            title: '⚔️ 2. Competencia (durante el torneo)',
            hint: 'Armá los grupos, cargá resultados y definí las llaves.',
            modules: [
                {
                    title: '📊 Dashboard',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Resumen del torneo: grupos generados, jugadores registrados, partidos jugados y pendientes.</li>
                        <li>Resultados en vivo: carga de sets directamente desde el Dashboard sin ir al fixture.</li>
                        <li>Alertas automáticas: partidos pendientes, grupos sin resultados, avisos de conflicto.</li>
                    </ul>`
                },
                {
                    title: '⚡ Fixture',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Generación manual de grupos todos contra todos.</li>
                        <li>Generación automática con siembra: aleatoria, por puntos del torneo, por ranking previo (seed) o manual.</li>
                        <li>Sistema Suizo para categorías numerosas (menos partidos, sin repetir rivales).</li>
                        <li>Carga de resultados por partido con validación (sets de 0 a 30, resaltado del ganador).</li>
                        <li>Desempates automáticos: puntos → enfrentamiento directo → diferencia de sets → puntos a favor.</li>
                        <li>Columna RÉFERI por partido (también en la impresión).</li>
                        <li>Impresión del fixture y exportación del resumen a PDF.</li>
                    </ul>`
                },
                {
                    title: '🕒 Programación Multiplex',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Asignación automática de mesa y horario a cada partido del grupo.</li>
                        <li>Sin solapamientos: un jugador nunca juega dos partidos a la misma hora y cada mesa tiene un solo partido por franja.</li>
                        <li>En dobles/equipos se bloquea el horario para <strong>todos los integrantes</strong>.</li>
                        <li>Impresión de la programación (multiplex).</li>
                    </ul>`
                },
                {
                    title: '🏆 Llaves',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Llaves eliminatorias con los clasificados de cada grupo.</li>
                        <li>Playoff de bronce: ronda "Tercer Puesto" con los perdedores de semifinales.</li>
                        <li>Carga de resultados en la llave y definición de podios (medallas 🥇🥈🥉).</li>
                    </ul>`
                }
            ]
        },
        {
            title: '📈 3. Análisis (seguimiento del torneo)',
            hint: 'Estadísticas y rankings en vivo.',
            modules: [
                {
                    title: '📈 Estadísticas',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Estadísticas generales por jugador: partidos ganados, sets ganados/perdidos, diferencia y puntos.</li>
                        <li>Mejores performances, rachas y forma reciente (últimos 5 resultados).</li>
                        <li>Historial cara a cara (H2H) entre dos jugadores.</li>
                        <li>Gráficos SVG: participación por categoría, evolución de puntos y % de victorias por club.</li>
                        <li>Exportación a Excel y PDF.</li>
                    </ul>`
                },
                {
                    title: '🏆 Ranking',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Ranking global ordenado por puntos del torneo o por rating ELO.</li>
                        <li>Filtros por torneo (actual o histórico), categoría y club.</li>
                        <li>Mejor puesto histórico y exportación a CSV.</li>
                        <li>Rating ELO dinámico (base 1200, K=32): se actualiza con cada resultado y persiste entre torneos.</li>
                    </ul>`
                }
            ]
        },
        {
            title: '🎖️ 4. Cierre y mantenimiento (después del torneo)',
            hint: 'Podios, certificados, backups y registros.',
            modules: [
                {
                    title: '🏆 Cierre del Torneo',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Podios por categoría con medallas y desempates completos.</li>
                        <li>MVP por categoría y récords: partido más largo y set más cerrado.</li>
                        <li>Certificados de participación para todos los inscritos.</li>
                        <li>Difusión WhatsApp: mensaje con los podios del día para copiar y compartir.</li>
                        <li>Finalizar torneo: backup automático, historial por jugador y reporte final.</li>
                    </ul>`
                },
                {
                    title: '💾 Backups y App',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Exportar/importar todos los datos (JSON) y crear backup completo.</li>
                        <li>Backup monolítico: HTML autocontenido para guardar y abrir en cualquier PC.</li>
                        <li>PWA: instalar la app para usarla offline en la cancha.</li>
                        <li>Tema claro/oscuro y toggles flotantes en la esquina superior derecha.</li>
                    </ul>`
                },
                {
                    title: '📋 Registro, Changelog y Deshacer',
                    body: `<ul style="margin: 6px 0; padding-left: 20px;">
                        <li>Bitácora de actividades (Registro) con exportación a TXT.</li>
                        <li>Changelog versionado con todas las novedades de cada versión.</li>
                        <li>Deshacer/Rehacer (50 pasos) con atajos Ctrl+Z / Ctrl+Y.</li>
                    </ul>`
                }
            ]
        }
    ];

    let html = `
        <div style="max-height: 68vh; overflow-y: auto; padding-right: 8px; color: var(--text-color);">
            <div class="info-box" style="margin-bottom: 15px;">
                <strong>🧭 ¿Cómo funciona el sistema?</strong><br>
                Este sistema organiza torneos de tenis de mesa de punta a punta: inscripción de participantes,
                generación de fixtures, carga de resultados, llaves eliminatorias, estadísticas, ranking y cierre
                con podios y certificados. A continuación: el flujo recomendado para el administrador y todas las
                funciones agrupadas por fase del torneo.
            </div>

            <h4 style="margin: 0 0 8px 0; color: var(--text-color);">🛠️ Flujo recomendado para el administrador</h4>
            <ol style="margin: 0 0 20px 0; padding-left: 22px; font-size: 13px; line-height: 1.9;">
                <li><strong>Configurar el torneo</strong> → pestaña ⚙️ Configuración: nombre del torneo, subtítulo y categorías (agregá DOBLES/equipos si se juegan). Creá plantillas y límites de inscripción si hace falta.</li>
                <li><strong>Registrar participantes</strong> → pestaña 👥 Jugadores: cargá individuales, parejas y equipos. El sistema normaliza nombres/clubs, detecta duplicados y evita que una persona esté en dos parejas/equipos.</li>
                <li><strong>Check-in de presencia</strong> → pestaña 👥: marcá presentes/ausentes. Los ausentes se excluyen de la generación automática de grupos.</li>
                <li><strong>Generar fixtures</strong> → pestaña ⚡ Fixture: elegí categoría, formato (todos contra todos o suizo), tamaño de grupo y método de siembra. La generación automática distribuye a los participantes y crea los grupos.</li>
                <li><strong>Cargar resultados</strong> → pestaña ⚡ Fixture (partido por partido) o 📊 Dashboard (resultados en vivo). El sistema valida los sets, calcula puntos y posiciones, y actualiza el rating ELO.</li>
                <li><strong>Programar mesas</strong> (opcional) → ⚡ Fixture → Programación Multiplex: horarios y mesas sin solapamientos, incluso para dobles/equipos.</li>
                <li><strong>Llaves eliminatorias</strong> → pestaña 🏆 Llaves: generá la llave cuando los grupos estén completos y cargá resultados hasta definir el podio.</li>
                <li><strong>Revisar estadísticas y ranking</strong> → pestañas 📈 Estadísticas y 🏆 Ranking para el seguimiento en vivo del torneo.</li>
                <li><strong>Cerrar el torneo</strong> → pestaña ⚙️ Configuración → Finalizar Torneo: podios, MVP, récords, certificados, difusión por WhatsApp y backup automático.</li>
            </ol>

            <h4 style="margin: 0 0 8px 0; color: var(--text-color);">📚 Funciones del sistema por módulo</h4>
            <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
                Índice: 🏗️ Preparación · ⚔️ Competencia · 📈 Análisis · 🎖️ Cierre y mantenimiento
            </div>
            <div style="margin-bottom: 10px;">
                ${categories.map(c => `
                    <div style="margin-bottom: 18px;">
                        <div style="font-weight: bold; font-size: 14px; color: var(--text-color); margin: 0 0 2px 0;">${c.title}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin: 0 0 8px 0;">${c.hint}</div>
                        ${c.modules.map(m => guideModule(m.title, m.body)).join('')}
                    </div>
                `).join('')}
            </div>

            <div class="warn-box" style="margin-top: 12px;">
                <strong>💡 Regla de oro:</strong> el sistema valida conflictos automáticamente: una persona no puede
                estar en dos parejas/equipos, ni en dos participantes del mismo grupo, ni jugar dos partidos a la
                misma hora. Si algo no se guarda, leé el aviso que aparece en pantalla.
            </div>
        </div>
    `;
    return html;
}

/**
 * Muestra el modal de sumario del sistema (funciones + flujo del administrador).
 */
window.showSystemGuide = function() {
    showModal('🧭 Guía del Sistema', buildSystemGuideHTML(), null);
};

