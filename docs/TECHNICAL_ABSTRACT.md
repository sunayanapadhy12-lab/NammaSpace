# NammaSpace — Technical Abstract

## Title
Video-Based 3D Reconstruction and Browser-Based Visualization of Indoor Spaces

## Abstract
NammaSpace is a proof-of-concept system for reconstructing an indoor environment from video and presenting the resulting textured 3D model through a web-based viewer. The workflow combines photogrammetric reconstruction with browser-based 3D visualization.

Video frames are extracted and processed using COLMAP to estimate camera poses and generate a sparse point cloud. The registered images are then undistorted and processed using OpenMVS to generate a dense point cloud, reconstruct a mesh, and produce a textured 3D model. The resulting GLB model and texture are loaded into a Three.js viewer and deployed as a web application.

## Reconstruction Results
- Registered images: 326
- Sparse points: 15,227
- Observations: 245,843
- Mean track length: 16.145
- Mean reprojection error: 0.892 pixels
- Dense point cloud: 4,494,416 points
- Mesh vertices: 173,524
- Mesh faces: 347,024
- Textured GLB: approximately 9.45 MB
- External texture: approximately 10.96 MB

## Technology
COLMAP, OpenMVS, Three.js, JavaScript, Vite and Vercel.

## Outcome
The proof of concept demonstrates an end-to-end indoor reconstruction workflow and a publicly accessible browser-based 3D viewer.

## Current Viewer Interaction
The viewer supports mouse-based orbit, pan and zoom. These controls should not be interpreted as first-person free-roaming navigation.
