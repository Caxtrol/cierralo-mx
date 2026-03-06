// ═══════════════════════════════════════════════════════════
// FEATURES.JS — Semáforo WA, Weekly Wrapped, Excel Import, Perfil Público
// Depende de: config.js, crm.js
// ═══════════════════════════════════════════════════════════

// ── SEMÁFORO REPUTACIÓN WHATSAPP ──────────────────────────────────────────
function renderSemaforoWA(){
  const card = document.getElementById('semaforo-wa-card');
  if(!card) return;

  // ── BLOQUEO POR PLAN: Solo Elite puede usar el semáforo ──
  if(!puedeHacer('semaforo_wa')){
    card.innerHTML = `
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;"
           onclick="mostrarPaywall('semaforo_wa')">
        <span style="font-size:28px;flex-shrink:0;">🚦</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;">Semáforo WhatsApp — Plan Elite</div>
          <div style="font-size:11px;color:var(--text3);line-height:1.5;">Conecta tu número Business y la app cuida tu reputación automáticamente.</div>
        </div>
        <div style="background:linear-gradient(90deg,#F59E0B,#FF6B35);color:white;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;flex-shrink:0;">⭐ Elite</div>
      </div>`;
    return;
  }

  // Solo mostrar si tiene API de WhatsApp activa (health_score_wa != null en BD)
  const tieneAPI = vendedorData?.health_score_wa !== null && vendedorData?.health_score_wa !== undefined;

  if(!tieneAPI){
    card.innerHTML = `
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;flex-shrink:0;">🔒</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;">Conecta tu WhatsApp Business</div>
          <div style="font-size:11px;color:var(--text3);line-height:1.5;">Conecta tu número y la app cuida tu reputación automáticamente.</div>
        </div>
      </div>`;
    return;
  }

  const score  = vendedorData.health_score_wa;
  const limite = vendedorData?.limite_diario ?? 30;

  let estado, emoji, color, bgColor, borderColor, desc, consejo;

  if(score >= 80){
    estado = 'Saludable';     emoji = '🟢';
    color  = 'var(--green)';  bgColor = 'var(--greenBg)'; borderColor = '#22C55E35';
    desc   = 'Tu número goza de buena reputación. Puedes enviar hasta ' + limite + ' mensajes nuevos al día.';
    consejo = 'Mantén el ritmo: máx. 10 mensajes cada 15 min para no disparar filtros de Meta.';
  } else if(score >= 50){
    estado = 'En observación'; emoji = '🟡';
    color  = 'var(--yellow)'; bgColor = 'var(--yellowBg)'; borderColor = '#F59E0B35';
    desc   = 'Meta está monitoreando tu número. Límite reducido: ' + limite + ' mensajes nuevos al día.';
    consejo = 'Evita mensajes idénticos. Usa las variaciones de la app y espera respuesta antes de reenviar.';
  } else {
    estado = 'En riesgo';     emoji = '🔴';
    color  = 'var(--red)';   bgColor = 'var(--redBg)';   borderColor = '#EF444435';
    desc   = 'Tu número está en riesgo de bloqueo. Envío de mensajes nuevos pausado.';
    consejo = 'Solo responde conversaciones ya iniciadas. No envíes mensajes nuevos hasta que el score suba.';
  }

  const pct = Math.max(2, score);
  const barColor = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';

  card.innerHTML = `
    <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:22px;">${emoji}</span>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:${color};">${estado}</div>
            <div style="font-size:11px;color:var(--text3);">Score: ${score}/100</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:${color};">${limite}</div>
          <div style="font-size:10px;color:var(--text3);">msgs nuevos/día</div>
        </div>
      </div>
      <div style="height:6px;background:var(--s3);border-radius:3px;margin-bottom:10px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .6s ease;"></div>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${desc}</div>
      <div style="font-size:11px;color:var(--text3);font-style:italic;">💡 ${consejo}</div>
    </div>`;
}

// Verificar límite antes de copiar mensaje al portapapeles
function verificarLimiteWA(){
  if(vendedorData?.health_score_wa === null || vendedorData?.health_score_wa === undefined) return true;

  const score  = vendedorData.health_score_wa;
  const limite = vendedorData?.limite_diario ?? 30;

  const hoy = new Date().toDateString();
  let conteoHoy = 0;
  try {
    const data = JSON.parse(localStorage.getItem('cmx_msgs_hoy') || '{}');
    if(data.fecha === hoy) conteoHoy = data.count || 0;
  } catch(e){}

  if(score < 50){
    showToast('🔴 Envío pausado — score en riesgo (' + score + '/100). Ve a tu Perfil.');
    return false;
  }
  if(conteoHoy >= limite){
    showToast('⚠️ Límite del día alcanzado (' + limite + ' mensajes). Continúa mañana.');
    return false;
  }
  return true;
}

function registrarMensajeEnviado(){
  const hoy = new Date().toDateString();
  try {
    const data = JSON.parse(localStorage.getItem('cmx_msgs_hoy') || '{}');
    const count = (data.fecha === hoy ? data.count : 0) + 1;
    localStorage.setItem('cmx_msgs_hoy', JSON.stringify({ fecha: hoy, count }));
  } catch(e){}
}

// ── WEEKLY WRAPPED ──────────────────────────────────────────────────────────
function calcularLogrosSemanales(){
  const hoy    = new Date();
  const lunes  = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  lunes.setHours(0,0,0,0);

  const prospectosSemana = prospectos.filter(p => {
    const d = new Date(p.created_at || p.updated_at || 0);
    return d >= lunes;
  });
  const ganados    = prospectos.filter(p => p.etapa === 'ganado');
  const reactivados = prospectos.filter(p => {
    if(!p.ultimo_contacto) return false;
    const d = new Date(p.ultimo_contacto);
    return d >= lunes && p.etapa !== 'nuevo';
  });
  const autosRiesgo = (autos || []).filter(a => {
    if(a.estado !== 'disponible') return false;
    const dias = Math.floor((hoy - new Date(a.created_at)) / 86400000);
    return dias >= 21;
  });
  const score = vendedorData?.health_score_wa ?? null;

  const medallas = [];

  if(reactivados.length >= 3){
    medallas.push({
      id: 'reactivacion',
      emoji: '🏆',
      titulo: 'Maestro Reactivación',
      desc: reactivados.length + ' prospectos contactados esta semana',
      color: '#F59E0B'
    });
  }
  if(autosRiesgo.length === 0 && (autos||[]).filter(a=>a.estado==='disponible').length > 0){
    medallas.push({
      id: 'stock',
      emoji: '🚗',
      titulo: 'Centinela de Stock',
      desc: 'Sin autos en riesgo esta semana',
      color: '#4A9EFF'
    });
  }
  if(score !== null && score >= 90){
    medallas.push({
      id: 'confianza',
      emoji: '🤝',
      titulo: 'Embajador Confianza',
      desc: 'Score WhatsApp: ' + score + '/100',
      color: '#22C55E'
    });
  }

  return {
    medallas,
    ganados:      ganados.length,
    reactivados:  reactivados.length,
    autosRiesgo:  autosRiesgo.length,
    prospectosSemana: prospectosSemana.length
  };
}

function mostrarWrappedBanner(){
  const banner = document.getElementById('wrapped-banner');
  if(!banner) return;

  const logros = calcularLogrosSemanales();
  const hoy    = new Date();
  const esLunes = hoy.getDay() === 1;

  const key    = 'cmx_wrapped_visto_' + getISOWeek();
  const visto  = localStorage.getItem(key);
  if(visto && !esLunes) return;

  if(logros.medallas.length === 0 && !esLunes) return;

  const medallaTexto = logros.medallas.length > 0
    ? logros.medallas.map(m => m.emoji).join(' ') + ' ' + logros.medallas.length + ' medalla' + (logros.medallas.length > 1 ? 's' : '') + ' esta semana'
    : 'Tu resumen semanal está listo';

  banner.style.display = 'block';
  banner.innerHTML = `
    <div onclick="abrirWrapped()" style="background:linear-gradient(135deg,#A855F720,#F59E0B15);border:1px solid #A855F735;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s;" onmousedown="this.style.transform='scale(.98)'" onmouseup="this.style.transform=''">
      <span style="font-size:32px;flex-shrink:0;">🎯</span>
      <div style="flex:1;">
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--text);margin-bottom:2px;">Tu Semana en Ciérralo</div>
        <div style="font-size:11px;color:var(--text2);">${medallaTexto}</div>
      </div>
      <div style="color:var(--text3);font-size:18px;">›</div>
    </div>`;
}

function getISOWeek(){
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w = new Date(d.getFullYear(), 0, 4);
  return d.getFullYear() + '-W' + (1 + Math.round(((d.getTime() - w.getTime()) / 86400000 - 3 + (w.getDay() + 6) % 7) / 7));
}

