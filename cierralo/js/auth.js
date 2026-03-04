// ═══════════════════════════════════════════════════════════
// AUTH.JS — Ciérralo.mx
// Sistema: Google OAuth + SMS OTP + PIN legacy
// Sesión 13 — Marzo 2026
// Depende de: config.js (carga primero)
// ═══════════════════════════════════════════════════════════

// Variable para guardar teléfono durante flujo SMS
let _loginTelefono = '';
let _reenvioInterval = null;

// ════════════════════════════════════════════════════════
// INIT — al cargar la página
// ════════════════════════════════════════════════════════
window.addEventListener('load', async () => {
  // Salud de pantalla por si algo falla
  const fallback = setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    if (!appIniciada) showPage('login');
  }, 5000);

  // Hora del día en dashboard
  const h = new Date().getHours();
  const greetEl = document.getElementById('greeting-time');
  if (greetEl) {
    if (h < 12)      greetEl.textContent = 'Buenos días ☀️';
    else if (h < 19) greetEl.textContent = 'Buenas tardes 🌤️';
    else             greetEl.textContent = 'Buenas noches 🌙';
  }

  // Mes actual en dashboard
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesEl = document.getElementById('dash-mes');
  if (mesEl) mesEl.textContent = meses[new Date().getMonth()] + ' ' + new Date().getFullYear();

  // ── onAuthStateChange: ÚNICA fuente de verdad ──
  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth]', event, session?.user?.id || 'sin sesión');

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session?.user) {
        window._authToken    = session.access_token;
        window._refreshToken = session.refresh_token;
        window._currentUid   = session.user.id;
        localStorage.setItem('cierralo_session', JSON.stringify({
          access_token:  session.access_token,
          refresh_token: session.refresh_token
        }));
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
      // Supabase dispara SIGNED_OUT al renovar token — ignorar si no fue explícito
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

  // ── Restaurar sesión guardada ──
  const sesionRaw = localStorage.getItem('cierralo_session');
  if (sesionRaw) {
    try {
      const sesion = JSON.parse(sesionRaw);
      if (sesion?.refresh_token) {
        const { error } = await sb.auth.refreshSession({ refresh_token: sesion.refresh_token });
        if (error) {
          console.warn('[Auth] refreshSession falló:', error.message);
          clearTimeout(fallback);
          if (!appIniciada) {
            document.getElementById('splash').classList.add('hidden');
            showPage('login');
          }
        }
        // Si ok, onAuthStateChange dispara SIGNED_IN automáticamente
      } else {
        lanzarLogin(fallback);
      }
    } catch (e) {
      lanzarLogin(fallback);
    }
  } else {
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

function irALogin()   { mostrarLoginStep('login-step-opciones'); }
function irARegistro(){ mostrarLoginStep('login-step-registro'); }
function volverAlInicio() { mostrarLoginStep('login-step-inicio'); }
function volverAlRegistro() { mostrarLoginStep('login-step-registro'); }
function volverATelefono()  { mostrarLoginStep('login-step-sms-tel'); }

// ════════════════════════════════════════════════════════
// 1. LOGIN CON GOOGLE
// ════════════════════════════════════════════════════════
async function loginConGoogle() {
  const btn = document.getElementById('btn-google');
  if (btn) { btn.textContent = 'Conectando...'; btn.disabled = true; }

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { prompt: 'select_account' }
    }
  });

  if (error) {
    showToast('❌ Error con Google: ' + error.message);
    if (btn) { btn.textContent = '🔵 Continuar con Google'; btn.disabled = false; }
  }
  // Si no hay error, Google redirige y al regresar onAuthStateChange se dispara
}

