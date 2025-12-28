// Инициализация карты
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

// Обработка клика: определение параметров по координатам
function getParamsAtPoint(lat, lng) {
  const point = L.latLng(lat, lng);
  let soil = "Не определён";
  let ugv = "Не определён";
  let oopr = "Не определён";
  let k_soil = 1.0;
  let k_ugv = 1.0;
  let k_oopr = 1.0;

  // Проверка почв
  if (soilLayer) {
    soilLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && layer.getBounds().contains(point)) {
        const props = layer.feature.properties;
        soil = props.soil_type;
        k_soil = parseFloat(props.K_soil) || 1.0;
      }
    });
  }

  // Проверка УГВ
  if (ugvLayer) {
    ugvLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && layer.getBounds().contains(point)) {
        const props = layer.feature.properties;
        ugv = props.ugv_class;
        k_ugv = parseFloat(props.k_ugv) || 1.0;
      }
    });
  }

  // Проверка ООПТ
  if (ooprLayer) {
    ooprLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && layer.getBounds().contains(point)) {
        const props = layer.feature.properties;
        oopr = props.zone_type;
        k_oopr = parseFloat(props.k_oopr) || 1.0;
      }
    });
  }

  // Оценка pH по типу почвы
  let ph = "7.0";
  if (soil === "Торфяник") ph = "4.7";
  else if (soil === "Суглинок") ph = "6.5";
  else if (soil === "Песок / супесь") ph = "7.2";

  // Оценка нагрузки (пока заглушка)
  const load = "Сельская местность";

  return {
    soil,
    ugws: ugv,
    ph,
    distanceToOOP: oopr,
    load,
    k_soil,
    k_ugv,
    k_oopr
  };
}

// Загрузка единого GeoJSON и разделение на слои
fetch('spb_lo_layers.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Файл spb_lo_layers.geojson не найден');
    return response.json();
  })
  .then(data => {
    // Разделяем на три массива
    const soils = { type: "FeatureCollection", features: [] };
    const ugv = { type: "FeatureCollection", features: [] };
    const oopr = { type: "FeatureCollection", features: [] };

    data.features.forEach(feature => {
      if (feature.properties.layer === 'soil') soils.features.push(feature);
      if (feature.properties.layer === 'ugv') ugv.features.push(feature);
      if (feature.properties.layer === 'oopr') oopr.features.push(feature);
    });

    // === Слой почв ===
    soilLayer = L.geoJSON(soils, {
      style: function(feature) {
        const type = feature.properties.soil_type;
        if (type === "Торфяник") return { fillColor: "#8B4513", color: "#5D2906", weight: 1, fillOpacity: 0.5 };
        if (type === "Суглинок") return { fillColor: "#A0522D", color: "#653E1A", weight: 1, fillOpacity: 0.5 };
        if (type === "Песок / супесь") return { fillColor: "#F4A460", color: "#D2691E", weight: 1, fillOpacity: 0.5 };
        return { fillColor: "#8FBC8F", color: "#2F4F4F", weight: 1, fillOpacity: 0.5 };
      },
      onEachFeature: function(feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`<b>Почва:</b> ${p.soil_type}<br>pH: ${p.ph_range}<br>K<sub>soil</sub>: ${p.K_soil}`);
      }
    });

    // === Слой УГВ ===
    ugvLayer = L.geoJSON(ugv, {
      style: { color: '#1976D2', weight: 2, fillOpacity: 0.2, fillColor: '#BBDEFB' },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<b>УГВ:</b> ${p.ugv_class}<br>K<sub>ugv</sub>: ${p.k_ugv}`);
      }
    });

    // === Слой ООПТ ===
    ooprLayer = L.geoJSON(oopr, {
      style: { color: '#B71C1C', weight: 2, fillOpacity: 0.2, fillColor: '#FFCDD2' },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<b>Зона:</b> ${p.zone_type}<br>K<sub>oopr</sub>: ${p.k_oopr}`);
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
    document.getElementById('info').innerHTML = `<p style="color:red">⚠️ ${err.message}</p><p>Убедитесь, что файл <code>spb_lo_layers.geojson</code> лежит в той же папке.</p>`;
  });

// === Обработчик клика по карте ===
let marker = null;
map.on('click', function(e) {
  const { lat, lng } = e.latlng;

  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);

  const params = getParamsAtPoint(lat, lng);
  updateSidebar(lat, lng, params);
});

// === Обновление боковой панели ===
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

// === Расчёт GII (заглушка с примером для ПНД) ===
function calculateGII(k_soil, k_ugv, k_oopr) {
  const Kkr = k_soil * k_ugv * k_oopr * 1.0 * 1.0; // K_нагрузка = K_pH = 1.0 пока
  const GII0_PND = 2.12; // из статьи 2
  const GII = (GII0_PND * Kkr).toFixed(2);
  
  const message = `
    <strong>Результат расчёта:</strong><br>
    GII₀ (ПНД) = 2.12<br>
    K<sub>кр</sub> = ${k_soil} × ${k_ugv} × ${k_oopr} = ${Kkr.toFixed(2)}<br>
    <b>GII = ${GII}</b><br><br>
    <em>Класс риска: ${getRiskClass(GII)}</em>
  `;
  document.getElementById('info').innerHTML += `<div style="margin-top:15px; padding:10px; background:#fff8e1; border-left:4px solid #ffa000;">${message}</div>`;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Критический";
}