// Глобальные переменные
let currentMarker = null;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  const map = L.map('map').setView([60, 30], 8);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  osm.addTo(map);

  let soilLayer = null;

  // Функция клика
  function handleLayerClick(lat, lng, properties) {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);

    const soilNum = parseInt(properties.fid || properties.soil_type || 0);
    const soilClass = properties.soil_textural_class || 'Неизвестно';
    const ph = properties.ph || 7.0;
    const oc = properties['organic_carbon_%'] || 0;
    const area = properties.area_m2 || 0;
    const ksoil = ph < 5.5 ? 0.8 : 1.0;

    const params = { soil: soilClass, ph: ph, organic_carbon: oc, area: area, ksoil: ksoil, kugv: 1.0, koopr: 1.0 };

    updateSidebar(lat, lng, params);
  }

  // Загрузка GeoJSON
  fetch('soil_spb_lo.geojson')
    .then(response => {
      if (!response.ok) throw new Error('Файл soil_spb_lo.geojson не найден (404)');
      return response.json();
    })
    .then(soilData => {
      soilLayer = L.geoJSON(soilData, {
        style: function(feature) {
          const val = parseInt(feature.properties.fid || feature.properties.soil_type || 0);
          const cls = feature.properties.soil_textural_class;
          if (val === 3 || cls === 'Глина') return {fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.6};
          if (val === 2 || cls?.includes('Тяж')) return {fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.6};
          if (val === 1 || cls?.includes('Лёг')) return {fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.6};
          return {fillColor: '#90EE90', color: '#228B22', weight: 1, fillOpacity: 0.6};
        },
        onEachFeature: function(feature, layer) {
          layer.on('click', e => handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties));
          const p = feature.properties;
          layer.bindPopup(
            `<b>Тип почвы:</b> ${p.soil_textural_class || p.soil_type || 'N/A'}<br>` +
            `<b>pH:</b> ${p.ph || 'N/A'}<br>` +
            `<b>OC (%):</b> ${p['organic_carbon_%'] || 'N/A'}<br>` +
            `<b>Площадь:</b> ${p.area_m2 ? (p.area_m2/10000).toFixed(2) + ' га' : 'N/A'}`
          );
        }
      });
      soilLayer.addTo(map);
      L.control.layers({}, {'Почвы СПб/ЛО': soilLayer}).addTo(map);
      console.log('Слой загружен успешно:', soilData.features.length, 'полигонов');
    })
    .catch(err => {
      console.error('Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;">${err.message}<br>Проверьте наличие soil_spb_lo.geojson</p>`;
    });
});

// Sidebar
function updateSidebar(lat, lng, params) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
    <h3>Параметры почвы</h3>
    <p><strong>Тип:</strong> ${params.soil}</p>
    <p><strong>pH:</strong> ${params.ph.toFixed(1)}</p>
    <p><strong>OC (%):</strong> ${params.organic_carbon.toFixed(1)}</p>
    <p><strong>Площадь:</strong> ${(params.area/10000).toFixed(2)} га</p>
    <br><button onclick="calculateGII(${params.ksoil},1.0,1.0)">GII</button>
  `;
}

function calculateGII(ksoil, kugv, koopr) {
  const Kkr = ksoil * kugv * koopr;
  const GII0PND = 2.12;
  const GII = (GII0PND * Kkr).toFixed(2);
  const risk = getRiskClass(GII);
  document.getElementById('info').innerHTML += `
    <div style="margin-top:15px;padding:10px;background:#fff8e1;border-left:4px solid #ffa000;">
      <strong>GII = ${GII}</strong><br>
      K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
      <em>${risk}</em>
    </div>
  `;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return 'I — Низкий риск';
  if (gii <= 4.0) return 'II — Низкий';
  if (gii <= 6.0) return 'III — Средний';
  if (gii <= 8.0) return 'IV — Высокий';
  return 'V — Критический';
}
