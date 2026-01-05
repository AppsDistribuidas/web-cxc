<script setup lang="ts">
import api from '@/api/axios';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

import type { Cuenta } from '@/types/BankingTypes';

const router = useRouter();
const { can } = useAuth();

const cuentas = ref<Cuenta[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const obtenerCuentas = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await api.get('/v1/cuentas-bancarias');
        cuentas.value = response.data.data;
    } catch (e: any) {
        if (e.response && e.response.status === 403) {
            error.value = "No tienes permiso para ver las cuentas.";
        } else {
            error.value = "Error al cargar los datos. Intente nuevamente.";
        }
    } finally {
        loading.value = false;
    }
};

const eliminarCuenta = async (cuenta: Cuenta) => {
    if (!can('Eliminar Cuenta') && !can('Administración Cuentas Bancarias')) {
        alert("No tienes permiso para eliminar.");
        return;
    }

    if (!confirm(`¿Estás seguro de desactivar la cuenta "${cuenta.nombre_cuenta}"?`)) return;

    try {
        const payload = {
            codigo: cuenta.codigo,
            nombre_cuenta: cuenta.nombre_cuenta,
            id_entidad_bancaria: (cuenta as any).id_entidad_bancaria,
            descripcion: (cuenta as any).descripcion,
            estado: false
        };

        await api.put(`/v1/cuentas-bancarias/${cuenta.codigo}`, payload);

        cuenta.estado = false;
        alert("Cuenta desactivada correctamente.");
    } catch (e: any) {
        console.error(e);
        alert("Error al desactivar: " + (e.response?.data?.message || "Error desconocido"));
    }
};

onMounted(() => {
    obtenerCuentas();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="text-primary mb-0">
                Cuentas Bancarias
            </h2>

            <button v-if="can('Crear Cuenta') || can('Administración Cuentas Bancarias')"
                @click="router.push('/cuentas/crear')" class="btn btn-success">
                <i class="bi bi-plus-lg"></i> Nueva Cuenta
            </button>
        </div>

        <div v-if="loading" class="alert alert-info text-center">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Cargando datos...
        </div>

        <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
        </div>

        <div v-if="!loading && !error" class="card shadow-sm">
            <div class="card-body p-0">
                <table class="table table-striped table-hover mb-0">
                    <thead class="table-dark">
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Banco</th>
                            <th class="text-center">Estado</th>
                            <th v-if="can('Editar Cuenta') || can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')"
                                class="text-end pe-4">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="cuenta in cuentas" :key="cuenta.codigo">
                            <td class="align-middle">{{ cuenta.codigo }}</td>
                            <td class="align-middle fw-bold">{{ cuenta.nombre_cuenta }}</td>
                            <td class="align-middle">{{ cuenta.entidad_bancaria?.nombre || 'N/A' }}</td>
                            <td class="align-middle text-center">
                                <span :class="cuenta.estado ? 'badge bg-success' : 'badge bg-danger'">
                                    {{ cuenta.estado ? 'Activo' : 'Inactivo' }}
                                </span>
                            </td>

                            <td class="align-middle text-end pe-3"
                                v-if="can('Editar Cuenta') || can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')">
                                <div class="btn-group" role="group">
                                    <button v-if="can('Editar Cuenta') || can('Administración Cuentas Bancarias')"
                                        @click="router.push(`/cuentas/${cuenta.codigo}/editar`)"
                                        class="btn btn-warning btn-sm text-white" title="Editar">
                                        Editar
                                    </button>

                                    <button v-if="can('Eliminar Cuenta') || can('Administración Cuentas Bancarias')"
                                        @click="eliminarCuenta(cuenta)" class="btn btn-danger btn-sm" title="Desactivar"
                                        :disabled="!cuenta.estado">
                                        Desactivar
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <tr v-if="cuentas.length === 0">
                            <td colspan="5" class="text-center py-4 text-muted">
                                No hay cuentas registradas en el sistema.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style scoped>
.table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
}

.table-hover tbody tr:hover {
    background-color: rgba(0, 0, 0, .02);
}
</style>