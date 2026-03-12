// js/dashboard.js

// --- CONFIGURATION DU GRAPHIQUE ---
const ctx = document.getElementById('dualChart').getContext('2d');
const dualChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(60).fill(''),
        datasets: [
            { label: 'Accélération GAUCHE', data: Array(60).fill(0), borderColor: '#00d2ff', borderWidth: 2, tension: 0.3, pointRadius: 0 },
            { label: 'Accélération DROITE', data: Array(60).fill(0), borderColor: '#ffa502', borderWidth: 2, tension: 0.3, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: { y: { min: 0, max: 20, grid: { color: '#333' } }, x: { display: false } },
        plugins: { legend: { labels: { color: 'white' } } }
    }
});

/**
 * Mise à jour globale de l'interface (Dashboard + Personnage)
 */
function updateUI(side, state) {
    const el = document.getElementById('state' + side);
    const box = document.getElementById('box' + side);
    const states = ["ARRÊT", "MARCHE", "COURSE", "SPRINT"];
    const colors = ["#888", "#2ed573", "#ffa502", "#ff4757"];

    if (!el || el.innerText === states[state]) return;

    // 1. Mise à jour textuelle et couleurs
    el.innerText = states[state];
    el.style.color = (state === 0) ? "#888" : colors[state];
    box.style.border = (state === 0) ? "none" : `1px solid ${colors[state]}`;

    // 2. Mise à jour de l'animation du personnage
    // On récupère l'état de l'autre pied pour décider de l'allure générale
    const stateL = states.indexOf(document.getElementById('stateL').innerText);
    const stateR = states.indexOf(document.getElementById('stateR').innerText);
    const maxState = Math.max(stateL, stateR);
    
    const animModes = ['idle', 'walk', 'run', 'sprint'];
    startCharacterAnim(animModes[maxState]);
}

/**
 * Mise à jour du graphique en temps réel
 */
function updateChart(side, value) {
    const idx = (side === 'L') ? 0 : 1;
    const data = dualChart.data.datasets[idx].data;
    data.shift(); 
    data.push(value);
    dualChart.update();
}

/**
 * Gestion de l'affichage de la batterie
 */
function updateBatteryUI(side, voltage) {
    let pct = (voltage - 3.3) / (4.2 - 3.3) * 100;
    pct = Math.max(0, Math.min(100, pct)); // Borner entre 0 et 100

    const bar = document.getElementById('batLevel' + side);
    const txt = document.getElementById('batText' + side);
    
    txt.innerText = Math.round(pct) + "%";
    bar.style.width = pct + "%";

    if (pct > 50) bar.style.backgroundColor = "#2ed573"; 
    else if (pct > 20) bar.style.backgroundColor = "#ffa502";
    else bar.style.backgroundColor = "#ff4757";
}