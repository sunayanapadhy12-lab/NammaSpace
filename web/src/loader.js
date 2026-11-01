/**
 * loader.js — Namma Space model loader
 *
 * Loads GLB / glTF files using Three.js GLTFLoader (already bundled inside
 * the `three` npm package — no extra dependencies required).
 *
 * Optionally wires in DRACOLoader so Draco-compressed GLBs from
 * reconstruction pipelines (e.g. Open3D, Meshroom) load correctly.
 *
 * Exported API
 * ────────────
 *   loadGLTF(file)  → Promise<THREE.Group>
 *     Reads a File object, parses it, and resolves with the scene root.
 *     Rejects with a plain Error whose .message is safe to show the user.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// ── Build a single shared loader instance (reused across calls) ────────────
const dracoLoader = new DRACOLoader()
// Official Google CDN decoder path recommended by Three.js
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Load a GLB or glTF File object and return the Three.js scene root (Group).
 *
 * @param {File} file - File selected by the user via <input type="file">
 * @returns {Promise<THREE.Group>}
 */
export function loadGLTF(file) {
  return new Promise((resolve, reject) => {
    // Validate extension before we bother reading the file
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['glb', 'gltf'].includes(ext)) {
      reject(new Error(
        `Unsupported format ".${ext}".\n` +
        `The viewer currently supports GLB and glTF files.\n` +
        `OBJ / PLY / SPLAT support is planned for a future update.`
      ))
      return
    }

    // Read the file as an ArrayBuffer, then hand it to GLTFLoader
    const reader = new FileReader()

    reader.onload = (e) => {
      const buffer = e.target.result

      gltfLoader.parse(
        buffer,
        '/models/',           // resource path — empty because all assets are embedded in GLB
        (gltf) => {
          const root = gltf.scene
          if (!root) {
            reject(new Error('The file parsed but contains no scene data.'))
            return
          }
          resolve(root)
        },
        (err) => {
          // GLTFLoader error objects may have a message or just be strings
          const msg = (typeof err === 'string') ? err : (err?.message ?? String(err))
          reject(new Error(
            `Could not parse "${file.name}".\n\n` +
            `Parser error: ${msg}\n\n` +
            `Make sure the file is a valid GLB or glTF exported from your ` +
            `reconstruction pipeline and has not been corrupted.`
          ))
        }
      )
    }

    reader.onerror = () => {
      reject(new Error(
        `Could not read "${file.name}" from disk.\n` +
        `Check that the file is accessible and try again.`
      ))
    }

    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compute the axis-aligned bounding box of an Object3D (including children).
 * Forces all matrices to update before measuring.
 *
 * @param {THREE.Object3D} object
 * @returns {{ box: THREE.Box3, center: THREE.Vector3, size: THREE.Vector3, radius: number }}
 */
export function computeBounds(object) {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) {
    box.min.set(-1, -1, -1)
    box.max.set(1, 1, 1)
  }
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)
  const radius = Math.max(size.length() / 2, 0.5)
  return { box, center, size, radius }
}
