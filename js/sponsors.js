// ==========================================
// SPONSORS.JS - Gestión de patrocinadores
// ==========================================

// Cargar lista de patrocinadores
window.loadPatrocinadoresList = function() {
    const container = document.getElementById('patrocinadores-list');
    if (!container) return;

    const patrocinadores = tournamentData.settings.patrocinadores || [];

    if (patrocinadores.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic; text-align: center; padding: 20px;">No hay patrocinadores agregados aún.</p>';
        return;
    }

    let html = '';
    patrocinadores.forEach((pat, index) => {
        html += `
            <div style="background: var(--header-bg); border: 2px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 15px; display: grid; grid-template-columns: 100px 1fr auto; gap: 15px; align-items: center;">
                <div style="width: 100px; height: 100px; border: 2px dashed var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--surface-alt);">
                    ${pat.logo ? `<img src="${escAttr(pat.logo)}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<span style="color: var(--text-muted); font-size: 12px; text-align: center;">Sin logo</span>'}
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 16px; color: var(--text-color); margin-bottom: 5px;">${escHtml(pat.nombre)}</div>
                    <div style="font-size: 13px; color: var(--text-muted);">${pat.logo ? '✅ Logo cargado' : '⚠️ Sin logo'}</div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-info" style="padding: 8px 12px; font-size: 13px;" onclick="editPatrocinador(${index})">✏️ Editar</button>
                    <button class="btn btn-danger" style="padding: 8px 12px; font-size: 13px;" onclick="deletePatrocinador(${index})">🗑️</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

// Agregar patrocinador
window.addPatrocinador = function() {
    if (!tournamentData.settings.patrocinadores) {
        tournamentData.settings.patrocinadores = [];
    }

    if (tournamentData.settings.patrocinadores.length >= 5) {
        showToast('Máximo 5 patrocinadores permitidos', 'warning');
        return;
    }

    showModal(
        '➕ Agregar Patrocinador',
        `<div style="color: var(--text-color);">
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre del Patrocinador:</label>
                <input type="text" id="pat-nombre" placeholder="Ej: Coca-Cola" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>

            <div class="form-group">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Logo (opcional):</label>
                <input type="file" id="pat-logo" accept="image/*" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                <small style="color: var(--text-muted); font-size: 12px; display: block; margin-top: 5px;">Formatos aceptados: JPG, PNG, GIF. Tamaño recomendado: 200x200px</small>
            </div>

            <div id="logo-preview" style="margin-top: 15px; text-align: center;"></div>
        </div>`,
        () => {
            executeAddPatrocinador();
        }
    );

    // Preview de imagen
    setTimeout(() => {
        const fileInput = document.getElementById('pat-logo');
        if (fileInput) {
            fileInput.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        document.getElementById('logo-preview').innerHTML = `
                            <div style="padding: 10px; background: var(--surface-alt); border: 2px solid var(--border-color); border-radius: 8px; display: inline-block;">
                                <img src="${event.target.result}" style="max-width: 150px; max-height: 150px; object-fit: contain;">
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
    }, 100);
};

function executeAddPatrocinador() {
    const nombre = document.getElementById('pat-nombre').value.trim();
    const logoInput = document.getElementById('pat-logo');

    if (!nombre) {
        showToast('Por favor ingresa el nombre del patrocinador', 'error');
        return;
    }

    if (logoInput && logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tournamentData.settings.patrocinadores.push({
                nombre: nombre,
                logo: e.target.result
            });
            saveTournamentData();
            loadPatrocinadoresList();
            showToast('Patrocinador agregado correctamente');
            addLog('PATROCINADOR', `Agregado: ${nombre}`);
        };
        reader.readAsDataURL(logoInput.files[0]);
    } else {
        tournamentData.settings.patrocinadores.push({
            nombre: nombre,
            logo: null
        });
        saveTournamentData();
        loadPatrocinadoresList();
        showToast('Patrocinador agregado correctamente');
        addLog('PATROCINADOR', `Agregado: ${nombre}`);
    }
}

// Editar patrocinador
window.editPatrocinador = function(index) {
    const pat = tournamentData.settings.patrocinadores[index];

    showModal(
        '✏️ Editar Patrocinador',
        `<div style="color: var(--text-color);">
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre del Patrocinador:</label>
                <input type="text" id="pat-nombre-edit" value="${escAttr(pat.nombre)}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>

            ${pat.logo ? `
                <div style="margin-bottom: 15px; text-align: center;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Logo Actual:</label>
                    <div style="padding: 10px; background: var(--surface-alt); border: 2px solid var(--border-color); border-radius: 8px; display: inline-block;">
                        <img src="${escAttr(pat.logo)}" style="max-width: 150px; max-height: 150px; object-fit: contain;">
                    </div>
                </div>
            ` : ''}

            <div class="form-group">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Cambiar Logo (opcional):</label>
                <input type="file" id="pat-logo-edit" accept="image/*" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>

            <div id="logo-preview-edit" style="margin-top: 15px; text-align: center;"></div>
        </div>`,
        () => {
            executeEditPatrocinador(index);
        }
    );

    // Preview de imagen
    setTimeout(() => {
        const fileInput = document.getElementById('pat-logo-edit');
        if (fileInput) {
            fileInput.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        document.getElementById('logo-preview-edit').innerHTML = `
                            <div style="padding: 10px; background: var(--surface-alt); border: 2px solid var(--border-color); border-radius: 8px; display: inline-block;">
                                <img src="${event.target.result}" style="max-width: 150px; max-height: 150px; object-fit: contain;">
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
    }, 100);
};

function executeEditPatrocinador(index) {
    const nombre = document.getElementById('pat-nombre-edit').value.trim();
    const logoInput = document.getElementById('pat-logo-edit');

    if (!nombre) {
        showToast('Por favor ingresa el nombre del patrocinador', 'error');
        return;
    }

    if (logoInput && logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tournamentData.settings.patrocinadores[index] = {
                nombre: nombre,
                logo: e.target.result
            };
            saveTournamentData();
            loadPatrocinadoresList();
            showToast('Patrocinador actualizado correctamente');
            addLog('PATROCINADOR', `Editado: ${nombre}`);
        };
        reader.readAsDataURL(logoInput.files[0]);
    } else {
        tournamentData.settings.patrocinadores[index].nombre = nombre;
        saveTournamentData();
        loadPatrocinadoresList();
        showToast('Patrocinador actualizado correctamente');
        addLog('PATROCINADOR', `Editado: ${nombre}`);
    }
}

// Eliminar patrocinador
window.deletePatrocinador = function(index) {
    const pat = tournamentData.settings.patrocinadores[index];

    showModal(
        '⚠️ ¿Eliminar Patrocinador?',
        `<p style="color: var(--text-color);">¿Estás seguro de que deseas eliminar a <strong>${escHtml(pat.nombre)}</strong>?</p>`,
        () => {
            tournamentData.settings.patrocinadores.splice(index, 1);
            saveTournamentData();
            loadPatrocinadoresList();
            showToast('Patrocinador eliminado');
            addLog('PATROCINADOR', `Eliminado: ${pat.nombre}`);
        }
    );
};
