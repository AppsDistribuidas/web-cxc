<template>
    <div class="d-flex justify-content-center align-items-center" style="min-height: 60vh;">
        <div class="card shadow-sm text-center" style="max-width: 500px;">
            <div class="card-body p-5">
                <div class="text-danger mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor"
                        viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                        <path
                            d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                    </svg>
                </div>

                <h1 class="h2 fw-bold mb-3">403 - Acceso Prohibido</h1>

                <p class="text-secondary fs-5 mb-2">
                    No tienes permisos para acceder a esta página.
                </p>

                <p class="text-muted small mb-4">
                    Por favor, contacta al administrador del sistema si crees que deberías tener acceso a esta
                    funcionalidad.
                </p>

                <RouterLink to="/" class="btn btn-primary">
                    Volver al Inicio
                </RouterLink>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
