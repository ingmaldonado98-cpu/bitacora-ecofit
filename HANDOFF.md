# HANDOFF.md — Estado de la Bitácora Ecofit V6

> Corte: **2026-10-18**. Último deploy: commit `5e9be99`, publicado el 2026-10-18 en **los dos** hostings (Firebase Hosting y GitHub Pages), verificado con curl. Actualiza este archivo en cada sesión que cambie el estado.
> Los datos salen del código, del `git log` y de las notas de sesiones anteriores. Lo que no se pudo verificar dice **⚠️ PENDIENTE DE CONFIRMAR**.
> **Todos los proyectos que hay hoy en Firestore y en los celulares son de prueba y NO se conservan** (decisión del dueño, 2026-10-17). La operación real arranca desde cero, así que hoy se pueden borrar datos, cambiar de dominio o migrar el almacenamiento sin riesgo.

## 1. Versiones actuales
| Qué | Valor | Dónde |
|---|---|---|
| Caché del service worker | `CACHE_NAME = 'ecofit-v6-v233'`, `SW_VERSION = '6.85.40'`, `BUILD_DATE = '2026-10-18'` | `sw.js` (lo sube `bump-sw.yml`) |
| Caché de fotos del SW | `ecofit-photos-v1`, máx. 300 entradas | `sw.js` |
| `APP_VERSION` del reporte de errores | `'6.61.0'` — **desactualizado** respecto al SW | `js/app.js` |
| `package.json` | `6.0.0` (nadie lo sube) | `package.json` |
| Esquema del documento proyecto | `SCHEMA_VERSION = 3` | `js/firebase.js` |
| Formato de backup JSON | `BACKUP_VERSION = 6` | `js/firebase.js` |
| IndexedDB cola de fotos | `ecofit-photo-queue` v1 | `js/photo-queue.js` |
| IndexedDB OneDrive | `ecofit-od` v1 | `js/onedrive.js` |
| Firebase SDK | 10.12.0 (vendorizado) | `js/vendor/` |
| Android Capacitor | `versionCode 15` / `2.4` commiteado. En el repo padre hay un cambio **sin commitear** a `16` / `2.5` | `claude code/android/app/build.gradle` |
| Android TWA (Bubblewrap) | `appVersionCode 4` | `C:\Users\maldo\twa-manifest.json` |
| Tests | `npm test`: 41 pasan, 0 fallan (corrido 2026-10-17) | `tests/voc.test.js` |

## 2. Qué funciona y se usa en campo
⚠️ **PENDIENTE DE CONFIRMAR con el equipo** qué módulos se usan a diario. El historial no lo registra. Lo que sí consta:
- Las notas de sesión dicen que se probó en un navegador real: el flujo de Ampliación y la auditoría UX completa (2026-08-10). El usuario confirmó la cámara y la barra de Chrome del TWA (2026-06-24).
- Implementado y en producción según el código: proyectos con estados y roles, levantamiento por tipo, Progreso de obra por bloques con fotos de cierre, Garantía (equipos, seriales, carga masiva por escáner, estructura, validación Voc/Isc por equipo), auditoría, firmas por fase, observaciones, PDF/Word, QR público, inventario, calculadora BOM, dimensionamiento, recordatorios, mapa, backup JSON y copia a OneDrive.
- Offline: caché local de proyectos, colas de escrituras y de fotos con reintentos, Background Sync, persistencia de Firestore (arreglada en `0448b15`, 2026-08-13: antes **no** persistía), sesión offline de 7 días y aviso de conflictos.

