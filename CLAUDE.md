# CLAUDE.md — Bitácora de Instalaciones Ecofit (V6)

Instrucciones permanentes. El estado cambiante (versiones, bugs, pendientes) está en **HANDOFF.md**: léelo antes de tocar código.
Lo marcado **⚠️ PENDIENTE DE CONFIRMAR** no se pudo verificar en el código ni en el historial. Pregúntalo, no lo supongas.

## 1. Qué es
Bitácora digital de instalaciones fotovoltaicas de **Ecofit Solar Solutions** (La Paz, BCS, México). Sirve para: (1) activar garantías de fabricante (fotos, seriales, validación Voc/Isc), (2) documentación técnica interna (levantamiento, checklist de obra, auditoría) y (3) evidencia para el cliente y el portafolio (PDF/Word).
La usan técnicos de campo en Android gama media, con señal débil o sin señal, y también la oficina en escritorio. En campo `navigator.onLine` miente, así que el código siempre intenta la operación y, si falla, la manda a la cola.

## 2. Stack real
- JavaScript puro con ES modules, **sin framework ni bundler**. Todo es estático (HTML/CSS/JS).
- **Firebase JS SDK 10.12.0** (app, auth, firestore, storage): **local** en `js/vendor/`, para que la app arranque sin internet.
- **jsPDF 2.5.1**: local en `js/vendor/jspdf.umd.min.js`, se carga solo cuando se usa.
- **docx** (⚠️ versión PENDIENTE DE CONFIRMAR): local en `js/vendor/docx.mjs`, se carga con `import()` dinámico (`ensureDocxLoaded()`).
- **QRCode.js** (⚠️ versión PENDIENTE DE CONFIRMAR): local en `js/vendor/qrcode.min.js`.
- **ZXing-js** (⚠️ versión PENDIENTE DE CONFIRMAR): escáner web dentro de `ecofit-scanner.html` (iframe). Necesita `js/vendor/zxing.min.js` (local y en `APP_SHELL`). Se borró por error en 20f2f77 y se restauró el 2026-10-17: **no lo borres** aunque ningún `.js` lo importe.
- **ML Kit** (`@capacitor-mlkit/barcode-scanning` ^6): escáner de la app nativa Capacitor.
- Cargados de **CDN** (necesitan internet y no son críticos): Leaflet 1.9.4 (unpkg, `map.js`), SheetJS xlsx 0.18.5 (cdnjs, exportar inventario) y Google Fonts.
- Service worker propio en `sw.js` (sin Workbox) y `manifest.json`.
- Android: wrapper Capacitor 6 en el repo padre `claude code/` (paquete `com.ecofit.bitacora`) y un TWA de Bubblewrap en `C:\Users\maldo\`. Detalles en HANDOFF.md.

## 3. Almacenamiento local (⚠️ el código NO usa IndexedDB como base principal)
| Qué | Dónde | Archivo |
|---|---|---|
| Proyectos (caché) | web: `localStorage` `ecofit_fs::ecofit/projects/{id}.json` + `…/_index.json` · nativo: Capacitor Filesystem `DATA/ecofit/projects/` | `local-store.js` |
| Usuarios (caché) | `ecofit_fs::ecofit/users.json` | `local-store.js` |
| Cola de escrituras de proyectos | `localStorage` `ecofit_sync_q`, descartados en `ecofit_sync_dead` (5 intentos) | `sync-queue.js` |
| kv / config / inventario | `localStorage` `ecofit_kvcache::{kv\|cfg\|inv}::{clave}`, cola `ecofit_kv_q` | `db.js` |
| Recordatorios | `localStorage` `ecofit_rem_cache`, cola `ecofit_rem_q` | `db.js` |
| Sesión | `localStorage` `ecofit_session_v2` (dura 7 días, funciona sin internet) | `auth.js` |
| Copia de Firestore | IndexedDB que maneja el propio SDK (`persistentLocalCache`) | `firebase.js` |

**IndexedDB que maneja la app:**
- `ecofit-photo-queue`, **versión 1**, store `queue` (keyPath `id`, sin índices). Item: `{ id, projectId, storagePath, blob (o base64 en items viejos), createdAt, op, opArgs, retryCount, lastError, lastErrorAt, localPath }`. `op` dice qué campo del proyecto se llena al subir (`fotoSistema`, `fotoFase`, `eqFoto`, `fotoCierrePaso`…; ver el `switch` de `processQueue`).
- `ecofit-od`, **versión 1**, store `handles` (clave `folder`): el `FileSystemDirectoryHandle` de la carpeta de OneDrive.
- `ecofitV6`: de una versión vieja, ya no se usa. Solo se borra en "Limpiar datos".

**Objeto proyecto** (`projects/{id}` en Firestore, se crea en `proj-form.js`). Ejemplo corto:
```json
{ "id": "uuid", "displayId": "García / 15-Ene / Interconectado CFE", "clientName": "Juan García",
  "tipoSistema": "interconectado", "estado": "borrador", "prioridad": "normal",
  "tecnicoLiderId": "uid", "tecnicosApoyo": ["uid"], "direccion": "", "coordenadas": {"lat": 24.1, "lng": -110.3},
  "fechaInicio": "ISO", "fechaEstimada": "ISO", "observaciones": [], "statusLog": [], "changeLog": [],
  "documentacion": { "levantamiento": {}, "fases": {} },
  "garantia": { "fotoSistema": null, "fotosTecnicas": {}, "equipos": [], "estructura": null,
                "paneles": { "marca": "", "modelo": "", "wp": 0, "seriales": [] }, "arregloValidaciones": {} },
  "checklistData": { "exec": {}, "fotosCierre": {} }, "auditoria": null, "fases": { "firmas": {} },
  "createdBy": "uid", "createdAt": "ISO", "updatedAt": "ISO", "updatedBy": "nombre", "_v": 3 }
