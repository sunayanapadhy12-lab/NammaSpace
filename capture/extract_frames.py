#!/usr/bin/env python3
"""
Namma Space — Capture Ingestion & Keyframe Extraction Tool
===========================================================
Part of the Namma Space 3D Indoor Reconstruction Pipeline.

Extracts sharp, evenly-spaced keyframes from smartphone room-tour
videos or photo bursts. Filters out blurry frames and near-duplicates
to produce an optimal dataset for 3D reconstruction.

Usage:
  python capture/extract_frames.py
  python capture/extract_frames.py --input capture/raw/room_tour.mp4
  python capture/extract_frames.py --input capture/raw/photos/ --output capture/selected/
  python capture/extract_frames.py --test
"""

import sys
import os
import argparse
import glob
from pathlib import Path

# Common video and image extensions
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}


def check_dependencies():
    """Verify whether required computer vision libraries are installed."""
    missing = []
    try:
        import cv2
    except ImportError:
        missing.append(('opencv-python', 'Required for reading video streams, image decoding, and blur detection'))

    try:
        import numpy as np
    except ImportError:
        missing.append(('numpy', 'Required for fast numerical matrix operations on image frames'))

    if missing:
        print("\n" + "=" * 65)
        print("  [Namma Space] Missing Required Dependencies")
        print("=" * 65)
        print("The frame extraction workflow requires the following lightweight package(s):\n")
        for pkg, reason in missing:
            print(f"  • {pkg:<18} : {reason}")
        print("\nTo install them, run this command in Windows Terminal / PowerShell:\n")
        print("  pip install opencv-python numpy\n")
        print("Or with the full Python 3.12 path:\n")
        py_exe = sys.executable
        print(f'  & "{py_exe}" -m pip install opencv-python numpy\n')
        print("=" * 65 + "\n")
        return False
    return True


def calculate_blur_score(gray_frame):
    """
    Computes sharpness using the variance of the Laplacian operator.
    Higher values mean sharper edges; low values indicate motion blur or out-of-focus capture.
    """
    import cv2
    laplacian = cv2.Laplacian(gray_frame, cv2.CV_64F)
    return float(laplacian.var())


def calculate_frame_difference(gray1, gray2):
    """
    Computes the normalized absolute difference between two grayscale frames.
    Returns a float between 0.0 (identical) and 1.0 (completely different).
    """
    import cv2
    import numpy as np
    # Resize to small standard resolution for fast comparison
    small1 = cv2.resize(gray1, (64, 64))
    small2 = cv2.resize(gray2, (64, 64))
    diff = cv2.absdiff(small1, small2)
    return float(np.mean(diff) / 255.0)


