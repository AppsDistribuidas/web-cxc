<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import type { Pago } from '@/types/PaymentTypes';

const router = useRouter();

const pagos = ref<Pago[]>([]);
const allPagos = ref<Pago[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Filtros por columna
const filtroCedula = ref('');
const filtroNumeroPago = ref('');
const filtroCuenta = ref('');
const filtroEstado = ref<'all' | 'activo' | 'inactivo' | 'procesado'>('all');
const filtroFecha = ref(''); // fecha exacta
const filtroMonto = ref(''); // monto exacto (string)

// Ordenamiento
// Por defecto ordenamos por fecha (últimos primero)
const sortBy = ref<string | null>('fecha');
const sortDir = ref<'asc' | 'desc'>('desc');

const toggleSort = (key: string) => {
    if (sortBy.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortDir.value = 'asc';
    }
    // Reaplicar filtro+orden
    aplicarFiltro();
};

const limpiarFiltros = () => {
    filtroNumeroPago.value = '';
    filtroCedula.value = '';
    filtroCuenta.value = '';
    filtroEstado.value = 'all';
    filtroFecha.value = '';
    filtroMonto.value = '';
    aplicarFiltro();
};

const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'N/A';
    
    try {
        // 1. Limpiamos la fecha por si viene con hora o formato ISO
        // Nos quedamos solo con la parte YYYY-MM-DD
        const soloFecha = fechaString.split('T')[0]?.split(' ')[0] ?? '';
        
        // 2. Creamos la fecha forzando la hora local para evitar desfases
        const fecha = new Date(soloFecha + 'T00:00:00');
        
        // 3. Validamos que sea una fecha válida antes de formatear
        if (isNaN(fecha.getTime())) {
            return fechaString; // Si falla, devolvemos el original
        }

        return new Intl.DateTimeFormat('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(fecha);
    } catch (e) {
        return fechaString; // Fallback de seguridad
    }
};

const obtenerPagos = async () => {
    loading.value = true;
    error.value = null;
    try {
        // Traemos todos los pagos y almacenamos en allPagos para permitir filtrado local por subcadenas
        const response = await api.get('/v1/pagos');
        const respData = response.data.data || [];
        // Normalizamos monto_total por si el backend no lo devuelve; sumamos detalles si es necesario
        allPagos.value = respData.map((p: any) => {
            const fallbackTotal = (p.detalles || []).reduce((acc: number, d: any) => acc + (Number(d.monto_pagado ?? d.monto_pagar ?? d.monto) || 0), 0);
            return { ...p, monto_total: Number(p.monto_total) || fallbackTotal };
        });
        aplicarFiltro();
    } catch (e: any) {
        error.value = "Error al cargar los pagos. Intente nuevamente.";
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const aplicarFiltro = () => {
    let resultado = allPagos.value.slice();

    // Filtro por número de pago (parcial)
    if (filtroNumeroPago.value.trim()) {
        const q = filtroNumeroPago.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.numero_pago ?? '').toLowerCase().includes(q));
    }

    // Filtro por cédula (parcial)
    if (filtroCedula.value.trim()) {
        const q = filtroCedula.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.cedula_cliente ?? '').toLowerCase().includes(q));
    }

    // Filtro por cuenta
    if (filtroCuenta.value.trim()) {
        const q = filtroCuenta.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.codigo_cuenta ?? '').toLowerCase().includes(q));
    }

    // Filtro por estado
    if (filtroEstado.value === 'all') {
        // Por defecto: mostrar solo activos o procesados (excluir inactivos)
        resultado = resultado.filter(p => p.estado === true || !!p.fecha_impresion);
    } else {
        if (filtroEstado.value === 'activo') {
            // Activos que no han sido procesados
            resultado = resultado.filter(p => p.estado === true && !p.fecha_impresion);
        } else if (filtroEstado.value === 'inactivo') {
            resultado = resultado.filter(p => p.estado === false);
        } else if (filtroEstado.value === 'procesado') {
            resultado = resultado.filter(p => !!p.fecha_impresion);
        }
    }

    // Filtro por fecha exacta (YYYY-MM-DD)
    if (filtroFecha.value) {
        const qDate = filtroFecha.value;
        resultado = resultado.filter(p => ((p.fecha || '').toString().split('T')[0] === qDate));
    }

    // Filtro por monto exacto
    if (filtroMonto.value) {
        const qNum = Number(filtroMonto.value);
        if (!isNaN(qNum)) {
            resultado = resultado.filter(p => Number(p.monto_total || 0) === qNum);
        }
    }

    // Ordenamiento
    if (sortBy.value) {
        resultado.sort((a: any, b: any) => {
            const aVal = (a[sortBy.value!] ?? '').toString();
            const bVal = (b[sortBy.value!] ?? '').toString();
            if (!isNaN(Number(aVal)) && !isNaN(Number(bVal))) {
                return sortDir.value === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
            }
            return sortDir.value === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }

    pagos.value = resultado;
};

const anularPago = async (pago: any) => {
    if (!confirm(`¿Está seguro de anular el pago ${pago.numero_pago}? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        await api.delete(`/v1/pagos/${pago.numero_pago}`);
        alert("Pago anulado correctamente.");
        obtenerPagos(); // Recargar la lista para que desaparezca
    } catch (e: any) {
        const mensaje = e.response?.data?.message || "Error al anular el pago.";
        alert(mensaje);
    }
};

const imprimirComprobante = async (numeroPago: string) => {
    // Pedimos confirmación al usuario antes de descargar/imprimir
    if (!confirm(`¿Esta seguro de imprimir el pago? Esta acción no se puede deshacer.`)) return;

    try {
        const response = await api.get(`/v1/pagos/${numeroPago}/pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Comprobante-${numeroPago}.pdf`);
        document.body.appendChild(link);
        link.click();
        obtenerPagos();
    } catch (e) {
        alert("Error al descargar el comprobante.");
    }
};

let timeout: number;
watch([
    filtroNumeroPago,
    filtroCedula,
    filtroCuenta,
    filtroEstado,
    filtroFecha,
    filtroMonto
], () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        aplicarFiltro();
    }, 300);
});

onMounted(() => {
    obtenerPagos();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="text-primary mb-1">Gestión de Pagos</h2>
                <p class="text-muted small mb-0">Registro y control de recaudación de clientes</p>
            </div>

            <button 
                    @click="router.push('/pagos/crear')" 
                    class="btn btn-primary shadow-sm">
                <i class="bi"></i>Nuevo Pago
            </button>
        </div>

        <div class="card shadow-sm border-0 mb-4 bg-light">
            <div class="card-body py-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-4">
                        <div class="small text-muted">Registros: <strong>{{ pagos.length }}</strong></div>
                    </div>
                    <div class="col-md-8 text-end">
                        <button @click="obtenerPagos" class="btn btn-outline-secondary btn-sm" title="Actualizar">
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
                            <th class="ps-3 text-center">Acciones</th>
                            <th @click="toggleSort('numero_pago')" class="ps-4" style="cursor:pointer">No. Pago <small v-if="sortBy==='numero_pago'">{{ sortDir==='asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('cedula_cliente')" style="cursor:pointer">Cliente <small v-if="sortBy==='cedula_cliente'">{{ sortDir==='asc' ? '▲' : '▼' }}</small></th>
                            <th class="text-center" @click="toggleSort('codigo_cuenta')" style="cursor:pointer">Cuenta Destino <small v-if="sortBy==='codigo_cuenta'">{{ sortDir==='asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('fecha')" style="cursor:pointer">Fecha <small v-if="sortBy==='fecha'">{{ sortDir==='asc' ? '▲' : '▼' }}</small></th>
                            <th class="text-end" @click="toggleSort('monto_total')" style="cursor:pointer">Monto Total <small v-if="sortBy==='monto_total'">{{ sortDir==='asc' ? '▲' : '▼' }}</small></th>
                            <th class="text-center">Estado</th>
                        </tr>
                        <!-- Filter row -->
                        <tr class="bg-white">
                            <th class="text-center">
                                <button @click="limpiarFiltros" class="btn btn-sm btn-outline-secondary" title="Limpiar filtros"><i class="bi bi-x-circle"></i></button>
                            </th>
                            <th><input v-model="filtroNumeroPago" class="form-control form-control-sm" placeholder="# Pago"></th>
                            <th><input v-model="filtroCedula" class="form-control form-control-sm" placeholder="Cédula"></th>
                            <th><input v-model="filtroCuenta" class="form-control form-control-sm" placeholder="Cuenta"></th>
                            <th>
                                <input type="date" v-model="filtroFecha" class="form-control form-control-sm">
                            </th>
                            <th class="text-end">
                                <input v-model="filtroMonto" class="form-control form-control-sm" placeholder="Monto exacto">
                            </th>
                            <th class="text-center">
                                <select v-model="filtroEstado" class="form-select form-select-sm">
                                    <option value="all">Todos</option>
                                    <option value="activo">Activo</option>
                                    <option value="procesado">Procesado</option>
                                    <option value="inactivo">Inactivo</option>
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="pago in pagos" :key="pago.numero_pago">
                            <td class="text-center">
                                <div class="btn-group">
                                    <button 
                                        v-if="!pago.fecha_impresion && pago.estado"
                                        @click="router.push(`/pagos/${pago.numero_pago}/editar`)"
                                        class="btn btn-sm btn-outline-primary"
                                        title="Editar">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    
                                    <button 
                                        @click="imprimirComprobante(pago.numero_pago)"
                                        class="btn btn-sm btn-outline-secondary"
                                        title="Imprimir Comprobante">
                                        <i class="bi bi-printer"></i>
                                    </button>

                                    <button 
                                        v-if="!pago.fecha_impresion && pago.estado" 
                                        @click="anularPago(pago)" 
                                        class="btn btn-sm btn-outline-danger" 
                                        title="Anular"
                                    >
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                            <td class="ps-4 fw-bold text-primary">{{ pago.numero_pago }}</td>
                            <td>
                                <div class="d-flex flex-column">
                                    <span class="fw-medium">{{ pago.cedula_cliente }}</span>
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
                                <span :class="`badge rounded-pill ${pago.fecha_impresion ? 'bg-success' : (pago.estado ? 'bg-warning text-dark' : 'bg-danger')}`">
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
    </div>
</template>