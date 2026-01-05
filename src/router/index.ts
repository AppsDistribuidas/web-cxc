import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

import HomeView from '../views/HomeView.vue'
import CuentasBancariasView from '../views/CuentasBancariasView.vue'
import CuentasFormView from '../views/CuentasFormView.vue'
import CuentasEditarView from '../views/CuentasEditarView.vue'

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
  ],
})

// --- GUARDIA DE NAVEGACIÓN GLOBAL ---
router.beforeEach(async (to, from, next) => {
  const { checkAuth, isAuthenticated, login } = useAuth()

  await checkAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    login()
    return false
  }

  next()
})

export default router
