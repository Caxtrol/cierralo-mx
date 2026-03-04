// ═══════════════════════════════════════════════════════════
// CRM.JS — Prospectos, Kanban, Inventario, Modales
// Depende de: config.js
// ═══════════════════════════════════════════════════════════






// ── CARGAR PROSPECTOS ──

async function cargarProspectos(forzarUserId){
  const uid = forzarUserId || currentUser?.id;
  if(!uid){ console.warn('cargarProspectos: sin usuario'); return; }
  const {data, error} = await sbAuth().from('prospectos')
    .select('*')
    .eq('vendedor_id', uid)
    .order('created_at', {ascending: false});

  if(error){ console.error(error); return; }
  prospectos = data || [];
  renderKanban();
  if(typeof actualizarDashboard === 'function') actualizarDashboard();
  else actualizarStatsDash();
}

function renderKanban(){
  const etapasKanban = ['nuevo','contactado','cotizacion','prueba','tramite','ganado','perdido'];
  const conteos = {};
  etapasKanban.forEach(e => {
    conteos[e] = 0;
    const container = document.getElementById('cards-'+e);
    if(container) container.innerHTML = '';
  });

  prospectos.forEach(p => {
    const etapa = p.etapa || 'nuevo';
    if(!etapasKanban.includes(etapa)) return;
    conteos[etapa] = (conteos[etapa]||0) + 1;
    const container = document.getElementById('cards-'+etapa);
    if(!container) return;
    const temp = calcTemp(p);
    const card = document.createElement('div');
    card.className = 'prospect-card-full';
    card.onclick = () => abrirDetalle(p);
    card.innerHTML = `
      <div class="prospect-name">${safe(p.nombre)}</div>
      <div class="prospect-auto">${safe(p.auto_interes) || 'Sin auto definido'} ${p.presupuesto ? '· '+fmtPeso(p.presupuesto) : ''}</div>
      <div class="prospect-footer">
        <div style="display:flex;align-items:center;gap:4px;">
          <div class="thermo-bar"><div class="thermo-fill" style="width:${temp}%;background:${tempColor(temp)};"></div></div>
          <div class="thermo-val" style="color:${tempColor(temp)};">${temp}°</div>
        </div>
        <div class="badge" style="background:${ETAPAS[etapa]?.bg||'var(--s3)'};color:${ETAPAS[etapa]?.color||'var(--text3)'};border:none;font-size:9px;">${p.fuente||'visita'}</div>
      </div>`;
    container.appendChild(card);
  });

  etapasKanban.forEach(e => {
    const cnt = document.getElementById('cnt-'+e);
    if(cnt) cnt.textContent = conteos[e] || 0;
  });

  const sub = document.getElementById('scr-prospectos-sub');
  if(sub) sub.textContent = prospectos.length === 0
    ? 'Agrega tu primer prospecto con el botón de abajo'
    : prospectos.length + ' prospectos · desliza para ver todas las etapas';
}

function actualizarStatsDash(){
  const total = prospectos.filter(p => p.etapa !== 'perdido').length;
  const calientes = prospectos.filter(p => calcTemp(p) >= 60).length;
  const ganados = prospectos.filter(p => p.etapa === 'ganado').length;
  const el = id => document.getElementById(id);
  if(el('stat-prospectos')) el('stat-prospectos').textContent = total;
  if(el('stat-calientes')) el('stat-calientes').textContent = calientes;
  if(el('stat-ganados')) el('stat-ganados').textContent = ganados;
  const meta = vendedorData?.meta_mensual || 10;
  const pct = Math.min(Math.round((ganados/meta)*100),100);
  if(el('dash-meta')) el('dash-meta').textContent = meta;
  const fill = document.querySelector('.progress-fill');
  if(fill) fill.style.width = pct+'%';
  const lbl = document.querySelector('.meta-val');
  if(lbl) lbl.innerHTML = ganados+' / <span id="dash-meta">'+meta+'</span>';
}

// ── MODAL PROSPECTO ──

