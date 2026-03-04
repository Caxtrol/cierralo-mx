// ═══════════════════════════════════════════════════════════
// AUTH.JS — Inicio de app, Login PIN, Registro, Onboarding
// Depende de: config.js
// ═══════════════════════════════════════════════════════════


const GROQ_KEY = 'TU_GROQ_API_KEY_AQUI'; // ← Sesión 5: pega tu key aquí




window.addEventListener('load', async () => {
  // Fallback: si en 5s nada cargó, mostrar login
  const fallback = setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    if(!appIniciada) showPage('login');
  }, 5000);

  const h = new Date().getHours();
  const greetEl = document.getElementById('greeting-time');
  if(h<12) greetEl.textContent='Buenos días ☀️';
  else if(h<19) greetEl.textContent='Buenas tardes 🌤️';
  else greetEl.textContent='Buenas noches 🌙';

  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesEl=document.getElementById('dash-mes');
  if(mesEl) mesEl.textContent=meses[new Date().getMonth()]+' '+new Date().getFullYear();

  // ── onAuthStateChange: única fuente de verdad para el estado de sesión ──
  // Supabase lo dispara automáticamente al cargar si hay refresh_token válido
  sb.auth.onAuthStateChange(async(event, session)=>{
    console.log('Auth:', event, session?.user?.id || 'sin sesión');

    if(event==='SIGNED_IN' || event==='TOKEN_REFRESHED'){
      if(session?.user){
        // Guardar tokens frescos en localStorage Y en memoria
        // La memoria sobrevive a los SIGNED_OUT automáticos de Supabase
        window._authToken = session.access_token;
        window._refreshToken = session.refresh_token;
        window._currentUid = session.user.id; // Backup uid que sobrevive a SIGNED_OUT
        localStorage.setItem('cierralo_session', JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        }));
        currentUser = session.user;
        if(!appIniciada){
          appIniciada = true;
          clearTimeout(fallback);
          document.getElementById('splash').classList.add('hidden');
          await loadVendedor();
        }
      }
    }

    if(event==='SIGNED_OUT'){
      // Solo cerrar sesión si el usuario lo pidió explícitamente
      // Los SIGNED_OUT automáticos de Supabase durante refresh se ignoran
      if(window._signOutExplicito){
        window._signOutExplicito = false;
        appIniciada = false;
        currentUser = null;
        vendedorData = null;
        obMeta = null;
        obProblema = null;
        localStorage.removeItem('cierralo_session');
        clearTimeout(fallback);
        document.getElementById('splash').classList.add('hidden');
        showPage('login');
      }
    }
  });

  // ── Restaurar sesión con refresh_token guardado ──
  // No dependemos de Supabase internal storage — usamos nuestro propio localStorage
  // El refresh_token dura 60 días y es el que permite recuperar la sesión
  const sesionRaw = localStorage.getItem('cierralo_session');
  if(sesionRaw){
    try {
      const sesion = JSON.parse(sesionRaw);
      if(sesion?.refresh_token){
        // refreshSession con nuestro refresh_token — dispara SIGNED_IN si es válido
        const { error } = await sb.auth.refreshSession({ refresh_token: sesion.refresh_token });
        if(error){
          console.warn('refreshSession falló:', error.message);
          // Token expirado o inválido — mostrar login
          setTimeout(() => {
            if(!appIniciada){
              clearTimeout(fallback);
              document.getElementById('splash').classList.add('hidden');
              showPage('login');
            }
          }, 500);
        }
        // Si refreshSession OK → onAuthStateChange dispara SIGNED_IN → loadVendedor()
      } else {
        setTimeout(() => { if(!appIniciada){ clearTimeout(fallback); document.getElementById('splash').classList.add('hidden'); showPage('login'); } }, 500);
      }
    } catch(e){
      setTimeout(() => { if(!appIniciada){ clearTimeout(fallback); document.getElementById('splash').classList.add('hidden'); showPage('login'); } }, 500);
    }
  } else {
    // Sin sesión guardada — mostrar login
    setTimeout(() => {
      if(!appIniciada){
        clearTimeout(fallback);
        document.getElementById('splash').classList.add('hidden');
        showPage('login');
      }
    }, 500);
  }
});

