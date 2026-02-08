<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSweetAlert } from '@/composables/useSweetAlert';

import type { Cuenta, EntidadBancaria } from '@/types/BankingTypes';

const router = useRouter();
const { can } = useAuth();
const { showSuccess, showError, showWarning, showConfirm } = useSweetAlert();

const cuentas = ref<Cuenta[]>([]);
const error = ref<string | null>(null);
const loading = ref(true);
const dataLoaded = ref(false);

// Pagination state
const currentPage = ref(1);
const lastPage = ref(1);
const total = ref(0);
const perPage = ref(10);
const from = ref(0);
const to = ref(0);

// Sorting state
const sortBy = ref('codigo');
const sortOrder = ref<'asc' | 'desc'>('asc');

// Filter state
const filterCodigo = ref('');
const filterTipoCuenta = ref('');
const filterEstado = ref('');
const filterBanco = ref('');
const filterFecha = ref('');
const bancos = ref<EntidadBancaria[]>([]);

// Computed property for smart pagination
const paginationRange = computed(() => {
    const totalPages = lastPage.value;
    const current = currentPage.value;

    // Guard clause: handle edge cases where there are no pages
    if (totalPages < 1) {
        return [];
    }

    const delta = 2; // Number of pages to show around current page
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    // Always show first page, last page, and pages around current page
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

    // Add ellipsis where there are gaps
    for (const i of range) {
        if (l !== undefined) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
});

// Computed property for table colspan based on user permissions
const tableColspan = computed(() => {
    return can('Administración cuentas bancarias') ? 6 : 5;
});

const obtenerCuentas = async (page: number = 1) => {
    loading.value = true;
    error.value = null;
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            sort_by: sortBy.value,
            sort_order: sortOrder.value
        });

        // Add filters if they have values
        if (filterCodigo.value) {
            params.append('codigo', filterCodigo.value);
        }
        if (filterTipoCuenta.value) {
            params.append('tipo_cuenta', filterTipoCuenta.value);
        }
        if (filterEstado.value !== '') {
            params.append('estado', filterEstado.value);
        }
        if (filterBanco.value) {
            params.append('id_banco', filterBanco.value);
        }
        if (filterFecha.value) {
            params.append('fecha', filterFecha.value);
        }

        const response = await api.get(`/v1/cuentas-bancarias?${params}`);
        cuentas.value = response.data.data;

        // Update pagination state
        const pagination = response.data.pagination;
        currentPage.value = pagination.current_page;
        lastPage.value = pagination.last_page;
        total.value = pagination.total;
        perPage.value = pagination.per_page;
        from.value = pagination.from || 0;
        to.value = pagination.to || 0;
        // Mark data as loaded after first successful fetch
        dataLoaded.value = true;
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

const limpiarFiltros = () => {
    filterCodigo.value = '';
    filterTipoCuenta.value = '';
    filterEstado.value = '';
    filterBanco.value = '';
    filterFecha.value = '';
    obtenerCuentas(1);
};

const toggleSort = (key: string) => {
    if (sortBy.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortOrder.value = 'asc';
    }
    obtenerCuentas(1);
};

const irAPagina = (page: number) => {
    if (page >= 1 && page <= lastPage.value) {
        obtenerCuentas(page);
    }
};

// Explicit mappings for correct Spanish grammar
const accionNombre: Record<'activar' | 'desactivar', string> = { 
    activar: 'activación', 
    desactivar: 'desactivación' 
};
const accionParticipio: Record<'activar' | 'desactivar', string> = { 
    activar: 'activada', 
    desactivar: 'desactivada' 
};

const cambiarEstadoCuenta = async (cuenta: Cuenta) => {
    if (!can('Administración cuentas bancarias')) {
        await showWarning('No tienes permiso para cambiar el estado de cuentas bancarias');
        return;
    }

    const nuevoEstado = !cuenta.estado;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const accionCapitalizada = nuevoEstado ? 'Activar' : 'Desactivar';

    const confirmed = await showConfirm(
        `¿Estás seguro de ${accion} la cuenta "${cuenta.codigo}"?`,
        `Confirmar ${accionNombre[accion]}`
    );
    if (!confirmed) return;

    try {
        const response = await api.patch(`/v1/cuentas-bancarias/${cuenta.codigo}/estado`, {
            estado: nuevoEstado
        });

        // Update local state
        cuenta.estado = nuevoEstado;
        
        await showSuccess(response.data.message || `La cuenta ha sido ${accionParticipio[accion]} correctamente`);
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        console.error(e);
        await showError(e.response?.data?.message || `Error desconocido al ${accion} la cuenta`);
    }
};

