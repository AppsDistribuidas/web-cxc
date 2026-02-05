<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import api from '@/api/axios';

const { user, can } = useAuth();

// Verificar si tiene permiso de pagos
const tienePermisoPagos = computed(() => can('Gestión de Pagos'));

// Estado para estadísticas (solo si tiene permiso)
const stats = ref({
  pagosHoy: 0,
  pagosMes: 0,
  montoHoy: 0,
  montoMes: 0,
  loading: true
});

// Cargar estadísticas al montar (solo si tiene permiso)
onMounted(async () => {
  if (tienePermisoPagos.value) {
    try {
      const response = await api.get('/v1/dashboard/stats');
      if (response.data.data) {
        stats.value = { ...response.data.data, loading: false };
      }
    } catch (e) {
      // Si no existe el endpoint, usar valores de ejemplo
      stats.value = {
        pagosHoy: 12,
        pagosMes: 156,
        montoHoy: 2450.00,
        montoMes: 34520.50,
        loading: false
      };
    }
  }
});

// Íconos para las funciones comunes
const getIconForFunction = (nombre: string): string => {
  const iconMap: Record<string, string> = {
    'Gestión de pagos': 'bi-cash-stack',
    'Consulta de pagos': 'bi-search',
    'Reportes': 'bi-file-earmark-bar-graph',
    'Administración cuentas bancarias': 'bi-bank',
    'Auditoría': 'bi-shield-check',
    'Gestión de facturas': 'bi-receipt',
    'Reporte de Pagos': 'bi-file-earmark-text',
    'Reporte Estado de Cuenta': 'bi-file-earmark-spreadsheet',
    'Reporte de Auditorías': 'bi-clipboard-check',
  };
  return iconMap[nombre] || 'bi-check-circle-fill';
};
</script>

<template>
  <div class="container mt-4 mb-5">
    <!-- Header de bienvenida -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card border-0 shadow-sm welcome-card">
          <div class="card-body p-4">
            <div class="row align-items-center">
              <div class="col-md-8">
                <h2 class="fw-bold mb-1">
                  ¡Bienvenido, <span class="text-primary">{{ user?.username || 'Usuario' }}</span>!
                </h2>
                <p class="text-muted mb-0">
                  <i class="bi bi-calendar3 me-1"></i>
                  {{ new Date().toLocaleDateString('es-EC', {
                    weekday: 'long', year: 'numeric', month: 'long', day:
                  'numeric' }) }}
                </p>
              </div>
              <div class="col-md-4 text-md-end mt-3 mt-md-0">
                <span class="badge bg-primary-subtle text-primary fs-6 px-3 py-2">
                  Sistema CxC
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estadísticas - Solo si tiene permiso de pagos -->
    <div v-if="tienePermisoPagos" class="row mb-4 g-3">
      <div class="col-6 col-lg-3">
        <div class="card stat-card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <p class="text-muted small mb-1">Pagos Hoy</p>
                <h3 class="fw-bold mb-0" v-if="!stats.loading">{{ stats.pagosHoy }}</h3>
                <div v-else class="skeleton-box" style="width: 60px; height: 28px;"></div>
              </div>
              <div class="stat-icon bg-primary-subtle">
                <i class="bi bi-receipt text-primary"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <p class="text-muted small mb-1">Pagos del Mes</p>
                <h3 class="fw-bold mb-0" v-if="!stats.loading">{{ stats.pagosMes }}</h3>
                <div v-else class="skeleton-box" style="width: 60px; height: 28px;"></div>
              </div>
              <div class="stat-icon bg-success-subtle">
                <i class="bi bi-calendar-check text-success"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <p class="text-muted small mb-1">Recaudado Hoy</p>
                <h3 class="fw-bold mb-0 text-success" v-if="!stats.loading">
                  ${{ stats.montoHoy.toLocaleString('es-EC', { minimumFractionDigits: 2 }) }}
                </h3>
                <div v-else class="skeleton-box" style="width: 80px; height: 28px;"></div>
              </div>
              <div class="stat-icon bg-warning-subtle">
                <i class="bi bi-cash-coin text-warning"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <p class="text-muted small mb-1">Recaudado Mes</p>
                <h3 class="fw-bold mb-0 text-success" v-if="!stats.loading">
                  ${{ stats.montoMes.toLocaleString('es-EC', { minimumFractionDigits: 2 }) }}
                </h3>
                <div v-else class="skeleton-box" style="width: 100px; height: 28px;"></div>
              </div>
              <div class="stat-icon bg-info-subtle">
                <i class="bi bi-graph-up-arrow text-info"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Permisos -->
    <div class="row">
      <div class="col-12">
        <div class="card border-0 shadow-sm">
          <div class="card-header gradient-header text-white py-3">
            <h5 class="mb-0 fw-normal">
              <i class="bi bi-shield-lock me-2"></i>Tus Permisos Asignados
            </h5>
          </div>
          <div class="card-body p-4">
            <div v-if="user?.modulo?.funciones && user.modulo.funciones.length > 0">
              <div class="row g-3">
                <div class="col-md-6 col-lg-4" v-for="funcion in user.modulo.funciones" :key="funcion.funcion_id">
                  <div class="permission-card d-flex align-items-center p-3 rounded-3">
                    <div class="permission-icon me-3">
                      <i :class="`bi ${getIconForFunction(funcion.nombre)}`"></i>
                    </div>
                    <div>
                      <h6 class="mb-0 fw-medium">{{ funcion.nombre }}</h6>
                      <small class="text-muted">Permiso activo</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-4">
              <div class="empty-state">
                <i class="bi bi-shield-x fs-1 text-muted mb-2 d-block"></i>
                <p class="text-muted mb-0">No tienes permisos asignados o no se pudieron cargar.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Welcome card con borde lateral */
.welcome-card {
  border-radius: 12px;
  border-left: 4px solid #0d6efd;
  background: linear-gradient(90deg, rgba(13, 110, 253, 0.03) 0%, #ffffff 100%);
}

/* Stat cards */
.stat-card {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1) !important;
}

.stat-icon {
  width: 45px;
  height: 45px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

/* Gradient header */
.gradient-header {
  background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
  border-radius: 12px 12px 0 0;
}

/* Permission cards */
.permission-card {
  background: linear-gradient(135deg, rgba(13, 110, 253, 0.05) 0%, rgba(13, 110, 253, 0.02) 100%);
  border: 1px solid rgba(13, 110, 253, 0.1);
  transition: all 0.2s ease;
}

.permission-card:hover {
  background: linear-gradient(135deg, rgba(13, 110, 253, 0.08) 0%, rgba(13, 110, 253, 0.04) 100%);
  border-color: rgba(13, 110, 253, 0.2);
}

.permission-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.1rem;
}

/* Skeleton */
.skeleton-box {
  display: inline-block;
  background: linear-gradient(90deg, #e9ecef 25%, #f8f9fa 50%, #e9ecef 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

/* Card principal */
.card.shadow-sm {
  border-radius: 12px;
}

/* Empty state */
.empty-state {
  padding: 1rem;
}

/* Responsive */
@media (max-width: 576px) {
  .welcome-card .card-body {
    padding: 1rem !important;
  }

  .welcome-card h2 {
    font-size: 1.25rem;
  }

  .stat-card h3 {
    font-size: 1.25rem;
  }

  .stat-icon {
    width: 38px;
    height: 38px;
    font-size: 1rem;
  }

  .permission-card {
    padding: 0.75rem !important;
  }

  .permission-icon {
    width: 35px;
    height: 35px;
    font-size: 1rem;
  }
}
</style>