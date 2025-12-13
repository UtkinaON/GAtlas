// Инициализация карты
const map = L.map('map').setView([60, 30], 10); // Центр — Петербург

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


// //!!!!!!!
// // === СЛОЙ: ООПТ России (из открытого источника) ===
// const ooptLayer = L.geoJSON(null, {
  // style: function (feature) {
    // return {
      // color: '#d32f2f',        // красный
      // weight: 2,
      // fillOpacity: 0.1,
      // fillColor: '#ffcdd2'
    // };
  // },
  // onEachFeature: function (feature, layer) {
    // const name = feature.properties.name || feature.properties.title || 'ООПТ';
    // layer.bindPopup(`<b>${name}</b><br>Тип: ${feature.properties.type || 'не указан'}`);
  // }
// });

// // Загрузка данных ООПТ (пример для Северо-Запада или всей РФ)
// fetch('https://api.oopt.info/api/map/oopt.geojson')
  // .then(response => response.json())
  // .then(data => {
    // ooptLayer.addData(data);
    // map.addLayer(oooptLayer);
  // })
  // .catch(err => {
    // console.warn('Не удалось загрузить слой ООПТ:', err);
    // // Можно показать предупреждение пользователю
  // });

// // === УПРАВЛЕНИЕ СЛОЯМИ ===
// const baseLayers = {
  // "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
// };

// const overlays = {
  // "ООПТ": ooptLayer
// };

// L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);

// //!!!!!!!


// Маркер, который появится при клике
let marker = null;

// Обработчик клика по карте
map.on('click', async function(e) {
  const { lat, lng } = e.latlng;
  
  // Удаляем старый маркер, если есть
  if (marker) map.removeLayer(marker);
  
  // Добавляем новый маркер
  marker = L.marker([lat, lng]).addTo(map);
  
  // Загружаем данные (здесь — мок, позже — ваш API)
  const params = await fetchSiteParams(lat, lng);
  
  // Обновляем боковую панель
  updateSidebar(lat, lng, params);
});

// === МОК-ФУНКЦИЯ: замените на ваш API ===
// async function fetchSiteParams(lat, lng) {
  // const response = await fetch(`/api/site-params?lat=${lat}&lng=${lng}`);
  // return await response.json();
// }
async function fetchSiteParams(lat, lng) {
  // Пример: в зависимости от региона — разные параметры
  // Здесь — упрощённая логика: если широта > 59 и долгота ~30 → ЛО, торфяник
  
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

// Обновление боковой панели
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

// Заглушка для расчёта GII (можно подключить позже)
function calculateGII() {
  alert("Функция расчёта GII будет подключена через API");
}