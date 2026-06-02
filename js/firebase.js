// firebase.js — Integración Firebase v10 · Bitácora Ecofit V6
// Auth + Firestore con persistencia offline automática

import { initializeApp }                         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged,
         sendPasswordResetEmail }                 from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, initializeFirestore,
         persistentLocalCache, persistentMultipleTabManager,
         collection, doc,
         getDoc, getDocs, setDoc, updateDoc,
         deleteDoc, query, orderBy }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref as storageRef,
         uploadString, getDownloadURL }           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── Configuración ──────────────────────────────────────────────────────────
const FB_CONFIG = {
  apiKey:            "AIzaSyDr9HusoUWZ1GK6G_57FMqDLoVWzN1QJfE",
  authDomain:        "ecofit-bitacora.firebaseapp.com",
  projectId:         "ecofit-bitacora",
  storageBucket:     "ecofit-bitacora.firebasestorage.app",
  messagingSenderId: "842019948169",
  appId:             "1:842019948169:web:608bd4c63ce20f7f7ba858",
};

const _app = initializeApp(FB_CONFIG);
export const fbAuth = getAuth(_app);
export const fbDB   = initializeFirestore(_app, {
  cache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const _storage = getStorage(_app);

// ── Subir foto a Firebase Storage ─────────────────────────────────────────
export async function uploadPhoto(base64DataUrl, path) {
  if (!navigator.onLine) {
    const err = new Error('Sin conexión — conéctate a internet e intenta de nuevo');
    err.code = 'offline';
    throw err;
  }
  const sRef = storageRef(_storage, path);
  await uploadString(sRef, base64DataUrl, 'data_url');
  return getDownloadURL(sRef);
}

// ── Username → email interno ───────────────────────────────────────────────
// Los usuarios entran con "username", internamente usamos username@ecofit.app
export const toEmail = u => `${u.toLowerCase().trim()}@ecofit.app`;

// ── Crear usuario en Firebase Auth SIN cerrar sesión actual (REST API) ─────
// realEmail opcional: si se proporciona, se usa como email real de Firebase Auth
export async function createFbUser(username, password, realEmail) {
  const authEmail = realEmail?.trim() || toEmail(username);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password, returnSecureToken: false }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { uid: data.localId, authEmail };
}

// ── Reset de contraseña por email ─────────────────────────────────────────
export async function resetPassword(authEmail) {
  await sendPasswordResetEmail(fbAuth, authEmail);
}

// ── Seed: crear admin si no existe ningún usuario ──────────────────────────
export async function seedAdminIfEmpty() {
  try {
    const snap = await getDocs(collection(fbDB, 'users'));
    if (!snap.empty) return; // Ya hay usuarios

    const { uid, authEmail } = await createFbUser('admin', 'ecofit2024');
    await setDoc(doc(fbDB, 'users', uid), {
      id: uid, username: 'admin', nombre: 'Administrador',
      rol: 'admin', activo: true, authEmail, createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[FB] seedAdmin:', err.message);
  }
}

// ── Proyectos ──────────────────────────────────────────────────────────────
export const fbProjects = {
  getAll: async () => {
    const snap = await getDocs(collection(fbDB, 'projects'));
    return snap.docs.map(d => d.data());
  },

  getById: async (id) => {
    const snap = await getDoc(doc(fbDB, 'projects', id));
    return snap.exists() ? snap.data() : null;
  },

  add: async (data) => {
    await setDoc(doc(fbDB, 'projects', data.id), data);
  },

  update: async (id, changes) => {
    const ref  = doc(fbDB, 'projects', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Proyecto no encontrado');
    const updated = { ...snap.data(), ...changes, updatedAt: new Date().toISOString() };
    await setDoc(ref, updated);
    return updated;
  },

  delete: async (id) => {
    await deleteDoc(doc(fbDB, 'projects', id));
  },

  search: async (q) => {
    const all = await fbProjects.getAll();
    const ql  = q.toLowerCase();
    return all.filter(p =>
      p.displayId?.toLowerCase().includes(ql)  ||
      p.clientName?.toLowerCase().includes(ql) ||
      p.direccion?.toLowerCase().includes(ql)  ||
      p.garantia?.equipos?.some(e => e.serial?.toLowerCase().includes(ql))
    );
  },
};

// ── Usuarios (perfiles en Firestore) ──────────────────────────────────────
export const fbUsers = {
  getAll: async () => {
    const snap = await getDocs(collection(fbDB, 'users'));
    return snap.docs.map(d => d.data());
  },

  getById: async (id) => {
    const snap = await getDoc(doc(fbDB, 'users', id));
    return snap.exists() ? snap.data() : null;
  },

  getByUsername: async (username) => {
    const all = await fbUsers.getAll();
    return all.find(u => u.username === username.toLowerCase().trim()) || null;
  },

  add: async (data) => {
    await setDoc(doc(fbDB, 'users', data.id), data);
  },

  update: async (id, changes) => {
    const ref  = doc(fbDB, 'users', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Usuario no encontrado');
    await setDoc(ref, { ...snap.data(), ...changes });
  },

  delete: async (id) => {
    await deleteDoc(doc(fbDB, 'users', id));
  },
};

// ── Config ─────────────────────────────────────────────────────────────────
export const fbConfig = {
  get: async (key) => {
    const snap = await getDoc(doc(fbDB, 'config', key));
    return snap.exists() ? snap.data().value : null;
  },
  set: async (key, value) => {
    await setDoc(doc(fbDB, 'config', key), { value });
  },
  delete: async (key) => {
    await deleteDoc(doc(fbDB, 'config', key));
  },
};

// ── KV store ───────────────────────────────────────────────────────────────
export const fbKV = {
  get: async (key) => {
    const snap = await getDoc(doc(fbDB, 'kv', key));
    return snap.exists() ? snap.data().value : null;
  },
  set: async (key, value) => {
    await setDoc(doc(fbDB, 'kv', key), { value });
  },
  inc: async (key, start = 1) => {
    const snap = await getDoc(doc(fbDB, 'kv', key));
    const next = (snap.exists() ? snap.data().value : start - 1) + 1;
    await setDoc(doc(fbDB, 'kv', key), { value: next });
    return next;
  },
};

// ── Backup completo ────────────────────────────────────────────────────────
export async function exportFbBackup() {
  const [projs, usrs] = await Promise.all([fbProjects.getAll(), fbUsers.getAll()]);
  return {
    version: 6, exportedAt: new Date().toISOString(),
    projects: projs, users: usrs,
  };
}
