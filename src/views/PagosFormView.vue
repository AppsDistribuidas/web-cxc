<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import { useSweetAlert } from '@/composables/useSweetAlert';
import type { Cuenta } from '@/types/BankingTypes';
import type { PagoPayload, DetallePago } from '@/types/PaymentTypes';
import ClienteAutocomplete from '@/components/ClienteAutocomplete.vue';
import CuentaAutocomplete from '@/components/CuentaAutocomplete.vue';

const { showSuccess, showError, showWarning } = useSweetAlert();

const router = useRouter();
const route = useRoute();
const isEditing = computed(() => !!route.params.numero_pago);

// Estado del Formulario
const form = ref<PagoPayload>({
    cedula_cliente: '',
    codigo_cuenta: '',
    descripcion: '',
    detalles: [],
    fecha: new Date().toISOString().slice(0, 10)
});

// Fecha actual obtenida desde el navegador para mostrar
const fechaActual = ref<string>('');

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

// Helper states limpios
// Variables limpias
// (cedulaInput y selectedClientName se mantienen arriba)

// Handler para CuentaAutocomplete
const onCuentaSelect = (cuenta: Cuenta | null) => {
    // V-model ya actualiza el código
    // Aquí podemos añadir lógica adicional si se requiere en el futuro
};

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

// Handler para ClienteAutocomplete
const onClienteSelect = async (cliente: { cedula: string; nombre: string } | null) => {
    if (cliente) {
        selectedClientName.value = cliente.nombre;
        await cargarFacturasCliente();
    } else {
        selectedClientName.value = '';
        facturasDisponibles.value = [];
    }
};

// BANDERA PARA CONTROLAR LA EDICIÓN
const cargandoDatos = ref(false);

// Datos cargados desde Backend
const facturasDisponibles = ref<any[]>([]);
const clientesDisponibles = ref<any[]>([]);

// Estado para loading de facturas y búsqueda
const cargandoFacturas = ref(false);
const busquedaFactura = ref('');

