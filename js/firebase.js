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

// ── Subir foto con cola offline ────────────────────────────────────────────
// op / opArgs: describen cómo actualizar Firestore al completar el sync.
// Retorna { url, pending, pendingId }
export async function uploadPhotoQueued(base64DataUrl, path, projectId, op, opArgs = {}) {
  if (navigator.onLine) {
    const url = await uploadPhoto(base64DataUrl, path);
    return { url, pending: false, pendingId: null };
  }

  // Sin internet → guardar en cola
  const { enqueuePhoto } = await import('./photo-queue.js');
  const { uuid } = await import('./utils.js');
  const pendingId = uuid();
  await enqueuePhoto({
    id: pendingId,
    projectId,
    storagePath: path,
    base64: base64DataUrl,
    createdAt: new Date().toISOString(),
    op,
    opArgs,
  });
  return { url: null, pending: true, pendingId };
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
// Contraseña generada aleatoriamente — se imprime UNA SOLA VEZ en consola.
// El administrador debe cambiarla desde Firebase Authentication Console
// o desde Ajustes > Cambiar contraseña inmediatamente después del primer login.
function _genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  arr.forEach(n => { pwd += chars[n % chars.length]; });
  return pwd;
}

export async function seedAdminIfEmpty() {
  try {
    const snap = await getDocs(collection(fbDB, 'users'));
    if (!snap.empty) return; // Ya hay usuarios

    const tempPwd = _genTempPassword();
    const { uid, authEmail } = await createFbUser('admin', tempPwd);
    await setDoc(doc(fbDB, 'users', uid), {
      id: uid, username: 'admin', nombre: 'Administrador',
      rol: 'admin', activo: true, authEmail, createdAt: new Date().toISOString(),
    });
    // ⚠️ Mostrar solo en consola — nunca en la UI
    console.warn(
      '%c[Ecofit] Admin creado. Contraseña temporal (cámbiala YA):',
      'color:orange;font-weight:bold', tempPwd
    );
  } catch (err) {
    console.warn('[FB] seedAdmin:', err.message);
  }
}

// ── Helper: notifica errores de escritura sin acoplar toast ───────────────
function _dispatchWriteError(label, err) {
  let msg;
  if (err?.code === 'permission-denied') {
    msg = `${label}: sin permiso. Verifica que tu sesión esté activa.`;
  } else if (err?.code === 'not-found') {
    msg = `${label}: documento no encontrado.`;
  } else if (err?.code === 'unavailable') {
    msg = `${label}: sin conexión. El cambio se guardará al reconectarse.`;
  } else {
    msg = `${label}. ${err?.message || 'Error desconocido'}`.trim();
  }
  // app.js escucha este evento y muestra toast — sin acoplamiento circular
  window.dispatchEvent(new CustomEvent('ecofit:write-error', { detail: { msg } }));
  console.error('[FB write]', label, err);
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
    try {
      await setDoc(doc(fbDB, 'projects', data.id), data);
    } catch (err) {
      _dispatchWriteError('Error al crear proyecto', err);
      throw err;
    }
  },

  update: async (id, changes) => {
    const ref  = doc(fbDB, 'projects', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Proyecto no encontrado');
    const updated = { ...snap.data(), ...changes, updatedAt: new Date().toISOString() };
    try {
      await setDoc(ref, updated);
    } catch (err) {
      _dispatchWriteError('Error al guardar proyecto', err);
      throw err;
    }
    return updated;
  },

  delete: async (id) => {
    try {
      await deleteDoc(doc(fbDB, 'projects', id));
    } catch (err) {
      _dispatchWriteError('Error al eliminar proyecto', err);
      throw err;
    }
  },

  // Actualización atómica de un campo anidado sin read-modify-write
  // path: ej. 'checklistData.herr.herr-001'
  setField: async (id, path, value) => {
    try {
      await updateDoc(doc(fbDB, 'projects', id), { [path]: value });
    } catch (err) {
      _dispatchWriteError('Error al guardar campo', err);
      throw err;
    }
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

// ── Recordatorios rápidos ─────────────────────────────────────────────────
export const fbReminders = {
  getAll: async () => {
    const snap = await getDocs(query(collection(fbDB, 'reminders'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => d.data());
  },

  add: async (data) => {
    await setDoc(doc(fbDB, 'reminders', data.id), data);
  },

  update: async (id, changes) => {
    const ref  = doc(fbDB, 'reminders', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Recordatorio no encontrado');
    await setDoc(ref, { ...snap.data(), ...changes });
  },

  complete: async (id, byName) => {
    const ref  = doc(fbDB, 'reminders', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Recordatorio no encontrado');
    await setDoc(ref, { ...snap.data(), completado: true, completadoAt: new Date().toISOString(), completadoPor: byName || null });
  },

  delete: async (id) => {
    await deleteDoc(doc(fbDB, 'reminders', id));
  },
};

// ── Errores de runtime (write-only para usuarios, read para admin) ─────────
export const fbErrors = {
  add: async (data) => {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await setDoc(doc(fbDB, 'errors', id), data);
  },
};

// ── Backup completo ────────────────────────────────────────────────────────
export async function exportFbBackup() {
  const [projs, usrs, cfgSnap, kvSnap] = await Promise.all([
    fbProjects.getAll(),
    fbUsers.getAll(),
    getDocs(collection(fbDB, 'config')),
    getDocs(collection(fbDB, 'kv')),
  ]);
  const cfg = {};
  cfgSnap.docs.forEach(d => { cfg[d.id] = d.data().value; });
  const kv = {};
  kvSnap.docs.forEach(d => {
    if (d.id !== 'onedrive_folder_handle') kv[d.id] = d.data().value;
  });
  return {
    version: 6, exportedAt: new Date().toISOString(),
    projects: projs, users: usrs, config: cfg, kv,
  };
}
