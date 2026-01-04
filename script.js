// Глобальные переменные
let currentMarker = null;
let map = null;
let soilLayer = null;

document.addEventListener('DOMContentLoaded', function () {
  // Инициализация карты
  map = L.map('map').setView([60, 30], 8);
  
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  osm.addTo(map);

  // Универсальная функция форматирования
  const formatValue = (val) => {
    if (val === undefined || val === null || val === -9999 || val === '-9999') return '—';
    const num = parseFloat(val);
    return isNaN(num) ? '—' : num.toFixed(1);
  };

  // ✅ ФУНКЦИЯ КЛИКА (работает с водой И почвами)
  function handleLayerClick(lat, lng, properties) {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);

    // ✅ ПРОВЕРКА ВОДЫ (3 надежных способа)
    const soilTypeNum = parseInt(properties.soil_type || 0);
    const isWater = properties.is_water === true || 
                   properties.is_water === 'true' || 
                   soilTypeNum === -1 ||
                   properties.soil_textural_class?.includes('Водная');

    let soilClass;
    if (isWater) {
      soilClass = 'Водная поверхность';
    } else {
      const soilClassRaw = (properties.soil_textural_class || '').toLowerCase();
      if (soilTypeNum === 3 || soilClassRaw.includes('глина')) soilClass = 'Глина';
      else if (soilTypeNum === 2 || soilClassRaw.includes('тяжел')) soilClass = 'Тяжёлый суглинок';
      else if (soilTypeNum === 1 || soilClassRaw.includes('легк')) soilClass = 'Лёгкий суглинок';
      else soilClass = 'Супесь';
    }

    const ph = isWater ? '—' : formatValue(properties.ph);
    const oc = isWater ? '—' : formatValue(properties['organic_carbon_%']);
    const area = properties.area_m2 ? (parseFloat(properties.area_m2)/10000).toFixed(2) + ' га' : '—';
    
    // ✅ Ksoil с учетом воды
    let ksoil = 1.0;
    if (isWater) ksoil = 0.5;
    else if (soilClass === 'Глина') ksoil = 1.3;
    else if (soilClass === 'Тяжёлый суглинок') ksoil = 1.1;
    else if (soilClass === 'Лёгкий суглинок') ksoil = 1.05;

    const params = { soil: soilClass, ph, organic_carbon: oc, area, ksoil, kugv: 1.0, koopr: 1.0 };
    updateSidebar(lat, lng, params);
  }

  // Обновление боковой панели
  function updateSidebar(lat, lng, params) {
    const infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
      <p><strong>📍 Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      <h3>🌱 Параметры участка</h3>
      <p><strong>Тип грунта:</strong> ${params.soil}</p>
      <p><strong>pH:</strong> ${params.ph}</p>
      <p><strong>OC (%):</strong> ${params.organic_carbon}</p>
      <p><strong>Площадь:</strong> ${params.area}</p>
      <p><strong>K<sub>soil</sub>:</strong> ${params.ksoil.toFixed(2)}</p>
      <br>
      <button class="gii-btn" onclick="calculateGII(${params.ksoil}, ${params.kugv}, ${params.koopr})">
        🚀 Рассчитать GII
      </button>
    `;
  }

  // ✅ Загрузка GeoJSON
  fetch('soil_spb_lo_h2o_fixed.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`Файл не найден (${response.status})`);
      return response.json();
    })
    .then(soilData => {
      console.log('✅ Загружено:', soilData.features.length, 'полигонов');
      
      // Подсчет водных
      const waterCount = soilData.features.filter(f => 
        f.properties.is_water || parseInt(f.properties.soil_type || 0) === -1
      ).length;
      console.log('💧 Водных:', waterCount);

      soilLayer = L.geoJSON(soilData, {
        style: function(feature) {
          const soilNum = parseInt(feature.properties.soil_type || 0);
          const isWater = feature.properties.is_water === true || soilNum === -1;

          if (isWater) {
            return { fillColor: '#1e90ff', color: '#0d47a1', weight: 2, fillOpacity: 0.5 };
          }
          if (soilNum === 3) return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.6 };
          if (soilNum === 2) return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.6 };
          if (soilNum === 1) return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.6 };
          return { fillColor: '#90EE90', color: '#2E7D32', weight: 1, fillOpacity: 0.6 };
        },

        onEachFeature: function(feature, layer) {
          layer.on('click', e => handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties));
          
          const p = feature.properties;
          layer.bindPopup(`
            <b>Тип:</b> ${p.soil_textural_class || '—'}<br>
            <b>pH:</b> ${formatValue(p.ph)}<br>
            <b>OC (%):</b> ${formatValue(p.organic_carbon_%)}<br>
            <b>Площадь:</b> ${p.area_m2 ? (parseFloat(p.area_m2)/10000).toFixed(2) + ' га' : '—'}
          `);
        }
      });

      soilLayer.addTo(map);
      L.control.layers({ "OSM": osm }, { "Почвы СПб/ЛО": soilLayer }).addTo(map);
      
      document.getElementById('info').innerHTML = `
        <p>✅ ${soilData.features.length} полигонов (${waterCount} водных)</p>
        <p>🖱️ Кликните по полигону</p>
      `;
    })
    .catch(err => {
      console.error('❌ Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    });
});

// Глобальные функции GII
function calculateGII(ksoil, kugv, koopr) {
  const GII0 = 2.12;
  const Kkr = ksoil * kugv * koopr;
  const GII = (GII0 * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));
  
  document.getElementById('info').innerHTML += `
    <div style="margin:15px 0;padding:15px;background:#E3F2FD;border-left:5px solid #2196F3;border-radius:4px;">
      <strong>🎯 GII = ${GII}</strong><br>
      K<sub>кр</sub> = ${(ksoil*kugv*koopr).toFixed(2)}<br>
      <em>${risk}</em>
    </div>
  `;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Крайне высокий";
}