```
Una foto puede venir como URL, data-URI, `{url}` o `{pending:true, pendingId}`. Para leerla usa siempre `getPendingSrc` o `fotoToDataURI` (`util-foto.js`).
**Versión del documento:** `SCHEMA_VERSION = 3` en `firebase.js`. `_migrateProject()` migra al leer. Si cambia la forma del documento, sube la versión y agrega un paso ahí.

## 4. Firebase (proyecto `ecofit-bitacora`, plan Spark)
Se usan **Auth** (correo y contraseña), **Firestore**, **Storage** (fotos y videos) y **Hosting**. Push/FCM está a medias (ver HANDOFF.md).
- Login: el usuario escribe su `username`. La app busca el correo en `usernameIndex/{username}` o, si no lo encuentra, usa `username@ecofit.app` o el correo real que escriba.
- Colecciones: `projects`, `users`, `config`, `kv`, `reminders`, `publicCards`, `usernameIndex`, `errors`. Los documentos de `kv`/`config` son `{ value }`. Claves de kv: `panel_presets_custom`, `stock`, `history`, `catalog`, `areas`. De config: `contactoEcofit`.
- `firestore.rules`: todo pide estar autenticado y `users/{uid}.activo == true`. El rol se lee de `users/{uid}.rol`. Proyectos: admin hace todo; líder crea y edita; apoyo solo edita los que tiene asignados y nunca `auditoria`; los cambios de `estado` siguen `transitionMap`; solo admin borra. `users`: solo admin escribe (cada quien edita su perfil, menos `rol`/`activo`/`id`). `config`: escribe solo admin. `kv`: `stock`/`history` los escribe cualquier usuario activo y lo demás solo líder o admin. **Lectura pública sin login:** `publicCards` (QR del cliente) y `usernameIndex` (solo el correo).
- `storage.rules`: lectura para usuarios activos. Escritura para líder o admin, o un apoyo asignado (solo `create`). Ruta protegida: `projects/{projectId}/…`.
- **Ninguna regla depende de un correo o UID fijo.** Todo va por rol y asignación.
- ⚠️ Las reglas del repo y las publicadas pueden no ser iguales (ver HANDOFF.md, bugs #2 y #3).
- `apiKey` en `firebase.js`: es la config web pública. No es un secreto.

## 5. Menú inferior (`index.html` + router en `app.js`)
- **Inicio** (`#dashboard`, `dashboard.js`): lista y filtros de proyectos, estadísticas, "Para revisar" para admin y acceso a cada proyecto (levantamiento, progreso de obra, garantía, auditoría, trayecto, QR, exportar).
- **Checklist** (`#checklists`, `checklist.js`, `cl-*.js`, `modules/checklist/`): checklist de herramienta, consumibles y ejecución por bloques según el techo y el tipo de sistema. Es interno.
- **Calcular** (`#calculadora`, `calc-*.js`, `modules/calculadora/`): calculadora BOM (estructura K2/Aluminex, diagrama, materiales). Al aplicarla descuenta stock del Inventario de esta misma app. Es interno.
- **Inventario** (`#inventario`, `inv-*.js`): almacén con captura diaria, catálogo, áreas, estado, historial, consumo y exportación a Excel. Los datos van en kv de Firestore. **No se conecta con otra app Ecofit** (hay un `inventario-almacen.html` aparte en la carpeta vieja `bitacora-ecofit/`, que no está ligado a esta).
- **Alertas** (`#recordatorios`, `recordatorios.js`): recordatorios rápidos y alertas de vencimientos. Es interno.
- **Ajustes** (`#settings`, `settings*.js`): perfil, usuarios (admin), catálogo de paneles, contacto Ecofit, backup JSON, carpeta OneDrive, fotos pendientes, forzar actualización y limpiar datos.
- Rutas sin menú: `#mapa`, `#concluidos`, `#dimensionamiento/{id}`, `#cliente/{id}` (pública, sin login).

