// === ГЕО АТЛАС: интерактивная карта ===
let currentMarker = null;

document.addEventListener('DOMContentLoaded', function () {
  const map = L.map('map').setView([60, 30], 8);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  osm.addTo(map);

  let soilLayer = null;

  // Универсальная функция форматирования
  const formatValue = (val) => {
    if (val === undefined || val === null || val === -9999 || val === '-9999') return '—';
    const num = parseFloat(val);
    return isNaN(num) ? '—' : num.toFixed(1);
  };

 // Функция клика (ИСПРАВЛЕНА для воды)
function handleLayerClick(lat, lng, properties) {
  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lng]).addTo(map);

  const soilNum = parseInt(properties.soil_type || properties.fid || 0);
  const soilClassRaw = (properties.soil_textural_class || '').trim();
  
  // ПРОВЕРЯЕМ ВОДУ ПО ПРИОРИТЕТУ:
  let soilClass = 'Супесь';  // дефолт
  
  if (soilNum === -1 || soilClassRaw.includes('Водная') || soilClassRaw.includes('Вода')) {
    soilClass = 'Водная поверхность';
  } else if (soilNum === 3 || soilClassRaw.includes('Глина')) {
    soilClass = 'Глина';
  } else if (soilNum === 2 || soilClassRaw.includes('Тяжёлый суглинок')) {
    soilClass = 'Тяжёлый суглинок';
  } else if (soilNum === 1 || soilClassRaw.includes('Лёгкий суглинок')) {
    soilClass = 'Лёгкий суглинок';
  }

  const ph = formatValue(properties.ph);
  const oc = formatValue(properties['organic_carbon_%']);
  const area = properties.area_m2 ? (parseFloat(properties.area_m2) / 10000).toFixed(2) + ' га' : '—';

  // Ksoil для воды = 0.5
  let ksoil = 1.0;
  if (soilClass === 'Водная поверхность') {
    ksoil = 0.5;
  } else if (soilClass === 'Глина') {
    ksoil = 1.3;
  } else if (soilClass === 'Тяжёлый суглинок') {
    ksoil = 1.1;
  } else if (ph !== '—') {
    const phNum = parseFloat(properties.ph);
    if (phNum && phNum < 5.5) ksoil = 1.4;
  }

  const params = { soil: soilClass, ph, organic_carbon: oc, area, ksoil, kugv: 1.0, koopr: 1.0 };
  updateSidebar(lat, lng, params);
}


  // Загрузка GeoJSON
  fetch('soil_spb_lo.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`Файл не найден: ${response.status}`);
      return response.json();
    })
    .then(soilData => {
      soilLayer = L.geoJSON(soilData, {
		style: function (feature) {
		  const soilNum = parseInt(feature.properties.soil_type || feature.properties.fid || 0);
		  const cls = (feature.properties.soil_textural_class || '').trim();
  		  // ВОДА по приоритету
		  if (soilNum === -1 || /Водная|Вода/.test(cls)) {
			return { fillColor: '#1e88e5', color: '#0d47a1', weight: 2, fillOpacity: 0.4 };
		  }
		  if (soilNum === 3 || /Глина/.test(cls)) {
			return { fillColor: '#8B4513', color: '#5D2906', weight: 1, fillOpacity: 0.6 };
		  }
		  if (soilNum === 2 || /Тяжёлый суглинок/.test(cls)) {
			return { fillColor: '#A0522D', color: '#653E1A', weight: 1, fillOpacity: 0.6 };
		  }
		  if (soilNum === 1 || /Лёгкий суглинок/.test(cls)) {
			return { fillColor: '#F4A460', color: '#D2691E', weight: 1, fillOpacity: 0.6 };
		  }
		  return { fillColor: '#90EE90', color: '#2E7D32', weight: 1, fillOpacity: 0.6 };
		},

        onEachFeature: function (feature, layer) {
          layer.on('click', e => handleLayerClick(e.latlng.lat, e.latlng.lng, feature.properties));
          
          const p = feature.properties;
          layer.bindPopup(`
            <b>Тип:</b> ${p.soil_textural_class || '—'}<br>
            <b>pH:</b> ${formatValue(p.ph)}<br>
            <b>OC (%):</b> ${formatValue(p['organic_carbon_%'])}<br>
            <b>Площадь:</b> ${p.area_m2 ? (parseFloat(p.area_m2)/10000).toFixed(2) + ' га' : '—'}
          `);
        }
      });
      
      soilLayer.addTo(map);
      L.control.layers({ "OpenStreetMap": osm }, { 'Почвы СПб/ЛО': soilLayer }, { position: 'topright' }).addTo(map);
      console.log('✅ Загружено:', soilData.features.length, 'полигонов');
    })
    .catch(err => {
      console.error('❌ Ошибка:', err);
      document.getElementById('info').innerHTML = `<p style="color:red;font-weight:bold;">${err.message}</p>`;
    });
});

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
  return "V — Критический риск";
}
