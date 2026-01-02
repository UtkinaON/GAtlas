// Инициализация карты
const map = L.map('map').setView([60, 30], 10);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
osm.addTo(map);

let soilLayer = null;
let currentMarker = null;

// Обработчик клика по полигонам почв
function handleLayerClick(lat, lng, properties) {
  try {
    // Удаляем старый маркер
    if (window.currentMarker) {
      map.removeLayer(window.currentMarker);
    }
    window.currentMarker = L.marker([lat, lng]).addTo(map);

    // Параметры из свойств GeoJSON (адаптировано под soil_spb_lo.geojson)
    const params = {
      soil: properties.soil_textural_class || properties.soil_type || 'Неизвестно',
      ph: properties.ph || properties.phh2o_0_5cm_mean || 7.0,
      organic_carbon: properties.organic_carbon_% || properties.ocd_0_5cm_mean || 0,
      area: properties.area_m2 || 0,
      ksoil: 1.0,  // Можно вычислить по pH/OC, напр. if(ph < 5.5) 0.8 else 1.0
      kugv: 1.0,   // Заглушка (удалить если не нужно)
      koopr: 1.0   // Заглушка (удалить если не нужно)
    };

    // Логика pH по типу почвы 
    const soilNum = parseInt(properties.fid || properties.soil_type || 0);
    if (soilNum === 3 || soilNum === 2) params.ph = 4.7;  // Глина/тяж суглинок
    else if (soilNum === 1) params.ph = 6.5;              // Лёг суглинок
    else params.ph = 7.2;                                 // Супесь

    params.ksoil = params.ph < 5.5 ? 0.8 : 1.0;  // Пример коэффициента

    updateSidebar(lat, lng, params);
  } catch (err) {
    console.error('handleLayerClick', err);
    alert(err.message);
  }
}

// Загрузка и отображение слоя почв
fetch('soil_spb_lo.geojson')
  .then(r => r.json())
  .then(soilData => {
    soilLayer = L.geoJSON(soilData, {
      style: function(feature) {
        const t = feature.properties.soil_textural_class || 
                  (parseInt(feature.properties.fid || 0) || 0);
        if (t === 3 || t.includes('Глина')) return {fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.6};
        if (t === 2 || t.includes('Тяж')) return {fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.6};
        if (t === 1 || t.includes('Лёгкий')) return {fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.6};
        return {fillColor: '#8FBC8F', color: '#2F4F4F', weight: 1, fillOpacity: 0.6};
      },
      onEachFeature: function(feature, layer) {
        layer.on('click', function(e) {
          handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties);
        });
        const p = feature.properties;
        layer.bindPopup(
          `<b>${p.soil_textural_class || 'Тип почвы'}</b><br>` +
          `pH: ${p.ph || 'N/A'}<br>` +
          `OC (%): ${p.organic_carbon_% || 'N/A'}<br>` +
          `Площадь: ${p.area_m2 ? (p.area_m2 / 10000).toFixed(1) + ' га' : 'N/A'}`
        );
      }
    });
    soilLayer.addTo(map);

    // Контроль слоёв (только почвы)
    const overlays = { 'Почвы СПб/ЛО': soilLayer };
    L.control.layers({ 'OpenStreetMap': osm }, overlays, {position: 'topright'}).addTo(map);
  })
  .catch(err => {
    console.error('GeoJSON загрузка', err);
    document.getElementById('info').innerHTML = '<p style="color:red;">Ошибка загрузки soil_spb_lo.geojson</p>';
  });

// Sidebar 
function updateSidebar(lat, lng, params) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
    <h3>Параметры почвы</h3>
    <p><strong>Тип:</strong> ${params.soil}</p>
    <p><strong>pH:</strong> ${params.ph}</p>
    <p><strong>OC (%):</strong> ${params.organic_carbon || 0}</p>
    <p><strong>Площадь:</strong> ${(params.area / 10000).toFixed(1)} га</p>
    <br>
    <button onclick="calculateGII(${params.ksoil}, ${params.kugv || 1}, ${params.koopr || 1})">Рассчитать GII</button>
  `;
}

function calculateGII(ksoil, kugv, koopr) {
  // логика GII
  const Kkr = ksoil * kugv * koopr;
  const GII0PND = 2.12;
  const GII = GII0PND * Kkr.toFixed(2);
  const message = `<strong>GII = 2.12</strong><br>K<sub>sub</sub> = ksoil * kugv * koopr = ${Kkr.toFixed(2)}<br><b>GII = ${GII}</b><br><br><em>${getRiskClass(GII)}</em>`;
  document.getElementById('info').innerHTML += `<div style="margin-top:15px; padding:10px; background:#fff8e1; border-left:4px solid #ffa000;">${message}</div>`;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return 'I — Низкий';
  if (gii <= 4.0) return 'II — Низкий';
  if (gii <= 6.0) return 'III — Средний';
  if (gii <= 8.0) return 'IV — Высокий';
  return 'V — Очень высокий';
}