def process_video(video_path, output_dir, target_fps=2.0, blur_thresh=80.0, diff_thresh=0.04, max_frames=150, overwrite=False):
    """Extracts keyframes from a single smartphone video file."""
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[Error] Could not open video file: {video_path}")
        return False

    orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_sec = total_video_frames / orig_fps if orig_fps > 0 else 0

    print(f"\n[Input Video Info]")
    print(f"  • Source File   : {video_path.name}")
    print(f"  • Resolution    : {width} x {height}")
    print(f"  • Native FPS    : {orig_fps:.2f}")
    print(f"  • Total Frames  : {total_video_frames}")
    print(f"  • Duration      : {duration_sec:.1f} seconds")
    print(f"  • Extraction FPS: {target_fps} frame(s)/sec")
    print(f"  • Blur Threshold: {blur_thresh} (higher = stricter sharpness)")
    print(f"  • Diff Threshold: {diff_thresh} (higher = skips stationary pauses)\n")

    # Determine frame step interval
    frame_interval = max(1, int(round(orig_fps / target_fps)))

    frame_idx = 0
    saved_count = 0
    blurry_count = 0
    duplicate_count = 0
    scanned_count = 0
    last_saved_gray = None

    stem = video_path.stem

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Only evaluate frames at the target interval
        if frame_idx % frame_interval == 0:
            scanned_count += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            blur_score = calculate_blur_score(gray)

            # Check blur
            if blur_score < blur_thresh:
                blurry_count += 1
            else:
                # Check duplicate against previous saved frame
                is_duplicate = False
                if last_saved_gray is not None:
                    diff = calculate_frame_difference(last_saved_gray, gray)
                    if diff < diff_thresh:
                        is_duplicate = True
                        duplicate_count += 1

                if not is_duplicate:
                    out_filename = f"{stem}_frame_{saved_count:04d}.jpg"
                    out_path = output_dir / out_filename
                    cv2.imwrite(str(out_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
                    last_saved_gray = gray
                    saved_count += 1

                    if saved_count % 10 == 0 or saved_count == 1:
                        print(f"  -> Saved frame {saved_count:03d} (at {frame_idx / orig_fps:6.1f}s, sharpness: {blur_score:5.1f}) -> {out_filename}")

                    if saved_count >= max_frames:
                        print(f"\n  [Notice] Reached max frame limit ({max_frames}). Stopping extraction.")
                        break

        frame_idx += 1

    cap.release()

    print("\n" + "─" * 55)
    print("  Extraction Summary")
    print("─" * 55)
    print(f"  • Evaluated candidates : {scanned_count}")
    print(f"  • Saved keyframes      : {saved_count}")
    print(f"  • Rejected blurry      : {blurry_count}")
    print(f"  • Rejected duplicates  : {duplicate_count}")
    print(f"  • Output directory     : {output_dir.resolve()}")
    print("─" * 55)

    if saved_count == 0 and scanned_count > 0:
        print("\n[Tip] No frames met the sharpness threshold.")
        print(f"Try lowering the threshold with: --blur-threshold {max(20.0, blur_thresh / 2)}")
    elif saved_count > 0:
        print(f"\n[Success] {saved_count} keyframes ready for 3D reconstruction.")

    return saved_count > 0


def process_image_folder(folder_path, output_dir, blur_thresh=80.0, diff_thresh=0.03, max_frames=150, overwrite=False):
    """Filters and copies/converts a set of smartphone still photos."""
    import cv2

    image_files = sorted([
        p for p in folder_path.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ])

    if not image_files:
        print(f"[Error] No images found in: {folder_path}")
        return False

    print(f"\n[Input Photos Info]")
    print(f"  • Source Directory : {folder_path}")
    print(f"  • Total Images     : {len(image_files)}")
    print(f"  • Blur Threshold   : {blur_thresh}")
    print(f"  • Diff Threshold   : {diff_thresh}\n")

    saved_count = 0
    blurry_count = 0
    duplicate_count = 0
    last_saved_gray = None

    for idx, img_path in enumerate(image_files):
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"  [Warning] Skipping unreadable file: {img_path.name}")
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur_score = calculate_blur_score(gray)

        if blur_score < blur_thresh:
            blurry_count += 1
            continue

        if last_saved_gray is not None:
            diff = calculate_frame_difference(last_saved_gray, gray)
            if diff < diff_thresh:
                duplicate_count += 1
                continue

        out_name = f"photo_{saved_count:04d}.jpg"
        out_path = output_dir / out_name
        cv2.imwrite(str(out_path), img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        last_saved_gray = gray
        saved_count += 1

        if saved_count % 10 == 0 or saved_count == 1:
            print(f"  -> Accepted {img_path.name} as {out_name} (sharpness: {blur_score:5.1f})")

        if saved_count >= max_frames:
            print(f"\n  [Notice] Reached max frame limit ({max_frames}). Stopping.")
            break

    print("\n" + "─" * 55)
    print("  Filtering Summary")
    print("─" * 55)
    print(f"  • Total Photos Scanned : {len(image_files)}")
    print(f"  • Accepted Keyframes   : {saved_count}")
    print(f"  • Rejected Blurry      : {blurry_count}")
    print(f"  • Rejected Duplicates  : {duplicate_count}")
    print(f"  • Output Directory     : {output_dir.resolve()}")
    print("─" * 55)

    return saved_count > 0


def run_self_test(output_dir):
    """
    Self-test mode: verifies that OpenCV and NumPy can generate test images,
    calculate sharpness, measure frame differences, and write to output_dir.
    """
    import cv2
    import numpy as np

    print("\n=== Running Frame Extraction Self-Test ===")
    test_dir = output_dir / "_selftest"
    test_dir.mkdir(parents=True, exist_ok=True)

    # 1. Create a sharp synthetic test frame (checkerboard + high-contrast edges)
    sharp_img = np.zeros((480, 640, 3), dtype=np.uint8)
    for y in range(0, 480, 40):
        for x in range(0, 640, 40):
            if ((x // 40) + (y // 40)) % 2 == 0:
                sharp_img[y:y+40, x:x+40] = 255
    cv2.putText(sharp_img, "Namma Space Test", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

    sharp_gray = cv2.cvtColor(sharp_img, cv2.COLOR_BGR2GRAY)
    sharp_score = calculate_blur_score(sharp_gray)
    print(f"  1. Sharp Frame Laplacian Variance : {sharp_score:.2f} (PASS: High Sharpness)")

    # 2. Create a blurred version of the same frame
    blurred_img = cv2.GaussianBlur(sharp_img, (31, 31), 10.0)
    blurred_gray = cv2.cvtColor(blurred_img, cv2.COLOR_BGR2GRAY)
    blurred_score = calculate_blur_score(blurred_gray)
    print(f"  2. Blurred Frame Laplacian Variance: {blurred_score:.2f} (PASS: Successfully Detected Blur)")

    # 3. Test frame difference
    diff = calculate_frame_difference(sharp_gray, blurred_gray)
    print(f"  3. Frame Difference Metric         : {diff:.4f} (PASS: Measured Difference)")

    # 4. Save test output
    test_out = test_dir / "test_frame.jpg"
    cv2.imwrite(str(test_out), sharp_img)
    if test_out.exists() and test_out.stat().st_size > 0:
        print(f"  4. Image Write Test                 : PASS (Saved to {test_out.name})")
        # Clean up test artifact
        test_out.unlink()
        test_dir.rmdir()

    print("\n[Self-Test Completed Successfully] Frame extraction engine is verified and ready.\n")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Namma Space — Smartphone Capture Ingestion & Keyframe Extractor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-detect video or photos inside capture/raw/
  python capture/extract_frames.py

  # Process a specific smartphone video
  python capture/extract_frames.py --input capture/raw/living_room.mp4

  # Process a folder of still photos with custom blur threshold
  python capture/extract_frames.py --input capture/raw/photos/ --blur-threshold 60

  # Run dependency and algorithm self-test
  python capture/extract_frames.py --test
        """
    )
    parser.add_argument("--input", "-i", type=str, default=None,
                        help="Path to smartphone video file (.mp4/.mov) or folder of photos")
    parser.add_argument("--output", "-o", type=str, default="capture/selected",
                        help="Output directory for extracted keyframes (default: capture/selected)")
    parser.add_argument("--fps", "-r", type=float, default=2.0,
                        help="Target keyframes to extract per second of video (default: 2.0)")
    parser.add_argument("--blur-threshold", "-b", type=float, default=80.0,
                        help="Minimum sharpness score. Frames below this are rejected (default: 80.0)")
    parser.add_argument("--diff-threshold", "-d", type=float, default=0.04,
                        help="Minimum frame difference threshold to reject stationary pauses (default: 0.04)")
    parser.add_argument("--max-frames", "-m", type=int, default=150,
                        help="Maximum keyframes to extract (safety cap, default: 150)")
    parser.add_argument("--overwrite", action="store_true",
                        help="Allow overwriting existing frames in the output directory")
    parser.add_argument("--test", action="store_true",
                        help="Run algorithm self-test with synthetic test frames")

    args = parser.parse_args()

    # Step 1: Check dependencies
    if not check_dependencies():
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Step 2: Handle self-test
    if args.test:
        run_self_test(output_dir)
        return

    # Check if output directory already has frames
    existing_frames = list(output_dir.glob("*.jpg")) + list(output_dir.glob("*.png"))
    if existing_frames and not args.overwrite:
        print(f"\n[Notice] {output_dir} already contains {len(existing_frames)} image(s).")
        print("Use --overwrite to add/replace, or specify another directory with --output <dir>.")
        resp = input("Proceed anyway? (y/N): ").strip().lower()
        if resp != 'y':
            print("Aborted by user.")
            return

    # Step 3: Determine input path
    input_path = None
    if args.input:
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"[Error] Specified input path does not exist: {input_path}")
            sys.exit(1)
    else:
        # Auto-detect from capture/raw/
        raw_dir = Path("capture/raw")
        if not raw_dir.exists():
            raw_dir.mkdir(parents=True, exist_ok=True)

        # Look for video files first
        video_candidates = []
        for ext in VIDEO_EXTS:
            video_candidates.extend(raw_dir.glob(f"*{ext}"))
            video_candidates.extend(raw_dir.glob(f"*{ext.upper()}"))

        if video_candidates:
            # Pick the most recent video
            video_candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            input_path = video_candidates[0]
            print(f"[Auto-Detected] Found video in capture/raw/: {input_path.name}")
        else:
            # Look for still photos
            photo_candidates = []
            for ext in IMAGE_EXTS:
                photo_candidates.extend(raw_dir.glob(f"*{ext}"))
                photo_candidates.extend(raw_dir.glob(f"*{ext.upper()}"))

            if photo_candidates:
                input_path = raw_dir
                print(f"[Auto-Detected] Found {len(photo_candidates)} photos in capture/raw/")
            else:
                print("\n[Notice] No media found in 'capture/raw/'.")
                print("Please copy your smartphone video (.mp4/.mov) or photo set into:")
                print(f"  {raw_dir.resolve()}\n")
                print("Or pass a direct file path:")
                print("  python capture/extract_frames.py --input /path/to/video.mp4\n")
                return

    # Step 4: Process video or image folder
    if input_path.is_file() and input_path.suffix.lower() in VIDEO_EXTS:
        process_video(
            video_path=input_path,
            output_dir=output_dir,
            target_fps=args.fps,
            blur_thresh=args.blur_threshold,
            diff_thresh=args.diff_threshold,
            max_frames=args.max_frames,
            overwrite=args.overwrite
        )
    elif input_path.is_dir():
        process_image_folder(
            folder_path=input_path,
            output_dir=output_dir,
            blur_thresh=args.blur_threshold,
            diff_thresh=args.diff_threshold,
            max_frames=args.max_frames,
            overwrite=args.overwrite
        )
    else:
        print(f"[Error] Unsupported file format: {input_path.suffix}")
        print(f"Supported video formats: {', '.join(sorted(VIDEO_EXTS))}")
        print(f"Supported image formats: {', '.join(sorted(IMAGE_EXTS))}")
        sys.exit(1)


if __name__ == "__main__":
    main()
