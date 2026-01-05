<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
const { user } = useAuth();
</script>

<template>
  <div class="container mt-4">
    <div class="card shadow-sm">
      <div class="card-header bg-primary text-white">
        <h4 class="mb-0">Inicio</h4>
      </div>
      
      <div class="card-body">
        <h2 class="card-title">
            ¡Bienvenido, <span class="text-primary">{{ user?.usuario?.username || 'Usuario' }}</span>!
        </h2>
        <p class="text-muted">Has iniciado sesión correctamente en el Sistema CXC.</p>
        
        <hr class="my-4">

        <h5 class="mb-3">Tus Permisos Asignados:</h5>

        <div v-if="user?.modulo?.funciones && user.modulo.funciones.length > 0">
            <div class="row">
                <div class="col-md-6" v-for="funcion in user.modulo.funciones" :key="funcion.funcion_id">
                    <div class="alert alert-info d-flex align-items-center" role="alert">
                        <i class="bi bi-check-circle-fill me-2"></i>
                        <div>
                            <strong>{{ funcion.nombre }}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="alert alert-warning">
            No tienes permisos asignados o no se pudieron cargar.
        </div>
      </div>
    </div>
  </div>
</template>