## 6. Estados, roles e ID
Estados (`ESTADOS` en `util-domain.js`): borrador, en_progreso, pendiente_revision, observado, **comisionado, en_garantia, fuera_garantia**, cerrado y cancelado.

| Desde | admin | lider | apoyo |
|---|---|---|---|
| borrador | en_progreso, cancelado | en_progreso | — |
| en_progreso | pendiente_revision, cancelado | pendiente_revision | pendiente_revision |
| pendiente_revision | observado, comisionado, cerrado, en_progreso | — | — |
| observado | cerrado, cancelado | en_progreso | — |
| comisionado | en_garantia, cerrado | en_garantia | — |
| en_garantia | fuera_garantia, cerrado | — | — |
| fuera_garantia | cerrado | — | — |
| cancelado | borrador | — | — |

Pasar a `observado` o `cancelado` pide una nota obligatoria. **`TRANSITIONS` (`auth.js`) está copiado a mano en `firestore.rules` (`transitionMap`)**: si cambias uno, cambia el otro.
Permisos de edición (`canEdit`): admin edita todo; líder edita todo lo que no esté cerrado o cancelado; apoyo solo lo que tiene asignado. Solo admin exporta PDF/Word del proyecto y administra usuarios y config.
**ID:** el `id` es un UUID. El `displayId` visible hoy tiene el formato `Apellido / D-Mmm / Tipo` y le agrega `-2`, `-3` si se repite (`genDisplayId`). **`EFS-AAAA-NNNN` es legado** (`fmtProjectId`, ya no se usa al crear proyectos). Ahora `EFS-` solo aparece en los nombres de los archivos que se exportan.

## 7. Levantamiento dinámico
- Los tipos están en `TIPOS_SISTEMA` (`util-domain.js`): interconectado, hibrido_respaldo, aislado, bombeo, sistema_pequeno, ampliacion y otro. `hibrido` y `respaldo` son legado (`legacy: true`).
- Secciones comunes (`lev-form.js`): techo y sitio con áreas, condiciones ambientales (polvo, salinidad costera, calor extremo, humedad, viento), sombras y Sun Seeker, dron, logística, notas y fotos. La sección "Eléctrico y consumo" (servicio CFE, tierra, centro de carga, voltajes) se oculta en los tipos que están en `_SIN_CFE` y en `otro`.
- Campos por tipo (`renderCamposDinamicos` en `lev-campos.js`):
  - interconectado / híbrido: NIS, RPU, titular, tarifa, demanda, factor de potencia y horario de uso, más baterías.
  - híbrido además: autonomía, banco en kWh, cargas críticas y no críticas, y generador.
  - aislado: autonomía, cargas críticas y no críticas, generador y crecimiento futuro.
  - bombeo: tipo de bomba, caudal, profundidad y horas.
  - sistema_pequeno: datos DC del refrigerador solar.
