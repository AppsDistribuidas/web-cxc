<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuth } from '@/composables/useAuth';

const { isAuthenticated, logout, user, can } = useAuth();
</script>

<template>
  <nav v-if="isAuthenticated" class="navbar navbar-expand-lg navbar-dark bg-dark mb-4 shadow-sm">
    <div class="container">
      <a class="navbar-brand" href="#">Sistema CXC</a>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <RouterLink to="/" class="nav-link" active-class="active">Inicio</RouterLink>
          </li>
          <li v-if="can('Administración cuentas bancarias')" class="nav-item">
            <RouterLink to="/cuentas" class="nav-link" active-class="active">Cuentas Bancarias</RouterLink>
          </li>
          <li v-if="can('Gestión de Pagos')" class="nav-item">
            <RouterLink to="/pagos" class="nav-link" active-class="active">Pagos</RouterLink>
          </li>
          <li v-if="can('Reporte de Auditorías')" class="nav-item">
            <RouterLink to="/auditoria" class="nav-link" active-class="active">Auditoría</RouterLink>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-3 text-light">
          <small>Hola, <strong>{{ user?.username || 'Usuario' }}</strong></small>
          <button @click="logout" class="btn btn-danger btn-sm">
            Salir
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="container">
    <RouterView />
  </main>
</template>

<style scoped>
/* */
</style>