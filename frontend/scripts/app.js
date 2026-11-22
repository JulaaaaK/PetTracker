
import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

// Elementos de la página
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");
const trackingSwitch = document.getElementById("trackingSwitch");

const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");
const refreshHistoryButton = document.getElementById("refreshHistoryButton");

let map;
let marker;
let satelliteLayer;
let streetLayer;
let showingSatellite = false;
let refreshInterval;

// Crear mapa
function initializeMap() {
  if (map) return;

  map = L.map("map").setView([4.6533, -74.0836], 15);

  streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors"
    }
  );

  satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri"
    }
  );

  streetLayer.addTo(map);
}

// Cambiar mapa normal y satelital
document.getElementById("mapTypeButton").addEventListener("click", () => {
  if (!map) return;

  if (showingSatellite) {
    map.removeLayer(satelliteLayer);
    streetLayer.addTo(map);
    document.getElementById("mapTypeButton").textContent = "Ver satélite";
  } else {
    map.removeLayer(streetLayer);
    satelliteLayer.addTo(map);
    document.getElementById("mapTypeButton").textContent = "Ver mapa";
  }

  showingSatellite = !showingSatellite;
});

// Iniciar sesión
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginMessage.textContent = "Iniciando sesión...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "";
  } catch (error) {
    loginMessage.textContent =
      "No se pudo iniciar sesión. Revisa tus datos.";

    console.error(error);
  }
});

// Cerrar sesión
logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

// Verificar sesión
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");

    initializeMap();

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    await loadOddieData();
    await loadHistory();

    clearInterval(refreshInterval);

    refreshInterval = setInterval(() => {
      loadOddieData();
    }, 10000);

  } else {
    clearInterval(refreshInterval);

    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
});

// Comunicación con el servidor
async function apiRequest(url, options = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No hay una sesión iniciada.");
  }

  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Error de comunicación con el servidor."
    );
  }

  return data;
}

async function loadOddieData() {
  try {
    const data = await apiRequest("/api/oddie");

    // Obtener información del GPS
    const estadoGps = data.estadoGps || "Sin información";
    const satelites = data.satelites ?? "--";

    // Estado del GPS en la tarjeta principal
    document.getElementById("gpsStatus").textContent = estadoGps;

    // Cantidad de satélites en la tarjeta principal
    document.getElementById("satellites").textContent = satelites;

    // Estado de conexión de la ESP32
    document.getElementById("deviceStatus").textContent =
      data.deviceConnected
        ? "Dispositivo conectado"
        : "Modo demostración: ESP32 desconectada";

    // Indicador de estado junto al nombre de Oddie
    const gpsBadge = document.getElementById("gpsBadge");

    gpsBadge.textContent = data.deviceConnected
      ? "Dispositivo conectado"
      : "Modo demostración";

    gpsBadge.className = data.deviceConnected
      ? "status online"
      : "status offline";

    // Última actualización
    document.getElementById("lastUpdate").textContent =
      data.lastUpdate
        ? new Date(data.lastUpdate).toLocaleTimeString()
        : "Sin registro";

    // NUEVAS TARJETAS DEL DISEÑO

    document.getElementById("gpsStatusCard").textContent =
      estadoGps;

    document.getElementById("satellitesCard").textContent =
      satelites;

    document.getElementById("deviceStatusCard").textContent =
      data.deviceConnected ? "Conectado" : "Desconectado";

    // Sincronizar interruptor de rastreo
    trackingSwitch.checked = data.rastreoActivo === true;

    // Actualizar ubicación en el mapa
    if (
      data.location?.lat != null &&
      data.location?.lng != null
    ) {
      const position = [
        Number(data.location.lat),
        Number(data.location.lng)
      ];

      if (
        !Number.isFinite(position[0]) ||
        !Number.isFinite(position[1])
      ) {
        throw new Error("Las coordenadas no son válidas.");
      }

      if (!marker) {
        marker = L.marker(position)
          .addTo(map)
          .bindPopup("🐶 Oddie está aquí");
      } else {
        marker.setLatLng(position);
      }

      map.setView(position, 16);

      document.getElementById("locationMessage").textContent =
        `Latitud: ${position[0].toFixed(6)} | Longitud: ${position[1].toFixed(6)}`;

    } else {
      document.getElementById("locationMessage").textContent =
        "Todavía no hay una ubicación GPS válida.";
    }

    document.getElementById("generalMessage").textContent = "";

  } catch (error) {
    console.error(error);

    document.getElementById("generalMessage").textContent =
      "No se pudieron actualizar los datos: " + error.message;
  }
}


