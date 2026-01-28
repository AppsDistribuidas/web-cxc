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
const estadoCuentaPorPagina = 25;
const estadoCuentaTabActiva = ref<'movimientos' | 'pendientes'>('movimientos'); // Tab activa

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

// Paginación de movimientos en estado de cuenta
const movimientosPaginados = computed(() => {
    if (!estadoCuentaData.value?.movimientos) return [];
    const inicio = (estadoCuentaPaginaActual.value - 1) * estadoCuentaPorPagina;
    return estadoCuentaData.value.movimientos.slice(inicio, inicio + estadoCuentaPorPagina);
});

const movimientosTotalPaginas = computed(() => {
    if (!estadoCuentaData.value?.movimientos) return 0;
    return Math.ceil(estadoCuentaData.value.movimientos.length / estadoCuentaPorPagina);
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

// --- HISTORIAL DE DOCUMENTOS ---
interface DocumentoHistorial {
    nombre: string;
    ruta: string;
    url: string;
    cedula: string;
    fecha_inicio: string;
    fecha_fin: string;
    generado: string;
    timestamp: number;
}

const showHistorialModal = ref(false);
const historialTipo = ref<'pagos' | 'estados-cuenta'>('pagos');
const historialDocumentos = ref<DocumentoHistorial[]>([]);
const historialDocumentosFiltrados = ref<DocumentoHistorial[]>([]);
const historialLoading = ref(false);

// Filtros del historial
const historialFiltroCliente = ref('');
const historialFiltroFechaInicio = ref('');
const historialFiltroFechaFin = ref('');
const historialFiltroGenerado = ref('');
const historialPaginaActual = ref(1);
const historialPorPagina = 5;

// Paginación del historial
const historialPaginados = computed(() => {
    const inicio = (historialPaginaActual.value - 1) * historialPorPagina;
    return historialDocumentosFiltrados.value.slice(inicio, inicio + historialPorPagina);
});

const historialTotalPaginas = computed(() =>
    Math.ceil(historialDocumentosFiltrados.value.length / historialPorPagina)
);

// Función para aplicar filtros del historial
const aplicarFiltrosHistorial = () => {
    historialPaginaActual.value = 1;

    historialDocumentosFiltrados.value = historialDocumentos.value.filter(doc => {
        // Filtro por cliente (cédula o nombre)
        if (historialFiltroCliente.value) {
            const busqueda = historialFiltroCliente.value.toLowerCase();
            const nombreCliente = obtenerNombreCliente(doc.cedula).toLowerCase();
            if (!doc.cedula.includes(busqueda) && !nombreCliente.includes(busqueda)) {
                return false;
            }
        }

        // Filtro por fecha inicio
        if (historialFiltroFechaInicio.value) {
            if (doc.fecha_inicio !== historialFiltroFechaInicio.value) {
                return false;
            }
        }

        // Filtro por fecha fin
        if (historialFiltroFechaFin.value) {
            if (doc.fecha_fin !== historialFiltroFechaFin.value) {
                return false;
            }
        }

        // Filtro por fecha de generación (solo fecha, sin hora)
        if (historialFiltroGenerado.value) {
            // doc.generado tiene formato "DD/MM/YYYY HH:MM"
            // historialFiltroGenerado tiene formato "YYYY-MM-DD"
            const [dia, mes, anioHora] = doc.generado.split('/');
            const anio = anioHora?.split(' ')[0];
            const fechaDoc = `${anio}-${mes}-${dia}`;
            if (fechaDoc !== historialFiltroGenerado.value) {
                return false;
            }
        }

        return true;
    });
};

// Watch para aplicar filtros cuando cambian
watch([historialFiltroCliente, historialFiltroFechaInicio, historialFiltroFechaFin, historialFiltroGenerado], () => {
    aplicarFiltrosHistorial();
});

const limpiarFiltrosHistorial = () => {
    historialFiltroCliente.value = '';
    historialFiltroFechaInicio.value = '';
    historialFiltroFechaFin.value = '';
    historialFiltroGenerado.value = '';
    historialDocumentosFiltrados.value = historialDocumentos.value;
    historialPaginaActual.value = 1;
};

const abrirHistorial = async (tipo: 'pagos' | 'estados-cuenta') => {
    historialTipo.value = tipo;
    historialLoading.value = true;
    showHistorialModal.value = true;
    historialDocumentos.value = [];
    historialDocumentosFiltrados.value = [];
    limpiarFiltrosHistorial();

    try {
        const response = await api.get('/v1/reportes/documentos', { params: { tipo } });
        historialDocumentos.value = response.data.data;
        historialDocumentosFiltrados.value = response.data.data;
    } catch (e: any) {
        showError('Error al cargar el historial de documentos.');
        console.error(e);
    } finally {
        historialLoading.value = false;
    }
};

const cerrarHistorial = () => {
    showHistorialModal.value = false;
    historialDocumentos.value = [];
    historialDocumentosFiltrados.value = [];
    historialFiltroCliente.value = '';
};

// Obtener nombre del cliente desde la cédula
const obtenerNombreCliente = (cedula: string): string => {
    if (cedula === 'todos') return 'Todos';
    const cliente = clientesDisponibles.value.find(c => c.cedula === cedula);
    return cliente ? cliente.nombre : cedula;
};

// Descargar documento del historial
const descargarDocumento = (doc: DocumentoHistorial) => {
    // Construir URL completa del backend (la URL relativa /storage/... apunta al frontend, no al backend)
    const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';
    const link = document.createElement('a');
    link.href = `${backendUrl}${doc.url}`;
    link.setAttribute('download', doc.nombre);
    link.target = '_blank'; // Abrir en nueva pestaña para evitar problemas de CORS
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// --- MEJORAS UX: Autocompletar uniforme para Pagos ---
const pagosAutocompletar = ref('');

// Nombre del cliente seleccionado para mostrar en Pagos
const nombreClienteSeleccionadoPagos = computed(() => {
    if (!pagosFilter.value.cedula_cliente) return '';
    const cliente = clientesDisponibles.value.find(c => c.cedula === pagosFilter.value.cedula_cliente);
    return cliente ? cliente.nombre : '';
});

// Watch para limpiar nombre cuando se borra la cédula en Pagos
watch(pagosAutocompletar, (newVal) => {
    if (!newVal || newVal.trim() === '') {
        pagosFilter.value.cedula_cliente = '';
    }
});

// Selección de cliente en Pagos
const seleccionarClientePagos = () => {
    const found = clientesDisponibles.value.find(c => c.cedula === pagosAutocompletar.value);
    if (found) {
        pagosFilter.value.cedula_cliente = found.cedula;
    } else if (/^\d+$/.test(pagosAutocompletar.value)) {
        pagosFilter.value.cedula_cliente = pagosAutocompletar.value;
    }
};

// Computed para filtrar clientes en Pagos (uniforme)
const filteredClientesPagosUniforme = computed(() => {
    if (!pagosAutocompletar.value) return clientesDisponibles.value.slice(0, 10);
    const busqueda = pagosAutocompletar.value.toLowerCase();
    return clientesDisponibles.value.filter(c =>
        c.cedula.includes(busqueda) ||
        (c.nombre || '').toLowerCase().includes(busqueda)
    ).slice(0, 10);
});

// Validación para PDF sin reporte generado
const validarReporteGeneradoPagos = (): boolean => {
    if (pagosResultados.value.length === 0) {
        showWarning('Primero debe generar un reporte antes de descargar el PDF.', 'Reporte requerido');
        return false;
    }
    return true;
};

const validarReporteGeneradoEstado = (): boolean => {
    if (!estadoCuentaData.value) {
        showWarning('Primero debe generar un estado de cuenta antes de descargar el PDF.', 'Reporte requerido');
        return false;
    }
    return true;
};
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
                        <div class="col-md-4">
                            <label class="form-label invisible">Acciones</label>
                            <div class="d-flex gap-2">
                                <button @click="abrirHistorial('pagos')" class="btn btn-outline-secondary"
                                    title="Ver historial de documentos">
                                    <i class="bi bi-folder2-open"></i>
                                </button>
                                <button @click="validarReporteGeneradoPagos() && generarReportePagos('pdf')"
                                    class="btn btn-danger" :disabled="pagosLoading">
                                    <i class="bi bi-file-pdf"></i> PDF
                                </button>
                                <button @click="generarReportePagos('json')" class="btn btn-primary flex-grow-1"
                                    :disabled="pagosLoading">
                                    <i class="bi bi-lightning-charge"></i> Generar
                                </button>
                            </div>
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-bold">Buscar Cliente (Nombre o Cédula) - Opcional</label>
                            <input v-model="pagosAutocompletar" list="dlPagosUniforme" class="form-control"
                                placeholder="Escriba para buscar..." @change="seleccionarClientePagos"
                                @blur="seleccionarClientePagos">
                            <datalist id="dlPagosUniforme">
                                <option v-for="c in filteredClientesPagosUniforme" :key="c.cedula" :value="c.cedula">{{
                                    c.nombre }}</option>
                            </datalist>
                            <div class="form-text"
                                :class="nombreClienteSeleccionadoPagos ? 'text-primary' : 'invisible'">
                                <i class="bi bi-person-check me-1"></i>{{ nombreClienteSeleccionadoPagos ||
                                    'Placeholder' }}
                            </div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label fw-bold">Fecha Inicio</label>
                            <input v-model="pagosFilter.fecha_inicio" type="date" class="form-control">
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label fw-bold">Fecha Fin</label>
                            <input v-model="pagosFilter.fecha_fin" type="date" class="form-control">
                            <div class="form-text invisible">Placeholder</div>
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
                Configure el filtro y presione en Generar para consultar el reporte de pagos.
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: ESTADO DE CUENTA -->
        <div v-if="activeTab === 'estadoCuenta' && can('Reporte Estado de Cuenta')">
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label invisible">Acciones</label>
                            <div class="d-flex gap-2">
                                <button @click="abrirHistorial('estados-cuenta')" class="btn btn-outline-secondary"
                                    title="Ver historial de documentos">
                                    <i class="bi bi-folder2-open"></i>
                                </button>
                                <button @click="validarReporteGeneradoEstado() && generarEstadoCuenta('pdf')"
                                    class="btn btn-danger"
                                    :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                    <i class="bi bi-file-pdf"></i> PDF
                                </button>
                                <button @click="generarEstadoCuenta('json')" class="btn btn-primary flex-grow-1"
                                    :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                    <i class="bi bi-lightning-charge"></i> Generar
                                </button>
                            </div>
                            <div class="form-text invisible">Placeholder</div>
                        </div>
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
                        <div class="col-md-2">
                            <label class="form-label fw-bold">Fecha Inicio</label>
                            <input v-model="estadoCuentaFilter.fecha_inicio" type="date" class="form-control">
                            <div class="form-text invisible">Placeholder</div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label fw-bold">Fecha Fin</label>
                            <input v-model="estadoCuentaFilter.fecha_fin" type="date" class="form-control">
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
                            <small class="text-muted">Período: {{ estadoCuentaData.periodo?.desde }} al {{
                                estadoCuentaData.periodo?.hasta }}</small>
                        </div>
                        <div class="text-end">
                            <small class="text-muted">Generado: {{ estadoCuentaData.fecha_generacion }}</small>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <!-- Saldo Inicial -->
                    <div class="bg-light border rounded p-3 mb-4 text-center">
                        <div class="text-muted small">SALDO INICIAL</div>
                        <div class="fs-3 fw-bold text-secondary">${{ Number(estadoCuentaData.saldo_inicial).toFixed(2)
                        }}</div>
                        <div class="text-muted small">(Deuda acumulada antes del {{ estadoCuentaData.periodo?.desde }})
                        </div>
                    </div>

                    <!-- Tabs de navegación -->
                    <ul class="nav nav-tabs mb-3">
                        <li class="nav-item">
                            <button class="nav-link" :class="{ active: estadoCuentaTabActiva === 'movimientos' }"
                                @click="estadoCuentaTabActiva = 'movimientos'">
                                <i class="bi bi-list-ul me-1"></i>Movimientos
                                <span class="badge bg-secondary ms-1">{{
                                    estadoCuentaData.movimientos?.length || 0
                                    }}</span>
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" :class="{ active: estadoCuentaTabActiva === 'pendientes' }"
                                @click="estadoCuentaTabActiva = 'pendientes'">
                                <i class="bi bi-clock-history me-1"></i>Pagos Pendientes
                                <span class="badge ms-1"
                                    :class="estadoCuentaData.pagos_pendientes?.length > 0 ? 'bg-warning text-dark' : 'bg-secondary'">
                                    {{ estadoCuentaData.pagos_pendientes?.length || 0 }}
                                </span>
                            </button>
                        </li>
                    </ul>

                    <!-- TAB: Movimientos -->
                    <div v-if="estadoCuentaTabActiva === 'movimientos'">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead class="table-dark">
                                    <tr>
                                        <th style="width: 12%">Fecha</th>
                                        <th style="width: 38%">Proceso</th>
                                        <th style="width: 15%" class="text-end">Debe</th>
                                        <th style="width: 15%" class="text-end">Haber</th>
                                        <th style="width: 20%" class="text-end">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template v-for="mov in movimientosPaginados" :key="mov.numero">
                                        <!-- Fila de Factura -->
                                        <tr v-if="mov.tipo === 'factura'" class="table-secondary">
                                            <td>{{ mov.fecha }}</td>
                                            <td>{{ mov.descripcion }}</td>
                                            <td class="text-end">${{ Number(mov.debe).toFixed(2) }}</td>
                                            <td class="text-end text-muted">-</td>
                                            <td class="text-end fw-bold">${{ Number(mov.saldo).toFixed(2) }}</td>
                                        </tr>
                                        <!-- Fila de Pago (solo PROCESADOS) -->
                                        <tr v-else class="table-secondary">
                                            <td>{{ mov.fecha }}</td>
                                            <td>
                                                {{ mov.descripcion }}
                                                <span class="badge bg-success ms-2">PROCESADO</span>
                                            </td>
                                            <td class="text-end text-muted">-</td>
                                            <td class="text-end fw-bold text-success">${{
                                                Number(mov.haber).toFixed(2) }}</td>
                                            <td class="text-end fw-bold">${{ Number(mov.saldo).toFixed(2) }}</td>
                                        </tr>
                                        <!-- Subfilas de facturas incluidas en el pago -->
                                        <tr v-if="mov.tipo === 'pago' && mov.detalles && mov.detalles.length > 0"
                                            v-for="det in mov.detalles" :key="det.numero_factura"
                                            class="bg-white small text-muted">
                                            <td></td>
                                            <td class="ps-4">
                                                <i class="bi bi-arrow-return-right me-1"></i>
                                                Factura {{ formatFactura(det.numero_factura) }}: ${{
                                                    Number(det.monto).toFixed(2) }}
                                            </td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                        </tr>
                                    </template>
                                </tbody>
                                <tfoot class="table-dark">
                                    <tr>
                                        <td colspan="2" class="text-end fw-bold">TOTAL</td>
                                        <td class="text-end fw-bold">${{ Number(estadoCuentaData.totales?.debe ||
                                            0).toFixed(2) }}</td>
                                        <td class="text-end fw-bold">${{ Number(estadoCuentaData.totales?.haber ||
                                            0).toFixed(2) }}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <!-- Paginación -->
                        <nav v-if="movimientosTotalPaginas > 1" class="d-flex justify-content-center mt-4">
                            <ul class="pagination mb-0">
                                <li class="page-item" :class="{ disabled: estadoCuentaPaginaActual === 1 }">
                                    <button class="page-link" @click="estadoCuentaPaginaActual--"
                                        :disabled="estadoCuentaPaginaActual === 1">
                                        <i class="bi bi-chevron-left"></i>
                                    </button>
                                </li>
                                <li v-for="p in movimientosTotalPaginas" :key="p" class="page-item"
                                    :class="{ active: estadoCuentaPaginaActual === p }">
                                    <button class="page-link" @click="estadoCuentaPaginaActual = p">{{ p }}</button>
                                </li>
                                <li class="page-item"
                                    :class="{ disabled: estadoCuentaPaginaActual === movimientosTotalPaginas }">
                                    <button class="page-link" @click="estadoCuentaPaginaActual++"
                                        :disabled="estadoCuentaPaginaActual === movimientosTotalPaginas">
                                        <i class="bi bi-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>

                    <!-- TAB: Pagos Pendientes -->
                    <div v-if="estadoCuentaTabActiva === 'pendientes'">
                        <div v-if="estadoCuentaData.pagos_pendientes?.length > 0">
                            <div class="alert alert-warning mb-3">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                <strong>Nota:</strong> Los pagos pendientes no afectan el saldo final hasta que sean
                                procesados.
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <thead style="background-color: #ffc107; color: #212529;">
                                        <tr>
                                            <th style="width: 12%">Fecha</th>
                                            <th>Descripción</th>
                                            <th style="width: 18%" class="text-end">Monto Individual</th>
                                            <th style="width: 15%" class="text-end">Monto Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="pago in estadoCuentaData.pagos_pendientes" :key="pago.numero">
                                            <tr style="background-color: #fff3cd;">
                                                <td>{{ pago.fecha }}</td>
                                                <td>{{ pago.descripcion }}</td>
                                                <td class="text-end text-muted">-</td>
                                                <td class="text-end fw-bold" style="color: #b8860b;">${{
                                                    Number(pago.haber).toFixed(2) }}</td>
                                            </tr>
                                            <!-- Subfilas de facturas incluidas en el pago pendiente -->
                                            <tr v-if="pago.detalles && pago.detalles.length > 0"
                                                v-for="det in pago.detalles" :key="det.numero_factura"
                                                class="bg-white small text-muted">
                                                <td></td>
                                                <td class="ps-4">
                                                    <i class="bi bi-arrow-return-right me-1"></i>
                                                    Factura {{ formatFactura(det.numero_factura) }}
                                                </td>
                                                <td class="text-end">${{ Number(det.monto).toFixed(2) }}</td>
                                                <td></td>
                                            </tr>
                                        </template>
                                    </tbody>
                                    <tfoot style="background-color: #ffc107; color: #212529;">
                                        <tr>
                                            <td colspan="3" class="text-end fw-bold">TOTAL PENDIENTE</td>
                                            <td class="text-end fw-bold" style="color: #856404;">${{
                                                Number(estadoCuentaData.totales?.pendientes || 0).toFixed(2) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        <div v-else class="text-center text-muted py-5">
                            <i class="bi bi-check-circle fs-1 text-success"></i>
                            <p class="mt-2">No hay pagos pendientes de procesamiento.</p>
                        </div>
                    </div>

                    <!-- Saldo Final -->
                    <div class="border border-success rounded p-3 mt-4 text-center">
                        <div class="text-muted small mb-2">
                            SALDO FINAL = Saldo Inicial + Total Debe − Total Haber
                        </div>
                        <div class="text-muted small mb-2">
                            ${{ Number(estadoCuentaData.saldo_inicial).toFixed(2) }} +
                            ${{ Number(estadoCuentaData.totales?.debe || 0).toFixed(2) }} −
                            ${{ Number(estadoCuentaData.totales?.haber || 0).toFixed(2) }}
                        </div>
                        <div class="text-success small fw-bold">SALDO FINAL</div>
                        <div class="fs-2 fw-bold text-success">${{ Number(estadoCuentaData.saldo_final).toFixed(2) }}
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="alert alert-secondary text-center mt-4">
                Configure el filtro y presione en Generar para consultar el estado de cuenta.
            </div>
        </div>
    </div>

    <!-- MODAL: HISTORIAL DE DOCUMENTOS -->
    <div v-if="showHistorialModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-folder2-open me-2"></i>
                        Historial de {{ historialTipo === 'pagos' ? 'Reportes de Pagos' : 'Estados de Cuenta' }}
                    </h5>
                    <button type="button" class="btn-close" @click="cerrarHistorial"></button>
                </div>
                <div class="modal-body">
                    <!-- Filtros -->
                    <div class="row g-2 mb-3">
                        <div class="col" style="width: 60px; flex: 0 0 60px;">
                            <label class="form-label small text-muted mb-1">&nbsp;</label>
                            <button @click="limpiarFiltrosHistorial" class="btn btn-sm btn-outline-secondary w-100">
                                <i class="bi bi-x-circle"></i>
                            </button>
                        </div>
                        <div class="col">
                            <label class="form-label small text-muted mb-1">Cliente</label>
                            <input v-model="historialFiltroCliente" type="text" class="form-control form-control-sm"
                                placeholder="Nombre o cédula...">
                        </div>
                        <div class="col">
                            <label class="form-label small text-muted mb-1">Fecha Inicio</label>
                            <input v-model="historialFiltroFechaInicio" type="date"
                                class="form-control form-control-sm">
                        </div>
                        <div class="col">
                            <label class="form-label small text-muted mb-1">Fecha Fin</label>
                            <input v-model="historialFiltroFechaFin" type="date" class="form-control form-control-sm">
                        </div>
                        <div class="col">
                            <label class="form-label small text-muted mb-1">Generado</label>
                            <input v-model="historialFiltroGenerado" type="date" class="form-control form-control-sm">
                        </div>
                    </div>

                    <div v-if="historialLoading" class="text-center py-4">
                        <div class="spinner-border text-primary"></div>
                        <p class="mt-2 text-muted">Cargando documentos...</p>
                    </div>

                    <div v-else-if="historialDocumentos.length === 0" class="text-center py-4">
                        <i class="bi bi-folder-x display-4 text-muted"></i>
                        <p class="mt-2 text-muted">No hay documentos generados aún.</p>
                    </div>

                    <div v-else-if="historialDocumentosFiltrados.length === 0" class="text-center py-4">
                        <i class="bi bi-search display-4 text-muted"></i>
                        <p class="mt-2 text-muted">No se encontraron documentos con ese filtro.</p>
                    </div>

                    <div v-else>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width: 60px;" class="text-center">Acciones</th>
                                        <th>Cliente</th>
                                        <th>Fecha Inicio</th>
                                        <th>Fecha Fin</th>
                                        <th>Generado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="doc in historialPaginados" :key="doc.nombre">
                                        <td class="text-center">
                                            <button @click="descargarDocumento(doc)" class="btn btn-sm btn-primary"
                                                title="Descargar">
                                                <i class="bi bi-download"></i>
                                            </button>
                                        </td>
                                        <td>
                                            <span class="fw-medium">{{ obtenerNombreCliente(doc.cedula) }}</span>
                                            <small v-if="doc.cedula !== 'todos'" class="text-muted d-block">{{
                                                doc.cedula }}</small>
                                        </td>
                                        <td>{{ doc.fecha_inicio }}</td>
                                        <td>{{ doc.fecha_fin }}</td>
                                        <td>{{ doc.generado }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Paginación -->
                        <nav v-if="historialTotalPaginas > 1" class="d-flex justify-content-center mt-3">
                            <ul class="pagination pagination-sm mb-0">
                                <li class="page-item" :class="{ disabled: historialPaginaActual === 1 }">
                                    <button class="page-link" @click="historialPaginaActual--"
                                        :disabled="historialPaginaActual === 1">
                                        <i class="bi bi-chevron-left"></i>
                                    </button>
                                </li>
                                <li v-for="p in historialTotalPaginas" :key="p" class="page-item"
                                    :class="{ active: historialPaginaActual === p }">
                                    <button class="page-link" @click="historialPaginaActual = p">{{ p }}</button>
                                </li>
                                <li class="page-item"
                                    :class="{ disabled: historialPaginaActual === historialTotalPaginas }">
                                    <button class="page-link" @click="historialPaginaActual++"
                                        :disabled="historialPaginaActual === historialTotalPaginas">
                                        <i class="bi bi-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>

                        <div class="text-muted small text-center mt-2">
                            Mostrando {{ historialPaginados.length }} de {{ historialDocumentosFiltrados.length }}
                            documentos
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="cerrarHistorial">Cerrar</button>
                </div>
            </div>
        </div>
    </div>
</template>
