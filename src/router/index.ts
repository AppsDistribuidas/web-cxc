import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

import HomeView from '../views/HomeView.vue'
import CuentasBancariasView from '../views/CuentasBancariasView.vue'
import CuentasFormView from '../views/CuentasFormView.vue'
import CuentasEditarView from '../views/CuentasEditarView.vue'
import LoginView from '../views/LoginView.vue'
import PagosView from '../views/PagosView.vue'
import PagosFormView from '../views/PagosFormView.vue'
import ForbiddenView from '../views/ForbiddenView.vue'

// Extender el tipo RouteMeta para incluir permisos
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    permission?: string | string[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/cuentas',
      name: 'cuentas',
      component: CuentasBancariasView,
      meta: {
        requiresAuth: true,
        permission: 'Administración cuentas bancarias',
      },
    },
    {
      path: '/cuentas/crear',
      name: 'crear-cuenta',
      component: CuentasFormView,
      meta: {
        requiresAuth: true,
        permission: 'Administración cuentas bancarias',
      },
    },
    {
      path: '/cuentas/:id/editar',
      name: 'editar-cuenta',
      component: CuentasEditarView,
      meta: {
        requiresAuth: true,
        permission: 'Administración cuentas bancarias',
      },
    },
    {
      path: '/pagos',
      name: 'pagos-lista',
      component: PagosView,
      meta: {
        requiresAuth: true,
        permission: 'Gestión de Pagos',
      },
    },
    {
      path: '/pagos/crear',
      name: 'pagos-crear',
      component: PagosFormView,
      meta: {
        requiresAuth: true,
        permission: 'Gestión de Pagos',
      },
    },
    {
      path: '/pagos/:numero_pago/editar',
      name: 'pagos-editar',
      component: PagosFormView,
      meta: {
        requiresAuth: true,
        permission: 'Gestión de Pagos',
      },
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: () => import('../views/ReportesView.vue'),
      meta: {
        requiresAuth: true,
        permission: ['Reporte de Pagos', 'Reporte Estado de Cuenta'],
      },
    },
    {
      path: '/403',
      name: 'forbidden',
      component: ForbiddenView,
      meta: { requiresAuth: true },
    },
  ],
})

// --- GUARDIA DE NAVEGACIÓN GLOBAL ---
router.beforeEach(async (to, from, next) => {
  const { checkAuth, isAuthenticated, can } = useAuth()

  // Si la ruta requiere autenticación
  if (to.meta.requiresAuth) {
    await checkAuth()

    if (!isAuthenticated.value) {
      next({ name: 'login' })
      return
    }

    // Verificar permisos si la ruta los requiere
    if (to.meta.permission && typeof to.meta.permission === 'string') {
      if (!can(to.meta.permission)) {
        next({ name: 'forbidden' })
        return
      }
    }
  }

  // Si el usuario está autenticado e intenta ir a login, redirigir al home
  if (to.name === 'login' && isAuthenticated.value) {
    next({ name: 'home' })
    return
  }

  next()
})

export default router