async function loginConGoogleRegistro() {
  const btn = document.getElementById('btn-google-registro');
  if (btn) { btn.textContent = 'Conectando...'; btn.disabled = true; }

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { prompt: 'select_account' }
    }
  });

  if (error) {
    showToast('❌ Error con Google: ' + error.message);
    if (btn) { btn.textContent = '🔵 Registrarme con Google'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════
// 2. LOGIN/REGISTRO CON SMS OTP
// ════════════════════════════════════════════════════════
// Paso 1: pedir número y enviar OTP
async function enviarOTP() {
  const telInput = document.getElementById('sms-tel');
  if (!telInput) return;
  const raw = telInput.value.replace(/[\s\-]/g, '').replace(/[^0-9]/g, '');
  if (raw.length < 8) { showToast('⚠️ Ingresa tu número de WhatsApp'); return; }

  const telefono = '+52' + raw.replace(/^52/, '');
  _loginTelefono = telefono;

  const btn = document.getElementById('btn-enviar-otp');
  if (btn) { btn.textContent = 'Enviando código...'; btn.disabled = true; }

  const { error } = await sb.auth.signInWithOtp({
    phone: telefono,
    options: { shouldCreateUser: true }
  });

  if (btn) { btn.textContent = 'Enviar código SMS →'; btn.disabled = false; }

  if (error) {
    showToast('❌ ' + (error.message.includes('limit') ? 'Espera un momento antes de reenviar' : error.message));
    return;
  }

  localStorage.setItem('cierralo_otp_tel', telefono);

  // Mostrar pantalla de verificación
  const displayEl = document.getElementById('otp-tel-display');
  if (displayEl) displayEl.textContent = telefono;
  mostrarLoginStep('login-step-otp-verify');
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 200);
  showToast('📱 Código enviado por SMS');
  iniciarContadorReenvio();
}

// Paso 2: verificar código OTP
async function verificarOTP() {
  const telefono = _loginTelefono || localStorage.getItem('cierralo_otp_tel');
  if (!telefono) { mostrarLoginStep('login-step-sms-tel'); return; }

  const codigo = getOtpValue();
  if (codigo.length < 6) { showToast('⚠️ Ingresa los 6 dígitos del código'); return; }

  const btn = document.getElementById('btn-verificar-otp');
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }

  const { data, error } = await sb.auth.verifyOtp({
    phone: telefono,
    token: codigo,
    type:  'sms'
  });

  if (btn) { btn.textContent = 'Verificar →'; btn.disabled = false; }

  if (error) {
    showToast('❌ Código incorrecto o expirado.');
    limpiarOtp();
    setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 100);
    return;
  }

  // Sesión creada — onAuthStateChange dispara SIGNED_IN → loadVendedor()
  window._authToken    = data.session.access_token;
  window._refreshToken = data.session.refresh_token;
  window._currentUid   = data.user.id;
  localStorage.setItem('cierralo_session', JSON.stringify({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token
  }));
  currentUser = data.user;
  appIniciada = true;
  await loadVendedor();
}

// ════════════════════════════════════════════════════════
// 3. LOGIN CON PIN (usuarios legacy / ya registrados)
// ════════════════════════════════════════════════════════
async function confirmarPin() {
  const telEl = document.getElementById('login-tel');
  if (!telEl) return;
  const raw = telEl.value.replace(/[\s\-]/g, '').replace(/[^0-9]/g, '');
  if (raw.length < 8) { showToast('⚠️ Ingresa tu número'); return; }
  _loginTelefono = '+52' + raw.replace(/^52/, '');

  const pin = getPinValue('pin-1','pin-2','pin-3','pin-4');
  if (pin.length < 4) { showToast('⚠️ Ingresa los 4 dígitos de tu PIN'); return; }

  const btn = document.getElementById('login-pin-btn');
  if (btn) { btn.textContent = 'Entrando...'; btn.disabled = true; }

  const emailFake = 'tel' + _loginTelefono.replace('+','') + '@gmail.com';

  const { data, error } = await sb.auth.signInWithPassword({
    email:    emailFake,
    password: 'PIN_' + pin + '_' + _loginTelefono
  });

  if (btn) { btn.textContent = 'Entrar a Ciérralo →'; btn.disabled = false; }

  if (error) {
    showToast('❌ Número o PIN incorrecto. ¿Olvidaste tu PIN?');
    limpiarPin('pin-1','pin-2','pin-3','pin-4');
    setTimeout(() => { const el = document.getElementById('pin-1'); if (el) el.focus(); }, 100);
    return;
  }

  window._authToken    = data.session.access_token;
  window._refreshToken = data.session.refresh_token;
  window._currentUid   = data.user.id;
  localStorage.setItem('cierralo_session', JSON.stringify({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token
  }));
  currentUser = data.user;
  appIniciada = true;
  await loadVendedor();
}

