// ═══════════════════════════════════════════════════════════
// CONFIG.JS — Variables globales y conexión Supabase
// Carga primero que todos los demás módulos
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://nkjradximipkrzscgvhv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_53Uf0nvrDI8I0iVRqgDA7g_4RJDPl3j';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    flowType:           'implicit',
    detectSessionInUrl: true,
    storageKey:         'cierralo_session',
  }
});

// ── Cliente autenticado con token fresco ──
let _sbAuthClient = null;
function sbAuth() {
  let token = window._authToken;

  if (!token) {
    try {
      const stored = localStorage.getItem('sb-nkjradximipkrzscgvhv-auth-token');
      if (stored) {
        const parsed = JSON.parse(stored);
        const t = parsed?.access_token
               || parsed?.[0]?.access_token
               || parsed?.data?.access_token
               || parsed?.currentSession?.access_token;
        if (t) {
          token = t;
          window._authToken = t;
        }
      }
    } catch(e) {}
  }

  if (!token) return sb;

  if (!_sbAuthClient || _sbAuthClient._token !== token) {
    _sbAuthClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: {
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
        storageKey:         'cierralo_sbauth_tmp'
      }
    });
    _sbAuthClient._token = token;
  }
  return _sbAuthClient;
}

// ── Estado global de la app ──
let currentUser   = null;
let vendedorData  = null;
let obMeta        = null;
let obProblema    = null;
let appIniciada   = false;

// ── Datos cargados de Supabase ──
let prospectos = [];
let autos      = [];

// ── Estado de modales ──
let prospectoActual        = null;
let prospectoMensajeActual = null;
let prospectoConfirmacion  = null;
let duplicadoEncontrado    = null;

// ── Cola de confirmaciones pendientes ──
let colaPendientes = [];

// ── Variables de login ──
let _loginTelefono = '';
let _loginEsNuevo  = false;

// ── Último mensaje generado (para regenerar) ──
let _ultimoProspecto = null;
let _ultimaSituacion = null;

// ── Perfil público ──
let perfilPublicoActivo = false;

// ── Excel import ──
let excelDataParsed = [];

// ── Sanitización XSS ──
function safe(str){
  return DOMPurify ? DOMPurify.sanitize(str || '') : (str || '');
}

// ── Utilidades de formato ──
function fmtPeso(n){
  return n ? '$' + Number(n).toLocaleString('es-MX') : '—';
}

function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

function showPage(name){
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active', 'visible');
  });
  const page = document.getElementById('page-' + name);
  if(!page) return;
  page.classList.add('active');
  setTimeout(() => page.classList.add('visible'), 10);
}

function cerrarModal(id){
  document.getElementById(id)?.classList.remove('open');
}

function cerrarModalSiFondo(e, id){
  if(e.target === document.getElementById(id)) cerrarModal(id);
}

// ── Colores y config de etapas ──
const ETAPAS = {
  nuevo:      { label: 'Nuevo',      icon: '👤', color: 'var(--text3)',  bg: 'var(--s3)' },
  contactado: { label: 'Contactado', icon: '💬', color: 'var(--blue)',   bg: 'var(--blueBg)' },
  cotizacion: { label: 'Cotización', icon: '📋', color: 'var(--orange)', bg: 'var(--orangeBg)' },
  prueba:     { label: 'Prueba',     icon: '🚗', color: 'var(--purple)', bg: 'var(--purpleBg)' },
  tramite:    { label: 'Trámite',    icon: '📝', color: 'var(--yellow)', bg: 'var(--yellowBg)' },
  ganado:     { label: 'Ganado 🎉',  icon: '🏆', color: 'var(--green)',  bg: 'var(--greenBg)' },
  perdido:    { label: 'Perdido',    icon: '❌', color: 'var(--red)',    bg: 'var(--redBg)' }
};

// ── Temperatura de interés 0-100 ──
function calcTemp(prospecto){
  const base = { nuevo:15, contactado:35, cotizacion:55, prueba:70, tramite:80, ganado:100, perdido:0 };
  let temp = base[prospecto.etapa] || 15;
  if(prospecto.ultimo_contacto){
    const dias = Math.floor((Date.now() - new Date(prospecto.ultimo_contacto)) / 86400000);
    if(dias > 7)      temp = Math.max(temp - 20, 5);
    else if(dias > 3) temp = Math.max(temp - 10, 5);
  }
  return Math.min(temp, 100);
}

