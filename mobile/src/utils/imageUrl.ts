import { getBaseUrl } from '../services/api';

/**
 * Resolve caminhos relativos ou absolutos de imagens (Cloudinary, uploads locais ou fallback seguro).
 */
export const resolvePhotoUrl = (path?: string | null): string => {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return 'https://placehold.co/150x150/1B4332/FFF.png?text=Psi';
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  let clean = path.replace(/\\/g, '/');
  if (clean.includes('uploads/')) {
    clean = clean.substring(clean.lastIndexOf('uploads/'));
  }
  if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }
  return `${getBaseUrl()}${clean}`;
};