- Recibos CFE: hasta 12 (`lev-consumo.js`). Guardado y fotos en `lev-guardar.js`.
- **Para agregar un tipo nuevo:** (1) añadirlo a `TIPOS_SISTEMA`; (2) su bloque en `renderCamposDinamicos` y, si no tiene CFE, en `_SIN_CFE`; (3) guardar sus campos en `lev-guardar.js`; (4) revisar las reglas por tipo en `util-fases.js` (`calcFaseEstado`, `calcLevItems`), `getExecBlocks` (`modules/checklist/index.js`), el filtro de auditoría (`aud-data.js`) y `calcDimensionamiento` (`modules/dimensionamiento/`); (5) revisar los PDF/Word.

## 8. Catálogos de marcas
- Equipos: `MARCAS_EQUIPOS` = Victron Energy, LuxPower, SolarK, Pylontech, Epcom, EPEVER y "Otra marca". Están **escritas en el código** de `util-domain.js`; para cambiarlas hay que editar el archivo y hacer deploy.
- Estructuras: `MARCAS_ESTRUCTURA` = K2 Systems, Aluminex y "Otra marca", con `SISTEMAS_ESTRUCTURALES` y `TIPOS_FIJACION`, en el mismo archivo.
- Paneles: los base están en `PANEL_PRESETS` (`modules/calculadora/index.js`). El admin agrega más desde Ajustes y se guardan en kv `panel_presets_custom` (`settings-paneles.js`).
- Materiales de inventario: los base están en `inv-data.js`. El catálogo y las áreas se editan dentro de la app (`inv-admin.js`).

## 9. PDF y Word
- **PDF Cliente** (`pdf-cliente.js`): cliente y dirección, tipo, kWp, paneles, fechas, equipos **sin seriales**, foto del sistema, hasta 6 fotos de cierre y contacto. ⚠️ La pantalla de exportar dice que incluye "QR del sistema", pero el código no lo agrega.
- **PDF Técnico** (`pdf-tecnico.js`, "Uso interno") y **Word Técnico** (`word-tecnico.js`): se eligen las secciones. Hay equipos con seriales, fotos técnicas, estructura, BOM, diagrama, paneles con seriales, levantamiento, consumo, dimensionamiento, evidencias de cierre, observaciones, historial, auditoría, Voc, torque y QR.
- Otros Word: `pdf-levantamiento.js`, `pdf-garantia.js` (certificado), `pdf-avance.js` y `pdf-calculadora.js`. La vista de selección está en `pdf.js` y los helpers en `pdf-helpers.js` y `word-helpers.js`.

## 10. Deploy
- **Firebase Hosting** (la app Android apunta aquí): `https://ecofit-bitacora.web.app`. `firebase.json` y `.firebaserc` están en el **repo padre** `claude code/` (repo `bitacora-ecofit-android`) con `"public": "bitacora-v6"`. Desde `claude code/`:
  ```
  npx firebase-tools login
  git -C bitacora-v6 pull        # trae el bump del SW que hizo GitHub Actions
  npx firebase-tools deploy --only hosting --project ecofit-bitacora
  ```
  Reglas: `--only firestore:rules` o `--only storage`. Solo con el OK explícito del dueño.
- **GitHub Pages** (sigue activo): repo `github.com/ingmaldonado98-cpu/bitacora-ecofit`, rama `main`, raíz `/`. Un push a `main` dispara `bump-sw.yml` (sube `CACHE_NAME`/`SW_VERSION`/`BUILD_DATE` y hace commit `[skip ci]`) y luego `pages.yml` (publica en `https://ingmaldonado98-cpu.github.io/bitacora-ecofit/`, sin `.git`, `.github` ni `.claude`).
- `ci.yml`: revisa la sintaxis con acorn, que todos los `js/*.js` estén en `APP_SHELL` y que los imports de `app.js` existan.

## 11. Probar en local
- Servidor estático desde `bitacora-v6/`: `python -m http.server 8080` → `http://localhost:8080`. Como `localhost` es contexto seguro, funcionan el service worker y la cámara.
- Usa el proyecto Firebase real (no hay emulador configurado): **cuidado con los datos de producción**.
- Tests: `npm test` (`tests/voc.test.js`, Node).
- Offline: DevTools → Network → Offline, o Application → Service Workers → Offline. Recarga, crea o edita un proyecto, toma una foto y revisa que el badge "fotos sin subir" y la cola aparezcan. Luego reconecta y comprueba la sincronización.
- Para ver la versión nueva: Application → Service Workers → Unregister y Clear storage, o el banner "Nueva versión disponible".
- Cámara en el celular: abre la URL de Hosting (HTTPS) o usa `chrome://inspect` con port forwarding a `localhost:8080`. La app Capacitor usa ML Kit, no ZXing.