## 3. Bugs conocidos (de mayor a menor gravedad)
1. ✅ **Arreglado y publicado (2026-10-18): el escáner web no funcionaba desde 2026-08-11.** `ecofit-scanner.html` carga `./js/vendor/zxing.min.js`, y ese archivo se había borrado en `20f2f77` por error. Se restauró desde git y se agregó a `APP_SHELL`; se comprobó que `window.ZXing` carga en localhost. Falta probar la cámara en un celular después del deploy.
2. ✅ **Arreglado y publicado (2026-10-18): ruta de fotos en Storage.** Desde `91cc2ac`, `buildFotoPath()` subía a `proyectos/…`, pero `storage.rules` solo permite `projects/{projectId}/…`. Ahora usa `projects/{id}/bitacora_{fecha}/…`. ⚠️ PENDIENTE DE CONFIRMAR que las reglas publicadas en Firebase Console coincidan con las del repo. Ojo: algunas fotos se suben con un projectId temporal (`equipo_temp`, `levantamiento_temp`, `temp_…`) y para un usuario **apoyo** `isAssignedToProject()` falla, porque ese proyecto no existe. Hay que probarlo con una cuenta apoyo.
3. **Las reglas de Firestore de `9bea123` (2026-08-10) no estaban publicadas** al hacer el commit (corrigen permisos de kv para apoyo, auditoría, `usernameIndex` y `publicCards`). ⚠️ PENDIENTE DE CONFIRMAR si ya se publicaron. Sin ellas, la captura de inventario de un apoyo nunca llega al servidor. Se publican con `npx firebase-tools deploy --only firestore:rules --project ecofit-bitacora` desde `claude code/`.
4. ✅ **Arreglado y publicado (2026-10-18): a `APP_SHELL` le faltaban** `ui-states.js`, `calc-tablero.js`, `pdf-avance.js`, `pdf-calculadora.js` y `pdf-garantia.js`. Ahora el check "Verify APP_SHELL completeness" del CI pasa en local.
5. **Firebase Hosting no tiene CI**, así que puede quedarse atrás de GitHub Pages. Después de cada push a `main` hay que esperar el bump del bot, hacer `git pull` y `firebase deploy` a mano (ver CLAUDE.md §10). El 2026-10-18 los dos sirven v233. **Gotcha arreglado ese día:** `firebase.json` publicaba `.git/` y `.github/` porque `**/.*` no excluye su contenido; ahora hay exclusiones explícitas. Si agregas carpetas ocultas, verifica con `curl` que den 404.
6. **"Limpiar datos"** (`settings-backup.js` → `limpiarDatos`) borra la IndexedDB `ecofit-photo-queue`: las fotos que no se han subido **se pierden**. Hay doble confirmación, pero no avisa de esto.
7. En nativo, si el plugin `BarcodeScanner` no existe, `_openNativeScannerOverlay` vuelve a llamar a `openScannerOverlay` y esta lo manda de nuevo a la ruta nativa: **recursión infinita** (`util-scanner.js`).
8. La pantalla de exportar dice que el PDF Cliente incluye "QR del sistema", pero `pdf-cliente.js` no lo agrega.
9. Web: si `localStorage` se llena (~5 MB), `local-store.js` falla **sin avisar**. Queda la caché de Firestore, pero la caché local de proyectos deja de actualizarse.
10. Conflictos: la regla es "gana la última escritura", con un toast que avisa. No hay merge.
11. `kv.inc` sin conexión puede generar contadores duplicados. Solo afecta el ID legado `EFS-`, que ya no se usa.
12. Las fuentes DM Sans/DM Serif se descargan pero casi no se usan (peso extra en la carga).

## 4. Qué está a medias
- **Push notifications:** el cliente ya registra `fcmToken` (`app.js` → `_initPushAndroid`). La función `onProjectAssigned` (`claude code/functions/index.js`) está terminada **pero sin publicar**: requiere el plan Blaze y el dueño decidió no activarlo por ahora.
- **Migración a Firebase Hosting** (empezó 2026-08-12): el TWA ya apunta a `ecofit-bitacora.web.app`, pero GitHub Pages sigue activo y publicando.
- **Respaldo en Drive:** en V6 no hay código de Google Drive. El tag `sync-drive` de `sw.js` (`syncDrive()`) está vacío y `driveSynced`/`syncBadge` existen pero nunca se ponen en `true`. Lo que funciona hoy es la copia en una carpeta **OneDrive** local (File System Access API, `onedrive.js`), solo en escritorio Chrome/Edge. La versión vieja `claude code/bitacora-ecofit/js/drive.js` sí tenía integración con Drive.
- **Stash sin aplicar** `stash@{0}` (2026-07-09, "alerta datos obsoletos + export cola JSON + lazy load jsPDF"), 10 archivos. Probablemente ya se integró en `98fdaf4`/`c90b064`. ⚠️ PENDIENTE DE CONFIRMAR antes de borrarlo.
- **Dos apps Android en paralelo** (TWA Bubblewrap y Capacitor) con el mismo paquete y la misma firma. ⚠️ PENDIENTE DE CONFIRMAR cuál se instala hoy en los celulares de los técnicos.
- "Pendiente B" (2026-06-24): un problema de CSS en fotos y mapa, esperando video o fotos del usuario. ⚠️ PENDIENTE DE CONFIRMAR si sigue.