// PIN legacy — registro nuevo (usuarios que ya tienen cuenta pin)
async function registrarConPin() {
  const telEl = document.getElementById('login-tel-nuevo');
  if (!telEl) return;
  const raw = telEl.value.replace(/[\s\-]/g, '').replace(/[^0-9]/g, '');
  if (raw.length < 8) { showToast('⚠️ Ingresa tu número de WhatsApp'); return; }
  _loginTelefono = '+52' + raw.replace(/^52/, '');

  const pin = getPinValue('pin-n1','pin-n2','pin-n3','pin-n4');
  if (pin.length < 4) { showToast('⚠️ Elige un PIN de 4 dígitos'); return; }

  const btn = document.getElementById('login-nuevo-btn');
  if (btn) { btn.textContent = 'Creando cuenta...'; btn.disabled = true; }

  const emailFake = 'tel' + _loginTelefono.replace('+','') + '@gmail.com';
  const password  = 'PIN_' + pin + '_' + _loginTelefono;

  const { data, error } = await sb.auth.signUp({ email: emailFake, password });

  if (btn) { btn.textContent = 'Crear cuenta →'; btn.disabled = false; }

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      showToast('⚠️ Ya tienes cuenta. Usa "Tengo cuenta → Entrar con PIN"');
    } else {
      showToast('❌ Error: ' + error.message);
    }
    return;
  }

  // Puede que Supabase requiera login después del signUp
  if (!data.session) {
    const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email: emailFake, password });
    if (loginErr) { showToast('❌ ' + loginErr.message); return; }
    window._authToken    = loginData.session.access_token;
    window._refreshToken = loginData.session.refresh_token;
    window._currentUid   = loginData.user.id;
    localStorage.setItem('cierralo_session', JSON.stringify({
      access_token:  loginData.session.access_token,
      refresh_token: loginData.session.refresh_token
    }));
    currentUser = loginData.user;
  } else {
    window._authToken    = data.session.access_token;
    window._refreshToken = data.session.refresh_token;
    window._currentUid   = data.user.id;
    localStorage.setItem('cierralo_session', JSON.stringify({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token
    }));
    currentUser = data.user;
  }

  appIniciada = true;
  await loadVendedor();
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
  if (v && num < 6) {
    const next = document.getElementById('otp-' + (num + 1));
    if (next) next.focus();
  }
  if (num === 6 && v) verificarOTP();
}

function otpKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('otp-' + num);
    if (el && !el.value && num > 1) {
      const prev = document.getElementById('otp-' + (num - 1));
      if (prev) prev.focus();
    }
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
    if (seg <= 0) {
      clearInterval(_reenvioInterval);
      btn.textContent = 'Reenviar código';
      btn.disabled = false;
    }
  }, 1000);
}

async function reenviarOTP() {
  const telefono = _loginTelefono || localStorage.getItem('cierralo_otp_tel');
  if (!telefono) return;
  const { error } = await sb.auth.signInWithOtp({ phone: telefono });
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('📱 Nuevo código enviado');
  limpiarOtp();
  iniciarContadorReenvio();
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 100);
}

// ════════════════════════════════════════════════════════
// HELPERS — PIN
// ════════════════════════════════════════════════════════
function getPinValue(id1, id2, id3, id4) {
  return [id1, id2, id3, id4].map(id => {
    const raw = (document.getElementById(id)?.value || '').toString();
    return raw.replace(/[^0-9]/g,'').slice(-1);
  }).join('');
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
  if (v && num < 4) {
    const next = document.getElementById('pin-' + (num + 1));
    if (next) next.focus();
  }
  if (num === 4 && v) confirmarPin();
}

function pinKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('pin-' + num);
    if (el && !el.value && num > 1) {
      const prev = document.getElementById('pin-' + (num - 1));
      if (prev) prev.focus();
    }
  }
}

function pinNuevoInput(el, num) {
  const v = el.value.toString().replace(/[^0-9]/g,'').slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if (v && num < 4) {
    const next = document.getElementById('pin-n' + (num + 1));
    if (next) next.focus();
  }
}

