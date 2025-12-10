// === Конфигурация ===
const API_BASE_URL = 'https://ваш-бэкенд.onrender.com'; // ← ЗАМЕНИТЕ НА ВАШ РЕАЛЬНЫЙ URL

// === Инициализация карты ===
const map = L.map('map').setView([60, 30], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let marker = null;

// === Обработка клика по карте ===
map.on('click', async function(e) {
  const { lat, lng } = e.latlng;
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/site-params?lat=${lat}&lng=${lng}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const params = await response.json();
    updateSidebar(lat, lng, params);
  } catch (err) {
    alert('Ошибка загрузки данных: ' + err.message);
  }
});

// === Работа с аутентификацией ===
function showAuthModal(isLogin) {
  document.getElementById('authTitle').textContent = isLogin ? 'Вход' : 'Регистрация';
  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
      const url = `${API_BASE_URL}/api/${isLogin ? 'login' : 'register'}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('email', email);
        updateUserUI();
        closeAuthModal();
      } else {
        document.getElementById('authMessage').textContent = data.message || 'Ошибка';
      }
    } catch (err) {
      document.getElementById('authMessage').textContent = 'Ошибка сети';
    }
  };
  document.getElementById('authModal').style.display = 'block';
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  updateUserUI();
}

function updateUserUI() {
  const token = localStorage.getItem('token');
  const email = localStorage.getItem('email');
  const info = document.getElementById('user-info');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (token) {
    info.textContent = `Привет, ${email}`;
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    info.textContent = '';
    loginBtn.style.display = 'inline-block';
    registerBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}

// Загрузка состояния при старте
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
});

// === Расчёт GII через API ===
async function calculateGII() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Войдите в систему для расчёта GII');
    return;
  }

  const infoDiv = document.getElementById('info');
  const coordsText = infoDiv.querySelector('p').textContent; // Координаты: 60.0000, 30.0000
  const [lat, lng] = coordsText.match(/(-?\d+\.\d+)/g).map(Number);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/calculate-gii`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ lat, lng })
    });
    const result = await response.json();
    
    // Показать результат и сохранить в БД
    alert(`GII = ${result.gii.toFixed(2)}\nКласс риска: ${result.riskClass}`);
    
    // Сохранить в историю
    await fetch(`${API_BASE_URL}/api/save-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        lat, lng,
        gii: result.gii,
        riskClass: result.riskClass,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    alert('Ошибка расчёта: ' + err.message);
  }
}

// === Мок-функция (удалить после подключения API) ===
// async function fetchSiteParams(lat, lng) { ... }