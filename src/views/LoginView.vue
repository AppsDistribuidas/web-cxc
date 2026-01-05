<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuth } from '@/composables/useAuth';
import api from '@/api/axios';

const router = useRouter();
const { setUser } = useAuth();

const form = ref({
    email_username: '',
    password: '',
    modulo_id: 4
});

const loading = ref(false);
const error = ref<string | null>(null);

const handleLogin = async () => {
    loading.value = true;
    error.value = null;

    try {
        // 1. Petición a la URL correcta (/api/login)
        const response = await api.post('/auth/login', {
            email_username: form.value.email_username,
            password: form.value.password,
            modulo_id: form.value.modulo_id
        });

        // 2. Desestructuramos la respuesta basándonos en tu JSON real
        // La estructura es: { success, message, data: { access_token, user, modulo } }
        const { success, data } = response.data;

        if (success && data) {
            const { user: apiUser, modulo } = data;

            // Fusionar Usuario + Módulo para el estado global
            // Creamos un objeto único para que 'useAuth' pueda hacer user.modulo.funciones
            const sessionUser = {
                ...apiUser, // username, email, dni
                modulo: modulo // agregamos el módulo con sus funciones
            };

            // Guardar en Estado Global
            setUser(sessionUser);

            // Redirigir al dashboard
            router.push('/');
        } else {
            error.value = "Respuesta del servidor no exitosa.";
        }

    } catch (e: any) {
        console.error(e);
        if (e.response) {
            // Si el servidor responde con error (ej: 401)
            error.value = e.response.data.message || "Credenciales incorrectas.";
        } else {
            error.value = "Error de conexión con el servicio de seguridad.";
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="d-flex min-vh-100 align-items-center justify-content-center bg-light">
        <div class="card shadow-lg border-0" style="max-width: 400px; width: 100%;">
            <div class="card-body p-5">
                <div class="text-center mb-4">
                    <h2 class="fw-bold text-primary">Sistema CxC</h2>
                    <p class="text-muted small">Ingresa tus credenciales institucionales</p>
                </div>

                <div v-if="error" class="alert alert-danger text-center p-2 mb-3 small">
                    {{ error }}
                </div>

                <form @submit.prevent="handleLogin">
                    <div class="mb-3">
                        <label class="form-label fw-bold small">Usuario / Correo</label>
                        <input v-model="form.email_username" type="text" class="form-control"
                            placeholder="ej: usuario@utn.edu.ec" required autofocus />
                    </div>

                    <div class="mb-4">
                        <label class="form-label fw-bold small">Contraseña</label>
                        <input v-model="form.password" type="password" class="form-control" placeholder="••••••••"
                            required />
                    </div>

                    <button type="submit" class="btn btn-primary w-100 py-2 fw-bold" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                        {{ loading ? 'Validando...' : 'Iniciar Sesión' }}
                    </button>
                </form>

                <div class="mt-4 text-center">
                    <small class="text-muted">Módulo ID: {{ form.modulo_id }}</small>
                </div>
            </div>
        </div>
    </div>
</template>