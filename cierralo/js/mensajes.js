// ═══════════════════════════════════════════════════════════
// MENSAJES.JS — Situaciones, Plantillas, IA, Cola confirmación
// Depende de: config.js, crm.js, dashboard.js
// ═══════════════════════════════════════════════════════════

// ── SITUACIONES POR ETAPA ──
const SITUACIONES = {
  nuevo: [
    { id:'primer', icon:'👋', nombre:'Primer contacto', desc:'Preséntate y rompe el hielo', recomendada: true },
    { id:'seguimiento', icon:'🔄', nombre:'Sin respuesta (1 día)', desc:'No ha contestado desde ayer' },
    { id:'reactivar', icon:'⚡', nombre:'Reactivar prospecto frío', desc:'Llevas más de 3 días sin contacto' },
  ],
  contactado: [
    { id:'cotizacion', icon:'📋', nombre:'Enviar cotización', desc:'Está listo para ver números', recomendada: true },
    { id:'seguimiento', icon:'🔄', nombre:'Seguimiento sin respuesta', desc:'No ha contestado en 24h' },
    { id:'prueba', icon:'🚗', nombre:'Invitar a prueba de manejo', desc:'Momento ideal para que lo sienta' },
    { id:'objecion', icon:'🛡️', nombre:'Manejar objeción de precio', desc:'"Está muy caro" — respuesta inteligente' },
  ],
  cotizacion: [
    { id:'cierre', icon:'🎯', nombre:'Empujar al cierre', desc:'Llevan días en cotización — es momento', recomendada: true },
    { id:'objecion', icon:'🛡️', nombre:'Manejar objeción de precio', desc:'Respuesta inteligente al "está caro"' },
    { id:'urgencia', icon:'⏰', nombre:'Crear urgencia', desc:'El auto puede venderse — menciónalo' },
    { id:'seguimiento', icon:'🔄', nombre:'Seguimiento sin respuesta', desc:'No ha contestado la cotización' },
  ],
  prueba: [
    { id:'post_prueba', icon:'🚗', nombre:'Post prueba de manejo', desc:'Ya manejó el auto — momento de cierre', recomendada: true },
    { id:'cierre', icon:'🎯', nombre:'Cierre directo', desc:'¿Cuándo lo llevamos a trámite?' },
  ],
  tramite: [
    { id:'tramite_docs', icon:'📄', nombre:'Solicitar documentos', desc:'Lista de lo que necesita traer', recomendada: true },
    { id:'cierre', icon:'🎯', nombre:'Confirmar fecha de entrega', desc:'Coordinar entrega del auto' },
  ],
  ganado: [
    { id:'posventa', icon:'⭐', nombre:'Seguimiento posventa', desc:'¿Cómo le va con su nuevo auto?' },
    { id:'referido', icon:'👥', nombre:'Pedir referido', desc:'El mejor momento para pedirlo' },
  ],
  perdido: [
    { id:'reactivar', icon:'💫', nombre:'Reactivación a 30 días', desc:'Ya pasó el tiempo — intenta de nuevo' },
  ]
};

// Situaciones genéricas (pantalla de mensajes sin contexto)
const SITUACIONES_GENERICAS = [
  { id:'primer', icon:'👋', nombre:'Primer contacto', desc:'Para alguien que acaba de visitar o preguntar' },
  { id:'seguimiento', icon:'🔄', nombre:'Seguimiento sin respuesta', desc:'No ha contestado en 24+ horas' },
  { id:'cotizacion', icon:'📋', nombre:'Enviar cotización', desc:'Cuando el prospecto está listo para ver números' },
  { id:'objecion', icon:'🛡️', nombre:'Manejar objeción de precio', desc:'"Está muy caro" — respuesta inteligente' },
  { id:'cierre', icon:'🎯', nombre:'Cierre urgente', desc:'Prospecto caliente listo para decidir hoy' },
  { id:'reactivar', icon:'⚡', nombre:'Reactivar prospecto frío', desc:'Sin respuesta por más de 3 días' },
];

