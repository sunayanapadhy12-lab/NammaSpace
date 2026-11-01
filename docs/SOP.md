# NammaSpace — Standard Operating Procedure (SOP)

## 1. Purpose
To define a repeatable process for capturing an indoor space and converting the recorded video into a textured 3D model that can be viewed in a web browser.

## 2. Capture Procedure
1. Select the indoor area to be reconstructed.
2. Record a continuous video walkthrough using a smartphone or camera.
3. Move slowly and steadily to reduce motion blur.
4. Capture overlapping views of the room, including walls, corners and visible structural details.
5. Avoid sudden camera movements and changes in lighting where possible.
6. Keep important surfaces visible from multiple viewpoints.
7. Transfer the recorded video to the project capture folder.

## 3. Frame Extraction
1. Use the frame extraction script in `capture/extract_frames.py`.
2. Extract frames from the recorded video.
3. Review the extracted frames and remove unusable or excessively blurred images.
4. Use the selected frames as input to the reconstruction workflow.

## 4. 3D Reconstruction
1. Import the selected frames into COLMAP.
2. Run feature extraction and matching.
3. Perform sparse reconstruction and camera registration.
4. Undistort the registered images.
5. Process the undistorted scene using OpenMVS.
6. Generate the dense point cloud.
7. Reconstruct the mesh.
8. Generate texture maps and export the textured model in GLB format.

## 5. Web Viewer
1. Place the exported GLB model and its required texture files in `web/public/models/`.
2. Build and test the web application.
3. Deploy the application.
4. Open the deployed viewer and verify that the reconstructed model loads correctly.
5. Test the available orbit, pan and zoom controls.

## 6. Quality Checks
- Confirm that the input frames cover the indoor area adequately.
- Check the camera registration results.
- Review the dense point cloud and reconstructed mesh.
- Confirm that the exported model and texture load in the viewer.
- Test the deployed link in a browser.

## 7. Recorded Reconstruction Metrics
The current NammaSpace reconstruction registered 326 images, generated 15,227 sparse points and 4,494,416 dense points, and produced a mesh with 173,524 vertices and 347,024 faces.

## 8. Notes
Capture device details, video resolution, frame rate, room dimensions and exact capture settings should be recorded for future runs. They are not specified in the current project results.
