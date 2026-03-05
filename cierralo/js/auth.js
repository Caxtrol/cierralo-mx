// ═══════════════════════════════════════════════════════════
// AUTH.JS — Ciérralo.mx
// Sistema: Google OAuth + Email OTP (registro) + PIN (login)
// Sesión 15 — Reemplaza SMS OTP por Email OTP
// Depende de: config.js (carga primero)
// ═══════════════════════════════════════════════════════════

let _reenvioInterval = null;
let _loginEmail = '';       // email del usuario en proceso de login/registro

// ════════════════════════════════════════════════════════
// INIT — al cargar la página
// ════════════════════════════════════════════════════════
window.addEventListener('load', async () => {

  const fallback = setTimeout(() => {
    console.warn('[Auth] Fallback 6s — mostrando login');
    document.getElementById('splash').classList.add('hidden');
    if (!appIniciada) showPage('login');
  }, 6000);

  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hidden')) {
      splash.classList.add('hidden');
      showPage('login');
    }
  }, 10000);

  const h = new Date().getHours();
  const greetEl = document.getElementById('greeting-time');
  if (greetEl) {
    if (h < 12)      greetEl.textContent = 'Buenos días ☀️';
    else if (h < 19) greetEl.textContent = 'Buenas tardes 🌤️';
    else             greetEl.textContent = 'Buenas noches 🌙';
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesEl = document.getElementById('dash-mes');
  if (mesEl) mesEl.textContent = meses[new Date().getMonth()] + ' ' + new Date().getFullYear();

  // ════════════════════════════════════════════════════════
  // FIX CRÍTICO: onAuthStateChange PRIMERO — antes del hash
  // ════════════════════════════════════════════════════════
  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth]', event, session?.user?.id || 'sin sesión');

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      if (session?.user) {
        if (window._fallbackOAuth) { clearTimeout(window._fallbackOAuth); window._fallbackOAuth = null; }
        window._authToken    = session.access_token;
        window._refreshToken = session.refresh_token;
        window._currentUid   = session.user.id;
        localStorage.setItem('cierralo_ultimo_uso', String(Date.now()));
        currentUser = session.user;

        if (!appIniciada) {
          appIniciada = true;
          clearTimeout(fallback);
          document.getElementById('splash').classList.add('hidden');
          await loadVendedor();
        }
      }
    }

    if (event === 'SIGNED_OUT') {
      if (window._signOutExplicito) {
        window._signOutExplicito = false;
        appIniciada  = false;
        currentUser  = null;
        vendedorData = null;
        obMeta       = null;
        obProblema   = null;
        localStorage.removeItem('cierralo_session');
        clearTimeout(fallback);
        document.getElementById('splash').classList.add('hidden');
        showPage('login');
        mostrarLoginStep('login-step-inicio');
      }
    }
  });

  // ── Detectar regreso de Google OAuth ──
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  if (hash && hash.includes('access_token')) {
    clearTimeout(fallback);
    console.log('[Auth] Token OAuth en hash — Supabase lo procesa, onAuthStateChange escuchando');
    window._fallbackOAuth = setTimeout(() => {
      if (!appIniciada) {
        console.warn('[Auth] OAuth timeout 20s — mostrando login');
        document.getElementById('splash').classList.add('hidden');
        showPage('login');
        showToast('❌ No se pudo entrar con Google. Intenta de nuevo.');
      }
    }, 20000);
    return;
  }

  if (searchParams.get('code')) {
    clearTimeout(fallback);
    window.history.replaceState(null, '', window.location.pathname);
    window._fallbackOAuth = setTimeout(() => {
      if (!appIniciada) {
        document.getElementById('splash').classList.add('hidden');
        showPage('login');
        showToast('❌ No se pudo entrar con Google. Intenta de nuevo.');
      }
    }, 20000);
    return;
  }

  // ── Inactividad 3 días ──
  const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;
  const ultimoUso = parseInt(localStorage.getItem('cierralo_ultimo_uso') || '0');
  if (ultimoUso > 0 && (Date.now() - ultimoUso) > TRES_DIAS) {
    localStorage.removeItem('cierralo_ultimo_uso');
    await sb.auth.signOut();
    lanzarLogin(fallback);
    return;
  }

  // ── Restaurar sesión ──
  try {
    let refreshToken = null;
    const authRaw = localStorage.getItem('sb-nkjradximipkrzscgvhv-auth-token');
    if (authRaw) {
      try {
        const authData = JSON.parse(authRaw);
        refreshToken = authData?.refresh_token || authData?.[0]?.refresh_token || authData?.data?.refresh_token;
      } catch(e) {}
    }
    if (!refreshToken) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('nkjradximipkrzscgvhv'))) {
          try {
            const val = JSON.parse(localStorage.getItem(key));
            const rt = val?.refresh_token || val?.[0]?.refresh_token || val?.data?.refresh_token;
            if (rt) { refreshToken = rt; break; }
          } catch(e) {}
        }
      }
    }
    if (refreshToken) {
      const { error: rErr } = await sb.auth.refreshSession({ refresh_token: refreshToken });
      if (rErr) lanzarLogin(fallback);
    } else {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) lanzarLogin(fallback);
    }
  } catch(e) {
    lanzarLogin(fallback);
  }
});

