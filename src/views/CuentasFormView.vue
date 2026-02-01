<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import type { Cuenta, EntidadBancaria } from '@/types/BankingTypes';
import { useSweetAlert } from '@/composables/useSweetAlert';

const router = useRouter();
const { showSuccess, showError } = useSweetAlert();

const form = ref<Partial<Cuenta>>({
    nombre_cuenta: '',
    descripcion: '',
    id_entidad_bancaria: undefined
});

const bancos = ref<EntidadBancaria[]>([]);
const tiposCuenta = ref<string[]>([]);
const loading = ref(false);

onMounted(async () => {
    try {
        // Cargar bancos y tipos de cuenta en paralelo
        const [responseBancos, responseTipos] = await Promise.all([
            api.get('/v1/entidades-bancarias'),
            api.get('/v1/tipos-cuenta')
        ]);

        bancos.value = responseBancos.data.data;
        tiposCuenta.value = responseTipos.data.data;
    } catch (e) {
        console.error(e);
    }
});

const guardar = async () => {
    loading.value = true;

    try {
        await api.post('/v1/cuentas-bancarias', form.value);
        await showSuccess('La cuenta bancaria ha sido creada exitosamente');
        router.push('/cuentas');
    } catch (e: any) {
        // Ignorar 401 - manejado globalmente por interceptor
        if (e.response?.status === 401) return;
        if (e.response?.status === 422) {
            const errors = e.response.data.errors;
            const errorMessages = Object.values(errors).flat().join('\n');
            await showError(errorMessages);
        } else {
            await showError(e.response?.data?.message || "Error al guardar la cuenta.");
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="container mt-4">
        <div class="row justify-content-center">
            <div class="col-md-8 col-lg-6">

                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h2 class="mb-0">Nueva Cuenta Bancaria</h2>
                    </div>

                    <div class="card-body p-4">


                        <form @submit.prevent="guardar">

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
                                <label for="banco" class="form-label fw-bold">Banco</label>
                                <select id="banco" v-model="form.id_entidad_bancaria" class="form-select" required>
                                    <option :value="undefined" disabled>Seleccione un banco...</option>
                                    <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                        {{ banco.nombre }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-4">
                                <label for="descripcion" class="form-label fw-bold">Descripción</label>
                                <textarea id="descripcion" v-model="form.descripcion" class="form-control" rows="3"
                                    placeholder="Detalles opcionales..."></textarea>
                            </div>

                            <div class="d-flex justify-content-end gap-2">
                                <button type="button" @click="router.push('/cuentas')" class="btn btn-secondary"
                                    :disabled="loading">
                                    Cancelar
                                </button>
                                <button type="submit" class="btn btn-success d-flex align-items-center"
                                    :disabled="loading">
                                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                    {{ loading ? 'Guardando...' : 'Guardar' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>