function pinNuevoKeydown(e, num) {
  if (e.key === 'Backspace') {
    const el = document.getElementById('pin-n' + num);
    if (el && !el.value && num > 1) {
      const prev = document.getElementById('pin-n' + (num - 1));
      if (prev) prev.focus();
    }
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

    if (error && error.code !== 'PGRST116') {
      console.error('[Auth] Error cargando vendedor:', error);
    }

    if (data && data.onboarding_completo) {
      vendedorData = data;
      populateApp();
      showPage('app');
      await cargarProspectos(userId);
      await cargarAutos(userId);
      window.dispatchEvent(new CustomEvent('cierralo:datosListos'));

    } else if (data) {
      // Tiene registro pero no terminó onboarding
      vendedorData = data;
      _preLlenarNombreGoogle();
      showPage('onboarding');

    } else {
      // Usuario nuevo — crear registro
      const esGoogle    = currentUser?.app_metadata?.provider === 'google';
      const emailReal   = esGoogle ? (currentUser?.email || null) : null;
      const telefonoReg = _loginTelefono
        || currentUser?.phone
        || localStorage.getItem('cierralo_otp_tel')
        || '';

      const { data: nuevo, error: errInsert } = await sbAuth().from('vendedores')
        .insert({
          id:                  userId,
          telefono:            telefonoReg,
          email:               emailReal,
          plan:                'free',
          onboarding_completo: false
        })
        .select().single();

      if (errInsert) {
        console.error('[Auth] Error creando vendedor:', errInsert);
        // Si es duplicado (ya existe), cargar el existente
        if (errInsert.code === '23505') {
          const { data: reintento } = await sbAuth().from('vendedores')
            .select('*').eq('id', userId).maybeSingle();
          if (reintento) {
            vendedorData = reintento;
            if (reintento.onboarding_completo) {
              populateApp(); showPage('app');
              await cargarProspectos(userId);
              await cargarAutos(userId);
            } else {
              _preLlenarNombreGoogle();
              showPage('onboarding');
            }
            return;
          }
        }
      }

      vendedorData = nuevo || {
        id: userId, telefono: telefonoReg, email: emailReal,
        onboarding_completo: false, plan: 'free'
      };

      _preLlenarNombreGoogle();
      showPage('onboarding');
    }

  } catch (e) {
    console.error('[Auth] Error en loadVendedor:', e);
    if (!vendedorData) {
      vendedorData = { id: userId, onboarding_completo: false, plan: 'free' };
    }
    showPage('onboarding');
  }
}

