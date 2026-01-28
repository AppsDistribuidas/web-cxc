<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSweetAlert } from '@/composables/useSweetAlert';
import type { Pago } from '@/types/PaymentTypes';

const { showSuccess, showError, showConfirm } = useSweetAlert();
const router = useRouter();
const { can } = useAuth();

// Data
const pagos = ref<Pago[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Clientes para mostrar nombres
interface Cliente {
    cedula: string;
    nombre: string;
}
const clientes = ref<Cliente[]>([]);

// Pagination state
const currentPage = ref(1);
const lastPage = ref(1);
const total = ref(0);
const perPage = ref(10);
const from = ref(0);
const to = ref(0);

// Sorting state
const sortBy = ref('fecha');
const sortOrder = ref<'asc' | 'desc'>('desc');

// Filter state
const filterNumeroPago = ref('');
const filterCedula = ref('');
const filterCuenta = ref('');
const filterEstado = ref('');  // '' = default (exclude inactive)
const filterFecha = ref('');   // fecha exacta
const filterMonto = ref('');   // monto exacto

// Computed property for smart pagination
const paginationRange = computed(() => {
    const totalPages = lastPage.value;
    const current = currentPage.value;

    if (totalPages < 1) return [];

    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

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

const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'N/A';
    try {
        const soloFecha = fechaString.split('T')[0]?.split(' ')[0] ?? '';
        const fecha = new Date(soloFecha + 'T00:00:00');
        if (isNaN(fecha.getTime())) return fechaString;
        return new Intl.DateTimeFormat('es-EC', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(fecha);
    } catch (e) {
        return fechaString;
    }
};

const obtenerPagos = async (page: number = 1) => {
    loading.value = true;
    error.value = null;
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            sort_by: sortBy.value,
            sort_order: sortOrder.value
        });

        // Add filters (backend filters)
        if (filterNumeroPago.value) params.append('numero_pago', filterNumeroPago.value);
        // Solo enviar cédula al backend si parece ser una cédula (números)
        if (filterCedula.value && /^\d+$/.test(filterCedula.value)) {
            params.append('cedula_cliente', filterCedula.value);
        }
        if (filterCuenta.value) params.append('codigo_cuenta', filterCuenta.value);
        if (filterEstado.value !== '') params.append('estado', filterEstado.value);
        if (filterFecha.value) params.append('fecha', filterFecha.value);
        // Monto se filtra en cliente (no está en cabecera del backend)

        const response = await api.get(`/v1/pagos?${params}`);
        let respData = response.data.data || [];

        // Normalizar monto_total
        respData = respData.map((p: any) => {
            const fallbackTotal = (p.detalles || []).reduce((acc: number, d: any) =>
                acc + (Number(d.monto_pagado ?? d.monto_pagar ?? d.monto) || 0), 0);
            return { ...p, monto_total: Number(p.monto_total) || fallbackTotal };
        });

        // Filtro de monto en cliente (no está en backend)
        if (filterMonto.value) {
            const montoNum = Number(filterMonto.value);
            if (!isNaN(montoNum)) {
                respData = respData.filter((p: any) => Number(p.monto_total || 0) === montoNum);
            }
        }

        // Filtro por nombre de cliente (client-side)
        if (filterCedula.value && !/^\d+$/.test(filterCedula.value)) {
            const busqueda = filterCedula.value.toLowerCase();
            respData = respData.filter((p: any) => {
                const nombre = getNombreCliente(p.cedula_cliente).toLowerCase();
                return nombre.includes(busqueda);
            });
        }

        pagos.value = respData;

        // Update pagination state
        const pagination = response.data.pagination;
        if (pagination) {
            currentPage.value = pagination.current_page;
            lastPage.value = pagination.last_page;
            total.value = pagination.total;
            perPage.value = pagination.per_page;
            from.value = pagination.from || 0;
            to.value = pagination.to || 0;
        }
    } catch (e: any) {
        error.value = "Error al cargar los pagos. Intente nuevamente.";
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const toggleSort = (key: string) => {
    if (sortBy.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortOrder.value = 'asc';
    }
    obtenerPagos(1);
};

const limpiarFiltros = () => {
    filterNumeroPago.value = '';
    filterCedula.value = '';
    filterCuenta.value = '';
    filterEstado.value = '';
    filterFecha.value = '';
    filterMonto.value = '';
    obtenerPagos(1);
};

const irAPagina = (page: number) => {
    if (page >= 1 && page <= lastPage.value) {
        obtenerPagos(page);
    }
};

const anularPago = async (pago: any) => {
    const confirmed = await showConfirm(
        `¿Está seguro de anular el pago ${pago.numero_pago}? Esta acción no se puede deshacer.`,
        'Confirmar anulación'
    );
    if (!confirmed) return;

    try {
        await api.delete(`/v1/pagos/${pago.numero_pago}`);
        await showSuccess("Pago anulado correctamente.");
        obtenerPagos(currentPage.value);
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        const mensaje = e.response?.data?.message || "Error al anular el pago.";
        await showError(mensaje);
    }
};

const imprimirComprobante = async (numeroPago: string) => {
    const confirmed = await showConfirm(
        '¿Esta seguro de imprimir el pago? Esta acción no se puede deshacer.',
        'Confirmar impresión'
    );
    if (!confirmed) return;

    try {
        const response = await api.get(`/v1/pagos/${numeroPago}/pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Comprobante-${numeroPago}.pdf`);
        document.body.appendChild(link);
        link.click();
        obtenerPagos(currentPage.value);
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        await showError("Error al descargar el comprobante.");
    }
};

// Debounce filters
let timeout: ReturnType<typeof setTimeout>;
watch([filterNumeroPago, filterCedula, filterCuenta, filterEstado, filterFecha, filterMonto], () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        obtenerPagos(1);
    }, 300);
});

