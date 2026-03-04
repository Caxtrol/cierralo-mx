// ═══════════════════════════════════════════════════════════
// TABS.JS — Modal detalle: tabs etapa/auto/editar, asignar auto
// Depende de: config.js, crm.js
// ═══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════
// TABS DEL MODAL DETALLE + ASIGNAR AUTO + EDITAR
// ══════════════════════════════════════════════════

function switchDetTab(tab){
  // Activar tab
  ['etapa','auto','editar'].forEach(t => {
    document.getElementById('tab-'+t)?.classList.toggle('active', t === tab);
    const panel = document.getElementById('detpanel-'+t);
    if(panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  if(tab === 'auto') renderAutosParaProspecto();
  if(tab === 'editar') rellenarFormEdicion();
}

// ── TAB AUTO: mostrar inventario disponible ──
function renderAutosParaProspecto(){
  const lista = document.getElementById('det-autos-lista');
  if(!lista) return;
  const disponibles = autos.filter(a => a.estado === 'disponible');
  if(disponibles.length === 0){
    lista.innerHTML = `<div style="text-align:center;padding:20px;background:var(--s2);border-radius:var(--rs);">
      <div style="font-size:28px;margin-bottom:6px;">🚗</div>
      <div style="font-size:13px;font-weight:600;color:var(--text);">Sin autos disponibles</div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;">Agrega unidades en la sección Stock.</div>
    </div>`;
    return;
  }
  lista.innerHTML = '';
  // Marcar el auto actualmente asignado
  const autoActual = prospectoActual?.auto_interes?.toLowerCase() || '';
  disponibles.forEach(a => {
    const nombre = `${a.marca} ${a.modelo} ${a.anio}${a.version ? ' '+a.version : ''}`;
    const esActual = autoActual && nombre.toLowerCase().includes(autoActual) || autoActual.includes(a.modelo.toLowerCase());
    const div = document.createElement('div');
    div.className = 'det-auto-opt' + (esActual ? ' selected' : '');
    div.innerHTML = `
      <div style="font-size:26px;">🚗</div>
      <div style="flex:1;min-width:0;">
        <div class="dao-name">${nombre}</div>
        <div class="dao-price">${fmtPeso(a.precio_lista)}${a.mensualidad_min ? ' · desde '+fmtPeso(a.mensualidad_min)+'/mes' : ''}</div>
        <div class="dao-detail">${[a.color, a.estado].filter(Boolean).join(' · ')}${a.equipamiento ? ' · '+a.equipamiento.split(',')[0] : ''}</div>
      </div>
      ${esActual ? '<div class="badge bg2" style="flex-shrink:0;font-size:9px;">Actual</div>' : '<div style="color:var(--text4);flex-shrink:0;">›</div>'}`;
    div.onclick = () => asignarAutoAProspecto(a, nombre, div);
    lista.appendChild(div);
  });
}

async function asignarAutoAProspecto(auto, nombreAuto, divEl){
  if(!prospectoActual) return;

  // 1. Si el prospecto ya tenia un auto apartado, liberarlo primero
  if(prospectoActual.auto_id_asignado && prospectoActual.auto_id_asignado !== auto.id){
    await sb.from('autos')
      .update({ estado: 'disponible', prospecto_id: null })
      .eq('id', prospectoActual.auto_id_asignado);
  }

  // 2. Marcar el auto nuevo como apartado
  const { error: errAuto } = await sb.from('autos')
    .update({ estado: 'apartado', prospecto_id: prospectoActual.id })
    .eq('id', auto.id);
  if(errAuto){ showToast('Error al apartar auto: '+errAuto.message); return; }

  // 3. Actualizar el prospecto con nombre e id del auto
  const { error: errProspecto } = await sb.from('prospectos')
    .update({ auto_interes: nombreAuto, auto_id_asignado: auto.id })
    .eq('id', prospectoActual.id);
  if(errProspecto){ showToast('Error: '+errProspecto.message); return; }

  // 4. Actualizar en memoria
  prospectoActual.auto_interes = nombreAuto;
  prospectoActual.auto_id_asignado = auto.id;
  const idx = prospectos.findIndex(p => p.id === prospectoActual.id);
  if(idx !== -1){
    prospectos[idx].auto_interes = nombreAuto;
    prospectos[idx].auto_id_asignado = auto.id;
  }

  // 5. Feedback visual
  document.querySelectorAll('.det-auto-opt').forEach(d => d.classList.remove('selected'));
  divEl.classList.add('selected');
  document.getElementById('det-sub').textContent = nombreAuto + (prospectoActual.fuente ? ' · '+prospectoActual.fuente : '');
  showToast('Auto apartado: '+nombreAuto);

  // 6. Recargar kanban e inventario
  await cargarProspectos();
  await cargarAutos();
}

// ── TAB EDITAR: rellenar formulario con datos actuales ──
function rellenarFormEdicion(){
  if(!prospectoActual) return;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  set('edit-nombre', prospectoActual.nombre);
  set('edit-tel', prospectoActual.telefono);
  set('edit-presupuesto', prospectoActual.presupuesto);
  set('edit-auto', prospectoActual.auto_interes);
  set('edit-notas', prospectoActual.notas);
}

async function guardarEdicionProspecto(){
  if(!prospectoActual) return;
  const nombre = document.getElementById('edit-nombre').value.trim();
  if(!nombre){ showToast('⚠️ El nombre es obligatorio'); return; }
  const cambios = {
    nombre,
    telefono: document.getElementById('edit-tel').value.trim() || null,
    presupuesto: parseInt(document.getElementById('edit-presupuesto').value) || null,
    auto_interes: document.getElementById('edit-auto').value.trim() || null,
    notas: document.getElementById('edit-notas').value.trim() || null,
  };
  const btn = document.querySelector('#detpanel-editar .btn-p');
  if(btn){ btn.textContent = 'Guardando...'; btn.disabled = true; }
  const {error} = await sb.from('prospectos').update(cambios).eq('id', prospectoActual.id);
  if(btn){ btn.textContent = '💾 Guardar cambios'; btn.disabled = false; }
  if(error){ showToast('❌ Error: '+error.message); return; }
  // Actualizar en memoria y modal
  Object.assign(prospectoActual, cambios);
  const idx = prospectos.findIndex(p => p.id === prospectoActual.id);
  if(idx !== -1) Object.assign(prospectos[idx], cambios);
  document.getElementById('det-nombre').textContent = nombre;
  document.getElementById('det-sub').textContent = (cambios.auto_interes||'Sin auto') + (prospectoActual.fuente ? ' · '+prospectoActual.fuente : '');
  // Regenerar det-info
  const etapa = ETAPAS[prospectoActual.etapa] || ETAPAS.nuevo;
  document.getElementById('det-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">TELÉFONO</div><div style="font-size:13px;font-weight:600;">${cambios.telefono||'—'}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">PRESUPUESTO</div><div style="font-size:13px;font-weight:600;">${fmtPeso(cambios.presupuesto)}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">ETAPA ACTUAL</div><div data-etapa="1" style="font-size:13px;font-weight:600;color:${etapa.color};">${etapa.icon} ${etapa.label}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">REGISTRADO</div><div style="font-size:13px;font-weight:600;">${new Date(prospectoActual.created_at).toLocaleDateString('es-MX')}</div></div>
      ${cambios.notas ? '<div style="grid-column:1/-1;"><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">NOTAS</div><div style="font-size:12px;color:var(--text2);">'+cambios.notas+'</div></div>' : ''}
    </div>`;
  showToast('✅ Datos actualizados');
  renderKanban();
}

// Al abrir modal — reset tabs al primero
const _origAbrirDetalle = window.abrirDetalle;
window.abrirDetalle = function(p){
  if(_origAbrirDetalle) _origAbrirDetalle(p);
  // Reset a tab Etapa
  switchDetTab('etapa');
};
