# Nicla
This project uses a Nicla Sense Me board and the following C++ code. You can use Arduino to upload the code to the Nicla Sense Me board.
The step detection is still in development, but it's works, not perfectly but it's works.

#include "Arduino.h"
#include "Arduino_BHY2.h"
#include <ArduinoBLE.h>
#include "Nicla_System.h"

// ==========================================
// --- CONFIGURATION ---
// ==========================================
#define DEVICE_NAME            "NiclaR" 
#define STEP_THRESH_VERTICAL   6.0      // Seuil impact (plus bas car LACC est autour de 0)
#define STEP_THRESH_HORIZ      8.0      // Seuil mouvement avant pour valider un pas
#define NOISE_FILTER           0.5      // Seuil de bruit (si en dessous, vitesse = 0 direct)
#define STEP_MIN_DELAY         600      

// ==========================================
// --- UUIDS ---
// ==========================================
#define SERVICE_UUID           "19B10000-0000-537E-4F6C-D104768A1214"
#define CHAR_PAS_SESSION_UUID  "19B10000-1001-537E-4F6C-D104768A1214"
#define CHAR_PAS_TOTAL_UUID    "19B10000-1002-537E-4F6C-D104768A1214"
#define CHAR_VITESSE_UUID      "19B10000-1003-537E-4F6C-D104768A1214"
#define CHAR_BATTERY_UUID      "19B10000-1004-537E-4F6C-D104768A1214"
#define CHAR_ACCEL_HORIZ_UUID  "19B10000-1005-537E-4F6C-D104768A1214"
#define CHAR_ETAT_UUID         "19B10000-1006-537E-4F6C-D104768A1214"
#define CHAR_ACCEL_VERT_UUID   "19B10000-1007-537E-4F6C-D104768A1214" 
#define CHAR_CONTROL_UUID      "19B10000-5001-537E-4F6C-D104768A1214"

BLEService movementService(SERVICE_UUID);
BLEUnsignedIntCharacteristic pasSessionChar(CHAR_PAS_SESSION_UUID, BLERead | BLENotify);
BLEUnsignedIntCharacteristic pasTotauxChar(CHAR_PAS_TOTAL_UUID, BLERead | BLENotify);
BLEFloatCharacteristic vitesseChar(CHAR_VITESSE_UUID, BLERead | BLENotify);
BLEFloatCharacteristic batteryChar(CHAR_BATTERY_UUID, BLERead | BLENotify);
BLEUnsignedIntCharacteristic etatChar(CHAR_ETAT_UUID, BLERead | BLENotify);
BLEByteCharacteristic controlChar(CHAR_CONTROL_UUID, BLERead | BLEWrite);
BLEFloatCharacteristic horizChar(CHAR_ACCEL_HORIZ_UUID, BLERead | BLENotify);
BLEFloatCharacteristic vertChar(CHAR_ACCEL_VERT_UUID, BLERead | BLENotify);

// ==========================================
// --- VARIABLES ---
// ==========================================
// POINT 2: On utilise bien LACC (Linear Acceleration)
SensorXYZ accelerometer(SENSOR_ID_LACC);
SensorXYZ gravity(SENSOR_ID_GRA); // Nécessaire uniquement pour l'orientation (Haut/Bas)

float calG_x = 0, calG_y = 0, calG_z = 0; 
float vX = 0, vY = 0, vZ = 0;
bool calibrated = false;
bool enVeille = false;

float vitesseInst = 0;
float accel_vert_val = 0; 
float accel_horiz_mag = 0;

unsigned long lastStepTimestamp = 0;
unsigned long lastCheck = 0;

uint32_t pasS = 0;
uint32_t pasT = 0;

void setup() {
  Serial.begin(115200);
  nicla::begin();
  nicla::leds.begin();
  nicla::leds.setColor(red); 

  BHY2.begin(NICLA_STANDALONE);
  accelerometer.begin();
  gravity.begin(); 

  if (!BLE.begin()) while (1);
  
  BLE.setLocalName(DEVICE_NAME);
  BLE.setAdvertisedService(movementService);
  
  movementService.addCharacteristic(pasSessionChar);
  movementService.addCharacteristic(pasTotauxChar);
  movementService.addCharacteristic(vitesseChar);
  movementService.addCharacteristic(batteryChar);
  movementService.addCharacteristic(horizChar);
  movementService.addCharacteristic(vertChar);
  movementService.addCharacteristic(etatChar);
  movementService.addCharacteristic(controlChar);
  
  BLE.addService(movementService);
  BLE.advertise();

  delay(1000); 
  calibrateOrientation();
}

