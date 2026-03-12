// js/ble-manager.js

const NICLA_CONFIG = {
    SERVICE_UUID: "19b10000-0000-537e-4f6c-d104768a1214",
    CHARS: {
        PAS: "19b10000-1001-537e-4f6c-d104768a1214",
        VITESSE: "19b10000-1003-537e-4f6c-d104768a1214",
        BATTERY: "19b10000-1004-537e-4f6c-d104768a1214",
        ACCEL_HORIZ: "19b10000-1005-537e-4f6c-d104768a1214",
        ACCEL_VERT: "19b10000-1007-537e-4f6c-d104768a1214",
        CONTROL: "19b10000-5001-537e-4f6c-d104768a1214"
    }
};

let charControlL = null;
let charControlR = null;
let lastSteps = { L: 0, R: 0 };

/**
 * Fonction principale de connexion
 */

async function connectDevice(side) {
    const nameFilter = (side === 'L') ? 'NiclaL' : 'NiclaR';
    const btn = document.getElementById('btn' + side);
    
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: nameFilter }],
            optionalServices: [NICLA_CONFIG.SERVICE_UUID]
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(NICLA_CONFIG.SERVICE_UUID);

        // --- DÉTECTION DU PAS RÉEL ---
        setupChar(service, NICLA_CONFIG.CHARS.PAS, 'int', (v) => {
            // Mise à jour de l'affichage du chiffre
            document.getElementById('steps' + side).innerText = v;
    
            // LOGIQUE IMPARABLE : On n'anime QUE si le chiffre a augmenté
            if (v > lastSteps[side]) {
                animateStep(side);   
                updateDistance();    
            }
    
        // On met à jour la mémoire avec le nouveau chiffre (même si c'est 0)
            lastSteps[side] = v;
        });

        // --- VITESSE ---
        setupChar(service, NICLA_CONFIG.CHARS.VITESSE, 'float', (v) => {
            document.getElementById('speed' + side).innerText = v.toFixed(1);
            // On peut encore appeler handleStateLogic pour les couleurs du dashboard (Marche/Arrêt)
            let target = (v > 0.5) ? 1 : 0;
            handleStateLogic(side, target);
        });

        // --- ACCELS ---
        setupChar(service, NICLA_CONFIG.CHARS.ACCEL_HORIZ, 'float', (accel) => {
            document.getElementById('accelHoriz' + side).innerText = accel.toFixed(1);
            updateChart(side, accel);
        });
        setupChar(service, NICLA_CONFIG.CHARS.ACCEL_VERT, 'float', (v) => {
            document.getElementById('accelVert' + side).innerText = v.toFixed(1);
        });
        setupChar(service, NICLA_CONFIG.CHARS.BATTERY, 'float', (v) => updateBatteryUI(side, v));

        const ctrl = await service.getCharacteristic(NICLA_CONFIG.CHARS.CONTROL);
        if(side === 'L') charControlL = ctrl; else charControlR = ctrl;
        btn.innerText = "CONNECTÉ"; btn.classList.add("connected");
    } catch (e) { console.log(e); btn.innerText = "ECHEC"; }
}

async function setupChar(s, u, t, c) {
    try {
        const char = await s.getCharacteristic(u);
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', (e) => {
            const v = e.target.value;
            c(t === 'int' ? v.getUint32(0,true) : v.getFloat32(0,true));
        });
    } catch(e){}
}

// js/ble-manager.js

let isResetting = false; // Le verrou

async function sendCommand(cmdCode) {
    const val = Uint8Array.of(cmdCode);
    
    // 1. Envoi au Bluetooth (avec sécurité si un seul pied est connecté)
    try {
        if (typeof charControlL !== 'undefined' && charControlL) await charControlL.writeValue(val);
        if (typeof charControlR !== 'undefined' && charControlR) await charControlR.writeValue(val);
    } catch(e) { console.log("Erreur BLE:", e); }
    
    // 2. Si c'est le bouton RESET (code 1)
    if (cmdCode === 1) { 
        // Reset visuel
        const elL = document.getElementById('stepsL');
        const elR = document.getElementById('stepsR');
        if (elL) elL.innerText = "0"; 
        if (elR) elR.innerText = "0";
        
        // Reset de la mémoire pour accepter les prochains pas
        lastSteps.L = 0;
        lastSteps.R = 0;
        
        // Appel de la fonction pour nettoyer Distance et Kcal
        if (typeof resetSessionData === "function") {
            resetSessionData(); 
        } else {
            console.error("ATTENTION: resetSessionData introuvable !");
        }
    }
}

// MISE À JOUR de la réception des PAS
setupChar(service, NICLA_CONFIG.CHARS.PAS, 'int', (v) => {
    // 1. On met toujours à jour le chiffre affiché
    document.getElementById('steps' + side).innerText = v;
    
    // 2. On n'anime et on ne calcule QUE SI :
    // - On n'est pas en train de resetter
    // - ET la valeur est supérieure à 0
    if (!isResetting && v > 0) {
        animateStep(side);   
        updateDistance();    
    }

});
