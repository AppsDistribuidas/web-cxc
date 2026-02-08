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

// Selección múltiple para impresión masiva
const selectedPagos = ref<Set<string>>(new Set());

// Computed: verificar si todos los pagos activos están seleccionados
const allSelected = computed(() => {
    const activePagos = pagos.value.filter(p => p.estado);
    if (activePagos.length === 0) return false;
    return activePagos.every(p => selectedPagos.value.has(p.numero_pago));
});

// Computed: cantidad de seleccionados
const selectedCount = computed(() => selectedPagos.value.size);

// Toggle seleccionar todos (solo pagos activos)
const toggleSelectAll = () => {
    if (allSelected.value) {
        selectedPagos.value.clear();
    } else {
        // Solo seleccionar pagos activos
        pagos.value.forEach(p => {
            if (p.estado) {
                selectedPagos.value.add(p.numero_pago);
            }
        });
    }
};

// Toggle selección individual (solo si el pago está activo)
const toggleSelect = (pago: any) => {
    // Prevenir selección de pagos inactivos
    if (!pago.estado) return;

    if (selectedPagos.value.has(pago.numero_pago)) {
        selectedPagos.value.delete(pago.numero_pago);
    } else {
        selectedPagos.value.add(pago.numero_pago);
    }
};

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

const cambiarEstadoPago = async (pago: any, nuevoEstado: boolean) => {
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const titulo = nuevoEstado ? 'Activar pago' : 'Desactivar pago';
    const mensaje = `¿Está seguro de ${accion} el pago ${pago.numero_pago}?`;

    const confirmed = await showConfirm(mensaje, titulo);
    if (!confirmed) return;

    try {
        const response = await api.patch(`/v1/pagos/${pago.numero_pago}/estado`, {
            estado: nuevoEstado
        });

        if (response.data.success) {
            await showSuccess(response.data.message);
            obtenerPagos(currentPage.value);
        }
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        const mensaje = e.response?.data?.message || `Error al ${accion} el pago`;
        await showError(mensaje);
    }
};