// Consultar historial en Firestore a través del servidor
async function loadHistory() {
  historyMessage.textContent = "Cargando historial...";
  historyList.innerHTML = "";

  try {
    const data = await apiRequest("/api/oddie/history");

    const history = data.history || [];

    if (history.length === 0) {
      historyMessage.textContent =
        "Todavía no hay ubicaciones guardadas.";

      return;
    }

    historyMessage.textContent =
      `Se encontraron ${history.length} registros.`;

    history.forEach((location) => {
      const date = location.timestamp
        ? new Date(location.timestamp).toLocaleString()
        : "Fecha desconocida";

      const item = document.createElement("article");
      item.className = "history-item";

      const details = document.createElement("div");

      const dateText = document.createElement("h3");
      dateText.textContent = date;

      const coordinates = document.createElement("p");
      coordinates.textContent =
        `Lat: ${Number(location.lat).toFixed(6)} | Lng: ${Number(location.lng).toFixed(6)}`;

      const source = document.createElement("small");
      source.textContent =
        location.source === "demo"
          ? "Ubicación de demostración"
          : "Ubicación GPS";

      details.append(dateText, coordinates, source);

      const button = document.createElement("button");
      button.textContent = "Ver en mapa";

      button.addEventListener("click", () => {
        const position = [
          Number(location.lat),
          Number(location.lng)
        ];

        map.setView(position, 17);

        if (marker) {
          marker.setLatLng(position);
          marker.openPopup();
        } else {
          marker = L.marker(position)
            .addTo(map)
            .bindPopup("🐶 Oddie estuvo aquí")
            .openPopup();
        }

        document.getElementById("locationMessage").textContent =
          `Ubicación histórica: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}`;
      });

      item.append(details, button);
      historyList.appendChild(item);
    });

  } catch (error) {
    console.error("Error cargando historial:", error);

    historyMessage.textContent =
      "No se pudo cargar el historial: " + error.message;
  }
}

// Actualizar historial manualmente
refreshHistoryButton.addEventListener("click", loadHistory);

// Activar o desactivar rastreo
trackingSwitch.addEventListener("change", async () => {
  const desiredValue = trackingSwitch.checked;

  trackingSwitch.disabled = true;

  try {
    await apiRequest("/api/oddie/tracking", {
      method: "PUT",
      body: JSON.stringify({
        rastreoActivo: desiredValue
      })
    });

    document.getElementById("generalMessage").textContent =
      desiredValue
        ? "Rastreo activado en modo demostración."
        : "Rastreo desactivado en modo demostración.";

  } catch (error) {
    trackingSwitch.checked = !desiredValue;

    document.getElementById("generalMessage").textContent =
      "No se pudo cambiar el rastreo: " + error.message;

  } finally {
    trackingSwitch.disabled = false;
  }
});

// =====================================
// SISTEMA DE ALERTAS - MODO DEMOSTRACIÓN
// =====================================

let gpsTestFailure = false;
let deviceTestFailure = false;

const alertList = document.getElementById("alertList");

function renderAlerts() {
  alertList.innerHTML = "";

  if (!gpsTestFailure && !deviceTestFailure) {
    const item = document.createElement("div");
    item.className = "alert-item alert-info";

    item.innerHTML = `
      <span>ℹ️</span>
      <div>
        <strong>Todo listo para las pruebas</strong>
        <p>No hay fallos simulados. Las alertas reales se activarán al conectar la ESP32.</p>
      </div>
    `;

    alertList.appendChild(item);
    return;
  }

  if (gpsTestFailure) {
    const item = document.createElement("div");
    item.className = "alert-item alert-warning";

    item.innerHTML = `
      <span>⚠️</span>
      <div>
        <strong>GPS sin señal</strong>
        <p>No se están recibiendo coordenadas GPS válidas.</p>
      </div>
    `;

    alertList.appendChild(item);
  }

  if (deviceTestFailure) {
    const item = document.createElement("div");
    item.className = "alert-item alert-danger";

    item.innerHTML = `
      <span>🔴</span>
      <div>
        <strong>Dispositivo desconectado</strong>
        <p>La ESP32 no está enviando información al sistema.</p>
      </div>
    `;

    alertList.appendChild(item);
  }
}

// Simular pérdida de señal GPS
document.getElementById("testGpsButton").addEventListener("click", () => {
  gpsTestFailure = true;
  renderAlerts();
});

// Simular desconexión de la ESP32
document.getElementById("testDeviceButton").addEventListener("click", () => {
  deviceTestFailure = true;
  renderAlerts();
});

// Restablecer las alertas
document.getElementById("resetAlertsButton").addEventListener("click", () => {
  gpsTestFailure = false;
  deviceTestFailure = false;
  renderAlerts();
});

// Mostrar estado inicial
renderAlerts();