// ── Variables de estado del login ──

// ── Navegación entre pasos ──
function irALogin(){
  limpiarPin('pin-1','pin-2','pin-3','pin-4');
  document.getElementById('login-tel').value = '';
  mostrarLoginStep('login-step-tel');
  setTimeout(()=>document.getElementById('login-tel').focus(), 100);
}
function irARegistro(){
  limpiarPin('pin-n1','pin-n2','pin-n3','pin-n4');
  document.getElementById('login-tel-nuevo').value = '';
  mostrarLoginStep('login-step-pin-nuevo');
  setTimeout(()=>document.getElementById('login-tel-nuevo').focus(), 100);
}

// ── PASO 2A: login con PIN existente ──
async function confirmarPin(){
  const tel = document.getElementById('login-tel').value.replace(/\s/g,'').trim();
  if(tel.length < 8){ showToast('⚠️ Ingresa tu número'); return; }
  _loginTelefono = '+52' + tel.replace(/^\+52/,'');

  const pin = getPinValue('pin-1','pin-2','pin-3','pin-4');
  if(pin.length < 4){ showToast('⚠️ Ingresa los 4 dígitos'); return; }

  const btn = document.getElementById('login-pin-btn');
  btn.textContent = 'Entrando...'; btn.disabled = true;

  const emailFake = 'tel' + _loginTelefono.replace('+','') + '@gmail.com';
  const {data, error} = await sb.auth.signInWithPassword({
    email: emailFake,
    password: 'PIN_' + pin + '_' + _loginTelefono
  });

  if(error){
    showToast('❌ Número o PIN incorrecto. Intenta de nuevo.');
    limpiarPin('pin-1','pin-2','pin-3','pin-4');
    btn.textContent = 'Entrar a Ciérralo →'; btn.disabled = false;
    setTimeout(()=>document.getElementById('pin-1').focus(), 100);
    return;
  }

  localStorage.setItem('cierralo_session', JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  }));
  currentUser = data.user;
  appIniciada = true;
  await loadVendedor();
}

// ── PASO 2B: registro con PIN nuevo ──
async function registrarConPin(){
  const tel = document.getElementById('login-tel-nuevo').value.replace(/\s/g,'').trim();
  if(tel.length < 8){ showToast('⚠️ Ingresa tu número'); return; }
  _loginTelefono = '+52' + tel.replace(/^\+52/,'');

  const pin = getPinValue('pin-n1','pin-n2','pin-n3','pin-n4');
  if(pin.length < 4){ showToast('⚠️ Ingresa los 4 dígitos'); return; }

  const btn = document.getElementById('login-nuevo-btn');
  btn.textContent = 'Creando cuenta...'; btn.disabled = true;

  const emailFake = 'tel' + _loginTelefono.replace('+','') + '@gmail.com';
  const password = 'PIN_' + pin + '_' + _loginTelefono;

  // Intentar signUp
  const {data: signUpData, error: signUpError} = await sb.auth.signUp({
    email: emailFake,
    password: password
  });

  // Si ya existe el usuario, intentar login directamente
  if(signUpError && signUpError.message.includes('already registered')){
    showToast('⚠️ Este número ya tiene cuenta. Usa tu PIN.');
    mostrarLoginStep('login-step-pin');
    document.getElementById('pin-1').value='';
    document.getElementById('pin-2').value='';
    document.getElementById('pin-3').value='';
    document.getElementById('pin-4').value='';
    btn.textContent = 'Crear cuenta →'; btn.disabled = false;
    setTimeout(()=>document.getElementById('pin-1').focus(), 100);
    return;
  }

  if(signUpError){
    showToast('❌ ' + signUpError.message);
    btn.textContent = 'Crear cuenta →'; btn.disabled = false;
    return;
  }

  // Si el signUp devuelve sesión directa (confirm email OFF), usarla
  if(signUpData.session){
    localStorage.setItem('cierralo_session', JSON.stringify({
      access_token: signUpData.session.access_token,
      refresh_token: signUpData.session.refresh_token
    }));
    currentUser = signUpData.user;
    appIniciada = true;
    await loadVendedor();
    return;
  }

  // Fallback: pequeña pausa y luego signIn
  await new Promise(r => setTimeout(r, 800));
  const {data: loginData, error: loginError} = await sb.auth.signInWithPassword({
    email: emailFake,
    password: password
  });

  if(loginError){
    showToast('✅ Cuenta creada. Ingresa tu número y PIN para entrar.');
    mostrarLoginStep('login-step-tel');
    btn.textContent = 'Crear cuenta →'; btn.disabled = false;
    return;
  }

  localStorage.setItem('cierralo_session', JSON.stringify({
    access_token: loginData.session.access_token,
    refresh_token: loginData.session.refresh_token
  }));
  currentUser = loginData.user;
  appIniciada = true;
  await loadVendedor();
}

