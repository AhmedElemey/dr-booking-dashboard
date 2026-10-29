import { environment } from '../../../environments/environment';

/** Root of the versioned REST API, e.g. `http://localhost:5267/api/v1`. */
export const API_ROOT = `${environment.apiBaseUrl}/api/v1`;

export function apiUrl(path: string): string {
  return `${API_ROOT}${path}`;
}
