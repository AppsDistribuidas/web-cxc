<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import api from '@/api/axios';
import { useAuth } from '@/composables/useAuth';
import { useSweetAlert } from '@/composables/useSweetAlert';

const { can } = useAuth();
const { showSuccess, showError, showWarning } = useSweetAlert();

// --- ESTADO GENERAL ---
const activeTab = ref<'pagos' | 'estadoCuenta'>('pagos');

// Ajustar tab inicial según permisos
onMounted(() => {
    if (can('Reporte de Pagos')) {
        activeTab.value = 'pagos';
    } else if (can('Reporte Estado de Cuenta')) {
        activeTab.value = 'estadoCuenta';
    }
});


// --- PESTAÑA: REPORTE DE PAGOS ---
const pagosFilter = ref({
    fecha_inicio: new Date().toISOString().split('T')[0] as string,
    fecha_fin: new Date().toISOString().split('T')[0] as string,
    cedula_cliente: ''
});

const pagosResultados = ref<any[]>([]);
const pagosLoading = ref(false);
const pagosPaginaActual = ref(1);
const pagosPorPagina = 5;

// Clientes para autocompletar (reutilizado)
const clientesDisponibles = ref<any[]>([]);
const filteredClientesPagos = computed(() => {
    if (!pagosFilter.value.cedula_cliente) return clientesDisponibles.value.slice(0, 10);
    const busqueda = pagosFilter.value.cedula_cliente.toLowerCase();
    return clientesDisponibles.value.filter(c =>
        c.cedula.includes(busqueda) ||
        (c.nombre || '').toLowerCase().includes(busqueda)
    ).slice(0, 10);
});

// Paginación de pagos
const pagosPaginados = computed(() => {
    const inicio = (pagosPaginaActual.value - 1) * pagosPorPagina;
    return pagosResultados.value.slice(inicio, inicio + pagosPorPagina);
});

const pagosTotalPaginas = computed(() => Math.ceil(pagosResultados.value.length / pagosPorPagina));

// Validación de fechas
const validarFechas = (fechaInicio: string, fechaFin: string): boolean => {
    if (!fechaInicio || !fechaFin) {
        showError('Ambas fechas son requeridas.', 'Fechas inválidas');
        return false;
    }
    if (new Date(fechaFin) < new Date(fechaInicio)) {
        showError('La fecha de fin no puede ser menor a la fecha de inicio.', 'Fechas inválidas');
        return false;
    }
    return true;
};

// Validación de cliente
const validarCliente = (cedula: string): boolean => {
    if (!cedula) return true; // Cliente es opcional en reporte de pagos
    const existe = clientesDisponibles.value.some(c => c.cedula === cedula);
    if (!existe) {
        showError(`No se encontró un cliente con la cédula "${cedula}".`, 'Cliente no encontrado');
        return false;
    }
    return true;
};

