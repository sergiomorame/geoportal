// =====================================================
// CONFIGURACIÓN
// =====================================================
const SUPABASE_URL = 'https://yaeieggxlpnbgsrpedjy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZWllZ2d4bHBuYmdzcnBlZGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDY4NzcsImV4cCI6MjA4MzU4Mjg3N30.0gQRBk3mVCq60a23R6TQKN5MT1sjTdCA_Xi_UMxfMV8';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// ESTADO GLOBAL
// =====================================================
let estadoApp = {
  tipoEleccion: 'gobernador',
  municipioSeleccionado: null,
  vistaActual: 'mapa',
  mapaLeaflet: null,
  chartPartidos: null,
  chartParticipacion: null,
  chartComparativo: null,
  datosCache: {}
};

const COLORES_PARTIDOS = {
  MORENA: '#C41E3A',
  PAN: '#0066CC',
  MC: '#FF6600'
};

// =====================================================
// UTILIDADES
// =====================================================
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('show', show);
}

function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => errorEl.style.display = 'none', 5000);
}

function formatearNumero(n) {
  if (!n && n !== 0) return '-';
  return Number(n).toLocaleString('es-MX');
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  configurarEventListeners();
  inicializarMapa();
  await cargarMunicipios();
  await cargarDatosIniciales();
});

async function cargarDatosIniciales() {
  try {
    showLoading(true);
    await cargarEstadisticasGenerales();
    await cargarMapa();
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError('Error al cargar datos iniciales: ' + err.message);
  }
}

// =====================================================
// EVENTOS
// =====================================================
function configurarEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => cambiarTab(tab.dataset.tab);
  });

  document.querySelectorAll('[data-eleccion]').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('[data-eleccion]').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
      estadoApp.tipoEleccion = el.dataset.eleccion;
    };
  });

  document.querySelectorAll('[data-vista]').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('[data-vista]').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
      estadoApp.vistaActual = el.dataset.vista;
    };
  });

  document.getElementById('selectMunicipio').onchange = (e) => {
    estadoApp.municipioSeleccionado = e.target.value || null;
  };
}

