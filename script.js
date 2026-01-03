// === ГЕО АТЛАС: интерактивная карта ===
let currentMarker = null;
let map = null;
let soilLayer = null;
let ugvLayer = null;
let ooprLayer = null;

document.addEventListener('DOMContentLoaded', function () {
  map = L.map('map').setView([60, 30], 8);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  osm.addTo(map);

  // Форматирование значений (прочерк для некорректных)
  const formatValue = (val) => {
    if (val === undefined || val === null || val === -999.9 || val === '-999.9') return '—';
    const num = parseFloat(val);
    return isNaN(num) ? '—' : num.toFixed(1);
  };

  // === ЗАГРУЗКА ТРЁХ СЛОЁВ ===
  Promise.all([
    fetch('soils_spb_lo.geojson').then(r => r.json()),
    fetch('ugv_spb_lo.geojson').then(r => r.json()),
    fetch('oopr_spb_lo.geojson').then(r => r.json())
  ]).then(([soilData, ugvData, ooprData]) => {

    // --- Слой почв (с водой!) ---
    soilLayer = L.geoJSON(soilData, {
      style: function (feature) {
        const props = feature.properties;

        // Проверка: водный полигон?
        const isWater = props.is_water === true ||
                        props.is_water === 'true' ||
                        props.is_water === 1 ||
                        props.soil_type === '-1' ||
                        (props.soil_textural_class && props.soil_textural_class.includes('Водная'));

        if (isWater) {
          return { fillColor: '#b3e5fc', color: '#0288d1', weight: 1, fillOpacity: 0.5 };
        }

        // Типы почв
        const type = props.soil_type || props.soil_textural_class || '';
        if (type.includes('Глина')) return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.5 };
        if (type.includes('Тяжёлый суглинок')) return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.5 };
        if (type.includes('Лёгкий суглинок')) return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.5 };
        return { fillColor: '#90EE90', color: '#2E7D32', weight: 1, fillOpacity: 0.5 };
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => handleSoilClick(e.latlng.lat, e.latlng.lng, feature.properties));
        const p = feature.properties;
        layer.bindPopup(`<b>Тип:</b> ${p.soil_textural_class || p.soil_type || '—'}<br>pH: ${formatValue(p.ph)}<br>OC: ${formatValue(p['organic_carbon_%'])}`);
      }
    });

    // --- Слой УГВ ---
    ugvLayer = L.geoJSON(ugvData, {
      style: { color: '#1976D2', weight: 1, fillOpacity: 0.2, fillColor: '#BBDEFB' },
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => handleUgvClick(e.latlng.lat, e.latlng.lng, feature.properties));
        layer.bindPopup(`<b>УГВ:</b> ${feature.properties.ugv_class || '—'}<br>K<sub>ugv</sub>: ${feature.properties.k_ugv || '1.0'}`);
      }
    });

    // --- Слой ООПТ ---
    ooprLayer = L.geoJSON(ooprData, {
      style: { color: '#B71C1C', weight: 1, fillOpacity: 0.2, fillColor: '#FFCDD2' },
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => handleOoprClick(e.latlng.lat, e.latlng.lng, feature.properties));
        layer.bindPopup(`<b>Зона:</b> ${feature.properties.zone_type || '—'}<br>K<sub>oopr</sub>: ${feature.properties.k_oopr || '1.0'}`);
      }
    });

    // Добавляем на карту
    soilLayer.addTo(map);
    ugvLayer.addTo(map);
    ooprLayer.addTo(map);

    // Управление слоями
    const overlays = {
      "Почвы (с водой)": soilLayer,
      "УГВ": ugvLayer,
      "ООПТ / Водоохранные зоны": ooprLayer
    };
    L.control.layers({ "OpenStreetMap": osm }, overlays).addTo(map);
  }).catch(err => {
    console.error('Ошибка загрузки GeoJSON:', err);
    document.getElementById('info').innerHTML = `<p style="color:red">⚠️ Ошибка: ${err.message}</p>`;
  });
});

// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ ===
let currentParams = {
  soil: '—',
  ph: '—',
  organic_carbon: '—',
  k_soil: 1.0,
  k_ugv: 1.0,
  k_oopr: 1.0
};

// === ОБРАБОТЧИКИ КЛИКА ПО СЛОЯМ ===
function handleSoilClick(lat, lng, props) {
  const isWater = props.is_water === true ||
                  props.is_water === 'true' ||
                  props.is_water === 1 ||
                  props.soil_type === '-1' ||
                  (props.soil_textural_class && props.soil_textural_class.includes('Водная'));

  currentParams.soil = isWater ? 'Водная поверхность' : (props.soil_textural_class || props.soil_type || '—');
  currentParams.ph = isWater ? '—' : (parseFloat(props.ph) || '—');
  currentParams.organic_carbon = isWater ? '—' : (parseFloat(props['organic_carbon_%']) || '—');

  // Расчёт K_soil
  if (isWater) {
    currentParams.k_soil = 0.5;
  } else {
    const type = currentParams.soil;
    if (type.includes('Торф')) currentParams.k_soil = 1.4;
    else if (type.includes('Глина')) currentParams.k_soil = 1.3;
    else if (type.includes('Тяжёлый суглинок')) currentParams.k_soil = 1.1;
    else if (type.includes('Лёгкий суглинок')) currentParams.k_soil = 1.05;
    else if (type.includes('Песок') || type.includes('Супесь')) currentParams.k_soil = 1.0;
    else currentParams.k_soil = 1.0;
  }

  updateMarker(lat, lng);
  updateSidebar(lat, lng);
}

function handleUgvClick(lat, lng, props) {
  currentParams.k_ugv = parseFloat(props.k_ugv) || 1.0;
  updateMarker(lat, lng);
  updateSidebar(lat, lng);
}

function handleOoprClick(lat, lng, props) {
  currentParams.k_oopr = parseFloat(props.k_oopr) || 1.0;
  updateMarker(lat, lng);
  updateSidebar(lat, lng);
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function updateMarker(lat, lng) {
  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lng]).addTo(map);
}

function updateSidebar(lat, lng) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
    <h3>Параметры местности</h3>
    <p><strong>Тип грунта:</strong> ${currentParams.soil}</p>
    <p><strong>pH:</strong> ${typeof currentParams.ph === 'number' ? currentParams.ph.toFixed(1) : currentParams.ph}</p>
    <p><strong>Органический углерод (%):</strong> ${typeof currentParams.organic_carbon === 'number' ? currentParams.organic_carbon.toFixed(1) : currentParams.organic_carbon}</p>
    <p><strong>K<sub>soil</sub>:</strong> ${currentParams.k_soil.toFixed(2)}</p>
    <p><strong>K<sub>ugv</sub>:</strong> ${currentParams.k_ugv.toFixed(2)}</p>
    <p><strong>K<sub>oopr</sub>:</strong> ${currentParams.k_oopr.toFixed(2)}</p>
    <br>
    <button onclick="calculateGII()">Рассчитать GII</button>
  `;
}

// === РАСЧЁТ GII ===
function calculateGII() {
  const GII0_PND = 2.12;
  const Kkr = currentParams.k_soil * currentParams.k_ugv * currentParams.k_oopr;
  const GII = (GII0_PND * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));

  const result = `
    <div style="margin-top:15px; padding:12px; background:#E3F2FD; border-left:4px solid #2196F3; border-radius:4px;">
      <strong>Результат расчёта:</strong><br>
      GII₀ (ПНД) = 2.12<br>
      K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
      <b style="color:#D32F2F;">GII = ${GII}</b><br><br>
      <em>${risk}</em>
    </div>
  `;
  document.getElementById('info').innerHTML += result;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Критический";
}