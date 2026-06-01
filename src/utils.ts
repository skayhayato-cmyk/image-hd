export function findImageUrlInJson(obj: any): string | null {
  if (!obj) return null;

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findImageUrlInJson(item);
      if (found) return found;
    }
  } else if (typeof obj === 'object') {
    const priorityKeys = [
      'url',
      'link',
      'file',
      'file_url',
      'image',
      'imageUrl',
      'data',
      'download_url',
      'path',
      'result',
      'href'
    ];

    for (const key of priorityKeys) {
      if (key in obj) {
        const found = findImageUrlInJson(obj[key]);
        if (found) return found;
      }
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && !priorityKeys.includes(key)) {
        const found = findImageUrlInJson(obj[key]);
        if (found) return found;
      }
    }
  }

  return null;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function convertToJpgBlob(imageUrl: string): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // request CORS access for canvas manipulation
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get 2d canvas context');
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Failed to create Image Blob'));
            }
          },
          'image/jpeg',
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for JPEG conversion. This may be due to CORS policies on the hosting site.'));
    };
    
    const cacheBuster = imageUrl.includes('?') ? `&_cb=${Date.now()}` : `?_cb=${Date.now()}`;
    img.src = imageUrl + cacheBuster;
  });
}
