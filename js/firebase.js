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

// ── Generar miniatura (400px, quality 0.55) desde data URL ────────────────
function _makeThumb(dataUrl, maxDim = 400, quality = 0.55) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else                { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Evita que una subida en red muy lenta/intermitente bloquee indefinidamente
// la cola de fotos — el timeout se trata como cualquier otro error de subida,
// así uploadPhotoQueued cae a la cola offline en vez de colgarse.
const UPLOAD_TIMEOUT_MS = 20000;
function _withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`${label} excedió ${ms / 1000}s — red muy lenta`);
      err.code = 'timeout';
      reject(err);
    }, ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ── Subir foto a Firebase Storage ─────────────────────────────────────────
export async function uploadPhoto(base64DataUrl, path) {
  if (!navigator.onLine) {
    const err = new Error('Sin conexión — conéctate a internet e intenta de nuevo');
    err.code = 'offline';
    throw err;
  }
  const sRef = storageRef(_storage, path);
  await _withTimeout(uploadString(sRef, base64DataUrl, 'data_url'), UPLOAD_TIMEOUT_MS, 'Subida de foto');
  const url = await _withTimeout(getDownloadURL(sRef), UPLOAD_TIMEOUT_MS, 'Obtener URL de foto');

  // Subir miniatura fire-and-forget (no bloquea el flujo principal)
  _makeThumb(base64DataUrl).then(async thumbB64 => {
    if (!thumbB64) return;
    const thumbPath = path.replace(/(\.\w{2,5})$/, '_t$1');
    const tRef = storageRef(_storage, thumbPath);
    await uploadString(tRef, thumbB64, 'data_url');
  }).catch(() => {});

  return url;
}

// ── Subir foto con cola offline ────────────────────────────────────────────
// op / opArgs: describen cómo actualizar Firestore al completar el sync.
// Retorna { url, pending, pendingId }
//
// navigator.onLine solo refleja la interfaz de red del sistema, no si Firebase
// es realmente alcanzable — en campo (señal mala/intermitente) es común que
// reporte true mientras la subida real falla. Por eso intentamos subir directo
// y, si falla por CUALQUIER motivo (no solo offline real), caemos a la cola en
// vez de perder la foto.
export async function uploadPhotoQueued(base64DataUrl, path, projectId, op, opArgs = {}) {
  if (navigator.onLine) {
    try {
      const url = await uploadPhoto(base64DataUrl, path);
      return { url, pending: false, pendingId: null };
    } catch (err) {
      console.warn('[uploadPhotoQueued] Subida directa falló, se encola:', err.message);
    }
  }

  // Sin internet o falló la subida directa → guardar en cola
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

// ── Schema versioning ─────────────────────────────────────────────────────
// Bump cuando el formato del documento cambia. Los docs antiguos (sin _v o
// con _v < SCHEMA_VERSION) se migran al leerlos y se reescriben en Firestore.
const SCHEMA_VERSION = 3;

function _migrateProject(data) {
  if ((data._v || 0) >= SCHEMA_VERSION) return data;

  const lev = data.documentacion?.levantamiento;
  if (lev && (data._v || 0) < 1) {
    // v0→v1: areasTecho.fotos {antes,durante,cierre} → array plano
    if (Array.isArray(lev.areasTecho)) {
      lev.areasTecho = lev.areasTecho.map(a => {
        if (!Array.isArray(a.fotos) && a.fotos && typeof a.fotos === 'object') {
          return { ...a, fotos: [...(a.fotos.antes||[]), ...(a.fotos.durante||[]), ...(a.fotos.cierre||[])] };
        }
        return a;
      });
    }
    // v0→v1: cargasRespaldo → cargasCriticas (campo renombrado en tipo 'respaldo')
    if (lev.cargasRespaldo && !lev.cargasCriticas) {
      lev.cargasCriticas = lev.cargasRespaldo;
      delete lev.cargasRespaldo;
    }
  }
  if (lev && (data._v || 0) < 2) {
    // v1→v2: tipo de techo 'Metálico' renombrado a 'Carport' (sitio + áreas)
    if (lev.tipTecho === 'Metálico') lev.tipTecho = 'Carport';
    if (Array.isArray(lev.areasTecho)) {
      lev.areasTecho = lev.areasTecho.map(a =>
        a.tipTecho === 'Metálico' ? { ...a, tipTecho: 'Carport' } : a);
    }
  }
  if (lev && (data._v || 0) < 3) {
    // v2→v3: "Voltajes medidos" pasó de 3 campos genéricos a un desglose por
    // tipo de servicio CFE (líneas L1/L2/L3) — se mapean los valores viejos.
    if (lev.voltajeFaseFase != null && lev.voltajeFaseFaseL1L2 == null) lev.voltajeFaseFaseL1L2 = lev.voltajeFaseFase;
    if (lev.voltajeFaseNeutro != null && lev.voltajeFaseNeutroL1 == null) lev.voltajeFaseNeutroL1 = lev.voltajeFaseNeutro;
    if (lev.voltajeFaseTierra != null && lev.voltajeNeutroTierra == null) lev.voltajeNeutroTierra = lev.voltajeFaseTierra;
    delete lev.voltajeFaseFase;
    delete lev.voltajeFaseNeutro;
    delete lev.voltajeFaseTierra;
  }

  return { ...data, _v: SCHEMA_VERSION };
}

// ── Proyectos ──────────────────────────────────────────────────────────────
export const fbProjects = {
  getAll: async () => {
    const snap = await getDocs(collection(fbDB, 'projects'));
    return snap.docs.map(d => {
      const data = d.data();
      if ((data._v || 0) < SCHEMA_VERSION) {
        // Aislado por proyecto: si uno solo tiene una estructura vieja/inesperada
        // que rompe la migración, no debe tumbar la lista completa — se muestra
        // sin migrar en vez de desaparecer junto con todos los demás.
        try {
          const migrated = _migrateProject(data);
          setDoc(doc(fbDB, 'projects', data.id), migrated).catch(() => {});
          return migrated;
        } catch (err) {
          console.error('[getAll] Error migrando proyecto', data.id, err);
          return data;
        }
      }
      return data;
    });
  },

  getById: async (id) => {
    const snap = await getDoc(doc(fbDB, 'projects', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if ((data._v || 0) < SCHEMA_VERSION) {
      const migrated = _migrateProject(data);
      setDoc(doc(fbDB, 'projects', id), migrated).catch(() => {});
      return migrated;
    }
    return data;
  },

  add: async (data) => {
    try {
      await setDoc(doc(fbDB, 'projects', data.id), { ...data, _v: SCHEMA_VERSION });
    } catch (err) {
      _dispatchWriteError('Error al crear proyecto', err);
      throw err;
    }
  },

  update: async (id, changes) => {
    const ref  = doc(fbDB, 'projects', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Proyecto no encontrado');
    const updated = { ...snap.data(), ...changes, _v: SCHEMA_VERSION, updatedAt: new Date().toISOString() };
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