## 🚫 REGLAS QUE NUNCA SE ROMPEN
1. **Offline first.** Ninguna acción de guardar puede necesitar internet, tampoco las fotos. Primero se guarda local (`db.js`) y después se sube (`sync-queue`, `photo-queue`). Si la subida falla por cualquier motivo, se encola: una foto nunca se pierde. Si una foto depende del servidor, los técnicos dejan de usar la app. Hoy solo necesitan internet el primer login, los videos de dron, el mapa y el Excel.
2. **No crear otro proyecto Firebase ni cambiar de dominio.** Los datos locales (localStorage, IndexedDB, cola de fotos sin subir) están atados al origen. Cambiar el origen deja huérfanos los registros que no se han sincronizado en cada celular. ⚠️ Hoy ya hay **dos orígenes** (web.app y github.io) con datos locales separados. Ver HANDOFF.md.
3. **Esquema IndexedDB** (`ecofit-photo-queue`, `ecofit-od`): para cambiarlo, sube la versión y escribe la migración en `onupgradeneeded`. **Nunca** borres ni recrees un store con datos. Para el documento de Firestore: sube `SCHEMA_VERSION` y agrega su paso en `_migrateProject`.
4. **Cada deploy que cambie archivos cacheados sube la versión del caché** en `sw.js` (`CACHE_NAME`, `SW_VERSION`, `BUILD_DATE`). Si no, los dispositivos se quedan con la versión vieja. Todo `.js` nuevo va en `APP_SHELL`.
5. **Fotos: comprimir siempre en el dispositivo** con `compressImage()` (`util-foto.js`) antes de guardar o subir. ⚠️ El código usa **1920 px / JPEG 0.75**, pero la especificación pide **1280 px / 0.72**. PENDIENTE DE CONFIRMAR cuál vale; no lo cambies sin decisión del dueño.
6. **Escáner:** la cámara abre directo al tocar el botón, sin pasos intermedios. Usa modo continuo cuando se capturan varios seriales (carga masiva, `continuous: true`). Siempre con entrada manual de respaldo y sin duplicados.
7. **Paleta y estilo Ecofit** (`css/style.css`; usa las variables, no colores sueltos):
   - Oscuro (por defecto): `--bg #000000`, `--surface #111111`, `--surface2 #1d1d1f`, `--surface3`/`--border #333336`, `--border2 #424245`, `--accent`/`--g500 #2ebd42`, `--g300 #6dd97a`, `--solar`/`--yellow #f0c000`, `--text #f5f5f7`, `--text-muted #86868b`, `--red #f07070`, `--blue #70b5f9`, `--orange #f09a50`.
   - Claro (`body.theme-light`): `--bg #f7f8fa`, `--surface #ffffff`, `--accent #16a34a`, `--solar #92600a`, `--text #111827`, `--text-muted #6b7280`.
   - Verde oscuro de marca `#1B4332` (`theme_color` y color `VERDE` de los PDF). Splash `#0f1a14`. Radios: cards 28px, botones 36px, pills 980px.
   - Tipografía: `system-ui, -apple-system, 'Segoe UI', sans-serif`, y monospace para cifras. Se cargan DM Sans y DM Serif Display de Google Fonts, pero el CSS casi no las usa.
8. **Español** en la interfaz, los mensajes, los toasts y los commits. El código y las claves de datos se quedan como están: no renombres.

## Convenciones
- Los handlers de UI se exponen como `window.xxx` y se llaman con `onclick` en HTML hecho con template strings. Siempre escapa con `esc()`.
- Para cambios puntuales usa `projects.setField(id, 'ruta.anidada', valor)`, así no pisas cambios de otros técnicos. Registra el historial con `logChange()`.
- Usa los modales propios (`confirmDialog`, `inputDialog`, `toast`), nunca `alert` ni `confirm` nativos.
- Los mensajes de commit largos y explicativos son la documentación de las decisiones (`git log`).

