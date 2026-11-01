# NammaSpace — 3D Indoor Reconstruction & Viewer

NammaSpace is a web-based platform for reconstructing an indoor space from video and viewing the resulting textured 3D model in a browser.

## Round 1 Proof of Concept

**Live viewer:** https://nammaspace-eta.vercel.app

The deployed viewer loads the reconstructed indoor room model (`namma_room.glb`) with its associated texture.

## Reconstruction Pipeline

1. Record a video walkthrough of the indoor space.
2. Extract frames from the video.
3. Use COLMAP for camera registration and sparse reconstruction.
4. Undistort the registered images.
5. Use OpenMVS for dense point-cloud generation, mesh reconstruction and texturing.
6. Export the textured 3D model as GLB.
7. Load the model in the Three.js web viewer.

## Reconstruction Results

- Registered images: 326
- Sparse points: 15,227
- Observations: 245,843
- Mean track length: 16.145
- Mean reprojection error: 0.892 pixels
- Dense point cloud: 4,494,416 points
- Reconstructed mesh: 173,524 vertices and 347,024 faces
- Textured GLB model: approximately 9.45 MB
- External texture: approximately 10.96 MB

## Technology Stack

- COLMAP — camera registration and sparse reconstruction
- OpenMVS — dense reconstruction, meshing and texturing
- Three.js — browser


