import { ref, computed } from 'vue';
import api from '@/api/axios'; 
import { useRouter } from 'vue-router';
import type { UserData } from '../types/AuthTypes';

// Estado Global (Singleton)
const user = ref<UserData | null>(null);
const isAuthenticated = computed(() => !!user.value);
const loading = ref(false);

export function useAuth() {
    const router = useRouter();

    // 1. Verificar Auth
    const checkAuth = async () => {
        if (user.value) return true;

        loading.value = true;
        try {
            const response = await api.get('/auth/me');
            
            if (response.data.success) {
                user.value = response.data.data;
                return true;
            }
            return false;
        } catch (e) {
            user.value = null;
            return false;
        } finally {
            loading.value = false;
        }
    };

    // 2. Iniciar Sesión
    const login = () => {
        const callbackUrl = encodeURIComponent(import.meta.env.VITE_API_URL + '/auth/callback');
        window.location.href = `https://modulo-seguridad.sistemanh.shop/login?redirect_url=${callbackUrl}`;
    };

    // 3. Cerrar Sesión
    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Error al cerrar sesión local', e);
        } finally {
            user.value = null;
            window.location.href = 'https://modulo-seguridad.sistemanh.shop/logout';
        }
    };

    // 4. Verificar Permisos
    const can = (permissionName: string) => {
        const funciones = user.value?.modulo?.funciones;
        
        if (!funciones || !Array.isArray(funciones)) return false;
        
        return funciones.some((f) => 
            f.nombre.toLowerCase().includes(permissionName.toLowerCase())
        );
    };

    return {
        user,
        isAuthenticated,
        loading,
        checkAuth,
        login,
        logout,
        can
    };
}