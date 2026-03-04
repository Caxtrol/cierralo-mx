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
    detectSessionInUrl: false,
    storageKey:         'cierralo_session',
  }
});

// ── Cliente autenticado con token fresco ──
// Se crea UNA SOLA VEZ y se reutiliza — sin instancias duplicadas
let _sbAuthClient = null;
function sbAuth() {
  const token = window._authToken;
  if (!token) return sb;
  // Solo crear si no existe o si el token cambió
  if (!_sbAuthClient || _sbAuthClient._token !== token) {
    _sbAuthClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'cierralo_sbauth_tmp'
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
  // Cerrar cualquier modal abierto al cambiar de pantalla
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

  // Hooks por pantalla
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
