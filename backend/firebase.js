
import "dotenv/config";

import {
  initializeApp,
  cert,
  getApps
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import fs from "node:fs";
import path from "node:path";

const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    `No se encontró el archivo de Firebase: ${serviceAccountPath}`
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount)
    });

const authAdmin = getAuth(app);
const db = getFirestore(app);

export { authAdmin, db };