function tempColor(t){
  if(t >= 70) return 'var(--green)';
  if(t >= 40) return 'var(--orange)';
  return 'var(--blue)';
}

function tempEmoji(t){
  if(t >= 70) return '🔥';
  if(t >= 40) return '⚡';
  return '❄️';
}

// ── Navegación entre pantallas ──
function goTo(screen, btn){
  document.querySelectorAll('.confirm-overlay, .modal-overlay').forEach(m => {
    m.classList.remove('open');
  });

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('scr-' + screen)?.classList.add('active');
  if(btn){
    btn.classList.add('active');
  } else {
    const map = { dashboard:0, prospectos:1, mensajes:2, inventario:3, perfil:4 };
    const idx = map[screen];
    if(idx !== undefined) document.querySelectorAll('.nb')[idx]?.classList.add('active');
  }
  document.getElementById('main')?.scrollTo(0, 0);

  if(screen === 'mensajes'){
    setTimeout(() => { renderPantallaMensajes(); renderPendingBanner(); }, 100);
  }
  if(screen === 'dashboard'){
    setTimeout(renderPendingBanner, 100);
  }
  if(screen === 'perfil'){
    setTimeout(() => { renderApiKeySection(); renderPerfilPublico(); }, 50);
  }
}

// ── Swipe down para cerrar modales ──
(function iniciarSwipe(){
  const UMBRAL_CIERRE = 80;
  const UMBRAL_VEL    = 0.4;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      const modal = overlay.querySelector('.modal');
      if(!modal) return;

      let startY = 0, startT = 0, currentY = 0, arrastrando = false;

      modal.addEventListener('touchstart', e => {
        if(modal.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        startT = Date.now();
        currentY = 0;
        arrastrando = true;
        modal.style.transition = 'none';
      }, { passive: true });

      modal.addEventListener('touchmove', e => {
        if(!arrastrando) return;
        currentY = e.touches[0].clientY - startY;
        if(currentY > 0) modal.style.transform = `translateY(${currentY}px)`;
      }, { passive: true });

      modal.addEventListener('touchend', () => {
        if(!arrastrando) return;
        arrastrando = false;
        modal.style.transition = '';
        const velocidad = currentY / (Date.now() - startT);
        if(currentY > UMBRAL_CIERRE || velocidad > UMBRAL_VEL){
          modal.style.transform = 'translateY(100%)';
          setTimeout(() => {
            modal.style.transform = '';
            overlay.classList.remove('open');
          }, 300);
        } else {
          modal.style.transform = 'translateY(0)';
        }
      }, { passive: true });
    });
  });
})();


// ═══════════════════════════════════════════════════════════
// MOTOR DE PERMISOS POR PLAN
// ═══════════════════════════════════════════════════════════

// ── Matriz de límites por plan ──
// Uso justo: mensajes IA tienen tope en todos los planes
const PLANES_LIMITES = {
  gratis: {
    prospectos_max:  25,
    mensajes_ia_mes: 20,
    excel_import:    false,
    semaforo_wa:     false,
    weekly_wrapped:  true,
    inventario:      true,
  },
  // Alias "free" apunta a gratis para compatibilidad
  free: {
    prospectos_max:  25,
    mensajes_ia_mes: 20,
    excel_import:    false,
    semaforo_wa:     false,
    weekly_wrapped:  true,
    inventario:      true,
  },
  pro: {
    prospectos_max:  Infinity,
    mensajes_ia_mes: 200,
    excel_import:    true,
    semaforo_wa:     false,
    weekly_wrapped:  true,
    inventario:      true,
  },
  elite: {
    prospectos_max:  Infinity,
    mensajes_ia_mes: 500,
    excel_import:    true,
    semaforo_wa:     true,
    weekly_wrapped:  true,
    inventario:      true,
  }
};

