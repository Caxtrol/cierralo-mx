// ═══════════════════════════════════════════════════════════
// DASHBOARD.JS — Alertas, Stats, Confirmación 1 toque
// Depende de: config.js, crm.js
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════
// SESIÓN 4 — MOTOR DE ALERTAS + DASHBOARD REAL + CONFIRMACIÓN 1 TOQUE
// ═══════════════════════════════════════

// ── DASHBOARD REAL ──
function actualizarDashboard(){
  const activos = prospectos.filter(p => !['ganado','perdido'].includes(p.etapa));
  const calientes = prospectos.filter(p => calcTemp(p) >= 60 && !['ganado','perdido'].includes(p.etapa));
  const ganados = prospectos.filter(p => p.etapa === 'ganado');
  const meta = vendedorData?.meta_mensual || 10;
  const pct = Math.min(Math.round((ganados.length / meta) * 100), 100);

  const d = id => document.getElementById(id);
  if(d('stat-prospectos')) d('stat-prospectos').textContent = activos.length;
  if(d('stat-calientes'))  d('stat-calientes').textContent  = calientes.length;
  if(d('stat-ganados'))    d('stat-ganados').textContent    = ganados.length;
  if(d('dash-meta'))       d('dash-meta').textContent       = meta;
  if(d('dash-progreso'))   d('dash-progreso').innerHTML     = ganados.length + ' / <span id="dash-meta">'+meta+'</span>';
  if(d('dash-progress-fill')) d('dash-progress-fill').style.width = pct+'%';
  if(d('dash-pct'))        d('dash-pct').textContent        = pct+'% completado';

  // Generar alertas
  generarAlertas();
}

// ── MOTOR DE ALERTAS ──
function generarAlertas(){
  const alertas = [];
  const hoy = new Date();

  prospectos.forEach(p => {
    if(['ganado','perdido'].includes(p.etapa)) return;
    const temp = calcTemp(p);
    const diasSinContacto = p.ultimo_contacto
      ? Math.floor((hoy - new Date(p.ultimo_contacto)) / 86400000)
      : 99;

    // Alerta: sin contacto 3+ días en etapa caliente
    if(diasSinContacto >= 3 && temp >= 50){
      alertas.push({
        urgencia: 'alta',
        icon: '🔥',
        nombre: p.nombre,
        msg: `Lleva ${diasSinContacto} días sin respuesta y está caliente. Mándale seguimiento hoy.`,
        accion: () => { cerrarModal && null; goTo('prospectos'); abrirDetalle(p); },
        prospecto: p
      });
    }
    // Alerta: sin contacto 5+ días cualquier etapa
    else if(diasSinContacto >= 5){
      alertas.push({
        urgencia: 'media',
        icon: '⚡',
        nombre: p.nombre,
        msg: `${diasSinContacto} días sin contacto. Riesgo de perder el interés.`,
        accion: () => { goTo('prospectos'); abrirDetalle(p); },
        prospecto: p
      });
    }
    // Alerta: en cotización 4+ días
    if(p.etapa === 'cotizacion' && diasSinContacto >= 4){
      alertas.push({
        urgencia: 'alta',
        icon: '📋',
        nombre: p.nombre,
        msg: `En cotización hace ${diasSinContacto} días. Dale seguimiento para no perder el cierre.`,
        accion: () => { goTo('prospectos'); abrirDetalle(p); },
        prospecto: p
      });
    }
  });

  // Alertas de inventario
  autos.forEach(a => {
    const dias = Math.floor((hoy - new Date(a.created_at)) / 86400000);
    if(a.estado === 'disponible' && dias >= 21){
      alertas.push({
        urgencia: 'media',
        icon: '🚗',
        nombre: `${a.marca} ${a.modelo} ${a.anio}`,
        msg: `${dias} días en stock sin venderse. Considera hacer match con algún prospecto.`,
        accion: () => goTo('inventario'),
        prospecto: null
      });
    }
  });

  // Sin prospectos — onboarding tip
  if(prospectos.length === 0){
    alertas.push({ urgencia:'normal', icon:'👥', nombre:'Empieza aquí',
      msg:'Registra tu primer prospecto para que la app empiece a trabajar.',
      accion: () => { goTo('prospectos'); setTimeout(abrirModalProspecto, 300); }, prospecto: null });
  }
  if(autos.length === 0){
    alertas.push({ urgencia:'normal', icon:'🚗', nombre:'Agrega tu inventario',
      msg:'Con autos cargados la IA puede hacer match automático.',
      accion: () => goTo('inventario'), prospecto: null });
  }

  renderAlertas(alertas);
}

