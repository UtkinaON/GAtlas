// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentMarker = null;
let map = null;
let soilLayer = null;
let currentKsoil = 1.0;
let currentLat = 60, currentLng = 30;
let currentSoilClass = '', currentPh = '', currentOc = '', currentArea = '';
let giiCalculated = false;

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

// ✅ ДАННЫЕ ПО ВОДНЫМ ОБЪЕКТАМ (СПб/ЛО)
const WATER_DATA = {
  "Ладожское озеро": {
    izv: "Средний (ИЗВ=2.3)",
    eutrophication: "Умеренная эвтрофикация",
    biocenosis: "Нарушен частично (снижение ихтиофауны на 25%)",
    pollutants: "Фосфор ↑, Железо ↑, Азот",
    restrictions: "Запрещена разработка дренажных систем в радиусе 100 м",
    source: "Росприроднадзор, 2025"
  },
  "Онежское озеро": {
    izv: "Низкий (ИЗВ=1.8)",
    eutrophication: "Слабая эвтрофикация",
    biocenosis: "Удовлетворительное",
    pollutants: "Железо, Органика",
    restrictions: "Запрещена разработка в радиусе 50 м",
    source: "Росприроднадзор, 2025"
  },
  "Финский залив": {
    izv: "Высокий (ИЗВ=3.8)",
    eutrophication: "Сильная эвтрофикация (цветение синезелёных)",
    biocenosis: "Критически нарушен (гибели рыбы)",
    pollutants: "Фосфор ↑↑, Азот ↑↑, Тяжёлые металлы",
    restrictions: "Полный запрет дренажа и земляных работ в прибрежной зоне",
    source: "Росприроднадзор + Минприроды, 2025"
  },
  "Река Нева": {
    izv: "Высокий (ИЗВ=3.2)",
    eutrophication: "Умеренная эвтрофикация",
    biocenosis: "Нарушен (снижение биоразнообразия)",
    pollutants: "Азот, Фосфор, Органические загрязнители",
    restrictions: "Запрещена разработка в радиусе 50 м от берега",
    source: "Росприроднадзор, 2025"
  },
  "Мелкий водоём": {
    izv: "Средний (ИЗВ=2.5)",
    eutrophication: "Умеренная",
    biocenosis: "Нарушен частично",
    pollutants: "Фосфор, Железо",
    restrictions: "Запрещена разработка дренажных систем в радиусе 50 м",
    source: "Росприроднадзор, 2025"
  }
};

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ GII ===
function calculateGII(ksoil, kugv, koopr, material) {
  const GII0 = GII0_VALUES[material];
  const Kkr = ksoil * kugv * koopr;
  const GII = (GII0 * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));

  const infoDiv = document.getElementById('info');
  
  // ✅ ОЧИЩАЕМ старые результаты GII ПЕРЕД добавлением нового
  infoDiv.innerHTML = infoDiv.innerHTML.split('<div style="margin:15px 0;padding:15px;background:#E3F2FD')[0];
  
  infoDiv.innerHTML += `
    <div style="margin:15px 0;padding:15px;background:#E3F2FD;border-left:5px solid #2196F3;border-radius:4px;">
      <strong>Материал:</strong> ${material} (GII₀ = ${GII0})<br>
      K<sub>soil</sub> = ${ksoil.toFixed(2)}<br>
      K<sub>угв</sub> = ${kugv}<br>
      K<sub>оопр</sub> = ${koopr}<br>
      K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
      <strong>🎯 GII = ${GII}</strong><br>
      <strong>Класс риска:</strong> <em>${risk}</em>
    </div>
  `;
  
  // ✅ МЕНЯЕМ кнопку и флаг
  giiCalculated = true;
  
  // ✅ ПЕРЕОТРИСОВЫВАЕМ боковую панель с новой кнопкой
  setTimeout(() => {
    updateSoilSidebar(currentLat, currentLng, currentSoilClass, currentPh, currentOc, currentArea, ksoil);
  }, 100);
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Крайне высокий";
}

