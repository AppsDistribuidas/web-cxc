<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuth } from '@/composables/useAuth';

const { isAuthenticated, logout, user, can } = useAuth();
</script>

<template>
  <nav v-if="isAuthenticated" class="navbar navbar-expand-lg navbar-dark shadow-sm custom-navbar"
    aria-label="Navegación principal">
    <div class="container">
      <RouterLink to="/" class="navbar-brand d-flex align-items-center" active-class="active">
        <span class="fw-bold">Sistema CXC</span>
      </RouterLink>

      <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Abrir menú de navegación">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <RouterLink to="/" class="nav-link" active-class="active" aria-label="Ir a inicio">
              Inicio
            </RouterLink>
          </li>
          <li v-if="can('Administración cuentas bancarias')" class="nav-item">
            <RouterLink to="/cuentas" class="nav-link" active-class="active" aria-label="Ir a cuentas bancarias">
              Cuentas Bancarias
            </RouterLink>
          </li>
          <li v-if="can('Gestión de Pagos')" class="nav-item">
            <RouterLink to="/pagos" class="nav-link" active-class="active" aria-label="Ir a gestión de pagos">
              Pagos
            </RouterLink>
          </li>
          <li v-if="can('Reporte de Pagos') || can('Reporte Estado de Cuenta')" class="nav-item">
            <RouterLink to="/reportes" class="nav-link" active-class="active" aria-label="Ir a reportes">
              Reportes
            </RouterLink>
          </li>
          <li v-if="can('Reporte de Auditorías')" class="nav-item">
            <RouterLink to="/auditoria" class="nav-link" active-class="active" aria-label="Ir a auditoría">
              Auditoría
            </RouterLink>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-3">
          <div class="user-badge d-flex align-items-center">
            <div class="user-avatar me-2">
              <i class="bi bi-person-fill"></i>
            </div>
            <span class="text-light small">{{ user?.username || 'Usuario' }}</span>
          </div>
          <button @click="logout" class="btn btn-logout btn-sm d-flex align-items-center" aria-label="Cerrar sesión">
            <i class="bi bi-box-arrow-right me-1"></i>
            Salir
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="container">
    <RouterView />
  </main>
</template>

<style scoped>
/* Navbar con gradiente */
.custom-navbar {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* Brand con hover */
.navbar-brand {
  transition: all 0.3s ease;
}

.navbar-brand:hover {
  opacity: 0.9;
  transform: translateX(2px);
}

/* Nav links con hover effects */
.nav-link {
  position: relative;
  padding: 0.5rem 1rem !important;
  margin: 0 0.15rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  background: rgba(13, 110, 253, 0.3);
  color: #fff !important;
}

/* Indicador inferior para link activo */
.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: #0d6efd;
  border-radius: 2px;
}

/* User badge */
.user-badge {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.user-avatar {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.9rem;
}

/* Botón de logout - contraste mejorado */
.btn-logout {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-weight: 500;
}

.btn-logout:hover {
  background: #bb2d3b;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

/* Toggler mejorado */
.navbar-toggler:focus {
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

/* Responsive */
@media (max-width: 991px) {
  .navbar-collapse {
    padding: 1rem 0;
  }

  .nav-link {
    margin: 0.25rem 0;
  }

  .user-badge {
    margin-top: 1rem;
    justify-content: center;
  }

  .btn-logout {
    margin-top: 0.5rem;
    width: 100%;
    justify-content: center;
  }
}
</style>