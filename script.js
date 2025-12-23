// Инициализация карты
const map = L.map('map').setView([60, 30], 10);

// Базовый слой
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
osm.addTo(map);

// Переменная для слоя почв (изначально пустая)
let soilLayer = null;

// Загрузка GeoJSON
fetch('soils_spb_lo.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('Не удалось загрузить soils_spb_lo.geojson');
    }
    return response.json();
  })
  .then(data => {
    // Создаём слой
    soilLayer = L.geoJSON(data, {
      style: function(feature) {
        const type = feature.properties.soil_type;
        if (type === "Торфяник") return { fillColor: "#8B4513", color: "#5D2906", weight: 1, fillOpacity: 0.5 };
        if (type === "Суглинок") return { fillColor: "#A0522D", color: "#653E1A", weight: 1, fillOpacity: 0.5 };
        if (type === "Песок / супесь") return { fillColor: "#F4A460", color: "#D2691E", weight: 1, fillOpacity: 0.5 };
        return { fillColor: "#8FBC8F", color: "#2F4F4F", weight: 1, fillOpacity: 0.5 };
      },
      onEachFeature: function(feature, layer) {
        const props = feature.properties;
        const popup = `
          <b>Тип почвы:</b> ${props.soil_type}<br>
          <b>pH:</b> ${props.ph_range}<br>
          <b>K<sub>почва</sub>:</b> ${props.K_soil}
        `;
        layer.bindPopup(popup);
      }
    });

    // Добавляем на карту (по умолчанию включён)
    soilLayer.addTo(map);

    // Обновляем контрол слоёв — только после загрузки
    const baseLayers = {
      "OpenStreetMap": osm
    };

    const overlays = {
      "Виды почв (СПб и ЛО)": soilLayer
    };

    L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);
  })
  .catch(err => {
    console.error('Ошибка загрузки почвенного слоя:', err);
    alert('Не удалось загрузить данные о почвах. Проверьте, что файл soils_spb_lo.geojson лежит в той же папке.');
  });

// === Далее — остальной код (без изменений) ===

let marker = null;

map.on('click', async function(e) {
  const { lat, lng } = e.latlng;
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);
  const params = await fetchSiteParams(lat, lng);
  updateSidebar(lat, lng, params);
});

async function fetchSiteParams(lat, lng) {
  if (lat > 59 && lng >= 29 && lng <= 32) {
    return {
      soil: "Торфяник",
      ugws: "Поверхность",
      ph: "4.7",
      distanceToOOP: "22 м",
      load: "Второстепенная дорога"
    };
  } else if (lat > 55 && lng > 35) {
    return {
      soil: "Песок",
      ugws: "Низкий",
      ph: "7.2",
      distanceToOOP: ">100 м",
      load: "Поле"
    };
  } else {
    return {
      soil: "Суглинок",
      ugws: "Средний",
      ph: "6.5",
      distanceToOOP: "50 м",
      load: "Город"
    };
  }
}

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
    <button onclick="calculateGII()">Рассчитать GII</button>
  `;
}

function calculateGII() {
  alert("Функция расчёта GII будет подключена через API");
}