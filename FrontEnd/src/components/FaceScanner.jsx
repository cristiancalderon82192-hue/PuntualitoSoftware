import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, X } from 'lucide-react';

export default function FaceScanner({ onScanSuccess, onCancel, autoScan = false }) {
  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (autoScan && isModelsLoaded && !isScanning) {
      intervalRef.current = setInterval(() => {
        scanFaceSilently();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoScan, isModelsLoaded, isScanning]);

  useEffect(() => {
    let active = true;
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        if (active) {
          setIsModelsLoaded(true);
          startCamera();
        }
      } catch (err) {
        if (active) setError('Error al cargar modelos de reconocimiento facial.');
      }
    };
    loadModels();

    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (err) {
      setError('No se pudo acceder a la cámara. Por favor, da los permisos necesarios.');
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const scanFaceSilently = async () => {
    if (!videoRef.current || !isModelsLoaded) return;
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const descriptorArray = Array.from(detection.descriptor);

        stopCamera();
        onScanSuccess(JSON.stringify(descriptorArray));
      }
    } catch (err) {
      // Ignorar errores silenciosamente en el auto escaneo
    }
  };

  const scanFace = async () => {
    if (!videoRef.current || !isModelsLoaded) return;

    setIsScanning(true);
    setError('');

    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const descriptorArray = Array.from(detection.descriptor);

        stopCamera();
        onScanSuccess(JSON.stringify(descriptorArray));
      } else {
        setError('No se detectó ningún rostro. Asegúrate de mirar directamente a la cámara con buena iluminación.');
        setIsScanning(false);
      }
    } catch (err) {
      setError('Error durante el escaneo.');
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-slate-900 rounded-xl relative overflow-hidden">
      <div className="absolute top-2 right-2 z-10">
        <button type="button" onClick={() => { stopCamera(); onCancel(); }} className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <h3 className="text-white font-medium mb-3">Escáner Facial</h3>

      {!isModelsLoaded ? (
        <div className="w-full max-w-sm h-64 bg-slate-800 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-600">
          <div className="text-slate-400 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-slate-400 border-t-purple-500 rounded-full animate-spin mb-2"></div>
            <p>Cargando modelos de IA...</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-sm rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg shadow-purple-500/20">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto object-cover transform scale-x-[-1]"
          />

          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none rounded-lg">
            <div className="w-full h-full border-2 border-dashed border-white/50 rounded-[40%]"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-red-400 text-sm bg-red-900/30 p-2 rounded-lg border border-red-900/50 w-full text-center">
          {error}
        </div>
      )}

      {!autoScan && (
        <button
          type="button"
          onClick={scanFace}
          disabled={!isModelsLoaded || isScanning}
          className="mt-4 flex items-center justify-center space-x-2 w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg disabled:opacity-50 transition-all"
        >
          {isScanning ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Camera className="w-5 h-5" />
          )}
          <span>{isScanning ? 'Analizando...' : 'Capturar Rostro'}</span>
        </button>
      )}
      {autoScan && isModelsLoaded && (
        <div className="mt-4 text-center text-slate-300 text-sm flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          Escaneando rostro automáticamente...
        </div>
      )}
    </div>
  );
}