function lanzarLogin(fallback) {
  setTimeout(() => {
    if (!appIniciada) {
      if (fallback) clearTimeout(fallback);
      document.getElementById('splash').classList.add('hidden');
      showPage('login');
    }
  }, 400);
}

// ════════════════════════════════════════════════════════
// NAVEGACIÓN ENTRE PASOS DEL LOGIN
// ════════════════════════════════════════════════════════
function mostrarLoginStep(stepId) {
  document.querySelectorAll('.login-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(stepId);
  if (el) el.classList.add('active');
}

function irALogin()          { mostrarLoginStep('login-step-opciones'); }
function irARegistro()       { mostrarLoginStep('login-step-registro'); }
function volverAlInicio()    { mostrarLoginStep('login-step-inicio'); }
function volverAlRegistro()  { mostrarLoginStep('login-step-registro'); }
function volverATelefono()   { mostrarLoginStep('login-step-sms-tel'); }

// ════════════════════════════════════════════════════════
// 1. LOGIN CON GOOGLE
// ════════════════════════════════════════════════════════
async function loginConGoogle() {
  const btn = document.getElementById('btn-google');
  if (btn) { btn.textContent = 'Conectando...'; btn.disabled = true; }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://cierralo.mx/app', queryParams: { prompt: 'select_account', access_type: 'offline' } }
  });
  if (error) {
    showToast('❌ Error con Google: ' + error.message);
    if (btn) { btn.textContent = 'Continuar con Google'; btn.disabled = false; }
  }
}

async function loginConGoogleRegistro() {
  const btn = document.getElementById('btn-google-registro');
  if (btn) { btn.textContent = 'Conectando...'; btn.disabled = true; }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://cierralo.mx/app', queryParams: { prompt: 'select_account', access_type: 'offline' } }
  });
  if (error) {
    showToast('❌ Error con Google: ' + error.message);
    if (btn) { btn.textContent = 'Registrarme con Google'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════
// 2. REGISTRO — PASO 1: Enviar OTP por email
// El campo en HTML tiene id="sms-tel" (mismo ID, no cambiamos HTML)
// ════════════════════════════════════════════════════════
async function enviarOTP() {
  const emailInput = document.getElementById('sms-tel');
  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes('@') || !email.includes('.')) {
    showToast('⚠️ Ingresa un correo electrónico válido');
    return;
  }

  _loginEmail = email;

  const btn = document.getElementById('btn-enviar-otp');
  if (btn) { btn.textContent = 'Enviando código...'; btn.disabled = true; }

  // Supabase envía OTP de 6 dígitos al email — NO magic link
  const { error } = await sb.auth.signInWithOtp({
    email: email,
    options: { shouldCreateUser: true }
  });

  if (btn) { btn.textContent = 'Enviar código →'; btn.disabled = false; }

  if (error) {
    showToast('❌ ' + (error.message.includes('rate') || error.message.includes('limit')
      ? 'Espera un momento antes de reenviar'
      : error.message));
    return;
  }

  localStorage.setItem('cierralo_otp_email', email);
  const displayEl = document.getElementById('otp-tel-display');
  if (displayEl) displayEl.textContent = email;
  mostrarLoginStep('login-step-otp-verify');
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 200);
  showToast('📧 Código enviado a ' + email);
  iniciarContadorReenvio();
}