// ── Textos del paywall por acción bloqueada ──
const PAYWALL_TEXTOS = {
  prospectos_max: {
    titulo:  '📋 Límite de prospectos alcanzado',
    mensaje: 'El plan Gratuito permite hasta 25 prospectos activos. Con Pro tienes ilimitados.',
    plan:    'pro'
  },
  mensajes_ia_mes: {
    titulo:  '🤖 Límite de mensajes IA alcanzado',
    mensaje: 'Usaste todos tus mensajes IA de este ciclo. Pro te da 200/ciclo, Elite 500/ciclo.',
    plan:    'pro'
  },
  excel_import: {
    titulo:  '📊 Importación de Excel — Plan Pro',
    mensaje: 'Importar contactos desde Excel está disponible desde el Plan Pro.',
    plan:    'pro'
  },
  semaforo_wa: {
    titulo:  '🚦 Semáforo WhatsApp — Plan Elite',
    mensaje: 'El semáforo de salud de WhatsApp es exclusivo del Plan Elite.',
    plan:    'elite'
  }
};

// ── Normalizar plan: BD usa "gratis", app puede recibir "free" ──
function _normalizarPlan(planDB) {
  if (!planDB) return 'gratis';
  const mapa = { 'gratis':'gratis', 'free':'gratis', 'pro':'pro', 'elite':'elite' };
  return mapa[planDB.trim().toLowerCase()] || 'gratis';
}

function getPlanActual() {
  return _normalizarPlan(vendedorData?.plan);
}

// ── Verificar si el vendedor puede realizar una acción ──
function puedeHacer(accion, valorActual) {
  const plan   = getPlanActual();
  const limite = PLANES_LIMITES[plan];
  if (!limite) return true;

  const permiso = limite[accion];

  if (typeof permiso === 'boolean') return permiso;

  if (typeof permiso === 'number' && valorActual !== undefined) {
    return valorActual < permiso;
  }

  return true;
}

// ── Mensajes IA: cuántos quedan en el ciclo actual ──
function mensajesIARestantes() {
  const plan  = getPlanActual();
  const max   = PLANES_LIMITES[plan]?.mensajes_ia_mes || 20;
  const usado = vendedorData?.mensajes_ia_mes_usado || 0;
  return Math.max(0, max - usado);
}

// ── Verificar límite de mensajes IA antes de generar ──
// Retorna true si puede generar, false si llegó al tope
function verificarLimiteMensajesIA() {
  const restantes = mensajesIARestantes();
  if (restantes <= 0) {
    mostrarPaywall('mensajes_ia_mes');
    return false;
  }
  // Advertencia cuando quedan 3 o menos
  if (restantes <= 3) {
    showToast(`⚠️ Te quedan solo ${restantes} mensaje${restantes !== 1 ? 's' : ''} IA este ciclo`);
  }
  return true;
}

// ── Verificar límite de prospectos antes de guardar uno nuevo ──
function verificarLimiteProspectos() {
  const plan   = getPlanActual();
  const limite = PLANES_LIMITES[plan]?.prospectos_max;

  if (limite === Infinity) return { puede: true, usados: prospectos.length, limite: Infinity, advertencia: false };

  const activos = prospectos.filter(p => p.etapa !== 'perdido').length;

  if (activos >= limite) {
    mostrarPaywall('prospectos_max');
    return { puede: false, usados: activos, limite, advertencia: false };
  }

  const advertencia = activos >= limite - 3;
  return { puede: true, usados: activos, limite, advertencia };
}

// ── Registrar uso de mensaje IA ──
async function registrarMensajeIA() {
  if (!vendedorData) return;

  const uid = currentUser?.id || window._currentUid;
  if (!uid) return;

  vendedorData.mensajes_ia_mes_usado = (vendedorData.mensajes_ia_mes_usado || 0) + 1;

  // Persistir en Supabase en segundo plano
  sbAuth().from('vendedores')
    .update({ mensajes_ia_mes_usado: vendedorData.mensajes_ia_mes_usado })
    .eq('id', uid)
    .then(({ error }) => {
      if (error) console.warn('No se pudo guardar contador IA:', error.message);
    });
}