function renderAlertas(alertas){
  const lista = document.getElementById('dash-alertas-list');
  const badge = document.getElementById('dash-alertas-cnt');
  if(!lista) return;

  const urgentes = alertas.filter(a => a.urgencia === 'alta').length;
  if(badge){
    badge.textContent = alertas.length;
    badge.style.display = alertas.length > 0 ? 'inline-flex' : 'none';
    badge.style.background = urgentes > 0 ? 'var(--redBg)' : 'var(--orangeBg)';
    badge.style.color = urgentes > 0 ? 'var(--red)' : 'var(--orange)';
    badge.style.border = `1px solid ${urgentes > 0 ? '#EF444430' : '#FF6B3530'}`;
  }

  // Punto rojo en nav si hay alertas urgentes
  const navDot = document.querySelector('.nb:first-child .n-dot');
  if(navDot) navDot.classList.toggle('show', urgentes > 0);

  if(alertas.length === 0){
    lista.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);border-radius:var(--rs);padding:16px;text-align:center;"><div style="font-size:28px;margin-bottom:6px;">✅</div><div style="font-size:13px;font-weight:600;color:var(--text);">Todo al día</div><div style="font-size:11px;color:var(--text2);margin-top:3px;">No tienes alertas pendientes. ¡Buen trabajo!</div></div>`;
    return;
  }

  lista.innerHTML = '';
  // Ordenar: alta primero
  const orden = {alta:0, media:1, normal:2};
  alertas.sort((a,b) => orden[a.urgencia] - orden[b.urgencia]);

  alertas.slice(0,6).forEach(alerta => {
    const div = document.createElement('div');
    div.className = `alerta-item ${alerta.urgencia}`;
    div.onclick = alerta.accion;
    const badgeColor = alerta.urgencia === 'alta' ? 'br' : alerta.urgencia === 'media' ? 'bo' : 'bb';
    const badgeLabel = alerta.urgencia === 'alta' ? 'Urgente' : alerta.urgencia === 'media' ? 'Hoy' : 'Tip';
    div.innerHTML = `
      <div class="alerta-icon">${alerta.icon}</div>
      <div class="alerta-body">
        <div class="alerta-nombre">${safe(alerta.nombre)}</div>
        <div class="alerta-msg">${safe(alerta.msg)}</div>
      </div>
      <div class="alerta-badge badge ${badgeColor}">${badgeLabel}</div>`;
    lista.appendChild(div);
  });

  if(alertas.length > 6){
    const more = document.createElement('div');
    more.style.cssText = 'text-align:center;font-size:12px;color:var(--text3);padding:8px;';
    more.textContent = `+ ${alertas.length - 6} alertas más`;
    lista.appendChild(more);
  }
}

// ── CONFIRMACIÓN 1 TOQUE ──

function mostrarConfirmacion(prospecto){
  prospectoConfirmacion = prospecto;
  const iniciales = prospecto.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('conf-avatar').textContent = iniciales;
  document.getElementById('conf-nombre').textContent = prospecto.nombre;
  document.getElementById('modal-confirmacion').classList.add('open');
}

async function registrarRespuesta(tipo){
  if(!prospectoConfirmacion) return;
  document.getElementById('modal-confirmacion').classList.remove('open');

  const updates = { ultimo_contacto: new Date().toISOString() };
  let toastMsg = '';

  if(tipo === 'positivo'){
    // Avanza etapa si está en nuevo o contactado
    if(prospectoConfirmacion.etapa === 'nuevo') updates.etapa = 'contactado';
    else if(prospectoConfirmacion.etapa === 'contactado') updates.etapa = 'cotizacion';
    toastMsg = '✅ Genial — prospecto avanzado en el pipeline';
  } else if(tipo === 'sin_respuesta'){
    toastMsg = '📵 Registrado — te avisamos para el siguiente intento';
  } else if(tipo === 'cerrado'){
    updates.etapa = 'ganado';
    updates.ultimo_contacto = new Date().toISOString();
    toastMsg = '🎉 ¡Felicidades! Venta cerrada registrada';
  } else if(tipo === 'perdido'){
    updates.etapa = 'perdido';
    toastMsg = '❌ Registrado como perdido — lo retomamos en 30 días';
  }

  await sb.from('prospectos').update(updates).eq('id', prospectoConfirmacion.id);
  showToast(toastMsg);
  prospectoConfirmacion = null;
  await cargarProspectos();
  actualizarDashboard();
}

// ── BOTÓN "COPIAR MENSAJE" — activa confirmación ──
// Reemplaza copyMsg para que después de copiar pregunte qué pasó
function copyMsgConConfirmacion(){
  // Redirigir a copiarMsgContextual que maneja el delay de 40 min correctamente
  if(typeof copiarMsgContextual === 'function'){
    copiarMsgContextual();
  } else {
    const txt = document.getElementById('msg-content')?.textContent;
    if(txt) navigator.clipboard.writeText(txt)
      .then(() => showToast('✅ Copiado — mándalo en WhatsApp 📲'))
      .catch(() => showToast('Copia el texto manualmente'));
  }
}

function mostrarSelectorProspectoParaConfirmar(){
  // Mostrar los 3 prospectos más recientes para seleccionar
  const recientes = prospectos
    .filter(p => !['ganado','perdido'].includes(p.etapa))
    .slice(0,3);
  if(recientes.length === 0) return;
  if(recientes.length === 1){
    mostrarConfirmacion(recientes[0]);
    return;
  }
  // Si hay varios, mostrar el más caliente
  const masCaliente = recientes.sort((a,b) => calcTemp(b) - calcTemp(a))[0];
  mostrarConfirmacion(masCaliente);
}

// Hook: reemplazar el botón copiar en mensajes
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.querySelector('.msg-btn-copy');
  if(copyBtn) copyBtn.onclick = copyMsgConConfirmacion;
});

// ── CLICK EN CONFIRMACIÓN: cerrar si toca fondo ──
document.getElementById('modal-confirmacion').addEventListener('click', function(e){
  if(e.target === this) this.classList.remove('open');
});

// ── HOOK: actualizar dashboard cada vez que se carguen prospectos ──
// Sobrescribir actualizarStatsDash para usar la nueva función
window.actualizarStatsDash = actualizarDashboard;

// Llamar inmediatamente si ya hay datos
if(typeof prospectos !== 'undefined' && prospectos.length >= 0) {
  actualizarDashboard();
}