onMounted(async () => {
    // Load banks for filter
    try {
        const response = await api.get('/v1/entidades-bancarias');
        bancos.value = response.data.data;
    } catch (e) {
        console.error('Error al cargar bancos:', e);
    }

    obtenerCuentas();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="text-primary-gradient fw-bold mb-1">Cuentas Bancarias</h2>
                <p class="text-muted small mb-0">Administración de cuentas bancarias del sistema</p>
            </div>

            <button v-if="can('Administración cuentas bancarias')" @click="router.push('/cuentas/crear')"
                class="btn btn-primary shadow-sm">
                <i class="bi bi-plus-lg"></i> Nueva Cuenta
            </button>
        </div>

        <div class="card shadow-sm border-0 mb-4 bg-light">
            <div class="card-body py-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-4">
                        <div class="small text-muted">
                            Mostrando <strong>{{ from }}-{{ to }}</strong> de <strong>{{ total }}</strong>
                        </div>
                    </div>
                    <div class="col-md-8 text-end">
                        <button @click="obtenerCuentas(currentPage)" class="btn btn-outline-secondary btn-sm"
                            title="Actualizar">
                            <i class="bi bi-arrow-clockwise"></i> Refrescar
                        </button>
                    </div>
                </div>
            </div>
        </div>



        <!-- Loading Skeleton -->
        <div v-if="loading" class="card shadow-sm border-0">
            <div class="table-responsive">
                <table class="table align-middle mb-0">
                    <thead class="bg-light">
                        <tr>
                            <th v-if="can('Administración cuentas bancarias')" style="width: 80px"></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="i in 5" :key="i">
                            <td v-if="can('Administración cuentas bancarias')">
                                <div class="skeleton-box" style="width: 60px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 80px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 120px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 100px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 80px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 60px;"></div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>


        <!-- Error -->
        <div v-else-if="error" class="alert alert-danger shadow-sm">
            <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ error }}
        </div>

        <!-- Table -->
        <div v-else-if="dataLoaded" class="card shadow-sm border-0 overflow-hidden">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-light text-secondary">
                        <tr>
                            <th v-if="can('Administración cuentas bancarias')"
                                class="text-center ps-3 sticky-col-actions">
                                Acciones
                            </th>
                            <th @click="toggleSort('codigo')" class="ps-4 fw-bold" style="cursor:pointer">
                                Código <small v-if="sortBy === 'codigo'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</small>
                            </th>
                            <th @click="toggleSort('nombre_cuenta')" class="fw-bold" style="cursor:pointer">
                                Nombre <small v-if="sortBy === 'nombre_cuenta'">{{ sortOrder === 'asc' ? '▲' : '▼'
                                    }}</small>
                            </th>
                            <th @click="toggleSort('banco_nombre')" class="fw-bold" style="cursor:pointer">
                                Banco <small v-if="sortBy === 'banco_nombre'">{{ sortOrder === 'asc' ? '▲' : '▼'
                                    }}</small>
                            </th>
                            <th @click="toggleSort('created_at')" class="text-center fw-bold" style="cursor:pointer">
                                Fecha Creación <small v-if="sortBy === 'created_at'">{{ sortOrder === 'asc' ? '▲' : '▼'
                                    }}</small>
                            </th>
                            <th @click="toggleSort('estado')" class="text-center fw-bold" style="cursor:pointer">
                                Estado <small v-if="sortBy === 'estado'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</small>
                            </th>
                        </tr>
                        <!-- Filter row -->
                        <tr class="bg-white">
                            <th class="text-center sticky-col-actions" v-if="can('Administración cuentas bancarias')">
                                <button @click="limpiarFiltros" class="btn btn-sm btn-outline-secondary"
                                    title="Limpiar filtros">
                                    <i class="bi bi-x-circle"></i>
                                </button>
                            </th>
                            <th><input v-model="filterCodigo" @input="obtenerCuentas(1)"
                                    class="form-control form-control-sm" placeholder="Código"></th>
                            <th>
                                <select v-model="filterTipoCuenta" @change="obtenerCuentas(1)"
                                    class="form-select form-select-sm">
                                    <option value="">Todos</option>
                                    <option value="Cuenta de Ahorros">Ahorros</option>
                                    <option value="Cuenta Corriente">Corriente</option>
                                </select>
                            </th>
                            <th>
                                <select v-model="filterBanco" @change="obtenerCuentas(1)"
                                    class="form-select form-select-sm">
                                    <option value="">Todos</option>
                                    <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                        {{ banco.nombre }}
                                    </option>
                                </select>
                            </th>
                            <th>
                                <input type="date" v-model="filterFecha" @change="obtenerCuentas(1)"
                                    class="form-control form-control-sm">
                            </th>
                            <th class="text-center">
                                <select v-model="filterEstado" @change="obtenerCuentas(1)"
                                    class="form-select form-select-sm">
                                    <option value="">Todos</option>
                                    <option value="1">Activo</option>
                                    <option value="0">Inactivo</option>
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="cuenta in cuentas" :key="cuenta.codigo">
                            <td class="text-center ps-3 sticky-col-actions"
                                v-if="can('Administración cuentas bancarias')">
                                <div class="btn-group" role="group">
                                    <button @click="router.push(`/cuentas/${cuenta.codigo}/editar`)"
                                        class="btn btn-sm btn-outline-primary" title="Editar">
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button 
                                        @click="cambiarEstadoCuenta(cuenta)" 
                                        :class="cuenta.estado ? 'btn btn-sm btn-outline-danger' : 'btn btn-sm btn-outline-success'"
                                        :title="cuenta.estado ? 'Desactivar' : 'Activar'">
                                        <i :class="cuenta.estado ? 'bi bi-x-circle' : 'bi bi-check-circle'"></i>
                                    </button>
                                </div>
                            </td>
                            <td class="ps-4 fw-bold text-primary">{{ cuenta.codigo }}</td>
                            <td class="fw-medium">{{ cuenta.nombre_cuenta }}</td>
                            <td>{{ cuenta.entidad_bancaria?.nombre || 'N/A' }}</td>
                            <td class="text-center">{{ cuenta.created_at ? new
                                Date(cuenta.created_at).toLocaleDateString('es-EC') : 'N/A' }}</td>
                            <td class="text-center">
                                <span :class="`badge rounded-pill ${cuenta.estado ? 'bg-success' : 'bg-danger'}`">
                                    {{ cuenta.estado ? 'Activo' : 'Inactivo' }}
                                </span>
                            </td>
                        </tr>

                        <tr v-if="cuentas.length === 0">
                            <td :colspan="tableColspan + 1" class="text-center py-5">
                                <div class="empty-state">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor"
                                        class="bi bi-bank text-muted mb-3" viewBox="0 0 16 16">
                                        <path
                                            d="m8 0 6.61 3h.89a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H15v7a.5.5 0 0 1 .485.379l.5 2A.5.5 0 0 1 15.5 16H.5a.5.5 0 0 1-.485-.621l.5-2A.5.5 0 0 1 1 13V6H.5a.5.5 0 0 1-.5-.5v-2A.5.5 0 0 1 .5 3h.89zM3.777 3h8.447L8 1zM2 6v7h1V6zm2 0v7h2.5V6zm3.5 0v7h1V6zm2 0v7H12V6zM13 6v7h1V6zm2-1V4H1v1zm-.39 9H1.39l-.25 1h13.72z" />
                                    </svg>
                                    <h5 class="text-muted mb-2">No hay cuentas registradas</h5>
                                    <p class="text-secondary small mb-0">Comienza creando una nueva cuenta bancaria</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="!loading && !error && total > perPage" class="card shadow-sm border-0 mt-3">
        <div class="card-body py-3">
            <div class="d-flex justify-content-between align-items-center">
                <div class="small text-muted">
                    Página {{ currentPage }} de {{ lastPage }}
                </div>
                <nav>
                    <ul class="pagination mb-0">
                        <li class="page-item" :class="{ disabled: currentPage === 1 }">
                            <button class="page-link" @click="irAPagina(currentPage - 1)" :disabled="currentPage === 1">
                                <i class="bi bi-chevron-left"></i> Anterior
                            </button>
                        </li>

                        <li v-for="(page, index) in paginationRange" :key="index" class="page-item"
                            :class="{ active: page === currentPage, disabled: page === '...' }">
                            <button v-if="page !== '...'" class="page-link" @click="irAPagina(page as number)">
                                {{ page }}
                            </button>
                            <span v-else class="page-link">{{ page }}</span>
                        </li>

                        <li class="page-item" :class="{ disabled: currentPage === lastPage }">
                            <button class="page-link" @click="irAPagina(currentPage + 1)"
                                :disabled="currentPage === lastPage">
                                Siguiente <i class="bi bi-chevron-right"></i>
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    </div>
</template>

