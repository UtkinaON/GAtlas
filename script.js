// === ГЛОБАЛЬНЫЕ ФУНКЦИИ GII ===
function calculateGII(ksoil, kugv, koopr) {
  const GII0 = 2.12;
  const Kkr = ksoil * kugv * koopr;
  const GII = (GII0 * Kkr).toFixed(2);
  const risk = getRiskClass(parseFloat(GII));
  
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML += `
    <div style="margin:15px 0;padding:15px;background:#E3F2FD;border-left:5px solid #2196F3;border-radius:4px;">
      <strong>🎯 GII = ${GII}</strong><br>
      K<sub>кр</sub> = ${Kkr.toFixed(2)}<br>
      <em>${risk}</em>
    </div>
  `;
}

function getRiskClass(gii) {
  if (gii <= 2.0) return "I — Очень низкий";
  if (gii <= 4.0) return "II — Низкий";
  if (gii <= 6.0) return "III — Умеренный";
  if (gii <= 8.0) return "IV — Высокий";
  return "V — Крайне высокий";
}