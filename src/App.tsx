import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Check, 
  Image as ImageIcon, 
  ArrowRight, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Download, 
  History, 
  Zap, 
  X, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findImageUrlInJson, formatBytes, convertToJpgBlob } from './utils';
import { UpscaleSession } from './types';

async function compressImageIfNecessary(file: File, maxSizeBytes = 1950000): Promise<File> {
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        const maxDimension = 2500;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.90;
        const attemptCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            if (blob.size <= maxSizeBytes || quality <= 0.4) {
              const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
              const fileExtension = '.jpg';
              const newFileName = `${originalBaseName}_compressed${fileExtension}`;
              
              const compressedFile = new File([blob], newFileName, {
                type: blob.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              quality -= 0.10;
              attemptCompress();
            }
          }, 'image/jpeg', quality);
        };

        attemptCompress();
      };

      img.onerror = () => {
        resolve(file);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}

const _0x4fb81 = [
  'am9pbiBDaGFubmVsIE5leGEgRGV2',
  'aHR0cHM6Ly93aGF0c2FwcC5jb20vY2hhbm5lbC8wMDI5VmI3VGtDY0QzOENTdHJBTU1iM04=',
  'TmV4YSBEZXY='
];

const _0xdec3da = (val: string) => {
  try {
    return atob(val);
  } catch (e) {
    return val;
  }
};

const PROMO_TEXT = _0xdec3da(_0x4fb81[0]);
const PROMO_URL = _0xdec3da(_0x4fb81[1]);
const BRAND_LABEL = _0xdec3da(_0x4fb81[2]);

