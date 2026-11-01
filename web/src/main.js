/**
 * main.js — Namma Space entry point
 *
 * Wires up:
 *  - Three.js viewer  (viewer.js)
 *  - GLB / glTF model loader  (loader.js)
 *  - Sidebar controls (wireframe, grid, axes, shadows, camera presets)
 *  - Info panel live updates (FPS, camera, geometry counts)
 *  - Load Model button with real file parsing, loading overlay, error display
 *  - Fullscreen toggle
 */

import './style.css'
import { createViewer } from './viewer.js'
import { loadGLTF } from './loader.js'

// ── Bootstrap ──────────────────────────────────────────────
const canvas = document.getElementById('viewport')
const viewer = createViewer(canvas)

// ── Sidebar toggles ────────────────────────────────────────
function bindToggle(id, fn) {
  const el = document.getElementById(id)
  if (!el) return
  el.addEventListener('change', () => fn(el.checked))
}

bindToggle('toggle-wireframe', v => viewer.setWireframe(v))
bindToggle('toggle-grid', v => viewer.setGrid(v))
bindToggle('toggle-axes', v => viewer.setAxes(v))
bindToggle('toggle-shadows', v => viewer.setShadows(v))

// Apply initial states
viewer.setGrid(true)
viewer.setShadows(false)

// ── Camera preset buttons ──────────────────────────────────
document.getElementById('btn-reset-cam')?.addEventListener('click', () => viewer.resetCamera())
document.getElementById('btn-top-view')?.addEventListener('click', () => viewer.topView())
document.getElementById('btn-front-view')?.addEventListener('click', () => viewer.frontView())

// ── Loading overlay helpers ────────────────────────────────
const overlay = document.getElementById('loading-overlay')
const overlayMsg = document.getElementById('loading-msg')
const overlayErr = document.getElementById('loading-error')
const overlayErrText = document.getElementById('loading-error-text')
const btnErrClose = document.getElementById('btn-error-close')

function showLoading(filename) {
  if (!overlay) return
  if (overlayMsg) overlayMsg.textContent = `Parsing ${filename}…`
  if (overlayErr) overlayErr.classList.add('hidden')
  overlay.classList.remove('hidden')
  overlay.classList.add('visible')
}

function hideLoading() {
  if (!overlay) return
  overlay.classList.remove('visible')
  // Wait for the CSS transition, then hide completely
  overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true })
}

function showError(message) {
  if (!overlay) { alert(message); return }
  if (overlayMsg) overlayMsg.textContent = ''
  if (overlayErrText) overlayErrText.textContent = message
  if (overlayErr) overlayErr.classList.remove('hidden')
  overlay.classList.remove('hidden')
  overlay.classList.add('visible')
}

btnErrClose?.addEventListener('click', hideLoading)

// ── Info panel updaters ────────────────────────────────────
const elStatus = document.getElementById('status-text')
const elModel = document.getElementById('info-model')
const elVerts = document.getElementById('info-verts')
const elTris = document.getElementById('info-tris')
const elFPS = document.getElementById('info-fps')
const elCamPos = document.getElementById('info-campos')
const elCamTarget = document.getElementById('info-camtarget')
const demoBadge = document.getElementById('demo-badge')

function setInfoDemo() {
  if (elStatus) { elStatus.textContent = 'Demo Mode'; elStatus.className = 'info-value status-demo' }
  if (elModel) elModel.textContent = 'placeholder_room.js'
  if (demoBadge) demoBadge.hidden = false
  updateGeoCounts()
}

function setInfoLoaded(filename) {
  if (elStatus) { elStatus.textContent = 'Scan Loaded'; elStatus.className = 'info-value status-loaded' }
  if (elModel) elModel.textContent = filename
  if (demoBadge) demoBadge.hidden = true
  updateGeoCounts()
}

function updateGeoCounts() {
  const { verts, tris } = viewer.getGeometryCounts()
  if (elVerts) elVerts.textContent = verts.toLocaleString()
  if (elTris) elTris.textContent = tris.toLocaleString()
}

// ── Scan layer badge helpers ───────────────────────────────
const scanBadge = document.querySelector('#layer-scan .layer-badge')

function setScanBadge(text, empty = false) {
  if (!scanBadge) return
  scanBadge.textContent = text
  if (empty) scanBadge.classList.add('empty')
  else scanBadge.classList.remove('empty')
}

// ── Scene selection ────────────────────────────────────────
let currentModelName = null