// ── PLANTILLAS DE MENSAJES ──
const PLANTILLAS = {
  primer: (p) => `Hola ${safe(p.nombre).split(' ')[0]} 👋, soy ${vendedorData?.nombre||'tu asesor'} de ${vendedorData?.agencia||'la agencia'}.

Fue un placer platicar contigo sobre el ${p.auto_interes||'auto que te interesó'}. Me da mucho gusto poder ayudarte a encontrar el indicado.

¿Te parece si te comparto algunas opciones que tenemos disponibles? 🚗`,

  seguimiento: (p) => `Hola ${p.nombre.split(' ')[0]}, ¿cómo estás? 😊

Solo quería asegurarme de que hayas recibido mi mensaje anterior sobre el ${p.auto_interes||'auto'}. Entiendo que andas ocupado.

¿Hay alguna duda o información adicional que te pueda dar para ayudarte a decidir? Estoy aquí para lo que necesites 👍`,

  cotizacion: (p) => `Hola ${p.nombre.split(' ')[0]} 📋

Preparé una cotización especial para ti del ${p.auto_interes||'auto que te interesó'}. ${p.presupuesto ? `Se ajusta a tu presupuesto de ${fmtPeso(p.presupuesto)}.` : ''}

¿Te la comparto ahorita o prefieres que la revisemos juntos en la agencia? 🤝`,

  objecion: (p) => `Hola ${p.nombre.split(' ')[0]}, te entiendo perfectamente 🙌

El precio es importante y quiero darte el mejor trato posible. Tenemos opciones de financiamiento muy accesibles para el ${p.auto_interes||'auto'} — algunos clientes pagan menos de lo que imaginaban al mes.

¿Me das chance de mostrarte los números? Creo que te va a sorprender 😊`,

  cierre: (p) => `Hola ${p.nombre.split(' ')[0]} 🎯

Quería avisarte que el ${p.auto_interes||'auto que tienes en mente'} sigue disponible. Esta semana tenemos condiciones especiales que me gustaría platicarte.

¿Podemos agendar una visita o una llamada rápida hoy o mañana? No quiero que se te vaya esta oportunidad 🚗✨`,

  urgencia: (p) => `Hola ${p.nombre.split(' ')[0]} ⏰

Te escribo porque el ${p.auto_interes||'auto que te interesó'} ha tenido mucho interés esta semana. Quiero que tú tengas la primera opción antes que alguien más lo aparte.

¿Podemos confirmar algo hoy? 🙏`,

  prueba: (p) => `Hola ${p.nombre.split(' ')[0]} 🚗

Nada como manejar el ${p.auto_interes||'auto'} para que te enamores de él. ¿Qué te parece si agendamos una prueba de manejo esta semana?

Es totalmente sin compromiso — te lo llevamos a donde estés o te esperamos en la agencia 😊`,

  post_prueba: (p) => `Hola ${p.nombre.split(' ')[0]} 😊

¿Qué tal te pareció el ${p.auto_interes||'auto'}? Espero que hayas disfrutado la experiencia al volante.

Ahora que ya lo sentiste, me gustaría ayudarte a dar el siguiente paso. ¿Tienes alguna duda que podamos resolver hoy? 🎯`,

  tramite_docs: (p) => `Hola ${p.nombre.split(' ')[0]} 📄

¡Qué emocionante que ya vamos en trámite del ${p.auto_interes||'tu nuevo auto'}! Para agilizar el proceso, necesitamos:

• Identificación oficial (INE vigente)
• Comprobante de domicilio reciente
• Comprobante de ingresos (si aplica financiamiento)

¿Tienes alguna duda sobre los documentos? Con gusto te ayudo 🙌`,

  posventa: (p) => `Hola ${p.nombre.split(' ')[0]} ⭐

¿Cómo te ha ido con tu ${p.auto_interes||'auto nuevo'}? Espero que lo estés disfrutando mucho.

Si tienes cualquier duda o necesitas algo, aquí me tienes. ¡Un saludo! 🚗`,

  referido: (p) => `Hola ${p.nombre.split(' ')[0]} 👥

¡Que gusto que ya estás disfrutando tu auto! Me da mucho gusto haber podido ayudarte.

Si tienes algún amigo o familiar que esté buscando coche, con gusto le doy la misma atención que a ti. Cualquier referido tuyo lo atiendo como VIP 😊🙏`,

  reactivar: (p) => `Hola ${p.nombre.split(' ')[0]}, espero que estés muy bien 😊

Hace un tiempo platicamos sobre el ${p.auto_interes||'auto'}. He tenido algunas novedades que creo que te pueden interesar — nuevos modelos, mejores condiciones de financiamiento.

¿Te parece si retomamos la conversación? Sin compromiso 🤝`,
};