function abrirWrapped(){
  const logros = calcularLogrosSemanales();
  const modal  = document.getElementById('wrapped-modal-content');
  if(!modal) return;

  const hoy   = new Date();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const semana = 'Semana del ' + meses[hoy.getMonth()] + ' ' + hoy.getFullYear();

  const medallaHTML = logros.medallas.length > 0
    ? logros.medallas.map(m => `
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:32px;">${m.emoji}</span>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:${m.color};">${m.titulo}</div>
            <div style="font-size:11px;color:var(--text2);">${m.desc}</div>
          </div>
        </div>`).join('')
    : `<div style="background:var(--s2);border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:32px;margin-bottom:6px;">💪</div>
        <div style="font-size:13px;color:var(--text2);">Esta semana sin medallas — ¡la próxima es tuya!</div>
       </div>`;

  const escudo = logros.ganados > 0
    ? `Semana positiva: ${logros.ganados} venta${logros.ganados>1?'s':''} cerrada${logros.ganados>1?'s':''}. ${logros.reactivados} prospecto${logros.reactivados!==1?'s':''} contactado${logros.reactivados!==1?'s':''}.`
    : `${logros.reactivados} prospecto${logros.reactivados!==1?'s':''} contactado${logros.reactivados!==1?'s':''}. Pipeline activo con ${logros.prospectosSemana} nuevo${logros.prospectosSemana!==1?'s':''} esta semana.`;

  modal.innerHTML = `
    <div style="padding:4px 20px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:48px;margin-bottom:8px;">🎯</div>
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:var(--text);margin-bottom:4px;">Tu Semana</div>
        <div style="font-size:12px;color:var(--text3);">${semana}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
        <div style="background:var(--s2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--green);">${logros.ganados}</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;">Ventas</div>
        </div>
        <div style="background:var(--s2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--orange);">${logros.reactivados}</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;">Contactos</div>
        </div>
        <div style="background:var(--s2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:${logros.autosRiesgo>0?'var(--red)':'var(--blue)'};">${logros.autosRiesgo}</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;">Riesgo</div>
        </div>
      </div>
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Medallas</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">${medallaHTML}</div>
      <div style="background:linear-gradient(135deg,#4A9EFF15,var(--s2));border:1px solid #4A9EFF30;border-radius:12px;padding:12px 14px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">🛡️ Escudo de Defensa</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;font-style:italic;">"${escudo}"</div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px;">Muéstrale esto a tu gerente si te pregunta qué hiciste esta semana.</div>
      </div>
      <button onclick="compartirWrapped()" style="width:100%;background:#25D366;color:white;border:none;border-radius:10px;padding:13px;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:18px;">💬</span> Compartir por WhatsApp
      </button>
    </div>`;

  document.getElementById('modal-wrapped').classList.add('open');
  localStorage.setItem('cmx_wrapped_visto_' + getISOWeek(), '1');
  const banner = document.getElementById('wrapped-banner');
  if(banner) banner.style.display = 'none';
}


// ── IMPORTACIÓN EXCEL / CSV ──────────────────────────────────────────────────

// ── Limpieza inteligente de datos ──
function limpiarNombre(raw){
  if(!raw) return '';
  return String(raw)
    .trim()
    // Quitar caracteres raros pero conservar letras con acento, ñ, espacios
    .replace(/[^\p{L}\p{M}\s\-\.]/gu, '')
    // Colapsar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim()
    // Capitalizar cada palabra
    .replace(/\b\w/g, c => c.toUpperCase());
}

function limpiarTelefono(raw){
  if(!raw) return '';
  const solo = String(raw).replace(/[^0-9]/g, '');
  // Quitar prefijo 52 si ya tiene 12 dígitos (521XXXXXXXXXX)
  if(solo.length === 12 && solo.startsWith('52')) return solo.slice(2);
  // Quitar 521 si tiene 13 dígitos
  if(solo.length === 13 && solo.startsWith('521')) return solo.slice(3);
  // Quedarse con los últimos 10 dígitos
  return solo.slice(-10);
}

// ── Detectar columna por palabras clave (flexible) ──
const COLUMNAS_CLAVE = {
  nombre:  ['nombre','name','cliente','prospecto','contacto','razon','social','titular','persona'],
  telefono:['telefono','tel','phone','celular','movil','whatsapp','numero','cel','fono','wha'],
  auto:    ['auto','vehiculo','modelo','interes','carro','unidad','producto'],
  notas:   ['nota','notas','comentario','observacion','obs','detalle','descripcion'],
  email:   ['email','correo','mail','e-mail'],
  fuente:  ['fuente','origen','canal','referido','procedencia']
};

function detectarColumnasAuto(columnasArchivo){
  const resultado = {};
  const usadas = new Set();
  for(const [campo, palabras] of Object.entries(COLUMNAS_CLAVE)){
    for(const col of columnasArchivo){
      const colLimpia = col.toLowerCase().replace(/[^a-z0-9]/g,'');
      const coincide  = palabras.some(p => colLimpia.includes(p));
      if(coincide && !usadas.has(col)){
        resultado[campo] = col;
        usadas.add(col);
        break;
      }
    }
  }
  return resultado;
}

// Variable para guardar columnas seleccionadas en el mapeador
let _excelColumnas   = [];   // columnas originales del archivo
let _excelFilasBruto = [];   // filas sin procesar

function abrirImportExcel(){
  if(!puedeHacer('excel_import')){ mostrarPaywall('excel_import'); return; }
  excelDataParsed  = [];
  _excelColumnas   = [];
  _excelFilasBruto = [];
  document.getElementById('excel-paso1').style.display = 'block';
  document.getElementById('excel-paso2').style.display = 'none';
  document.getElementById('excel-paso3').style.display = 'none';
  document.getElementById('excel-file-input').value = '';
  document.getElementById('modal-excel').classList.add('open');
}

function procesarArchivoExcel(input){
  const file = input.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = function(e){
    try {
      let filas = [];
      let columnasOriginales = [];

      if(file.name.toLowerCase().endsWith('.csv')){
        const texto = e.target.result;
        // Detectar separador automáticamente (coma, punto y coma, tab)
        const primeraLinea = texto.split(/\r?\n/)[0];
        const sep = primeraLinea.includes(';') ? ';' : primeraLinea.includes('\t') ? '\t' : ',';
        const lineas = texto.split(/\r?\n/).filter(l => l.trim());
        columnasOriginales = lineas[0].split(sep).map(h => h.trim().replace(/^"|"$/g,''));
        for(let i = 1; i < lineas.length; i++){
          const cols = lineas[i].split(sep);
          const obj = {};
          columnasOriginales.forEach((h, ci) => {
            obj[h] = (cols[ci] || '').trim().replace(/^"|"$/g,'');
          });
          filas.push(obj);
        }
      } else {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
        if(raw.length < 2){ showToast('El archivo está vacío.'); return; }
        columnasOriginales = raw[0].map(h => String(h).trim());
        filas = raw.slice(1).map(row => {
          const obj = {};
          columnasOriginales.forEach((h, ci) => { obj[h] = String(row[ci] ?? '').trim(); });
          return obj;
        });
      }

      // Filtrar filas completamente vacías
      filas = filas.filter(r => Object.values(r).some(v => v !== ''));

      if(!filas.length || !columnasOriginales.length){
        showToast('El archivo está vacío o no se pudo leer.'); return;
      }

      _excelFilasBruto = filas;
      _excelColumnas   = columnasOriginales;

      // Intentar mapeo automático
      const mapaAuto = detectarColumnasAuto(columnasOriginales);

      if(mapaAuto.nombre && mapaAuto.telefono){
        // Detección exitosa — ir directo a preview
        procesarConMapa(mapaAuto);
      } else {
        // Necesita que el vendedor mapee manualmente
        mostrarMapeador(columnasOriginales, mapaAuto);
      }

    } catch(err){
      showToast('Error leyendo archivo: ' + err.message);
      console.error(err);
    }
  };

  if(file.name.toLowerCase().endsWith('.csv')){
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.readAsArrayBuffer(file);
  }
}

// ── MAPEADOR VISUAL: el vendedor elige qué columna es qué ──
function mostrarMapeador(columnas, mapaAuto){
  const opts = columnas.map(c => `<option value="${c}">${c}</option>`).join('');
  const optsConVacio = `<option value="">— No usar —</option>` + opts;

  const valDe = campo => mapaAuto[campo] || '';

  document.getElementById('excel-preview-content').innerHTML = `
    <div style="background:var(--blueBg);border:1px solid #4A9EFF30;border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:4px;">📋 Ayúdame a entender tu archivo</div>
      <div style="font-size:11px;color:var(--text2);">Tu archivo tiene ${columnas.length} columnas. Dime cuál es cuál y la app hace el resto.</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">

      <div style="background:var(--s2);border-radius:10px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">⭐ Nombre del cliente <span style="color:var(--red);">*</span></div>
        <select id="map-nombre" style="width:100%;background:var(--s1);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
          <option value="">— Selecciona columna —</option>${opts}
        </select>
      </div>

      <div style="background:var(--s2);border-radius:10px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">⭐ Teléfono / WhatsApp <span style="color:var(--red);">*</span></div>
        <select id="map-telefono" style="width:100%;background:var(--s1);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
          <option value="">— Selecciona columna —</option>${opts}
        </select>
      </div>

      <div style="background:var(--s2);border-radius:10px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">🚗 Auto de interés (opcional)</div>
        <select id="map-auto" style="width:100%;background:var(--s1);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
          ${optsConVacio}
        </select>
      </div>

      <div style="background:var(--s2);border-radius:10px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📝 Notas / Comentarios (opcional)</div>
        <select id="map-notas" style="width:100%;background:var(--s1);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
          ${optsConVacio}
        </select>
      </div>

    </div>

    <div style="font-size:11px;color:var(--text3);margin-bottom:12px;text-align:center;">
      Vista previa de tu archivo: ${_excelFilasBruto.length} filas encontradas
    </div>

    <div style="display:flex;gap:8px;">
      <button onclick="cerrarModal('modal-excel')" style="flex:1;background:var(--s2);color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:12px;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer;">Cancelar</button>
      <button onclick="confirmarMapeador()" style="flex:2;background:var(--orange);color:white;border:none;border-radius:10px;padding:12px;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer;">Continuar →</button>
    </div>`;

  // Pre-seleccionar si algo se detectó parcialmente
  if(valDe('nombre'))    document.getElementById('map-nombre').value    = valDe('nombre');
  if(valDe('telefono'))  document.getElementById('map-telefono').value  = valDe('telefono');
  if(valDe('auto'))      document.getElementById('map-auto').value      = valDe('auto');
  if(valDe('notas'))     document.getElementById('map-notas').value     = valDe('notas');

  document.getElementById('excel-paso1').style.display = 'none';
  document.getElementById('excel-paso2').style.display = 'block';
}

