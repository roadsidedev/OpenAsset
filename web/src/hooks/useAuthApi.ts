import { useAuth } from '../context/AuthContext';

// Re-export for backward compatibility
export function useAuthApi() {
  return useAuth();
}
