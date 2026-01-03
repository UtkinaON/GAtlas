// === ГЕО АТЛАС: интерактивная карта ===
// Объявляем переменную глобально
let currentMarker = null;
let map = null;
let soilLayer = null;

document.addEventListener('DOMContentLoaded', function () {
  // Карта
  map = L.map('map').setView([60, 30], 8);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  osm.addTo(map);

  // Универсальная функция форматирования
  const formatValue = (val) => {
    if (val === undefined || val === null || val === -9999 || val === '-9999') return '---';
    const num = parseFloat(val);
    return isNaN(num) ? '---' : num.toFixed(1);
  };

  // Функция клика - ПОЛНАЯ ЛОГИКА ВОДЫ
  function handleLayerClick(lat, lng, properties) {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);

    // ✅ НАДЕЖНАЯ ПРОВЕРКА ВОДЫ (4 способа)
    const soilTypeNum = parseInt(properties.soil_type || 0);
    const isWater = properties.is_water === true || 
                    properties.is_water === 'true' || 
                    properties.is_water === 1 ||
                    soilTypeNum === -1 ||
                    properties.soil_textural_class?.includes('Водная');

    let soilClass;
    if (isWater) {
      soilClass = 'Водная поверхность';
    } else {
      const soilClassRaw = (properties.soil_textural_class || '').toLowerCase();
      const soilNum = parseInt(properties.soil_type || 0);
      
      if (soilNum === 3 || soilClassRaw.includes('глина')) soilClass = 'Глина';
      else if (soilNum === 2 || soilClassRaw.includes('тяжел')) soilClass = 'Тяжёлый суглинок';
      else if (soilNum === 1 || soilClassRaw.includes('легк')) soilClass = 'Лёгкий суглинок';
      else soilClass = 'Супесь';
    }

    const ph = isWater ? '---' : formatValue(properties.ph);
    const oc = isWater ? '---' : formatValue(properties['organic_carbon_%']);
    const area = properties.area_m2 ? (parseFloat(properties.area_m2)/10000).toFixed(2) + ' га' : '---';
    
    // Ksoil по типу почвы
    let ksoil = 1.0;
    if (isWater) ksoil = 0.5;
    else if (soilClass === 'Глина') ksoil = 1.3;
    else if (soilClass === 'Тяжёлый суглинок') ksoil = 1.1;
    else if (soilClass === 'Лёгкий суглинок') ksoil = 1.05;

    const params = { 
      soil: soilClass, 
      ph, 
      organic_carbon: oc, 
      area, 
      ksoil, 
      kugv: 1.0, 
      koopr: 1.0 
    };

    updateSidebar(lat, lng, params);
  }

  // Обновление боковой панели
  function updateSidebar(lat, lng, params) {
    const infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
      <p><strong>📍 Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      <h3>🌱 Параметры почвы</h3>
      <p><strong>Тип:</strong> ${params.soil}</p>
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

  // Загрузка GeoJSON
  fetch('soil_spb_water_fixed.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`Файл не найден: ${response.status}`);
      return response.json();
    })
    .then(soilData => {
      console.log('✅ Загружено:', soilData.features.length, 'полигонов');
      
      // Счетчик водных полигонов
      const waterCount = soilData.features.filter(f => 
        f.properties.is_water || parseInt(f.properties.soil_type || 0) === -1
      ).length;
      console.log('✅ Водных:', waterCount);

      soilLayer = L.geoJSON(soilData, {
        style: function(feature) {
          const soilNum = parseInt(feature.properties.soil_type || 0);
          const isWater = feature.properties.is_water === true || 
                         feature.properties.is_water === 1 || 
                         soilNum === -1;

          if (isWater) {
            return {
              fillColor: '#1e88e5', 
              color: '#0d47a1', 
              weight: 2, 
              fillOpacity: 0.4
            };
          }
          if (soilNum === 3) {
            return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.6 };
          }
          if (soilNum === 2) {
            return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.6 };
          }
          if (soilNum === 1) {
            return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.6 };
          }
          return { fillColor: '#90EE90', color: '#2E7D32', weight: 1, fillOpacity: 0.6 };
        },

        onEachFeature: function(feature, layer) {
          layer.on('click', e => handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties));
          
          const p = feature.properties;
          const area = p.area_m2 ? (parseFloat(p.area_m2)/10000).toFixed(2) + ' га' : '---';
          layer.bindPopup(`
            <b>Тип:</b> ${p.soil_textural_class || '---'}<br>
            <b>pH:</b> ${formatValue(p.ph)}<br>
            <b>OC (%):</b> ${formatValue(p['organic_carbon_%'])}<br>
            <b>Площадь:</b> ${area}
          `);
        }
      });

      soilLayer.addTo(map);
      
      // Layer control
      L.control.layers({ "OpenStreetMap": osm }, { 'Почвы СПб/ЛО': soilLayer }, { position: 'topright' }).addTo(map);
      
      document.getElementById('info').innerHTML = `
        <p>✅ Загружено ${soilData.features.length} полигонов (${waterCount} водных)</p>
        <p>🖱️ Кликните по полигону для информации</p>
      `;
    })
    .catch(err => {
      console.error('❌ Ошибка загрузки GeoJSON:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;font-weight:bold;">❌ ${err.message}</p>`;
    });
});

// Глобальные функции для кнопки GII
function calculateGII(ksoil, kugv, koopr) {
  const GII0_PND = 2.12;
  const Kkr = ksoil * kugv * koopr;
  const GII = (GII0_PND * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));

  document.getElementById('info').innerHTML += `
    <div style="margin-top:15px;padding:15px;background:#E3F2FD;border-left:5px solid #2196F3;border-radius:4px;">
      <strong>🎯 Результат GII</strong><br>
      GII₀(ПНД) = 2.12<br>
      K<sub>кр</sub> = ${(ksoil*kugv*koopr).toFixed(2)}<br>
      <b style="color:#D32F2F;font-size:1.2em;">GII = ${GII}</b><br><br>
      <em style="color:#1976D2;">${risk}</em>
    </div>
  `;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий риск";
  if (gii <= 4.0) return "II — Низкий риск";
  if (gii <= 6.0) return "III — Умеренный риск";
  if (gii <= 8.0) return "IV — Высокий риск";
  return "V — Крайне высокий риск";
}