// ════════════════════════════════════════════════════════
// 2. REGISTRO — PASO 2: Verificar OTP de email
// ════════════════════════════════════════════════════════
async function verificarOTP() {
  // Si estamos en modo recuperación, delegar
  if (window._modoRecuperacion) { await _verificarOTPRecuperacion(); return; }

  const email = _loginEmail || localStorage.getItem('cierralo_otp_email');
  if (!email) { mostrarLoginStep('login-step-sms-tel'); return; }

  const codigo = getOtpValue();
  if (codigo.length < 6) { showToast('⚠️ Ingresa los 6 dígitos del código'); return; }

  const btn = document.getElementById('btn-verificar-otp');
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }

  const { data, error } = await sb.auth.verifyOtp({
    email: email,
    token: codigo,
    type:  'email'   // ← email OTP, no SMS
  });

  if (btn) { btn.textContent = 'Verificar →'; btn.disabled = false; }

  if (error) {
    showToast('❌ Código incorrecto o expirado.');
    limpiarOtp();
    setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 100);
    return;
  }

  // Email verificado — guardar sesión y pedir PIN
  window._authToken      = data.session.access_token;
  window._refreshToken   = data.session.refresh_token;
  window._currentUid     = data.user.id;
  window._emailVerificado = email;
  currentUser = data.user;

  // Ir a elegir PIN
  mostrarLoginStep('login-step-elegir-pin');
  setTimeout(() => { const el = document.getElementById('pin-n1'); if (el) el.focus(); }, 200);
  showToast('✅ Correo verificado — ahora elige tu PIN');
}

// ════════════════════════════════════════════════════════
// 2. REGISTRO — PASO 3: Guardar PIN
// ════════════════════════════════════════════════════════
async function guardarPinNuevo() {
  const email = window._emailVerificado || _loginEmail || localStorage.getItem('cierralo_otp_email');
  if (!email) { showToast('❌ Sesión perdida. Intenta de nuevo.'); mostrarLoginStep('login-step-inicio'); return; }

  const pin = getPinValue('pin-n1','pin-n2','pin-n3','pin-n4');
  if (pin.length < 4) { showToast('⚠️ Elige un PIN de 4 dígitos'); return; }

  const btn = document.getElementById('login-nuevo-btn');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  // Actualizar contraseña con el PIN elegido
  const { error } = await sb.auth.updateUser({ password: 'PIN_' + pin + '_' + email });

  if (btn) { btn.textContent = 'Empezar →'; btn.disabled = false; }

  if (error) {
    showToast('❌ Error al guardar PIN: ' + error.message);
    return;
  }

  localStorage.setItem('cierralo_login_email', email);
  localStorage.setItem('cierralo_ultimo_uso', String(Date.now()));
  appIniciada = true;
  showToast('✅ PIN guardado — ¡Bienvenido!');
  await loadVendedor();
}

// ════════════════════════════════════════════════════════
// 3. LOGIN CON PIN (usuarios ya registrados)
// Flujo: email + PIN → signInWithPassword
// ════════════════════════════════════════════════════════
async function confirmarPin() {
  const emailEl = document.getElementById('login-tel'); // mismo ID, no cambiamos HTML
  if (!emailEl) return;

  const email = emailEl.value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('⚠️ Ingresa tu correo electrónico'); return; }

  const pin = getPinValue('pin-1','pin-2','pin-3','pin-4');
  if (pin.length < 4) { showToast('⚠️ Ingresa los 4 dígitos de tu PIN'); return; }

  const btn = document.getElementById('login-pin-btn');
  if (btn) { btn.textContent = 'Entrando...'; btn.disabled = true; }

  const { data, error } = await sb.auth.signInWithPassword({
    email:    email,
    password: 'PIN_' + pin + '_' + email
  });

  if (btn) { btn.textContent = 'Entrar a Ciérralo →'; btn.disabled = false; }

  if (error) {
    showToast('❌ Correo o PIN incorrecto. ¿Olvidaste tu PIN?');
    limpiarPin('pin-1','pin-2','pin-3','pin-4');
    setTimeout(() => { const el = document.getElementById('pin-1'); if (el) el.focus(); }, 100);
    return;
  }

  window._authToken    = data.session.access_token;
  window._refreshToken = data.session.refresh_token;
  window._currentUid   = data.user.id;
  localStorage.setItem('cierralo_login_email', email);
  localStorage.setItem('cierralo_session', JSON.stringify({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token
  }));
  currentUser = data.user;
  appIniciada = true;
  await loadVendedor();
}