<style scoped>
.table-hover tbody tr:hover {
    background-color: rgba(13, 110, 253, 0.05);
}

/* Skeleton Loading Animation */
.skeleton-box {
    display: inline-block;
    height: 16px;
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

/* Empty State */
.empty-state {
    padding: 2rem;
}

.empty-state svg {
    opacity: 0.6;
}

/* Botón primario mejorado */
.btn-primary {
    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
    border: none;
    transition: all 0.3s ease;
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.35);
}

/* Card con bordes redondeados */
.card {
    border-radius: 10px;
}

/* Barra de info con borde lateral azul */
.card.bg-light {
    border-left: 4px solid #0d6efd;
    background: linear-gradient(90deg, rgba(13, 110, 253, 0.03) 0%, #f8f9fa 100%) !important;
}

/* Tabla header con gradiente azul sutil */
thead.bg-light {
    background: linear-gradient(180deg, #e7f1ff 0%, #f8f9fa 100%) !important;
}

thead.bg-light th {
    border-bottom: 2px solid #0d6efd;
}

/* Sticky Action Column */
.sticky-col-actions {
    position: sticky;
    left: 0;
    z-index: 10;
    background-color: #fff;
    border-right: 2px solid #dee2e6;
    box-shadow: 4px 0 5px -2px rgba(0, 0, 0, 0.1);
}

/* Fix para hover */
.table-hover tbody tr:hover .sticky-col-actions {
    background-color: #f8f9fa;
    /* Color hover standard */
}

/* Header sticky */
thead .sticky-col-actions {
    z-index: 20;
    background: linear-gradient(180deg, #e7f1ff 0%, #f8f9fa 100%) !important;
}
</style>