## Mapa de archivos
- `index.html` — shell, banner offline, header, menú inferior. · `sw.js` — caché y estrategias, Background Sync. · `manifest.json` — PWA.
- `ecofit-scanner.html` — escáner ZXing en iframe. · `firestore.rules`, `storage.rules` — reglas. · `css/style.css` — todo el estilo.
- `.github/workflows/` — bump del SW, CI y Pages. · `scripts/bump-sw-version.js` — bump manual. · `tests/voc.test.js` — tests de Voc/Isc.
- `js/app.js` — router por hash, banners, registro del SW, reporte de errores, tema.
- `js/auth.js` — login, sesión offline, roles, `TRANSITIONS`, `canEdit`.
- `js/firebase.js` — SDK, CRUD de Firestore, subida de fotos y video, migraciones, backup.
- `js/db.js` — capa local-first, sync en segundo plano, detección de conflictos.
- `js/local-store.js` — caché de proyectos y usuarios (Filesystem o localStorage), purga.
- `js/sync-queue.js` — cola de escrituras con reintentos. · `js/photo-queue.js` — cola de fotos en IndexedDB.
- `js/platform.js` — detecta Capacitor. · `js/utils.js` — barrel de `util-*`.
- `js/util-fmt.js` — escape, fechas, uuid. · `js/util-dialogs.js` — toast y modales.
- `js/util-foto.js` — captura, compresión, miniaturas, lightbox, video. · `js/util-scanner.js` — overlay del escáner.
- `js/util-domain.js` — estados, tipos, marcas, `genDisplayId`. · `js/util-fases.js` — desbloqueo y % de fases, firmas.
- `js/ui-states.js` — empty states y skeletons. · `js/icons.js` — SVG inline.
- `js/dashboard.js` — Inicio. · `js/concluidos.js` — archivados. · `js/map.js` — mapa Leaflet.
- `js/project.js` — detalle y cambio de estado. · `js/proj-form.js` — alta y edición. · `js/proj-obs.js` — observaciones. · `js/proj-firmas.js` — firmas.
- `js/documentacion.js` — Progreso de obra y vista de levantamiento. · `js/doc-exec.js` — bloques y fotos de cierre. · `js/doc-sitio.js` — fotos del sistema, técnicas y adicionales.
- `js/lev-form.js` — formulario. · `js/lev-campos.js` — campos por tipo. · `js/lev-areas.js` — áreas de techo. · `js/lev-consumo.js` — recibos y cargas.
- `js/lev-guardar.js` — guardado y fotos. · `js/lev-gps.js` — GPS. · `js/lev-notas.js` — notas. · `js/lev-tmin.js` — T mínima. · `js/clima.js` — clima por estado.
- `js/garantia.js` — vista Garantía. · `js/gar-equipos.js` — equipos y seriales. · `js/gar-estructura.js` — estructura. · `js/gar-paneles.js` — seriales de paneles. · `js/gar-voc.js` — validación Voc/Isc.
- `js/auditoria.js`, `aud-state.js`, `aud-data.js`, `aud-render.js`, `aud-actions.js` — auditoría técnica.
- `js/checklist.js`, `cl-render.js`, `cl-actions.js` — Checklist.
- `js/calculadora.js`, `calc-state.js`, `calc-render.js`, `calc-render-bom.js`, `calc-render-diagrama.js`, `calc-actions.js`, `calc-tablero.js` — Calcular.
- `js/dimensionamiento.js` — memoria técnica preliminar. · `js/trayecto.js` — flujo guiado. · `js/trayectorias.js` — canalizaciones.
- `js/inventario.js`, `inv-state.js`, `inv-data.js`, `inv-captura.js`, `inv-admin.js`, `inv-reports.js` — Inventario.
- `js/recordatorios.js` — Alertas. · `js/qr.js` — QR del cliente. · `js/cliente-publico.js` — tarjeta pública.
- `js/settings.js`, `settings-users.js`, `settings-paneles.js`, `settings-backup.js` — Ajustes. · `js/onedrive.js` — copia en carpeta OneDrive.
- `js/pdf.js`, `pdf-helpers.js`, `pdf-cliente.js`, `pdf-tecnico.js` — PDF. · `js/word-helpers.js`, `word-tecnico.js`, `pdf-levantamiento.js`, `pdf-garantia.js`, `pdf-avance.js`, `pdf-calculadora.js` — Word.
- `modules/calculadora/`, `modules/checklist/`, `modules/dimensionamiento/` — motores de cálculo puros, sin DOM.