function confirmarMapeador(){
  const nombre   = document.getElementById('map-nombre')?.value;
  const telefono = document.getElementById('map-telefono')?.value;
  if(!nombre || !telefono){
    showToast('⚠️ Debes seleccionar Nombre y Teléfono para continuar');
    return;
  }
  procesarConMapa({
    nombre,
    telefono,
    auto:   document.getElementById('map-auto')?.value  || '',
    notas:  document.getElementById('map-notas')?.value || ''
  });
}

// ── PROCESAR CON EL MAPA DEFINIDO (auto o manual) ──
function procesarConMapa(mapa){
  const filas = _excelFilasBruto;

  // Similitud local de respaldo
  const _sim = typeof similitud === 'function' ? similitud : function(a, b){
    if(a === b) return 1; if(!a||!b) return 0;
    const lg = a.length > b.length ? a : b;
    const sh = a.length > b.length ? b : a;
    let m = 0;
    for(let i = 0; i < sh.length; i++) if(lg.includes(sh[i])) m++;
    return m / lg.length;
  };

  let nuevos = 0, duplicados = 0, sinDatos = 0;
  const procesadas = [];

  filas.forEach(row => {
    const nombreRaw = row[mapa.nombre] || '';
    const telRaw    = row[mapa.telefono] || '';

    // Limpiar con las funciones inteligentes
    const nombre = limpiarNombre(nombreRaw);
    const tel    = limpiarTelefono(telRaw);

    // Saltar fila si no tiene nombre ni teléfono útil
    if(!nombre && tel.length < 8){ sinDatos++; return; }
    // Si no tiene nombre, usar "Contacto sin nombre"
    const nombreFinal = nombre || 'Contacto sin nombre';
    // Si el teléfono quedó muy corto, guardar el original limpio
    const telFinal = tel.length >= 8 ? tel : telRaw.replace(/[^0-9]/g,'').slice(-10);

    const auto  = mapa.auto  ? String(row[mapa.auto]  || '').trim() : '';
    const notas = mapa.notas ? String(row[mapa.notas] || '').trim() : '';

    // Verificar duplicados
    const existe = prospectos.some(p => {
      const pTel = (p.telefono || '').replace(/[^0-9]/g,'');
      return (telFinal.length >= 8 && pTel.slice(-8) === telFinal.slice(-8)) ||
             _sim(p.nombre.toLowerCase(), nombreFinal.toLowerCase()) > 0.85;
    });

    if(existe){
      duplicados++;
      procesadas.push({ _estado:'duplicado', _nombre:nombreFinal, _tel:telFinal, _auto:auto, _notas:notas });
    } else {
      nuevos++;
      procesadas.push({ _estado:'nuevo', _nombre:nombreFinal, _tel:telFinal, _auto:auto, _notas:notas });
    }
  });

  excelDataParsed = procesadas.filter(r => r._estado === 'nuevo');

  mostrarPreviewExcel(procesadas, nuevos, duplicados, sinDatos);
}

function mostrarPreviewExcel(procesadas, nuevos, duplicados, sinDatos){
  const comisionEst = nuevos * 4500;

  document.getElementById('excel-preview-content').innerHTML = `
    <div style="background:linear-gradient(135deg,#F59E0B15,var(--s2));border:1px solid #F59E0B30;border-radius:12px;padding:14px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">⛏️ Oro encontrado en tu lista</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div style="text-align:center;background:var(--s1);border-radius:8px;padding:10px;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--green);">${nuevos}</div>
          <div style="font-size:10px;color:var(--text3);">Contactos nuevos</div>
        </div>
        <div style="text-align:center;background:var(--s1);border-radius:8px;padding:10px;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--orange);">${duplicados}</div>
          <div style="font-size:10px;color:var(--text3);">Ya en tu CRM</div>
        </div>
      </div>
      ${sinDatos > 0 ? `<div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:8px;">${sinDatos} fila${sinDatos!==1?'s':''} omitida${sinDatos!==1?'s':''} (sin nombre ni teléfono válido)</div>` : ''}
      <div style="background:var(--s1);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">Comisión potencial estimada</div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--yellow);">${fmtPeso(comisionEst)}</div>
        <div style="font-size:9px;color:var(--text4);">Basado en ~$4,500 promedio por venta</div>
      </div>
    </div>

    ${nuevos > 0 ? `
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Vista previa — primeros ${Math.min(3,nuevos)} contactos (ya limpios):</div>
    ${procesadas.filter(r=>r._estado==='nuevo').slice(0,3).map(r => `
      <div style="background:var(--s2);border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--orangeBg);color:var(--orange);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">${r._nombre.split(' ').map(n=>n[0]||'').join('').substring(0,2).toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(r._nombre)}</div>
          <div style="font-size:11px;color:var(--text3);">📱 ${r._tel || '—'}${r._auto ? ' · '+safe(r._auto) : ''}</div>
        </div>
        <div style="font-size:18px;">✅</div>
      </div>`).join('')}
    ` : `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">Todos los contactos ya están en tu CRM 👍</div>`}

    <div style="display:flex;gap:8px;margin-top:12px;">
      <button onclick="cerrarModal('modal-excel')" style="flex:1;background:var(--s2);color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:12px;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer;">Cancelar</button>
      ${nuevos > 0 ? `<button onclick="importarProspectosExcel()" style="flex:2;background:var(--orange);color:white;border:none;border-radius:10px;padding:12px;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer;">⛏️ Importar ${nuevos} contacto${nuevos!==1?'s':''}</button>` : ''}
    </div>`;

  document.getElementById('excel-paso1').style.display = 'none';
  document.getElementById('excel-paso2').style.display = 'block';
}

async function importarProspectosExcel(){
  if(!excelDataParsed || excelDataParsed.length === 0) return;

  const btn = document.querySelector('#excel-paso2 button:last-child');
  if(btn){ btn.textContent = 'Importando...'; btn.disabled = true; }

  const uid = currentUser?.id || window._currentUid;
  if(!uid){ showToast('❌ Sesión expirada'); if(btn){ btn.textContent='Importar'; btn.disabled=false; } return; }

  const LOTE = 10;
  let importados = 0, errores = 0;

  for(let i = 0; i < excelDataParsed.length; i += LOTE){
    const lote = excelDataParsed.slice(i, i + LOTE).map(r => ({
      vendedor_id:  uid,
      nombre:       r._nombre,
      telefono:     r._tel.length >= 10 ? '+52' + r._tel.slice(-10) : (r._tel || null),
      auto_interes: r._auto  || null,
      notas:        r._notas || null,
      etapa:        'nuevo',
      temperatura:  0,
      fuente:       'excel'
    }));

    const { error } = await sbAuth().from('prospectos').insert(lote);
    if(error){ console.error('Import error:', error); errores += lote.length; }
    else { importados += lote.length; }

    if(i + LOTE < excelDataParsed.length) await new Promise(r => setTimeout(r, 300));
  }

  document.getElementById('excel-paso2').style.display = 'none';
  document.getElementById('excel-paso3').style.display = 'block';
  document.getElementById('excel-resultado-content').innerHTML = `
    <div style="text-align:center;padding:8px 0 16px;">
      <div style="font-size:48px;margin-bottom:10px;">${errores === 0 ? '✅' : '⚠️'}</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:var(--text);margin-bottom:6px;">${importados} contacto${importados!==1?'s':''} importado${importados!==1?'s':''}</div>
      ${errores > 0 ? `<div style="font-size:12px;color:var(--red);margin-bottom:6px;">${errores} no se pudieron guardar — intenta de nuevo</div>` : ''}
      <div style="font-size:12px;color:var(--text2);margin-bottom:16px;">Ya están en tu CRM como "Nuevo". La app los irá recordándote de a poco.</div>
      <div style="background:linear-gradient(135deg,#F59E0B15,var(--s2));border:1px solid #F59E0B30;border-radius:10px;padding:12px;margin-bottom:16px;">
        <div style="font-size:11px;color:var(--yellow);font-weight:700;margin-bottom:4px;">Siguiente paso recomendado</div>
        <div style="font-size:12px;color:var(--text2);">Ve a Mensajes → elige una situación → la app genera el mensaje personalizado para cada uno.</div>
      </div>
      <button onclick="cerrarModal('modal-excel');cargarProspectos(window._currentUid);" style="width:100%;background:var(--orange);color:white;border:none;border-radius:10px;padding:13px;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;cursor:pointer;">Ver mis prospectos →</button>
    </div>`;

  await cargarProspectos(window._currentUid);
}

function compartirWrapped(){
  const logros = calcularLogrosSemanales();
  const medalEmojis = logros.medallas.map(m=>m.emoji).join('');
  const texto = `${medalEmojis ? medalEmojis+' ' : ''}Esta semana en Ciérralo.mx:
✅ ${logros.ganados} venta${logros.ganados!==1?'s':''} cerrada${logros.ganados!==1?'s':''}
📲 ${logros.reactivados} contacto${logros.reactivados!==1?'s':''} realizados