// Facturas filtradas por búsqueda
const facturasFiltradas = computed(() => {
    if (!busquedaFactura.value.trim()) return facturasDisponibles.value;

    const busq = busquedaFactura.value.toLowerCase();
    return facturasDisponibles.value.filter(f =>
        formatNumeroFactura(f.numero_factura).toLowerCase().includes(busq) ||
        String(f.total).includes(busq) ||
        String(f.saldo_pendiente).includes(busq)
    );
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

// --- LÓGICA DE SELECCIÓN CON CHECKBOXES ---

// Estado para manejar selección de facturas y montos
const facturasConSeleccion = ref<Map<string, { selected: boolean; monto: number }>>(new Map());

// Inicializar/actualizar el mapa cuando cambian las facturas disponibles
watch(facturasDisponibles, (nuevas) => {
    const nuevoMapa = new Map<string, { selected: boolean; monto: number }>();
    nuevas.forEach(f => {
        const key = unformatNumeroFactura(f.numero_factura);
        // Mantener estado previo si existe
        const previo = facturasConSeleccion.value.get(key);
        nuevoMapa.set(key, {
            selected: previo?.selected ?? false,
            monto: previo?.monto ?? Number(f.saldo_pendiente)
        });
    });
    facturasConSeleccion.value = nuevoMapa;
}, { immediate: true });

// Toggle selección de una factura
const toggleFactura = (numeroFactura: string) => {
    const key = unformatNumeroFactura(numeroFactura);
    const item = facturasConSeleccion.value.get(key);
    if (item) {
        item.selected = !item.selected;
        // Si se selecciona, poner el saldo pendiente como monto por defecto
        if (item.selected) {
            const factura = facturasDisponibles.value.find(f => unformatNumeroFactura(f.numero_factura) === key);
            if (factura) item.monto = Number(factura.saldo_pendiente);
        }
    }
};

// Seleccionar/Deseleccionar todas
const todasSeleccionadas = computed(() => {
    if (facturasDisponibles.value.length === 0) return false;
    return facturasDisponibles.value.every(f =>
        facturasConSeleccion.value.get(unformatNumeroFactura(f.numero_factura))?.selected
    );
});

const toggleTodas = () => {
    const nuevoEstado = !todasSeleccionadas.value;
    facturasDisponibles.value.forEach(f => {
        const key = unformatNumeroFactura(f.numero_factura);
        const item = facturasConSeleccion.value.get(key);
        if (item) {
            item.selected = nuevoEstado;
            if (nuevoEstado) item.monto = Number(f.saldo_pendiente);
        }
    });
};

// Actualizar monto de una factura
const actualizarMonto = (numeroFactura: string, monto: number) => {
    const key = unformatNumeroFactura(numeroFactura);
    const item = facturasConSeleccion.value.get(key);
    if (item) item.monto = monto;
};

// Obtener saldo restante de una factura
const getSaldoRestante = (factura: any) => {
    const key = unformatNumeroFactura(factura.numero_factura);
    const item = facturasConSeleccion.value.get(key);
    const monto = item?.monto ?? 0;
    return Number(factura.saldo_pendiente) - monto;
};

// Pagar total de una factura (setear monto al saldo pendiente)
const pagarTotalFactura = (factura: any) => {
    const key = unformatNumeroFactura(factura.numero_factura);
    const item = facturasConSeleccion.value.get(key);
    if (item) {
        item.monto = Number(factura.saldo_pendiente);
    }
};

// Verificar si el monto excede el saldo
const montoExcedeSaldo = (factura: any) => {
    const key = unformatNumeroFactura(factura.numero_factura);
    const item = facturasConSeleccion.value.get(key);
    return (item?.monto ?? 0) > Number(factura.saldo_pendiente);
};

// Cantidad de facturas seleccionadas
const cantidadSeleccionadas = computed(() => {
    let count = 0;
    facturasConSeleccion.value.forEach(v => { if (v.selected) count++; });
    return count;
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

const cargarFacturasCliente = async (excluirPagoId?: string | number) => {
    const cedula = form.value.cedula_cliente;
    facturasDisponibles.value = [];
    busquedaFactura.value = '';

    if (!cedula) return;

    cargandoFacturas.value = true;
    try {
        let url = `/v1/pagos/facturas-pendientes?cedula=${cedula}`;
        // Si estamos editando, excluir el pago actual del cálculo de saldo
        if (excluirPagoId) {
            url += `&excluir_pago=${excluirPagoId}`;
        }
        const resp = await api.get(url);
        facturasDisponibles.value = resp.data.data;
    } catch (e) {
        console.error("Error cargando facturas", e);
    } finally {
        cargandoFacturas.value = false;
    }
};

// Observador: Reinicia detalles si cambia el cliente (pero respeta la carga inicial)
watch(() => form.value.cedula_cliente, () => {
    // Si estamos cargando datos de edición, NO borramos los detalles ni recargamos innecesariamente
    if (cargandoDatos.value) return;

    // Sincronizar el input libre con el valor efectivo
    cedulaInput.value = form.value.cedula_cliente || '';

    cargarFacturasCliente();
    // Limpiar selecciones previas
    facturasConSeleccion.value.clear();
    form.value.detalles = [];
});

// Mantener input sincronizado cuando la lista de clientes cambie (por ejemplo al inicializar)
watch(clientesDisponibles, () => {
    if (form.value.cedula_cliente) {
        const found = clientesDisponibles.value.find(c => c.cedula === form.value.cedula_cliente);
        selectedClientName.value = found ? found.nombre : '';
    }
});



onMounted(async () => {
    loading.value = true;
    try {
        // Establecer fecha actual para mostrar
        fechaActual.value = new Date().toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await Promise.all([
            cargarClientes(),
            api.get('/v1/cuentas-bancarias?all=true').then(r => cuentas.value = r.data.data.filter((c: Cuenta) => c.estado))
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

            // Rellenamos el input visual de cuenta bancaria
            // La cuenta bancaria se vincula automáticamente vía v-model form.codigo_cuenta
            // No necesitamos setear cuentaInput manualmente porque el componente lee de form.codigo_cuenta

            // Cargamos facturas manualmente porque el watch fue bloqueado
            // Pasamos el numero_pago para excluir este pago del cálculo de saldo
            if (form.value.cedula_cliente) {
                await cargarFacturasCliente(route.params.numero_pago as string);

                // En modo edición: agregar facturas del pago actual que no vinieron del API
                // (porque el backend las filtró como "ya pagadas" en este mismo pago)
                form.value.detalles.forEach((det: any) => {
                    const key = unformatNumeroFactura(det.numero_factura);
                    const yaExiste = facturasDisponibles.value.some(
                        f => unformatNumeroFactura(f.numero_factura) === key
                    );

                    if (!yaExiste && det.saldo_anterior != null) {
                        // Agregar la factura del pago actual con los datos guardados
                        // saldo_anterior es el saldo que había ANTES de aplicar este pago,
                        // así que es el saldo disponible para pagar en esta edición
                        facturasDisponibles.value.push({
                            numero_factura: det.numero_factura,
                            total: det.saldo_anterior, // El saldo anterior es lo máximo que se puede pagar
                            saldo_pendiente: det.saldo_anterior, // El saldo disponible para pagar
                            _fromCurrentPayment: true // Marcador para identificar que viene del pago actual
                        });
                    }
                });

                // Marcar las facturas existentes como seleccionadas con sus montos
                form.value.detalles.forEach((det: any) => {
                    const key = unformatNumeroFactura(det.numero_factura);
                    const item = facturasConSeleccion.value.get(key);
                    if (item) {
                        item.selected = true;
                        item.monto = det.monto_pagar;
                    } else {
                        // Si no existe en el mapa, agregarlo
                        facturasConSeleccion.value.set(key, {
                            selected: true,
                            monto: det.monto_pagar
                        });
                    }
                });
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

// Total de pago basado en facturas seleccionadas
const totalPago = computed(() => {
    let total = 0;
    facturasConSeleccion.value.forEach(v => {
        if (v.selected) total += v.monto;
    });
    return total;
});

// Obtener información de una factura por su número
const getFacturaInfo = (numeroFactura: string) => {
    const raw = unformatNumeroFactura(numeroFactura);
    return facturasDisponibles.value.find(f => unformatNumeroFactura(f.numero_factura) === raw);
};

// Obtener el monto de una factura desde el mapa de selección
const getMontoFactura = (numeroFactura: string) => {
    const key = unformatNumeroFactura(numeroFactura);
    return facturasConSeleccion.value.get(key)?.monto ?? 0;
};

// Verificar si una factura está seleccionada
const isFacturaSeleccionada = (numeroFactura: string) => {
    const key = unformatNumeroFactura(numeroFactura);
    return facturasConSeleccion.value.get(key)?.selected ?? false;
};

const guardar = async () => {
    // Construir detalles desde facturas seleccionadas
    const detallesSeleccionados: { numero_factura: string; monto_pagar: number }[] = [];
    let hayMontoExcedido = false;

    facturasConSeleccion.value.forEach((item, key) => {
        if (item.selected) {
            const factura = facturasDisponibles.value.find(f => unformatNumeroFactura(f.numero_factura) === key);
            if (factura && item.monto > Number(factura.saldo_pendiente)) {
                hayMontoExcedido = true;
            }
            if (item.monto > 0) {
                detallesSeleccionados.push({
                    numero_factura: key,
                    monto_pagar: item.monto
                });
            }
        }
    });

    if (detallesSeleccionados.length === 0) {
        await showWarning("Debe seleccionar al menos una factura con monto a pagar.");
        return;
    }

    if (hayMontoExcedido) {
        await showWarning("Hay montos que exceden el saldo pendiente. Por favor corríjalos.");
        return;
    }

    saving.value = true;
    error.value = null;

    try {
        const payload = {
            ...form.value,
            detalles: detallesSeleccionados
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
                        class="card-header gradient-header text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 class="mb-0 fw-normal">
                            {{ isEditing ? 'Editar Pago' : 'Registrar Nuevo Pago' }}
                        </h4>
                        <div v-if="isEditing">
                            <span class="badge bg-white text-dark me-2">{{ route.params.numero_pago }}</span>
                        </div>
                    </div>

                    <div class="card-body p-4">
                        <!-- Skeleton Loading -->
                        <div v-if="loading" class="skeleton-form">
                            <div class="row g-3 mb-4">
                                <div class="col-md-4">
                                    <div class="skeleton-box mb-2" style="width: 60px; height: 14px;"></div>
                                    <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                                </div>
                                <div class="col-md-4">
                                    <div class="skeleton-box mb-2" style="width: 80px; height: 14px;"></div>
                                    <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                                </div>
                                <div class="col-md-4">
                                    <div class="skeleton-box mb-2" style="width: 100px; height: 14px;"></div>
                                    <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                                </div>
                                <div class="col-12">
                                    <div class="skeleton-box mb-2" style="width: 120px; height: 14px;"></div>
                                    <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                                </div>
                            </div>
                            <hr class="my-4">
                            <div class="skeleton-box mb-3" style="width: 200px; height: 20px;"></div>
                            <div class="skeleton-box mb-2" style="width: 100%; height: 60px;"></div>
                            <div class="skeleton-box mb-2" style="width: 100%; height: 60px;"></div>
                            <div class="skeleton-box" style="width: 100%; height: 60px;"></div>
                        </div>

                        <form v-else @submit.prevent="guardar">
                            <div class="row g-3 mb-4">
                                <div class="col-12 col-md-4">
                                    <ClienteAutocomplete v-model="form.cedula_cliente" :clientes="clientesDisponibles"
                                        label="Cliente" :disabled="isEditing" :required="true"
                                        placeholder="Escriba cédula o nombre..." @select="onClienteSelect" />
                                </div>

                                <div class="col-12 col-md-4">
                                    <label class="form-label fw-bold" for="fechaPago">
                                        <i class="bi bi-calendar-event me-1" aria-hidden="true"></i>Fecha Pago
                                    </label>
                                    <input v-model="fechaActual" type="text" class="form-control" id="fechaPago"
                                        disabled aria-label="Fecha del pago"
                                        title="La fecha de pagos es generada automáticamente">
                                </div>

                                <div class="col-12 col-md-4">
                                    <CuentaAutocomplete v-model="form.codigo_cuenta" :cuentas="cuentas"
                                        label="Cuenta Bancaria" :required="true" placeholder="Buscar cuenta o banco..."
                                        @select="onCuentaSelect" />
                                </div>

                                <div class="col-12">
                                    <label class="form-label fw-bold" for="descripcion">
                                        <i class="bi bi-card-text me-1" aria-hidden="true"></i>Descripción / Notas
                                    </label>
                                    <input v-model="form.descripcion" type="text" class="form-control" id="descripcion"
                                        placeholder="Opcional" aria-label="Notas o descripción adicional del pago"
                                        title="Campo opcional para agregar observaciones o referencias del pago">
                                </div>
                            </div>

                            <hr class="my-4 text-muted">

                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="text-secondary mb-0">
                                        <i class="bi bi-receipt me-2"></i>Seleccione las Facturas a Pagar
                                    </h5>
                                    <span class="badge bg-primary fs-6">
                                        {{ cantidadSeleccionadas }} seleccionada(s)
                                    </span>
                                </div>

                                <!-- Mensaje cuando no hay cliente seleccionado -->
                                <div v-if="!form.cedula_cliente" class="alert alert-info mb-3">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Seleccione un cliente para ver sus facturas pendientes.
                                </div>

                                <!-- Skeleton loading de facturas -->
                                <div v-else-if="cargandoFacturas" class="py-3">
                                    <div v-for="i in 4" :key="i" class="d-flex align-items-center py-2 border-bottom">
                                        <div class="skeleton-box me-3"
                                            style="width: 20px; height: 20px; border-radius: 4px;"></div>
                                        <div class="flex-grow-1">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div class="skeleton-box mb-1" style="width: 100px; height: 16px;">
                                                    </div>
                                                    <div class="skeleton-box" style="width: 180px; height: 12px;"></div>
                                                </div>
                                                <div class="text-end">
                                                    <div class="skeleton-box mb-1" style="width: 80px; height: 16px;">
                                                    </div>
                                                    <div class="skeleton-box" style="width: 60px; height: 12px;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-center text-muted small mt-2">
                                        <i class="bi bi-clock-history me-1"></i>Cargando facturas del cliente...
                                    </div>
                                </div>

                                <!-- Mensaje cuando no hay facturas (y no está cargando) -->
                                <div v-else-if="facturasDisponibles.length === 0" class="alert alert-warning mb-3">
                                    <i class="bi bi-exclamation-triangle me-2"></i>
                                    Este cliente no tiene facturas a crédito pendientes.
                                </div>

                                <!-- Lista de facturas con checkboxes -->
                                <div v-else>
                                    <!-- Barra de búsqueda -->
                                    <div class="input-group mb-2">
                                        <span class="input-group-text" aria-hidden="true">
                                            <i class="bi bi-search"></i>
                                        </span>
                                        <input type="text" class="form-control" v-model="busquedaFactura"
                                            placeholder="Buscar factura por número o monto..."
                                            aria-label="Buscar entre las facturas disponibles"
                                            title="Filtre facturas por número o monto para encontrar más rápido">
                                        <button v-if="busquedaFactura" type="button" class="btn btn-outline-secondary"
                                            @click="busquedaFactura = ''" aria-label="Limpiar búsqueda de facturas"
                                            title="Limpiar filtro de búsqueda">
                                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                                        </button>
                                    </div>

                                    <!-- Header con Seleccionar Todas y Total -->
                                    <div class="card bg-dark text-white mb-2">
                                        <div class="card-body py-2 d-flex justify-content-between align-items-center">
                                            <div class="form-check mb-0">
                                                <input type="checkbox" class="form-check-input" id="selectAll"
                                                    :checked="todasSeleccionadas" @change="toggleTodas">
                                                <label class="form-check-label fw-bold" for="selectAll">
                                                    Seleccionar Todas ({{ facturasDisponibles.length }})
                                                </label>
                                            </div>
                                            <div class="text-end">
                                                <span class="small">TOTAL A PAGAR:</span>
                                                <span class="fs-5 fw-bold ms-2">$ {{ totalPago.toFixed(2) }}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Mensaje si no hay resultados de búsqueda -->
                                    <div v-if="facturasFiltradas.length === 0 && busquedaFactura"
                                        class="alert alert-info mb-2">
                                        <i class="bi bi-info-circle me-2"></i>
                                        No se encontraron facturas que coincidan con "{{ busquedaFactura }}"
                                    </div>

                                    <!-- Cards de Facturas -->
                                    <div class="facturas-container" style="max-height: 400px; overflow-y: auto;">
                                        <div v-for="factura in facturasFiltradas" :key="factura.numero_factura"
                                            class="card mb-2 border-2" :class="{
                                                'border-success bg-success-subtle': isFacturaSeleccionada(factura.numero_factura),
                                                'border-secondary': !isFacturaSeleccionada(factura.numero_factura)
                                            }">
                                            <div class="card-body py-2 px-3">
                                                <div class="row align-items-center g-2">
                                                    <!-- Checkbox y Número de Factura -->
                                                    <div class="col-md-4">
                                                        <div class="form-check mb-0">
                                                            <input type="checkbox" class="form-check-input"
                                                                :id="'fact-' + unformatNumeroFactura(factura.numero_factura)"
                                                                :checked="isFacturaSeleccionada(factura.numero_factura)"
                                                                @change="toggleFactura(factura.numero_factura)">
                                                            <label class="form-check-label fw-bold"
                                                                :for="'fact-' + unformatNumeroFactura(factura.numero_factura)">
                                                                {{ formatNumeroFactura(factura.numero_factura) }}
                                                            </label>
                                                        </div>
                                                        <div class="small text-muted ms-4">
                                                            Total: ${{ Number(factura.total).toFixed(2) }}
                                                        </div>
                                                    </div>

                                                    <!-- Saldo Pendiente -->
                                                    <div class="col-md-2 text-center">
                                                        <div class="small text-muted">Saldo</div>
                                                        <div class="fw-bold text-danger">
                                                            ${{ Number(factura.saldo_pendiente).toFixed(2) }}
                                                        </div>
                                                    </div>

                                                    <!-- Monto a Pagar (Input) -->
                                                    <div class="col-12 col-md-3">
                                                        <label class="small text-muted d-block">Monto a Pagar</label>
                                                        <div class="input-group input-group-sm">
                                                            <span class="input-group-text" aria-hidden="true">$</span>
                                                            <input type="number" class="form-control text-end"
                                                                step="0.01" min="0"
                                                                :max="Number(factura.saldo_pendiente)"
                                                                :value="getMontoFactura(factura.numero_factura)"
                                                                @input="actualizarMonto(factura.numero_factura, Number(($event.target as HTMLInputElement).value))"
                                                                :class="{ 'is-invalid': montoExcedeSaldo(factura) }"
                                                                :disabled="!isFacturaSeleccionada(factura.numero_factura)"
                                                                :aria-label="`Monto a pagar para factura ${formatNumeroFactura(factura.numero_factura)}`"
                                                                :title="`Máximo: $${Number(factura.saldo_pendiente).toFixed(2)}. Ingrese el monto que desea abonar a esta factura`">
                                                            <button type="button" class="btn btn-outline-success btn-sm"
                                                                title="Establecer monto igual al saldo pendiente completo"
                                                                :aria-label="`Pagar saldo completo de $${Number(factura.saldo_pendiente).toFixed(2)}`"
                                                                @click="pagarTotalFactura(factura)"
                                                                :disabled="!isFacturaSeleccionada(factura.numero_factura)">
                                                                <i class="bi bi-arrow-up-circle" aria-hidden="true"></i>
                                                            </button>
                                                        </div>
                                                        <div v-if="montoExcedeSaldo(factura)" class="text-danger small">
                                                            Excede el saldo
                                                        </div>
                                                    </div>

                                                    <!-- Saldo Restante -->
                                                    <div class="col-md-3 text-end">
                                                        <div class="small text-muted">Saldo Restante</div>
                                                        <div class="fw-bold" :class="{
                                                            'text-success': getSaldoRestante(factura) === 0 && isFacturaSeleccionada(factura.numero_factura),
                                                            'text-warning': getSaldoRestante(factura) > 0 && isFacturaSeleccionada(factura.numero_factura),
                                                            'text-muted': !isFacturaSeleccionada(factura.numero_factura)
                                                        }">
                                                            <template
                                                                v-if="isFacturaSeleccionada(factura.numero_factura)">
                                                                ${{ getSaldoRestante(factura).toFixed(2) }}
                                                                <i v-if="getSaldoRestante(factura) === 0"
                                                                    class="bi bi-check-circle-fill text-success ms-1"></i>
                                                            </template>
                                                            <template v-else>--</template>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Resumen Total -->
                                    <div class="card gradient-header text-white mt-3 shadow">
                                        <div class="card-body py-3 d-flex justify-content-between align-items-center">
                                            <div>
                                                <i class="bi bi-cash-stack me-2"></i>
                                                <strong>{{ cantidadSeleccionadas }}</strong> factura(s) seleccionada(s)
                                            </div>
                                            <div class="text-end">
                                                <span class="me-3">TOTAL DEL PAGO:</span>
                                                <span class="fs-4 fw-bold">$ {{ totalPago.toFixed(2) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="error" class="alert alert-danger mt-3"><i
                                    class="bi bi-exclamation-circle me-1"></i> {{ error }}</div>

                            <div class="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
                                <button type="button" @click="router.push('/pagos')" class="btn btn-outline-secondary"
                                    aria-label="Cancelar y volver a la lista de pagos"
                                    title="Descarta los cambios y regresa a la lista de pagos">
                                    <i class="bi bi-x-lg me-1" aria-hidden="true"></i>Cancelar
                                </button>
                                <button type="submit" class="btn btn-success px-4"
                                    :disabled="saving || cantidadSeleccionadas === 0"
                                    :aria-label="isEditing ? 'Guardar cambios del pago' : 'Registrar nuevo pago'"
                                    :title="cantidadSeleccionadas === 0 ? 'Seleccione al menos una factura para continuar' : (isEditing ? 'Actualizar el pago con los cambios realizados' : 'Finalizar el registro del nuevo pago')">
                                    <span v-if="saving" class="spinner-border spinner-border-sm me-2"
                                        aria-hidden="true"></span>
                                    <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
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

<style scoped>
/* Gradiente Azul Mejorado */
.gradient-header {
    background: #1a1a2e;
}

/* Transiciones suaves en cards de facturas */
.facturas-container .card {
    transition: all 0.2s ease;
    border: 1px solid #dee2e6;
}

.facturas-container .card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
    border-color: #bbd6fe;
}

.facturas-container .card.border-success {
    border-color: #0d6efd !important;
    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
    background: linear-gradient(135deg, rgba(13, 110, 253, 0.04) 0%, rgba(10, 88, 202, 0.04) 100%);
}

/* Mejora visual del input de monto */
.input-group-sm .form-control:focus {
    box-shadow: none;
    border-color: #0d6efd;
}

/* Botón pagar total - Adaptado al tema azul */
.btn-outline-success.btn-sm {
    border-left: 0;
    color: #0d6efd;
    border-color: #dee2e6;
}

.btn-outline-success.btn-sm:hover {
    background: #0d6efd;
    color: white;
    border-color: #0d6efd;
}

/* Skeleton loading animation - Azulado muy sutil */
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

/* Focus visible para accesibilidad */
.form-control:focus,
.form-select:focus,
.form-check-input:focus {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

/* Card principal */
.card.shadow {
    border-radius: 12px;
    overflow: hidden;
}

.card-header.gradient-header {
    border-radius: 0;
}
</style>