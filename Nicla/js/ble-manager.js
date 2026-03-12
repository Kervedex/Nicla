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
            document.getElementById('steps' + side).innerText = v;
            animateStep(side);   // Animation du personnage
            updateDistance(); // <-- LE PERSONNAGE BOUGE ICI
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
    
    try {
        if (charControlL) await charControlL.writeValue(val);
        if (charControlR) await charControlR.writeValue(val);
        
        if (cmdCode === 1) { 
            isResetting = true; // On active le verrou
            
            // On remet les compteurs visuels à 0 immédiatement
            document.getElementById('stepsL').innerText = "0"; 
            document.getElementById('stepsR').innerText = "0";
            
            // On appelle la fonction de reset de logic.js
            resetSessionData(); 
            
            // On lève le verrou après 500ms (le temps que la Nicla confirme le 0)
            setTimeout(() => { isResetting = false; }, 500);
        }
    } catch(e) { console.log("Erreur commande:", e); isResetting = false; }
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