// registrarConPin — legacy, redirige al flujo nuevo
async function registrarConPin() {
  mostrarLoginStep('login-step-registro');
}

// ════════════════════════════════════════════════════════
// HELPERS — OTP
// ════════════════════════════════════════════════════════
function getOtpValue() {
  return ['otp-1','otp-2','otp-3','otp-4','otp-5','otp-6']
    .map(id => (document.getElementById(id)?.value || '').replace(/[^0-9]/g,'').slice(-1))
    .join('');
}

function limpiarOtp() {
  ['otp-1','otp-2','otp-3','otp-4','otp-5','otp-6'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
}

function otpInput(el, num) {
  const v = el.value.replace(/[^0-9]/g,'').slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if (v && num < 6) { const next = document.getElementById('otp-' + (num + 1)); if (next) next.focus(); }
  if (num === 6 && v) verificarOTP();
}

function otpKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('otp-' + num);
    if (el && !el.value && num > 1) { const prev = document.getElementById('otp-' + (num - 1)); if (prev) prev.focus(); }
  }
}

function iniciarContadorReenvio() {
  let seg = 60;
  const btn = document.getElementById('btn-reenviar-otp');
  if (!btn) return;
  btn.disabled = true;
  clearInterval(_reenvioInterval);
  _reenvioInterval = setInterval(() => {
    seg--;
    btn.textContent = `Reenviar (${seg}s)`;
    if (seg <= 0) { clearInterval(_reenvioInterval); btn.textContent = 'Reenviar código'; btn.disabled = false; }
  }, 1000);
}

async function reenviarOTP() {
  const email = _loginEmail || _recoveryEmail || localStorage.getItem('cierralo_otp_email');
  if (!email) return;
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('📧 Nuevo código enviado a ' + email);
  limpiarOtp();
  iniciarContadorReenvio();
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 100);
}

// ════════════════════════════════════════════════════════
// HELPERS — PIN
// ════════════════════════════════════════════════════════
function getPinValue(id1, id2, id3, id4) {
  return [id1, id2, id3, id4].map(id =>
    (document.getElementById(id)?.value || '').toString().replace(/[^0-9]/g,'').slice(-1)
  ).join('');
}

function limpiarPin(id1, id2, id3, id4) {
  [id1, id2, id3, id4].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
}

function pinInput(el, num) {
  const v = el.value.replace(/[^0-9]/g,'').slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if (v && num < 4) { const next = document.getElementById('pin-' + (num + 1)); if (next) next.focus(); }
  if (num === 4 && v) confirmarPin();
}

function pinKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('pin-' + num);
    if (el && !el.value && num > 1) { const prev = document.getElementById('pin-' + (num - 1)); if (prev) prev.focus(); }
  }
}

function pinNuevoInput(el, num) {
  const v = el.value.toString().replace(/[^0-9]/g,'').slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if (v && num < 4) { const next = document.getElementById('pin-n' + (num + 1)); if (next) next.focus(); }
  if (num === 4 && v) guardarPinNuevo();
}

function pinNuevoKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('pin-n' + num);
    if (el && !el.value && num > 1) { const prev = document.getElementById('pin-n' + (num - 1)); if (prev) prev.focus(); }
  }
}