function abrirModalProspecto(){
  ['p-nombre','p-tel','p-auto','p-notas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  const presup = document.getElementById('p-presupuesto');
  if(presup) presup.value = '';
  document.getElementById('dedup-warning').style.display = 'none';
  duplicadoEncontrado = null;
  document.getElementById('modal-prospecto').classList.add('open');
}

async function checkDuplicado(){
  const telRaw = document.getElementById('p-tel').value.trim();
  const tel = telRaw.replace(/[^0-9]/g,'');
  if(tel.length < 8){ document.getElementById('dedup-warning').style.display='none'; return; }
  const ultimos8 = tel.slice(-8);
  const existente = prospectos.find(p => {
    if(!p.telefono) return false;
    const t = p.telefono.replace(/[^0-9]/g,'');
    return t.slice(-8) === ultimos8;
  });
  if(existente){
    duplicadoEncontrado = existente;
    const etapaDup = ETAPAS[existente.etapa] || ETAPAS.nuevo;
    document.getElementById('dedup-compare').innerHTML =
      `<div class="dedup-profile"><div class="dedup-name">${safe(existente.nombre)}</div><div class="dedup-detail">📱 ${safe(existente.telefono)||'—'}<br>${safe(existente.auto_interes)||'—'}<br><span style="color:${etapaDup.color};">${etapaDup.label}</span></div></div>` +
      `<div class="dedup-profile"><div class="dedup-name">${document.getElementById('p-nombre').value||'Nuevo'}</div><div class="dedup-detail">📱 ${telRaw}<br><span style="color:var(--yellow);">Nuevo registro</span></div></div>`;
    document.getElementById('dedup-reason').textContent = '🔍 Mismo teléfono — ¿Es la misma persona?';
    document.getElementById('dedup-warning').style.display = 'block';
  } else {
    document.getElementById('dedup-warning').style.display = 'none';
    duplicadoEncontrado = null;
  }
}


function confirmarDuplicado(){
  if(duplicadoEncontrado) abrirDetalle(duplicadoEncontrado);
  cerrarModal('modal-prospecto');
}

function ignorarDuplicado(){
  document.getElementById('dedup-warning').style.display = 'none';
  duplicadoEncontrado = null;
}

async function guardarProspecto(){
  const nombre = document.getElementById('p-nombre').value.trim();
  if(!nombre){ showToast('⚠️ El nombre es obligatorio'); return; }

  // ── Verificar límite de plan gratis ──
  if(typeof verificarLimiteProspectos === 'function') {
    const limite = await verificarLimiteProspectos();
    if(!limite.puede) {
      // Cerrar modal actual y mostrar upgrade
      const modalProsp = document.getElementById('modal-nuevo-prospecto');
      if(modalProsp) modalProsp.remove();
      mostrarPantallaPlanesUpgrade('limite_prospectos');
      return;
    }
    if(limite.advertencia) {
      mostrarAdvertenciaLimite(limite.usados, limite.limite);
    }
  }
  const btn = document.getElementById('btn-guardar-prospecto');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  // Capturar uid localmente — currentUser puede volverse null durante await por SIGNED_OUT de Supabase
  const uid = currentUser?.id || window._currentUid;
  if(!uid){ showToast('❌ Sesión expirada. Cierra y vuelve a abrir la app.'); btn.textContent='Guardar prospecto →'; btn.disabled=false; return; }
  const datos = {
    vendedor_id: uid,
    nombre,
    telefono: document.getElementById('p-tel').value.trim() || null,
    auto_interes: document.getElementById('p-auto').value.trim() || null,
    presupuesto: parseInt(document.getElementById('p-presupuesto').value) || null,
    fuente: document.getElementById('p-fuente').value,
    etapa: document.getElementById('p-etapa').value,
    notas: document.getElementById('p-notas').value.trim() || null,
    temperatura: 15,
    ultimo_contacto: new Date().toISOString()
  };
  const {error} = await sbAuth().from('prospectos').insert(datos);
  if(error){ showToast('❌ Error: '+error.message); btn.textContent='Guardar prospecto →'; btn.disabled=false; return; }
  btn.textContent = 'Guardar prospecto →'; btn.disabled = false;
  cerrarModal('modal-prospecto');
  showToast('✅ Prospecto guardado');
  await cargarProspectos(window._currentUid);
}

function abrirDetalle(p){
  prospectoActual = p;
  const temp = calcTemp(p);
  const iniciales = p.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  const etapa = ETAPAS[p.etapa] || ETAPAS.nuevo;
  document.getElementById('det-avatar').textContent = iniciales;
  document.getElementById('det-avatar').style.background = etapa.bg;
  document.getElementById('det-avatar').style.color = etapa.color;
  document.getElementById('det-nombre').textContent = p.nombre;
  document.getElementById('det-sub').textContent = (p.auto_interes||'Sin auto') + (p.fuente ? ' · '+p.fuente : '');
  document.getElementById('det-thermo').textContent = tempEmoji(temp)+' '+temp+'°';
  document.getElementById('det-thermo').style.color = tempColor(temp);
  document.getElementById('det-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">TELÉFONO</div><div style="font-size:13px;font-weight:600;">${p.telefono||'—'}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">PRESUPUESTO</div><div style="font-size:13px;font-weight:600;">${fmtPeso(p.presupuesto)}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">ETAPA ACTUAL</div><div data-etapa="1" style="font-size:13px;font-weight:600;color:${etapa.color};">${etapa.icon} ${etapa.label}</div></div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">REGISTRADO</div><div style="font-size:13px;font-weight:600;">${new Date(p.created_at).toLocaleDateString('es-MX')}</div></div>
      ${p.notas ? '<div style="grid-column:1/-1;"><div style="font-size:10px;color:var(--text3);margin-bottom:2px;">NOTAS</div><div style="font-size:12px;color:var(--text2);">'+p.notas+'</div></div>' : ''}
    </div>`;
  const etapaBtns = document.getElementById('etapa-btns');
  etapaBtns.innerHTML = '';
  ['nuevo','contactado','cotizacion','prueba','tramite','ganado','perdido'].forEach(e => {
    const cfg = ETAPAS[e];
    const div = document.createElement('div');
    div.className = 'etapa-opt' + (p.etapa === e ? ' sel' : '');
    div.onclick = function(){ cambiarEtapa(e, this); };
    div.innerHTML = `<div class="etapa-opt-icon">${cfg.icon}</div><div class="etapa-opt-name">${cfg.label}</div>`;
    etapaBtns.appendChild(div);
  });
  document.getElementById('modal-detalle').classList.add('open');
}

async function cambiarEtapa(nuevaEtapa, btnEl){
  if(!prospectoActual) return;
  const {error} = await sbAuth().from('prospectos')
    .update({etapa: nuevaEtapa, ultimo_contacto: new Date().toISOString()})
    .eq('id', prospectoActual.id);
  if(error){ showToast('❌ Error: '+error.message); return; }
  prospectoActual.etapa = nuevaEtapa;

  // Si se marca como GANADO: generar token de reseña de un solo uso + auto a vendido
  if(nuevaEtapa === 'ganado'){
    // Generar token único para que el cliente deje su reseña
    // Este token expira en 30 días y solo puede usarse una vez
    const tokenResena = crypto.randomUUID();
    const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sbAuth().from('prospectos').update({
      token_resena:         tokenResena,
      token_resena_usado:   false,
      token_resena_expira:  expira,
    }).eq('id', prospectoActual.id);
    prospectoActual.token_resena = tokenResena;
    prospectoActual.token_resena_usado = false;
    // Mostrar toast con acción rápida
    showToast('🎉 ¡Venta registrada! Toca ⭐ Pedir reseña para mandársela al cliente');
  }

  if(nuevaEtapa === 'ganado' && prospectoActual.auto_id_asignado){
    await sbAuth().from('autos')
      .update({ estado: 'vendido', prospecto_id: null })
      .eq('id', prospectoActual.auto_id_asignado);
    prospectoActual.auto_id_asignado = null;
  }

  // Si se marca como PERDIDO: el auto vuelve a disponible
  if(nuevaEtapa === 'perdido' && prospectoActual.auto_id_asignado){
    await sbAuth().from('autos')
      .update({ estado: 'disponible', prospecto_id: null })
      .eq('id', prospectoActual.auto_id_asignado);
    prospectoActual.auto_id_asignado = null;
  }

  document.querySelectorAll('.etapa-opt').forEach(el => el.classList.remove('sel'));
  if(btnEl) btnEl.classList.add('sel');
  const etapa = ETAPAS[nuevaEtapa];
  document.getElementById('det-avatar').style.background = etapa.bg;
  document.getElementById('det-avatar').style.color = etapa.color;
  const etapaCell = document.querySelector('[data-etapa="1"]');
  if(etapaCell){ etapaCell.style.color = etapa.color; etapaCell.textContent = etapa.icon+' '+etapa.label; }
  showToast('✅ Movido a '+etapa.label);
  await cargarProspectos(window._currentUid);
  await cargarAutos(window._currentUid);
}

async function eliminarProspecto(){
  if(!prospectoActual) return;
  if(!confirm('¿Eliminar a '+prospectoActual.nombre+'? Esta acción no se puede deshacer.')) return;
  const {error} = await sbAuth().from('prospectos').delete().eq('id', prospectoActual.id);
  if(error){ showToast('❌ Error: '+error.message); return; }
  cerrarModal('modal-detalle');
  showToast('🗑️ Prospecto eliminado');
  await cargarProspectos(window._currentUid);
}


async function cargarAutos(forzarUserId){
  const uid = forzarUserId || currentUser?.id;
  if(!uid){ console.warn('cargarAutos: sin usuario'); return; }
  const {data, error} = await sbAuth().from('autos')
    .select('*')
    .eq('vendedor_id', uid)
    .order('created_at', {ascending: false});
  if(error){ console.error(error); return; }
  autos = data || [];
  renderAutos();
}

function renderAutos(){
  const lista = document.getElementById('lista-autos');
  const hoy = new Date();
  const disponibles = autos.filter(a => a.estado === 'disponible').length;
  const apartados = autos.filter(a => a.estado === 'apartado').length;
  const riesgo = autos.filter(a => {
    if(a.estado !== 'disponible') return false;
    return Math.floor((hoy - new Date(a.created_at)) / 86400000) >= 21;
  }).length;
  const d = id => document.getElementById(id);
  if(d('inv-disponibles')) d('inv-disponibles').textContent = disponibles;
  if(d('inv-apartados')) d('inv-apartados').textContent = apartados;
  if(d('inv-riesgo')) d('inv-riesgo').textContent = riesgo;
  if(d('inv-sub')) d('inv-sub').textContent = autos.length === 0
    ? 'Agrega tu primer auto con el botón de arriba'
    : autos.length + ' unidades en tu inventario';
  if(!lista) return;
  if(autos.length === 0){
    lista.innerHTML = `<div style="padding:0 16px;"><div style="background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;"><div style="font-size:40px;margin-bottom:10px;">🚗</div><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:6px;">Sin autos aún</div><div style="font-size:13px;color:var(--text2);line-height:1.5;">Toca "+ Agregar auto" para registrar tu primera unidad.</div></div></div>`;
    return;
  }
  lista.innerHTML = '';
  autos.forEach(a => {
    const dias = Math.floor((hoy - new Date(a.created_at)) / 86400000);
    const enRiesgo = a.estado === 'disponible' && dias >= 21;
    const card = document.createElement('div');
    card.className = 'car-card-real';
    const estadoColor = a.estado==='disponible' ? 'var(--green)' : a.estado==='apartado' ? 'var(--yellow)' : 'var(--red)';
    const estadoBg = a.estado==='disponible' ? 'var(--greenBg)' : a.estado==='apartado' ? 'var(--yellowBg)' : 'var(--redBg)';
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">
        <div><div class="car-name">${a.marca} ${a.modelo} ${a.anio}</div><div class="car-sub-txt">${[a.version,a.color].filter(Boolean).join(' · ')||'—'}</div></div>
        <div style="text-align:right;"><div class="car-price">${fmtPeso(a.precio_lista)}</div>${a.mensualidad_min?'<div class="car-fin">desde '+fmtPeso(a.mensualidad_min)+'/mes</div>':''}</div>
      </div>
      <div class="car-tags">
        <div class="badge" style="background:${estadoBg};color:${estadoColor};border:none;">${a.estado}</div>
        ${enRiesgo?'<div class="badge br">⚠️ '+dias+' días en stock</div>':''}
        ${a.equipamiento?a.equipamiento.split(',').slice(0,2).map(e=>'<div class="badge bb">'+e.trim()+'</div>').join(''):''}
      </div>`;
    lista.appendChild(card);
  });
}

function abrirModalAuto(){
  ['a-marca','a-modelo','a-version','a-color','a-equip'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['a-precio','a-mensualidad'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('a-anio').value = new Date().getFullYear();
  document.getElementById('modal-auto').classList.add('open');
}

async function guardarAuto(){
  const marca = document.getElementById('a-marca').value.trim();
  const modelo = document.getElementById('a-modelo').value.trim();
  const precio = parseInt(document.getElementById('a-precio').value);
  const anio = parseInt(document.getElementById('a-anio').value);
  if(!marca||!modelo){ showToast('⚠️ Marca y modelo son obligatorios'); return; }
  if(!precio){ showToast('⚠️ El precio es obligatorio'); return; }
  const btn = document.getElementById('btn-guardar-auto');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  const uid = currentUser?.id || window._currentUid;
  if(!uid){ showToast('❌ Sesión expirada. Cierra y vuelve a abrir la app.'); btn.textContent='Guardar auto →'; btn.disabled=false; return; }
  const datos = {
    vendedor_id: uid,
    marca, modelo, anio: anio||new Date().getFullYear(),
    version: document.getElementById('a-version').value.trim()||null,
    color: document.getElementById('a-color').value.trim()||null,
    precio_lista: precio,
    mensualidad_min: parseInt(document.getElementById('a-mensualidad').value)||null,
    equipamiento: document.getElementById('a-equip').value.trim()||null,
    estado: document.getElementById('a-estado').value,
    dias_en_stock: 0
  };
  const {error} = await sbAuth().from('autos').insert(datos);
  if(error){ showToast('❌ Error: '+error.message); btn.textContent='Guardar auto →'; btn.disabled=false; return; }
  btn.textContent = 'Guardar auto →'; btn.disabled = false;
  cerrarModal('modal-auto');
  showToast('✅ Auto agregado al inventario');
  await cargarAutos(window._currentUid);
}


// ── SWIPE DOWN PARA CERRAR MODALES ──
// Funciona en todos los modales automáticamente
(function(){
  const UMBRAL_CIERRE = 80;   // px de swipe para cerrar
  const UMBRAL_VEL    = 0.4;  // velocidad mínima (px/ms) para cierre rápido

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    const modal = overlay.querySelector('.modal');
    if(!modal) return;

    let startY = 0, startT = 0, currentY = 0, arrastrando = false;

    // Iniciar swipe solo desde la barrita o el header del modal
    modal.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      // Solo si el modal no tiene scroll (está en el tope)
      if(modal.scrollTop > 0) return;
      startY  = touch.clientY;
      startT  = Date.now();
      currentY = 0;
      arrastrando = true;
      modal.style.transition = 'none';
    }, { passive: true });

    modal.addEventListener('touchmove', e => {
      if(!arrastrando) return;
      const touch = e.touches[0];
      currentY = touch.clientY - startY;
      // Solo permitir arrastre hacia abajo
      if(currentY > 0){
        modal.style.transform = `translateY(${currentY}px)`;
      }
    }, { passive: true });

    modal.addEventListener('touchend', e => {
      if(!arrastrando) return;
      arrastrando = false;
      modal.style.transition = '';

      const duracion = Date.now() - startT;
      const velocidad = currentY / duracion;

      if(currentY > UMBRAL_CIERRE || velocidad > UMBRAL_VEL){
        // Cerrar — animar hacia abajo y quitar clase
        modal.style.transform = 'translateY(100%)';
        setTimeout(() => {
          modal.style.transform = '';
          overlay.classList.remove('open');
        }, 300);
      } else {
        // No llegó al umbral — regresar a posición original
        modal.style.transform = 'translateY(0)';
      }
    }, { passive: true });
  });
})();