const generarReportePagos = async (type: 'json' | 'pdf') => {
    // Validaciones
    if (!validarFechas(pagosFilter.value.fecha_inicio, pagosFilter.value.fecha_fin)) return;
    if (!validarCliente(pagosFilter.value.cedula_cliente)) return;

    pagosLoading.value = true;
    pagosPaginaActual.value = 1; // Reset paginación
    try {
        const params = { ...pagosFilter.value };
        if (type === 'pdf') {
            const response = await api.get('/v1/reportes/pagos', { params: { ...params, pdf: 1 }, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'reporte_pagos.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showSuccess('El reporte de pagos se ha descargado correctamente.', '¡PDF Generado!');
        } else {
            const response = await api.get('/v1/reportes/pagos', { params });
            pagosResultados.value = response.data.data;
            if (pagosResultados.value.length === 0) {
                showWarning('No se encontraron pagos en el rango de fechas especificado.');
            } else {
                showSuccess(`Se encontraron ${pagosResultados.value.length} pago(s).`, 'Consulta exitosa');
            }
        }
    } catch (e: any) {
        const mensaje = e.response?.data?.message || 'Error al generar reporte de pagos. Verifique las fechas.';
        showError(mensaje);
        console.error(e);
    } finally {
        pagosLoading.value = false;
    }
};

// --- PESTAÑA: ESTADO DE CUENTA ---
const estadoCuentaFilter = ref({
    cedula_cliente: '',
    fecha_inicio: new Date().toISOString().split('T')[0] as string,
    fecha_fin: new Date().toISOString().split('T')[0] as string
});
const estadoCuentaData = ref<any>(null); // Objeto con estructura { cliente, resumen, facturas }
const estadoCuentaLoading = ref(false);
const estadoCuentaAutocompletar = ref(''); // Input separado para búsqueda
const estadoCuentaPaginaActual = ref(1);
const estadoCuentaPorPagina = 5;

const filteredClientesEstado = computed(() => {
    if (!estadoCuentaAutocompletar.value) return clientesDisponibles.value.slice(0, 10);
    const busqueda = estadoCuentaAutocompletar.value.toLowerCase();
    return clientesDisponibles.value.filter(c =>
        c.cedula.includes(busqueda) ||
        (c.nombre || '').toLowerCase().includes(busqueda)
    ).slice(0, 10);
});

// Nombre del cliente seleccionado para mostrar
const nombreClienteSeleccionado = computed(() => {
    if (!estadoCuentaFilter.value.cedula_cliente) return '';
    const cliente = clientesDisponibles.value.find(c => c.cedula === estadoCuentaFilter.value.cedula_cliente);
    return cliente ? cliente.nombre : '';
});

// Watch para limpiar nombre cuando se borra la cédula
watch(estadoCuentaAutocompletar, (newVal) => {
    if (!newVal || newVal.trim() === '') {
        estadoCuentaFilter.value.cedula_cliente = '';
    }
});

// Paginación de facturas en estado de cuenta
const facturasPaginadas = computed(() => {
    if (!estadoCuentaData.value?.facturas) return [];
    const inicio = (estadoCuentaPaginaActual.value - 1) * estadoCuentaPorPagina;
    return estadoCuentaData.value.facturas.slice(inicio, inicio + estadoCuentaPorPagina);
});

const facturasTotalPaginas = computed(() => {
    if (!estadoCuentaData.value?.facturas) return 0;
    return Math.ceil(estadoCuentaData.value.facturas.length / estadoCuentaPorPagina);
});

const generarEstadoCuenta = async (type: 'json' | 'pdf') => {
    // Validar cliente obligatorio
    if (!estadoCuentaFilter.value.cedula_cliente) {
        showError('Debe seleccionar un cliente.', 'Cliente requerido');
        return;
    }

    // Validar que el cliente exista
    const clienteExiste = clientesDisponibles.value.some(c => c.cedula === estadoCuentaFilter.value.cedula_cliente);
    if (!clienteExiste) {
        showError('El cliente seleccionado no existe en el sistema.', 'Cliente no encontrado');
        return;
    }

    // Validar fechas
    if (!validarFechas(estadoCuentaFilter.value.fecha_inicio, estadoCuentaFilter.value.fecha_fin)) return;

    estadoCuentaLoading.value = true;
    estadoCuentaPaginaActual.value = 1; // Reset paginación
    try {
        const params = {
            cedula_cliente: estadoCuentaFilter.value.cedula_cliente,
            fecha_inicio: estadoCuentaFilter.value.fecha_inicio,
            fecha_fin: estadoCuentaFilter.value.fecha_fin
        };

        if (type === 'pdf') {
            const response = await api.get('/v1/reportes/estado-cuenta', { params: { ...params, pdf: 1 }, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'estado_cuenta.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showSuccess('El estado de cuenta se ha descargado correctamente.', '¡PDF Generado!');
        } else {
            const response = await api.get('/v1/reportes/estado-cuenta', { params });
            estadoCuentaData.value = response.data.data;
            showSuccess('Estado de cuenta generado correctamente.', 'Consulta exitosa');
        }
    } catch (e: any) {
        const mensaje = e.response?.data?.message || 'Error al generar estado de cuenta.';
        showError(mensaje);
        console.error(e);
    } finally {
        estadoCuentaLoading.value = false;
    }
};

const formatFactura = (num: string) => {
    // Formato 000-000-000000000
    // Asumimos que viene solo números, si no, limpiar
    const clean = num.replace(/\D/g, '');
    if (clean.length === 15) {
        return `${clean.substring(0, 3)}-${clean.substring(3, 6)}-${clean.substring(6)}`;
    }
    return num;
};

// Selección de cliente en Estado de Cuenta
const seleccionarClienteEstado = () => {
    // Buscar en la lista si existe coincidencia exacta
    const found = clientesDisponibles.value.find(c => c.cedula === estadoCuentaAutocompletar.value);
    if (found) {
        estadoCuentaFilter.value.cedula_cliente = found.cedula;
    } else {
        // Intento por nombre parcial si es único? Mejor forzar selección exacta o por cedula
        // Si el input es una cédula válida, lo usamos
        if (/^\d+$/.test(estadoCuentaAutocompletar.value)) {
            estadoCuentaFilter.value.cedula_cliente = estadoCuentaAutocompletar.value;
        }
    }
};

onMounted(async () => {
    try {
        const resp = await api.get('/v1/pagos/clientes');
        clientesDisponibles.value = resp.data.data;
    } catch (e) {
        console.error("Error cargando clientes", e);
    }
});
</script>

<template>
    <div class="container mt-4">
        <h2 class="mb-4">Reportes y Consultas</h2>

        <ul class="nav nav-tabs mb-4">
            <li v-if="can('Reporte de Pagos')" class="nav-item">
                <a class="nav-link" :class="{ active: activeTab === 'pagos' }" href="#"
                    @click.prevent="activeTab = 'pagos'">
                    Reporte de Pagos
                </a>
            </li>
            <li v-if="can('Reporte Estado de Cuenta')" class="nav-item">
                <a class="nav-link" :class="{ active: activeTab === 'estadoCuenta' }" href="#"
                    @click.prevent="activeTab = 'estadoCuenta'">
                    Estado de Cuenta
                </a>
            </li>
        </ul>

        <!-- CONTENIDO PESTAÑA: PAGOS -->
        <div v-if="activeTab === 'pagos' && can('Reporte de Pagos')">
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Inicio</label>
                            <input v-model="pagosFilter.fecha_inicio" type="date" class="form-control">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Fin</label>
                            <input v-model="pagosFilter.fecha_fin" type="date" class="form-control">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Cliente (Opcional)</label>
                            <input v-model="pagosFilter.cedula_cliente" list="dlPagos" class="form-control"
                                placeholder="Todos los clientes...">
                            <datalist id="dlPagos">
                                <option v-for="c in filteredClientesPagos" :key="c.cedula" :value="c.cedula">{{ c.nombre
                                }}</option>
                            </datalist>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label invisible">Acciones</label>
                            <div class="d-flex gap-2">
                                <button @click="generarReportePagos('json')" class="btn btn-primary flex-grow-1"
                                    :disabled="pagosLoading">
                                    <i class="bi bi-search"></i> Consultar
                                </button>
                                <button @click="generarReportePagos('pdf')" class="btn btn-danger"
                                    :disabled="pagosLoading">
                                    <i class="bi bi-file-pdf"></i> PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="pagosLoading" class="text-center py-5">
                <div class="spinner-border text-primary"></div>
            </div>

            <div v-else-if="pagosResultados.length > 0" class="card border-0 shadow">
                <div class="card-body">
                    <div v-for="p in pagosPaginados" :key="p.numero_pago" class="mb-4">
                        <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                            <div>
                                <strong>Pago {{ p.numero_pago }}</strong>
                                <span class="text-muted mx-2">|</span>
                                <small>Fecha: {{ p.fecha?.substring(0, 10) }}</small>
                                <span class="text-muted mx-2">|</span>
                                <small class="text-primary">{{ p.nombre_cliente }}</small>
                                <small class="text-muted ms-1">({{ p.cedula_cliente }})</small>
                            </div>
                            <div>
                                <span class="badge bg-success" style="font-size: 0.9rem;">
                                    Total: ${{Number(p.detalles.reduce((acc: number, cur: any) => acc +
                                        Number(cur.monto_pagado), 0)).toFixed(2)}}
                                </span>
                            </div>
                        </div>

                        <!-- Descripción del pago -->
                        <div v-if="p.descripcion" class="ps-2 mt-1">
                            <small class="text-muted fst-italic text-truncate d-block" style="max-width: 100%;">
                                <i class="bi bi-chat-left-text me-1"></i>{{ p.descripcion }}
                            </small>
                        </div>

                        <!-- Lista de facturas de este pago -->
                        <div v-if="p.detalles && p.detalles.length > 0" class="ps-4 mt-2">
                            <table class="table table-sm table-borderless mb-0 small">
                                <thead>
                                    <tr class="text-muted border-bottom">
                                        <th style="width: 30%">Factura Cancelada</th>
                                        <th style="width: 20%">Fecha Factura</th>
                                        <th class="text-end" style="width: 20%">Total Factura</th>
                                        <th class="text-end" style="width: 20%">Monto Cancelado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="d in p.detalles" :key="d.id">
                                        <td>Factura {{ formatFactura(d.numero_factura) }}</td>
                                        <td>{{ d.fecha_factura?.substring(0, 10) || 'N/A' }}</td>
                                        <td class="text-end text-muted">${{ Number(d.total_factura || 0).toFixed(2) }}
                                        </td>
                                        <td class="text-end fw-bold text-success">${{ Number(d.monto_pagado).toFixed(2)
                                            }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="ps-4 mt-2 text-muted small fst-italic">
                            Sin detalles registrados.
                        </div>
                    </div>

                    <!-- Paginación Pagos -->
                    <nav v-if="pagosTotalPaginas > 1" class="d-flex justify-content-center mt-4">
                        <ul class="pagination mb-0">
                            <li class="page-item" :class="{ disabled: pagosPaginaActual === 1 }">
                                <button class="page-link" @click="pagosPaginaActual--"
                                    :disabled="pagosPaginaActual === 1">
                                    <i class="bi bi-chevron-left"></i>
                                </button>
                            </li>
                            <li v-for="p in pagosTotalPaginas" :key="p" class="page-item"
                                :class="{ active: pagosPaginaActual === p }">
                                <button class="page-link" @click="pagosPaginaActual = p">{{ p }}</button>
                            </li>
                            <li class="page-item" :class="{ disabled: pagosPaginaActual === pagosTotalPaginas }">
                                <button class="page-link" @click="pagosPaginaActual++"
                                    :disabled="pagosPaginaActual === pagosTotalPaginas">
                                    <i class="bi bi-chevron-right"></i>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
            <div v-else class="alert alert-secondary text-center mt-4">
                Configure los filtros y presione Consultar para ver los resultados.
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: ESTADO DE CUENTA -->
        <div v-if="activeTab === 'estadoCuenta' && can('Reporte Estado de Cuenta')">
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label fw-bold">Buscar Cliente (Nombre o Cédula)</label>
                            <input v-model="estadoCuentaAutocompletar" list="dlEstado" class="form-control"
                                placeholder="Escriba para buscar..." @change="seleccionarClienteEstado"
                                @blur="seleccionarClienteEstado">
                            <datalist id="dlEstado">
                                <option v-for="c in filteredClientesEstado" :key="c.cedula" :value="c.cedula">{{
                                    c.nombre }}</option>
                            </datalist>
                            <div class="form-text" :class="nombreClienteSeleccionado ? 'text-primary' : 'invisible'">
                                <i class="bi bi-person-check me-1"></i>{{ nombreClienteSeleccionado || 'Placeholder' }}
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Inicio</label>
                            <input v-model="estadoCuentaFilter.fecha_inicio" type="date" class="form-control">
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Fin</label>
                            <input v-model="estadoCuentaFilter.fecha_fin" type="date" class="form-control">
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label invisible">Acciones</label>
                            <div class="d-flex gap-2">
                                <button @click="generarEstadoCuenta('json')" class="btn btn-primary flex-grow-1"
                                    :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                    <i class="bi bi-eye"></i> Ver
                                </button>
                                <button @click="generarEstadoCuenta('pdf')" class="btn btn-danger"
                                    :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                    <i class="bi bi-file-pdf"></i> PDF
                                </button>
                            </div>
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="estadoCuentaLoading" class="text-center py-5">
                <div class="spinner-border text-primary"></div>
            </div>

            <div v-else-if="estadoCuentaData" class="card border-0 shadow">
                <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h3 class="fw-bold text-primary">{{ estadoCuentaData.cliente }}</h3>
                            <p class="text-muted mb-0">C.I. {{ estadoCuentaData.cedula }}</p>
                            <small class="text-muted">Generado: {{ estadoCuentaData.fecha_generacion }}</small>
                        </div>
                        <div class="text-end">
                            <div class="mb-2">
                                <span class="text-muted">Total Facturado:</span>
                                <span class="fw-bold ms-2">$ {{
                                    Number(estadoCuentaData.resumen.total_facturado).toFixed(2) }}</span>
                            </div>
                            <div class="mb-2">
                                <span class="text-primary">Total Cancelado:</span>
                                <span class="fw-bold text-primary ms-2">$ {{
                                    Number(estadoCuentaData.resumen.total_cancelado || 0).toFixed(2) }}</span>
                            </div>
                            <div class="mb-2">
                                <span class="text-warning">Pagos Pendientes:</span>
                                <span class="fw-bold text-warning ms-2">$ {{
                                    Number(estadoCuentaData.resumen.total_pagos_pendientes || 0).toFixed(2) }}</span>
                            </div>
                            <div>
                                <span class="text-success fw-bold">Saldo Total Pendiente:</span>
                                <h3 class="fw-bold text-success mb-0 d-inline ms-2">$ {{
                                    Number(estadoCuentaData.resumen.total_pendiente).toFixed(2) }}</h3>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <hr>
                    <div v-for="factura in facturasPaginadas" :key="factura.numero_factura" class="mb-4">
                        <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                            <div>
                                <strong>Factura {{ formatFactura(factura.numero_factura) }}</strong>
                                <span class="text-muted mx-2">|</span>
                                <small>Fecha: {{ factura.fecha_emision?.substring(0, 10) }}</small>
                            </div>
                            <div>
                                <span class="badge bg-secondary me-2">Total: ${{ Number(factura.total).toFixed(2)
                                    }}</span>
                                <span v-if="Number(factura.saldo_pendiente) > 0" class="badge bg-warning text-dark">
                                    Saldo: ${{ Number(factura.saldo_pendiente).toFixed(2) }}
                                </span>
                                <span v-else class="badge bg-success">
                                    PAGADO
                                </span>
                            </div>
                        </div>

                        <!-- Lista de pagos de esta factura -->
                        <div v-if="factura.pagos && factura.pagos.length > 0" class="ps-4 mt-2">
                            <table class="table table-sm table-borderless mb-0 small">
                                <thead>
                                    <tr class="text-muted border-bottom">
                                        <th style="width: 20%">Fecha</th>
                                        <th style="width: 20%">Ref. Pago</th>
                                        <th style="width: 20%">Estado</th>
                                        <th class="text-end">Monto Abonado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="pago in factura.pagos" :key="pago.numero_pago">
                                        <td>{{ pago.fecha?.substring(0, 10) }}</td>
                                        <td>{{ pago.numero_pago }}</td>
                                        <td>
                                            <span class="badge"
                                                :class="pago.estado_pago === 'PROCESADO' ? 'bg-success' : 'bg-warning text-dark'">
                                                {{ pago.estado_pago }}
                                            </span>
                                        </td>
                                        <td class="text-end text-success fw-bold">$ {{
                                            Number(pago.monto_pagado).toFixed(2) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="ps-4 mt-2 text-muted small fst-italic">
                            No se han registrado pagos para esta factura.
                        </div>
                    </div>

                    <!-- Paginación Estado de Cuenta -->
                    <nav v-if="facturasTotalPaginas > 1" class="d-flex justify-content-center mt-4">
                        <ul class="pagination mb-0">
                            <li class="page-item" :class="{ disabled: estadoCuentaPaginaActual === 1 }">
                                <button class="page-link" @click="estadoCuentaPaginaActual--"
                                    :disabled="estadoCuentaPaginaActual === 1">
                                    <i class="bi bi-chevron-left"></i>
                                </button>
                            </li>
                            <li v-for="p in facturasTotalPaginas" :key="p" class="page-item"
                                :class="{ active: estadoCuentaPaginaActual === p }">
                                <button class="page-link" @click="estadoCuentaPaginaActual = p">{{ p }}</button>
                            </li>
                            <li class="page-item"
                                :class="{ disabled: estadoCuentaPaginaActual === facturasTotalPaginas }">
                                <button class="page-link" @click="estadoCuentaPaginaActual++"
                                    :disabled="estadoCuentaPaginaActual === facturasTotalPaginas">
                                    <i class="bi bi-chevron-right"></i>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>

            <div v-else class="alert alert-secondary text-center mt-4">
                Seleccione un cliente y haga clic en Ver para consultar su estado de cuenta.
            </div>
        </div>
    </div>
</template>