void loop() {
  BLE.poll();
  BHY2.update();

  if (controlChar.written()) {
     byte cmd = controlChar.value();
     switch(cmd) {
        case 1: // RESET
           pasS = 0; pasT = 0; vitesseInst = 0; vX=0; vY=0; vZ=0;
           pasSessionChar.writeValue(0);
           pasTotauxChar.writeValue(0);
           etatChar.writeValue(0);
           break;
        case 2: // RECALIB
           enVeille = false;
           accelerometer.begin(); gravity.begin();
           calibrateOrientation();
           break;
        case 3: // VEILLE
           enVeille = true;
           nicla::leds.setColor(off);
           break;
        case 4: // REVEIL
           enVeille = false;
           if(calibrated) nicla::leds.setColor(green);
           break;
     }
  }

  if (enVeille) return;

  if (millis() - lastCheck >= 20) { 
    if (calibrated) {
      calculPhysique();       
      detecterPas();          
    }
    updateBattery();        
    lastCheck = millis();
  }
}

void calibrateOrientation() {
  float sumX = 0, sumY = 0, sumZ = 0;
  int samples = 50;
  nicla::leds.setColor(blue); 

  for(int i=0; i<samples; i++) {
    BHY2.update();
    sumX += gravity.x(); 
    sumY += gravity.y();
    sumZ += gravity.z();
    delay(10);
  }

  float avgX = sumX / samples;
  float avgY = sumY / samples;
  float avgZ = sumZ / samples;
  float mag = sqrt(avgX*avgX + avgY*avgY + avgZ*avgZ);

  if (mag > 0) {
    calG_x = avgX / mag;
    calG_y = avgY / mag;
    calG_z = avgZ / mag;
    calibrated = true;
    nicla::leds.setColor(green); 
  } else {
    nicla::leds.setColor(red); 
  }
}

void calculPhysique() {
  float scale = 9.81 / 4096.0;
  float lin_ax = accelerometer.x() * scale;
  float lin_ay = accelerometer.y() * scale;
  float lin_az = accelerometer.z() * scale;
  
  // Produit scalaire = Accel Verticale
  float vert_component = (lin_ax * calG_x) + (lin_ay * calG_y) + (lin_az * calG_z);
  accel_vert_val = abs(vert_component); // Valeur absolue de l'impact

  // Soustraction vectorielle = Accel Horizontale
  float horiz_ax = lin_ax - (vert_component * calG_x);
  float horiz_ay = lin_ay - (vert_component * calG_y);
  float horiz_az = lin_az - (vert_component * calG_z);
  
  accel_horiz_mag = sqrt(horiz_ax*horiz_ax + horiz_ay*horiz_ay + horiz_az*horiz_az);

  float displayHoriz = (accel_horiz_mag > NOISE_FILTER) ? accel_horiz_mag : 0.0;
  horizChar.writeValue(displayHoriz);

  float displayVert = (accel_vert_val > NOISE_FILTER) ? accel_vert_val : 0.0;
  vertChar.writeValue(displayVert);
  
  if (accel_horiz_mag > NOISE_FILTER) {
     // Intégration simple
     float dt = 0.02; 
     vX += horiz_ax * dt;
     vY += horiz_ay * dt;
     vZ += horiz_az * dt;
     vitesseInst = sqrt(vX*vX + vY*vY + vZ*vZ) * 3.6; // km/h
  } 
  else {
     vX = 0; 
     vY = 0; 
     vZ = 0;
     vitesseInst = 0;
  }
  vitesseChar.writeValue(vitesseInst);
}

void detecterPas() {
  unsigned long currentMillis = millis();
  
  // On regarde si on dépasse tes seuils personnalisés
  bool impactCondition = (accel_vert_val > STEP_THRESH_VERTICAL);
  bool motionCondition = (accel_horiz_mag > STEP_THRESH_HORIZ);
  
  static bool isStepPeaking = false;
  static unsigned long lastPeakTime = 0;

  // Si on détecte un impact OU un fort mouvement avant, on entre en phase de "pic"
  // (Cela tolère un léger décalage entre l'accel horizontale et verticale'
  // Au lieu de (impactCondition || motionCondition)
  if (impactCondition) { // On ne déclenche le comptage QUE sur la frappe du talon
    isStepPeaking = true; 
    lastPeakTime = currentMillis;
  }

  // Si on était en pic, et que les deux courbes redescendent (fin du pas)
  if (isStepPeaking && (accel_vert_val < STEP_THRESH_VERTICAL - 1.0) && (accel_horiz_mag < STEP_THRESH_HORIZ - 1.0)) {
    isStepPeaking = false; 
    
    // On valide le pas si le délai minimum est respecté
    if (currentMillis - lastStepTimestamp > STEP_MIN_DELAY) {
        registerStep(currentMillis);
    }
  }
  
  // Sécurité : si on reste "bloqué" en l'air trop longtemps (plus de 500ms sans retomber)
  if (isStepPeaking && (currentMillis - lastPeakTime > 500)) {
      isStepPeaking = false;
  }
}

void registerStep(unsigned long timeMs) {
  lastStepTimestamp = timeMs;
  pasS++; pasT++;
  pasSessionChar.writeValue(pasS);
  pasTotauxChar.writeValue(pasT);
}

void updateBattery() {
  static unsigned long tBat = 0;
  if (millis() - tBat > 10000) { 
    tBat = millis();
    float voltage = nicla::getCurrentBatteryVoltage();
    batteryChar.writeValue(voltage);
  }
}