// =====================================================
// CARGAR MUNICIPIOS
// =====================================================
async function cargarMunicipios() {
  try {
    const { data, error } = await supabaseClient.rpc('get_municipios_disponibles');
    
    if (error) throw error;
    
    const select = document.getElementById('selectMunicipio');
    select.innerHTML = '<option value="">Todos los municipios</option>';
    
    if (data && data.length > 0) {
      data.forEach(m => {
        const option = document.createElement('option');
        option.value = m.municipio;
        option.textContent = `${m.municipio} (${m.total_secciones} secciones)`;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Error al cargar municipios:', err);
  }
}

// =====================================================
// TABS
// =====================================================
function cambiarTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-content="${tab}"]`).classList.add('active');

  if (tab === 'participacion') cargarDatosParticipacion();
  if (tab === 'comparativo') cargarDatosComparativo();
  if (tab === 'datos') cargarDatosAbiertos();
}

// =====================================================
// APLICAR FILTROS
// =====================================================
async function aplicarFiltros() {
  try {
    showLoading(true);
    
    estadoApp.datosCache = {};
    
    await cargarEstadisticasGenerales();
    
    document.getElementById('mapPanel').style.display = 'none';
    document.getElementById('chartsPanel').style.display = 'none';
    document.getElementById('tablePanel').style.display = 'none';
    
    if (estadoApp.vistaActual === 'mapa') {
      document.getElementById('mapPanel').style.display = 'block';
      await cargarMapa();
    } else if (estadoApp.vistaActual === 'graficas') {
      document.getElementById('chartsPanel').style.display = 'block';
      await cargarGraficaPartidos();
    } else if (estadoApp.vistaActual === 'tabla') {
      document.getElementById('tablePanel').style.display = 'block';
      await cargarTablaMunicipios();
    }
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError('Error al aplicar filtros: ' + err.message);
  }
}

// =====================================================
// ESTADÍSTICAS
// =====================================================
/*async function cargarEstadisticasGenerales() {
  try {
    const { data, error } = await supabaseClient.rpc('get_estadisticas_generales', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos disponibles');

    const s = data[0];
    document.getElementById('listaNominal').textContent = formatearNumero(s.lista_nominal);
    document.getElementById('participacion').textContent = formatearNumero(s.total_participacion);
    document.getElementById('participacionPct').textContent = `${s.porcentaje_participacion || 0}%`;
    document.getElementById('abstencion').textContent = formatearNumero(s.total_abstencion);
    document.getElementById('abstencionPct').textContent = `${s.porcentaje_abstencion || 0}%`;
    document.getElementById('votosValidos').textContent = formatearNumero(s.votos_validos);
    
  } catch (err) {
    console.error("Error en Estadísticas:", err);
    showError('Error al cargar estadísticas: ' + err.message);
  }
}
*/
// =====================================================
// MAPA
// =====================================================
function inicializarMapa() {
  estadoApp.mapaLeaflet = L.map('map-container').setView([20.6, -103.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(estadoApp.mapaLeaflet);
}

async function cargarMapa() {
  try {
    const { data, error } = await supabaseClient.rpc('get_mapa_electoral', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });

    if (error) throw error;
    if (!data || !data[0] || !data[0].geojson) throw new Error('No hay datos de mapa');
    
    const geoData = data[0].geojson;

    estadoApp.mapaLeaflet.eachLayer(l => {
      if (l instanceof L.GeoJSON) estadoApp.mapaLeaflet.removeLayer(l);
    });

    const layer = L.geoJSON(geoData, {
      style: f => ({
        fillColor: COLORES_PARTIDOS[f.properties.ganador] || '#999',
        fillOpacity: 0.7,
        weight: 1,
        color: '#fff'
      }),
      onEachFeature: (f, l) => {
        const popup = `
          <b>${f.properties.nombre || 'N/A'}</b><br>
          Ganador: ${f.properties.ganador || 'N/A'}
        `;
        l.bindPopup(popup);
      }
    }).addTo(estadoApp.mapaLeaflet);

    estadoApp.mapaLeaflet.fitBounds(layer.getBounds());
  } catch (err) {
    console.error('Error al cargar mapa:', err);
    showError('Error al cargar el mapa: ' + err.message);
  }
}

// =====================================================
// GRÁFICAS
// =====================================================
async function cargarGraficaPartidos() {
  try {
    const { data, error } = await supabaseClient.rpc('get_resultados_partidos', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos de partidos');

    if (estadoApp.chartPartidos) {
      estadoApp.chartPartidos.destroy();
      estadoApp.chartPartidos = null;
    }

    const ctx = document.getElementById('chartPartidos').getContext('2d');
    estadoApp.chartPartidos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.partido),
        datasets: [{
          label: 'Votos',
          data: data.map(d => d.total_votos),
          backgroundColor: data.map(d => d.color)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Votos: ${formatearNumero(context.parsed.y)} (${data[context.dataIndex].porcentaje}%)`;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error al cargar gráfica:', err);
    showError('Error al cargar gráfica: ' + err.message);
  }
}

function cambiarTipoGrafica(tipo) {
  if (!estadoApp.chartPartidos) return;
  
  estadoApp.chartPartidos.config.type = tipo;
  estadoApp.chartPartidos.update();
}

