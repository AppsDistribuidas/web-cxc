<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import { useSweetAlert } from '@/composables/useSweetAlert';
import type { Cuenta } from '@/types/BankingTypes';
import type { PagoPayload, DetallePago } from '@/types/PaymentTypes';

const { showSuccess, showError, showWarning } = useSweetAlert();

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

const estadoPago = ref<boolean | null>(null);
const fechaImpresion = ref<string | null>(null);

// Cliente input helper
const cedulaInput = ref('');
const selectedClientName = ref('');

// Computed para filtrar la lista de clientes sugeridos
const filteredClientes = computed(() => {
    if (!cedulaInput.value) return clientesDisponibles.value.slice(0, 10);

    const busqueda = cedulaInput.value.toLowerCase();
    return clientesDisponibles.value.filter(c =>
        c.cedula.includes(busqueda) ||
        (c.nombre || '').toLowerCase().includes(busqueda)
    ).slice(0, 10); // Limitar a 10 resultados irrelevantes para no saturar el DOM
});

const seleccionarClientePorCedula = async () => {
    const v = (cedulaInput.value || '').toString().trim();
    if (!v) {
        form.value.cedula_cliente = '';
        selectedClientName.value = '';
        facturasDisponibles.value = [];
        return;
    }

    // Buscar exact match por cédula
    const found = clientesDisponibles.value.find(c => c.cedula === v);
    if (found) {
        form.value.cedula_cliente = found.cedula;
        selectedClientName.value = found.nombre;
        await cargarFacturasCliente();
        return;
    }

    // Buscar por coincidencia parcial en nombre
    const byName = clientesDisponibles.value.find(c => (c.nombre || '').toLowerCase().includes(v.toLowerCase()));
    if (byName) {
        form.value.cedula_cliente = byName.cedula;
        cedulaInput.value = byName.cedula;
        selectedClientName.value = byName.nombre;
        await cargarFacturasCliente();
        return;
    }

    // No encontrado: mantener valor y limpiar facturas
    selectedClientName.value = '';
    facturasDisponibles.value = [];
};

// BANDERA PARA CONTROLAR LA EDICIÓN
const cargandoDatos = ref(false);

// Datos cargados desde Backend
const facturasDisponibles = ref<any[]>([]);
const clientesDisponibles = ref<any[]>([]);

const nuevoDetalle = ref<DetallePago>({
    numero_factura: '',
    monto_pagar: 0
});

// Helpers: mostrar con guiones para UX, almacenar/enviar sin guiones
const unformatNumeroFactura = (s: string | null | undefined) => (s ?? '').toString().replace(/\D/g, '');
const formatNumeroFactura = (s: string | null | undefined) => {
    const raw = unformatNumeroFactura(s);
    if (!raw) return '';
    if (raw.length <= 3) return raw;
    if (raw.length <= 6) return raw.slice(0, 3) + '-' + raw.slice(3);
    return raw.slice(0, 3) + '-' + raw.slice(3, 6) + '-' + raw.slice(6);
};

// --- LÓGICA DE DETALLES ---

// Computed: Facturas disponibles que NO están ya en el detalle
const facturasParaSeleccionar = computed(() => {
    const facturasEnDetalle = new Set(
        form.value.detalles.map(d => unformatNumeroFactura(d.numero_factura))
    );
    return facturasDisponibles.value.filter(
        f => !facturasEnDetalle.has(unformatNumeroFactura(f.numero_factura))
    );
});

const facturaSeleccionada = computed(() => {
    return facturasDisponibles.value.find(f => unformatNumeroFactura(f.numero_factura) === unformatNumeroFactura(nuevoDetalle.value.numero_factura));
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

    // Sincronizar el input libre con el valor efectivo
    cedulaInput.value = form.value.cedula_cliente || '';

    cargarFacturasCliente();
    nuevoDetalle.value = { numero_factura: '', monto_pagar: 0 };
    form.value.detalles = [];
});

// Mantener input sincronizado cuando la lista de clientes cambie (por ejemplo al inicializar)
watch(clientesDisponibles, () => {
    if (form.value.cedula_cliente) {
        const found = clientesDisponibles.value.find(c => c.cedula === form.value.cedula_cliente);
        selectedClientName.value = found ? found.nombre : '';
    }
});

const alSeleccionarFactura = () => {
    if (facturaSeleccionada.value) {
        nuevoDetalle.value.monto_pagar = maximoPagable.value;
    }
};