// Cargar clientes para mostrar nombres
const cargarClientes = async () => {
    try {
        const response = await api.get('/v1/pagos/clientes');
        clientes.value = response.data.data || response.data || [];
    } catch (e) {
        console.error('Error al cargar clientes:', e);
    }
};

// Helper para obtener nombre del cliente
const getNombreCliente = (cedula: string): string => {
    const cliente = clientes.value.find(c => c.cedula === cedula);
    return cliente?.nombre || '';
};

onMounted(() => {
    obtenerPagos();
    cargarClientes();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="text-primary mb-1">Gestión de Pagos</h2>
                <p class="text-muted small mb-0">Registro y control de recaudación de clientes</p>
            </div>

            <button @click="router.push('/pagos/crear')" class="btn btn-primary shadow-sm">
                <i class="bi bi-plus-lg"></i> Nuevo Pago
            </button>
        </div>

        <!-- Info bar -->
        <div class="card shadow-sm border-0 mb-4 bg-light">
            <div class="card-body py-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-4">
                        <div class="small text-muted">
                            Mostrando <strong>{{ from }}-{{ to }}</strong> de <strong>{{ total }}</strong>
                        </div>
                    </div>
                    <div class="col-md-8 text-end">
                        <button @click="obtenerPagos(currentPage)" class="btn btn-outline-secondary btn-sm"
                            title="Actualizar">
                            <i class="bi bi-arrow-clockwise"></i> Refrescar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Cargando pagos...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="alert alert-danger shadow-sm">
            <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ error }}
        </div>

        <!-- Table -->
        <div v-else class="card shadow-sm border-0 overflow-hidden">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-light text-secondary">
                        <tr>
                            <th class="text-center ps-3">Acciones</th>
                            <th @click="toggleSort('numero_pago')" class="ps-4 fw-bold" style="cursor:pointer">
                                No. Pago <small v-if="sortBy === 'numero_pago'">{{ sortOrder === 'asc' ? '▲' : '▼'
                                }}</small>
                            </th>
                            <th @click="toggleSort('cedula_cliente')" class="fw-bold" style="cursor:pointer">
                                Cliente <small v-if="sortBy === 'cedula_cliente'">{{ sortOrder === 'asc' ? '▲' : '▼'
                                }}</small>
                            </th>
                            <th class="text-center fw-bold">Cuenta</th>
                            <th @click="toggleSort('fecha')" class="fw-bold" style="cursor:pointer">
                                Fecha <small v-if="sortBy === 'fecha'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</small>
                            </th>
                            <th class="text-end fw-bold">Monto</th>
                            <th class="text-center fw-bold">Estado</th>
                        </tr>
                        <!-- Filter row -->
                        <tr class="bg-white">
                            <th class="text-center">
                                <button @click="limpiarFiltros" class="btn btn-sm btn-outline-secondary"
                                    title="Limpiar filtros">
                                    <i class="bi bi-x-circle"></i>
                                </button>
                            </th>
                            <th>
                                <input v-model="filterNumeroPago" class="form-control form-control-sm"
                                    placeholder="No. Pago">
                            </th>
                            <th>
                                <input v-model="filterCedula" class="form-control form-control-sm"
                                    placeholder="Cédula o Nombre">
                            </th>
                            <th>
                                <input v-model="filterCuenta" class="form-control form-control-sm" placeholder="Cuenta">
                            </th>
                            <th>
                                <input type="date" v-model="filterFecha" class="form-control form-control-sm"
                                    title="Fecha exacta">
                            </th>
                            <th>
                                <input type="number" v-model="filterMonto" class="form-control form-control-sm"
                                    placeholder="Monto" step="0.01">
                            </th>
                            <th class="text-center">
                                <select v-model="filterEstado" class="form-select form-select-sm">
                                    <option value="">Por defecto</option>
                                    <option value="todos">Todos</option>
                                    <option value="procesado">Procesado</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="inactivo">Inactivo</option>
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="pago in pagos" :key="pago.numero_pago">
                            <td class="text-center ps-3">
                                <div class="btn-group">
                                    <button v-if="!pago.fecha_impresion && pago.estado"
                                        @click="router.push(`/pagos/${pago.numero_pago}/editar`)"
                                        class="btn btn-sm btn-outline-primary" title="Editar">
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button v-if="pago.estado" @click="imprimirComprobante(pago.numero_pago)"
                                        class="btn btn-sm btn-outline-secondary" title="Imprimir Comprobante">
                                        <i class="bi bi-printer"></i>
                                    </button>

                                    <button v-if="!pago.fecha_impresion && pago.estado" @click="anularPago(pago)"
                                        class="btn btn-sm btn-outline-danger" title="Anular">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                            <td class="ps-4 fw-bold text-primary">{{ pago.numero_pago }}</td>
                            <td>
                                <div class="d-flex flex-column">
                                    <span class="fw-medium">{{ pago.cedula_cliente }}</span>
                                    <span class="text-muted small">{{ getNombreCliente(pago.cedula_cliente) }}</span>
                                </div>
                            </td>
                            <td class="text-center">
                                <span class="badge bg-light text-dark border">
                                    {{ pago.codigo_cuenta }}
                                </span>
                            </td>
                            <td>{{ formatearFecha(pago.fecha) }}</td>
                            <td class="text-end fw-bold">
                                ${{ Number(pago.monto_total || 0).toFixed(2) }}
                            </td>
                            <td class="text-center">
                                <span
                                    :class="`badge rounded-pill ${pago.fecha_impresion ? 'bg-success' : (pago.estado ? 'bg-warning text-dark' : 'bg-danger')}`">
                                    {{ pago.fecha_impresion ? 'Procesado' : (pago.estado ? 'Activo' : 'Inactivo') }}
                                </span>
                            </td>
                        </tr>
                        <tr v-if="pagos.length === 0">
                            <td colspan="7" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                                No se encontraron pagos registrados.
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                                <button class="page-link" @click="irAPagina(currentPage - 1)"
                                    :disabled="currentPage === 1">
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
    </div>
</template>

<style scoped>
.table-hover tbody tr:hover {
    background-color: rgba(0, 0, 0, .02);
}
</style>