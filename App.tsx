
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import LoadingOverlay from './components/LoadingOverlay';
import { AppMode, GeneratedImage, GenerationConfig } from './types';
import { generateWireframeImage, editWireframeImage, generateRotatingVideo } from './services/geminiService';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// Fix for TS errors: Moved AIStudio interface into global scope and ensured optional modifier
// to match environment definitions and avoid "identical modifiers" error.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.GENERATE);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [genReferenceImage, setGenReferenceImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    model: 'gemini-2.5-flash-image',
    quality: '1K'
  });

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wireframe_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem('wireframe_history', JSON.stringify(history));
      }
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }, [history]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setGenReferenceImage(canvas.toDataURL('image/png'));
        stopCamera();
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Gemini 3 models require mandatory user API key selection from a paid project
    if (config.model === 'gemini-3-pro-image-preview') {
      try {
        const hasKey = await window.aistudio?.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio?.openSelectKey();
          // Per guidelines: Assume success after openSelectKey and proceed
        }
      } catch (err) {
        console.warn("aistudio API not available");
      }
    }

    setLoading(true);
    setLoadingMsg("ANALYZING GEOMETRY & REFERENCE...");
    try {
      const imageUrl = await generateWireframeImage(prompt, config, genReferenceImage || undefined);
      const newImage: GeneratedImage = {
        id: getUUID(),
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        type: 'generation'
      };
      setHistory(prev => [newImage, ...prev]);
      setActiveMode(AppMode.GALLERY);
      setPrompt('');
      setGenReferenceImage(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Handle missing entity error by prompting for key selection again per guidelines
      if (errorMsg.includes("Requested entity was not found")) {
        alert("API key error. Please ensure you have selected a valid API key from a paid GCP project.");
        await window.aistudio?.openSelectKey();
      } else {
        alert("Generation failed: " + errorMsg);
      }
    } finally {
      setLoading(false);
      setLoadingMsg(undefined);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImageForEdit || !editPrompt.trim()) return;

    setLoading(true);
    try {
      const imageUrl = await editWireframeImage(selectedImageForEdit, editPrompt, config);
      const newImage: GeneratedImage = {
        id: getUUID(),
        url: imageUrl,
        prompt: editPrompt,
        timestamp: Date.now(),
        type: 'edit'
      };
      setHistory(prev => [newImage, ...prev]);
      setActiveMode(AppMode.GALLERY);
      setEditPrompt('');
      setSelectedImageForEdit(null);
    } catch (error) {
      alert("Edit failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRotate3D = async (image: GeneratedImage) => {
    // Veo models require mandatory user API key selection
    try {
      const hasKey = await window.aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio?.openSelectKey();
        // Per guidelines: Assume success after openSelectKey and proceed
      }
    } catch (err) {
      console.warn("aistudio API not available");
    }

    setLoading(true);
    setLoadingMsg("SYNTHESIZING 3D MOTION (Estimated: 2-3 mins)");
    try {
      const veoRatio = (config.aspectRatio === '9:16') ? '9:16' : '16:9';
      const videoUrl = await generateRotatingVideo(image.url, veoRatio);
      setHistory(prev => prev.map(img => img.id === image.id ? { ...img, videoUrl } : img));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Requested entity was not found")) {
        alert("API key error. Please select a valid paid project key.");
        await window.aistudio?.openSelectKey();
      } else {
        alert("3D Rotation failed: " + errorMsg);
      }
    } finally {
      setLoading(false);
      setLoadingMsg(undefined);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'gen' | 'edit') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'gen') setGenReferenceImage(reader.result as string);
        else setSelectedImageForEdit(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout activeMode={activeMode} onModeChange={setActiveMode}>
      {loading && <LoadingOverlay message={loadingMsg} />}

      <div className="animate-in fade-in duration-500">
        {activeMode === AppMode.GENERATE && (
          <div className="max-w-2xl mx-auto space-y-8 py-10">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <h2 className="text-3xl font-bold mono text-cyan-400 uppercase">Blueprint Generation</h2>
              </div>
              <p className="text-gray-400 leading-relaxed italic text-sm border-l-2 border-cyan-900/50 pl-4">
                "The text prompt is the source of truth. Any visual reference provided is used only for spatial inspiration."
              </p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mono font-bold">1. Primary Specification (Text Driven)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your object in detail... (e.g. A futuristic engine core with visible inner pistons and cooling fins)"
                  className="w-full h-32 bg-black border border-gray-800 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none mono text-sm shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mono">2. Structural Inspiration (Optional Hint)</label>
                
                {isCameraActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black border border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                    <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover grayscale brightness-125 contrast-125" />
                    <div className="absolute inset-0 pointer-events-none border-[1px] border-cyan-500/20">
                      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
                      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
                      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
                      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4 px-4">
                      <button type="button" onClick={capturePhoto} className="px-6 py-2 bg-cyan-500 text-black font-bold rounded-full mono text-xs uppercase hover:bg-cyan-400 transition-all">
                        CAPTURE_HINT
                      </button>
                      <button type="button" onClick={stopCamera} className="px-6 py-2 bg-red-950/80 text-red-400 font-bold rounded-full mono text-xs uppercase hover:bg-red-900 transition-all">
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : genReferenceImage ? (
                  <div className="relative group rounded-xl overflow-hidden border border-cyan-500/30 bg-black/60 shadow-xl">
                    <img src={genReferenceImage} alt="Ref" className="w-full h-48 object-contain opacity-50 contrast-125 brightness-75" />
                    
                    {/* Scanning Animation */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                       <div className="w-full h-[2px] bg-cyan-500/50 absolute animate-[scan_3s_linear_infinite] shadow-[0_0_15px_rgba(6,182,212,1)]"></div>
                    </div>

                    <button type="button" onClick={() => setGenReferenceImage(null)} className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-red-900/80 rounded-full text-white border border-white/10 transition-all z-10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="absolute bottom-3 left-3 px-3 py-1 bg-cyan-950/80 rounded border border-cyan-500/50 text-[10px] mono text-cyan-400 uppercase z-10">
                      SPATIAL_DATA_INGESTED
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-dashed border-gray-800 rounded-xl p-6 text-center hover:border-cyan-500/30 transition-all bg-black/40 group cursor-pointer relative">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'gen')} accept="image/*" />
                      <div className="text-gray-600 mb-2 transition-colors group-hover:text-cyan-400">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <p className="text-[10px] text-gray-500 mono uppercase">INSPIRATION_FILE</p>
                    </div>
                    <button type="button" onClick={startCamera} className="border border-dashed border-gray-800 rounded-xl p-6 text-center hover:border-magenta-500/30 transition-all bg-black/40 group flex flex-col items-center justify-center">
                      <div className="text-gray-600 mb-2 transition-colors group-hover:text-magenta-400">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <p className="text-[10px] text-gray-500 mono uppercase">SCAN_SILHOUETTE</p>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-600 mono ml-1 font-bold">Layout</label>
                  <select value={config.aspectRatio} onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })} className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-cyan-500/50 mono text-xs uppercase transition-colors">
                    <option value="1:1">1:1 Square</option>
                    <option value="16:9">16:9 Cinema</option>
                    <option value="9:16">9:16 Portrait</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-600 mono ml-1 font-bold">Engine</label>
                  <select value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value as any })} className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-cyan-500/50 mono text-xs uppercase transition-colors">
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option>
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] uppercase tracking-widest mono group">
                Execute Generation <span className="inline-block transition-transform group-hover:translate-x-1 ml-2">→</span>
              </button>
            </form>
          </div>
        )}

        {activeMode === AppMode.EDIT && (
          <div className="max-w-2xl mx-auto space-y-8 py-10">
             <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-magenta-500 rounded-full animate-pulse"></div>
                <h2 className="text-3xl font-bold mono text-magenta-400 uppercase">Schematic Modification</h2>
              </div>
              <p className="text-gray-400">Directly modify existing wireframe assets. This mode uses the selected image as the direct canvas for editing.</p>
            </div>

            <div className="space-y-6">
              {!selectedImageForEdit ? (
                <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 text-center hover:border-magenta-500/50 transition-all bg-black/20 group cursor-pointer relative">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'edit')} accept="image/*" />
                  <div className="text-gray-600 mb-4 transition-colors group-hover:text-magenta-400">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-gray-400 mono tracking-tighter text-lg uppercase font-bold">LOAD_CANVAS_SOURCE</p>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-magenta-900/30 bg-black shadow-2xl">
                  <img src={selectedImageForEdit} alt="Preview" className="w-full h-auto max-h-[500px] object-contain" />
                  <button onClick={() => setSelectedImageForEdit(null)} className="absolute top-4 right-4 bg-black/60 hover:bg-red-900/80 p-2 rounded-full text-white transition-all backdrop-blur-md border border-white/10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <form onSubmit={handleEdit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mono font-bold">Modification Instruction</label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Enter modification command... (e.g. Change wireframe color to Magenta and increase density)"
                    className="w-full h-32 bg-black border border-gray-800 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-magenta-500/50 mono text-sm shadow-inner transition-all"
                    disabled={!selectedImageForEdit}
                  />
                </div>
                <button type="submit" disabled={!selectedImageForEdit} className={`w-full py-4 font-bold rounded-lg transition-all uppercase tracking-widest mono ${selectedImageForEdit ? 'bg-magenta-600 hover:bg-magenta-500 text-white shadow-[0_0_20px_rgba(219,39,119,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}>
                  Apply Remodulation →
                </button>
              </form>
            </div>
          </div>
        )}

        {activeMode === AppMode.GALLERY && (
          <div className="space-y-8 py-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <h2 className="text-3xl font-bold mono text-yellow-400 uppercase tracking-tighter">Asset Archive</h2>
                </div>
              </div>
              <div className="px-4 py-2 bg-black border border-gray-800 rounded-md text-gray-400 mono text-xs">
                {history.length} OBJECTS REGISTERED
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {history.map((img) => (
                <div key={img.id} className="group relative bg-[#080808] border border-gray-800/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all hover:shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                  <div className="aspect-square bg-black flex items-center justify-center relative overflow-hidden">
                    {img.videoUrl ? (
                      <video src={img.videoUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                    ) : (
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-6">
                      <div className="space-y-2 text-left">
                        <p className="text-[10px] text-gray-500 uppercase mono border-b border-gray-800 pb-1">Spec History</p>
                        <p className="text-xs text-cyan-400 mono line-clamp-6 leading-relaxed italic">"{img.prompt}"</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        {!img.videoUrl && (
                          <button onClick={() => handleRotate3D(img)} className="w-full py-2 bg-yellow-950/50 text-yellow-500 border border-yellow-800/50 rounded mono text-[10px] uppercase font-bold hover:bg-yellow-900 transition-colors">
                            GENERATE_3D_ANIMATION
                          </button>
                        )}
                        <button onClick={() => downloadImage(img.videoUrl || img.url, `wireframe-${img.id}.${img.videoUrl ? 'mp4' : 'png'}`)} className="w-full py-2 bg-cyan-950/50 text-cyan-400 border border-cyan-800/50 rounded mono text-[10px] uppercase hover:bg-cyan-900 transition-colors">
                          DOWNLOAD_ASSET
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setSelectedImageForEdit(img.url); setActiveMode(AppMode.EDIT); window.scrollTo(0,0); }} className="py-2 bg-magenta-950/50 text-magenta-400 border border-magenta-800/50 rounded mono text-[10px] uppercase hover:bg-magenta-900 transition-colors">
                            REMODULATE
                          </button>
                          <button onClick={() => { if(confirm("Permanently delete asset?")) setHistory(prev => prev.filter(i => i.id !== img.id)) }} className="py-2 bg-red-950/50 text-red-400 border border-red-800/50 rounded mono text-[10px] uppercase hover:bg-red-900 transition-colors">
                            PURGE
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.1; }
          50% { opacity: 0.8; }
          100% { top: 100%; opacity: 0.1; }
        }
      `}</style>
    </Layout>
  );
};

export default App;