Ciérralo.mx — La app que trabaja para el vendedor 🚗`;
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto);
  window.open(url, '_blank');
}

// ── PERFIL PÚBLICO ──────────────────────────────────────────────────────────

function renderPerfilPublico(){
  const card = document.getElementById('perfil-publico-card');
  if(!card || !vendedorData) return;

  const activo   = vendedorData.perfil_publico_activo || false;
  const bio      = vendedorData.bio || '';
  const anios    = vendedorData.anos_experiencia || 0;
  const marcas   = vendedorData.marcas_experiencia || '';
  const espec    = vendedorData.especialidades || '';
  const score    = vendedorData.score_reputacion || 0;
  const resenas  = vendedorData.total_resenas || 0;
  const pctRec   = vendedorData.pct_recomendacion || 0;

  perfilPublicoActivo = activo;

  if(!activo){
    card.innerHTML = `
      <div style="background:var(--s2);border:1px dashed var(--border2);border-radius:12px;padding:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:28px;">🌐</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;">Perfil no publicado</div>
            <div style="font-size:11px;color:var(--text3);">Los clientes no pueden encontrarte aún</div>
          </div>
        </div>
        <button onclick="abrirEditorPerfilPublico()" style="width:100%;background:var(--orange);color:white;border:none;border-radius:8px;padding:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer;">
          ✨ Crear mi perfil público
        </button>
        <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:6px;">
          Gratis · Apareces en cierralo.mx · Los clientes te dejan reseñas
        </div>
      </div>`;
    return;
  }

  const estrellas = score > 0
    ? '⭐'.repeat(Math.round(score / 20)).padEnd(5, '☆').substring(0,5)
    : '— sin reseñas aún';

  card.innerHTML = `
    <div style="background:linear-gradient(135deg,#FF6B3512,var(--s2));border:1px solid #FF6B3530;border-radius:12px;overflow:hidden;">
      <div style="padding:12px 14px;border-bottom:1px solid #FF6B3520;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);"></div>
            <div style="font-size:12px;font-weight:700;color:var(--green);">Perfil publicado</div>
          </div>
          <div onclick="abrirEditorPerfilPublico()" style="font-size:11px;color:var(--orange);cursor:pointer;padding:3px 8px;background:var(--orangeBg);border-radius:20px;">✏️ Editar</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
          <div style="font-size:10px;color:var(--text3);">cierralo.mx/${vendedorData.perfil_slug || ''}</div>
          <div onclick="copiarUrlPerfil()" style="font-size:10px;font-weight:700;color:var(--blue);cursor:pointer;padding:3px 8px;background:var(--blueBg);border-radius:20px;border:1px solid #4A9EFF30;">📋 Copiar URL</div>
          <a href="https://cierralo.mx/${vendedorData.perfil_slug || ''}" target="_blank" style="font-size:10px;font-weight:700;color:var(--green);cursor:pointer;padding:3px 8px;background:var(--greenBg);border-radius:20px;border:1px solid #22C55E30;text-decoration:none;">🔗 Ver</a>
          <div onclick="copiarLinkResena()" style="font-size:10px;font-weight:700;color:var(--yellow);cursor:pointer;padding:3px 8px;background:var(--yellowBg);border-radius:20px;border:1px solid #F59E0B30;">⭐ Link reseña</div>
        </div>
      </div>
      <div style="padding:12px 14px;">
        ${bio ? `<div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5;font-style:italic;">"${bio}"</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
          <div style="text-align:center;background:var(--s1);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--orange);">${anios > 0 ? anios : '—'}</div>
            <div style="font-size:9px;color:var(--text3);">años exp.</div>
          </div>
          <div style="text-align:center;background:var(--s1);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--yellow);">${resenas}</div>
            <div style="font-size:9px;color:var(--text3);">reseñas</div>
          </div>
          <div style="text-align:center;background:var(--s1);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--green);">${pctRec > 0 ? pctRec+'%' : '—'}</div>
            <div style="font-size:9px;color:var(--text3);">recomiendan</div>
          </div>
        </div>
        ${espec ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;"><div class="badge bo" style="font-size:9px;">🎯 ${espec}</div>${marcas ? marcas.split(',').slice(0,2).map(m=>'<div class="badge bb" style="font-size:9px;">'+m.trim()+'</div>').join('') : ''}</div>` : ''}
        <div style="font-size:11px;color:var(--text3);font-style:italic;">
          ${resenas === 0 ? '💡 Comparte tu perfil con clientes para recibir tus primeras reseñas' : `⭐ Puntuación: ${(score/20).toFixed(1)}/5`}
        </div>
      </div>
    </div>`;
}

function abrirEditorPerfilPublico(){
  const bio  = document.getElementById('pp-bio');
  const exp  = document.getElementById('pp-experiencia');
  const espec = document.getElementById('pp-especialidad');
  const marcas = document.getElementById('pp-marcas');

  if(bio){
    bio.value = vendedorData?.bio || '';
    actualizarContadorBio();
    bio.oninput = actualizarContadorBio;
  }
  if(exp)    exp.value    = vendedorData?.anos_experiencia || '';
  if(espec)  espec.value  = vendedorData?.especialidades   || '';
  if(marcas) marcas.value = vendedorData?.marcas_experiencia || '';

  actualizarToggle(vendedorData?.perfil_publico_activo || false);
  document.getElementById('modal-perfil-publico').classList.add('open');
}

function actualizarContadorBio(){
  const bio = document.getElementById('pp-bio');
  const cnt = document.getElementById('pp-bio-count');
  if(bio && cnt) cnt.textContent = bio.value.length + '/160';
}

function togglePerfilPublico(){
  perfilPublicoActivo = !perfilPublicoActivo;
  actualizarToggle(perfilPublicoActivo);
}

function actualizarToggle(activo){
  perfilPublicoActivo = activo;
  const toggle = document.getElementById('pp-toggle');
  const dot    = document.getElementById('pp-toggle-dot');
  if(!toggle || !dot) return;
  toggle.style.background = activo ? 'var(--orange)' : 'var(--s3)';
  dot.style.left           = activo ? '22px' : '2px';
}

async function guardarPerfilPublico(){
  const btn = document.getElementById('btn-guardar-perfil-pub');
  if(btn){ btn.textContent = 'Guardando...'; btn.disabled = true; }

  const bio    = document.getElementById('pp-bio')?.value.trim()    || null;
  const anios  = parseInt(document.getElementById('pp-experiencia')?.value) || null;
  const espec  = document.getElementById('pp-especialidad')?.value   || null;
  const marcas = document.getElementById('pp-marcas')?.value.trim()  || null;

  let slug = vendedorData.perfil_slug;
  if(!slug && vendedorData.nombre){
    const base = vendedorData.nombre
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
    const { data: existing } = await sb.from('vendedores')
      .select('id').eq('perfil_slug', base).maybeSingle();
    if(!existing){
      slug = base;
    } else {
      const sufijo = (vendedorData.telefono || '').replace(/[^0-9]/g,'').slice(-4);
      slug = base + '-' + sufijo;
    }
  }

  const cambios = {
    bio,
    anos_experiencia:    anios,
    especialidades:      espec,
    marcas_experiencia:  marcas,
    perfil_publico_activo: perfilPublicoActivo,
    perfil_slug:         slug || vendedorData.perfil_slug || null
  };

  const { error } = await sb.from('vendedores')
    .update(cambios)
    .eq('id', currentUser.id);
  
  if(!error && slug) vendedorData.perfil_slug = slug;

  if(btn){ btn.textContent = 'Guardar perfil →'; btn.disabled = false; }

  if(error){
    showToast('❌ Error: ' + error.message);
    return;
  }

  Object.assign(vendedorData, cambios);
  cerrarModal('modal-perfil-publico');
  if(perfilPublicoActivo && vendedorData.perfil_slug){
    showToast('✅ Perfil publicado — cierralo.mx/' + vendedorData.perfil_slug);
  } else {
    showToast(perfilPublicoActivo ? '✅ Perfil publicado en cierralo.mx' : '✅ Perfil guardado (sin publicar)');
  }
  renderPerfilPublico();
}


// ── API KEY CONFIG ──
const _origSelSit = window.seleccionarSituacion;
window.seleccionarSituacion = function(situacionId) {
  _ultimaSituacion = situacionId;
  if(_origSelSit) _origSelSit(situacionId);
};

const _origGenMsg = window.generarMensajePara;
window.generarMensajePara = async function(p, situacionId) {
  _ultimoProspecto = p;
  _ultimaSituacion = situacionId;
  await _origGenMsg(p, situacionId);
};

function regenerarMensaje(){
  if(!_ultimoProspecto || !_ultimaSituacion){
    showToast('⚠️ Selecciona un prospecto y situación primero');
    return;
  }
  generarMensajePara(_ultimoProspecto, _ultimaSituacion);
}

function renderApiKeySection(){
  const container = document.getElementById('perfil-api-section');
  if(!container) return;

  container.innerHTML = `
    <div style="background:linear-gradient(135deg,#CC778518,var(--s1));border:1px solid #CC778530;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#CC7855" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;">Inteligencia Artificial activa</div>
        <div style="font-size:11px;color:var(--text2);">Powered by Claude — mensajes generados en el servidor</div>
      </div>
      <div style="width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);flex-shrink:0;"></div>
    </div>
  `;
}



const _origGoTo2 = window.goTo;
window.goTo = function(screen, btn){
  _origGoTo2(screen, btn);
  if(screen === 'perfil'){ setTimeout(renderApiKeySection, 50); setTimeout(renderPerfilPublico, 60); setTimeout(renderSeccionNotificaciones, 70); }
};


// ═══════════════════════════════════════════════════════════
// FLUJO DE RESEÑAS
// ═══════════════════════════════════════════════════════════

async function pedirResena(prospecto){
  if(!prospecto?.token_resena){
    showToast('⚠️ El link se genera al marcar la venta como Ganada');
    return;
  }
  if(prospecto.token_resena_usado){
    showToast('✅ Este cliente ya dejó su reseña');
    return;
  }
  const linkResena = 'https://cierralo.mx/resena/' + prospecto.token_resena;
  const nombre = prospecto?.nombre || 'cliente';
  const auto = prospecto?.auto_interes || '';

  const msg = auto
    ? `Hola ${nombre}, fue un placer atenderte con el ${auto}. 🚗\n\nSi tuvieras 1 minuto, me ayudaría mucho que dejaras tu opinión aquí:\n${linkResena}\n\nGracias 🙏`
    : `Hola ${nombre}, fue un placer atenderte. 🤝\n\nSi tuvieras 1 minuto, me ayudaría mucho que dejaras tu opinión aquí:\n${linkResena}\n\nGracias 🙏`;

  try {
    await navigator.clipboard.writeText(msg);
    showToast('✅ Mensaje copiado — pégalo en WhatsApp');
  } catch(e) {
    showToast('Link: ' + linkResena);
  }

  if(prospecto?.id){
    await sb.from('prospectos').update({ 
      notas: (prospecto.notas || '') + '\n[Reseña solicitada: ' + new Date().toLocaleDateString('es-MX') + ']'
    }).eq('id', prospecto.id).catch(() => {});
  }
}

async function copiarLinkResena(){
  const token = vendedorData?.token_resenas;
  if(!token){ showToast('Perfil no configurado'); return; }
  const link = 'https://cierralo.mx/resena/' + token;
  try {
    await navigator.clipboard.writeText(link);
    showToast('✅ Link copiado — ' + link);
  } catch(e) {
    showToast('Tu link: ' + link);
  }
}

function mostrarModalResena(prospecto){
  if(!prospecto?.token_resena){
    showToast('⚠️ El link de reseña se activa al marcar la venta como Ganada');
    return;
  }
  if(prospecto.token_resena_usado){
    showToast('✅ Este cliente ya dejó su reseña — aparece en tu perfil');
    return;
  }
  const linkResena = 'https://cierralo.mx/resena/' + prospecto.token_resena;
  const nombre = prospecto?.nombre || '';
  const auto = prospecto?.auto_interes || '';

  const msg = auto
    ? `Hola ${nombre}, fue un placer atenderte con el ${auto}. 🚗\n\nSi tuvieras 1 minuto, me ayudaría mucho que dejaras tu opinión aquí:\n${linkResena}\n\nGracias 🙏`
    : `Hola ${nombre}, fue un placer atenderte. 🤝\n\nSi tuvieras 1 minuto, me ayudaría mucho que dejaras tu opinión aquí:\n${linkResena}\n\nGracias 🙏`;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#00000099;z-index:800;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--s1);border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:20px 20px max(24px,env(safe-area-inset-bottom));border-top:2px solid #FF6B3535;">
      <div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 16px;"></div>
      <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px;">⭐ Pedir reseña${nombre ? ' a ' + nombre : ''}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:16px;">Copia el mensaje y pégalo en WhatsApp</div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:13px;font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:14px;white-space:pre-wrap;">${msg.replace(/\n/g,'\n')}</div>
      <div style="display:flex;gap:8px;">
        <button onclick="pedirResena(${JSON.stringify(prospecto || {}).replace(/"/g,'&quot;')}); document.body.removeChild(this.closest('[style*=fixed]'));" 
          style="flex:1;background:var(--orange);color:white;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;padding:12px;border-radius:10px;border:none;cursor:pointer;">
          📋 Copiar mensaje
        </button>
        <button onclick="document.body.removeChild(this.closest('[style*=fixed]'));"
          style="padding:12px 16px;background:var(--s2);color:var(--text2);font-family:'Syne',sans-serif;font-weight:700;font-size:13px;border-radius:10px;border:1px solid var(--border);cursor:pointer;">
          Cerrar
        </button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if(e.target === overlay) document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
}

function copiarUrlPerfil(){
  const slug = vendedorData?.perfil_slug;
  if(!slug){ showToast('Primero guarda tu perfil público'); return; }
  const url = 'https://cierralo.mx/' + slug;
  navigator.clipboard.writeText(url)
    .then(() => showToast('✅ URL copiada — ' + url))
    .catch(() => showToast('Tu URL: cierralo.mx/' + slug));
}

// ═══════════════════════════════════════════════════════════
// MOTOR DE ALERTAS INTELIGENTE
// ═══════════════════════════════════════════════════════════

const PUSH_STORAGE_KEY = 'cierralo_push_config';
const PUSH_SUB_KEY     = 'cierralo_push_sub';

const ALERTAS_CONFIG = [
  { tipo: 'cierre_hoy',     prioridad: 1, icono: '🔥', titulo: '¡Cierra hoy!',
    condicion: p => p.etapa === 'tramite' && diasSin(p) >= 1 },
  { tipo: 'caliente_frio',  prioridad: 1, icono: '❄️', titulo: 'Prospecto enfriándose',
    condicion: p => calcTemp(p) >= 70 && diasSin(p) >= 3 },
  { tipo: 'cotizacion_vence', prioridad: 1, icono: '📋', titulo: 'Cotización venciendo',
    condicion: p => p.etapa === 'cotizacion' && diasSin(p) >= 4 },
  { tipo: 'sin_contacto_5', prioridad: 2, icono: '⚡', titulo: 'Sin contacto 5+ días',
    condicion: p => diasSin(p) >= 5 && !['ganado','perdido'].includes(p.etapa) },
  { tipo: 'prueba_pendiente', prioridad: 2, icono: '🚗', titulo: 'Prueba de manejo pendiente',
    condicion: p => p.etapa === 'prueba' && diasSin(p) >= 2 },
  { tipo: 'nuevo_sin_contacto', prioridad: 2, icono: '👋', titulo: 'Nuevo sin contactar',
    condicion: p => p.etapa === 'nuevo' && diasSin(p) >= 1 },
  { tipo: 'stock_viejo',    prioridad: 3, icono: '📦', titulo: 'Auto mucho tiempo en stock',
    condicion: p => false },
  { tipo: 'resena_pendiente', prioridad: 3, icono: '⭐', titulo: 'Pide reseña',
    condicion: p => p.etapa === 'ganado' && p.token_resena && !p.token_resena_usado },
];

function diasSin(p){
  if(!p.ultimo_contacto) return 99;
  return Math.floor((Date.now() - new Date(p.ultimo_contacto)) / 86400000);
}

function generarAlertasMotor(){
  const alertas = [];
  const lista = window.prospectos || [];

  ALERTAS_CONFIG.forEach(cfg => {
    if(cfg.tipo === 'stock_viejo') return;
    lista.forEach(p => {
      try {
        if(cfg.condicion(p)){
          alertas.push({
            tipo:      cfg.tipo,
            prioridad: cfg.prioridad,
            icono:     cfg.icono,
            titulo:    cfg.titulo,
            nombre:    p.nombre,
            prospecto: p,
            msg:       generarMsgAlerta(cfg.tipo, p),
          });
        }
      } catch(e){}
    });
  });

  (window.autos || []).forEach(a => {
    if(a.estado === 'disponible' && (a.dias_en_stock || 0) >= 21){
      alertas.push({
        tipo: 'stock_viejo', prioridad: 3, icono: '📦',
        titulo: 'Auto en stock +21 días',
        nombre: `${a.marca} ${a.modelo} ${a.anio}`,
        msg: `${a.dias_en_stock} días sin venderse — considera ofrecerlo con incentivo.`,
      });
    }
  });

  return alertas.sort((a,b) => a.prioridad - b.prioridad);
}

function generarMsgAlerta(tipo, p){
  const d = diasSin(p);
  const msgs = {
    cierre_hoy:        `En trámite desde hace ${d} días — un empujón y cierras esta semana.`,
    caliente_frio:     `${d} días sin respuesta — está en ${calcTemp(p)}° y enfriándose.`,
    cotizacion_vence:  `${d} días en cotización — si no contactas hoy, lo pierdes.`,
    sin_contacto_5:    `${d} días sin contacto — reenvía un mensaje ahora.`,
    prueba_pendiente:  `Agendó prueba de manejo hace ${d} días — dale seguimiento.`,
    nuevo_sin_contacto:`Llegó hace ${d} días y no has mandado el primer mensaje.`,
    resena_pendiente:  `Ganaste esta venta — pídele su reseña por WhatsApp.`,
  };
  return msgs[tipo] || `Requiere atención — ${d} días sin actividad.`;
}

let _motorInterval = null;

function iniciarMotorAlertas(){
  revisarAlertasTiempoReal();
  actualizarBadgeAlertas();

  if(_motorInterval) clearInterval(_motorInterval);
  _motorInterval = setInterval(() => {
    revisarAlertasTiempoReal();
    actualizarBadgeAlertas();
  }, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') revisarAlertasTiempoReal();
  });
}

let _ultimaAlertaMostrada = null;

function revisarAlertasTiempoReal(){
  if(!window.prospectos || window.prospectos.length === 0) return;

  const alertas = generarAlertasMotor();
  const criticas = alertas.filter(a => a.prioridad === 1);

  if(criticas.length === 0) return;

  const ahora = Date.now();
  const clave = criticas[0].tipo + '-' + criticas[0].nombre;
  if(_ultimaAlertaMostrada === clave) return;

  const yaAlertado = localStorage.getItem('cierralo_alerta_' + clave);
  if(yaAlertado && (ahora - parseInt(yaAlertado)) < 60 * 60 * 1000) return;

  _ultimaAlertaMostrada = clave;
  localStorage.setItem('cierralo_alerta_' + clave, ahora.toString());

  mostrarBannerAlerta(criticas[0], criticas.length);
}

function mostrarBannerAlerta(alerta, totalCriticas){
  const anterior = document.getElementById('banner-alerta-motor');
  if(anterior) anterior.remove();

  const banner = document.createElement('div');
  banner.id = 'banner-alerta-motor';
  banner.style.cssText = `
    position:fixed;top:44px;left:0;right:0;z-index:500;
    background:linear-gradient(135deg,#FF6B35,#CC4A1A);
    padding:10px 16px;cursor:pointer;
    animation:slideDown .3s ease;
  `;
  banner.innerHTML = `
    <style>@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}</style>
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">${alerta.icono}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:white;">${alerta.titulo} — ${alerta.nombre}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${alerta.msg}</div>
      </div>
      ${totalCriticas > 1 ? `<div style="background:rgba(0,0,0,.25);border-radius:12px;padding:3px 8px;font-size:10px;font-weight:700;color:white;flex-shrink:0;">+${totalCriticas-1} más</div>` : ''}
      <div onclick="event.stopPropagation();this.closest('#banner-alerta-motor').remove();" 
           style="color:rgba(255,255,255,.7);font-size:18px;padding:4px;flex-shrink:0;">×</div>
    </div>
  `;

  banner.addEventListener('click', () => {
    banner.remove();
    if(alerta.prospecto) abrirProspecto(alerta.prospecto);
    else mostrarPanelAlertas();
  });

  document.body.appendChild(banner);
  setTimeout(() => { if(banner.parentNode) banner.remove(); }, 8000);
}

function mostrarPanelAlertas(){
  const alertas = generarAlertasMotor();

  if(alertas.length === 0){
    showToast('✅ Sin alertas pendientes — ¡todo al día!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#00000099;z-index:800;display:flex;align-items:flex-end;justify-content:center;';

  const porPrioridad = { 1: [], 2: [], 3: [] };
  alertas.forEach(a => porPrioridad[a.prioridad].push(a));

  const seccion = (titulo, color, lista) => lista.length === 0 ? '' : `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${titulo} (${lista.length})</div>
      ${lista.map(a => `
        <div onclick="document.body.removeChild(this.closest('[style*=fixed]'));${a.prospecto ? `abrirProspecto(${JSON.stringify(a.prospecto).replace(/"/g,'&quot;')})` : ''};"
          style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer;display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:18px;flex-shrink:0;">${a.icono}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:var(--text);">${a.nombre}</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.4;margin-top:2px;">${a.msg}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  overlay.innerHTML = `
    <div style="background:var(--s1);border-radius:24px 24px 0 0;width:100%;max-width:480px;
      max-height:80vh;overflow-y:auto;padding:16px 16px max(20px,env(safe-area-inset-bottom));
      border-top:2px solid #FF6B3535;">
      <div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 14px;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--text);">
          🔔 Alertas activas
        </div>
        <div style="background:var(--orange);color:white;font-size:11px;font-weight:700;
          padding:4px 10px;border-radius:20px;">${alertas.length} pendientes</div>
      </div>
      ${seccion('🔥 Críticas — actúa ahora', '#FF6B35', porPrioridad[1])}
      ${seccion('⚡ Importantes', '#F59E0B', porPrioridad[2])}
      ${seccion('💡 Informativas', '#9090B0', porPrioridad[3])}
      <button onclick="document.body.removeChild(this.closest('[style*=fixed]'));"
        style="width:100%;background:var(--s2);color:var(--text2);font-family:'Syne',sans-serif;
        font-weight:700;font-size:13px;padding:12px;border-radius:10px;border:1px solid var(--border);cursor:pointer;margin-top:4px;">
        Cerrar
      </button>
    </div>
  `;
  overlay.addEventListener('click', e => { if(e.target === overlay) document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
}

async function activarNotificaciones(){
  if(!('Notification' in window)){
    showToast('Tu navegador no soporta notificaciones'); return false;
  }
  if(!('serviceWorker' in navigator)){
    showToast('Instala la app en tu celular para activar notificaciones'); return false;
  }

  const permiso = await Notification.requestPermission();
  if(permiso !== 'granted'){
    showToast('Notificaciones bloqueadas — actívalas en configuración'); return false;
  }

  localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify({
    activo: true, activadoEn: Date.now()
  }));

  showToast('🔔 Notificaciones activadas');
  renderSeccionNotificaciones();
  return true;
}

function desactivarNotificaciones(){
  localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify({ activo: false }));
  showToast('🔕 Notificaciones desactivadas');
  renderSeccionNotificaciones();
}

function getPushConfig(){
  try {
    const s = localStorage.getItem(PUSH_STORAGE_KEY);
    return s ? JSON.parse(s) : { activo: false };
  } catch(e){ return { activo: false }; }
}

async function enviarNotificacionLocal(titulo, cuerpo, tag){
  const permiso = Notification.permission;
  if(permiso !== 'granted') return;
  try {
    const sw = window._swRegistration || await navigator.serviceWorker.ready;
    sw?.active?.postMessage({ type:'SHOW_NOTIFICATION', title: titulo, body: cuerpo, tag, url:'/' });
  } catch(e){}
}

async function probarNotificacion(){
  if(Notification.permission !== 'granted'){
    showToast('Primero activa las notificaciones'); return;
  }
  const sw = window._swRegistration || await navigator.serviceWorker.ready;
  if(!sw?.active){ showToast('Service worker no disponible'); return; }
  sw.active.postMessage({
    type:'SHOW_NOTIFICATION',
    title:'Ciérralo.mx 🔔',
    body: 'Las notificaciones funcionan correctamente.',
    tag: 'cierralo-test', url:'/'
  });
  showToast('Notificación de prueba enviada');
}

function renderSeccionNotificaciones(){
  const container = document.getElementById('push-notif-section');
  if(!container) return;

  const config   = getPushConfig();
  const permiso  = 'Notification' in window ? Notification.permission : 'no-soportado';
  const activo   = config.activo && permiso === 'granted';

  container.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">🔔 Alertas y notificaciones</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">
            ${activo ? '✅ Activas — te avisamos de todo lo importante' : '⭕ Desactivadas — actívalas para no perder ventas'}
          </div>
        </div>
        ${activo
          ? `<button onclick="desactivarNotificaciones()" style="font-size:11px;padding:6px 12px;background:var(--s2);color:var(--text3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;">Desactivar</button>`
          : `<button onclick="activarNotificaciones()" style="font-size:11px;padding:6px 12px;background:var(--orange);color:white;border:none;border-radius:8px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;">Activar</button>`
        }
      </div>
      <div style="padding:10px 14px;">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Qué te avisamos</div>
        ${[
          ['🔥','Prospectos calientes sin contacto 3+ días'],
          ['📋','Cotizaciones a punto de vencer'],
          ['👋','Prospectos nuevos sin primer contacto'],
          ['🚗','Autos +21 días en stock'],
          ['⭐','Ventas cerradas sin pedir reseña'],
        ].map(([i,t]) => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;">
            <span style="font-size:14px;">${i}</span>
            <span style="font-size:12px;color:var(--text2);">${t}</span>
          </div>
        `).join('')}
      </div>
      ${activo ? `
      <div style="padding:0 14px 12px;">
        <button onclick="probarNotificacion()" style="width:100%;font-size:11px;padding:8px;background:var(--s2);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;">
          🔔 Enviar notificación de prueba
        </button>
      </div>` : ''}
    </div>
  `;
}

function generarAlertasParaPush(){ return generarAlertasMotor(); }

function actualizarBadgeAlertas(){
  const alertas = generarAlertasMotor();
  const criticas = alertas.filter(a => a.prioridad <= 2).length;
  
  let badge = document.getElementById('badge-alertas-nav');
  const navBtn = document.querySelector('.nav-btn[data-screen="dashboard"]') || 
                 document.querySelector('.nav-item:first-child');
  
  if(criticas === 0){
    if(badge) badge.remove();
    return;
  }
  
  if(!badge && navBtn){
    badge = document.createElement('div');
    badge.id = 'badge-alertas-nav';
    badge.style.cssText = `
      position:absolute;top:2px;right:8px;
      background:var(--orange);color:white;
      font-size:9px;font-weight:800;
      width:16px;height:16px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-family:'Syne',sans-serif;
    `;
    navBtn.style.position = 'relative';
    navBtn.appendChild(badge);
  }
  if(badge) badge.textContent = criticas > 9 ? '9+' : criticas;
}

(function initMotorAlertas(){
  if(typeof window !== 'undefined'){
    window.addEventListener('cierralo:datosListos', () => {
      iniciarMotorAlertas();
    });
  }
})();


// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PLANES
// ═══════════════════════════════════════════════════════════════

window.planActual = window.planActual || 'gratis';
window.lugaresEliteRestantes = 100;

async function cargarPlanVendedor() {
  window.planActual = window.planActual || 'gratis';
  window.lugaresEliteRestantes = window.lugaresEliteRestantes ?? 100;
  window.esPrecioLanzamiento = window.esPrecioLanzamiento || false;

  try {
    const uid = currentUser?.id || window._currentUid;
    if (uid) {
      const { data: v, error: ev } = await sbAuth().from('vendedores')
        .select('plan, plan_fundador')
        .eq('id', uid)
        .maybeSingle();
      if (ev) console.warn('cargarPlanVendedor vendedor error:', ev.message);
      if (v) {
        window.planActual = v.plan || 'gratis';
        window.esPrecioLanzamiento = v.plan_fundador || false;
      }
    }

    const { data: configs, error: ec } = await sb.from('config_planes').select('clave, valor');
    if (ec) console.warn('cargarPlanVendedor config error:', ec.message);
    if (configs && configs.length > 0) {
      const usados = parseInt(configs.find(c => c.clave === 'elite_lanzamiento_usados')?.valor || '0');
      const limite = parseInt(configs.find(c => c.clave === 'elite_lanzamiento_limite')?.valor || '100');
      window.lugaresEliteRestantes = Math.max(0, limite - usados);
    }
  } catch(e) {
    console.warn('cargarPlanVendedor catch:', e.message);
  }
}

async function verificarLimiteProspectos() {
  if (window.planActual !== 'gratis') return { puede: true };

  const { count } = await sb.from('prospectos')
    .select('id', { count: 'exact', head: true })
    .eq('vendedor_id', currentUser.id)
    .neq('etapa', 'perdido');

  const usados = count || 0;
  const limite = 25;
  const restantes = limite - usados;

  if (usados >= limite) return { puede: false, usados, limite, restantes: 0 };
  if (usados >= 20) return { puede: true, usados, limite, restantes, advertencia: true };
  return { puede: true, usados, limite, restantes };
}

function mostrarAdvertenciaLimite(usados, limite) {
  const restantes = limite - usados;
  showToast(`⚠️ Te quedan ${restantes} prospectos gratuitos`, 4000);
}

async function mostrarPantallaPlanesUpgrade(motivo) {
  await cargarPlanVendedor();

  const lugares = window.lugaresEliteRestantes;
  const hayLanzamiento = lugares > 0;
  const precioElite = hayLanzamiento ? '$349' : '$499';
  const etiquetaElite = hayLanzamiento
    ? `<div class="plan-badge-launch">🔥 Precio fundador · Solo ${lugares} lugares</div>`
    : '';

  const motivoTxt = motivo === 'limite_prospectos'
    ? '⚡ Alcanzaste el límite de 25 prospectos gratuitos'
    : motivo === 'excel'
    ? '📊 La importación de Excel es exclusiva de planes de pago'
    : motivo === 'wa_semaforo'
    ? '🟢 El semáforo WhatsApp es exclusivo del plan Elite'
    : motivo === 'ia_limite'
    ? '🤖 Agotaste tus 10 mensajes IA del mes'
    : '⭐ Desbloquea todo el poder de Ciérralo.mx';

  const html = `
  <div class="modal-overlay" id="modal-planes" style="background:#00000066;" onclick="if(event.target===this)cerrarModalPlanes()">
    <div class="modal-sheet" style="max-height:92vh;overflow-y:auto;" id="sheet-planes">
      <div class="swipe-handle"></div>
      <div style="display:flex;justify-content:flex-end;padding:12px 16px 0;">
        <button onclick="cerrarModalPlanes()" style="background:var(--s3);border:none;border-radius:50%;
          width:30px;height:30px;font-size:16px;color:var(--text2);cursor:pointer;
          display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div style="text-align:center;padding:4px 20px 8px;">
        <div style="font-size:32px;margin-bottom:8px;">🚀</div>
        <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px;">
          Elige tu plan
        </div>
        <div style="font-size:12px;color:var(--orange);font-weight:600;background:var(--orangeBg);
          border:1px solid #FF6B3530;border-radius:20px;padding:5px 14px;display:inline-block;">
          ${motivoTxt}
        </div>
      </div>

      <div style="margin:12px 16px 8px;background:var(--s2);border:1px solid var(--border);
        border-radius:16px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--text2);">Gratis</div>
            <div style="font-size:11px;color:var(--text3);">Tu plan actual</div>
          </div>
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text3);">$0</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${featureLine('25 prospectos activos', true)}
          ${featureLine('10 mensajes IA por mes', true)}
          ${featureLine('3 reseñas visibles en perfil', true)}
          ${featureLine('Importar Excel / CSV', false)}
          ${featureLine('Weekly Wrapped', false)}
          ${featureLine('Semáforo WhatsApp', false)}
          ${featureLine('Badge verificado Elite', false)}
        </div>
      </div>

      <div style="margin:0 16px 8px;background:linear-gradient(135deg,#FF6B3510,var(--s1));
        border:2px solid #FF6B3545;border-radius:16px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--orange);">Pro</div>
            <div style="font-size:11px;color:var(--text2);">Para vendedores activos</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--orange);">$199</div>
            <div style="font-size:10px;color:var(--text3);">MXN/mes</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text2);background:var(--orangeBg);border-radius:8px;
          padding:6px 10px;margin-bottom:10px;">
          💡 Menos que la comisión de 1 venta — y te ayuda a cerrar más
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${featureLine('Prospectos ilimitados', true)}
          ${featureLine('IA ilimitada', true)}
          ${featureLine('Todas las reseñas visibles', true)}
          ${featureLine('Importar Excel / CSV', true)}
          ${featureLine('Weekly Wrapped con medallas', true)}
          ${featureLine('Semáforo WhatsApp', false)}
          ${featureLine('Badge verificado Elite', false)}
        </div>
        <button class="btn btn-p" style="margin-top:12px;font-size:13px;"
          onclick="iniciarPago('pro')">
          ⚡ Activar Pro — $199/mes
        </button>
      </div>

      <div style="margin:0 16px 16px;background:linear-gradient(135deg,#F59E0B18,#A855F712,var(--s1));
        border:2px solid #F59E0B60;border-radius:16px;padding:14px 16px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;
          background:radial-gradient(circle,#F59E0B20,transparent);border-radius:50%;"></div>
        ${etiquetaElite}
        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;
              background:linear-gradient(90deg,#F59E0B,#FF6B35);-webkit-background-clip:text;
              -webkit-text-fill-color:transparent;">⭐ Elite</div>
            <div style="font-size:11px;color:var(--text2);">Solo para los mejores</div>
          </div>
          <div style="text-align:right;">
            ${hayLanzamiento
              ? `<div style="font-size:12px;color:var(--text3);text-decoration:line-through;">$499</div>
                 <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--yellow);">${precioElite}</div>`
              : `<div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--yellow);">${precioElite}</div>`
            }
            <div style="font-size:10px;color:var(--text3);">MXN/mes</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
          ${featureLine('Todo lo de Pro', true, 'yellow')}
          ${featureLine('Semáforo WhatsApp Business', true, 'yellow')}
          ${featureLine('Badge ⭐ Elite en tu perfil público', true, 'yellow')}
          ${featureLine('Primero en el directorio Ciérralo', true, 'yellow')}
          ${featureLine('Estadísticas para tu gerente', true, 'yellow')}
          ${featureLine('Soporte por WhatsApp directo', true, 'yellow')}
        </div>
        <button onclick="iniciarPago('elite')"
          style="width:100%;background:linear-gradient(90deg,#F59E0B,#FF8C00);color:white;
          border:none;border-radius:10px;padding:13px;font-family:'Syne',sans-serif;
          font-weight:800;font-size:13px;cursor:pointer;letter-spacing:.3px;">
          ⭐ Quiero ser Elite — ${precioElite}/mes
        </button>
        ${hayLanzamiento
          ? `<div style="text-align:center;font-size:10px;color:var(--text3);margin-top:8px;">
              Precio sube a $499 cuando se agoten los ${lugares} lugares restantes
            </div>`
          : ''}
      </div>

      <div style="text-align:center;padding:0 20px 24px;">
        <div style="font-size:11px;color:var(--text3);">Sin contratos · Cancela cuando quieras</div>
        <button onclick="cerrarModalPlanes()"
          style="margin-top:10px;background:none;border:none;color:var(--text3);
          font-size:12px;cursor:pointer;text-decoration:underline;">
          Continuar con plan gratis
        </button>
      </div>
    </div>
  </div>`;

  const anterior = document.getElementById('modal-planes');
  if (anterior) anterior.remove();

  document.body.insertAdjacentHTML('beforeend', html);
  requestAnimationFrame(() => {
    const overlay = document.getElementById('modal-planes');
    if(overlay) overlay.classList.add('open');
    const sheet = document.getElementById('sheet-planes');
    if(sheet) sheet.style.transform = 'translateY(0)';
  });
}

function featureLine(texto, incluido, color) {
  const c = color === 'yellow' ? 'var(--yellow)' : incluido ? 'var(--green)' : 'var(--text3)';
  const icon = incluido ? '✓' : '✗';
  const textColor = incluido ? 'var(--text)' : 'var(--text3)';
  return `<div style="display:flex;align-items:center;gap:8px;">
    <span style="color:${c};font-size:12px;font-weight:700;width:14px;flex-shrink:0;">${icon}</span>
    <span style="font-size:12px;color:${textColor};">${texto}</span>
  </div>`;
}

function cerrarModalPlanes() {
  const m = document.getElementById('modal-planes');
  if(m) m.remove();
}

async function iniciarPago(plan) {
  cerrarModalPlanes();

  const metodos = `
  <div class="modal-overlay" id="modal-metodo" onclick="if(event.target===this)this.remove()">
    <div class="modal-sheet" id="sheet-metodo" onclick="event.stopPropagation()">
      <div class="swipe-handle"></div>
      <div style="padding:20px;">
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;
          color:var(--text);margin-bottom:4px;">¿Cómo quieres pagar?</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:16px;">
          Plan ${plan === 'pro' ? 'Pro $199' : 'Elite ' + (window.lugaresEliteRestantes > 0 ? '$349' : '$499')} / mes
        </div>
        <div onclick="event.stopPropagation();procesarPago('${plan}','card')"
          style="background:var(--s2);border:1px solid var(--border);border-radius:12px;
          padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">💳</span>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);">Tarjeta de crédito / débito</div>
            <div style="font-size:11px;color:var(--text2);">Visa, Mastercard, Amex · Activación inmediata</div>
          </div>
        </div>
        <div onclick="event.stopPropagation();procesarPago('${plan}','oxxo')"
          style="background:var(--s2);border:1px solid var(--border);border-radius:12px;
          padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">🏪</span>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);">OXXO</div>
            <div style="font-size:11px;color:var(--text2);">Paga en efectivo · Activa en 24 hrs</div>
          </div>
        </div>
        <div onclick="event.stopPropagation();procesarPago('${plan}','transfer')"
          style="background:var(--s2);border:1px solid var(--border);border-radius:12px;
          padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">🏦</span>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);">Transferencia SPEI</div>
            <div style="font-size:11px;color:var(--text2);">Desde tu banco · Activa en 1-2 hrs</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('.confirm-overlay').forEach(m => m.classList.remove('open'));
  document.body.insertAdjacentHTML('beforeend', metodos);
  requestAnimationFrame(() => {
    const overlay = document.getElementById('modal-metodo');
    if(overlay) overlay.classList.add('open');
  });
}

async function procesarPago(plan, metodo) {
  const modal = document.getElementById('modal-metodo');
  if(modal) modal.remove();

  showToast('⏳ Creando orden de pago...', 3000);

  try {
    let token = window._authToken;
    if(!token){
      try {
        const s = localStorage.getItem('cierralo_session');
        if(s) token = JSON.parse(s).access_token;
      } catch(e){}
    }

    if(!token){
      showToast('❌ Sesión expirada. Cierra y vuelve a abrir la app.', 4000);
      return;
    }

    const res = await fetch('https://nkjradximipkrzscgvhv.supabase.co/functions/v1/crear-orden-pago', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ plan, metodo_pago: metodo }),
    });

    const data = await res.json();

    if(!res.ok || data.error) {
      showToast('❌ ' + (data.error || 'Error al crear orden'), 4000);
      return;
    }

    mostrarConfirmacionPago(plan, metodo, data);

  } catch(e) {
    showToast('❌ Error de conexión. Intenta de nuevo.', 4000);
  }
}

