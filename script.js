// Инициализация карты
const map = L.map('map').setView([60, 30], 10); // Центр — Петербург

// Базовый слой OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// === СЛОЙ ПОЧВ: OpenLandMap (SoilGrids) ===
const soilLayer = L.tileLayer.wms('https://openlandmap.org/geoserver/ows', {
  layers: 'OpenLandMap:SOL_SOIL_TYPE-WRB_M',
  format: 'image/png',
  transparent: true,
  opacity: 0.6,
  attribution: '&copy; <a href="https://openlandmap.org">OpenLandMap</a> | SoilGrids'
});
soilLayer.addTo(map);

// === УПРАВЛЕНИЕ СЛОЯМИ ===
const baseLayers = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
};

const overlays = {
  "Почвенный покров (WRB)": soilLayer,
};

L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);

// === ОБРАБОТЧИК КЛИКА ===
map.on('click', function(e) {
  const { lat, lng } = e.latlng;
  const marker = L.marker([lat, lng]).addTo(map);
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer !== marker) map.removeLayer(layer);
  });

  // Определяем тип почвы из слоя (условно — по координатам)
  const soil = getSoilType(lat, lng);
  const params = {
    soil: soil,
    ugws: estimateUGV(lat, lng),
    ph: estimatePH(soil),
    distanceToOOP: estimateOOPDistance(lat, lng),
    load: estimateLoad(lat, lng)
  };

  updateSidebar(lat, lng, params);
});

// === ФУНКЦИИ ОЦЕНКИ ПАРАМЕТРОВ ===

function getSoilType(lat, lng) {
  // Пример: в ЛО — торф, в центре РФ — суглинки, на юге — чернозём
  if (lat > 59 && lng >= 29 && lng <= 32) return "Торфяник";
  if (lat >= 54 && lat <= 58 && lng >= 37 && lng <= 40) return "Суглинок";
  if (lat <= 52) return "Чернозём";
  return "Песчаный/супесчаный";
}

function estimateUGV(lat, lng) {
  if (getSoilType(lat, lng) === "Торфяник") return "Поверхность";
  return "Средний";
}

function estimatePH(soil) {
  if (soil === "Торфяник") return "4.5";
  if (soil === "Чернозём") return "6.8";
  return "7.2";
}

function estimateOOPDistance(lat, lng) {
  // В реальности — запрос к WFS/GIS, здесь — заглушка
  if (lat > 59 && lng >= 29 && lng <= 32) return "22 м";
  return ">100 м";
}

function estimateLoad(lat, lng) {
  // Можно расширить по данным OSM
  return "Сельская местность";
}

// === ОБНОВЛЕНИЕ БОКОВОЙ ПАНЕЛИ ===
function updateSidebar(lat, lng, params) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
    <h3>Параметры местности</h3>
    <p><strong>Тип грунта:</strong> ${params.soil}</p>
    <p><strong>Уровень грунтовых вод:</strong> ${params.ugws}</p>
    <p><strong>pH среды:</strong> ${params.ph}</p>
    <p><strong>До ООПТ:</strong> ${params.distanceToOOP}</p>
    <p><strong>Нагрузка:</strong> ${params.load}</p>
    <br>
    <button onclick="calculateGII(${JSON.stringify(params)})">Рассчитать GII</button>
  `;
}

// === ЗАГЛУШКА GII ===
function calculateGII(params) {
  alert(`GII будет рассчитан на основе:\n${JSON.stringify(params, null, 2)}`);
}