const getFacturaInfo = (numeroFactura: string) => {
    // Busca en las facturas disponibles comparando solo dígitos (sin guiones)
    const raw = unformatNumeroFactura(numeroFactura);
    return facturasDisponibles.value.find(f => unformatNumeroFactura(f.numero_factura) === raw);
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

            estadoPago.value = !!data.estado; // Guardamos estado (booleano)
            fechaImpresion.value = data.fecha_impresion ?? null;

            // VALIDACIÓN CRÍTICA: Solo permitir editar si está activo y no procesado
            if (fechaImpresion.value || !data.estado) {
                const mensaje = fechaImpresion.value ? 'El pago ya fue procesado y no se puede editar.' : 'El pago está inactivo y no se puede editar.';
                await showWarning(mensaje);
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
                detalles: (data.detalles || []).map((d: any) => {
                    const montoFromBackend = d.monto_pagado ?? d.monto_pagar ?? d.monto ?? 0;
                    return {
                        // Guardamos internamente solo los dígitos
                        numero_factura: unformatNumeroFactura(d.numero_factura),
                        monto_pagar: Number(montoFromBackend) || 0,
                        // Guardamos saldo_anterior del backend para mostrarlo en la UI
                        saldo_anterior: d.saldo_anterior != null ? Number(d.saldo_anterior) : undefined,
                        saldo_nuevo: d.saldo_nuevo != null ? Number(d.saldo_nuevo) : undefined
                    };
                })
            };

            // Rellenamos el input visual de cédula con el mismo formato que en crear (Nombre (Cédula))
            cedulaInput.value = data.nombre_cliente ? `${data.cedula_cliente}` : data.cedula_cliente;
            selectedClientName.value = data.nombre_cliente ?? '';

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

const agregarDetalle = async () => {
    if (!nuevoDetalle.value.numero_factura || nuevoDetalle.value.monto_pagar <= 0) {
        await showWarning("Ingrese un número de factura y un monto válido.");
        return;
    }

    // Validamos en base a los dígitos reales (sin guiones)
    const raw = unformatNumeroFactura(nuevoDetalle.value.numero_factura);
    if (raw.length !== 15) {
        await showWarning("El número de factura debe tener exactamente 15 dígitos.");
        return;
    }

    if (facturaSeleccionada.value && nuevoDetalle.value.monto_pagar > maximoPagable.value) {
        await showWarning(`El monto no puede ser mayor al saldo pendiente ($ ${maximoPagable.value.toFixed(2)})`);
        return;
    }

    const existe = form.value.detalles.some(d => unformatNumeroFactura(d.numero_factura) === raw);
    if (existe) {
        await showWarning("Esta factura ya está agregada en la lista.");
        return;
    }

    // Guardamos internamente solo los dígitos (sin guiones)
    form.value.detalles.push({ numero_factura: raw, monto_pagar: nuevoDetalle.value.monto_pagar });

    // La factura desaparece del dropdown automáticamente gracias al computed facturasParaSeleccionar
    nuevoDetalle.value = { numero_factura: '', monto_pagar: 0 };
};

const eliminarDetalle = (index: number) => {
    // La factura reaparece automáticamente en el dropdown gracias al computed facturasParaSeleccionar
    form.value.detalles.splice(index, 1);
};

const totalPago = computed(() => {
    return form.value.detalles.reduce((acc, item) => acc + (Number(item.monto_pagar) || 0), 0);
});

const guardar = async () => {
    if (form.value.detalles.length === 0) {
        await showWarning("Debe agregar al menos un detalle de pago.");
        return;
    }

    saving.value = true;
    error.value = null;

    try {
        // Preparamos payload: asegurar que numero_factura sea solo dígitos (15)
        const payload = {
            ...form.value,
            detalles: form.value.detalles.map(d => ({ ...d, numero_factura: unformatNumeroFactura(d.numero_factura) }))
        };

        if (isEditing.value) {
            await api.put(`/v1/pagos/${route.params.numero_pago}`, payload);
            await showSuccess("Pago actualizado correctamente.");
        } else {
            await api.post('/v1/pagos', payload);
            await showSuccess("Pago registrado correctamente.");
        }
        router.push('/pagos');
    } catch (e: any) {
        if (e.response?.status === 422) {
            error.value = e.response.data.message || JSON.stringify(e.response.data.errors);
        } else if (e.response?.status === 404) {
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
                    <div
                        class="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 class="mb-0 fw-normal">
                            {{ isEditing ? 'Editar Pago' : 'Registrar Nuevo Pago' }}
                        </h4>
                        <div v-if="isEditing">
                            <span class="badge bg-white text-primary me-2">{{ route.params.numero_pago }}</span>
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
                                    <!-- Input libre para poder escribir la cédula y autoseleccionar -->
                                    <input v-model="cedulaInput" @keyup.enter="seleccionarClientePorCedula"
                                        @blur="seleccionarClientePorCedula" list="clientesList" type="text"
                                        class="form-control"
                                        :placeholder="isEditing ? '' : 'Ingrese cédula o seleccione...'"
                                        :disabled="isEditing" required />

                                    <datalist id="clientesList">
                                        <option v-for="cli in filteredClientes" :key="cli.cedula" :value="cli.cedula">
                                            {{ cli.nombre }}
                                        </option>
                                    </datalist>

                                    <div v-if="selectedClientName" class="form-text text-muted mt-1">Nombre cliente:
                                        <strong>{{ selectedClientName }}</strong>
                                    </div>
                                </div>

                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Fecha Pago</label>
                                    <input v-model="form.fecha" type="date" class="form-control" required>
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
                                    <input v-model="form.descripcion" type="text" class="form-control"
                                        placeholder="Opcional">
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
                                                <select v-model="nuevoDetalle.numero_factura"
                                                    class="form-select form-select-sm" @change="alSeleccionarFactura">
                                                    <option value="" disabled>Seleccione factura...</option>
                                                    <option v-for="factura in facturasParaSeleccionar"
                                                        :key="factura.numero_factura"
                                                        :value="unformatNumeroFactura(factura.numero_factura)">
                                                        {{ formatNumeroFactura(factura.numero_factura) }}
                                                    </option>
                                                </select>
                                                <div v-if="form.cedula_cliente && facturasParaSeleccionar.length === 0 && facturasDisponibles.length === 0"
                                                    class="form-text text-warning mt-1">
                                                    <i class="bi bi-exclamation-triangle me-1"></i>
                                                    Este cliente no tiene facturas a crédito pendientes.
                                                </div>
                                                <div v-if="facturaSeleccionada" class="form-text mt-1 text-primary">
                                                    <small>Deuda: <strong>$ {{
                                                        Number(facturaSeleccionada.total).toFixed(2)
                                                            }}</strong></small>
                                                </div>
                                            </div>

                                            <div class="col-md-4">
                                                <label class="small text-muted fw-bold">Monto a Pagar ($)</label>
                                                <div class="input-group input-group-sm">
                                                    <input v-model.number="nuevoDetalle.monto_pagar" type="number"
                                                        step="0.01" min="0.0" :max="maximoPagable" class="form-control"
                                                        @keyup.enter="agregarDetalle">
                                                </div>
                                                <div v-if="facturaSeleccionada" class="form-text mt-1"
                                                    :class="{ 'text-danger': nuevoDetalle.monto_pagar > maximoPagable }">
                                                    <small>Saldo Pendiente: <strong>$ {{ maximoPagable.toFixed(2)
                                                    }}</strong></small>
                                                </div>
                                            </div>

                                            <div class="col-md-3">
                                                <label class="small text-muted fw-bold d-block">&nbsp;</label>
                                                <div class="d-grid">
                                                    <button type="button" @click="agregarDetalle"
                                                        class="btn btn-secondary btn-sm"><i class="bi bi-plus-lg"></i>
                                                        Agregar</button>
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
                                                <td class="ps-3 align-middle">{{
                                                    formatNumeroFactura(item.numero_factura) }}</td>

                                                <td class="text-end align-middle text-muted">
                                                    <span v-if="getFacturaInfo(item.numero_factura)">
                                                        $ {{
                                                            Number(getFacturaInfo(item.numero_factura).saldo_pendiente).toFixed(2)
                                                        }}
                                                    </span>
                                                    <span v-else-if="item.saldo_anterior != null">
                                                        $ {{ Number(item.saldo_anterior).toFixed(2) }}
                                                    </span>
                                                    <span v-else class="small text-muted">N/A</span>
                                                </td>

                                                <td class="text-end align-middle fw-bold text-success">
                                                    $ {{ item.monto_pagar.toFixed(2) }}
                                                </td>

                                                <td class="text-end align-middle fw-bold table-warning">
                                                    <span v-if="getFacturaInfo(item.numero_factura)">
                                                        $ {{
                                                            (Number(getFacturaInfo(item.numero_factura).saldo_pendiente) -
                                                                item.monto_pagar).toFixed(2) }}
                                                    </span>
                                                    <span v-else-if="item.saldo_nuevo != null">
                                                        $ {{ Number(item.saldo_nuevo).toFixed(2) }}
                                                    </span>
                                                    <span v-else-if="item.saldo_anterior != null">
                                                        $ {{ (Number(item.saldo_anterior) - item.monto_pagar).toFixed(2)
                                                        }}
                                                    </span>
                                                    <span v-else>-</span>
                                                </td>

                                                <td class="text-center">
                                                    <button type="button" @click="eliminarDetalle(index)"
                                                        class="btn btn-link text-danger p-0"><i
                                                            class="bi bi-trash"></i></button>
                                                </td>
                                            </tr>
                                            <tr v-if="form.detalles.length === 0">
                                                <td colspan="5" class="text-center text-muted py-3">Agregue las facturas
                                                    que cancela el cliente.</td>
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

                            <div v-if="error" class="alert alert-danger mt-3"><i
                                    class="bi bi-exclamation-circle me-1"></i> {{ error }}</div>

                            <div class="d-flex justify-content-end gap-2 mt-4">
                                <button type="button" @click="router.push('/pagos')"
                                    class="btn btn-outline-secondary">Cancelar</button>
                                <button type="submit" class="btn btn-success px-4"
                                    :disabled="saving || form.detalles.length === 0">
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