
#include "arduino_secrets.h"
#include "thingProperties.h"
#include <TinyGPS++.h>

// Inicialización del GPS
TinyGPSPlus gps;
HardwareSerial SerialGPS(1);

// Pines de conexión del GPS
const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;
const uint32_t GPS_BAUD = 9600;

// Intervalo de envío de datos
const unsigned long INTERVALO_ENVIO_MS = 10000;
unsigned long ultimoEnvio = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configuración de comunicación con el GPS
  SerialGPS.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Inicialización de Arduino IoT Cloud
  initProperties();

  ArduinoCloud.begin(ArduinoIoTPreferredConnection);

  setDebugMessageLevel(2);
  ArduinoCloud.printDebugInfo();

  estadoGps = "Iniciando GPS";
}

void loop() {
  // Actualiza la conexión con Arduino Cloud
  ArduinoCloud.update();

  // Lectura de datos enviados por el GPS
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }

  // Envío de información cada 10 segundos
  if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    ultimoEnvio = millis();
    publicarDatosGPS();
  }
}

void publicarDatosGPS() {

  // Verifica si el rastreo está activado
  if (!rastreoActivo) {
    estadoGps = "Rastreo detenido";
    return;
  }

  // Comprueba que la ubicación GPS sea válida y reciente
  if (gps.location.isValid() && gps.location.age() < 5000) {

    // Envía latitud y longitud a Arduino Cloud
    ubicacion = Location(
      gps.location.lat(),
      gps.location.lng()
    );

    // Actualiza la cantidad de satélites
    satelites = gps.satellites.isValid()
      ? gps.satellites.value()
      : 0;

    estadoGps = "Posicion GPS valida";

  } else {

    satelites = gps.satellites.isValid()
      ? gps.satellites.value()
      : 0;

    if (gps.charsProcessed() < 10) {
      estadoGps = "Sin datos GPS: revisar cable TXD a GPIO16";
    } else {
      estadoGps = "Buscando satelites";
    }
  }
}

// Se ejecuta cuando cambia el estado del rastreo
void onRastreoActivoChange() {
  estadoGps = rastreoActivo
    ? "Rastreo activado"
    : "Rastreo detenido";
}