// === МОДАЛЬНОЕ ОКНО ===
function showMaterialSelector(ksoil) {
  const materials = Object.keys(GII0_VALUES);
  let optionsHTML = materials.map(material => 
    `<option value="${material}">${material} (GII₀ = ${GII0_VALUES[material]})</option>`
  ).join('');

  const modalHTML = `
    <div id="materialModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:30px;border-radius:10px;max-width:450px;box-shadow:0 10px 30px rgba(0,0,0,0.3);">
        <h3>🏗️ Параметры для расчёта GII</h3>
        <div style="margin:15px 0;">
          <label>Материал: </label><br>
          <select id="materialSelect" style="width:100%;padding:8px;margin:5px 0;border:2px solid #ddd;border-radius:5px;">
            ${optionsHTML}
          </select>
        </div>
        <div style="margin:15px 0;">
          <label>K<sub>угв</sub> (уровень грунтовых вод): </label><br>
          <select id="kugvSelect" style="width:100%;padding:8px;margin:5px 0;border:2px solid #ddd;border-radius:5px;">
            <option value="0.8">Низкий (&lt;2м) = 0.8</option>
            <option value="1.0" selected>Средний (2-4м) = 1.0</option>
            <option value="1.2">Высокий (&gt;4м) = 1.2</option>
          </select>
        </div>
        <div style="margin:15px 0;">
          <label>K<sub>оопр</sub> (обеспечение): </label><br>
          <select id="kooprSelect" style="width:100%;padding:8px;margin:5px 0;border:2px solid #ddd;border-radius:5px;">
            <option value="0.9">Низкое = 0.9</option>
            <option value="1.0" selected>Среднее = 1.0</option>
            <option value="1.1">Высокое = 1.1</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="calcGII" style="padding:12px 24px;background:#4CAF50;color:white;border:none;border-radius:5px;font-size:16px;cursor:pointer;">🚀 Рассчитать GII</button>
          <button id="closeModal" style="padding:12px 24px;background:#f44336;color:white;border:none;border-radius:5px;font-size:16px;cursor:pointer;">❌ Отмена</button>
        </div>
        <div id="preview" style="margin-top:15px;padding:10px;background:#f0f8ff;border-radius:5px;font-size:14px;"></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // ✅ Предпросмотр
  function updatePreview() {
    const kugv = parseFloat(document.getElementById('kugvSelect').value);
    const koopr = parseFloat(document.getElementById('kooprSelect').value);
    const kkrPreview = (ksoil * kugv * koopr).toFixed(2);
    document.getElementById('preview').innerHTML = 
      `<strong>Предпросмотр:</strong> K<sub>soil</sub>=${ksoil.toFixed(2)} × ${kugv} × ${koopr} = K<sub>кр</sub>=${kkrPreview}`;
  }

  document.getElementById('kugvSelect').onchange = updatePreview;
  document.getElementById('kooprSelect').onchange = updatePreview;
  document.getElementById('materialSelect').onchange = updatePreview;
  updatePreview();

  // ✅ РАССЧИТАТЬ GII + ЗАКРЫТЬ МОДАЛКУ
  document.getElementById('calcGII').onclick = function() {
    const kugv = parseFloat(document.getElementById('kugvSelect').value);
    const koopr = parseFloat(document.getElementById('kooprSelect').value);
    const material = document.getElementById('materialSelect').value;
    calculateGII(ksoil, kugv, koopr, material);
    closeModal(); // ✅ ЗАКРЫВАЕМ МОДАЛКУ
  };

  document.getElementById('closeModal').onclick = closeModal;

  function closeModal() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.remove();
  }
}

// === ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ТИПА ПОЧВЫ ===
function getSoilInfo(properties) {
  const soilTypeNum = parseInt(properties.soil_type || 0);

  if (soilTypeNum === -2 || properties.is_wetland === 1 || properties.is_wetland === '1') {
    return { soilClass: 'Болото', ph: 5.0, oc: 4.5, ksoil: 1.4, isWater: false, isWetland: true };
  }

  if (soilTypeNum === -1 || properties.is_water === 1 || properties.is_water === '1') {
    return { soilClass: 'Водная поверхность', ph: -9999, oc: -9999, ksoil: 0.5, isWater: true, isWetland: false };
  }

  const soilClassMap = { 3: 'Глина', 2: 'Тяжёлый суглинок', 1: 'Лёгкий суглинок', 0: 'Супесь' };
  const ksoilMap = { 3: 1.3, 2: 1.1, 1: 1.05, 0: 1.0 };
  
  const soilClass = soilClassMap[soilTypeNum] || 'Супесь';
  const ksoil = ksoilMap[soilTypeNum] || 1.0;

  return {
    soilClass, ph: parseFloat(properties.ph) || 6.8, oc: parseFloat(properties['organic_carbon_%']) || 2.5,
    ksoil, isWater: false, isWetland: false
  };
}

function getWaterInfo(lat, lng) {
  if (lat > 59.9 && lng < 32) return WATER_DATA["Ладожское озеро"];
  if (lat > 59.8 && lng < 35) return WATER_DATA["Онежское озеро"];
  if (lat < 60.0 && lng < 30.5) return WATER_DATA["Финский залив"];
  if (Math.abs(lat - 59.95) < 0.05 && Math.abs(lng - 30.3) < 0.05) return WATER_DATA["Река Нева"];
  return WATER_DATA["Мелкий водоём"];
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
    currentKsoil = soilInfo.ksoil;
    const area = properties.area_m2 ? (parseFloat(properties.area_m2) / 10000).toFixed(2) + ' га' : '—';

    if (soilInfo.isWater) {
      const waterInfo = getWaterInfo(lat, lng);
      updateWaterSidebar(lat, lng, waterInfo, area);
      giiCalculated = false; // Сброс для воды
    } else {
      updateSoilSidebar(lat, lng, soilInfo.soilClass, formatValue(soilInfo.ph), formatValue(soilInfo.oc), area, soilInfo.ksoil);
    }
  }

  // ✅ БОКОВАЯ ПАНЕЛЬ ДЛЯ ПОЧВ
  function updateSoilSidebar(lat, lng, soilClass, ph, oc, area, ksoil) {
    currentLat = lat; currentLng = lng;
    currentSoilClass = soilClass; currentPh = ph; currentOc = oc; currentArea = area;

    const infoDiv = document.getElementById('info');
    const btnText = giiCalculated ? '📊 Интегральный показатель GII' : '🚀 Рассчитать GII';
    
    infoDiv.innerHTML = `
      <p><strong>📍 Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      <h3>🌱 Параметры участка</h3>
      <p><strong>Тип грунта:</strong> ${soilClass}</p>
      <p><strong>pH:</strong> ${ph}</p>
      <p><strong>OC (%):</strong> ${oc}</p>
      <p><strong>Площадь:</strong> ${area}</p>
      <p><strong>K<sub>soil</sub>:</strong> ${ksoil.toFixed(2)}</p>
      <br>
      <div style="display:flex;gap:10px;">
        <button id="giiBtn" class="gii-btn">${btnText}</button>
        ${giiCalculated ? '<button id="clearBtn" class="gii-btn" style="background:#ff9800;">🗑️ Очистить</button>' : ''}
      </div>
    `;

    document.getElementById('giiBtn').onclick = function() {
      showMaterialSelector(ksoil);
    };

    if (giiCalculated) {
      document.getElementById('clearBtn').onclick = function() {
        giiCalculated = false;
        updateSoilSidebar(currentLat, currentLng, currentSoilClass, currentPh, currentOc, currentArea, ksoil);
      };
    }
  }

  function updateWaterSidebar(lat, lng, waterInfo, area) {
    const infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
      <p><strong>📍 Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      <h3>💧 Состояние водного объекта</h3>
      <div style="background:#E1F5FE;padding:15px;border-radius:8px;margin:10px 0;">
        <p><strong>📊 ИЗВ:</strong> ${waterInfo.izv}</p>
        <p><strong>🌊 Эвтрофикация:</strong> ${waterInfo.eutrophication}</p>
        <p><strong>🐟 Биоценоз:</strong> ${waterInfo.biocenosis}</p>
      </div>
      <div style="background:#FFF3E0;padding:15px;border-radius:8px;margin:10px 0;">
        <p><strong>🚫 Основные загрязнители:</strong> ${waterInfo.pollutants}</p>
        <p><strong>⚠️ Ограничения:</strong> ${waterInfo.restrictions}</p>
      </div>
      <div style="background:#F1F8E9;padding:10px;border-radius:5px;font-size:14px;color:#388E3C;">
        <strong>ℹ️ Источник:</strong> ${waterInfo.source}
      </div>
      <p><strong>📏 Площадь:</strong> ${area}</p>
      <br>
      <button id="closeWaterInfo" class="gii-btn" style="background:#f44336;">❌ Закрыть</button>
    `;

    document.getElementById('closeWaterInfo').onclick = function() {
      document.getElementById('info').innerHTML = '<p>🖱️ Кликните по полигону для информации</p>';
      if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
      }
    };
  }

  // Загрузка GeoJSON
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
          if (soilInfo.isWater) return { fillColor: '#1e90ff', color: '#0d47a1', weight: 2, fillOpacity: 0.6 };
          if (soilInfo.isWetland) return { fillColor: '#556B2F', color: '#8B4513', weight: 3, fillOpacity: 0.5 };
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

          if (soilInfo.isWater) {
            const waterInfo = getWaterInfo(layer.getBounds().getCenter().lat, layer.getBounds().getCenter().lng);
            layer.bindPopup(`
              <div style="font-size:16px;">
                <b>💧 Водный объект</b><br>
                📊 ИЗВ: ${waterInfo.izv}<br>
                🐟 Биоценоз: ${waterInfo.biocenosis}<br>
                🚫 Загрязнители: ${waterInfo.pollutants}<br>
                📏 Площадь: ${area}
              </div>
            `);
          } else {
            layer.bindPopup(`
              <b>📍 Тип:</b> ${soilInfo.soilClass}<br>
              <b>🔬 pH:</b> ${formatValue(soilInfo.ph)}<br>
              <b>🌿 OC (%):</b> ${formatValue(soilInfo.oc)}<br>
              <b>📏 Площадь:</b> ${area}<br>
              <b>⚙️ K<sub>soil</sub>:</b> ${soilInfo.ksoil.toFixed(2)}
            `);
          }
        }
      });

      soilLayer.addTo(map);
      L.control.layers({ "OSM": osm }, { "Почвы СПб/ЛО": soilLayer }).addTo(map);
      
      document.getElementById('info').innerHTML = `
        <p>✅ ${soilData.features.length} полигонов (${waterCount} водных, ${wetlandCount} болот)</p>
        <p>🖱️ Кликните по полигону для информации 💧🌱</p>
      `;
    })
    .catch(err => {
      console.error('❌ Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    });
});
