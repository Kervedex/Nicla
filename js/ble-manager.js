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
let isResetting = false; // Le verrou global

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
    
            // LOGIQUE FUSIONNÉE : On n'anime QUE si ce n'est pas un reset ET que le chiffre a augmenté
            if (!isResetting && v > lastSteps[side]) {
                animateStep(side);   
                updateDistance();    
            }
            lastSteps[side] = v;
        });

        // --- VITESSE & ÉTAT ---
        setupChar(service, NICLA_CONFIG.CHARS.VITESSE, 'float', (v) => {
            document.getElementById('speed' + side).innerText = v.toFixed(1);
            let target = evaluerModeDeplacement(v);
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
        
        // --- BATTERIE ---
        setupChar(service, NICLA_CONFIG.CHARS.BATTERY, 'float', (v) => updateBatteryUI(side, v));

        const ctrl = await service.getCharacteristic(NICLA_CONFIG.CHARS.CONTROL);
        if(side === 'L') charControlL = ctrl; else charControlR = ctrl;
        
        btn.innerText = "CONNECTÉ"; 
        btn.classList.add("connected");
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

async function sendCommand(cmdCode) {
    const val = Uint8Array.of(cmdCode);
    
    try {
        if (typeof charControlL !== 'undefined' && charControlL) await charControlL.writeValue(val);
        if (typeof charControlR !== 'undefined' && charControlR) await charControlR.writeValue(val);
    } catch(e) { console.log("Erreur BLE:", e); }
    
    if (cmdCode === 1) { 
        isResetting = true; // Activation du verrou

        const elL = document.getElementById('stepsL');
        const elR = document.getElementById('stepsR');
        if (elL) elL.innerText = "0"; 
        if (elR) elR.innerText = "0";
        
        lastSteps.L = 0;
        lastSteps.R = 0;
        
        if (typeof resetSessionData === "function") resetSessionData(); 
        
        setTimeout(() => { isResetting = false; }, 500); // Lève le verrou
    }
}