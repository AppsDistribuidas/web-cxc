<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

import type { Cuenta } from '@/types/BankingTypes';

const router = useRouter();
const { can } = useAuth();

const cuentas = ref<Cuenta[]>([]);
const cuentasFiltradas = ref<Cuenta[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const filtroBusqueda = ref('');

const obtenerCuentas = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await api.get('/v1/cuentas-bancarias');
        cuentas.value = response.data.data;
        cuentasFiltradas.value = response.data.data;
    } catch (e: any) {
        if (e.response && e.response.status === 403) {
            error.value = "No tienes permiso para ver las cuentas.";
        } else {
            error.value = "Error al cargar los datos. Intente nuevamente.";
        }
    } finally {
        loading.value = false;
    }
};

const eliminarCuenta = async (cuenta: Cuenta) => {
    if (!can('Eliminar Cuenta') && !can('Administración Cuentas Bancarias')) {
        alert("No tienes permiso para eliminar.");
        return;
    }

    if (!confirm(`¿Estás seguro de desactivar la cuenta "${cuenta.nombre_cuenta}"?`)) return;

    try {
        const payload = {
            codigo: cuenta.codigo,
            nombre_cuenta: cuenta.nombre_cuenta,
            id_entidad_bancaria: (cuenta as any).id_entidad_bancaria,
            descripcion: (cuenta as any).descripcion,
            estado: false
        };

        await api.put(`/v1/cuentas-bancarias/${cuenta.codigo}`, payload);

        cuenta.estado = false;
        alert("Cuenta desactivada correctamente.");
    } catch (e: any) {
        console.error(e);
        alert("Error al desactivar: " + (e.response?.data?.message || "Error desconocido"));
    }
};

// Filtrado en tiempo real
let timeout: number;
watch(filtroBusqueda, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        const busqueda = filtroBusqueda.value.toLowerCase();
        if (!busqueda) {
            cuentasFiltradas.value = cuentas.value;
        } else {
            cuentasFiltradas.value = cuentas.value.filter(cuenta => 
                cuenta.codigo.toLowerCase().includes(busqueda) ||
                cuenta.nombre_cuenta.toLowerCase().includes(busqueda) ||
                cuenta.entidad_bancaria?.nombre.toLowerCase().includes(busqueda)
            );
        }
    }, 300);
});

onMounted(() => {
    obtenerCuentas();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="text-primary mb-1">Gestión de Cuentas Bancarias</h2>
                <p class="text-muted small mb-0">Administración de cuentas para recepción de pagos</p>
            </div>

            <button v-if="can('Crear Cuenta') || can('Administración Cuentas Bancarias')"
                @click="router.push('/cuentas/crear')" class="btn btn-primary shadow-sm">
                <i class="bi bi-plus-circle me-2"></i>Nueva Cuenta
            </button>
        </div>

        <div class="card shadow-sm border-0 mb-4 bg-light">
            <div class="card-body py-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0">
                                <i class="bi bi-search text-muted"></i>
                            </span>
                            <input 
                                v-model="filtroBusqueda"
                                type="text" 
                                class="form-control border-start-0" 
                                placeholder="Buscar por código, nombre o banco..."
                            >
                        </div>
                    </div>
                    <div class="col-md-8 text-end">
                        <button @click="obtenerCuentas" class="btn btn-outline-secondary btn-sm" title="Actualizar">
                            <i class="bi bi-arrow-clockwise"></i> Refrescar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Cargando registros...</p>
        </div>

        <div v-else-if="error" class="alert alert-danger shadow-sm">
            <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ error }}
        </div>

        <div v-else class="card shadow-sm border-0 overflow-hidden">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-light text-secondary">
                        <tr>
                            <th class="ps-4">Código</th>
                            <th>Nombre de Cuenta</th>
                            <th>Entidad Bancaria</th>
                            <th class="text-center">Estado</th>
                            <th v-if="can('Editar Cuenta') || can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')"
                                class="text-end pe-4">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="cuenta in cuentasFiltradas" :key="cuenta.codigo">
                            <td class="ps-4 fw-bold text-primary">{{ cuenta.codigo }}</td>
                            <td>
                                <div class="d-flex flex-column">
                                    <span class="fw-medium">{{ cuenta.nombre_cuenta }}</span>
                                    <small v-if="cuenta.descripcion" class="text-muted">{{ cuenta.descripcion }}</small>
                                </div>
                            </td>
                            <td>
                                <span class="badge bg-light text-dark border">
                                    {{ cuenta.entidad_bancaria?.nombre || 'N/A' }}
                                </span>
                            </td>
                            <td class="text-center">
                                <span :class="`badge rounded-pill ${cuenta.estado ? 'bg-success' : 'bg-danger'}`">
                                    {{ cuenta.estado ? 'Activa' : 'Inactiva' }}
                                </span>
                            </td>

                            <td class="text-end pe-4"
                                v-if="can('Editar Cuenta') || can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')">
                                <div class="btn-group">
                                    <button v-if="can('Editar Cuenta') || can('Administración Cuentas Bancarias')"
                                        @click="router.push(`/cuentas/${cuenta.codigo}/editar`)"
                                        class="btn btn-sm btn-outline-primary"
                                        title="Editar">
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button v-if="(can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')) && cuenta.estado"
                                        @click="eliminarCuenta(cuenta)" 
                                        class="btn btn-sm btn-outline-danger" 
                                        title="Desactivar">
                                        <i class="bi bi-x-circle"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <tr v-if="cuentasFiltradas.length === 0">
                            <td colspan="5" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                                {{ filtroBusqueda ? 'No se encontraron cuentas con ese criterio.' : 'No hay cuentas registradas en el sistema.' }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style scoped>
.table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
}

.table-hover tbody tr:hover {
    background-color: rgba(0, 0, 0, .02);
}
</style>