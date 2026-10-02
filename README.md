# 🎙️ GHOSTAI TTS STUDIO

Aplicación web independiente para la **generación bidireccional de voz** entre **GhostAI / Flow** y **ElevenLabs** a través de nuestro **GhostAI TTS Gateway**.

---

## 📐 Flujo Arquitectónico

```
GhostAI / Flow Studio
       ↓  (Exportación)
.ghostai-tts.json
       ↓  (Importación & Configuración)
GhostAI TTS Studio
       ↓  (POST /api/tts/generate secuencial)
GhostAI TTS Gateway (https://tts-test.smartbrain.lat)
       ↓  (API Key segura en servidor)
ElevenLabs
       ↓  (MP3 Blobs)
Audio Preview & Validación
       ↓  (Empaquetado JSZip en navegador)
ghostai-tts-package.zip
       ↓  (Importación final)
GhostAI / Flow Studio
```

---

## 🌟 Características Principales

1. **Importación y Validación de Esquema**:
   - Soporte para `.ghostai-tts.json` (schema 1.0).
   - Validador estricto con mensajes de error legibles y comprensibles.
   - Preservación íntegra de `id`, `sceneId`, `sceneIndex` y metadatos personalizados (sin alterar ni inventar identificadores).
   - Botón de carga rápida de demostración (*Lía y el Faro Encantado*).

2. **Panel de Control y Métricas**:
   - Monitor en vivo del estado del Gateway (`/api/tts/health`).
   - Conteo de narraciones: Total, Completadas, Pendientes, Errores y Duración estimada.

3. **Configuración Global y por Narración**:
   - Selector global de voz sincronizado en vivo desde ElevenLabs (`/api/tts/voices`) con botón de escucha previa.
   - Selector de modelo TTS (`/api/tts/models`).
   - Selector de formato de salida (`mp3_44100_128`, etc.).
   - Asignación masiva a pendientes o personalización individual por fila.

4. **Motor de Generación Secuencial**:
   - Generación elemento por elemento en cola secuencial (evita rate limits y bloqueos).
   - Estados visuales en tiempo real: `PENDING`, `GENERATING`, `READY`, `ERROR`, `CANCELLED`.
   - Cancelación en cualquier momento vía `AbortController`.
   - Resistencia a fallos: Si 8 de 10 tienen éxito y la 9 falla, **se conservan los 8 audios**.
   - Acciones: **Generar Todo**, **Reintentar Fallidos**, **Generar Individual**.

5. **Reproductor de Audio Estable**:
   - Reproducción sin recrear elementos de audio ni reconvertir a Base64.
   - Controles de Play, Pause, Resume, barra de tiempo y descarga individual de MP3.

6. **Empaquetado de Exportación GhostAI**:
   - Genera `ghostai-tts-package.zip` conteniendo:
     - `manifest.json`: Compatible con el esquema `ghostai-tts-package` con metadatos originales, provider, gateway y referencias de archivo.
     - `audio/narration_001.mp3`, `audio/narration_002.mp3`, etc.
   - Opción de exportar resultados actuales aún con fallos pendientes.

---

## 🔒 Seguridad

- La clave de ElevenLabs **nunca** reside ni viaja al frontend.
- El frontend únicamente se comunica con la variable de entorno:
  `VITE_TTS_GATEWAY_URL=https://tts-test.smartbrain.lat`
- Cero almacenamiento de secretos en `localStorage`.

---

## 🚀 Despliegue en Netlify

El proyecto cuenta con configuración lista en [`netlify.toml`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/ghostai-tts-studio/netlify.toml):

1. **Configuración de Build**:
   - Build command: `npm run build`
   - Publish directory: `dist`
2. **Variable de Entorno en Netlify**:
   - `VITE_TTS_GATEWAY_URL`: `https://tts-test.smartbrain.lat`
3. **Redirects SPA**:
   - Configurados para redirigir `/*` a `/index.html` con status 200.

---

## 🧪 Pruebas y Certificación

Para ejecutar la suite de pruebas unitarias y de integración end-to-end:

```bash
# Ejecutar pruebas automáticas
npm test

# Compilar para producción
npm run build

# Ejecutar localmente
npm run dev
```
