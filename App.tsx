import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import LoadingOverlay from './components/LoadingOverlay';
import { AppMode, GeneratedImage, GenerationConfig } from './types';
import { generateWireframeImage, editWireframeImage, generateRotatingVideo } from './services/geminiService';

// Fallback for UUID generation if crypto.randomUUID is not available
const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// Fixed AIStudio interface definition to avoid collision with potential global AIStudio types
interface AppAIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Added optionality to match potential existing declarations and avoid "identical modifiers" errors
    aistudio?: AppAIStudio;
  }
}

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.GENERATE);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    model: 'gemini-2.5-flash-image',
    quality: '1K'
  });

  // Load history from localStorage on mount with safety checks
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wireframe_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        } else {
          console.warn("History in localStorage is not an array, resetting.");
          localStorage.removeItem('wireframe_history');
        }
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem('wireframe_history', JSON.stringify(history));
      }
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (config.model === 'gemini-3-pro-image-preview') {
      try {
        // Safe access to window.aistudio with optional chaining
        const hasKey = await window.aistudio?.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio?.openSelectKey();
        }
      } catch (err) {
        console.warn("aistudio API not available, continuing with default env key");
      }
    }

    setLoading(true);
    setLoadingMsg(undefined);
    try {
      const imageUrl = await generateWireframeImage(prompt, config);
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
    } catch (error) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Requested entity was not found")) {
        alert("API Key error. Please re-select your key using the settings (if available).");
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        alert("Generation failed: " + errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImageForEdit || !editPrompt.trim()) return;

    setLoading(true);
    setLoadingMsg(undefined);
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
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      alert("Edit failed: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRotate3D = async (image: GeneratedImage) => {
    try {
      // Safe access to window.aistudio with optional chaining
      const hasKey = await window.aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio?.openSelectKey();
      }
    } catch (err) {
      console.warn("aistudio API not available");
    }

    setLoading(true);
    setLoadingMsg("SYNTHESIZING 3D MOTION (Estimated: 2-3 mins)");
    try {
      const veoRatio = (config.aspectRatio === '9:16') ? '9:16' : '16:9';
      const videoUrl = await generateRotatingVideo(image.url, veoRatio);
      
      setHistory(prev => prev.map(img => 
        img.id === image.id ? { ...img, videoUrl } : img
      ));
    } catch (error) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      if (errorMsg.includes("Requested entity was not found")) {
        alert("API Key error for video generation.");
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        alert("3D Rotation failed: " + errorMsg);
      }
    } finally {
      setLoading(false);
      setLoadingMsg(undefined);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImageForEdit(reader.result as string);
      };
      reader.onerror = () => alert("Failed to read file.");
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Download failed. The file may be in a temporary state.");
    }
  };

  const deleteFromHistory = (id: string) => {
    if (confirm("Delete this schematic from local archive?")) {
      setHistory(prev => prev.filter(img => img.id !== id));
    }
  };

  const selectForEditFromGallery = (img: GeneratedImage) => {
    setSelectedImageForEdit(img.url);
    setActiveMode(AppMode.EDIT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                <h2 className="text-3xl font-bold mono text-cyan-400">Blueprint Generation</h2>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Describe the object you want to architect into a 3D wireframe schematic. 
                Our engine will interpret geometry, vertices, and wire mesh topologies.
              </p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mono">Object Specification</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A vintage rotary telephone reimagined with internal futuristic AI components..."
                  className="w-full h-40 bg-black border border-gray-800 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mono">Aspect Ratio</label>
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-cyan-500/50 mono"
                  >
                    <option value="1:1">1:1 Square</option>
                    <option value="16:9">16:9 Cinema</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="4:3">4:3 Retro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mono">Processor Model</label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value as any })}
                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-cyan-500/50 mono"
                  >
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option>
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro (High Quality)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] uppercase tracking-widest mono group"
              >
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
                <h2 className="text-3xl font-bold mono text-magenta-400">Schematic Modification</h2>
              </div>
              <p className="text-gray-400">Modify existing wireframes or upload your own to convert them to the strict CAD aesthetic.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mono">Reference Image</label>
                {!selectedImageForEdit ? (
                  <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 text-center hover:border-magenta-500/50 transition-all bg-black/20 group cursor-pointer relative">
                    <input
                      type="file"
                      id="file-upload"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                    <div className="text-gray-600 mb-4 transition-colors group-hover:text-magenta-400">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 mono tracking-tighter text-lg group-hover:text-magenta-400">UPLOAD SOURCE FILE</p>
                    <p className="text-xs text-gray-600 mt-2 mono">PNG // JPG // WEBP // TIFF</p>
                  </div>
                ) : (
                  <div className="relative group rounded-xl overflow-hidden border border-magenta-900/30 bg-black shadow-2xl">
                    <img src={selectedImageForEdit} alt="Preview" className="w-full h-auto max-h-[500px] object-contain" />
                    <button 
                      onClick={() => setSelectedImageForEdit(null)}
                      className="absolute top-4 right-4 bg-black/60 hover:bg-red-900/80 p-2 rounded-full text-white transition-all backdrop-blur-md border border-white/10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded border border-white/10 text-[10px] mono text-magenta-400">
                      REFERENCE_LOADED_OK
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleEdit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mono">Modification Command</label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g., Increase mesh density, change primary color to Electric Yellow, or add internal mechanical components..."
                    className="w-full h-32 bg-black border border-gray-800 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-magenta-500/50 focus:ring-1 focus:ring-magenta-500/20 transition-all resize-none mono text-sm"
                    disabled={!selectedImageForEdit}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedImageForEdit}
                  className={`w-full py-4 font-bold rounded-lg transition-all uppercase tracking-widest mono group ${
                    selectedImageForEdit 
                    ? 'bg-magenta-600 hover:bg-magenta-500 text-white shadow-[0_0_20px_rgba(219,39,119,0.3)] hover:shadow-[0_0_30px_rgba(219,39,119,0.5)]' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  Execute Modification <span className={`inline-block transition-transform ${selectedImageForEdit ? 'group-hover:translate-x-1' : ''} ml-2`}>→</span>
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
                  <h2 className="text-3xl font-bold mono text-yellow-400 uppercase tracking-tighter">Schematic Archive</h2>
                </div>
                <p className="text-gray-400">Persistent storage for your technical blueprints and wireframe iterations.</p>
              </div>
              <div className="px-4 py-2 bg-black border border-gray-800 rounded-md text-gray-400 mono text-xs">
                {history.length} OBJECTS REGISTERED
              </div>
            </div>

            {history.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-black/10">
                <div className="mb-6 opacity-20">
                   <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-gray-600 mono mb-8 uppercase tracking-widest">Archive is currently empty</p>
                <button 
                  onClick={() => setActiveMode(AppMode.GENERATE)}
                  className="px-8 py-3 bg-gray-900 text-gray-400 hover:text-cyan-400 rounded-lg border border-gray-800 hover:border-cyan-900/50 transition-all mono uppercase tracking-wider text-sm"
                >
                  Initialize New Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {history.map((img) => (
                  <div 
                    key={img.id} 
                    className="group relative bg-[#080808] border border-gray-800/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  >
                    <div className="aspect-square bg-black flex items-center justify-center relative overflow-hidden">
                      {img.videoUrl ? (
                        <video 
                          src={img.videoUrl} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                        />
                      ) : (
                        <img 
                          src={img.url} 
                          alt={img.prompt} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-6">
                        <p className="text-xs text-cyan-400 mono line-clamp-4 leading-relaxed italic">
                          "{img.prompt}"
                        </p>
                        
                        <div className="flex flex-col space-y-2">
                          {!img.videoUrl && (
                            <button
                              onClick={() => handleRotate3D(img)}
                              className="w-full py-2 bg-yellow-950 text-yellow-400 border border-yellow-800/50 rounded mono text-[10px] uppercase hover:bg-yellow-900 transition-colors animate-pulse"
                            >
                              GENERATE 3D ROTATION
                            </button>
                          )}
                          <button
                            onClick={() => downloadImage(img.videoUrl || img.url, `wireframe-${img.id}.${img.videoUrl ? 'mp4' : 'png'}`)}
                            className="w-full py-2 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded mono text-[10px] uppercase hover:bg-cyan-900 transition-colors"
                          >
                            Download Asset
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => selectForEditFromGallery(img)}
                              className="py-2 bg-magenta-950 text-magenta-400 border border-magenta-800/50 rounded mono text-[10px] uppercase hover:bg-magenta-900 transition-colors"
                            >
                              Remodulate
                            </button>
                            <button
                              onClick={() => deleteFromHistory(img.id)}
                              className="py-2 bg-red-950 text-red-400 border border-red-800/50 rounded mono text-[10px] uppercase hover:bg-red-900 transition-colors"
                            >
                              Purge
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 flex items-center justify-between bg-black/40 backdrop-blur-sm border-t border-gray-800/50">
                      <div className="flex gap-2">
                        <span className={`text-[10px] mono px-2 py-0.5 rounded ${img.type === 'edit' ? 'bg-magenta-950 text-magenta-400' : 'bg-cyan-950 text-cyan-400'}`}>
                          {img.type.toUpperCase()}
                        </span>
                        {img.videoUrl && (
                          <span className="text-[10px] mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-800/30">
                            3D_ANIMATED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-600 mono">
                        {new Date(img.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;