// ── Modal de paywall ──
function mostrarPaywall(accion) {
  const info = PAYWALL_TEXTOS[accion] || {
    titulo:  '⭐ Función Premium',
    mensaje: 'Esta función no está disponible en tu plan actual.',
    plan:    'pro'
  };

  const planLabel = info.plan === 'elite' ? 'Elite $499/mes' : 'Pro $199/mes';
  const planColor = info.plan === 'elite' ? 'var(--purple)' : 'var(--orange)';

  let overlay = document.getElementById('modal-paywall');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'modal-paywall';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="text-align:center;padding:28px 20px;">
        <div id="paywall-icon"  style="font-size:48px;margin-bottom:12px;"></div>
        <div id="paywall-title" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;"></div>
        <div id="paywall-msg"   style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px;"></div>
        <button id="paywall-btn-upgrade" class="btn btn-p" style="margin-bottom:10px;font-size:13px;" onclick="cerrarPaywall();goTo('perfil');">
          ⭐ Ver planes y precios
        </button>
        <button class="btn btn-s" style="font-size:12px;" onclick="cerrarPaywall();">
          Ahora no
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cerrarPaywall();
    });
  }

  const partes = info.titulo.split(' ');
  document.getElementById('paywall-icon').textContent  = partes[0];
  document.getElementById('paywall-title').textContent = partes.slice(1).join(' ');
  document.getElementById('paywall-msg').textContent   = info.mensaje;

  const btn = document.getElementById('paywall-btn-upgrade');
  btn.style.background = planColor;
  btn.textContent      = `⭐ Mejorar a ${planLabel}`;

  overlay.classList.add('open');
}

function cerrarPaywall() {
  document.getElementById('modal-paywall')?.classList.remove('open');
}


// ═══════════════════════════════════════════════════════════
// VERIFICACIÓN DE VIGENCIA DE PLAN
// Lee la tabla suscripciones para saber si el plan sigue activo
// ═══════════════════════════════════════════════════════════

/**
 * Verifica si el plan de pago sigue activo consultando suscripciones.
 * Si expiró, degrada el plan a 'gratis' en la BD y en memoria.
 * Llamar al inicio de sesión y una vez por día.
 */
async function verificarVigenciaPlan() {
  const uid = currentUser?.id || window._currentUid;
  if (!uid || !vendedorData) return;

  // Plan gratis no necesita verificación
  const planActual = _normalizarPlan(vendedorData.plan);
  if (planActual === 'gratis') return;

  try {
    // Buscar la suscripción activa más reciente
    const { data: subs, error } = await sbAuth()
      .from('suscripciones')
      .select('id, plan, estado, fecha_vencimiento, periodo_fin')
      .eq('vendedor_id', uid)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[Plan] Error verificando vigencia:', error.message);
      return;
    }

    const ahora = new Date();

    // Sin suscripción activa — degradar a gratis
    if (!subs || subs.length === 0) {
      console.warn('[Plan] Sin suscripción activa — degradando a gratis');
      await _degradarPlanAGratis(uid);
      return;
    }

    const sub = subs[0];

    // Verificar fecha de vencimiento
    const fechaVence = sub.fecha_vencimiento
      ? new Date(sub.fecha_vencimiento)
      : sub.periodo_fin
      ? new Date(sub.periodo_fin)
      : null;

    if (fechaVence && fechaVence < ahora) {
      console.warn('[Plan] Suscripción vencida el', fechaVence.toLocaleDateString('es-MX'), '— degradando a gratis');

      // Marcar suscripción como vencida en BD
      await sbAuth()
        .from('suscripciones')
        .update({ estado: 'vencida' })
        .eq('id', sub.id);

      await _degradarPlanAGratis(uid);
      return;
    }

    // Plan vigente — actualizar en memoria por si cambió
    if (vendedorData.plan !== sub.plan) {
      vendedorData.plan = sub.plan;
    }

    // Guardar cuándo vence para mostrarlo en UI
    if (fechaVence) {
      vendedorData._plan_vence_en = fechaVence;
    }

    console.log('[Plan]', sub.plan, 'activo hasta', fechaVence?.toLocaleDateString('es-MX') || 'sin fecha definida');

  } catch(e) {
    console.warn('[Plan] Error en verificarVigenciaPlan:', e.message);
  }
}

async function _degradarPlanAGratis(uid) {
  try {
    await sbAuth()
      .from('vendedores')
      .update({ plan: 'gratis' })
      .eq('id', uid);

    if (vendedorData) vendedorData.plan = 'gratis';

    // Actualizar UI inmediatamente
    if (typeof actualizarCardPlan === 'function') actualizarCardPlan();

    showToast('ℹ️ Tu plan venció — ahora estás en plan Gratuito');
  } catch(e) {
    console.warn('[Plan] Error degradando plan:', e.message);
  }
}

