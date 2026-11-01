# Namma Space — Smartphone Capture Guide & Workflow

This folder manages the first stage of the Namma Space pipeline: **capturing a real indoor room using a smartphone** and extracting high-quality keyframes for 3D reconstruction.

---

## 1. Directory Structure

```
capture/
├── raw/                 ← Put your original smartphone video (.mp4/.mov) or photo bursts here
├── selected/            ← Extracted, blur-filtered keyframes ready for 3D reconstruction
├── extract_frames.py    ← Automated ingestion and keyframe extraction script
└── README.md            ← This guide
```

---

## 2. Smartphone Recording Best Practices

To give the local reconstruction pipeline the best possible chance of producing an accurate 3D model:

1. **Continuous Video or Photo Set:**
   - **Video:** Walk slowly around the room in a smooth loop while holding the phone steady at chest level (30–60 seconds).
   - **Photos:** Take 40–80 overlapping photos (~70–80% visual overlap between consecutive shots).
2. **Even, Diffuse Lighting:**
   - Turn on all room lights.
   - Avoid pointing the camera directly into glaring light bulbs or blinding sunlit windows.
3. **Movement & Coverage:**
   - Walk in a perimeter loop looking inwards towards the center, then take a second pass looking slightly downwards at furniture/floor.
   - Avoid fast rotations or sudden whipping motions, which introduce severe motion blur.
4. **Resolution:**
   - 1080p (1920×1080) or 4K at 30 fps is ideal.

---

## 3. Prerequisites

The extraction script requires `opencv-python` and `numpy`:

```powershell
# In Windows Terminal / PowerShell:
pip install opencv-python numpy
```

Or using the full Python 3.12 path:
```powershell
& "C:\Users\Dell\AppData\Local\Programs\Python\Python312\python.exe" -m pip install opencv-python numpy
```

---

## 4. How to Run Keyframe Extraction

### Option A: Automatic Detection
Drop your smartphone video (e.g. `room_tour.mp4`) into `capture/raw/`, then run:

```powershell
python capture/extract_frames.py
```
The script will automatically detect the video in `capture/raw/` and extract sharp frames into `capture/selected/`.

### Option B: Specify Video Directly
```powershell
python capture/extract_frames.py --input capture/raw/living_room.mp4 --fps 2.0
```

### Option C: Process a Folder of Still Photos
```powershell
python capture/extract_frames.py --input capture/raw/photos/ --output capture/selected/
```

### Option D: Algorithm Self-Test
```powershell
python capture/extract_frames.py --test
```

---

## 5. What the Script Does

1. **Uniform Temporal Sampling:** Extracts frames at `--fps 2.0` (default: 2 frames per second), converting a 30s video into ~60 well-spaced viewpoints.
2. **Motion Blur Filtering:** Computes the Laplacian variance ($\nabla^2$) for each frame. Frames that fail the sharpness threshold (`--blur-threshold 80`) due to rapid motion are rejected.
3. **Redundant Frame Suppression:** Measures the difference metric between consecutive candidates. If you pause or stand still, duplicates are skipped (`--diff-threshold 0.04`).
4. **Safety Cap:** Defaults to `--max-frames 150` to ensure CPU reconstruction does not run out of memory.

> **Note:** Frame extraction prepares the input dataset. It is **Phase 1** of the pipeline and does not claim to reconstruct 3D geometry by itself. The extracted frames in `capture/selected/` are consumed by **Phase 2 (3D Reconstruction)** to produce the final `.glb` model.
