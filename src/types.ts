export interface UpscaleSession {
  id: string;
  originalName: string;
  originalSize: number;
  originalUrl: string;
  uploadedUrl?: string;
  upscaledUrl?: string;
  convertedJpgUrl?: string;
  status: 'idle' | 'uploading' | 'upscaling' | 'converting' | 'success' | 'failed';
  error?: string;
  timestamp: number;
}

export interface NexaPromoConfig {
  text: string;
  url: string;
  description: string;
}
