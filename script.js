// === ГЕО АТЛАС: интерактивная карта ===
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

    // Безопасное извлечение
    const soilClass = (properties.soil_textural_class || '—').trim();
    const phRaw = properties.ph;
    const ocRaw = properties['organic_carbon_%'];

    // Форматирование: замена -9999 и null на "—"
    const formatValue = (val) => {
      if (val === undefined || val === null || val === -9999 || val === '-9999') {
        return '—';
      }
      if (typeof val === 'number' && !isNaN(val)) {
        return val.toFixed(1);
      }
      return String(val).trim() || '—';
    };

    const ph = formatValue(phRaw);
    const oc = formatValue(ocRaw);
    const area = properties.area_m2 ? (properties.area_m2 / 10000).toFixed(2) + ' га' : '—';

    // Расчёт K_soil
    let ksoil = 1.0;
    if (soilClass === 'Водная поверхность') {
      ksoil = 1.0; // или 0.5, если нужно
    } else if (ph !== '—' && !isNaN(ph) && parseFloat(ph) < 5.5) {
      ksoil = 1.4;
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
  fetch('soil_spb_lo_final_with_water.geojson')
    .then(response => {
      if (!response.ok) throw new Error('Файл не найден (404)');
      return response.json();
    })
    .then(soilData => {
      soilLayer = L.geoJSON(soilData, {
        style: function (feature) {
          const cls = (feature.properties.soil_textural_class || '').trim();

          if (/Водная/.test(cls)) {
            return { fillColor: '#0d47a1', color: '#0d47a1', weight: 1, fillOpacity: 0.3 };
          }
          if (/Глина/.test(cls)) {
            return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.3 };
          }
          if (/Тяжёлый суглинок/.test(cls)) {
            return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.3 };
          }
          if (/Лёгкий суглинок/.test(cls)) {
            return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.3 };
          }
          // "Супесь" и по умолчанию
          return { fillColor: '#90EE90', color: '#228B22', weight: 1, fillOpacity: 0.3 };
        },
        onEachFeature: function (feature, layer) {
          layer.on('click', e => {
            handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties);
          });

          const p = feature.properties;
          const phDisplay = (p.ph === -9999 || p.ph === '-9999' || p.ph === undefined) ? '—' : p.ph;
          const ocDisplay = (p['organic_carbon_%'] === -9999 || p['organic_carbon_%'] === '-9999' || p['organic_carbon_%'] === undefined) ? '—' : p['organic_carbon_%'];

          layer.bindPopup(`
            <b>Тип:</b> ${p.soil_textural_class || '—'}<br>
            <b>pH:</b> ${phDisplay === '—' ? '—' : Number(phDisplay).toFixed(1)}<br>
            <b>OC (%):</b> ${ocDisplay === '—' ? '—' : Number(ocDisplay).toFixed(1)}<br>
            <b>Площадь:</b> ${p.area_m2 ? (p.area_m2 / 10000).toFixed(2) + ' га' : '—'}
          `);
        }
      });

      soilLayer.addTo(map);
      L.control.layers({ "OpenStreetMap": osm }, { 'Почвы и вода': soilLayer }, { position: 'topright' }).addTo(map);
      console.log('Слой загружен:', soilData.features.length, 'полигонов');
    })
    .catch(err => {
      console.error('Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;">${err.message}<br>Проверьте файл soil_spb_lo_final_with_water.geojson</p>`;
    });
});

// Обновление боковой панели
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

// Расчёт GII
function calculateGII(k_soil, k_ugv, k_oopr) {
  const GII0_PND = 2.12;
  const Kkr = k_soil * k_ugv * k_oopr;
  const GII = (GII0_PND * Kkr).toFixed(2);
  const risk = getRiskClass(GII);

  const message = `
    <strong>Результат расчёта:</strong><br>
    GII₀ (ПНД) = 2.12<br>
    K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
    <b>GII = ${GII}</b><br><br>
    <em>Класс риска: ${risk}</em>
  `;
  document.getElementById('info').innerHTML += `
    <div style="margin-top:15px; padding:10px; background:#fff8e1; border-left:4px solid #ffa000;">
      ${message}
    </div>
  `;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Критический";
}