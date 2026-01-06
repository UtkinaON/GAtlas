// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentMarker = null;
let map = null;
let soilLayer = null;
let currentKsoil = 1.0; // Храним Ksoil для GII

// === БАЗОВЫЕ GII0 ПО МАТЕРИАЛАМ ===
const GII0_VALUES = {
  "Асбестоцемент": 8.90,
  "ПНД": 2.12,
  "Геотекстиль": 5.40,
  "Шлак": 6.70,
  "Керамика": 2.30,
  "Бетонные трубы": 3.80,
  "Геокомпозит (дренажный мат)": 3.50
};

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ GII ===
function calculateGII(ksoil, kugv, koopr, material) {
  const GII0 = GII0_VALUES[material];
  const Kkr = ksoil * kugv * koopr;
  const GII = (GII0 * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));
  
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML += `
    <div style="margin:15px 0;padding:15px;background:#E3F2FD;border-left:5px solid #2196F3;border-radius:4px;">
      <strong>🎯 GII = ${GII}</strong><br>
      <strong>Материал:</strong> ${material} (GII₀ = ${GII0})<br>
      K<sub>soil</sub> = ${ksoil.toFixed(2)} | K<sub>угв</sub> = ${kugv} | K<sub>оопр</sub> = ${koopr}<br>
      K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
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

// === МОДАЛЬНОЕ ОКНО ДЛЯ ВЫБОРА МАТЕРИАЛА ===
function showMaterialSelector(ksoil) {
  const materials = Object.keys(GII0_VALUES);
  let optionsHTML = materials.map(material => 
    `<option value="${material}">${material} (GII₀ = ${GII0_VALUES[material]})</option>`
  ).join('');
  
  const modalHTML = `
    <div id="materialModal" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
      <div style="
        background: white; padding: 30px; border-radius: 10px; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <h3>🏗️ Выберите материал</h3>
        <select id="materialSelect" style="width: 100%; padding: 12px; margin: 15px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 5px;">
          ${optionsHTML}
        </select>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="calcGII" style="
            padding: 12px 24px; background: #4CAF50; color: white; border: none; 
            border-radius: 5px; font-size: 16px; cursor: pointer;">🚀 Рассчитать GII</button>
          <button id="closeModal" style="
            padding: 12px 24px; background: #f44336; color: white; border: none; 
            border-radius: 5px; font-size: 16px; cursor: pointer;">❌ Отмена</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Обработчики кнопок
  document.getElementById('calcGII').onclick = function() {
    const material = document.getElementById('materialSelect').value;
    calculateGII(ksoil, 1.0, 1.0, material);
    closeModal();
  };
  
  document.getElementById('closeModal').onclick = closeModal;
  
  function closeModal() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.remove();
  }
}

// === ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ТИПА ПОЧВЫ И СВОЙСТВ ===
function getSoilInfo(properties) {
  const soilTypeNum = parseInt(properties.soil_type || 0);
  
  if (soilTypeNum === -2 || properties.is_wetland === 1 || properties.is_wetland === '1') {
    return {
      soilClass: 'Болото',
      ph: 5.0,
      oc: 4.5,
      ksoil: 1.4,
      isWater: false,
      isWetland: true
    };
  }
  
  if (soilTypeNum === -1 || properties.is_water === 1 || properties.is_water === '1') {
    return {
      soilClass: 'Водная поверхность',
      ph: -9999,
      oc: -9999,
      ksoil: 0.5,
      isWater: true,
      isWetland: false
    };
  }
  
  const soilClassMap = {
    3: 'Глина',
    2: 'Тяжёлый суглинок',
    1: 'Лёгкий суглинок',
    0: 'Супесь'
  };
  
  const soilClass = soilClassMap[soilTypeNum] || 'Супесь';
  const ksoilMap = { 3: 1.3, 2: 1.1, 1: 1.05, 0: 1.0 };
  const ksoil = ksoilMap[soilTypeNum] || 1.0;
  
  return {
    soilClass,
    ph: parseFloat(properties.ph) || 6.8,
    oc: parseFloat(properties['organic_carbon_%']) || 2.5,
    ksoil,
    isWater: false,
    isWetland: false
  };
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', function() {
  map = L.map('map').setView([60, 30], 8);
  
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  osm.addTo(map);
  
  function formatValue(val) {
    if (val === undefined || val === null || val === -9999 || val === '-9999') return '—';
    const num = parseFloat(val);
    return isNaN(num) ? '—' : num.toFixed(1);
  }
  
  function handleLayerClick(lat, lng, properties) {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);
    
    const soilInfo = getSoilInfo(properties);
    currentKsoil = soilInfo.ksoil; // Сохраняем для GII
    const area = properties.area_m2 ? (parseFloat(properties.area_m2) / 10000).toFixed(2) + ' га' : '—';
    
    updateSidebar(lat, lng, soilInfo.soilClass, formatValue(soilInfo.ph), formatValue(soilInfo.oc), area, soilInfo.ksoil);
  }
  
  function updateSidebar(lat, lng, soilClass, ph, oc, area, ksoil) {
    const infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
      <p><strong>📍 Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      <h3>🌱 Параметры участка</h3>
      <p><strong>Тип грунта:</strong> ${soilClass}</p>
      <p><strong>pH:</strong> ${ph}</p>
      <p><strong>OC (%):</strong> ${oc}</p>
      <p><strong>Площадь:</strong> ${area}</p>
      <p><strong>K<sub>soil</sub>:</strong> ${ksoil.toFixed(2)}</p>
      <br>
      <button id="giiBtn" class="gii-btn">🚀 Рассчитать GII</button>
    `;
    
    document.getElementById('giiBtn').onclick = function() {
      showMaterialSelector(ksoil); // ✅ ПОКАЗЫВАЕМ МОДАЛКУ!
    };
  }
  
  // Загрузка GeoJSON (остальное без изменений)
  fetch('soil_boloto.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`Файл не найден (${response.status})`);
      return response.json();
    })
    .then(soilData => {
      console.log('✅ Загружено:', soilData.features.length, 'полигонов');
      
      const waterCount = soilData.features.filter(f =>
        parseInt(f.properties.soil_type || 0) === -1 || f.properties.is_water === 1
      ).length;
      const wetlandCount = soilData.features.filter(f =>
        parseInt(f.properties.soil_type || 0) === -2 || f.properties.is_wetland === 1
      ).length;
      console.log('💧 Водных:', waterCount, '🟤 Болот:', wetlandCount);

      soilLayer = L.geoJSON(soilData, {
        style: function(feature) {
          const soilInfo = getSoilInfo(feature.properties);
          
          if (soilInfo.isWater) {
            return { fillColor: '#1e90ff', color: '#0d47a1', weight: 2, fillOpacity: 0.6 };
          }
          if (soilInfo.isWetland) {
            return { fillColor: '#556B2F', color: '#8B4513', weight: 3, fillOpacity: 0.5 };
          }
          const soilNum = parseInt(feature.properties.soil_type || 0);
          const palettes = {
            3: { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.5 },
            2: { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.5 },
            1: { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.5 },
            0: { fillColor: '#90EE90', color: '#2E7D32', weight: 1, fillOpacity: 0.5 }
          };
          return palettes[soilNum] || palettes[0];
        },

        onEachFeature: function(feature, layer) {
          layer.on('click', function(e) {
            handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties);
          });
          
          const soilInfo = getSoilInfo(feature.properties);
          const area = feature.properties.area_m2 ?
            (parseFloat(feature.properties.area_m2) / 10000).toFixed(2) + ' га' : '—';
          
          layer.bindPopup(`
            <b>📍 Тип:</b> ${soilInfo.soilClass}<br>
            <b>🔬 pH:</b> ${formatValue(soilInfo.ph)}<br>
            <b>🌿 OC (%):</b> ${formatValue(soilInfo.oc)}<br>
            <b>📏 Площадь:</b> ${area}<br>
            <b>⚙️ K<sub>soil</sub>:</b> ${soilInfo.ksoil.toFixed(2)}
          `);
        }
      });

      soilLayer.addTo(map);
      L.control.layers({ "OSM": osm }, { "Почвы СПб/ЛО": soilLayer }).addTo(map);
      
      document.getElementById('info').innerHTML = `
        <p>✅ ${soilData.features.length} полигонов (${waterCount} водных, ${wetlandCount} болот)</p>
        <p>🖱️ Кликните по полигону → <strong>🚀 Рассчитать GII</strong></p>
      `;
    })
    .catch(err => {
      console.error('❌ Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    });
});
