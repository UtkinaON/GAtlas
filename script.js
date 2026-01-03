// Глобальные переменные
let currentMarker = null;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function () {
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

    // Безопасное извлечение значений с заменой "-999.9" и пустых значений
    const soilClass = (properties.soil_textural_class || properties.soil_type || '').trim() || '—';
    const phRaw = properties.ph;
    const ocRaw = properties['organic_carbon_%'];
    
    // Функция для форматирования: замена -999.9 и некорректных значений на "—"
    const formatValue = (val) => {
      if (val === undefined || val === null || val === -999.9 || val === '-999.9') {
        return '—';
      }
      if (typeof val === 'number') {
        return val.toFixed(1);
      }
      return String(val).trim() || '—';
    };

    const ph = formatValue(phRaw);
    const oc = formatValue(ocRaw);
    const area = properties.area_m2 ? (properties.area_m2 / 10000).toFixed(2) + ' га' : '—';

    // Расчёт K_soil (пример, можно расширить)
    let ksoil = 1.0;
    if (ph !== '—' && !isNaN(ph) && parseFloat(ph) < 5.5) {
      ksoil = 1.4; // или ваша логика
    }

    const params = {
      soil: soilClass,
      ph: ph,
      organic_carbon: oc,
      area: area,
      ksoil: ksoil,
      kugv: 1.0,
      koopr: 1.0
    };

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
        style: function (feature) {
          const val = parseInt(feature.properties.fid || feature.properties.soil_type || 0);
          const cls = (feature.properties.soil_textural_class || '').trim();

          // Стиль с повышенной прозрачностью
          if (val === 3 || /Глина/i.test(cls)) {
            return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.2 };
          }
          if (val === 2 || /Тяжёлый суглинок/i.test(cls)) {
            return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.2 };
          }
          if (val === 1 || /Лёгкий суглинок/i.test(cls)) {
            return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.2 };
          }
          // "Супесь" и по умолчанию
          return { fillColor: '#90EE90', color: '#228B22', weight: 1, fillOpacity: 0.2 };
        },
        onEachFeature: function (feature, layer) {
          layer.on('click', e => {
            handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties);
          });

          const p = feature.properties;
          const phDisplay = (p.ph === -999.9 || p.ph === '-999.9' || p.ph === undefined) ? '—' : p.ph;
          const ocDisplay = (p['organic_carbon_%'] === -999.9 || p['organic_carbon_%'] === '-999.9' || p['organic_carbon_%'] === undefined) ? '—' : p['organic_carbon_%'];

          layer.bindPopup(`
            <b>Тип почвы:</b> ${p.soil_textural_class || p.soil_type || '—'}<br>
            <b>pH:</b> ${phDisplay === '—' ? '—' : Number(phDisplay).toFixed(1)}<br>
            <b>OC (%):</b> ${ocDisplay === '—' ? '—' : Number(ocDisplay).toFixed(1)}<br>
            <b>Площадь:</b> ${p.area_m2 ? (p.area_m2 / 10000).toFixed(2) + ' га' : '—'}
          `);
        }
      });

      soilLayer.addTo(map);
      L.control.layers({}, { 'Почвы СПб / ЛО': soilLayer }).addTo(map);
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
    <h3>Параметры местности</h3>
    <p><strong>Тип грунта:</strong> ${params.soil}</p>
    <p><strong>pH:</strong> ${params.ph}</p>
    <p><strong>Органический углерод (%):</strong> ${params.organic_carbon}</p>
    <p><strong>Площадь:</strong> ${params.area}</p>
    <br>
    <button onclick="calculateGII(${params.ksoil}, ${params.kugv}, ${params.koopr})">Рассчитать GII</button>
  `;
}

// Пример расчёта GII
function calculateGII(k_soil, k_ugv, k_oopr) {
  const GII0_PND = 2.12;
  const Kkr = k_soil * k_ugv * k_oopr;
  const GII = (GII0_PND * Kkr).toFixed(2);
  alert(`GII = ${GII}`);
}