/**
 * Verifica si el contador de mensajes IA debe resetearse.
 *
 * PLAN GRATIS — nunca caduca, pero el contador se resetea cada 7 días
 *   Ciclo: 7 días rodantes desde la fecha de registro (created_at)
 *   Ejemplo: se registró el lunes 3-mar → resetea el lunes 10-mar, 17-mar, etc.
 *
 * PLAN PRO / ELITE — contador se resetea cada 30 días desde la fecha de pago
 *   Ciclo: 30 días desde periodo_inicio de su suscripción activa
 *   Ejemplo: pagó el 15-mar → resetea el 14-abr, 14-may, etc.
 *
 * Columnas usadas:
 *   vendedores.created_at            — fecha de registro (ciclo gratis)
 *   vendedores.mensajes_ia_reset_at  — última vez que se reseteó el contador
 *   vendedores.mensajes_ia_mes_usado — contador actual
 *   suscripciones.periodo_inicio     — inicio del ciclo de pago (Pro/Elite)
 */
async function verificarResetMensajesIA() {
  const uid = currentUser?.id || window._currentUid;
  if (!uid || !vendedorData) return;

  const planActual = _normalizarPlan(vendedorData.plan);

  try {
    let inicioCiclo = null;

    if (planActual === 'gratis') {
      // ── Plan gratis: ciclo de 7 días desde la fecha de registro ──
      const createdAt = vendedorData?.created_at;
      if (createdAt) {
        const fechaRegistro     = new Date(createdAt);
        const ahora             = new Date();
        const diasDesdeRegistro = Math.floor((ahora - fechaRegistro) / 86400000);
        const ciclosCompletos   = Math.floor(diasDesdeRegistro / 7); // <-- 7 días
        inicioCiclo = new Date(fechaRegistro);
        inicioCiclo.setDate(inicioCiclo.getDate() + (ciclosCompletos * 7));
      }
    } else {
      // ── Plan Pro / Elite: ciclo de 30 días desde periodo_inicio del pago ──
      const { data: sub } = await sbAuth()
        .from('suscripciones')
        .select('periodo_inicio, fecha_inicio')
        .eq('vendedor_id', uid)
        .eq('estado', 'activa')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        inicioCiclo = sub.periodo_inicio
          ? new Date(sub.periodo_inicio)
          : sub.fecha_inicio
          ? new Date(sub.fecha_inicio)
          : null;
      }

      // Si no hay suscripción activa (raro), usar ciclo de 30 días desde registro
      if (!inicioCiclo && vendedorData?.created_at) {
        const fechaRegistro     = new Date(vendedorData.created_at);
        const ahora             = new Date();
        const diasDesdeRegistro = Math.floor((ahora - fechaRegistro) / 86400000);
        const ciclosCompletos   = Math.floor(diasDesdeRegistro / 30);
        inicioCiclo = new Date(fechaRegistro);
        inicioCiclo.setDate(inicioCiclo.getDate() + (ciclosCompletos * 30));
      }
    }

    // Fallback si no hay ninguna fecha de referencia
    if (!inicioCiclo) {
      inicioCiclo = new Date();
      inicioCiclo.setHours(0, 0, 0, 0);
    }

    // ¿El contador se reseteó antes de que empezara el ciclo actual?
    const resetAt       = vendedorData?.mensajes_ia_reset_at ? new Date(vendedorData.mensajes_ia_reset_at) : null;
    const necesitaReset = !resetAt || resetAt < inicioCiclo;

    if (necesitaReset) {
      const ahora = new Date();
      await sbAuth().from('vendedores').update({
        mensajes_ia_mes_usado: 0,
        mensajes_ia_reset_at:  ahora.toISOString()
      }).eq('id', uid);

      if (vendedorData) {
        vendedorData.mensajes_ia_mes_usado = 0;
        vendedorData.mensajes_ia_reset_at  = ahora.toISOString();
      }

      const duracion = planActual === 'gratis' ? '7 días' : '30 días';
      console.log(`[IA] Contador reseteado — ciclo ${duracion} desde`, inicioCiclo.toLocaleDateString('es-MX'));
    }

  } catch(e) {
    console.warn('[IA] Error verificando reset de mensajes:', e.message);
  }
}
