import { ref, computed } from 'vue'
import api from '@/api/axios'
import { useRouter } from 'vue-router'
import type { UserData } from '../types/AuthTypes'
import Swal from 'sweetalert2'

// --- ESTADO GLOBAL (Singleton) ---
const user = ref<UserData | null>(null)
let isLoggingOut = false // Flag para evitar múltiples llamadas simultáneas

/**
 * Cierra sesión de forma forzada (ej: token expirado).
 * Exportado globalmente para uso desde el interceptor de axios.
 */
export function forceLogout() {
  // Evitar múltiples llamadas simultáneas
  if (isLoggingOut) return
  isLoggingOut = true

  user.value = null
  localStorage.removeItem('user')

  // Evitar redirección si ya está en login
  if (window.location.pathname !== '/login') {
    Swal.fire({
      icon: 'warning',
      title: 'Sesión Expirada',
      text: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
      confirmButtonText: 'Iniciar Sesión',
      confirmButtonColor: '#0d6efd',
      allowOutsideClick: false,
    }).then(() => {
      window.location.href = '/login'
    })
  } else {
    isLoggingOut = false // Reset si ya está en login
  }
}

const storedUser = localStorage.getItem('user')
if (storedUser) {
  try {
    user.value = JSON.parse(storedUser)
  } catch (e) {
    localStorage.removeItem('user')
  }
}

const isAuthenticated = computed(() => !!user.value)
const loading = ref(false)

export function useAuth() {
  const router = useRouter()

  const setUser = (userData: UserData) => {
    user.value = userData
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const checkAuth = async () => {
    if (user.value) return true

    loading.value = true
    try {
      const response = await api.get('/auth/me')

      if (response.data.success && response.data.data) {
        const { usuario, modulo } = response.data.data

        const userData: UserData = {
          ...usuario,
          modulo: modulo,
        }

        setUser(userData)
        return true
      }
      return false
    } catch (e) {
      logoutLocal()
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Limpia el estado local sin hacer peticiones al servidor
   */
  const logoutLocal = () => {
    user.value = null
    localStorage.removeItem('user')
  }

  /**
   * Cierra sesión: limpia la cookie en el backend y redirige al login
   */
  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (e) {
      console.error('Error al cerrar sesión', e)
    } finally {
      logoutLocal()
      router.push('/login')
    }
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param permissionName Nombre del permiso a verificar
   */
  const can = (permissionName: string) => {
    const funciones = user.value?.modulo?.funciones

    if (!funciones || !Array.isArray(funciones)) return false

    // Comparación exacta (insensible a mayúsculas) para evitar permisos ambiguos
    return funciones.some((f) => f.nombre.toLowerCase() === permissionName.toLowerCase())
  }

  return {
    user,
    isAuthenticated,
    loading,
    checkAuth,
    setUser,
    logout,
    can,
  }
}