function selectScene(layer) {
  if (viewer.hasModel()) {
    viewer.setScene('scan')
  } else {
    viewer.setScene(layer)
  }

  const layerItems = document.querySelectorAll('#layer-list .layer-item')
  layerItems.forEach(item => {
    item.classList.toggle('active', item.dataset.layer === layer)
  })

  if (viewer.hasModel()) {
    setInfoLoaded(currentModelName || 'namma_room.glb')
  } else {
    setInfoDemo()
  }
}

const layerItems = document.querySelectorAll('#layer-list .layer-item')
layerItems.forEach(item => {
  item.addEventListener('click', () => {
    const layer = item.dataset.layer
    if (layer) {
      selectScene(layer)
    }
  })
})

// ── Load Model — actual file parsing ──────────────────────
const fileInput = document.querySelector(
  'input[type="file"]#file-input'
)

const btnUnload = document.getElementById('btn-unload')

function triggerLoad() { fileInput?.click() }

document.getElementById('btn-load')?.addEventListener('click', triggerLoad)
document.getElementById('btn-load-empty')?.addEventListener('click', triggerLoad)

btnUnload?.addEventListener('click', () => {
  viewer.unloadModel()
  currentModelName = null
  if (btnUnload) btnUnload.style.display = 'none'
  setScanBadge('not loaded', true)
  selectScene('room')
})

fileInput?.addEventListener('change', async () => {
  const file = fileInput.files[0]
  if (!file) return
  fileInput.value = ''   // reset so the same file can be re-selected

  showLoading(file.name)

  try {
    const modelRoot = await loadGLTF(file)

    // Hand the model root to the viewer — it hides the demo room and auto-frames
    viewer.loadModel(modelRoot, file.name)
    currentModelName = file.name

    hideLoading()
    setScanBadge(file.name, false)
    if (btnUnload) btnUnload.style.display = ''
    selectScene('scan')

    // Show a non-blocking status note in console (no alert)
    console.info(
      `[NammaSpace] Loaded scan: ${file.name}. ` +
      `This is a real model from your reconstruction pipeline.`
    )
  } catch (err) {
    // Show the structured error message inside the overlay
    showError(err.message)

    // If an error occurred before or after the model was partially inserted,
    // fall back to demo mode so the viewer is never left blank
    if (!viewer.hasModel()) {
      currentModelName = null
      setScanBadge('not loaded', true)
      selectScene('room')
    }
  }
})

selectScene('room')
setScanBadge('not loaded', true)
  ; (async () => {
    const filename = 'namma_room.glb'

    showLoading(filename)

    try {
      const r = await fetch('/models/namma_room.glb')
      if (!r.ok) throw new Error('HTTP ' + r.status)

      const b = await r.arrayBuffer()
      const f = new File([b], filename, {
        type: 'model/gltf-binary'
      })

      const root = await loadGLTF(f)

      console.log('MODEL OBJECTS:', root.children.length)
      console.log('MODEL DETAILS:', root)

      viewer.loadModel(root, filename)
      currentModelName = filename

      hideLoading()
      setScanBadge(filename, false)

      if (btnUnload) btnUnload.style.display = ''
      selectScene('scan')

      console.info('[NammaSpace] Automatic room loaded.')

    } catch (e) {
      console.error('[NammaSpace] Automatic load failed:', e)
      hideLoading()
      currentModelName = null
      setScanBadge('not loaded', true)
      selectScene('room')
    }
  })()

// Demo badge: hidden = false initially (demo mode is default) ──
// ── Fullscreen ─────────────────────────────────────────────
const btnFS = document.getElementById('btn-fullscreen')
const iconFS = document.getElementById('icon-fullscreen')

const ICON_ENTER = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`
const ICON_EXIT = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0 2-2h3M3 16h3a2 2 0 0 0 2 2v3"/>`

btnFS?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { })
  } else {
    document.exitFullscreen().catch(() => { })
  }
})

document.addEventListener('fullscreenchange', () => {
  const inFS = !!document.fullscreenElement
  if (iconFS) iconFS.innerHTML = inFS ? ICON_EXIT : ICON_ENTER
})

// ── Live info panel — FPS + camera every 500 ms ───────────
function fmt3(v) {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`
}

setInterval(() => {
  const stats = viewer.getStats()
  if (elFPS) elFPS.textContent = stats.fps + ' fps'
  if (elCamPos) elCamPos.textContent = fmt3(stats.camPos)
  if (elCamTarget) elCamTarget.textContent = fmt3(stats.camTarget)
}, 500)