// Pre-llenar nombre si viene de Google
function _preLlenarNombreGoogle() {
  const nombreCompleto = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || '';
  if (nombreCompleto) {
    const el = document.getElementById('ob-nombre');
    if (el && !el.value) el.value = nombreCompleto;
  }
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

  const datosGuardar = {
    nombre:              vendedorData?.nombre  || '',
    agencia:             vendedorData?.agencia || '',
    meta_mensual:        obMeta    || 10,
    problema_principal:  obProblema,
    onboarding_completo: true,
    plan:                vendedorData?.plan || 'free',
    ultimo_acceso:       new Date().toISOString()
  };

  // Guardar email capturado si es usuario SMS
  const emailCapturado = document.getElementById('ob-email')?.value.trim();
  if (emailCapturado) datosGuardar.email = emailCapturado;

  const { error: errUpdate } = await sbAuth().from('vendedores')
    .update(datosGuardar).eq('id', uid);

  if (errUpdate) {
    // Intentar upsert como fallback
    const { error: errUpsert } = await sbAuth().from('vendedores').upsert({
      id: uid,
      telefono: _loginTelefono || vendedorData?.telefono || '',
      ...datosGuardar
    });
    if (errUpsert) {
      showToast('❌ Error: ' + errUpsert.message);
      if (btn) { btn.textContent = '¡Empezar a vender! 🚀'; btn.disabled = false; }
      return;
    }
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
// POPULATE APP — llenar UI con datos del vendedor
// ════════════════════════════════════════════════════════
function populateApp() {
  if (!vendedorData) return;

  // Cerrar modales al entrar a la app
  document.querySelectorAll('.modal-overlay, .confirm-overlay, .modal-metodo').forEach(m => {
    m.classList.remove('open');
  });

  const nombre    = vendedorData.nombre || 'Vendedor';
  const iniciales = nombre.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  const meta      = vendedorData.meta_mensual || 10;

  document.querySelectorAll('#app-avatar, #perfil-av').forEach(el => el.textContent = iniciales);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dash-nombre', nombre + ' 👋');
  set('dash-sub',    'Bienvenido a Ciérralo.mx — tu asistente está listo');
  set('dash-meta',   meta);
  set('perfil-nombre',  nombre);
  set('perfil-agencia', vendedorData.agencia || '—');
  set('perfil-email-item',
    vendedorData.telefono || vendedorData.email || currentUser?.email || '—');
  set('perfil-meta-item', meta + ' unidades este mes');

  if (typeof renderSemaforoWA     === 'function') renderSemaforoWA();
  if (typeof renderPerfilPublico  === 'function') renderPerfilPublico();
  if (typeof actualizarCardPlan   === 'function') actualizarCardPlan();
}

// ════════════════════════════════════════════════════════
// SIGN OUT
// ════════════════════════════════════════════════════════
async function signOut() {
  window._signOutExplicito = true;
  localStorage.removeItem('cierralo_session');
  localStorage.removeItem('cierralo_otp_tel');
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
// RECUPERACIÓN DE PIN (legacy)
// ════════════════════════════════════════════════════════
let _recoveryTelefono = '';

function mostrarRecuperacion() {
  _recoveryTelefono = '';
  const telEl = document.getElementById('recovery-tel');
  if (telEl) telEl.value = '';
  limpiarPin('rpin-1','rpin-2','rpin-3','rpin-4');
  limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  mostrarLoginStep('login-step-recovery-tel');
  setTimeout(() => { if (telEl) telEl.focus(); }, 100);
}

async function verificarTelRecuperacion() {
  const telEl = document.getElementById('recovery-tel');
  if (!telEl) return;
  const raw = telEl.value.replace(/[\s\-]/g,'').replace(/[^0-9]/g,'');
  if (raw.length < 8) { showToast('⚠️ Ingresa tu número'); return; }
  _recoveryTelefono = '+52' + raw.replace(/^52/,'');

  const btn = document.getElementById('recovery-tel-btn');
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }

  const { data, error } = await sb.from('vendedores')
    .select('id, nombre').eq('telefono', _recoveryTelefono).single();

  if (btn) { btn.textContent = 'Continuar →'; btn.disabled = false; }

  if (error || !data) {
    showToast('❌ No encontramos una cuenta con ese número.');
    return;
  }

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

  const emailFake    = 'tel' + _recoveryTelefono.replace('+','') + '@gmail.com';
  const nuevaPassword = 'PIN_' + pin + '_' + _recoveryTelefono;

  try {
    const resp = await fetch('https://nkjradximipkrzscgvhv.supabase.co/functions/v1/recuperar-pin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telefono: _recoveryTelefono, nuevo_pin: pin })
    });
    const result = await resp.json();
    if (!resp.ok || result.error) throw new Error(result.error || 'Error al cambiar PIN');

    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({
      email: emailFake, password: nuevaPassword
    });
    if (loginError) throw loginError;

    window._authToken    = loginData.session.access_token;
    window._refreshToken = loginData.session.refresh_token;
    window._currentUid   = loginData.user.id;
    localStorage.setItem('cierralo_session', JSON.stringify({
      access_token:  loginData.session.access_token,
      refresh_token: loginData.session.refresh_token
    }));
    currentUser = loginData.user;
    appIniciada = true;
    showToast('✅ PIN actualizado — ¡Bienvenido de vuelta!');
    await loadVendedor();
  } catch (err) {
    showToast('❌ Error al cambiar PIN. Intenta de nuevo.');
    console.error('[Auth] cambiarPin error:', err);
    if (btn) { btn.textContent = 'Guardar nuevo PIN →'; btn.disabled = false; }
  }
}

// Helpers PIN recovery
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

// Enter en campos de texto para avanzar
document.addEventListener('DOMContentLoaded', () => {
  const loginTelEl = document.getElementById('login-tel');
  if (loginTelEl) loginTelEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pin-1')?.focus();
  });

  const smsTelEl = document.getElementById('sms-tel');
  if (smsTelEl) smsTelEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') enviarOTP();
  });
});
