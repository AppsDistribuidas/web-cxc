<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import type { Cuenta } from '@/types/BankingTypes';
import type { PagoPayload, DetallePago } from '@/types/PaymentTypes';

const router = useRouter();
const route = useRoute();
const isEditing = computed(() => !!route.params.numero_pago);

// Estado del Formulario
const form = ref<PagoPayload>({
    cedula_cliente: '',
    codigo_cuenta: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0] ?? '',
    detalles: []
});

// Estado UI
const cuentas = ref<Cuenta[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

// Variable para mostrar el estado actual al editar
const estadoPago = ref<string>('');

// BANDERA PARA CONTROLAR LA EDICIÓN
const cargandoDatos = ref(false); 

// Datos cargados desde Backend
const facturasDisponibles = ref<any[]>([]);
const clientesDisponibles = ref<any[]>([]);

const nuevoDetalle = ref<DetallePago>({
    numero_factura: '',
    monto_pagar: 0
});

// --- LÓGICA DE DETALLES ---
const facturaSeleccionada = computed(() => {
    return facturasDisponibles.value.find(f => f.numero_factura === nuevoDetalle.value.numero_factura);
});

const maximoPagable = computed(() => {
    return facturaSeleccionada.value ? Number(facturaSeleccionada.value.saldo_pendiente) : 0;
});

// --- CARGAS DE DATOS ---
const cargarClientes = async () => {
    try {
        const resp = await api.get('/v1/pagos/clientes');
        clientesDisponibles.value = resp.data.data;
    } catch (e) {
        console.error("Error al cargar clientes", e);
    }
};

const cargarFacturasCliente = async () => {
    const cedula = form.value.cedula_cliente;
    facturasDisponibles.value = [];
    
    if (!cedula) return;

    try {
        const resp = await api.get(`/v1/pagos/facturas-pendientes?cedula=${cedula}`);
        facturasDisponibles.value = resp.data.data;
    } catch (e) {
        console.error("Error cargando facturas", e);
    }
};

// Observador: Reinicia detalles si cambia el cliente (pero respeta la carga inicial)
watch(() => form.value.cedula_cliente, () => {
    // Si estamos cargando datos de edición, NO borramos los detalles ni recargamos innecesariamente
    if (cargandoDatos.value) return;

    cargarFacturasCliente();
    nuevoDetalle.value = { numero_factura: '', monto_pagar: 0 };
    form.value.detalles = []; 
});

const alSeleccionarFactura = () => {
    if (facturaSeleccionada.value) {
        nuevoDetalle.value.monto_pagar = maximoPagable.value;
    }
};

const getFacturaInfo = (numeroFactura: string) => {
    // Busca en las facturas disponibles (Mock)
    return facturasDisponibles.value.find(f => f.numero_factura === numeroFactura);
};

onMounted(async () => {
    loading.value = true;
    try {
        await Promise.all([
            cargarClientes(),
            api.get('/v1/cuentas-bancarias').then(r => cuentas.value = r.data.data.filter((c: Cuenta) => c.estado))
        ]);

        if (isEditing.value) {
            // ACTIVAMOS LA BANDERA
            cargandoDatos.value = true; 

            const respPago = await api.get(`/v1/pagos/${route.params.numero_pago}`);
            const data = respPago.data.data;
            
            estadoPago.value = data.estado; // Guardamos estado para mostrar badge

            // VALIDACIÓN CRÍTICA: Solo permitir editar si está en BORRADOR
            if (data.estado !== 'BORRADOR') {
                alert(`El pago está en estado ${data.estado} y no se puede editar.`);
                router.push('/pagos');
                return;
            }
            
            let fechaLimpia = data.fecha;
            if (fechaLimpia) {
                fechaLimpia = fechaLimpia.split('T')[0].split(' ')[0];
            }

            // Llenamos el formulario (esto dispara el watch, pero la bandera lo frena)
            form.value = {
                cedula_cliente: data.cedula_cliente,
                codigo_cuenta: data.codigo_cuenta,
                descripcion: data.descripcion,
                fecha: fechaLimpia,
                detalles: data.detalles.map((d: any) => ({
                    numero_factura: d.numero_factura,
                    // Nota: Backend devuelve 'monto_pagado' en GET, pero el form usa 'monto_pagar'
                    monto_pagar: Number(d.monto_pagado) 
                }))
            };
            
            // Cargamos facturas manualmente porque el watch fue bloqueado
            if (form.value.cedula_cliente) {
                await cargarFacturasCliente();
            }

            // DESACTIVAMOS LA BANDERA (ya terminó la carga inicial)
            cargandoDatos.value = false;
        }
    } catch (e: any) {
        error.value = "Error al cargar datos iniciales.";
        if (e.response?.status === 404) router.push('/pagos');
    } finally {
        loading.value = false;
    }
});

const agregarDetalle = () => {
    if (!nuevoDetalle.value.numero_factura || nuevoDetalle.value.monto_pagar <= 0) {
        alert("Ingrese un número de factura y un monto válido.");
        return;
    }

    if (facturaSeleccionada.value && nuevoDetalle.value.monto_pagar > maximoPagable.value) {
        alert(`El monto no puede ser mayor al saldo pendiente ($ ${maximoPagable.value.toFixed(2)})`);
        return;
    }

    const existe = form.value.detalles.some(d => d.numero_factura === nuevoDetalle.value.numero_factura);
    if (existe) {
        alert("Esta factura ya está agregada en la lista.");
        return;
    }

    form.value.detalles.push({ ...nuevoDetalle.value });
    nuevoDetalle.value = { numero_factura: '', monto_pagar: 0 };
};

const eliminarDetalle = (index: number) => {
    form.value.detalles.splice(index, 1);
};

const totalPago = computed(() => {
    return form.value.detalles.reduce((acc, item) => acc + item.monto_pagar, 0);
});

const guardar = async () => {
    if (form.value.detalles.length === 0) {
        alert("Debe agregar al menos un detalle de pago.");
        return;
    }

    saving.value = true;
    error.value = null;

    try {
        if (isEditing.value) {
            await api.put(`/v1/pagos/${route.params.numero_pago}`, form.value);
            alert("Pago actualizado correctamente.");
        } else {
            await api.post('/v1/pagos', form.value);
            alert("Pago registrado correctamente.");
        }
        router.push('/pagos');
    } catch (e: any) {
        if (e.response?.status === 422) {
            error.value = e.response.data.message || JSON.stringify(e.response.data.errors);
        } else if(e.response?.status === 404) {
             error.value = e.response.data.message;
        } else {
            error.value = e.response?.data?.message || "Error al guardar el pago.";
        }
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="container mt-4 mb-5">
        <div class="row justify-content-center">
            <div class="col-lg-10">
                <div class="card shadow border-0">
                    <div class="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 class="mb-0 fw-normal">
                            {{ isEditing ? 'Editar Pago' : 'Registrar Nuevo Pago' }}
                        </h4>
                        <div v-if="isEditing">
                             <span class="badge bg-white text-primary me-2">{{ route.params.numero_pago }}</span>
                             <span v-if="estadoPago === 'BORRADOR'" class="badge bg-warning text-dark">BORRADOR</span>
                        </div>
                    </div>

                    <div class="card-body p-4">
                        <div v-if="loading" class="text-center py-4">
                            <span class="spinner-border text-primary"></span>
                        </div>

                        <form v-else @submit.prevent="guardar">
                            <div class="row g-3 mb-4">
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Cliente</label>
                                    <select v-model="form.cedula_cliente" class="form-select" required :disabled="isEditing">
                                        <option value="" disabled>Seleccione un cliente...</option>
                                        <option v-for="cli in clientesDisponibles" :key="cli.cedula" :value="cli.cedula">
                                            {{ cli.nombre }} ({{ cli.cedula }})
                                        </option>
                                    </select>
                                </div>

                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Fecha Pago</label>
                                    <input 
                                        v-model="form.fecha" 
                                        type="date" 
                                        class="form-control" 
                                        required
                                    >
                                </div>

                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Cuenta Bancaria</label>
                                    <select v-model="form.codigo_cuenta" class="form-select" required>
                                        <option value="" disabled>Seleccione cuenta...</option>
                                        <option v-for="cta in cuentas" :key="cta.codigo" :value="cta.codigo">
                                            {{ cta.codigo }} ({{ cta.entidad_bancaria?.nombre }})
                                        </option>
                                    </select>
                                </div>

                                <div class="col-12">
                                    <label class="form-label">Descripción / Notas</label>
                                    <input v-model="form.descripcion" type="text" class="form-control" placeholder="Opcional">
                                </div>
                            </div>

                            <hr class="my-4 text-muted">

                            <div class="mb-3">
                                <h5 class="text-secondary mb-3">Detalle de Facturas a Pagar</h5>
                                <div class="card bg-light border-0 mb-3">
                                    <div class="card-body p-3">
                                        <div class="row g-2 align-items-start">
                                            <div class="col-md-5">
                                                <label class="small text-muted fw-bold">No. Factura</label>
                                                <select 
                                                    v-model="nuevoDetalle.numero_factura" 
                                                    class="form-select form-select-sm" 
                                                    @change="alSeleccionarFactura"
                                                >
                                                    <option value="" disabled>Seleccione factura...</option>
                                                    <option 
                                                        v-for="factura in facturasDisponibles" 
                                                        :key="factura.numero_factura" 
                                                        :value="factura.numero_factura"
                                                    >
                                                        {{ factura.numero_factura }}
                                                    </option>
                                                </select>
                                                <div v-if="facturaSeleccionada" class="form-text mt-1 text-primary">
                                                    <small>Deuda: <strong>$ {{ Number(facturaSeleccionada.total).toFixed(2) }}</strong></small>
                                                </div> 
                                            </div>
                                            
                                            <div class="col-md-4">
                                                <label class="small text-muted fw-bold">Monto a Pagar ($)</label>
                                                <div class="input-group input-group-sm">
                                                    <input 
                                                        v-model.number="nuevoDetalle.monto_pagar" 
                                                        type="number" 
                                                        step="0.01" 
                                                        min="0.0" 
                                                        :max="maximoPagable"
                                                        class="form-control" 
                                                        @keyup.enter="agregarDetalle"
                                                    >
                                                </div>
                                                <div v-if="facturaSeleccionada" class="form-text mt-1" :class="{'text-danger': nuevoDetalle.monto_pagar > maximoPagable}">
                                                    <small>Saldo Pendiente: <strong>$ {{ maximoPagable.toFixed(2) }}</strong></small>
                                                </div>
                                            </div>

                                            <div class="col-md-3">
                                                <label class="small text-muted fw-bold d-block">&nbsp;</label>
                                                <div class="d-grid">
                                                    <button type="button" @click="agregarDetalle" class="btn btn-secondary btn-sm"><i class="bi bi-plus-lg"></i> Agregar</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="table-responsive border rounded">
                                    <table class="table table-sm table-striped mb-0">
                                        <thead class="table-dark">
                                            <tr>
                                                <th class="ps-3">Factura</th>
                                                <th class="text-end">Saldo Pendiente</th>
                                                <th class="text-end">Abono</th>
                                                <th class="text-end">Saldo Restante</th>
                                                <th class="text-center" style="width: 50px;"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(item, index) in form.detalles" :key="index">
                                                <td class="ps-3 align-middle">{{ item.numero_factura }}</td>
                                                
                                                <td class="text-end align-middle text-muted">
                                                    <span v-if="getFacturaInfo(item.numero_factura)">
                                                        $ {{ Number(getFacturaInfo(item.numero_factura).saldo_pendiente).toFixed(2) }}
                                                    </span>
                                                    <span v-else class="small text-muted">N/A</span>
                                                </td>

                                                <td class="text-end align-middle fw-bold text-success">
                                                    $ {{ item.monto_pagar.toFixed(2) }}
                                                </td>

                                                <td class="text-end align-middle fw-bold table-warning">
                                                    <span v-if="getFacturaInfo(item.numero_factura)">
                                                        $ {{ (Number(getFacturaInfo(item.numero_factura).saldo_pendiente) - item.monto_pagar).toFixed(2) }}
                                                    </span>
                                                    <span v-else>-</span>
                                                </td>

                                                <td class="text-center">
                                                    <button type="button" @click="eliminarDetalle(index)" class="btn btn-link text-danger p-0"><i class="bi bi-trash"></i></button>
                                                </td>
                                            </tr>
                                            <tr v-if="form.detalles.length === 0">
                                                <td colspan="5" class="text-center text-muted py-3">Agregue las facturas que cancela el cliente.</td>
                                            </tr>
                                        </tbody>
                                        <tfoot v-if="form.detalles.length > 0">
                                            <tr class="table-primary">
                                                <td colspan="2" class="text-end fw-bold">TOTAL PAGO:</td>
                                                <td class="text-end fw-bold fs-5">$ {{ totalPago.toFixed(2) }}</td>
                                                <td colspan="2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div v-if="error" class="alert alert-danger mt-3"><i class="bi bi-exclamation-circle me-1"></i> {{ error }}</div>

                            <div class="d-flex justify-content-end gap-2 mt-4">
                                <button type="button" @click="router.push('/pagos')" class="btn btn-outline-secondary">Cancelar</button>
                                <button type="submit" class="btn btn-success px-4" :disabled="saving || form.detalles.length === 0">
                                    <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                                    {{ isEditing ? 'Actualizar Pago' : 'Finalizar Pago' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>