// ════════════════════════════════════════════════════════
// CARGAR DATOS DEL VENDEDOR
// ════════════════════════════════════════════════════════
async function loadVendedor() {
  const userId = currentUser?.id || window._currentUid;
  if (!userId) { console.warn('[Auth] loadVendedor: sin userId'); return; }

  try {
    const { data, error } = await sbAuth().from('vendedores')
      .select('*').eq('id', userId).maybeSingle();

    if (error && error.code !== 'PGRST116') console.error('[Auth] Error cargando vendedor:', error);

    if (data && data.onboarding_completo) {
      vendedorData = data;
      populateApp();
      showPage('app');
      await cargarProspectos(userId);
      await cargarAutos(userId);
      window.dispatchEvent(new CustomEvent('cierralo:datosListos'));

    } else if (data) {
      vendedorData = data;
      _preLlenarNombreGoogle();
      showPage('onboarding');

    } else {
      const emailReal = currentUser?.email
        || window._emailVerificado
        || localStorage.getItem('cierralo_otp_email')
        || localStorage.getItem('cierralo_login_email')
        || null;

      const { data: nuevo, error: errInsert } = await sbAuth().from('vendedores')
        .insert({ id: userId, telefono: emailReal || 'sin-telefono', email: emailReal, plan: 'gratis', onboarding_completo: false })
        .select().single();

      if (errInsert) {
        if (errInsert.code === '23505') {
          const { data: reintento } = await sbAuth().from('vendedores').select('*').eq('id', userId).maybeSingle();
          if (reintento) {
            vendedorData = reintento;
            if (reintento.onboarding_completo) { populateApp(); showPage('app'); await cargarProspectos(userId); await cargarAutos(userId); }
            else { _preLlenarNombreGoogle(); showPage('onboarding'); }
            return;
          }
        }
      }

      vendedorData = nuevo || { id: userId, email: emailReal, onboarding_completo: false, plan: 'gratis' };
      _preLlenarNombreGoogle();
      showPage('onboarding');
    }
  } catch (e) {
    console.error('[Auth] Error en loadVendedor:', e);
    if (!vendedorData) vendedorData = { id: userId, onboarding_completo: false, plan: 'gratis' };
    showPage('onboarding');
  }
}

function _preLlenarNombreGoogle() {
  const nombreCompleto = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || '';
  if (nombreCompleto) { const el = document.getElementById('ob-nombre'); if (el && !el.value) el.value = nombreCompleto; }
}

// ════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════
function obNext1() {
  const nombre  = document.getElementById('ob-nombre')?.value.trim() || '';
  const agencia = document.getElementById('ob-agencia')?.value.trim() || '';
  if (!nombre)  { showToast('⚠️ Escribe tu nombre'); return; }
  if (!agencia) { showToast('⚠️ Escribe tu agencia'); return; }
  if (!vendedorData) vendedorData = {};
  vendedorData.nombre  = nombre;
  vendedorData.agencia = agencia;
  document.getElementById('ob-step1').style.display = 'none';
  document.getElementById('ob-step2').style.display = 'block';
}

