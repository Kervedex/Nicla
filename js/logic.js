// js/logic.js

// --- VARIABLES GLOBALES (Modifiables par l'utilisateur) ---
let userHeightMeters = 1.80;
let userWeightKg = 75;
let kFactor = 0.415;

// Variables de calcul dérivées
let stepLengthMeters = userHeightMeters * kFactor;
let kcalPerStep = (userWeightKg * 0.5) / (1000 / stepLengthMeters);

// Variables de session
let totalDistanceMeters = 0;
let totalCalories = 0;
let stopTimers = { L: null, R: null };

/**
 * Met à jour les paramètres de calcul quand l'utilisateur change ses réglages
 */
function updateProfile() {
    // Récupération des valeurs depuis l'interface
    const h = document.getElementById('input-height').value;
    const w = document.getElementById('input-weight').value;

    if (h && w) {
        userHeightMeters = parseFloat(h) / 100; // Conversion cm -> m
        userWeightKg = parseFloat(w);

        // Recalcul des ratios de base
        stepLengthMeters = userHeightMeters * kFactor;
        kcalPerStep = (userWeightKg * 0.5) / (1000 / stepLengthMeters);

        console.log(`Profil mis à jour : Pas = ${stepLengthMeters.toFixed(2)}m, Kcal/pas = ${kcalPerStep.toFixed(4)}`);
    }
}

/**
 * Mise à jour de la distance ET des calories (inchangée mais utilise les nouvelles variables)
 */
function updateDistance() {
    totalDistanceMeters += stepLengthMeters;
    totalCalories += kcalPerStep;

    const distElement = document.getElementById('total-distance');
    const kcalElement = document.getElementById('total-calories');

    if (distElement) {
        distElement.innerText = totalDistanceMeters < 1000 
            ? totalDistanceMeters.toFixed(1) + " m" 
            : (totalDistanceMeters / 1000).toFixed(2) + " km";
    }
    if (kcalElement) {
        kcalElement.innerText = totalCalories.toFixed(1) + " kcal";
    }
}

// ... (garde le reste des fonctions handleStateLogic et updateUI) ...

function handleStateLogic(side, targetState) {
    if (targetState > 0) {
        if (stopTimers[side]) { clearTimeout(stopTimers[side]); stopTimers[side] = null; }
        updateUI(side, targetState);
    } else if (!stopTimers[side]) {
        stopTimers[side] = setTimeout(() => { updateUI(side, 0); stopTimers[side] = null; }, 1500);
    }
}

function resetSessionData() {
    totalDistanceMeters = 0;
    totalCalories = 0;
    
    // Mise à jour immédiate de l'affichage
    const distEl = document.getElementById('total-distance');
    const kcalEl = document.getElementById('total-calories');
    
    if (distEl) distEl.innerText = "0.0 m";
    if (kcalEl) kcalEl.innerText = "0.0 kcal";
    
    console.log("Données de session réinitialisées");
}

function evaluerModeDeplacement(vitesseKmh) {
    if (vitesseKmh < 1.0) return 0;       // ARRÊT (ou piétinement)
    if (vitesseKmh >= 1.0 && vitesseKmh < 7.0) return 1;  // MARCHE (jusqu'à 7 km/h)
    if (vitesseKmh >= 7.0 && vitesseKmh < 15.0) return 2; // COURSE (de 7 à 15 km/h)
    return 3;                             // SPRINT (15 km/h et plus)
}