## 5. Decisiones y por qué
- **Almacenamiento local:** ⚠️ **lo que dice el prompt de traspaso no coincide con el código.** No hay una IndexedDB principal. Desde `397bb13` (2026-07-04) los proyectos se guardan como JSON en Capacitor Filesystem (nativo) o en `localStorage` (web), y las **fotos van en IndexedDB como Blob** (`ecofit-photo-queue`), justo para no meterlas en `localStorage` por su límite. Firestore guarda su propia copia en IndexedDB. ⚠️ PENDIENTE DE CONFIRMAR si se quiere mover los proyectos web a IndexedDB (ver riesgo #3).
- **Fotos en Storage y solo la URL en Firestore** (nunca base64): por el límite de 1 MB por documento.
- **Compresión 1920 px / 0.75** (`91cc2ac` subió de 1000/0.68 a 1920/0.80 "para preservar detalle técnico"; `0448b15` la bajó a 0.75 para quedar en 300–400 KB). ⚠️ El prompt pide 1280/0.72: PENDIENTE DE CONFIRMAR.
- **Firebase Hosting en vez de GitHub Pages:** Firebase ya era el backend. Con Hosting la app queda en la raíz del dominio y `.well-known/assetlinks.json` funciona sin el truco del repo `ingmaldonado98-cpu.github.io` (necesario para quitar la barra de Chrome en el TWA). Netlify se descontinuó.
- **SDK de Firebase vendorizado** (`406efe0`): sin eso la app Android no arrancaba sin internet (gstatic.com).
- **ZXing local con la cámara** (`997cfb1`), en vez de un lector externo: funciona offline y trae entrada manual de respaldo. En Android nativo se usa **ML Kit** porque el WebView de Capacitor no muestra el permiso de cámara dentro de un iframe. ⚠️ No hay registro de que se evaluara un lector Bluetooth/USB: PENDIENTE DE CONFIRMAR.
- **Drive/OneDrive solo como respaldo documental** de los PDF/Word, nunca como base de datos. El handle de carpeta va en IndexedDB porque no se puede serializar.
- **Arquitectura modular sin bundler:** deploy directo de archivos estáticos. Archivos chicos por responsabilidad (`utils.js` es un barrel, `modules/` son funciones puras con tests). docx y jsPDF se cargan lazy (`20f2f77` midió unos 950 KB en el arranque antes del cambio).
- **Reglas con override total para admin:** es la válvula de escape para casos atípicos; líder y apoyo pasan por la máquina de estados.
- **Sin plan Blaze:** decisión de costo del dueño. Por eso no hay Cloud Functions ni push.
- **El badge in-app en vez de push**, el `statusLog` solo-append, las observaciones nunca ocultas y los modales propios vienen de las notas de sesión.
- **Fechas-calendario en UTC** (`util-fmt.js`): así México no muestra el día anterior.
- **Proceso que funcionó:** listar hallazgos por prioridad → implementarlos en orden → verificarlos en el navegador real → escribir commits largos (el `git log` es la documentación).

## 6. Roadmap / pendientes
1. Arreglar los bugs #1–#4 de arriba (escáner, ruta de Storage, publicar reglas, `APP_SHELL`).
2. ✅ (publicado 2026-10-18) `CLAUDE.md`, `HANDOFF.md`, las reglas, `tests/`, `scripts/` y `package.json` ya no se publican: se excluyen en `pages.yml` y en el `ignore` de `claude code/firebase.json`.
3. Decidir un solo hosting y apagar GitHub Pages, o automatizar el deploy a Firebase desde Actions.
4. Respaldo diferido en Google Drive (fotos/PDF): no existe en V6. ⚠️ PENDIENTE DE CONFIRMAR alcance y prioridad.
5. "Integración con la app Inventario": hoy el inventario vive **dentro** de esta app y la calculadora descuenta stock. ⚠️ PENDIENTE DE CONFIRMAR si hay otra app Inventario que integrar (existe `bitacora-ecofit/inventario-almacen.html`, aparte).
6. Calculadora: ya está en `modules/calculadora/` y `js/calc-*.js`. ⚠️ PENDIENTE DE CONFIRMAR qué falta. También existe el proyecto aparte `claude code/calculadora de cables y conduit/`.
7. Push: publicar `functions/` cuando haya plan Blaze.
8. Ideas anotadas 2026-06-06 y no encontradas en el código: múltiples propuestas por proyecto y una propuesta independiente que se vincula después. ⚠️ PENDIENTE DE CONFIRMAR si siguen vigentes.
9. Corregir `APP_VERSION` para que salga de `SW_VERSION`. Avisar en "Limpiar datos" cuando haya fotos pendientes.

## 7. Riesgos: qué sería lo más grave romper
1. **Perder fotos que no se han subido.** Viven solo en la IndexedDB del celular donde se tomaron. Nunca borres ni recrees `ecofit-photo-queue`, nunca cambies el origen y prueba cualquier cambio en `photo-queue.js` en modo avión con fotos reales en la cola.
2. **Cambiar el dominio o el proyecto Firebase.** Los datos locales están atados al origen. Hoy los técnicos pueden estar en **dos orígenes** (web.app vía TWA y github.io si instalaron la PWA desde ahí). Antes de apagar GitHub Pages, confirma que cada celular se sincronizó (sin colas pendientes).
3. **Cuota de `localStorage` en web:** con muchos proyectos activos se acerca a ~5 MB y falla sin avisar. Vigílalo antes de agregar campos grandes al proyecto.
4. **Un deploy sin bump del SW o con un archivo fuera de `APP_SHELL`:** el técnico se queda con la versión vieja o la app no carga offline. Revisa que el CI esté en verde.
5. **Cambiar `TRANSITIONS` o el modelo de roles sin tocar `firestore.rules`** (o al revés): las escrituras se rechazan y se van a la dead-letter.
6. **Publicar reglas sin probarlas:** puede dejar a todos los técnicos sin escribir. Publícalas fuera de horario de obra y con el dueño enterado.

## 8. Checklist de traspaso
**Firebase (proyecto `ecofit-bitacora`):**
- [ ] Console → Configuración del proyecto → **Usuarios y permisos**: agregar al nuevo responsable como **Propietario**.
- [ ] Revisar el **plan de facturación** (hoy Spark; Blaze solo si se aprueban Functions/push) y quién es el titular de la cuenta de facturación.
- [ ] Que el nuevo responsable haga `npx firebase-tools login` y un `deploy --only hosting` de prueba **antes** de quitar al dueño anterior.
- [ ] Exportar las reglas publicadas de Firestore y Storage y compararlas con las del repo (bugs #2 y #3).
- [ ] Opcional: en Google Cloud Console, restringir la `apiKey` web por referrer HTTP (`ecofit-bitacora.web.app`, `ingmaldonado98-cpu.github.io`, `localhost`).
- [ ] Revisar quién es `admin` en la colección `users` y que el nuevo responsable tenga una cuenta admin en la app.

**GitHub:** acceso de administración a `ingmaldonado98-cpu/bitacora-ecofit` (Pages y Actions) y a `ingmaldonado98-cpu/bitacora-ecofit-android` (wrapper, `firebase.json`, `.firebaserc`, `functions/`).

**Android:** el keystore de firma (`C:\Users\maldo\android.keystore`, alias `android`) y su contraseña se entregan **por un canal seguro, fuera del repo**. Sin ellos no se pueden publicar actualizaciones con el mismo paquete. La huella SHA-256 está en `.well-known/assetlinks.json`.
