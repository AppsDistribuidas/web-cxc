<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import type { Cuenta, EntidadBancaria } from '@/types/BankingTypes';


const router = useRouter();
const route = useRoute();
const idCuenta = route.params.id as string; 

const form = ref<Partial<Cuenta>>({
    codigo: '',
    nombre_cuenta: '',
    descripcion: '',
    id_entidad_bancaria: undefined,
    estado: true
});

const bancos = ref<EntidadBancaria[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
    loading.value = true;
    try {
        // 1. Cargar lista de bancos
        const resBancos = await api.get('/v1/entidades-bancarias');
        bancos.value = resBancos.data.data;

        // 2. Cargar datos de la cuenta a editar
        const resCuenta = await api.get(`/v1/cuentas-bancarias/${idCuenta}`);
        const data = resCuenta.data.data;
        
        // Rellenamos el formulario
        form.value = {
            codigo: data.codigo,
            nombre_cuenta: data.nombre_cuenta,
            descripcion: data.descripcion,
            id_entidad_bancaria: data.id_entidad_bancaria,
            estado: Boolean(data.estado)
        };

    } catch (e) {
        console.error(e);
        error.value = "Error al cargar los datos de la cuenta.";
    } finally {
        loading.value = false;
    }
});

const actualizar = async () => {
    submitting.value = true;
    error.value = null;
    
    try {
        // ENVIAR CAMBIOS (PUT)
        await api.put(`/v1/cuentas-bancarias/${idCuenta}`, form.value);
        
        // Feedback nativo rápido
        alert("Cuenta actualizada correctamente");
        router.push('/cuentas');
    } catch (e: any) {
        if (e.response?.status === 422) {
            // Errores de validación de Laravel
            const errors = e.response.data.errors;
            error.value = Object.values(errors).flat().join('\n');
        } else {
            error.value = e.response?.data?.message || "Error al actualizar.";
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
                        
                        <div v-if="error" class="alert alert-danger d-flex align-items-center" role="alert">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            <div style="white-space: pre-line;">{{ error }}</div>
                        </div>

                        <form @submit.prevent="actualizar">
                            
                            <div class="mb-3">
                                <label for="codigo" class="form-label fw-bold">Código</label>
                                <input 
                                    id="codigo"
                                    v-model="form.codigo" 
                                    type="text" 
                                    class="form-control" 
                                    required
                                    readonly 
                                    disabled
                                    title="El código no se debe modificar"
                                />
                                <div class="form-text">El código identificador no se puede cambiar.</div>
                            </div>

                            <div class="mb-3">
                                <label for="nombre" class="form-label fw-bold">Nombre de la Cuenta</label>
                                <input 
                                    id="nombre"
                                    v-model="form.nombre_cuenta" 
                                    type="text" 
                                    class="form-control" 
                                    placeholder="Ej: Cuenta Corriente Bco Pichincha"
                                    required 
                                />
                            </div>

                            <div class="mb-3">
                                <label for="banco" class="form-label fw-bold">Entidad Bancaria</label>
                                <select 
                                    id="banco"
                                    v-model="form.id_entidad_bancaria" 
                                    class="form-select"
                                    required
                                >
                                    <option value="" disabled>Seleccione un banco...</option>
                                    <option v-for="banco in bancos" :key="banco.id" :value="banco.id">
                                        {{ banco.nombre }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="descripcion" class="form-label fw-bold">Descripción</label>
                                <textarea 
                                    id="descripcion"
                                    v-model="form.descripcion" 
                                    class="form-control" 
                                    rows="3"
                                    placeholder="Detalles adicionales..."
                                ></textarea>
                            </div>

                            <div class="mb-4">
                                <div class="form-check form-switch">
                                    <input 
                                        class="form-check-input" 
                                        type="checkbox" 
                                        id="estadoSwitch"
                                        v-model="form.estado"
                                    >
                                    <label class="form-check-label" for="estadoSwitch">
                                        {{ form.estado ? 'Cuenta Activa' : 'Cuenta Inactiva' }}
                                    </label>
                                </div>
                            </div>

                            <hr>

                            <div class="d-flex justify-content-end gap-2">
                                <button 
                                    type="button" 
                                    @click="router.push('/cuentas')" 
                                    class="btn btn-secondary"
                                    :disabled="submitting"
                                >
                                    Cancelar
                                </button>
                                
                                <button 
                                    type="submit" 
                                    class="btn btn-primary d-flex align-items-center"
                                    :disabled="submitting"
                                >
                                    <span v-if="submitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
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