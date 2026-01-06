import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

import HomeView from '../views/HomeView.vue'
import CuentasBancariasView from '../views/CuentasBancariasView.vue'
import CuentasFormView from '../views/CuentasFormView.vue'
import CuentasEditarView from '../views/CuentasEditarView.vue'
import LoginView from '../views/LoginView.vue'
import PagosView from '../views/PagosView.vue';
import PagosFormView from '../views/PagosFormView.vue';

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
      meta: { requiresAuth: true },
    },
    {
      path: '/cuentas/crear',
      name: 'crear-cuenta',
      component: CuentasFormView,
      meta: { requiresAuth: true },
    },
    {
      path: '/cuentas/:id/editar',
      name: 'editar-cuenta',
      component: CuentasEditarView,
      meta: { requiresAuth: true },
    },
    {
      path: '/pagos',
      name: 'pagos',
      component: PagosView
    },
    {
      path: '/pagos/nuevo',
      name: 'crear-pago',
      component: PagosFormView
    }
  ],
})

// --- GUARDIA DE NAVEGACIÓN GLOBAL ---
router.beforeEach(async (to, from, next) => {
  const { checkAuth, isAuthenticated } = useAuth()

  // Si la ruta requiere autenticación
  if (to.meta.requiresAuth) {
    await checkAuth()

    if (!isAuthenticated.value) {
      next({ name: 'login' })
      return
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