function selectMeta(el, val) {
  document.querySelectorAll('#ob-meta-opts .ob-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  obMeta = val;
  const btn = document.getElementById('ob-btn2');
  if (btn) { btn.style.background = 'var(--orange)'; btn.style.color = 'white'; }
}

function obNext2() {
  if (!obMeta) return;
  if (!vendedorData) vendedorData = {};
  vendedorData.meta_mensual = obMeta;
  document.getElementById('ob-step2').style.display = 'none';
  document.getElementById('ob-step3').style.display = 'block';
}

function selectProblema(el, val) {
  document.querySelectorAll('#ob-step3 .ob-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  obProblema = val;
  const btn = document.getElementById('ob-btn3');
  if (btn) { btn.style.background = 'var(--orange)'; btn.style.color = 'white'; }
}

async function obFinish() {
  if (!obProblema) return;
  const btn = document.getElementById('ob-btn3');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
  const uid = currentUser?.id || window._currentUid;
  const emailReal = currentUser?.email || window._emailVerificado || localStorage.getItem('cierralo_otp_email') || null;

  const datosGuardar = {
    nombre:              vendedorData?.nombre  || '',
    agencia:             vendedorData?.agencia || '',
    meta_mensual:        obMeta    || 10,
    problema_principal:  obProblema,
    onboarding_completo: true,
    plan:                vendedorData?.plan || 'gratis',
    ultimo_acceso:       new Date().toISOString()
  };
  if (emailReal) datosGuardar.email = emailReal;

  const { error: errUpdate } = await sbAuth().from('vendedores').update(datosGuardar).eq('id', uid);
  if (errUpdate) {
    const { error: errUpsert } = await sbAuth().from('vendedores').upsert({ id: uid, telefono: emailReal || '', ...datosGuardar });
    if (errUpsert) { showToast('❌ Error: ' + errUpsert.message); if (btn) { btn.textContent = '¡Empezar a vender! 🚀'; btn.disabled = false; } return; }
  }

  if (!vendedorData) vendedorData = {};
  Object.assign(vendedorData, datosGuardar);
  if (btn) { btn.textContent = '¡Empezar a vender! 🚀'; btn.disabled = false; }
  populateApp();
  showPage('app');
  await cargarProspectos(uid);
  await cargarAutos(uid);
  if (typeof mostrarWrappedBanner === 'function') mostrarWrappedBanner();
}

// ════════════════════════════════════════════════════════
// POPULATE APP
// ════════════════════════════════════════════════════════
function populateApp() {
  if (!vendedorData) return;
  document.querySelectorAll('.modal-overlay, .confirm-overlay, .modal-metodo').forEach(m => m.classList.remove('open'));

  const nombre    = vendedorData.nombre || 'Vendedor';
  const iniciales = nombre.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  const meta      = vendedorData.meta_mensual || 10;

  document.querySelectorAll('#app-avatar, #perfil-av').forEach(el => el.textContent = iniciales);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dash-nombre', nombre + ' 👋');
  set('dash-sub',    'Bienvenido a Ciérralo.mx — tu asistente está listo');
  set('dash-meta',   meta);
  set('perfil-nombre',    nombre);
  set('perfil-agencia',   vendedorData.agencia || '—');
  set('perfil-email-item', vendedorData.email || currentUser?.email || '—');
  set('perfil-meta-item', meta + ' unidades este mes');

  if (typeof renderSemaforoWA    === 'function') renderSemaforoWA();
  if (typeof renderPerfilPublico === 'function') renderPerfilPublico();
  if (typeof actualizarCardPlan  === 'function') actualizarCardPlan();
}

// ════════════════════════════════════════════════════════
// SIGN OUT
// ════════════════════════════════════════════════════════
async function signOut() {
  window._signOutExplicito = true;
  localStorage.removeItem('cierralo_ultimo_uso');
  localStorage.removeItem('cierralo_session');
  localStorage.removeItem('cierralo_otp_email');
  localStorage.removeItem('cierralo_login_email');
  appIniciada  = false;
  currentUser  = null;
  vendedorData = null;
  obMeta       = null;
  obProblema   = null;
  await sb.auth.signOut();
  showPage('login');
  mostrarLoginStep('login-step-inicio');
}

// ════════════════════════════════════════════════════════
// RECUPERACIÓN DE PIN — ahora por email OTP
// ════════════════════════════════════════════════════════
let _recoveryEmail = '';

function mostrarRecuperacion() {
  _recoveryEmail = '';
  const emailEl = document.getElementById('recovery-tel');
  if (emailEl) emailEl.value = '';
  limpiarPin('rpin-1','rpin-2','rpin-3','rpin-4');
  limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  mostrarLoginStep('login-step-recovery-tel');
  setTimeout(() => { if (emailEl) emailEl.focus(); }, 100);
}

async function verificarTelRecuperacion() {
  const emailEl = document.getElementById('recovery-tel');
  if (!emailEl) return;
  const email = emailEl.value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('⚠️ Ingresa tu correo electrónico'); return; }

  const btn = document.getElementById('recovery-tel-btn');
  if (btn) { btn.textContent = 'Enviando código...'; btn.disabled = true; }

  // Verificar que existe en la BD
  const { data } = await sb.from('vendedores').select('id').eq('email', email).maybeSingle();
  if (!data) {
    showToast('❌ No encontramos una cuenta con ese correo.');
    if (btn) { btn.textContent = 'Continuar →'; btn.disabled = false; }
    return;
  }

  // Enviar OTP de recuperación
  const { error: otpErr } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (btn) { btn.textContent = 'Continuar →'; btn.disabled = false; }
  if (otpErr) { showToast('❌ Error: ' + otpErr.message); return; }

  _recoveryEmail = email;
  window._modoRecuperacion = true;
  const displayEl = document.getElementById('otp-tel-display');
  if (displayEl) displayEl.textContent = email;
  limpiarOtp();
  mostrarLoginStep('login-step-otp-verify');
  iniciarContadorReenvio();
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 200);
  showToast('📧 Código enviado a ' + email);
}

