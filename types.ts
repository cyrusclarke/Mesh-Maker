
export interface GeneratedImage {
  id: string;
  url: string;
  videoUrl?: string;
  prompt: string;
  timestamp: number;
  type: 'generation' | 'edit';
}

export enum AppMode {
  GENERATE = 'generate',
  EDIT = 'edit',
  GALLERY = 'gallery'
}

export interface GenerationConfig {
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  model: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
  quality: '1K' | '2K' | '4K';
}