// =====================================================
// TABLA MUNICIPIOS
// =====================================================
async function cargarTablaMunicipios() {
  try {
    const { data, error } = await supabaseClient.rpc('get_resultados_municipio', {
      p_tipo_eleccion: estadoApp.tipoEleccion
    });

    if (error) throw error;
    if (!data) throw new Error('No hay datos de municipios');

    const tbody = document.querySelector('#tablaMunicipios tbody');
    tbody.innerHTML = '';

    data.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td>${r.municipio || 'N/A'}</td>
          <td>${formatearNumero(r.lista_nominal)}</td>
          <td>${r.porcentaje_participacion || 0}%</td>
          <td>${formatearNumero(r.morena)}</td>
          <td>${formatearNumero(r.pan)}</td>
          <td>${formatearNumero(r.mc)}</td>
          <td><span class="partido-badge" style="background:${COLORES_PARTIDOS[r.ganador] || '#999'}">${r.ganador || 'N/A'}</span></td>
        </tr>`;
    });
  } catch (err) {
    console.error('Error al cargar tabla:', err);
    showError('Error al cargar tabla de municipios: ' + err.message);
  }
}

// =====================================================
// PARTICIPACIÓN
// =====================================================
async function cargarDatosParticipacion() {
  try {
    showLoading(true);
    const { data, error } = await supabaseClient.rpc('get_analisis_participacion', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos de participación');

    if (estadoApp.chartParticipacion) {
      estadoApp.chartParticipacion.destroy();
      estadoApp.chartParticipacion = null;
    }

    const ctx = document.getElementById('chartParticipacion').getContext('2d');
    estadoApp.chartParticipacion = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.rango_participacion),
        datasets: [{
          label: 'Cantidad de Secciones',
          data: data.map(d => d.cantidad_secciones),
          backgroundColor: '#2a5298'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const item = data[context.dataIndex];
                return [
                  `Secciones: ${formatearNumero(item.cantidad_secciones)}`,
                  `Porcentaje: ${item.porcentaje_secciones}%`,
                  `Participación promedio: ${item.participacion_promedio}%`
                ];
              }
            }
          }
        }
      }
    });

    const statsContainer = document.getElementById('statsParticipacion');
    statsContainer.innerHTML = '';
    
    data.forEach(d => {
      statsContainer.innerHTML += `
        <div class="stat-card">
          <div class="stat-label">${d.rango_participacion}</div>
          <div class="stat-value">${formatearNumero(d.cantidad_secciones)}</div>
          <div class="stat-subtitle">
            ${d.porcentaje_secciones}% de secciones<br>
            ${formatearNumero(d.total_electores)} electores<br>
            Promedio: ${d.participacion_promedio}%
          </div>
        </div>
      `;
    });
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    console.error('Error en participación:', err);
    showError('Error al cargar datos de participación: ' + err.message);
  }
}

// =====================================================
// COMPARATIVO
// =====================================================
async function cargarDatosComparativo() {
  try {
    showLoading(true);
    const { data, error } = await supabaseClient.rpc('get_comparativo_elecciones');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos comparativos');

    const tbody = document.querySelector('#tablaComparativo tbody');
    tbody.innerHTML = '';

    data.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td><span class="partido-badge" style="background:${COLORES_PARTIDOS[r.partido]}">${r.partido}</span></td>
          <td>${formatearNumero(r.votos_gobernador)}</td>
          <td>${r.porcentaje_gobernador || 0}%</td>
          <td>${formatearNumero(r.votos_presidencia)}</td>
          <td>${r.porcentaje_presidencia || 0}%</td>
          <td>${formatearNumero(r.votos_ayuntamiento)}</td>
          <td>${r.porcentaje_ayuntamiento || 0}%</td>
        </tr>`;
    });

    if (estadoApp.chartComparativo) {
      estadoApp.chartComparativo.destroy();
      estadoApp.chartComparativo = null;
    }

    const ctx = document.getElementById('chartComparativo').getContext('2d');
    estadoApp.chartComparativo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.partido),
        datasets: [
          {
            label: 'Gobernador',
            data: data.map(d => d.votos_gobernador),
            backgroundColor: '#1e3c72'
          },
          {
            label: 'Presidencia',
            data: data.map(d => d.votos_presidencia),
            backgroundColor: '#2a5298'
          },
          {
            label: 'Ayuntamiento',
            data: data.map(d => d.votos_ayuntamiento),
            backgroundColor: '#5a9bd4'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatearNumero(context.parsed.y)} votos`;
              }
            }
          }
        }
      }
    });
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    console.error('Error en comparativo:', err);
    showError('Error al cargar datos comparativos: ' + err.message);
  }
}

// =====================================================
// DATOS ABIERTOS
// =====================================================
async function cargarDatosAbiertos() {
  try {
    showLoading(true);
    const { data, error } = await supabaseClient.rpc('get_datos_abiertos', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos disponibles');

    document.getElementById('vistaPrevia').innerHTML =
      `<pre>${JSON.stringify(data.slice(0, 50), null, 2)}</pre>`;
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    console.error('Error en datos abiertos:', err);
    showError('Error al cargar datos abiertos: ' + err.message);
  }
}

async function descargarJSON() {
  try {
    showLoading(true);
    const { data, error } = await supabaseClient.rpc('get_datos_abiertos', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });
    
    if (error) throw error;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `datos_${estadoApp.tipoEleccion}_${Date.now()}.json`;
    a.click();
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError('Error al descargar JSON: ' + err.message);
  }
}

async function descargarCSV() {
  try {
    showLoading(true);
    const { data, error } = await supabaseClient.rpc('get_datos_abiertos', {
      p_tipo_eleccion: estadoApp.tipoEleccion,
      p_municipio: estadoApp.municipioSeleccionado
    });
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No hay datos para descargar');
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `datos_${estadoApp.tipoEleccion}_${Date.now()}.csv`;
    a.click();
    
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError('Error al descargar CSV: ' + err.message);
  }
}