// ── Helpers del PIN ──
function getPinValue(id1,id2,id3,id4){
  return [id1,id2,id3,id4].map(id=>{
    const raw = document.getElementById(id).value.toString();
    // Limpiar smart quotes y caracteres no numericos de iOS
    const v = raw.replace(/[^0-9]/g, '');
    return v ? v.slice(-1) : '';
  }).join('');
}
function limpiarPin(id1,id2,id3,id4){
  [id1,id2,id3,id4].forEach(id=>{
    document.getElementById(id).value='';
    document.getElementById(id).classList.remove('filled');
  });
}
function pinInput(el, num){
  // Limpiar smart quotes y no numericos antes de procesar
  const raw = el.value.toString().replace(/[^0-9]/g, '');
  const v = raw.slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if(v && num < 4) document.getElementById('pin-'+(num+1)).focus();
  if(num===4 && v) confirmarPin();
}
function pinKeydown(e, num){
  if(e.key==='Backspace' && !document.getElementById('pin-'+num).value && num > 1){
    document.getElementById('pin-'+(num-1)).focus();
  }
}
function pinNuevoInput(el, num){
  const v = el.value.toString().slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if(v && num < 4) document.getElementById('pin-n'+(num+1)).focus();
  if(num===4 && v) registrarConPin();
}
function pinNuevoKeydown(e, num){
  if(e.key==='Backspace' && !document.getElementById('pin-n'+num).value && num > 1){
    document.getElementById('pin-n'+(num-1)).focus();
  }
}
function mostrarLoginStep(stepId){
  document.querySelectorAll('.login-step').forEach(s=>s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
}
function volverAlTelefono(){
  mostrarLoginStep('login-step-tel');
}
function mostrarRecuperacion(){
  showToast('📱 Contacta soporte en cierralo.mx para recuperar tu PIN');
}

async function loadVendedor(){
  // Capturar userId localmente — currentUser puede cambiar durante operaciones async
  const userId = currentUser?.id;
  if(!userId){ console.warn('loadVendedor: sin userId'); return; }
  try {
    const {data, error}=await sb.from('vendedores').select('*').eq('id',userId).maybeSingle();
    if(error) console.error('Error cargando vendedor:', error);

    if(data && data.onboarding_completo){
      vendedorData=data;
      populateApp();
      showPage('app');
      await cargarProspectos(userId);
      await cargarAutos(userId);
      // Disparar evento para que el motor de alertas arranque con datos listos
      window.dispatchEvent(new CustomEvent('cierralo:datosListos'));
    } else if(data){
      vendedorData=data;
      showPage('onboarding');
    } else {
      // Crear vendedor nuevo
      // El teléfono real está en _loginTelefono (guardado durante el login)
      const telefonoReal = _loginTelefono || currentUser?.email;
      const {data:nuevo, error:errInsert}=await sb.from('vendedores')
        .insert({id:userId, telefono:telefonoReal, onboarding_completo:false})
        .select().single();
      if(errInsert) console.error('Error creando vendedor:', errInsert);
      vendedorData = nuevo || {id:currentUser.id, telefono:telefonoReal, onboarding_completo:false};
      showPage('onboarding');
    }
  } catch(e) {
    console.error('Error en loadVendedor:', e);
    // Solo ir a onboarding si realmente no hay datos — no por errores de JS posteriores
    if(!vendedorData) {
      showPage('onboarding');
      vendedorData = {id:currentUser?.id, telefono:currentUser?.email, onboarding_completo:false};
    }
    // Si vendedorData existe, ya estamos en la app — ignorar el error secundario
  }
}

function obNext1(){
  const nombre=document.getElementById('ob-nombre').value.trim();
  const agencia=document.getElementById('ob-agencia').value.trim();
  if(!nombre){showToast('⚠️ Escribe tu nombre');return;}
  if(!agencia){showToast('⚠️ Escribe tu agencia');return;}
  // Guardar en memoria aunque vendedorData sea básico
  if(!vendedorData) vendedorData={};
  vendedorData.nombre=nombre;
  vendedorData.agencia=agencia;
  document.getElementById('ob-step1').style.display='none';
  document.getElementById('ob-step2').style.display='block';
}

function selectMeta(el,val){
  document.querySelectorAll('#ob-meta-opts .ob-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); obMeta=val;
  const btn=document.getElementById('ob-btn2');
  btn.style.background='var(--orange)'; btn.style.color='white';
}

function obNext2(){
  if(!obMeta) return;
  vendedorData.meta_mensual=obMeta;
  document.getElementById('ob-step2').style.display='none';
  document.getElementById('ob-step3').style.display='block';
}

function selectProblema(el,val){
  document.querySelectorAll('#ob-step3 .ob-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); obProblema=val;
  const btn=document.getElementById('ob-btn3');
  btn.style.background='var(--orange)'; btn.style.color='white';
}

async function obFinish(){
  if(!obProblema) return;
  const btn=document.getElementById('ob-btn3');
  btn.textContent='Guardando...'; btn.disabled=true;

  const datosGuardar = {
    nombre: vendedorData?.nombre || '',
    agencia: vendedorData?.agencia || '',
    meta_mensual: obMeta || 10,
    problema_principal: obProblema,
    onboarding_completo: true,
    ultimo_acceso: new Date().toISOString()
  };

  // Intentar UPDATE primero
  const {error:errUpdate} = await sb.from('vendedores')
    .update(datosGuardar)
    .eq('id', currentUser.id);

  if(errUpdate){
    // Si falla el update, intentar UPSERT
    const {error:errUpsert} = await sb.from('vendedores')
      .upsert({id: currentUser.id, telefono: currentUser.email, ...datosGuardar});
    if(errUpsert){
      showToast('❌ Error: '+errUpsert.message);
      btn.textContent='¡Empezar a vender! 🚀';
      btn.disabled=false;
      return;
    }
  }

  // Actualizar datos locales
  if(!vendedorData) vendedorData = {};
  Object.assign(vendedorData, datosGuardar);
  populateApp();
  showPage('app');
  // Cargar datos reales
  await cargarProspectos();
  await cargarAutos();
  mostrarWrappedBanner();
}

function populateApp(){
  if(!vendedorData) return;
  // Cerrar modales que pudieran haber quedado abiertos de sesión anterior
  document.querySelectorAll('.modal-overlay, .confirm-overlay, .modal-metodo').forEach(m => m.classList.remove('open'));
  const nombre=vendedorData.nombre||'Vendedor';
  const iniciales=nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  const meta=vendedorData.meta_mensual||10;
  document.querySelectorAll('#app-avatar,#perfil-av').forEach(el=>el.textContent=iniciales);
  const el=id=>document.getElementById(id);
  if(el('dash-nombre')) el('dash-nombre').textContent=nombre+' 👋';
  if(el('dash-sub')) el('dash-sub').textContent='Bienvenido a Ciérralo.mx — tu asistente está listo';
  if(el('dash-meta')) el('dash-meta').textContent=meta;
  if(el('perfil-nombre')) el('perfil-nombre').textContent=nombre;
  if(el('perfil-agencia')) el('perfil-agencia').textContent=vendedorData.agencia||'—';
  if(el('perfil-email-item')) el('perfil-email-item').textContent=vendedorData.telefono||currentUser?.email||'—';
  if(el('perfil-meta-item')) el('perfil-meta-item').textContent=meta+' unidades este mes';
  renderSemaforoWA();
  renderPerfilPublico();
  if(typeof actualizarCardPlan === 'function') actualizarCardPlan();
}


async function signOut(){
  window._signOutExplicito = true; // Marcar que es logout real del usuario
  localStorage.removeItem('cierralo_session');
  appIniciada = false;
  currentUser = null;
  vendedorData = null;
  obMeta = null;
  obProblema = null;
  await sb.auth.signOut();
  showPage('login');
  mostrarLoginStep('login-step-tel');
}


// Enter en campo teléfono login → confirmar PIN
// Enter en campo teléfono login → confirmar PIN
document.getElementById('login-tel').addEventListener('keydown',e=>{if(e.key==='Enter')confirmarPin();});



// ═══════════════════════════════════════
// RECUPERACIÓN DE PIN — Sesión 7
// ═══════════════════════════════════════

let _recoveryTelefono = '';

function mostrarRecuperacion(){
  _recoveryTelefono = '';
  const telEl = document.getElementById('recovery-tel');
  if(telEl) telEl.value = '';
  limpiarPin('rpin-1','rpin-2','rpin-3','rpin-4');
  limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  mostrarLoginStep('login-step-recovery-tel');
  setTimeout(() => { if(telEl) telEl.focus(); }, 100);
}

async function verificarTelRecuperacion(){
  const tel = document.getElementById('recovery-tel').value.replace(/\s/g,'').trim();
  if(tel.length < 8){ showToast('⚠️ Ingresa tu número de WhatsApp'); return; }

  _recoveryTelefono = '+52' + tel.replace(/^\+52/,'');
  const btn = document.getElementById('recovery-tel-btn');
  btn.textContent = 'Verificando...'; btn.disabled = true;

  // Verificar que el número existe en la base de datos
  const { data, error } = await sb
    .from('vendedores')
    .select('id, nombre')
    .eq('telefono', _recoveryTelefono)
    .single();

  btn.textContent = 'Continuar →'; btn.disabled = false;

  if(error || !data){
    showToast('❌ No encontramos una cuenta con ese número.');
    return;
  }

  // Número encontrado — pasar a elegir nuevo PIN
  limpiarPin('rpin-1','rpin-2','rpin-3','rpin-4');
  limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
  mostrarLoginStep('login-step-recovery-pin');
  setTimeout(() => document.getElementById('rpin-1').focus(), 100);
}

async function cambiarPin(){
  const pin = getPinValue('rpin-1','rpin-2','rpin-3','rpin-4');
  const pinConf = getPinValue('rpin-c1','rpin-c2','rpin-c3','rpin-c4');

  if(pin.length < 4){ showToast('⚠️ Ingresa los 4 dígitos del nuevo PIN'); return; }
  if(pin !== pinConf){ 
    showToast('❌ Los PINs no coinciden. Intenta de nuevo.');
    limpiarPin('rpin-c1','rpin-c2','rpin-c3','rpin-c4');
    setTimeout(() => document.getElementById('rpin-c1').focus(), 100);
    return; 
  }

  const btn = document.getElementById('recovery-pin-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;

  const emailFake = 'tel' + _recoveryTelefono.replace('+','') + '@gmail.com';
  const nuevaPassword = 'PIN_' + pin + '_' + _recoveryTelefono;

  // Primero hacer signIn temporal con cualquier PIN para obtener sesión
  // Usamos updateUser que requiere sesión activa — alternativa: Admin API
  // Solución: usar signInWithOtp deshabilitado → usamos signUp para recrear
  // Estrategia: intentar cambiar password via signIn + updateUser
  // Si no hay sesión activa, usamos el flujo de "recrear" con signUp trick

  // Intentar login con el email para obtener sesión
  // No podemos porque no sabemos el PIN viejo — eso es precisamente el problema
  // Solución: usar supabase.auth.admin NO disponible en cliente
  // Solución correcta para PWA sin backend: 
  //   1. signIn con email + password vacío para disparar reset
  //   2. Usar resetPasswordForEmail — pero requiere magic link (PROHIBIDO)
  // Solución definitiva: guardar hash del PIN en tabla vendedores
  //   y actualizar en la tabla + en Supabase auth via updateUser con sesión admin

  // IMPLEMENTACIÓN REAL: 
  // Como no tenemos backend todavía, usamos el truco de signUp:
  // Si el usuario ya existe y hacemos signUp, Supabase devuelve error "already registered"
  // pero NO podemos cambiar el password sin el password anterior o magic link
  // 
  // Solución pragmática para beta: Netlify Function que usa Admin API
  // Por ahora: flujo con signIn del PIN viejo no es posible
  // Implementamos con Edge Function de Supabase que usa service_role

  // Llamar a nuestra Edge Function de recuperación
  try {
    const resp = await fetch('https://nkjradximipkrzscgvhv.supabase.co/functions/v1/recuperar-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: _recoveryTelefono, nuevo_pin: pin })
    });

    const result = await resp.json();

    if(!resp.ok || result.error){
      throw new Error(result.error || 'Error al cambiar PIN');
    }

    // PIN cambiado — ahora hacer login con el nuevo PIN
    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({
      email: emailFake,
      password: nuevaPassword
    });

    if(loginError) throw loginError;

    localStorage.setItem('cierralo_session', JSON.stringify({
      access_token: loginData.session.access_token,
      refresh_token: loginData.session.refresh_token
    }));

    currentUser = loginData.user;
    appIniciada = true;
    showToast('✅ PIN actualizado — ¡Bienvenido de vuelta!');
    await loadVendedor();

  } catch(err) {
    showToast('❌ Error al cambiar PIN. Intenta de nuevo.');
    console.error('cambiarPin error:', err);
    btn.textContent = 'Guardar nuevo PIN →'; btn.disabled = false;
  }
}

// ── Helpers PIN recuperación ──
function pinRecInput(el, num){
  const v = el.value.toString().slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if(v && num < 4) document.getElementById('rpin-'+( num+1)).focus();
}
function pinRecKeydown(e, num){
  if(e.key==='Backspace' && !document.getElementById('rpin-'+num).value && num > 1){
    document.getElementById('rpin-'+(num-1)).focus();
  }
}
function pinRecConfInput(el, num){
  const v = el.value.toString().slice(-1);
  el.value = v;
  el.classList.toggle('filled', v !== '');
  if(v && num < 4){
    const next = document.getElementById('rpin-c'+(num+1));
    if(next) next.focus();
  }
  if(num === 4 && v) cambiarPin();
}
function pinRecConfKeydown(e, num){
  if(e.key==='Backspace' && !document.getElementById('rpin-c'+num).value && num > 1){
    document.getElementById('rpin-c'+(num-1)).focus();
  }
}
