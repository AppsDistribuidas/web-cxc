<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import type { Cuenta, EntidadBancaria } from '@/types/BankingTypes';
import { useSweetAlert } from '@/composables/useSweetAlert';


const router = useRouter();
const route = useRoute();
const idCuenta = route.params.id as string;
const { showSuccess, showError } = useSweetAlert();

const form = ref<Partial<Cuenta>>({
    codigo: '',
    nombre_cuenta: '',
    descripcion: '',
    id_entidad_bancaria: undefined,
    estado: true
});

const bancos = ref<EntidadBancaria[]>([]);
const tiposCuenta = ref<string[]>([]);
const loading = ref(true);
const submitting = ref(false);

onMounted(async () => {
    try {
        // Cargar todos los datos en paralelo para optimizar el tiempo de carga
        const [resBancos, resTipos, resCuenta] = await Promise.all([
            api.get('/v1/entidades-bancarias'),
            api.get('/v1/tipos-cuenta'),
            api.get(`/v1/cuentas-bancarias/${idCuenta}`)
        ]);

        // Asignar datos de bancos y tipos
        bancos.value = resBancos.data.data;
        tiposCuenta.value = resTipos.data.data;

        // Rellenar el formulario con los datos de la cuenta
        const data = resCuenta.data.data;
        form.value = {
            codigo: data.codigo,
            nombre_cuenta: data.nombre_cuenta,
            descripcion: data.descripcion,
            id_entidad_bancaria: data.id_entidad_bancaria,
            estado: Boolean(data.estado)
        };

    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        console.error(e);
        await showError("Error al cargar los datos de la cuenta.");
    } finally {
        loading.value = false;
    }
});

const actualizar = async () => {
    submitting.value = true;

    try {
        // ENVIAR CAMBIOS (PUT)
        await api.put(`/v1/cuentas-bancarias/${idCuenta}`, form.value);

        await showSuccess('La cuenta bancaria ha sido actualizada exitosamente');
        router.push('/cuentas');
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        if (e.response?.status === 422) {
            // Errores de validación de Laravel
            const errors = e.response.data.errors;
            const errorMessages = Object.values(errors).flat().join('\n');
            await showError(errorMessages);
        } else {
            await showError(e.response?.data?.message || "Error al actualizar.");
        }
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <div class="container mt-4 mb-5">
        <div class="row justify-content-center">
            <div class="col-md-8 col-lg-6">

                <div class="card shadow border-0">
                    <div
                        class="card-header gradient-header text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 class="mb-0 fw-normal">
                            Editar Cuenta Bancaria
                        </h4>
                        <span class="badge bg-white text-dark">{{ idCuenta }}</span>
                    </div>

                    <div class="card-body p-4">
                        <!-- Skeleton Loading -->
                        <div v-if="loading" class="skeleton-form">
                            <div class="mb-3">
                                <div class="skeleton-box mb-2" style="width: 60px; height: 14px;"></div>
                                <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                            </div>
                            <div class="mb-3">
                                <div class="skeleton-box mb-2" style="width: 100px; height: 14px;"></div>
                                <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                            </div>
                            <div class="mb-3">
                                <div class="skeleton-box mb-2" style="width: 120px; height: 14px;"></div>
                                <div class="skeleton-box" style="width: 100%; height: 38px;"></div>
                            </div>
                            <div class="mb-3">
                                <div class="skeleton-box mb-2" style="width: 90px; height: 14px;"></div>
                                <div class="skeleton-box" style="width: 100%; height: 80px;"></div>
                            </div>
                            <div class="mb-4">
                                <div class="skeleton-box" style="width: 150px; height: 24px;"></div>
                            </div>
                            <hr>
                            <div class="d-flex justify-content-end gap-2">
                                <div class="skeleton-box" style="width: 100px; height: 38px;"></div>
                                <div class="skeleton-box" style="width: 140px; height: 38px;"></div>
                            </div>
                        </div>

                        <form v-else @submit.prevent="actualizar">

                            <div class="mb-3">
                                <label for="codigo" class="form-label fw-bold">
                                    <i class="bi bi-hash me-1"></i>Código
                                </label>
                                <input id="codigo" type="text" :value="form.codigo" class="form-control bg-light"
                                    readonly />
                                <div class="form-text">
                                    <i class="bi bi-lock-fill me-1"></i>
                                    El código no se puede modificar.
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="nombre" class="form-label fw-bold">
                                    <i class="bi bi-credit-card me-1"></i>Tipo de Cuenta
                                </label>
                                <select id="nombre" v-model="form.nombre_cuenta" class="form-select" required>
                                    <option value="" disabled>Seleccione un tipo de cuenta...</option>
                                    <option v-for="tipo in tiposCuenta" :key="tipo" :value="tipo">
                                        {{ tipo }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="banco" class="form-label fw-bold">
                                    <i class="bi bi-building me-1"></i>Entidad Bancaria
                                </label>
                                <select id="banco" v-model="form.id_entidad_bancaria" class="form-select" required>
                                    <option value="" disabled>Seleccione un banco...</option>
                                    <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                        {{ banco.nombre }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="descripcion" class="form-label fw-bold">
                                    <i class="bi bi-card-text me-1"></i>Descripción
                                </label>
                                <textarea id="descripcion" v-model="form.descripcion" class="form-control" rows="3"
                                    placeholder="Detalles adicionales..."></textarea>
                            </div>

                            <div class="mb-4">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="estadoSwitch"
                                        v-model="form.estado">
                                    <label class="form-check-label fw-bold" for="estadoSwitch">
                                        <i class="bi me-1"
                                            :class="form.estado ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'"></i>
                                        {{ form.estado ? 'Cuenta Activa' : 'Cuenta Inactiva' }}
                                    </label>
                                </div>
                            </div>

                            <hr>

                            <div class="d-flex justify-content-end gap-2">
                                <button type="button" @click="router.push('/cuentas')" class="btn btn-outline-secondary"
                                    :disabled="submitting">
                                    <i class="bi bi-x-lg me-1"></i>Cancelar
                                </button>

                                <button type="submit" class="btn btn-primary d-flex align-items-center"
                                    :disabled="submitting">
                                    <span v-if="submitting" class="spinner-border spinner-border-sm me-2" role="status"
                                        aria-hidden="true"></span>
                                    <i v-else class="bi bi-check-lg me-1"></i>
                                    {{ submitting ? 'Guardando...' : 'Actualizar Cambios' }}
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
    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
}

/* Skeleton loading animation */
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

/* Botón primary mejorado */
.btn-primary {
    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
    border: none;
    transition: all 0.3s ease;
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.35);
}

/* Botón outline mejorado */
.btn-outline-secondary {
    transition: all 0.2s ease;
}

.btn-outline-secondary:hover {
    transform: translateY(-1px);
}

/* Form switch mejorado */
.form-check-input:checked {
    background-color: #198754;
    border-color: #198754;
}
</style>