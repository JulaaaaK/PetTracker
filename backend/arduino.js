
const BASE_URL = "https://api2.arduino.cc/iot";

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.ARDUINO_CLIENT_ID,
    client_secret: process.env.ARDUINO_CLIENT_SECRET,
    audience: "https://api2.arduino.cc/iot"
  });

  const response = await fetch(`${BASE_URL}/v1/clients/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("No fue posible autenticar con Arduino Cloud.");
  }

  const data = await response.json();

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

async function arduinoRequest(path, options = {}) {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Arduino Cloud (${response.status}): ${detail}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export async function getOddieData() {
  const thingId = process.env.ARDUINO_THING_ID;

  const properties = await arduinoRequest(
    `/v2/things/${thingId}/properties`
  );

  const list = Array.isArray(properties)
    ? properties
    : properties.data || properties.properties || [];

  const findProperty = (variableName) =>
    list.find((item) =>
      item.variable_name === variableName ||
      item.name === variableName
    );

  const readValue = (property) => {
    if (!property) return null;

    const last = property.last_value;

    if (last && typeof last === "object" && "value" in last) {
      return last.value;
    }

    return last ?? property.value ?? null;
  };

  const locationProperty = findProperty("ubicacion");
  const gpsProperty = findProperty("estadoGps") ||
                      findProperty("estadoGPS");
  const satellitesProperty = findProperty("satelites");
  const trackingProperty = findProperty("rastreoActivo");

  const locationValue = readValue(locationProperty);

  let location = null;

  if (locationValue && typeof locationValue === "object") {
    const lat = locationValue.lat ?? locationValue.latitude;
    const lng = locationValue.lng ?? locationValue.lon ??
                locationValue.longitude;

    if (lat != null && lng != null) {
      location = { lat: Number(lat), lng: Number(lng) };
    }
  }

  return {
    location,
    estadoGps: readValue(gpsProperty),
    satelites: readValue(satellitesProperty),
    rastreoActivo: readValue(trackingProperty),
    updatedAt: locationProperty?.last_value?.updated_at || null
  };
}

export async function setTracking(value) {
  const thingId = process.env.ARDUINO_THING_ID;

  const properties = await arduinoRequest(
    `/v2/things/${thingId}/properties`
  );

  const list = Array.isArray(properties)
    ? properties
    : properties.data || properties.properties || [];

  const tracking = list.find((item) =>
    item.variable_name === "rastreoActivo" ||
    item.name === "rastreoActivo"
  );

  if (!tracking?.id) {
    throw new Error("No se encontró la propiedad rastreoActivo.");
  }

  return arduinoRequest(
    `/v2/things/${thingId}/properties/${tracking.id}`,
    {
      method: "PUT",
      body: JSON.stringify({ value })
    }
  );
}