// ── RENDERIZAR PANTALLA MENSAJES ──
function renderPantallaMensajes(){
  const activos = prospectos.filter(p => !['ganado','perdido'].includes(p.etapa));
  const lista = document.getElementById('msg-prospecto-lista');
  if(!lista) return;

  renderPendingBanner();

  if(activos.length === 0){
    lista.innerHTML = `<div style="padding:16px;text-align:center;background:var(--s1);border-radius:var(--rs);border:1px solid var(--border);">
      <div style="font-size:32px;margin-bottom:8px;">👥</div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;">Sin prospectos activos</div>
      <div style="font-size:11px;color:var(--text2);">Registra tu primer prospecto para generar mensajes personalizados.</div>
    </div>`;
    return;
  }

  const ordenados = [...activos].sort((a,b) => calcTemp(b) - calcTemp(a));

  lista.innerHTML = '';
  ordenados.slice(0, 8).forEach(p => {
    const temp = calcTemp(p);
    const etapa = ETAPAS[p.etapa] || ETAPAS.nuevo;
    const div = document.createElement('div');
    div.className = 'msg-prospecto-chip' + (prospectoMensajeActual?.id === p.id ? ' selected' : '');
    div.onclick = () => seleccionarProspectoMensaje(p);
    div.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:${etapa.bg};color:${etapa.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">
        ${p.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="mp-name">${p.nombre}</div>
        <div class="mp-sub">${p.auto_interes||'Sin auto definido'} · ${etapa.icon} ${etapa.label}</div>
      </div>
      <div style="font-size:12px;font-weight:700;color:${tempColor(temp)};">${tempEmoji(temp)} ${temp}°</div>`;
    lista.appendChild(div);
  });

  // Mostrar contador de mensajes IA restantes si es Free
  _renderContadorIA();
}

// ── Contador de mensajes IA visible para plan Free ──
function _renderContadorIA() {
  const plan = getPlanActual();
  if (plan !== 'free') return; // Pro y Elite no necesitan ver el contador

  const restantes = mensajesIARestantes();
  const max       = PLANES_LIMITES.free.mensajes_ia_mes;

  let contador = document.getElementById('ia-contador-banner');
  if (!contador) {
    contador = document.createElement('div');
    contador.id = 'ia-contador-banner';
    const lista = document.getElementById('msg-prospecto-lista');
    if (lista) lista.insertAdjacentElement('afterend', contador);
  }

  if (restantes === 0) {
    contador.innerHTML = `
      <div style="margin:8px 0;background:var(--redBg);border:1px solid #EF444430;border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;">
        <div style="font-size:24px;">🤖</div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:2px;">Sin mensajes IA este mes</div>
          <div style="font-size:11px;color:var(--text2);">Aún puedes usar las plantillas. Mejora a Pro para 50/mes.</div>
        </div>
        <div onclick="mostrarPaywall('mensajes_ia_mes')" style="background:var(--orange);color:white;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">Pro →</div>
      </div>`;
  } else {
    const pct = Math.round((restantes / max) * 100);
    const color = restantes <= 1 ? 'var(--red)' : restantes <= 2 ? 'var(--yellow)' : 'var(--blue)';
    contador.innerHTML = `
      <div style="margin:8px 0;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
        <div style="font-size:18px;">🤖</div>
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Mensajes IA restantes este mes</div>
          <div style="height:4px;background:var(--s3);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .3s;"></div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:800;color:${color};font-family:'Syne',sans-serif;">${restantes}/${max}</div>
      </div>`;
  }
}

function seleccionarProspectoMensaje(p){
  prospectoMensajeActual = p;
  document.getElementById('msg-prospecto-selector').style.display = 'none';
  document.getElementById('msg-prospecto-activo').style.display = 'block';
  document.getElementById('msg-preview').style.display = 'none';

  const etapa = ETAPAS[p.etapa] || ETAPAS.nuevo;
  const temp = calcTemp(p);
  const hdr = document.getElementById('msg-prospecto-header');
  hdr.innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background:${etapa.bg};color:${etapa.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">
      ${p.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
    </div>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:700;color:var(--text);">${p.nombre}</div>
      <div style="font-size:11px;color:var(--orange);">${p.auto_interes||'Sin auto'} · ${etapa.icon} ${etapa.label} · ${tempEmoji(temp)} ${temp}°</div>
    </div>
    <div style="font-size:11px;color:var(--text3);cursor:pointer;padding:4px 8px;background:var(--s2);border-radius:20px;" onclick="resetearSelectorProspecto()">✕ Cambiar</div>`;

  const situaciones = SITUACIONES[p.etapa] || SITUACIONES_GENERICAS;
  const sitLista = document.getElementById('msg-situaciones-lista');
  sitLista.innerHTML = '';
  situaciones.forEach(sit => {
    const div = document.createElement('div');
    div.className = 'msg-sit-btn' + (sit.recomendada ? ' recomendada' : '');
    div.onclick = () => generarMensajePara(p, sit.id);
    div.innerHTML = `
      <div class="msg-sit-icon">${sit.icon}</div>
      <div style="flex:1;">
        <div class="msg-sit-name">${sit.nombre}${sit.recomendada ? ' ✦' : ''}</div>
        <div class="msg-sit-desc">${sit.desc}</div>
      </div>
      <div style="color:var(--text4);">›</div>`;
    sitLista.appendChild(div);
  });
}

function resetearSelectorProspecto(){
  prospectoMensajeActual = null;
  document.getElementById('msg-prospecto-selector').style.display = 'block';
  document.getElementById('msg-prospecto-activo').style.display = 'none';
  document.getElementById('msg-preview').style.display = 'none';
  renderPantallaMensajes();
}

async function generarMensajePara(p, situacionId){
  // ── VERIFICAR LÍMITE DE MENSAJES IA ──
  const restantes = mensajesIARestantes();
  const usarIA    = restantes > 0;

  // Si es Free y no tiene mensajes, avisar pero dejar usar plantilla
  if (!usarIA && getPlanActual() === 'free') {
    showToast('🤖 Sin mensajes IA — usando plantilla. Mejora a Pro para más.');
  }

  document.getElementById('msg-para-nombre').textContent = p.nombre.split(' ')[0];
  document.getElementById('msg-preview').style.display = 'block';
  document.getElementById('msg-preview').scrollIntoView({behavior:'smooth', block:'nearest'});
  setMsgLoading(true);

  let textoGenerado = '';
  let usóIA = false;

  if (usarIA) {
    try {
      textoGenerado = await generarConIA(p, situacionId);
      usóIA = true;
    } catch(e) {
      console.warn('IA no disponible, usando plantilla:', e.message);
      const fn = PLANTILLAS[situacionId];
      textoGenerado = fn ? fn(p) : `Hola ${p.nombre.split(' ')[0]}, ¿cómo estás? 😊`;
    }
  } else {
    // Sin mensajes disponibles — usar plantilla directamente
    const fn = PLANTILLAS[situacionId];
    textoGenerado = fn ? fn(p) : `Hola ${p.nombre.split(' ')[0]}, ¿cómo estás? 😊`;
  }

  document.getElementById('msg-content').textContent = textoGenerado;
  setMsgLoading(false);

  // Registrar uso solo si la IA efectivamente generó el mensaje
  if (usóIA) {
    await registrarMensajeIA();
    _renderContadorIA(); // Actualizar el contador visualmente
  }

  // Guardar referencia para regenerar
  _ultimoProspecto = p;
  _ultimaSituacion = situacionId;
}

function setMsgLoading(loading){
  const bubble = document.getElementById('msg-content');
  const btns = document.getElementById('msg-actions-btns');
  if(loading){
    bubble.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--text3);font-size:13px;">
      <div class="ai-dots"><span></span><span></span><span></span></div>
      Escribiendo mensaje con IA...
    </div>`;
    if(btns) btns.style.opacity = '0.4';
  } else {
    if(btns) btns.style.opacity = '1';
  }
}

// ── GENERACIÓN CON IA — Claude Haiku via Edge Function (API key oculta en servidor) ──
async function generarConIA(p, situacionId) {
  // Obtener el token del vendedor autenticado
  const token = window._authToken;
  if (!token) {
    throw new Error('Sin sesión activa');
  }

  const sit = [...(SITUACIONES[p.etapa] || []), ...SITUACIONES_GENERICAS].find(s => s.id === situacionId);
  const nombreSituacion = sit?.nombre || situacionId;

  const res = await fetch(
    'https://nkjradximipkrzscgvhv.supabase.co/functions/v1/generar-mensaje',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        situacion: nombreSituacion,
        prospecto: {
          nombre:       p.nombre,
          etapa:        p.etapa,
          temperatura:  calcTemp(p),
          auto_interes: p.auto_interes || null,
          presupuesto:  p.presupuesto  || null,
          notas:        p.notas        || null
        },
        vendedorNombre: vendedorData?.nombre || null,
        autoInteres:    p.auto_interes || null
      })
    }
  );

  const data = await res.json();

  // Plan alcanzó su límite — avisar y usar plantilla
  if (res.status === 403 && data.error === 'limite_alcanzado') {
    showToast(`🤖 ${data.mensaje}`);
    throw new Error('limite_alcanzado');
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data.mensaje;
}

// ── ABRIR MENSAJES DESDE DETALLE DE PROSPECTO ──
function abrirMensajeDesdeProspecto(){
  if(!prospectoActual) return;
  cerrarModal('modal-detalle');
  goTo('mensajes');
  setTimeout(() => {
    seleccionarProspectoMensaje(prospectoActual);
  }, 150);
}

// ── COPIAR MENSAJE CON CONTEXTO ──
function copiarMsgContextual(){
  if(!prospectoMensajeActual){ copyMsg(); return; }
  const txt = document.getElementById('msg-content').textContent;
  if(!verificarLimiteWA()) return;

  navigator.clipboard.writeText(txt)
    .then(() => {
      registrarMensajeEnviado();
      const nuevo = {
        id: Date.now(),
        prospecto: { ...prospectoMensajeActual },
        timestamp: Date.now()
      };
      colaPendientes.push(nuevo);
      guardarCola();
      showToast('✅ Copiado — mándalo en WhatsApp 📲');
      setTimeout(() => { renderPendingBanner(); }, 40 * 60 * 1000);
    })
    .catch(() => showToast('Selecciona el texto y cópialo manualmente'));
}

function guardarCola(){
  try { localStorage.setItem('cmx_cola', JSON.stringify(colaPendientes)); } catch(e){}
}

function cargarCola(){
  try {
    const saved = localStorage.getItem('cmx_cola');
    if(saved){
      const todos = JSON.parse(saved);
      const ahora = Date.now();
      colaPendientes = todos.filter(i => (ahora - i.timestamp) < 24 * 60 * 60 * 1000);
      if(colaPendientes.length !== todos.length) guardarCola();
    }
  } catch(e){ colaPendientes = []; }
}

// ── COLA DE PENDIENTES — BANNERS ──
function renderPendingBanner(){
  ['scr-dashboard','scr-mensajes'].forEach(screenId => {
    const screen = document.getElementById(screenId);
    if(!screen) return;
    screen.querySelectorAll('.pending-banner').forEach(b => b.remove());
    if(colaPendientes.length === 0) return;

    let contenedor = screen.querySelector('.pending-contenedor');
    if(!contenedor){
      contenedor = document.createElement('div');
      contenedor.className = 'pending-contenedor';
      if(screenId === 'scr-dashboard'){
        const statsGrid = screen.querySelector('.stats-grid');
        if(statsGrid) statsGrid.insertAdjacentElement('afterend', contenedor);
      } else {
        const selector = screen.querySelector('#msg-prospecto-selector');
        if(selector) selector.insertAdjacentElement('beforebegin', contenedor);
      }
    }
    contenedor.innerHTML = '';

    if(colaPendientes.length > 1){
      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:6px 16px 4px;font-size:10px;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:.5px;';
      hdr.textContent = `⏳ ${colaPendientes.length} mensajes esperando respuesta`;
      contenedor.appendChild(hdr);
    }

    if(!screen.classList.contains('active')) {
      contenedor.style.display = 'none';
    } else {
      contenedor.style.display = '';
    }

    colaPendientes.forEach(item => {
      const p = item.prospecto;
      const mins = Math.floor((Date.now() - item.timestamp) / 60000);
      const tiempoStr = mins < 60 ? `hace ${mins} min` : `hace ${Math.floor(mins/60)}h`;
      const banner = document.createElement('div');
      banner.className = 'pending-banner';
      banner.dataset.pendingId = item.id;
      banner.innerHTML = `
        <div class="pending-banner-icon">⏳</div>
        <div class="pending-banner-text">
          <div class="pending-banner-title">¿Qué pasó con ${p.nombre.split(' ')[0]}? <span style="font-weight:400;opacity:.7;">(${tiempoStr})</span></div>
          <div class="pending-banner-sub">${p.auto_interes || 'Mensaje enviado'} · Toca para registrar</div>
        </div>
        <div style="color:var(--yellow);font-size:20px;flex-shrink:0;">›</div>`;
      banner.onclick = () => abrirConfirmacionPendiente(item.id);
      contenedor.appendChild(banner);
    });
  });
}

function abrirConfirmacionPendiente(pendingId){
  const item = colaPendientes.find(i => i.id === pendingId);
  if(!item) return;

  const screenActiva = document.querySelector('.screen.active');
  const idActivo = screenActiva?.id || '';
  if(!idActivo.includes('dashboard') && !idActivo.includes('mensajes')) return;

  window._respondingId = pendingId;
  const prospecto = item.prospecto;

  const modalEl  = document.getElementById('modal-confirmacion');
  const avatarEl = document.getElementById('conf-avatar');
  const nombreEl = document.getElementById('conf-nombre');

  if(!modalEl){ showToast('Error al abrir confirmacion'); return; }

  if(avatarEl){
    const iniciales = (prospecto.nombre || 'XX').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    avatarEl.textContent = iniciales;
  }
  if(nombreEl) nombreEl.textContent = prospecto.nombre || '';

  prospectoConfirmacion = prospecto;
  modalEl.classList.add('open');
}

const _origRegistrar = window.registrarRespuesta;
window.registrarRespuesta = async function(tipo){
  if(window._respondingId){
    colaPendientes = colaPendientes.filter(i => i.id !== window._respondingId);
    window._respondingId = null;
    guardarCola();
  }
  renderPendingBanner();
  if(_origRegistrar) await _origRegistrar(tipo);
};

// ── TIEMPOS DE ALERTA ──
const TIEMPOS_ALERTA = {
  nuevo:      { horas: 4,   urgencia: 'alta',  msg: 'Nuevo prospecto sin primer contacto. Responder en las primeras horas es crítico — el 78% compra del primer vendedor que responde.' },
  contactado: { horas: 24,  urgencia: 'alta',  msg: 'Llevan más de 24h sin respuesta. Mantén el momentum — el interés baja rápido.' },
  cotizacion: { horas: 48,  urgencia: 'alta',  msg: 'Cotización enviada hace 2+ días sin respuesta. Está en riesgo de irse con la competencia.' },
  prueba:     { horas: 24,  urgencia: 'alta',  msg: 'Ya hizo la prueba de manejo. Es el momento más caliente — no dejes pasar 24h.' },
  tramite:    { horas: 24,  urgencia: 'alta',  msg: 'En trámite sin contacto. Asegúrate de que todo vaya bien con sus documentos.' },
};

window.generarAlertas = function(){
  const alertas = [];
  const hoy = new Date();

  prospectos.forEach(p => {
    if(['ganado','perdido'].includes(p.etapa)) return;
    const config = TIEMPOS_ALERTA[p.etapa];
    if(!config) return;

    const horasSinContacto = p.ultimo_contacto
      ? (hoy - new Date(p.ultimo_contacto)) / 3600000
      : 999;

    if(horasSinContacto >= config.horas){
      const tiempoStr = horasSinContacto < 24
        ? `${Math.floor(horasSinContacto)}h sin contacto`
        : `${Math.floor(horasSinContacto/24)} días sin contacto`;
      alertas.push({
        urgencia: config.urgencia,
        icon: ETAPAS[p.etapa]?.icon || '⚡',
        nombre: p.nombre,
        msg: `${tiempoStr} — ${config.msg}`,
        accion: () => { goTo('prospectos'); setTimeout(() => abrirDetalle(p), 200); },
        prospecto: p
      });
    }
  });

  autos.forEach(a => {
    const dias = Math.floor((hoy - new Date(a.created_at)) / 86400000);
    if(a.estado === 'disponible' && dias >= 21){
      alertas.push({
        urgencia: 'media', icon: '🚗',
        nombre: `${a.marca} ${a.modelo} ${a.anio}`,
        msg: `${dias} días en stock. Haz match con algún prospecto hoy.`,
        accion: () => goTo('inventario'), prospecto: null
      });
    }
  });

  if(prospectos.length === 0) alertas.push({ urgencia:'normal', icon:'👥', nombre:'Empieza aquí', msg:'Registra tu primer prospecto.', accion: () => { goTo('prospectos'); setTimeout(abrirModalProspecto,300); }, prospecto: null });
  if(autos.length === 0) alertas.push({ urgencia:'normal', icon:'🚗', nombre:'Agrega tu inventario', msg:'Con autos cargados la IA hace match automático.', accion: () => goTo('inventario'), prospecto: null });

  if(typeof renderAlertas === 'function') renderAlertas(alertas);
};

const _origGoTo = window.goTo;
window.goTo = function(screen){
  if(_origGoTo) _origGoTo(screen);
  if(screen === 'mensajes'){
    setTimeout(() => {
      renderPantallaMensajes();
      renderPendingBanner();
    }, 100);
  }
  if(screen === 'dashboard'){
    setTimeout(renderPendingBanner, 100);
  }
};

window.addEventListener('load', () => {
  setTimeout(() => {
    cargarCola();
    if(colaPendientes.length === 0) return;
    const ahora = Date.now();
    colaPendientes.forEach(item => {
      const transcurrido = ahora - item.timestamp;
      if(transcurrido < 40 * 60 * 1000){
        const msRestantes = (40 * 60 * 1000) - transcurrido;
        setTimeout(() => renderPendingBanner(), msRestantes);
      }
    });
    renderPendingBanner();
  }, 1500);
});
