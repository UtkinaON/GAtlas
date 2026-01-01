// === ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
const map = L.map('map').setView([60, 30], 10);

// Базовый слой OpenStreetMap
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
osm.addTo(map);

// Переменные для слоёв
let soilLayer = null;
let ugvLayer = null;
let ooprLayer = null;

// === ФУНКЦИЯ: определение параметров по клику НА ЛЮБОМ СЛОЕ ===
function handleLayerClick(lat, lng, layerType, properties) {
  // Удаляем предыдущий маркер
  if (window.currentMarker) map.removeLayer(window.currentMarker);
  window.currentMarker = L.marker([lat, lng]).addTo(map);

  // Начальные значения
  const params = {
    soil: "Не определён",
    ugws: "Не определён",
    ph: "7.0",
    distanceToOOP: "Не определён",
    load: "Сельская местность",
    k_soil: 1.0,
    k_ugv: 1.0,
    k_oopr: 1.0
  };

  // Заполняем параметры в зависимости от слоя
  if (layerType === 'soil') {
    params.soil = properties.soil_type || "Не указан";
    params.k_soil = parseFloat(properties.K_soil) || 1.0;
    if (params.soil === "Торфяник") params.ph = "4.7";
    else if (params.soil === "Суглинок") params.ph = "6.5";
    else if (params.soil.includes("Песок")) params.ph = "7.2";
  }
  if (layerType === 'ugv') {
    params.ugws = properties.ugv_class || "Не указан";
    params.k_ugv = parseFloat(properties.k_ugv) || 1.0;
  }
  if (layerType === 'oopr') {
    params.distanceToOOP = properties.zone_type || "Не указана";
    params.k_oopr = parseFloat(properties.k_oopr) || 1.0;
  }

  // Обновляем боковую панель
  updateSidebar(lat, lng, params);
}

// === ЗАГРУЗКА СЛОЁВ ===
Promise.all([
  fetch('soil_spb_lo4.geojson').then(r => r.json()),
  fetch('ugv_spb_lo.geojson').then(r => r.json()),
  fetch('oopr_spb_lo.geojson').then(r => r.json())
])
.then(([soilData, ugvData, ooprData]) => {

  // === СЛОЙ ПОЧВ ===
  soilLayer = L.geoJSON(soilData, {
    style: (feature) => {
      const t = feature.properties.soil_type;
      if (t === "Торфяник") return { fillColor: "#8B4513", color: "#5D2906", weight: 1, fillOpacity: 0.5 };
      if (t === "Суглинок") return { fillColor: "#A0522D", color: "#653E1A", weight: 1, fillOpacity: 0.5 };
      if (t === "Песок / супесь") return { fillColor: "#F4A460", color: "#D2691E", weight: 1, fillOpacity: 0.5 };
      return { fillColor: "#8FBC8F", color: "#2F4F4F", weight: 1, fillOpacity: 0.5 };
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', (e) => {
        handleLayerClick(e.latlng.lat, e.latlng.lng, 'soil', feature.properties);
      });
      const p = feature.properties;
      layer.bindPopup(`<b>Почва:</b> ${p.soil_type || '—'}<br>pH: ${p.ph_range || '—'}<br>K<sub>soil</sub>: ${p.K_soil || '1.0'}`);
    }
  });

  // === СЛОЙ УГВ ===
  ugvLayer = L.geoJSON(ugvData, {
    style: { color: '#1976D2', weight: 2, fillOpacity: 0.2, fillColor: '#BBDEFB' },
    onEachFeature: (feature, layer) => {
      layer.on('click', (e) => {
        handleLayerClick(e.latlng.lat, e.latlng.lng, 'ugv', feature.properties);
      });
      const p = feature.properties;
      layer.bindPopup(`<b>УГВ:</b> ${p.ugv_class || '—'}<br>K<sub>ugv</sub>: ${p.k_ugv || '1.0'}`);
    }
  });

  // === СЛОЙ ООПТ ===
  ooprLayer = L.geoJSON(ooprData, {
    style: { color: '#B71C1C', weight: 2, fillOpacity: 0.2, fillColor: '#FFCDD2' },
    onEachFeature: (feature, layer) => {
      layer.on('click', (e) => {
        handleLayerClick(e.latlng.lat, e.latlng.lng, 'oopr', feature.properties);
      });
      const p = feature.properties;
      layer.bindPopup(`<b>Зона:</b> ${p.zone_type || '—'}<br>K<sub>oopr</sub>: ${p.k_oopr || '1.0'}`);
    }
  });

  // Добавляем слои на карту
  soilLayer.addTo(map);
  ugvLayer.addTo(map);
  ooprLayer.addTo(map);

  // Контроль слоёв
  const overlays = {
    "Почвы": soilLayer,
    "УГВ": ugvLayer,
    "ООПТ / Водоохранные зоны": ooprLayer
  };
  L.control.layers({ "OpenStreetMap": osm }, overlays, { position: 'topright' }).addTo(map);

})
.catch(err => {
  console.error('Ошибка загрузки GeoJSON:', err);
  document.getElementById('info').innerHTML = `
    <p style="color:red">⚠️ Ошибка загрузки данных.</p>
    <p>Убедитесь, что файлы <code>soils_spb_lo.geojson</code>, <code>ugv_spb_lo.geojson</code>, <code>oopr_spb_lo.geojson</code> находятся в той же папке, что и <code>index.html</code>.</p>
  `;
});

// === ОБНОВЛЕНИЕ БОКОВОЙ ПАНЕЛИ ===
function updateSidebar(lat, lng, params) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
    <h3>Параметры местности</h3>
    <p><strong>Тип грунта:</strong> ${params.soil}</p>
    <p><strong>УГВ:</strong> ${params.ugws}</p>
    <p><strong>pH:</strong> ${params.ph}</p>
    <p><strong>Зона:</strong> ${params.distanceToOOP}</p>
    <p><strong>Нагрузка:</strong> ${params.load}</p>
    <br>
    <button onclick="calculateGII(${params.k_soil}, ${params.k_ugv}, ${params.k_oopr})">Рассчитать GII</button>
  `;
}

// === РАСЧЁТ GII ===
function calculateGII(k_soil, k_ugv, k_oopr) {
  const Kkr = k_soil * k_ugv * k_oopr;
  const GII0_PND = 2.12;
  const GII = (GII0_PND * Kkr).toFixed(2);

  const message = `
    <strong>Результат расчёта4:</strong><br>
    GII₀ (ПНД) = 2.12<br>
    K<sub>кр</sub> = ${k_soil} × ${k_ugv} × ${k_oopr} = ${Kkr.toFixed(2)}<br>
    <b>GII = ${GII}</b><br><br>
    <em>Класс риска: ${getRiskClass(GII)}</em>
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