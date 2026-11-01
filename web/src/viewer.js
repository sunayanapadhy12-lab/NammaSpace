/**
 * viewer.js â€” Namma Space 3D Viewer
 *
 * Builds a Three.js scene with a placeholder room (floor, walls,
 * door openings, ceiling, basic furniture).  Provides mouse orbit /
 * zoom / pan controls implemented from scratch so we have zero
 * additional npm dependencies.
 *
 * Usage:
 *   import { createViewer } from './viewer.js'
 *   const viewer = createViewer(canvasElement)
 *   viewer.destroy()   // cleanup
 */

import * as THREE from 'three'
import { computeBounds } from './loader.js'

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROOM_W = 4      // corridor width (X)
const ROOM_D = 18     // corridor length (Z)
const ROOM_H = 3      // metres tall  (Y)

// Colours â€” kept at balanced, realistic tones so PBR materials
// produce clearly visible, rich surfaces with no dark walls.
const COL_WALL = 0xede8e1   // architectural warm off-white matte wall
const COL_TRIM = 0xdfdad2   // subtle satin baseboard trim
const COL_GRID = 0x7588b5   // subtle grid lines

/**
 * Creates a procedural light wood plank texture for the floor.
 * Zero external asset dependencies, zero HTTP latency, 100% offline.
 */

function createLightWoodTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512

  const ctx = c.getContext('2d')

  // Light grey ceramic tile base
  ctx.fillStyle = '#c8cacc'
  ctx.fillRect(0, 0, 512, 512)

  // Tile layout
  const tileW = 128
  const tileH = 128

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * tileW
      const y = row * tileH

      // Slightly varied tile shades
      const shade = 198 + ((row * 7 + col * 11) % 15)
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 3})`
      ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4)

      // Soft ceramic highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + 3, y + 3, tileW - 6, 3)
      ctx.fillRect(x + 3, y + 3, 3, tileH - 6)

      // Subtle tile shading
      ctx.fillStyle = 'rgba(60,65,68,0.06)'
      ctx.fillRect(x + 3, y + tileH - 5, tileW - 6, 2)
      ctx.fillRect(x + tileW - 5, y + 3, 2, tileH - 6)
    }
  }

  // Dark, narrow grout lines
  ctx.strokeStyle = '#858b8e'
  ctx.lineWidth = 3

  for (let i = 0; i <= 4; i++) {
    const pos = i * tileW
    ctx.beginPath()
    ctx.moveTo(pos, 0)
    ctx.lineTo(pos, 512)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i * tileH)
    ctx.lineTo(512, i * tileH)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 9)
  tex.colorSpace = THREE.SRGBColorSpace

  return tex
}


export function createViewer(canvas) {
  // â”€â”€ Renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.LinearToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x0f1117)

  // â”€â”€ Scene â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const scene = new THREE.Scene()

  // â”€â”€ Camera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100)
  const DEFAULT_CAM_POS = new THREE.Vector3(9, 7, 9)
  const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1, 0)
  camera.position.copy(DEFAULT_CAM_POS)
  camera.lookAt(DEFAULT_CAM_TARGET)

  // â”€â”€ Lighting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Soft ambient fill â€” warm tone keeps all surfaces and models well-lit with no black shadows
  const ambient = new THREE.AmbientLight(0xfff5ea, 0.6)
  scene.add(ambient)

  // Hemisphere light â€” soft sky/ground gradient for natural omnidirectional bounce fill
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8bcaa, 0.45)
  scene.add(hemi)

  // Key directional light â€” angled from front-right with soft subtle shadow casting
  const dirKeyLight = new THREE.DirectionalLight(0xfff8ee, 0.7)
  dirKeyLight.position.set(6, 8, 5)
  dirKeyLight.castShadow = true
  dirKeyLight.shadow.mapSize.width = 1024
  dirKeyLight.shadow.mapSize.height = 1024
  dirKeyLight.shadow.camera.near = 0.5
  dirKeyLight.shadow.camera.far = 25
  dirKeyLight.shadow.camera.left = -6
  dirKeyLight.shadow.camera.right = 6
  dirKeyLight.shadow.camera.top = 6
  dirKeyLight.shadow.camera.bottom = -6
  dirKeyLight.shadow.bias = -0.0004
  dirKeyLight.shadow.normalBias = 0.02
  dirKeyLight.shadow.radius = 3
  scene.add(dirKeyLight)

  // Fill directional light 1 â€” back corner fill (no shadow)
  const dirFillBack = new THREE.DirectionalLight(0xecf2ff, 0.35)
  dirFillBack.position.set(-6, 6, -5)
  dirFillBack.castShadow = false
  scene.add(dirFillBack)

  // Fill directional light 2 â€” front-left fill (no shadow)
  const dirFillLeft = new THREE.DirectionalLight(0xfcf6ee, 0.3)
  dirFillLeft.position.set(-6, 5, 5)
  dirFillLeft.castShadow = false
  scene.add(dirFillLeft)

  // Ceiling point light â€” soft warm interior accent
  const ceilLight = new THREE.PointLight(0xfff4e0, 0.45, 14, 1.5)
  ceilLight.position.set(0, ROOM_H - 0.25, 0)
  ceilLight.castShadow = false
  scene.add(ceilLight)

  // â”€â”€ Materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function stdMat(color, roughness = 0.5, metalness = 0.0) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide
    })
  }

  // Light wooden floor texture & material
  const woodTexture = createLightWoodTexture()
  const matFloor = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.45,
    metalness: 0.02,
    side: THREE.DoubleSide
  })

  // Wall material: realistic neutral off-white / architectural matte finish
  const matWall = new THREE.MeshStandardMaterial({
    color: COL_WALL,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide
  })

  // Trim material: baseboard skirting
  const matTrim = new THREE.MeshStandardMaterial({
    color: COL_TRIM,
    roughness: 0.6,
    metalness: 0.02,
    side: THREE.DoubleSide
  })

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ROOM STRUCTURE (Floor & Rectangular Left, Right, Back Walls)
  // Simple rectangular PlaneGeometry meshes positioned around the floor.
  // Kept in roomGroup so they remain visible both in demo mode
  // and when a scanned model (like Duck.glb) is loaded.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const roomGroup = new THREE.Group()
  roomGroup.name = 'room-structure'
  scene.add(roomGroup)

  // â”€â”€ Floor â”€â”€
  const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D)
  const floorMesh = new THREE.Mesh(floorGeo, matFloor)
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.position.set(0, 0, 0)
  floorMesh.receiveShadow = true
  roomGroup.add(floorMesh)

  // â”€â”€ Back Wall (Z = -ROOM_D / 2) â”€â”€
  // PlaneGeometry default normal is (0, 0, 1), pointing inward toward +Z into the room
  const backWallGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_H)
  const backWall = new THREE.Mesh(backWallGeo, matWall)
  backWall.position.set(0, ROOM_H / 2, -ROOM_D / 2)
  backWall.receiveShadow = true
  roomGroup.add(backWall)

  // â”€â”€ Left Wall (X = -ROOM_W / 2) â”€â”€
  // Rotated by +90Â° around Y so its normal points inward toward +X into the room
  const leftWallGeo = new THREE.PlaneGeometry(ROOM_D, ROOM_H)
  const leftWall = new THREE.Mesh(leftWallGeo, matWall)
  leftWall.rotation.y = Math.PI / 2
  leftWall.position.set(-ROOM_W / 2, ROOM_H / 2, 0)
  leftWall.receiveShadow = true
  roomGroup.add(leftWall)

  // â”€â”€ Right Wall (X = ROOM_W / 2) â”€â”€
  // Rotated by -90Â° around Y so its normal points inward toward -X into the room
  const rightWallGeo = new THREE.PlaneGeometry(ROOM_D, ROOM_H)
  const rightWall = new THREE.Mesh(rightWallGeo, matWall)
  rightWall.rotation.y = -Math.PI / 2
  rightWall.position.set(ROOM_W / 2, ROOM_H / 2, 0)
  rightWall.receiveShadow = true
  roomGroup.add(rightWall)

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // DEMO FURNITURE â€” clearly placeholder shapes
  // Kept in furnitureGroup so they can be hidden when a real scan is loaded.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const furnitureGroup = new THREE.Group()
  furnitureGroup.name = 'demo-furniture'
  scene.add(furnitureGroup)

  // Corridor ceiling lights
  const ceilingLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff1d6,
    emissiveIntensity: 1.5,
    roughness: 0.35
  })

  const ceilingFrameMat = new THREE.MeshStandardMaterial({
    color: 0x555b60,
    roughness: 0.7
  })

  // Place several rectangular LED panels along the corridor
  for (let z = -7.5; z <= 7.5; z += 3) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.07, 0.35),
      ceilingFrameMat
    )
    frame.position.set(0, ROOM_H - 0.04, z)
    furnitureGroup.add(frame)

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.025, 0.25),
      ceilingLightMat
    )
    panel.position.set(0, ROOM_H - 0.005, z)
    furnitureGroup.add(panel)
  }


  function addBox(w, h, d, x, y, z, mat, parent = furnitureGroup) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  // Baseboard trim along the 3 walls to realistically ground them to the floor
  const TRIM_H = 0.1
  const TRIM_T = 0.02
  addBox(ROOM_W, TRIM_H, TRIM_T, 0, TRIM_H / 2, -ROOM_D / 2 + TRIM_T / 2, matTrim, roomGroup)
  addBox(TRIM_T, TRIM_H, ROOM_D, -ROOM_W / 2 + TRIM_T / 2, TRIM_H / 2, 0, matTrim, roomGroup)
  addBox(TRIM_T, TRIM_H, ROOM_D, ROOM_W / 2 - TRIM_T / 2, TRIM_H / 2, 0, matTrim, roomGroup)

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FURNITURE â€” clearly visible placeholder shapes
  // All pieces rest on the floor (y=0). Positioned inside the
  // 8m Ã— 6m room with clear separation from walls.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Material helpers â”€â”€
  // Oak table top â€“ warm natural grain tone
  const matTableTop = stdMat(0xa07848, 0.35, 0.05)
  // Oak legs â€“ slightly darker
  const matTableLeg = stdMat(0x8a6438, 0.42, 0.05)
  // Chair seat & back â€“ lighter honey oak
  const matChairSeat = stdMat(0xb08050, 0.40, 0.04)
  // Sofa body â€“ warm charcoal grey fabric
  const matSofaBody = stdMat(0x4a5560, 0.82, 0.0)
  // Sofa cushions â€“ slightly lighter grey
  const matSofaCush = stdMat(0x5c6878, 0.88, 0.0)
  // Walnut bookshelf carcass
  const matShelfBody = stdMat(0x5a3e25, 0.40, 0.03)
  // Bookshelf shelves â€“ lighter honey
  const matShelfPlank = stdMat(0x7a5535, 0.38, 0.03)
  // Book spines â€“ distinct vivid colours
  const bookColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xd4ac0d, 0x8e44ad, 0xe67e22]
  // Rug â€“ warm terracotta
  const matRug = stdMat(0xb5673a, 0.92, 0.0)
  // Coffee table top â€“ dark walnut veneer
  const matCoffee = stdMat(0x6b4226, 0.38, 0.04)

  // â”€â”€ Rug (under sofa area) â”€â”€
  const sofaX = -ROOM_W / 2 + 2.2    // 2.2 m from left wall
  const sofaZ = -ROOM_D / 2 + 1.25   // 1.25 m from back wall
  {
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.012, 1.8),
      matRug
    )
    rug.position.set(sofaX, 0.006, sofaZ + 0.65)
    rug.receiveShadow = true
    furnitureGroup.add(rug)
  }

  // â”€â”€ Sofa (against back-left wall) â”€â”€
  // Seat: 2.1 wide Ã— 0.48 tall Ã— 0.68 deep, seat top at y = 0.48
  const SEAT_H = 0.48
  const SEAT_D = 0.68
  const SEAT_W = 2.1
  const BACK_H = 0.52
  const ARM_H = 0.62
  addBox(SEAT_W, SEAT_H, SEAT_D, sofaX, SEAT_H / 2, sofaZ, matSofaBody)
  // Back rest
  addBox(SEAT_W, BACK_H, 0.18, sofaX, SEAT_H + BACK_H / 2, sofaZ - SEAT_D / 2 + 0.09, matSofaBody)
  // Left arm
  addBox(0.18, ARM_H, SEAT_D, sofaX - SEAT_W / 2 - 0.09, ARM_H / 2, sofaZ, matSofaBody)
  // Right arm
  addBox(0.18, ARM_H, SEAT_D, sofaX + SEAT_W / 2 + 0.09, ARM_H / 2, sofaZ, matSofaBody)
  // Three seat cushions
  for (let i = -1; i <= 1; i++) {
    addBox(0.65, 0.13, 0.60, sofaX + i * 0.68, SEAT_H + 0.065, sofaZ, matSofaCush)
  }
  // Three back cushions
  for (let i = -1; i <= 1; i++) {
    addBox(0.62, 0.44, 0.12, sofaX + i * 0.68, SEAT_H + 0.22, sofaZ - SEAT_D / 2 + 0.21, matSofaCush)
  }

  // â”€â”€ Coffee table (in front of sofa) â”€â”€
  // Table top at y = 0.40 (low, living room height)
  const CT_W = 0.9, CT_D = 0.5, CT_H = 0.40
  addBox(CT_W, 0.05, CT_D, sofaX, CT_H, sofaZ + SEAT_D / 2 + CT_D / 2 + 0.08, matCoffee)
  for (const [lx, lz] of [[-CT_W / 2 + 0.06, -CT_D / 2 + 0.06], [CT_W / 2 - 0.06, -CT_D / 2 + 0.06],
  [-CT_W / 2 + 0.06, CT_D / 2 - 0.06], [CT_W / 2 - 0.06, CT_D / 2 - 0.06]]) {
    addBox(0.05, CT_H - 0.025, 0.05,
      sofaX + lx,
      (CT_H - 0.025) / 2,
      sofaZ + SEAT_D / 2 + CT_D / 2 + 0.08 + lz,
      matCoffee)
  }

  // â”€â”€ Dining table (right half of room, centred Z) â”€â”€
  // Standard dining: 1.6 wide Ã— 0.9 deep, top at y = 0.76
  const DT_X = 2.2, DT_Z = 0.3
  const DT_W = 1.6, DT_D = 0.9, DT_TOP = 0.76
  addBox(DT_W, 0.05, DT_D, DT_X, DT_TOP, DT_Z, matTableTop)
  // Apron skirt under top
  addBox(DT_W - 0.15, 0.04, 0.04, DT_X, DT_TOP - 0.045, DT_Z - DT_D / 2 + 0.04, matTableLeg) // front
  addBox(DT_W - 0.15, 0.04, 0.04, DT_X, DT_TOP - 0.045, DT_Z + DT_D / 2 - 0.04, matTableLeg) // back
  addBox(0.04, 0.04, DT_D - 0.1, DT_X - DT_W / 2 + 0.04, DT_TOP - 0.045, DT_Z, matTableLeg)  // left
  addBox(0.04, 0.04, DT_D - 0.1, DT_X + DT_W / 2 - 0.04, DT_TOP - 0.045, DT_Z, matTableLeg)  // right
  // Four tapered legs
  for (const [lx, lz] of [
    [-DT_W / 2 + 0.06, -DT_D / 2 + 0.06],
    [DT_W / 2 - 0.06, -DT_D / 2 + 0.06],
    [-DT_W / 2 + 0.06, DT_D / 2 - 0.06],
    [DT_W / 2 - 0.06, DT_D / 2 - 0.06],
  ]) {
    addBox(0.06, DT_TOP - 0.05, 0.06, DT_X + lx, (DT_TOP - 0.05) / 2, DT_Z + lz, matTableLeg)
  }

  // â”€â”€ 4 chairs around the dining table â”€â”€
  // Chair seat at y = 0.46, legs from 0 to 0.46, back rises to y = 0.90
  const CH_SEAT = 0.46
  const chairPositions = [
    { x: DT_X, z: DT_Z - DT_D / 2 - 0.42, ry: 0 },  // front
    { x: DT_X, z: DT_Z + DT_D / 2 + 0.42, ry: Math.PI },  // back
    { x: DT_X - DT_W / 2 - 0.38, z: DT_Z, ry: Math.PI / 2 },  // left
    { x: DT_X + DT_W / 2 + 0.38, z: DT_Z, ry: -Math.PI / 2 },  // right
  ]
  for (const { x, z, ry } of chairPositions) {
    // Seat
    addBox(0.44, 0.04, 0.44, x, CH_SEAT, z, matChairSeat)
    // Seat cushion
    addBox(0.40, 0.05, 0.40, x, CH_SEAT + 0.045, z, matSofaCush)
    // Four legs
    for (const [lx, lz2] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      // Rotate leg offsets by ry
      const rx2 = lx * Math.cos(ry) + lz2 * Math.sin(ry)
      const rz2 = -lx * Math.sin(ry) + lz2 * Math.cos(ry)
      addBox(0.04, CH_SEAT, 0.04, x + rx2, CH_SEAT / 2, z + rz2, matTableLeg)
    }
    // Back verticals (two uprights)
    for (const lx of [-0.16, 0.16]) {
      const rx2 = lx * Math.cos(ry)
      const rz2 = -lx * Math.sin(ry)
      // Upright from seat level to top of back
      const backZ_local = -0.20   // behind seat in local space
      const brx = backZ_local * Math.sin(ry)
      const brz = backZ_local * Math.cos(ry)
      addBox(0.035, 0.44, 0.035, x + rx2 + brx, CH_SEAT + 0.22, z + rz2 + brz, matChairSeat)
    }
    // Horizontal back rail
    const backZ_local = -0.20
    const brx = backZ_local * Math.sin(ry)
    const brz = backZ_local * Math.cos(ry)
    // Rail along seat width â€” simplified as a rotated box
    {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 0.035), matChairSeat)
      rail.position.set(x + brx, CH_SEAT + 0.38, z + brz)
      rail.rotation.y = ry
      rail.castShadow = true
      rail.receiveShadow = true
      furnitureGroup.add(rail)
    }
  }

  // â”€â”€ Bookshelf (right back corner, against right wall) â”€â”€
  // 0.35 deep, 0.75 wide, ROOM_H * 0.75 tall
  // x = ROOM_W/2 - depth/2 - small gap = 4 - 0.18 - 0.04 = 3.78
  const SH_X = ROOM_W / 2 - 0.22
  const SH_Z = -ROOM_D / 2 + 0.45
  const SH_W = 0.75, SH_D = 0.34, SH_H = ROOM_H * 0.80
  // Carcass sides
  addBox(0.025, SH_H, SH_D, SH_X - SH_W / 2 + 0.0125, SH_H / 2, SH_Z, matShelfBody)  // left side
  addBox(0.025, SH_H, SH_D, SH_X + SH_W / 2 - 0.0125, SH_H / 2, SH_Z, matShelfBody)  // right side
  addBox(SH_W, 0.02, SH_D, SH_X, SH_H - 0.01, SH_Z, matShelfBody)                    // top
  addBox(SH_W, 0.02, SH_D, SH_X, 0.01, SH_Z, matShelfBody)                    // base
  addBox(SH_W, SH_H, 0.018, SH_X, SH_H / 2, SH_Z + SH_D / 2 - 0.009, matShelfBody)  // back panel
  // 4 horizontal shelves
  const shelfSpacing = (SH_H - 0.18) / 4
  for (let i = 0; i < 4; i++) {
    const sy = 0.18 + i * shelfSpacing
    addBox(SH_W - 0.05, 0.025, SH_D, SH_X, sy, SH_Z, matShelfPlank)
  }
  // Coloured book stacks on each shelf
  for (let shelf = 0; shelf < 4; shelf++) {
    const sy = 0.18 + shelf * shelfSpacing + 0.025
    let bx = SH_X - SH_W / 2 + 0.06
    for (let b = 0; b < 6 && bx < SH_X + SH_W / 2 - 0.05; b++) {
      const bw = 0.06 + Math.random() * 0.04
      const bh = 0.14 + Math.random() * 0.06
      const bookMat = stdMat(bookColors[b % bookColors.length], 0.70, 0.0)
      addBox(bw, bh, SH_D - 0.06, bx + bw / 2, sy + bh / 2, SH_Z, bookMat)
      bx += bw + 0.012
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Corridor approximation: remove living-room props and add doors/elevator.
  furnitureGroup.clear()
  const matTile = stdMat(0xb8b6b0, 0.24, 0.08)
  const matDark = stdMat(0x55585a, 0.72, 0.0)
  const matRed = stdMat(0x8e2424, 0.58, 0.0)
  const matMetal = stdMat(0x8b9094, 0.32, 0.55)
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x8fabb4, roughness: 0.2, metalness: 0.25,
    transparent: true, opacity: 0.55
  })

  // Subtle tile grid on the floor
  const tileLines = new THREE.GridHelper(18, 18, 0x777873, 0x92918b)
  tileLines.scale.set(1, 1, 1)
  tileLines.position.set(0, 0.012, 0)
  tileLines.material.transparent = true
  tileLines.material.opacity = 0.22
  roomGroup.add(tileLines)

  // Grey lower wall band, white upper wall band
  addBox(0.025, 1.0, ROOM_D, -ROOM_W / 2 + 0.015, 0.5, 0, matDark, roomGroup)
  addBox(0.025, 1.0, ROOM_D, ROOM_W / 2 - 0.015, 0.5, 0, matDark, roomGroup)

  // Red service door at the far end
  addBox(1.25, 2.2, 0.10, 0, 1.1, -ROOM_D / 2 + 0.08, matRed, roomGroup)
  addBox(1.38, 2.32, 0.07, 0, 1.16, -ROOM_D / 2 + 0.02, matMetal, roomGroup)
  addBox(0.05, 0.12, 0.04, 0.43, 1.05, -ROOM_D / 2 + 0.16, matMetal, roomGroup)

  // Elevator-style doors and frame on the right wall
  addBox(0.08, 2.25, 1.65, ROOM_W / 2 - 0.05, 1.12, -2.2, matMetal, roomGroup)
  addBox(0.04, 2.05, 0.72, ROOM_W / 2 - 0.10, 1.05, -2.62, matGlass, roomGroup)
  addBox(0.04, 2.05, 0.72, ROOM_W / 2 - 0.10, 1.05, -1.78, matGlass, roomGroup)
  addBox(0.05, 0.08, 0.22, ROOM_W / 2 - 0.08, 2.42, -2.2, matRed, roomGroup)

  // Small red ceiling service pipes
  addBox(0.06, 0.06, ROOM_D - 1, -0.9, ROOM_H - 0.18, 0, matRed, roomGroup)
  addBox(0.06, 0.06, ROOM_D - 1, -0.72, ROOM_H - 0.30, 0, matRed, roomGroup)
  // HELPERS â€” grid & axes
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gridHelper = new THREE.GridHelper(20, 20, COL_GRID, COL_GRID)
  gridHelper.position.y = 0.001
  gridHelper.material.opacity = 0.35
  gridHelper.material.transparent = true
  scene.add(gridHelper)

  const axesHelper = new THREE.AxesHelper(1.5)
  axesHelper.position.set(-ROOM_W / 2 + 0.3, 0.01, ROOM_D / 2 - 0.3)
  axesHelper.visible = false
  scene.add(axesHelper)

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LABEL SPRITE â€” "Demo Room" text floating above centre
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const labelSprite = makeLabelSprite('âš  Demo Placeholder Room', '#f5a623', '#0f1117cc')
  labelSprite.position.set(0, ROOM_H + 0.5, 0)
  labelSprite.scale.set(4, 0.6, 1)
  scene.add(labelSprite)

  function makeLabelSprite(text, fg, bg) {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = bg
    ctx.roundRect(0, 0, c.width, c.height, 12)
    ctx.fill()
    ctx.fillStyle = fg
    ctx.font = 'bold 28px Segoe UI, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, c.width / 2, c.height / 2)
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    return new THREE.Sprite(mat)
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ORBIT CONTROLS â€” built from scratch
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const orbit = {
    target: new THREE.Vector3().copy(DEFAULT_CAM_TARGET),
    spherical: new THREE.Spherical(),
    _dragging: false,
    _button: -1,
    _lastX: 0,
    _lastY: 0,
    _panOffset: new THREE.Vector3(),
  }

  // Initialise spherical from current camera position
  function syncSpherical() {
    const offset = camera.position.clone().sub(orbit.target)
    orbit.spherical.setFromVector3(offset)
  }
  syncSpherical()

  function applySpherical() {
    orbit.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.spherical.phi))
    orbit.spherical.radius = Math.max(0.05, Math.min(500, orbit.spherical.radius))
    const offset = new THREE.Vector3().setFromSpherical(orbit.spherical)
    camera.position.copy(orbit.target).add(offset).add(orbit._panOffset)
    camera.lookAt(orbit.target.clone().add(orbit._panOffset))
  }

  // â”€â”€ Pan helper â”€â”€
  const _panRight = new THREE.Vector3()
  const _panUp = new THREE.Vector3()
  function pan(deltaX, deltaY) {
    const el = canvas
    const dist = camera.position.distanceTo(orbit.target)
    const fovRad = camera.fov * Math.PI / 180
    const targetHeight = 2 * Math.tan(fovRad / 2) * dist

    _panRight.setFromMatrixColumn(camera.matrix, 0)
    _panRight.multiplyScalar(-deltaX * targetHeight / el.clientHeight)

    _panUp.setFromMatrixColumn(camera.matrix, 1)
    _panUp.multiplyScalar(deltaY * targetHeight / el.clientHeight)

    orbit.target.add(_panRight).add(_panUp)
  }

  // â”€â”€ Event handlers â”€â”€
  // ── Free Roam State ──
  let isFreeRoam = false
  let freeRoamYaw = 0
  let freeRoamPitch = 0
  const freeRoamKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false
  }
  let onFreeRoamChangeCallback = null

  function setFreeRoam(enabled) {
    if (isFreeRoam === enabled) return
    isFreeRoam = enabled

    if (isFreeRoam) {
      orbit._dragging = false
      orbit._button = -1

      const distFromCenter = Math.hypot(camera.position.x, camera.position.z)
      if (distFromCenter > 14 || camera.position.y > 4 || camera.position.y < 0.5) {
        camera.position.set(0, 1.6, 2)
      } else {
        camera.position.y = Math.max(0.8, Math.min(2.4, camera.position.y))
      }

      const euler = new THREE.Euler(0, 0, 0, 'YXZ')
      euler.setFromQuaternion(camera.quaternion)
      freeRoamYaw = euler.y
      freeRoamPitch = Math.max(-1.45, Math.min(1.45, euler.x))

      try {
        const res = canvas.requestPointerLock?.()
        if (res && typeof res.catch === 'function') res.catch(() => {})
      } catch (err) {}
    } else {
      if (document.pointerLockElement === canvas) {
        try {
          document.exitPointerLock?.()
        } catch (err) {}
      }

      freeRoamKeys.forward = false
      freeRoamKeys.backward = false
      freeRoamKeys.left = false
      freeRoamKeys.right = false

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      orbit.target.copy(camera.position).addScaledVector(forward, 4)
      orbit._panOffset.set(0, 0, 0)
      syncSpherical()
    }

    if (onFreeRoamChangeCallback) {
      onFreeRoamChangeCallback(isFreeRoam)
    }
  }

  function onPointerLockChange() {
    if (document.pointerLockElement !== canvas && isFreeRoam) {
      setFreeRoam(false)
    }
  }

  function onMouseMove(e) {
    if (!isFreeRoam) return
    if (document.pointerLockElement !== canvas) return

    const dx = e.movementX ?? e.mozMovementX ?? e.webkitMovementX ?? 0
    const dy = e.movementY ?? e.mozMovementY ?? e.webkitMovementY ?? 0

    const sensitivity = 0.0022
    freeRoamYaw -= dx * sensitivity
    freeRoamPitch -= dy * sensitivity

    const maxPitch = 1.48 // ~85 degrees
    freeRoamPitch = Math.max(-maxPitch, Math.min(maxPitch, freeRoamPitch))

    camera.quaternion.setFromEuler(new THREE.Euler(freeRoamPitch, freeRoamYaw, 0, 'YXZ'))
  }

  function onKeyDown(e) {
    if (!isFreeRoam) return

    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') freeRoamKeys.forward = true
    if (e.code === 'KeyS' || e.code === 'ArrowDown') freeRoamKeys.backward = true
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') freeRoamKeys.left = true
    if (e.code === 'KeyD' || e.code === 'ArrowRight') freeRoamKeys.right = true

    if (e.code === 'Escape') {
      setFreeRoam(false)
    }
  }

  function onKeyUp(e) {
    if (!isFreeRoam) return

    if (e.code === 'KeyW' || e.code === 'ArrowUp') freeRoamKeys.forward = false
    if (e.code === 'KeyS' || e.code === 'ArrowDown') freeRoamKeys.backward = false
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') freeRoamKeys.left = false
    if (e.code === 'KeyD' || e.code === 'ArrowRight') freeRoamKeys.right = false
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('pointerlockchange', onPointerLockChange)

  // ── Event handlers ──
  function onPointerDown(e) {
    if (isFreeRoam) {
      if (document.pointerLockElement !== canvas) {
        try {
          const res = canvas.requestPointerLock?.()
          if (res && typeof res.catch === 'function') res.catch(() => {})
        } catch (err) {}
      }
      return
    }
    orbit._dragging = true
    orbit._button = e.button
    orbit._lastX = e.clientX
    orbit._lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    if (isFreeRoam) return
    if (!orbit._dragging) return
    const dx = e.clientX - orbit._lastX
    const dy = e.clientY - orbit._lastY
    orbit._lastX = e.clientX
    orbit._lastY = e.clientY

    if (orbit._button === 0 && !e.shiftKey) {
      // Orbit (left drag)
      orbit.spherical.theta -= dx * 0.008
      orbit.spherical.phi -= dy * 0.008
    } else {
      // Pan (right drag or Shift+left)
      pan(dx, dy)
    }
    applySpherical()
  }

  function onPointerUp(e) {
    if (isFreeRoam) return
    orbit._dragging = false
    orbit._button = -1
  }

  function onWheel(e) {
    if (isFreeRoam) return
    e.preventDefault()
    orbit.spherical.radius *= 1 + e.deltaY * 0.001
    applySpherical()
  }

  function onContextMenu(e) { e.preventDefault() }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RESIZE HANDLER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  resize()

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER LOOP + FPS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let animId = null
  let lastTime = performance.now()
  let prevFrameTime = performance.now()
  let frameCount = 0
  let fps = 0

  const _moveVector = new THREE.Vector3()

  function updateFreeRoam(dt) {
    if (!isFreeRoam) return

    _moveVector.set(0, 0, 0)
    if (freeRoamKeys.forward) _moveVector.z -= 1
    if (freeRoamKeys.backward) _moveVector.z += 1
    if (freeRoamKeys.left) _moveVector.x -= 1
    if (freeRoamKeys.right) _moveVector.x += 1

    if (_moveVector.lengthSq() > 0) {
      _moveVector.normalize()
      _moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), freeRoamYaw)

      const speed = 3.5 // reasonable walking speed in m/s
      camera.position.addScaledVector(_moveVector, speed * dt)

      // Prevent camera from moving excessively far from room (Requirement 7)
      const maxBound = 22
      camera.position.x = Math.max(-maxBound, Math.min(maxBound, camera.position.x))
      camera.position.z = Math.max(-maxBound, Math.min(maxBound, camera.position.z))
      camera.position.y = Math.max(0.3, Math.min(4.5, camera.position.y))
    }
  }

  function animate(now) {
    animId = requestAnimationFrame(animate)
    const dt = Math.min((now - prevFrameTime) / 1000, 0.1)
    prevFrameTime = now

    updateFreeRoam(dt)

    frameCount++
    if (now - lastTime >= 1000) {
      fps = frameCount
      frameCount = 0
      lastTime = now
    }
    renderer.render(scene, camera)
  }
  animate(performance.now())

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LOADED-MODEL STATE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** The currently loaded scan model root (THREE.Group), or null. */
  let loadedModel = null

  /**
   * Frame the camera to fully contain a bounding box.
   * Uses the current orbit.target as the model centre and pulls the camera
   * back far enough that the entire model fits in the FOV with some padding.
   *
   * @param {THREE.Box3} box - world-space bounding box
   * @param {THREE.Vector3} [dirVector] - direction from center to camera
   */
  function frameBox(box, dirVector = new THREE.Vector3(1, 0.65, 1)) {
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)

    const maxDim = Math.max(size.x, size.y, size.z)
    const radius = Math.max(size.length() / 2, maxDim / 2, 0.2)
    const fovRad = (camera.fov * Math.PI) / 180
    const aspect = Math.max(camera.aspect, 0.2)

    // Calculate distance needed so bounding sphere fits both vertically and horizontally
    const halfV = fovRad / 2
    const halfH = Math.atan(Math.tan(halfV) * aspect)
    const limitingAngle = Math.min(halfV, halfH)

    // Distance with comfortable padding (1.35x)
    const dist = (radius / Math.sin(limitingAngle)) * 1.35

    // Keep the orbit target at the model centre
    orbit.target.copy(center)
    orbit._panOffset.set(0, 0, 0)

    // Position camera along dirVector from center
    const dir = dirVector.clone().normalize()
    camera.position.copy(center).addScaledVector(dir, dist)

    // Adjust camera clipping planes to fit the scale of this model
    camera.near = Math.min(0.01, dist / 100)
    camera.far = Math.max(200, dist * 25)
    camera.updateProjectionMatrix()

    camera.lookAt(center)
    syncSpherical()
    applySpherical()
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PUBLIC API
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return {
    // â”€â”€ Camera presets â”€â”€
    resetCamera() {
      if (isFreeRoam) setFreeRoam(false)
      if (loadedModel) {
        const { box } = computeBounds(loadedModel)
        frameBox(box)
      } else {
        camera.position.copy(DEFAULT_CAM_POS)
        orbit.target.copy(DEFAULT_CAM_TARGET)
        orbit._panOffset.set(0, 0, 0)
        camera.near = 0.05
        camera.far = 100
        camera.updateProjectionMatrix()
        camera.lookAt(DEFAULT_CAM_TARGET)
        syncSpherical()
        applySpherical()
      }
    },
    topView() {
      if (isFreeRoam) setFreeRoam(false)
      if (loadedModel) {
        const { box } = computeBounds(loadedModel)
        frameBox(box, new THREE.Vector3(0, 1, 0.0001))
      } else {
        camera.position.set(0, 14, 0.001)
        orbit.target.set(0, 0, 0)
        orbit._panOffset.set(0, 0, 0)
        syncSpherical()
        applySpherical()
      }
    },
    frontView() {
      if (isFreeRoam) setFreeRoam(false)
      if (loadedModel) {
        const { box } = computeBounds(loadedModel)
        frameBox(box, new THREE.Vector3(0, 0.2, 1))
      } else {
        camera.position.set(0, 1.5, 12)
        orbit.target.set(0, 1.5, 0)
        orbit._panOffset.set(0, 0, 0)
        syncSpherical()
        applySpherical()
      }
    },

    // â”€â”€ Model loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    /**
     * Add a loaded THREE.Group (from loader.js) to the scene.
     * Hides the demo room, updates the label sprite, and auto-frames.
     *
     * @param {THREE.Group} modelRoot - the gltf.scene root returned by loadGLTF()
     * @param {string}      filename  - original filename, for the label
     */
    loadModel(modelRoot, filename) {
      // Remove any previously loaded scan
      if (loadedModel) {
        scene.remove(loadedModel)
        loadedModel.traverse(obj => {
          if (obj.isMesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
        loadedModel = null
      }

      // Hide demo furniture and demo label when a model is loaded,
      // while keeping the room floor and walls visible around the loaded model.
      furnitureGroup.visible = false
      labelSprite.visible = false
      roomGroup.visible = false

      // Add scan model
      modelRoot.name = 'loaded-scan'
      scene.add(modelRoot)
      loadedModel = modelRoot

      // Compute bounds and auto-frame
      const { box } = computeBounds(modelRoot)
      frameBox(box)
    },

    /**
     * Remove the loaded scan and restore the demo room.
     */
    unloadModel() {
      if (!loadedModel) return

      scene.remove(loadedModel)
      loadedModel.traverse(obj => {
        if (obj.isMesh) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material?.dispose()
          }
        }
      })
      loadedModel = null

      // Restore demo furniture and label
      furnitureGroup.visible = true
      labelSprite.visible = true
      roomGroup.visible = true

      // Reset camera to default demo-room position
      camera.near = 0.05
      camera.far = 100
      camera.position.copy(DEFAULT_CAM_POS)
      orbit.target.copy(DEFAULT_CAM_TARGET)
      orbit._panOffset.set(0, 0, 0)
      camera.updateProjectionMatrix()
      camera.lookAt(DEFAULT_CAM_TARGET)
      syncSpherical()
      applySpherical()
    },

    /**
     * Re-frame the camera to fit the currently loaded model (or demo room).
     */
    frameModel() {
      const target = loadedModel ?? roomGroup
      const { box } = computeBounds(target)
      frameBox(box)
    },

    /** True when a real scan is loaded. */
    hasModel() { return loadedModel !== null },

    /**
     * Set active scene layer visibility.
     * Controls visibility of roomGroup, furnitureGroup, labelSprite, and loadedModel.
     *
     * @param {'room'|'furniture'|'scan'} layer
     */
    setScene(layer) {
      const l = String(layer).toLowerCase()
      if (l === 'scan') {
        roomGroup.visible = false
        furnitureGroup.visible = false
        labelSprite.visible = false
        if (loadedModel) loadedModel.visible = true
      } else if (l === 'furniture') {
        roomGroup.visible = true
        furnitureGroup.visible = true
        labelSprite.visible = false
        if (loadedModel) loadedModel.visible = false
      } else {
        // 'room' (default)
        roomGroup.visible = true
        furnitureGroup.visible = true
        labelSprite.visible = true
        if (loadedModel) loadedModel.visible = false
      }
    },
    selectScene(layer) {
      this.setScene(layer)
    },

    // â”€â”€ Toggles â”€â”€
    setWireframe(on) {
      scene.traverse(obj => {
        if (!obj.isMesh) return
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => { m.wireframe = on })
        } else if (obj.material) {
          obj.material.wireframe = on
        }
      })
    },
    setGrid(on) { gridHelper.visible = on },
    setAxes(on) { axesHelper.visible = on },
    setShadows(on) {
      // Shadows are disabled by default (enclosed room stays bright).
      // Toggling this primarily affects the renderer flag for future use.
      renderer.shadowMap.enabled = on
    },

    // â”€â”€ Live stats â”€â”€
    getStats() {
      return {
        fps,
        camPos: camera.position,
        camTarget: orbit.target,
      }
    },

    // â”€â”€ Count geometry for info panel â”€â”€
    getGeometryCounts() {
      let verts = 0, tris = 0
      scene.traverse(obj => {
        if (!obj.isMesh) return
        const geo = obj.geometry
        verts += geo.attributes.position?.count || 0
        tris += geo.index
          ? geo.index.count / 3
          : (geo.attributes.position?.count || 0) / 3
      })
      return { verts: Math.round(verts), tris: Math.round(tris) }
    },

    // â”€â”€ Cleanup â”€â”€
    // ── Free Roam ──
    setFreeRoam(on) {
      setFreeRoam(!!on)
    },
    isFreeRoam() {
      return isFreeRoam
    },
    onFreeRoamChange(callback) {
      onFreeRoamChangeCallback = callback
    },

    destroy() {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      renderer.dispose()
    },
  }
}