async function _verificarOTPRecuperacion() {
  const email  = _recoveryEmail;
  const codigo = getOtpValue();
  if (codigo.length < 6) { showToast('⚠️ Ingresa los 6 dígitos'); return; }

  const btn = document.getElementById('btn-verificar-otp');
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }

  const { data, error } = await sb.auth.verifyOtp({ email, token: codigo, type: 'email' });
  if (btn) { btn.textContent = 'Verificar →'; btn.disabled = false; }

  if (error) { showToast('❌ Código incorrecto o expirado.'); limpiarOtp(); return; }

  window._authToken      = data.session.access_token;
  window._refreshToken   = data.session.refresh_token;
  window._currentUid     = data.user.id;
  window._emailVerificado = email;
  currentUser = data.user;
  window._modoRecuperacion = false;

  limpiarPin('rpin-1','rpin-2','rpin-3','rpin-4');
  limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  mostrarLoginStep('login-step-recovery-pin');
  setTimeout(() => { const el = document.getElementById('rpin-1'); if (el) el.focus(); }, 100);
}

async function cambiarPin() {
  const pin     = getPinValue('rpin-1','rpin-2','rpin-3','rpin-4');
  const pinConf = getPinValue('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  if (pin.length < 4) { showToast('⚠️ Ingresa el nuevo PIN de 4 dígitos'); return; }
  if (pin !== pinConf) {
    showToast('❌ Los PINs no coinciden.');
    limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
    setTimeout(() => { const el = document.getElementById('rpin-c1'); if (el) el.focus(); }, 100);
    return;
  }

  const btn = document.getElementById('recovery-pin-btn');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  const email = window._emailVerificado || _recoveryEmail;
  try {
    const { error } = await sb.auth.updateUser({ password: 'PIN_' + pin + '_' + email });
    if (error) throw error;
    localStorage.setItem('cierralo_login_email', email);
    showToast('✅ PIN actualizado — ¡Bienvenido de vuelta!');
    appIniciada = true;
    await loadVendedor();
  } catch (err) {
    showToast('❌ Error al cambiar PIN. Intenta de nuevo.');
    if (btn) { btn.textContent = 'Guardar nuevo PIN →'; btn.disabled = false; }
  }
}

function pinRecInput(el, num) {
  const v = el.value.toString().replace(/[^0-9]/g,'').slice(-1);
  el.value = v; el.classList.toggle('filled', v !== '');
  if (v && num < 4) { const n = document.getElementById('rpin-' + (num+1)); if (n) n.focus(); }
}
function pinRecKeydown(e, num) {
  if (e.key === 'Backspace' && !(document.getElementById('rpin-'+num)?.value) && num > 1) {
    const p = document.getElementById('rpin-'+(num-1)); if (p) p.focus();
  }
}
function pinRecConfInput(el, num) {
  const v = el.value.toString().replace(/[^0-9]/g,'').slice(-1);
  el.value = v; el.classList.toggle('filled', v !== '');
  if (v && num < 4) { const n = document.getElementById('rpin-c'+(num+1)); if (n) n.focus(); }
  if (num === 4 && v) cambiarPin();
}
function pinRecConfKeydown(e, num) {
  if (e.key === 'Backspace' && !(document.getElementById('rpin-c'+num)?.value) && num > 1) {
    const p = document.getElementById('rpin-c'+(num-1)); if (p) p.focus();
  }
}

// ════════════════════════════════════════════════════════
// EVENTOS DE TECLADO
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const loginEmailEl = document.getElementById('login-tel');
  if (loginEmailEl) loginEmailEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pin-1')?.focus();
  });
  const emailOtpEl = document.getElementById('sms-tel');
  if (emailOtpEl) emailOtpEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') enviarOTP();
  });
});

// ════════════════════════════════════════════════════════
// DETECCIÓN SAFARI iOS — ocultar Google, mostrar aviso PIN
// ════════════════════════════════════════════════════════
(function detectarSafariIOS() {
  const ua = navigator.userAgent;
  const esIOS    = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const esSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (esIOS && esSafari) {
    document.addEventListener('DOMContentLoaded', () => {
      const googleWrap    = document.getElementById('google-login-wrap');
      const googleRegWrap = document.getElementById('google-registro-wrap');
      if (googleWrap)    googleWrap.style.display = 'none';
      if (googleRegWrap) googleRegWrap.style.display = 'none';
      const noticeLogin    = document.getElementById('iphone-pin-notice');
      const noticeRegistro = document.getElementById('iphone-pin-notice-registro');
      if (noticeLogin)    noticeLogin.style.display = 'block';
      if (noticeRegistro) noticeRegistro.style.display = 'block';
    });
  }
})();