export default function App() {
  const [showPromo, setShowPromo] = useState<boolean>(() => {
    const stored = localStorage.getItem('nexa_promo_closed_v1');
    return stored !== 'true';
  });

  const [activeSession, setActiveSession] = useState<UpscaleSession | null>(null);
  
  const [history, setHistory] = useState<UpscaleSession[]>(() => {
    try {
      const stored = localStorage.getItem('nexa_upscale_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [upscaleProgress, setUpscaleProgress] = useState<number>(0);
  const [isConvertingJpg, setIsConvertingJpg] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [isSliding, setIsSliding] = useState<boolean>(false);

  const saveToHistory = (session: UpscaleSession) => {
    setHistory((prev) => {
      const filtered = prev.filter(item => item.id !== session.id);
      const updated = [session, ...filtered].slice(0, 10);
      localStorage.setItem('nexa_upscale_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClosePromo = () => {
    setShowPromo(false);
    localStorage.setItem('nexa_promo_closed_v1', 'true');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleFileSelection(file);
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    
    const newSession: UpscaleSession = {
      id: Math.random().toString(36).substring(2, 11),
      originalName: file.name,
      originalSize: file.size,
      originalUrl: objectUrl,
      status: 'idle',
      timestamp: Date.now()
    };
    
    setActiveSession(newSession);
    processPipeline(file, newSession);
  };

  const processPipeline = async (file: File, session: UpscaleSession) => {
    let currentSession: UpscaleSession = { ...session, status: 'uploading' };
    setActiveSession(currentSession);
    setUploadProgress(15);
    
    try {
      const fileToUpload = await compressImageIfNecessary(file);
      
      const formData = new FormData();
      formData.append("files[]", fileToUpload);

      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressTimer);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      const uploadResponse = await fetch("https://clooud.my.id/uploder/", {
        method: "POST",
        body: formData
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (!uploadResponse.ok) {
        throw new Error(`Upload server responded with status: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      const extractedUrl = findImageUrlInJson(uploadData);
      
      if (!extractedUrl) {
        console.error("Upload response:", uploadData);
        throw new Error("Could not find image URL in the upload server's response. Please check server status.");
      }

      currentSession = { 
        ...currentSession, 
        uploadedUrl: extractedUrl, 
        status: 'upscaling'
      };
      setActiveSession(currentSession);
      setUpscaleProgress(10);

      const upscaleTimer = setInterval(() => {
        setUpscaleProgress((prev) => {
          if (prev >= 85) {
            clearInterval(upscaleTimer);
            return 85;
          }
          return prev + 8;
        });
      }, 400);

      const upscaleApiUrl = `https://api-faa.my.id/faa/hdv4?image=${encodeURIComponent(extractedUrl)}`;
      const upscaleResponse = await fetch(upscaleApiUrl);

      clearInterval(upscaleTimer);
      setUpscaleProgress(95);

      if (!upscaleResponse.ok) {
        throw new Error(`Upscaling failed: ${upscaleResponse.status}`);
      }

      const upscaleData = await upscaleResponse.json();
      let upscaledUrl = upscaleData?.result?.image_upscaled;
      
      if (!upscaledUrl) {
        const found = findImageUrlInJson(upscaleData);
        if (found) {
          upscaledUrl = found;
        } else {
          console.error("Upscale response payload:", upscaleData);
          throw new Error("Conversion finished, but could not retrieve high-definition image path from the server.");
        }
      }

      setUpscaleProgress(100);

      currentSession = { 
        ...currentSession, 
        upscaledUrl: upscaledUrl,
        status: 'converting'
      };
      setActiveSession(currentSession);
      setIsConvertingJpg(true);

      try {
        const conversionResult = await convertToJpgBlob(upscaledUrl);
        
        currentSession = {
          ...currentSession,
          convertedJpgUrl: conversionResult.dataUrl,
          status: 'success'
        };
        setIsConvertingJpg(false);
        setActiveSession(currentSession);
        saveToHistory(currentSession);
      } catch (convErr) {
        console.warn("Client-side JPG conversion failed, falling back directly to processed format.", convErr);
        currentSession = {
          ...currentSession,
          convertedJpgUrl: upscaledUrl,
          status: 'success'
        };
        setIsConvertingJpg(false);
        setActiveSession(currentSession);
        saveToHistory(currentSession);
      }

    } catch (err: any) {
      console.error("Pipeline failure:", err);
      currentSession = {
        ...currentSession,
        status: 'failed',
        error: err.message || "An unexpected error occurred during HD processing."
      };
      setActiveSession(currentSession);
    }
  };

  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1 || isSliding) {
      handleSliderMove(e.clientX);
    }
  };

  const handleDownload = async () => {
    if (!activeSession) return;
    const downloadUrl = activeSession.convertedJpgUrl || activeSession.upscaledUrl;
    if (!downloadUrl) return;

    setShowDownloadModal(true);

    try {
      let blob: Blob;
      
      if (downloadUrl.startsWith('data:')) {
        const parts = downloadUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        blob = new Blob([array], { type: mime });
      } else {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Fetch response not OK");
        blob = await response.blob();
      }

      const localBlobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = localBlobUrl;
      const baseName = activeSession.originalName.substring(0, activeSession.originalName.lastIndexOf('.')) || 'image';
      link.download = `${baseName}_HD.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(localBlobUrl);
      }, 5500);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to direct anchor open:", err);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      const baseName = activeSession.originalName.substring(0, activeSession.originalName.lastIndexOf('.')) || 'image';
      link.download = `${baseName}_HD.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleResetSession = () => {
    if (activeSession?.originalUrl) {
      URL.revokeObjectURL(activeSession.originalUrl);
    }
    setActiveSession(null);
    setUploadProgress(0);
    setUpscaleProgress(0);
  };

  const handleLoadHistorySession = (session: UpscaleSession) => {
    setActiveSession(session);
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('nexa_upscale_history', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsSliding(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 🚀 Nexa Dev Obfuscated WhatsApp Channel Promo Top Bar */}
      <AnimatePresence>
        {showPromo && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full bg-black text-white overflow-hidden relative shadow-md z-50"
          >
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                <span className="text-sm font-medium tracking-tight">
                  {PROMO_TEXT}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <a
                  href={PROMO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4.5 py-1.5 bg-white hover:bg-gray-100 text-black text-xs font-bold rounded-full transition-all duration-200"
                >
                  Join Channel
                  <ExternalLink className="w-3 h-3 text-black" />
                </a>
                <button
                  onClick={handleClosePromo}
                  className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
                  aria-label="Close Announcement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Minimal Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Image <span className="text-indigo-600 font-normal">HD</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
          <span className="text-indigo-600 drop-shadow-sm cursor-default">Upscaler</span>
          <span className="hover:text-gray-900 transition-colors cursor-pointer">History</span>
          <div className="h-4 w-[1px] bg-gray-200" />
          <span className="text-xs bg-indigo-550/10 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 font-mono">
            NEXA_ENGINE
          </span>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 md:py-16 flex flex-col items-center justify-center gap-10">
        
        {/* Header Title Grid */}
        <div className="text-center max-w-2xl flex flex-col items-center gap-3">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-mono font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>RESOLUSI TINGGI INTUITIVE DETAILED PROCESSING ENGINE</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-gray-900 select-none leading-none"
          >
            Transform your images to <span className="text-indigo-600">High-Definition</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-sm sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed"
          >
            Professional AI upscaling using the Nexa engine. Fast, clean, and lossless file structures.
          </motion.p>
        </div>

        {/* Core Processing Container - Card Container */}
        <section className="w-full max-w-4xl bg-white rounded-[32px] border border-gray-200/80 shadow-sm overflow-hidden relative">
          
          <AnimatePresence mode="wait">
            
            {/* IDLE state or uploading state without session */}
            {!activeSession ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="p-8 md:p-12 text-center"
              >
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-[24px] p-8 md:p-14 cursor-pointer transition-all duration-300 relative group flex flex-col items-center justify-center gap-6 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-lg shadow-indigo-100/40' 
                      : 'border-indigo-100 hover:border-indigo-300 bg-gray-50/50 hover:bg-gray-550/5'
                  }`}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Upload Icon Circle (Template Design styling) */}
                  <div className={`p-6 rounded-full transition-all duration-300 ${
                    isDragging 
                      ? 'bg-indigo-100 text-indigo-600 scale-110' 
                      : 'bg-indigo-50 text-indigo-500 group-hover:scale-110'
                  }`}>
                    <Upload className="w-9 h-9" />
                  </div>

                  <div className="flex flex-col gap-2 max-w-sm">
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      Drag & Drop Image
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      PNG, JPG or WebP up to 10MB
                    </p>
                  </div>

                  <button className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 pointer-events-none">
                    Select Files
                  </button>

                  {/* Absolute visual anchors matching template */}
                  <div className="absolute bottom-4 left-6 right-6 hidden sm:flex items-center justify-between opacity-55">
                    <div className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">POST /uploder/</div>
                    <div className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">NEXA_ENGINE</div>
                  </div>
                </div>

                {/* Important usage details notice */}
                <div className="mt-8 flex items-start gap-3 text-left p-4 bg-gray-50 border border-gray-100 rounded-2xl max-w-xl mx-auto">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-500 leading-normal">
                    <p className="font-semibold text-gray-800">Perfect Lossless Upscale</p>
                    <p className="mt-1">
                      Our secure process uploads the raster image, cleans JPEG compression bounds, processes pixel grid arrays, and exports as pristine high quality JPEG image automatically.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              
              /* Pipeline status view / Results Slider View */
              <motion.div
                key="pipeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 md:p-8 flex flex-col gap-6"
              >
                {/* Pipeline step state tracker */}
                <div className="flex flex-col gap-5 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono max-w-[200px] sm:max-w-md truncate">
                        {activeSession.originalName}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-700 bg-indigo-550/10 px-2.5 py-1 rounded-md border border-indigo-150/10">
                      {formatBytes(activeSession.originalSize)}
                    </span>
                  </div>

                  {/* Pipe/Step Progress UI */}
                  <div className="flex flex-col gap-4">
                    {/* Upload Stage progress bar */}
                    {(activeSession.status === 'uploading' || activeSession.status === 'idle') && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-gray-500 flex items-center gap-1.5 leading-none">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-550"></span>
                            </span>
                            Phase 1: Uploading to clooud.my.id ...
                          </span>
                          <span className="text-indigo-600 font-bold">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden border border-gray-200/50">
                          <motion.div 
                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Upscale processing stage bar */}
                    {activeSession.status === 'upscaling' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-indigo-600 flex items-center gap-1.5 leading-none animate-pulse">
                            <Zap className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                            Phase 2: Interpolating high-definition pixel textures...
                          </span>
                          <span className="text-indigo-600 font-bold">{upscaleProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden border border-gray-200/50">
                          <motion.div 
                            className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-500 h-full rounded-full"
                            style={{ width: `${upscaleProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Parsing and Display loading format */}
                    {activeSession.status === 'converting' && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                        <div className="flex flex-col gap-1">
                          <p className="text-xs sm:text-sm font-mono text-indigo-600 font-semibold">Phase 3: Synchronizing image blobs ...</p>
                          <p className="text-xs text-gray-500">Creating high-fidelity JPG download links</p>
                        </div>
                      </div>
                    )}

                    {/* Failed Pipeline Error Panel */}
                    {activeSession.status === 'failed' && (
                      <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-red-700 font-semibold font-mono">
                          <AlertTriangle className="w-4 h-4" />
                          <span>PROCESS PIPELINE CRITICAL RUNTIME ERROR</span>
                        </div>
                        <p className="text-red-600 leading-normal pl-6 font-mono text-xs">
                          {activeSession.error}
                        </p>
                        <button
                          onClick={handleResetSession}
                          className="mt-2 self-start flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-750 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Retry Upload
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SUCCESS VIEW - Interactive before/after comparisons and sliders */}
                {activeSession.status === 'success' && (
                  <div className="flex flex-col gap-6">
                    
                    {/* Slider container with mouse actions */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-mono font-medium text-gray-400">DRAG THE CENTER HANDLE TO COMPARE PREVIEW QUALITY</span>
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="px-2 py-0.5 bg-gray-150 border border-gray-200 text-gray-400 rounded font-semibold text-[10px]">BEFORE</span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded font-semibold text-[10px]">HD AFTER</span>
                        </div>
                      </div>

                      <div 
                        ref={sliderContainerRef}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleTouchMove}
                        onMouseDown={() => setIsSliding(true)}
                        className="relative h-[250px] sm:h-[400px] md:h-[480px] w-full bg-gray-100 rounded-2xl overflow-hidden select-none cursor-ew-resize border border-gray-200 shadow-inner group"
                      >
                        {/* Before Side (Original preview) */}
                        <img 
                          src={activeSession.originalUrl} 
                          alt="Original" 
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />

                        {/* After Side (Upscaled preview) - Cropped based on sliderPosition */}
                        <div 
                          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                          style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
                        >
                          <img 
                            src={activeSession.convertedJpgUrl || activeSession.upscaledUrl} 
                            alt="HD Upscaled" 
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Separator Slider Bar Handle */}
                        <div 
                          className="absolute inset-y-0 w-0.5 bg-indigo-500 pointer-events-none shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                          style={{ left: `${sliderPosition}%` }}
                        >
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-700 font-bold text-sm hover:scale-110 active:scale-95 transition-transform">
                            ↔
                          </div>
                        </div>

                        {/* Quick Hover instructions overlays */}
                        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/80 border border-white/5 backdrop-blur-sm text-[10px] font-mono text-gray-300 select-none pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
                          Original Layout
                        </div>
                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-indigo-600/95 border border-indigo-400 backdrop-blur-sm text-[10px] font-mono text-white select-none pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
                          HD Nexa
                        </div>
                      </div>
                    </div>

                    {/* Analytics metrics grid and Output Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-150">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-indigo-600 text-xs sm:text-sm font-mono font-bold">
                          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                          <span>HD UPSCALE PROCESS COMPLETE</span>
                        </div>
                        <p className="text-xs text-gray-500 max-w-md mt-0.5 leading-relaxed">
                          Raster file noise mitigated successfully. Final resolution scaled cleanly to pristine JPG image parameters.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleResetSession}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-white hover:bg-gray-55/10 text-gray-700 hover:text-black text-xs sm:text-sm font-bold rounded-xl border border-gray-200 hover:border-gray-300 transition-all active:scale-98"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Upscale New
                        </button>
                        
                        <button
                          onClick={handleDownload}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-98"
                        >
                          <Download className="w-4 h-4" />
                          Download JPG
                        </button>
                      </div>
                    </div>

                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </section>

        {/* Recent sessions drawer/history (Persistent Offline Engine) */}
        {history.length > 0 && (
          <section className="w-full max-w-4xl flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
              <History className="w-4 h-4 text-gray-400" />
              <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-400">
                RECENT UPSCALED IMAGES ({history.length})
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => handleLoadHistorySession(item)}
                  className={`group relative rounded-2xl overflow-hidden bg-white border cursor-pointer aspect-square transition-all duration-300 hover:scale-[1.02] hover:shadow-md flex flex-col justify-end ${
                    activeSession?.id === item.id 
                    ? 'border-indigo-500 shadow-md shadow-indigo-100 ring-2 ring-indigo-50' 
                    : 'border-gray-200'
                  }`}
                >
                  {/* Background photo preview */}
                  <img
                    src={item.convertedJpgUrl || item.upscaledUrl}
                    alt={item.originalName}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity"
                    referrerPolicy="no-referrer"
                  />

                  {/* Gradient shadow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent pointer-events-none" />

                  {/* Delete history button */}
                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/90 hover:bg-red-50 border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
                    title="Delete History Item"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-600" />
                  </button>

                  <div className="p-3.5 relative z-10 flex flex-col gap-0.5">
                    <p className="text-[11px] font-semibold text-white truncate max-w-[130px] drop-shadow-sm" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <span className="text-[9px] font-mono text-indigo-200 uppercase font-bold tracking-wider drop-shadow-sm">
                      Nexa Clean
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Modern Footer (Simple human-centered design) */}
      <footer className="w-full max-w-7xl mx-auto px-8 py-6 border-t border-gray-200 text-center flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em] bg-white select-none">
        <p>
          Powered By NexaDev  2026 &bull; Clean UI License-Free
        </p>
        <div className="flex items-center gap-4">
          <a
            href={PROMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-600 transition-colors flex items-center gap-1 tracking-normal font-sans text-xs capitalize normal-case text-gray-500"
          >
            Join Nexa Dev Channel
            <ExternalLink className="w-3 h-3 text-indigo-500" />
          </a>
        </div>
      </footer>

      {/* 📥 Beautiful Mobile-Optimized Download & Gallery Helper Modal */}
      <AnimatePresence>
        {showDownloadModal && activeSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            {/* Modal Backdrop animation */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setShowDownloadModal(false)}
            />

            {/* Modal Card Content */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl z-10 border border-gray-100 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-900 leading-none">Gambar Siap Diunduh</h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase tracking-wider">Save directly to your gallery</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Scrollable Body content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 items-center text-center">
                
                {/* Visual guidance info alert */}
                <div className="flex gap-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4.5 text-left w-full">
                  <div className="bg-indigo-100 text-indigo-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">i</div>
                  <div className="text-xs text-indigo-900 leading-relaxed font-sans">
                    <p className="font-bold">Tips Simpan ke Galeri / HP:</p>
                    <p className="mt-1">
                      Unduhan otomatis telah dijalankan. Jika tidak terunduh otomatis, silakan <strong>tekan lama (hold)</strong> gambar di bawah ini lalu pilih <strong>&quot;Simpan Gambar&quot;</strong> atau <strong>&quot;Download Gambar&quot;</strong>.
                    </p>
                  </div>
                </div>

                {/* Main Interactive long-pressable image (No pointer-events-none!) */}
                <div className="relative border border-gray-200 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center p-2 max-w-xs group shadow-inner">
                  <img
                    src={activeSession.convertedJpgUrl || activeSession.upscaledUrl}
                    alt="Pristine HD File"
                    className="max-h-[220px] rounded-lg object-contain cursor-pointer active:scale-98 transition-transform"
                    referrerPolicy="no-referrer"
                    title="Tekan lama untuk menyimpan gambar"
                    style={{ pointerEvents: 'auto' }}
                  />
                  <div className="absolute inset-x-0 bottom-3 text-[9px] font-mono text-white bg-black/60 backdrop-blur-sm mx-auto px-2 py-1 rounded w-fit select-none pointer-events-none opacity-80">
                    💡 TEKAN LAMA UNTUK SIMPAN
                  </div>
                </div>

                {/* Filename status bar */}
                <div className="w-full bg-gray-50 border border-gray-150 py-2.5 px-4 rounded-xl text-left flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono font-medium truncate text-gray-500 max-w-[200px]" title={activeSession.originalName}>
                    {activeSession.originalName.replace(/\.[^/.]+$/, "")}_HD.jpg
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase">
                    HD image
                  </span>
                </div>
              </div>

              {/* Footer actions */}
              <div className="bg-gray-50 border-t border-gray-150 p-4.5 flex gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 py-2.5 font-bold text-xs sm:text-sm bg-white hover:bg-gray-100 text-gray-700 hover:text-black rounded-xl border border-gray-200 transition-all text-center"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
