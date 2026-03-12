// js/dashboard.js

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
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false, 
        scales: { y: { min: 0, max: 20 } }
    }
});

// 1. On crée une mémoire temporaire pour les dernières valeurs reçues
let latestAccel = { L: 0, R: 0 };

// 2. Quand le Bluetooth reçoit une donnée, on met juste la mémoire à jour (on ne dessine plus ici)
function updateChart(side, value) { 
    latestAccel[side] = value;
}

// 3. LA SYNCHRONISATION : Un chronomètre fixe qui dessine le graphique à vitesse constante
setInterval(() => {
    // On récupère les tableaux de données du graphique
    const dataL = dualChart.data.datasets[0].data;
    const dataR = dualChart.data.datasets[1].data;

    // On décale tout le monde vers la gauche en même temps
    dataL.shift(); 
    dataR.shift(); 

    // On ajoute la dernière valeur connue pour chaque pied
    dataL.push(latestAccel.L);
    dataR.push(latestAccel.R);

    // On met à jour l'image
    dualChart.update();
}, 100); // 100 ms = Le graphique se met à jour exactement 10 fois par seconde

// --- Fonction Batterie inchangée ---
function updateBatteryUI(s, v) {
    let p = Math.max(0, Math.min(100, (v-3.3)/(4.2-3.3)*100));
    document.getElementById('batText'+s).innerText = Math.round(p)+"%";
    document.getElementById('batLevel'+s).style.width = p+"%";
}

function updateUI(side, state) {
    const el = document.getElementById('state' + side);
    const box = document.getElementById('box' + side);
    const visualArea = document.getElementById('visual-area'); // L'écran de l'animation
    
    const states = ["ARRÊT", "MARCHE", "COURSE", "SPRINT"];
    const colors = ["#888", "#2ed573", "#ffa502", "#ff4757"]; 
    
    if (el) {
        const safeState = Math.min(state, 3); 
        
        el.innerText = states[safeState];
        el.style.color = colors[safeState];
        box.style.borderColor = colors[safeState];

        // --- NOUVEAU : Activation du vent en mode SPRINT ---
        if (visualArea) {
            if (safeState === 3) {
                visualArea.classList.add('sprint-active');
            } else {
                visualArea.classList.remove('sprint-active');
            }
        }
    }
}

