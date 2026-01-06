<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import type { Cuenta, EntidadBancaria } from '@/types/BankingTypes';

const router = useRouter();

const form = ref<Partial<Cuenta>>({
    codigo: '',
    nombre_cuenta: '',
    descripcion: '',
    id_entidad_bancaria: undefined
});

const bancos = ref<EntidadBancaria[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        const response = await api.get('/v1/entidades-bancarias');
        bancos.value = response.data.data;
    } catch (e) {
        console.error(e);
    }
});

const guardar = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        await api.post('/v1/cuentas-bancarias', form.value);
        alert("Cuenta creada correctamente");
        router.push('/cuentas');
    } catch (e: any) {
        if (e.response?.status === 422) {
            const errors = e.response.data.errors;
            error.value = Object.values(errors).flat().join('\n');
        } else {
            error.value = e.response?.data?.message || "Error al guardar la cuenta.";
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="container mt-4 mb-5">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="card shadow border-0">
                    <div class="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 class="mb-0 fw-normal">
                            <i class="bi bi-bank me-2"></i>Nueva Cuenta Bancaria
                        </h4>
                    </div>

                    <div class="card-body p-4">
                        <div v-if="error" class="alert alert-danger" role="alert" style="white-space: pre-line;">
                            <i class="bi bi-exclamation-circle me-1"></i> {{ error }}
                        </div>

                        <form @submit.prevent="guardar">
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label for="codigo" class="form-label fw-bold">Código (Único)</label>
                                    <input 
                                        id="codigo"
                                        v-model="form.codigo" 
                                        type="text" 
                                        class="form-control" 
                                        placeholder="Ej: CTA-BAN-001" 
                                        required 
                                    />
                                    <div class="form-text text-muted">Identificador único de la cuenta</div>
                                </div>

                                <div class="col-md-6">
                                    <label for="banco" class="form-label fw-bold">Entidad Bancaria</label>
                                    <select 
                                        id="banco"
                                        v-model="form.id_entidad_bancaria" 
                                        class="form-select" 
                                        required
                                    >
                                        <option :value="undefined" disabled>Seleccione un banco...</option>
                                        <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                            {{ banco.nombre }}
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="nombre" class="form-label fw-bold">Nombre de la Cuenta</label>
                                <input 
                                    id="nombre"
                                    v-model="form.nombre_cuenta" 
                                    type="text" 
                                    class="form-control" 
                                    placeholder="Ej: Cuenta Corriente Principal" 
                                    required 
                                />
                            </div>

                            <div class="mb-4">
                                <label for="descripcion" class="form-label fw-bold">Descripción</label>
                                <textarea 
                                    id="descripcion"
                                    v-model="form.descripcion" 
                                    class="form-control" 
                                    rows="3" 
                                    placeholder="Detalles adicionales sobre la cuenta (opcional)..."
                                ></textarea>
                            </div>

                            <hr class="my-4 text-muted">

                            <div class="d-flex justify-content-end gap-2">
                                <button 
                                    type="button" 
                                    @click="router.push('/cuentas')" 
                                    class="btn btn-outline-secondary"
                                    :disabled="loading"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    class="btn btn-success px-4"
                                    :disabled="loading"
                                >
                                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                    {{ loading ? 'Guardando...' : 'Crear Cuenta' }}
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
</style>