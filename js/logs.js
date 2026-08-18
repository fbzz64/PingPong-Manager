// ==========================================
// LOGS.JS - Sistema de registro de actividades
// ==========================================

// Agregar entrada al registro
window.addLog = function(action, description) {
    try {
        const log = {
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleString(window.i18nLocale()),
            action,
            description
        };
        tournamentData.logs.push(log);
        saveTournamentData();
    } catch (error) {
        console.error('Error al agregar log:', error);
    }
};

// Mostrar registros
window.showLogs = function() {
    const output = document.getElementById('logs-output');

    if (!tournamentData.logs || tournamentData.logs.length === 0) {
        output.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">' + t('No hay registros aún.') + '</p>';
        return;
    }

    let html = '<table class="data-table"><tr><th>' + t('Fecha y Hora') + '</th><th>' + t('Acción') + '</th><th>' + t('Descripción') + '</th></tr>';

    const sortedLogs = [...tournamentData.logs].reverse();
    sortedLogs.forEach(log => {
        html += `
            <tr>
                <td>${log.date}</td>
                <td><strong>${escHtml(log.action)}</strong></td>
                <td>${escHtml(log.description)}</td>
            </tr>
        `;
    });

    html += '</table>';
    output.innerHTML = html;
};

// Exportar registros a archivo TXT
window.exportLogs = function() {
    if (!tournamentData.logs || tournamentData.logs.length === 0) {
        showToast(t('No hay registros para exportar'), 'warning');
        return;
    }

    try {
        let content = '=== BITÁCORA DE PINGPONG MANAGER ===\n\n';
        content += t('Generado:') + ` ${new Date().toLocaleString(window.i18nLocale())}\n`;
        content += t('Total de registros:') + ` ${tournamentData.logs.length}\n\n`;
        content += '='.repeat(70) + '\n\n';

        tournamentData.logs.forEach((log, idx) => {
            content += `[${idx + 1}] ${log.date}\n`;
            content += t('Acción:') + ` ${log.action}\n`;
            content += t('Descripción:') + ` ${log.description}\n`;
            content += '-'.repeat(70) + '\n\n';
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Registro_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('Registro exportado correctamente'));
        addLog('EXPORTAR', t('Registro exportado a archivo TXT'));
    } catch (error) {
        console.error('Error al exportar logs:', error);
        showToast(t('Error al exportar registros'), 'error');
    }
};

// Limpiar registros
window.clearLogs = function() {
    showModal(
        t('⚠️ ¿Limpiar Registro?'),
        '<p style="color: var(--text-color);">' + t('¿Estás seguro de que deseas eliminar todos los registros de la bitácora?') + '</p><p style="color: var(--danger); font-weight: bold;">' + t('Esta acción NO se puede deshacer.') + '</p>',
        () => {
            try {
                tournamentData.logs = [];
                saveTournamentData();
                showLogs();
                showToast(t('Registro limpiado'));
            } catch (error) {
                console.error('Error al limpiar logs:', error);
                showToast(t('Error al limpiar registros'), 'error');
            }
        }
    );
};
