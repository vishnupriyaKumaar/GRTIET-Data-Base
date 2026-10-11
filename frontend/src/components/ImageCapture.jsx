import React, { useEffect, useRef, useState } from "react";
import { compressImageToLimit } from "../imageCompression.js";
import { IconCamera } from "./Icons.jsx";

// Optional photo/signature picker: choose a file OR capture live from the
// camera. Whatever comes in (file or camera frame) is auto-compressed in
// the browser to fit under `maxBytes`, so a student never has to know or
// care how big their original photo file was.
export default function ImageCapture({ id, label, value, onChange, maxBytes = 24 * 1024, kind = "photo" }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopCamera(), []); // always release the camera on unmount

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // videoRef isn't attached until after this render, so hand off the
      // stream once the <video> element exists.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (e) {
      setError("Could not access the camera. You can upload a file instead.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const file = await compressImageToLimit(dataUrl, { maxBytes, maxDim: kind === "signature" ? 520 : 420, filename: `${kind}-capture.jpg` });
      onChange(file);
      stopCamera();
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e) {
    const raw = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file later
    if (!raw) return;
    if (!["image/png", "image/jpeg"].includes(raw.type)) {
      setError(`${kind === "photo" ? "Photo" : "Signature"} must be a PNG or JPG image.`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const compressed = await compressImageToLimit(raw, { maxBytes, maxDim: kind === "signature" ? 520 : 420, filename: `${kind}.jpg` });
      onChange(compressed);
    } catch (e) {
      setError("Could not process that image. Please try another.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    onChange(null);
    setError("");
  }

  return (
    <div className="image-capture">
      {cameraOn && (
        <div className="camera-box">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="camera-actions">
            <button type="button" className="btn-primary" onClick={capture} disabled={busy}>
              <IconCamera /> {busy ? "Capturing..." : "Capture"}
            </button>
            <button type="button" className="btn-secondary" onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!cameraOn && (
        <div className="image-capture-row">
          <label htmlFor={id} className="btn-secondary file-btn">
            Choose File
            <input id={id} type="file" accept=".png,.jpg,.jpeg" onChange={handleFile} hidden />
          </label>
          <button type="button" className="btn-secondary" onClick={startCamera} disabled={busy}>
            <IconCamera /> Use Camera
          </button>
          {value && (
            <button type="button" className="btn-secondary" onClick={clear}>
              Remove
            </button>
          )}
        </div>
      )}

      {busy && !cameraOn && <p className="hint-text">Compressing image...</p>}
      {value && !busy && (
        <p className="hint-text">Selected: {value.name} ({Math.ceil(value.size / 1024)}KB, auto-compressed to fit under {Math.round(maxBytes / 1024)}KB)</p>
      )}
      {error && <p className="error-text">{error}</p>}
      <p className="hint-text">{label} is optional - it can also be added later from Update.</p>
    </div>
  );
}
