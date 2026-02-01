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
const loading = ref(false);
const submitting = ref(false);

onMounted(async () => {
    loading.value = true;
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
    <div class="container mt-4">
        <div class="row justify-content-center">
            <div class="col-md-8 col-lg-6">

                <div class="d-flex align-items-center mb-3">
                    <button @click="router.push('/cuentas')" class="btn btn-outline-secondary me-3 rounded-circle">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <h2 class="mb-0">Editar Cuenta</h2>
                </div>

                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>

                <div v-else class="card shadow-sm border-0">
                    <div class="card-body p-4">



                        <form @submit.prevent="actualizar">

                            <div class="mb-3">
                                <label class="form-label fw-bold">Código</label>
                                <div class="form-control bg-light" style="cursor: not-allowed;">
                                    {{ form.codigo }}
                                </div>
                                <div class="form-text">
                                    <i class="bi bi-lock-fill me-1"></i>
                                    El código no se puede modificar.
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="nombre" class="form-label fw-bold">Tipo de Cuenta</label>
                                <select id="nombre" v-model="form.nombre_cuenta" class="form-select" required>
                                    <option value="" disabled>Seleccione un tipo de cuenta...</option>
                                    <option v-for="tipo in tiposCuenta" :key="tipo" :value="tipo">
                                        {{ tipo }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="banco" class="form-label fw-bold">Entidad Bancaria</label>
                                <select id="banco" v-model="form.id_entidad_bancaria" class="form-select" required>
                                    <option value="" disabled>Seleccione un banco...</option>
                                    <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                        {{ banco.nombre }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="descripcion" class="form-label fw-bold">Descripción</label>
                                <textarea id="descripcion" v-model="form.descripcion" class="form-control" rows="3"
                                    placeholder="Detalles adicionales..."></textarea>
                            </div>

                            <div class="mb-4">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="estadoSwitch"
                                        v-model="form.estado">
                                    <label class="form-check-label" for="estadoSwitch">
                                        {{ form.estado ? 'Cuenta Activa' : 'Cuenta Inactiva' }}
                                    </label>
                                </div>
                            </div>

                            <hr>

                            <div class="d-flex justify-content-end gap-2">
                                <button type="button" @click="router.push('/cuentas')" class="btn btn-secondary"
                                    :disabled="submitting">
                                    Cancelar
                                </button>

                                <button type="submit" class="btn btn-primary d-flex align-items-center"
                                    :disabled="submitting">
                                    <span v-if="submitting" class="spinner-border spinner-border-sm me-2" role="status"
                                        aria-hidden="true"></span>
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
.btn-outline-secondary.rounded-circle {
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>