function mostrarConfirmacionPago(plan, metodo, data) {
  let contenido = '';

  if(metodo === 'oxxo' && data.oxxo_ref) {
    contenido = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:48px;margin-bottom:8px;">🏪</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text);">Paga en OXXO</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">Tienes 72 horas para realizar el pago</div>
      </div>
      <div style="background:var(--s2);border:2px dashed var(--border2);border-radius:12px;
        padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Referencia de pago</div>
        <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--orange);letter-spacing:1px;word-break:break-all;">${data.oxxo_ref}</div>
        <button onclick="navigator.clipboard.writeText('${data.oxxo_ref}').then(()=>showToast('✓ Copiado',2000))"
          style="margin-top:8px;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:6px 14px;font-size:11px;color:var(--text2);cursor:pointer;">
          📋 Copiar referencia
        </button>
      </div>
      <div style="font-size:11px;color:var(--text2);text-align:center;line-height:1.6;">
        Tu plan se activa automáticamente al confirmar el pago.<br>
        <strong style="color:var(--text);">Monto: $${data.monto/100} MXN</strong>
      </div>`;
  } else if(metodo === 'transfer' && data.spei_clabe) {
    contenido = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:48px;margin-bottom:8px;">🏦</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text);">Transferencia SPEI</div>
      </div>
      <div style="background:var(--s2);border:2px dashed var(--border2);border-radius:12px;
        padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">CLABE interbancaria</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--blue);letter-spacing:1px;">${data.spei_clabe}</div>
        <button onclick="navigator.clipboard.writeText('${data.spei_clabe}').then(()=>showToast('✓ Copiado',2000))"
          style="margin-top:8px;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:6px 14px;font-size:11px;color:var(--text2);cursor:pointer;">
          📋 Copiar CLABE
        </button>
      </div>
      <div style="font-size:11px;color:var(--text2);text-align:center;line-height:1.6;">
        Banco: STP · Monto exacto: <strong style="color:var(--text);">$${data.monto/100} MXN</strong><br>
        Concepto: ${data.descripcion}
      </div>`;
  } else if(metodo === 'card' && data.checkout_url) {
    contenido = `
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">💳</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px;">Pago con tarjeta</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:16px;">Serás redirigido a la página segura de pago.</div>
        <button onclick="window.open('${data.checkout_url}','_blank')" class="btn btn-p" style="font-size:13px;margin-bottom:10px;">
          💳 Ir a pagar con tarjeta →
        </button>
        <div style="font-size:11px;color:var(--text3);">Monto: <strong style="color:var(--text);">$${data.monto/100} MXN</strong> · Pago seguro vía Conekta</div>
      </div>`;
  } else {
    contenido = `
      <div style="text-align:center;">
        <div style="font-size:56px;margin-bottom:12px;">🎉</div>
        <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--green);margin-bottom:6px;">¡Plan activado!</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:16px;">${data.descripcion || 'Tu plan ha sido activado correctamente.'}</div>
        ${data.precio_lanzamiento
          ? `<div style="background:var(--yellowBg);border:1px solid #F59E0B40;border-radius:10px;padding:10px;font-size:12px;color:var(--yellow);margin-bottom:16px;">
              🔥 Quedaste registrado como Vendedor Fundador #${100 - window.lugaresEliteRestantes + 1}
            </div>`
          : ''}
        <button onclick="document.getElementById('modal-pago-resultado')?.remove();location.reload()" class="btn btn-g" style="font-size:13px;">
          ✓ Ver mi nuevo plan
        </button>
      </div>`;
  }

  const html = `
  <div class="modal-overlay" id="modal-pago-resultado" onclick="if(event.target===this)this.remove()">
    <div class="modal-sheet" id="sheet-pago-resultado">
      <div class="swipe-handle"></div>
      <div style="position:relative;padding:20px 18px 24px;">
        <button onclick="document.getElementById('modal-pago-resultado')?.remove()"
          style="position:absolute;top:0;right:4px;background:none;border:none;
          font-size:22px;color:var(--text3);cursor:pointer;padding:4px 8px;line-height:1;z-index:10;">✕</button>
        ${contenido}
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  requestAnimationFrame(() => {
    const overlay = document.getElementById('modal-pago-resultado');
    if(overlay) overlay.classList.add('open');
  });
}

const styleEl = document.createElement('style');
styleEl.textContent = `
.plan-badge-launch {
  display:inline-block;
  background:linear-gradient(90deg,#F59E0B,#FF6B35);
  color:white;font-size:10px;font-weight:700;
  padding:4px 10px;border-radius:20px;
  margin-bottom:8px;letter-spacing:.3px;
}
`;
document.head.appendChild(styleEl);

async function actualizarCardPlan() {
  if(!currentUser || !currentUser.id) return;
  const cardNombre = document.getElementById('plan-nombre-badge');
  const cardDesc   = document.getElementById('plan-desc-badge');
  const cardBarra  = document.getElementById('plan-prospectos-barra');
  if(!cardNombre) return;

  await cargarPlanVendedor();
  const plan = window.planActual || 'gratis';

  const nombres  = { gratis: 'Gratis', pro: '⚡ Pro', elite: '⭐ Elite' };
  const colores  = { gratis: 'var(--text2)', pro: 'var(--orange)', elite: 'var(--yellow)' };

  cardNombre.textContent   = nombres[plan] || 'Gratis';
  cardNombre.style.color   = colores[plan] || 'var(--text2)';

  if(plan === 'gratis') {
    const { count } = await sb.from('prospectos')
      .select('id', { count: 'exact', head: true })
      .eq('vendedor_id', currentUser.id)
      .neq('etapa', 'perdido');

    const usados = count || 0;
    const pct    = Math.min(100, Math.round((usados / 25) * 100));
    const color  = pct >= 80 ? 'var(--red)' : pct >= 60 ? 'var(--yellow)' : 'var(--green)';

    cardDesc.textContent = `${usados} de 25 prospectos usados`;
    if(cardBarra) cardBarra.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:5px;background:var(--s3);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s;"></div>
        </div>
        <div style="font-size:10px;color:${color};font-weight:700;flex-shrink:0;">${pct}%</div>
      </div>`;
  } else if(plan === 'pro') {
    cardDesc.textContent = 'Prospectos ilimitados · IA ilimitada';
    if(cardBarra) cardBarra.innerHTML = '';
  } else {
    const lanzamiento = window.esPrecioLanzamiento;
    cardDesc.textContent = lanzamiento
      ? 'Vendedor Fundador · Todos los beneficios Elite'
      : 'Todos los beneficios Elite activos';
    if(cardBarra) cardBarra.innerHTML = '';
  }
}
