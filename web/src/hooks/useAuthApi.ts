import { useAuth } from '../components/AuthProvider';

export function useAuthApi() {
  return useAuth();
}