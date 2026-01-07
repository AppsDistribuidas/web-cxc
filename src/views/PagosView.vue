<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import type { Pago } from '@/types/PaymentTypes';

const router = useRouter();
const { can } = useAuth();

const pagos = ref<Pago[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const filtroCedula = ref('');

const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'N/A';
    
    try {
        // 1. Limpiamos la fecha por si viene con hora o formato ISO
        // Nos quedamos solo con la parte YYYY-MM-DD
        const soloFecha = fechaString.split('T')[0].split(' ')[0];
        
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
        const params: any = {};
        if (filtroCedula.value) params.cedula_cliente = filtroCedula.value;

        const response = await api.get('/v1/pagos', { params });
        pagos.value = response.data.data;
    } catch (e: any) {
        error.value = "Error al cargar los pagos. Intente nuevamente.";
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const imprimirComprobante = async (numeroPago: string) => {
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
watch(filtroCedula, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        obtenerPagos();
    }, 500);
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

            <button v-if="can('Gestión de Pagos')" 
                    @click="router.push('/pagos/crear')" 
                    class="btn btn-primary shadow-sm">
                <i class="bi"></i>Nuevo Pago
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
                                v-model="filtroCedula"
                                type="text" 
                                class="form-control border-start-0" 
                                placeholder="Buscar por Cédula de Cliente..."
                            >
                        </div>
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
                            <th class="ps-4">No. Pago</th>
                            <th>Cliente</th>
                            <th>Cuenta Destino</th>
                            <th>Fecha</th>
                            <th class="text-end">Monto Total</th>
                            <th class="text-center">Estado</th>
                            <th class="text-end pe-4">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="pago in pagos" :key="pago.numero_pago">
                            <td class="ps-4 fw-bold text-primary">{{ pago.numero_pago }}</td>
                            <td>
                                <div class="d-flex flex-column">
                                    <span class="fw-medium">{{ pago.cedula_cliente }}</span>
                                </div>
                            </td>
                            <td>
                                <span class="badge bg-light text-dark border">
                                    {{ pago.cuenta_bancaria?.nombre_cuenta || pago.codigo_cuenta }}
                                </span>
                            </td>
                            
                            <td>{{ formatearFecha(pago.fecha) }}</td>

                            <td class="text-end fw-bold">
                                ${{ Number(pago.detalles_sum_monto_pagado || 0).toFixed(2) }}
                            </td>
                            <td class="text-center">
                                <span :class="`badge rounded-pill ${pago.fecha_impresion ? 'bg-success' : 'bg-warning text-dark'}`">
                                    {{ pago.fecha_impresion ? 'Procesado' : 'Borrador' }}
                                </span>
                            </td>
                            <td class="text-end pe-4">
                                <div class="btn-group">
                                    <button 
                                        v-if="!pago.fecha_impresion && can('Gestión de Pagos')"
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
                                </div>
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