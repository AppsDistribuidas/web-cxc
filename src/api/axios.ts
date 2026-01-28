import axios from 'axios'
import { forceLogout } from '@/composables/useAuth'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
})

// Interceptor para manejar expiración de token (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Detectar 401 (token expirado/inválido)
        if (error.response?.status === 401) {
            const url = error.config?.url || ''
            // Ignorar 401 en rutas de autenticación para evitar loops
            if (!url.includes('/auth/login') && !url.includes('/auth/logout')) {
                forceLogout()
            }
        }
        return Promise.reject(error)
    }
)

export default api