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

// === БАЗОВЫЕ GII₀ ПО МАТЕРИАЛАМ (из статей) ===
const GII0_VALUES = {
  "Асбестоцемент": 8.90,
  "ПНД": 2.12,
  "Геотекстиль": 5.40,
  "Шлак": 6.70,
  "Керамика": 2.30,
  "Бетонные трубы": 3.80,
  "Геокомпозит (дренажный мат)": 3.50
};

// === ФУНКЦИЯ: определение параметров по клику ===
function getParamsAtPoint(lat, lng) {
  const pointGeo = turf.point([lng, lat]);

  // === 1. Почва ===
  let soil = "Не определён", k_soil = 1.0;
  if (soilLayer) {
    soilLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && turf.booleanPointInPolygon(pointGeo, layer.toGeoJSON())) {
        const p = layer.feature.properties;
        soil = p.soil_type || "Не указан";
        k_soil = parseFloat(p.K_soil) || 1.0;
        return false;
      }
    });
  }

  // === 2. УГВ ===
  let ugv = "Не определён", k_ugv = 1.0;
  if (ugvLayer) {
    ugvLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && turf.booleanPointInPolygon(pointGeo, layer.toGeoJSON())) {
        const p = layer.feature.properties;
        ugv = p.ugv_class || "Не указан";
        k_ugv = parseFloat(p.k_ugv) || 1.0;
        return false;
      }
    });
  }

  // === 3. ООПТ ===
  let oopr = "Не определён", k_oopr = 1.0;
  if (ooprLayer) {
    ooprLayer.eachLayer(layer => {
      if (layer instanceof L.Polygon && turf.booleanPointInPolygon(pointGeo, layer.toGeoJSON())) {
        const p = layer.feature.properties;
        oopr = p.zone_type || "Не указана";
        k_oopr = parseFloat(p.k_oopr) || 1.0;
        return false;
      }
    });
  }

  // === 4. pH и K_ph ===
  let ph = "7.0", k_ph = 1.0;
  if (soil === "Торфяник") {
    ph = "4.7"; k_ph = 1.5;
  } else if (soil === "Суглинок") {
    ph = "6.5"; k_ph = 1.1;
  } else if (soil.includes("Песок")) {
    ph = "7.2"; k_ph = 1.0;
  }

  // === 5. Нагрузка ===
  let load = "Сельская местность", k_load = 1.0;
  if (k_oopr >= 1.4) {
    load = "Второстепенная дорога"; k_load = 1.1;
  }
  if (k_ugv > 1.2 && k_soil > 1.2) {
    load = "Федеральная трасса / карьер"; k_load = 1.5;
  }

  return {
    soil, ugws: ugv, ph, distanceToOOP: oopr, load,
    k_soil, k_ugv, k_ph, k_oopr, k_load
  };
}

// === ЗАГРУЗКА СЛОЁВ ===
Promise.all([
  fetch('soils_spb_lo.geojson').then(r => r.json()),
  fetch('ugv_spb_lo.geojson').then(r => r.json()),
  fetch('oopr_spb_lo.geojson').then(r => r.json())
])
.then(([soilData, ugvData, ooprData]) => {
  // === Слой почв ===
  soilLayer = L.geoJSON(soilData, {
    style: f => {
      const t = f.properties.soil_type;
      if (t === "Торфяник") return { fillColor: "#8B4513", color: "#5D2906", weight: 1, fillOpacity: 0.5 };
      if (t === "Суглинок") return { fillColor: "#A0522D", color: "#653E1A", weight: 1, fillOpacity: 0.5 };
      if (t === "Песок / супесь") return { fillColor: "#F4A460", color: "#D2691E", weight: 1, fillOpacity: 0.5 };
      return { fillColor: "#8FBC8F", color: "#2F4F4F", weight: 1, fillOpacity: 0.5 };
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`<b>Почва:</b> ${p.soil_type}<br>pH: ${p.ph_range}<br>K<sub>soil</sub>: ${p.K_soil}`);
    }
  });

  // === Слой УГВ ===
  ugvLayer = L.geoJSON(ugvData, {
    style: { color: '#1976D2', weight: 2, fillOpacity: 0.2, fillColor: '#BBDEFB' },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`<b>УГВ:</b> ${p.ugv_class}<br>K<sub>ugv</sub>: ${p.k_ugv}`);
    }
  });

  // === Слой ООПТ ===
  ooprLayer = L.geoJSON(ooprData, {
    style: { color: '#B71C1C', weight: 2, fillOpacity: 0.2, fillColor: '#FFCDD2' },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`<b>Зона:</b> ${p.zone_type}<br>K<sub>oopr</sub>: ${p.k_oopr}`);
    }
  });

  // Добавляем слои
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
  document.getElementById('info').innerHTML = `<p style="color:red">❌ Не удалось загрузить данные.</p>`;
});

// === ОБРАБОТЧИК КЛИКА ===
let marker = null;
let currentParams = null;
map.on('click', function(e) {
  const { lat, lng } = e.latlng;

  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);

  currentParams = getParamsAtPoint(lat, lng);
  updateSidebar(lat, lng, currentParams);
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
    <button onclick="showMaterialSelector()">Рассчитать GII</button>
  `;
}

// === ВЫБОР МАТЕРИАЛА ===
function showMaterialSelector() {
  const materials = Object.keys(GII0_VALUES).join('\n');
  const userChoice = prompt(
    "Выберите материал дренажа:\n" + materials,
    "ПНД"
  );
  if (userChoice && GII0_VALUES.hasOwnProperty(userChoice)) {
    calculateGII(userChoice, GII0_VALUES[userChoice]);
  } else if (userChoice) {
    alert("Материал не найден. Пожалуйста, выберите из списка.");
  }
}

// === РАСЧЁТ GII ===
function calculateGII(material, GII0) {
  if (!currentParams) {
    alert("Сначала кликните по карте!");
    return;
  }

  const { k_soil, k_ugv, k_ph, k_oopr, k_load } = currentParams;
  const Kkr = k_soil * k_ugv * k_ph * k_oopr * k_load;
  const GII = Math.min((GII0 * Kkr).toFixed(2), 10.0);
  const riskClass = getRiskClass(parseFloat(GII));

  const message = `
    <strong>Результат расчёта:</strong><br>
    Материал: <b>${material}</b><br>
    GII₀ = ${GII0}<br>
    K<sub>кр</sub> = ${k_soil} × ${k_ugv} × ${k_ph} × ${k_oopr} × ${k_load} = ${Kkr.toFixed(2)}<br>
    <b>GII = ${GII}</b><br><br>
    <em>Классификация риска: ${riskClass}</em>
  `;
  document.getElementById('info').innerHTML += `
    <div style="margin-top:15px; padding:10px; background:#f9f9f9; border-left:4px solid #4CAF50; border-radius:4px;">
      ${message}
    </div>
  `;
}

// === КЛАССИФИКАЦИЯ РИСКА (из статьи 2) ===
function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Критический";
}