const imprimirComprobante = async (numeroPago: string, isProcesado: boolean = false) => {
    const mensaje = isProcesado
        ? '¿Desea reimprimir el comprobante de pago?'
        : '¿Desea procesar el pago y generar el comprobante? Esta acción no se puede deshacer.';
    const titulo = isProcesado ? 'Reimprimir comprobante' : 'Procesar pago';

    const confirmed = await showConfirm(mensaje, titulo);
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

// Impresión masiva
const imprimirMasivo = async () => {
    if (selectedCount.value === 0) {
        await showError('Seleccione al menos un pago para imprimir.');
        return;
    }

    const cantidadSeleccionada = selectedCount.value;

    const confirmed = await showConfirm(
        `¿Imprimir ${cantidadSeleccionada} comprobante(s)? Esta acción marcará los pagos como procesados.`,
        'Confirmar impresión masiva'
    );
    if (!confirmed) return;

    try {
        const response = await api.post('/v1/pagos/imprimir', {
            numeros_pago: Array.from(selectedPagos.value)
        }, { responseType: 'blob' });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Comprobantes.zip');
        document.body.appendChild(link);
        link.click();

        selectedPagos.value.clear();
        await showSuccess(`Se imprimieron ${cantidadSeleccionada} comprobante(s) correctamente.`);
        obtenerPagos(currentPage.value);
    } catch (e: any) {
        if (e.response?.status === 401) return;
        await showError('Error al imprimir los comprobantes.');
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
                <h2 class="text-primary-gradient fw-bold mb-1">Gestión de Pagos</h2>
                <p class="text-muted small mb-0">Registro y control de recaudación de clientes</p>
            </div>

            <button @click="router.push('/pagos/crear')" class="btn btn-primary shadow-sm" aria-label="Crear nuevo pago"
                title="Registrar un nuevo pago de cliente">
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Nuevo Pago
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
                        <button v-if="selectedCount > 0" @click="imprimirMasivo"
                            class="btn btn-success btn-sm me-2 shadow-sm"
                            aria-label="Imprimir comprobantes de los pagos seleccionados"
                            title="Genera y descarga los comprobantes PDF de los pagos marcados">
                            <i class="bi bi-printer-fill me-1" aria-hidden="true"></i>
                            Imprimir {{ selectedCount }} seleccionado(s)
                        </button>
                        <button @click="obtenerPagos(currentPage)" class="btn btn-outline-secondary btn-sm"
                            aria-label="Refrescar lista de pagos"
                            title="Actualizar la lista de pagos desde el servidor">
                            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refrescar
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
                            <th style="width: 40px"></th>
                            <th style="width: 80px"></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="i in 5" :key="i">
                            <td>
                                <div class="skeleton-box" style="width: 20px; height: 20px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 60px;"></div>
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
                                <div class="skeleton-box" style="width: 80px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 70px;"></div>
                            </td>
                            <td>
                                <div class="skeleton-box" style="width: 70px;"></div>
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
        <div v-else class="card shadow-sm border-0 overflow-hidden">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-light text-secondary">
                        <tr>
                            <th class="text-center sticky-col-1" style="width: 40px;">
                                <input type="checkbox" class="form-check-input" :checked="allSelected"
                                    @change="toggleSelectAll"
                                    title="Seleccionar o deseleccionar todos los pagos de esta página"
                                    aria-label="Seleccionar todos los pagos">
                            </th>
                            <th class="text-center ps-3 sticky-col-2">Acciones</th>
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
                            <th class="sticky-col-1"></th>
                            <th class="text-center sticky-col-2">
                                <button @click="limpiarFiltros" class="btn btn-sm btn-outline-secondary"
                                    title="Restablecer todos los filtros a sus valores por defecto"
                                    aria-label="Limpiar todos los filtros de búsqueda">
                                    <i class="bi bi-x-circle" aria-hidden="true"></i>
                                </button>
                            </th>
                            <th>
                                <input v-model="filterNumeroPago" class="form-control form-control-sm"
                                    placeholder="No. Pago" aria-label="Filtrar por número de pago"
                                    title="Escriba el número de pago para filtrar">
                            </th>
                            <th>
                                <input v-model="filterCedula" class="form-control form-control-sm"
                                    placeholder="Cédula o Nombre" aria-label="Filtrar por cédula o nombre del cliente"
                                    title="Escriba cédula (solo números) o nombre para buscar">
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
                        <tr v-for="pago in pagos" :key="pago.numero_pago"
                            :class="{ 'table-primary': selectedPagos.has(pago.numero_pago) }">
                            <td class="text-center sticky-col-1">
                                <input v-if="pago.estado" type="checkbox" class="form-check-input"
                                    :checked="selectedPagos.has(pago.numero_pago)" @change="toggleSelect(pago)"
                                    :title="pago.estado ? 'Seleccionar para impresión masiva' : ''"
                                    :aria-label="`Seleccionar pago ${pago.numero_pago} para impresión masiva`">
                                <span v-else class="text-muted small"></span>
                            </td>
                            <td class="text-center ps-3 sticky-col-2">
                                <div class="btn-group">
                                    <!-- Botón Activar (solo para pagos inactivos) -->
                                    <button v-if="!pago.estado" @click="cambiarEstadoPago(pago, true)"
                                        class="btn btn-sm btn-outline-success"
                                        :title="`Activar pago ${pago.numero_pago}`"
                                        :aria-label="`Activar pago número ${pago.numero_pago}`">
                                        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                                    </button>

                                    <button v-if="!pago.fecha_impresion && pago.estado"
                                        @click="router.push(`/pagos/${pago.numero_pago}/editar`)"
                                        class="btn btn-sm btn-outline-primary"
                                        :title="`Editar pago ${pago.numero_pago}`"
                                        :aria-label="`Editar pago número ${pago.numero_pago}`">
                                        <i class="bi bi-pencil" aria-hidden="true"></i>
                                    </button>

                                    <button v-if="pago.estado"
                                        @click="imprimirComprobante(pago.numero_pago, !!pago.fecha_impresion)"
                                        class="btn btn-sm btn-outline-secondary"
                                        :title="pago.fecha_impresion ? `Reimprimir comprobante del pago ${pago.numero_pago}` : `Procesar y descargar comprobante del pago ${pago.numero_pago}`"
                                        :aria-label="pago.fecha_impresion ? `Reimprimir comprobante` : `Descargar comprobante`">
                                        <i :class="pago.fecha_impresion ? 'bi bi-download' : 'bi bi-printer'"
                                            aria-hidden="true"></i>
                                    </button>

                                    <button v-if="!pago.fecha_impresion && pago.estado" @click="anularPago(pago)"
                                        class="btn btn-sm btn-outline-danger"
                                        :title="`Anular pago ${pago.numero_pago} - Esta acción no se puede deshacer`"
                                        :aria-label="`Anular pago número ${pago.numero_pago}`">
                                        <i class="bi bi-trash" aria-hidden="true"></i>
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
                                    :class="`badge rounded-pill ${!pago.estado ? 'bg-danger' : (pago.fecha_impresion ? 'bg-success' : 'bg-warning text-dark')}`">
                                    {{ !pago.estado ? 'Inactivo' : (pago.fecha_impresion ? 'Procesado' : 'Activo') }}
                                </span>
                            </td>
                        </tr>
                        <tr v-if="pagos.length === 0">
                            <td colspan="8" class="text-center py-5">
                                <div class="empty-state">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor"
                                        class="bi bi-file-earmark-ruled text-muted mb-3" viewBox="0 0 16 16">
                                        <path
                                            d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V9H3V2a1 1 0 0 1 1-1h5.5zM3 12v-2h2v2zm0 1h2v2H4a1 1 0 0 1-1-1zm3 2v-2h7v1a1 1 0 0 1-1 1zm7-3H6v-2h7z" />
                                    </svg>
                                    <h5 class="text-muted mb-2">No hay pagos registrados</h5>
                                    <p class="text-secondary small mb-3">Comienza registrando el primer pago de un
                                        cliente</p>
                                </div>
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

/* Selected row highlight */
.table-primary {
    --bs-table-bg: rgba(13, 110, 253, 0.08);
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

/* Sticky Columns para móvil */
.sticky-col-1 {
    position: sticky;
    left: 0;
    z-index: 10;
    background-color: #fff;
    min-width: 40px;
}

.sticky-col-2 {
    position: sticky;
    left: 40px;
    /* Ancho de col 1 */
    z-index: 10;
    background-color: #fff;
    border-right: 2px solid #dee2e6;
    /* Separador visual tipo sombra */
    box-shadow: 4px 0 5px -2px rgba(0, 0, 0, 0.1);
}

/* Ajustes de fondo para estados de tabla */
tr.table-primary .sticky-col-1,
tr.table-primary .sticky-col-2 {
    background-color: rgba(13, 110, 253, 0.08);
    /* Coincidir con table-primary */
}

/* Fix para hover */
.table-hover tbody tr:hover .sticky-col-1,
.table-hover tbody tr:hover .sticky-col-2 {
    background-color: #f1f6fd;
    /* Color aproximado de hover en filas seleccionado */
}

/* Headers deben estar sobre el contenido y tener su propio color */
thead .sticky-col-1,
thead .sticky-col-2 {
    z-index: 20;
    background: linear-gradient(180deg, #e7f1ff 0%, #f8f9fa 100%) !important;
}
</style>