
import express from "express";
import path from "node:path";
import { authAdmin, db } from "./firebase.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const frontendPath = path.resolve(process.cwd(), "../frontend");
app.use(express.static(frontendPath));

let rastreoActivo = true;

const ubicacionPrueba = {
  lat: 4.6533,
  lng: -74.0836
};

// Verificar que el usuario haya iniciado sesión
async function verifyUser(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No has iniciado sesión."
      });
    }

    const token = authorization.split(" ")[1];
    req.user = await authAdmin.verifyIdToken(token);

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Sesión inválida o expirada."
    });
  }
}

// Guardar una ubicación en Firestore
async function guardarUbicacion(location, source = "demo") {
  await db.collection("ubicaciones_oddie").add({
    lat: location.lat,
    lng: location.lng,
    source: source,
    timestamp: new Date()
  });
}

// Crear un registro de prueba si el historial está vacío
async function prepararHistorial() {
  const historial = await db
    .collection("ubicaciones_oddie")
    .limit(1)
    .get();

  if (historial.empty) {
    await guardarUbicacion(ubicacionPrueba);
    console.log("Primera ubicación de prueba guardada.");
  }
}

// Consultar información actual de Oddie
app.get("/api/oddie", verifyUser, (req, res) => {
  res.json({
    mode: "demo",
    location: ubicacionPrueba,
    gpsStatus: "Ubicación simulada",
    estadoGps: "Ubicación simulada",
    satellites: 8,
    satelites: 8,
    lastUpdate: new Date().toISOString(),
    rastreoActivo: rastreoActivo,
    deviceConnected: false
  });
});

// Activar o desactivar el rastreo
app.put("/api/oddie/tracking", verifyUser, (req, res) => {
  const { rastreoActivo: nuevoEstado } = req.body;

  if (typeof nuevoEstado !== "boolean") {
    return res.status(400).json({
      error: "El estado del rastreo debe ser verdadero o falso."
    });
  }

  rastreoActivo = nuevoEstado;

  res.json({
    success: true,
    rastreoActivo: rastreoActivo,
    mode: "demo"
  });
});

// Consultar las últimas 20 ubicaciones guardadas
app.get("/api/oddie/history", verifyUser, async (req, res) => {
  try {
    const historial = await db
      .collection("ubicaciones_oddie")
      .orderBy("timestamp", "desc")
      .limit(20)
      .get();

    const ubicaciones = historial.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        lat: data.lat,
        lng: data.lng,
        source: data.source,
        timestamp: data.timestamp?.toDate().toISOString()
      };
    });

    res.json({
      success: true,
      history: ubicaciones
    });

  } catch (error) {
    console.error("Error consultando historial:", error);

    res.status(500).json({
      error: "No se pudo consultar el historial."
    });
  }
});

// Registrar una nueva ubicación
app.post("/api/oddie/location", verifyUser, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      return res.status(400).json({
        error: "Las coordenadas no son válidas."
      });
    }

    await guardarUbicacion({ lat, lng }, "demo");

    res.json({
      success: true,
      message: "Ubicación guardada correctamente."
    });

  } catch (error) {
    console.error("Error guardando ubicación:", error);

    res.status(500).json({
      error: "No se pudo guardar la ubicación."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, async () => {
  console.log("--------------------------------");
  console.log("PETTRACKER INICIADO");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log("Modo: DEMOSTRACIÓN");
  console.log("--------------------------------");

  try {
    await prepararHistorial();
  } catch (error) {
    console.error("Error preparando Firestore:", error);
  }
});
