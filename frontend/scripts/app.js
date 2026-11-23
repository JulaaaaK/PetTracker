import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

// =====================================
// ELEMENTOS DE LA PÁGINA
// =====================================

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");
const trackingSwitch = document.getElementById("trackingSwitch");

const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");
const refreshHistoryButton = document.getElementById("refreshHistoryButton");

// Elementos del registro
const showRegisterButton = document.getElementById("showRegisterButton");
const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");
const showLoginButton = document.getElementById("showLoginButton");

let map;
let marker;
let satelliteLayer;
let streetLayer;
let showingSatellite = false;
let refreshInterval;

// =====================================
// MOSTRAR FORMULARIOS
// =====================================

function showRegistrationView() {
  if (loginForm) loginForm.classList.add("hidden");
  if (registerForm) registerForm.classList.remove("hidden");

  if (loginMessage) loginMessage.textContent = "";
  if (registerMessage) registerMessage.textContent = "";
}

function showLoginView() {
  if (registerForm) registerForm.classList.add("hidden");
  if (loginForm) loginForm.classList.remove("hidden");

  if (loginMessage) loginMessage.textContent = "";
  if (registerMessage) registerMessage.textContent = "";
}

if (showRegisterButton) {
  showRegisterButton.addEventListener("click", showRegistrationView);
}

if (showLoginButton) {
  showLoginButton.addEventListener("click", showLoginView);
}

// =====================================
// CREAR MAPA
// =====================================

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

// =====================================
// CAMBIAR MAPA NORMAL Y SATELITAL
// =====================================

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

// =====================================
// INICIAR SESIÓN
// =====================================

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

// =====================================
// REGISTRAR NUEVO USUARIO
// =====================================

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!name || !email || !password || !confirmPassword) {
      registerMessage.textContent = "Completa todos los campos.";
      return;
    }

    if (password.length < 6) {
      registerMessage.textContent =
        "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    if (password !== confirmPassword) {
      registerMessage.textContent =
        "Las contraseñas no coinciden.";
      return;
    }

    registerMessage.textContent = "Creando cuenta...";

    try {
      await createUserWithEmailAndPassword(auth, email, password);

      registerMessage.textContent = "Cuenta creada correctamente.";

      // Firebase inicia la sesión automáticamente.
      // onAuthStateChanged mostrará el panel principal.

    } catch (error) {
      console.error("Error al registrar usuario:", error);

      const messages = {
        "auth/email-already-in-use":
          "Este correo ya tiene una cuenta registrada.",

        "auth/invalid-email":
          "El correo electrónico no es válido.",

        "auth/weak-password":
          "La contraseña es demasiado débil.",

        "auth/operation-not-allowed":
          "El registro por correo no está habilitado en Firebase."
      };

      registerMessage.textContent =
        messages[error.code] ||
        "No se pudo crear la cuenta. Inténtalo nuevamente.";
    }
  });
}

// =====================================
// CERRAR SESIÓN
// =====================================

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

// =====================================
// VERIFICAR SESIÓN
// =====================================

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

    showLoginView();
  }
});

// =====================================
// COMUNICACIÓN CON EL SERVIDOR
// =====================================

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

// =====================================
// CARGAR INFORMACIÓN DE ODDIE
// =====================================

async function loadOddieData() {
  try {
    const data = await apiRequest("/api/oddie");

    // Obtener información del GPS
    const estadoGps = data.estadoGps || "Sin información";
    const satelites = data.satelites ?? "--";

    // Estado del GPS en la tarjeta principal
    document.getElementById("gpsStatus").textContent = estadoGps;

    // Cantidad de satélites
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

    // Tarjetas del diseño
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

// =====================================
// CONSULTAR HISTORIAL EN FIRESTORE
// =====================================

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

// =====================================
// ACTUALIZAR HISTORIAL MANUALMENTE
// =====================================

refreshHistoryButton.addEventListener("click", loadHistory);

// =====================================
// ACTIVAR O DESACTIVAR RASTREO
// =====================================

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
