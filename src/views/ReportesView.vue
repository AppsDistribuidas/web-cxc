<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import api from '@/api/axios';
import { useAuth } from '@/composables/useAuth';

const { can } = useAuth();

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
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    cedula_cliente: ''
});

const pagosResultados = ref<any[]>([]);
const pagosLoading = ref(false);

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

const generarReportePagos = async (type: 'json' | 'pdf') => {
    pagosLoading.value = true;
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
        } else {
            const response = await api.get('/v1/reportes/pagos', { params });
            pagosResultados.value = response.data.data;
        }
    } catch (e) {
        alert("Error al generar reporte de pagos. Verifique las fechas.");
        console.error(e);
    } finally {
        pagosLoading.value = false;
    }
};

// --- PESTAÑA: ESTADO DE CUENTA ---
const estadoCuentaFilter = ref({
    cedula_cliente: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0]
});
const estadoCuentaData = ref<any>(null); // Objeto con estructura { cliente, resumen, facturas }
const estadoCuentaLoading = ref(false);
const estadoCuentaAutocompletar = ref(''); // Input separado para búsqueda

const filteredClientesEstado = computed(() => {
    if (!estadoCuentaAutocompletar.value) return clientesDisponibles.value.slice(0, 10);
    const busqueda = estadoCuentaAutocompletar.value.toLowerCase();
    return clientesDisponibles.value.filter(c =>
        c.cedula.includes(busqueda) ||
        (c.nombre || '').toLowerCase().includes(busqueda)
    ).slice(0, 10);
});

const generarEstadoCuenta = async (type: 'json' | 'pdf') => {
    if (!estadoCuentaFilter.value.cedula_cliente) {
        alert("Debe seleccionar un cliente.");
        return;
    }
    estadoCuentaLoading.value = true;
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
        } else {
            const response = await api.get('/v1/reportes/estado-cuenta', { params });
            estadoCuentaData.value = response.data.data;
        }
    } catch (e) {
        alert("Error al generar estado de cuenta.");
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
                        <div class="col-md-3 d-flex gap-2">
                            <button @click="generarReportePagos('json')" class="btn btn-primary flex-grow-1"
                                :disabled="pagosLoading">
                                <i class="bi bi-search"></i> Consultar
                            </button>
                            <button @click="generarReportePagos('pdf')" class="btn btn-danger" :disabled="pagosLoading">
                                <i class="bi bi-file-pdf"></i> PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="pagosLoading" class="text-center py-5">
                <div class="spinner-border text-primary"></div>
            </div>

            <div v-else-if="pagosResultados.length > 0" class="card border-0 shadow">
                <div class="card-body">
                    <div v-for="p in pagosResultados" :key="p.numero_pago" class="mb-4">
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
                                        Number(cur.monto_pagado), 0)).toFixed(2) }}
                                </span>
                            </div>
                        </div>

                        <!-- Lista de facturas de este pago -->
                        <div v-if="p.detalles && p.detalles.length > 0" class="ps-4 mt-2">
                            <table class="table table-sm table-borderless mb-0 small">
                                <thead>
                                    <tr class="text-muted border-bottom">
                                        <th style="width: 40%">Factura Cancelada</th>
                                        <th class="text-end" style="width: 20%">Monto Cancelado</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="d in p.detalles" :key="d.id">
                                        <td>Factura {{ formatFactura(d.numero_factura) }}</td>
                                        <td class="text-end fw-bold">${{ Number(d.monto_pagado).toFixed(2) }}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="ps-4 mt-2 text-muted small fst-italic">
                            Sin detalles registrados.
                        </div>
                    </div>
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
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Inicio</label>
                            <input v-model="estadoCuentaFilter.fecha_inicio" type="date" class="form-control">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Fecha Fin</label>
                            <input v-model="estadoCuentaFilter.fecha_fin" type="date" class="form-control">
                        </div>
                        <div class="col-md-2 d-flex gap-2">
                            <button @click="generarEstadoCuenta('json')" class="btn btn-primary flex-grow-1"
                                :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                <i class="bi bi-eye"></i> Ver
                            </button>
                            <button @click="generarEstadoCuenta('pdf')" class="btn btn-danger"
                                :disabled="estadoCuentaLoading || !estadoCuentaFilter.cedula_cliente">
                                <i class="bi bi-file-pdf"></i> PDF
                            </button>
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
                            <h4 class="mb-0 text-success">Total Pendiente</h4>
                            <h2 class="fw-bold">$ {{ Number(estadoCuentaData.resumen.total_pendiente).toFixed(2) }}</h2>
                            <div class="small text-muted">Total Facturado: $ {{
                                Number(estadoCuentaData.resumen.total_facturado).toFixed(2) }}</div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <hr>
                    <div v-for="factura in estadoCuentaData.facturas" :key="factura.numero_factura" class="mb-4">
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
                </div>
            </div>

            <div v-else class="alert alert-secondary text-center mt-4">
                Seleccione un cliente y haga clic en Ver para consultar su estado de cuenta.
            </div>
        </div>
    </div>
</template>
