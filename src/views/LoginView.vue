<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import api from '@/api/axios';
import { Modulo } from '@/types/Modulos';

const router = useRouter();
const { setUser } = useAuth();

const form = ref({
    email_username: '',
    password: '',
    modulo_id: Modulo.CUENTAS_POR_COBRAR
});

const loading = ref(false);
const error = ref<string | null>(null);
const showPassword = ref(false);

const handleLogin = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.post('/auth/login', {
            email_username: form.value.email_username,
            password: form.value.password,
            modulo_id: form.value.modulo_id
        });

        const { success, data } = response.data;

        if (success && data) {
            const { user: apiUser, modulo } = data;

            const sessionUser = {
                ...apiUser,
                modulo: modulo
            };

            setUser(sessionUser);
            router.push('/');
        } else {
            error.value = "Respuesta del servidor no exitosa.";
        }

    } catch (e: any) {
        console.error(e);
        if (e.response) {
            const responseData = e.response.data;

            if (responseData.errors && Array.isArray(responseData.errors)) {
                error.value = responseData.errors.join('. ');
            } else {
                error.value = responseData.message;
            }
        } else {
            error.value = "Error de conexión con el servicio de seguridad.";
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="login-wrapper">
        <div class="login-container">
            <div class="card shadow-lg border-0 login-card">
                <!-- Header con gradiente -->
                <div class="card-header gradient-header text-white text-center py-4">
                    <h2 class="fw-bold mb-1">Sistema CxC</h2>
                    <p class="mb-0 opacity-75 small">Cuentas por Cobrar</p>
                </div>

                <div class="card-body p-4 p-md-5">
                    <!-- Alert de error -->
                    <div v-if="error" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-4" role="alert">
                        <i class="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                        <span>{{ error }}</span>
                    </div>

                    <form @submit.prevent="handleLogin">
                        <!-- Campo Usuario -->
                        <div class="mb-4">
                            <label for="email_username" class="form-label fw-bold">
                                <i class="bi bi-person-fill me-1"></i>Correo
                            </label>
                            <div class="input-group">
                                <span class="input-group-text bg-light">
                                    <i class="bi bi-person text-muted"></i>
                                </span>
                                <input id="email_username" v-model="form.email_username" type="text"
                                    class="form-control" placeholder="usuario@utn.edu.ec" required autofocus
                                    autocomplete="username" aria-label="Ingrese su correo electrónico"
                                    aria-describedby="usernameHelp" />
                            </div>
                            <div id="usernameHelp" class="form-text">
                                Use su correo institucional
                            </div>
                        </div>

                        <!-- Campo Contraseña -->
                        <div class="mb-4">
                            <label for="password" class="form-label fw-bold">
                                <i class="bi bi-lock-fill me-1"></i>Contraseña
                            </label>
                            <div class="input-group">
                                <span class="input-group-text bg-light">
                                    <i class="bi bi-key text-muted"></i>
                                </span>
                                <input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'"
                                    class="form-control" placeholder="••••••••" required autocomplete="current-password"
                                    aria-label="Ingrese su contraseña" />
                                <button type="button" class="btn btn-outline-secondary"
                                    @click="showPassword = !showPassword"
                                    :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                                    :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                                    <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Botón Submit -->
                        <button type="submit" class="btn btn-primary w-100 py-2 fw-bold login-btn" :disabled="loading"
                            aria-label="Iniciar sesión en el sistema">
                            <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"
                                aria-hidden="true"></span>
                            <i v-else class="bi bi-box-arrow-in-right me-2"></i>
                            {{ loading ? 'Validando...' : 'Iniciar Sesión' }}
                        </button>
                    </form>

                    <!-- Footer -->
                    <div class="text-center mt-4 pt-3 border-top">
                        <small class="text-muted">
                            <i class="bi bi-shield-lock me-1"></i>
                            Conexión segura
                        </small>
                    </div>
                </div>
            </div>

            <!-- Versión -->
            <div class="text-center mt-3">
                <small class="text-white-50">v1.0.0 • Universidad Técnica del Norte</small>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Fondo azul con glassmorphism */
.login-wrapper {
    min-height: 100vh;
    min-width: 100vw;
    display: flex;
    align-items: safe center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 1rem;
    margin: 0;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: auto;
}

.login-container {
    width: 100%;
    max-width: 420px;
}

/* Card con glassmorphism */
.login-card {
    border-radius: 16px;
    overflow: hidden;
    animation: slideUp 0.4s ease-out;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Header claro para contraste con fondo oscuro */
.gradient-header {
    background: #ffffff;
    color: #1a1a2e !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.gradient-header h2,
.gradient-header p {
    color: #1a1a2e !important;
}

.gradient-header .opacity-75 {
    opacity: 0.6 !important;
    color: #495057 !important;
}

.logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 70px;
    height: 70px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    backdrop-filter: blur(10px);
}

/* Campos del formulario */
.input-group-text {
    border-right: 0;
}

.input-group .form-control {
    border-left: 0;
}

.input-group .form-control:focus {
    border-color: #86b7fe;
    box-shadow: none;
}

.input-group:focus-within {
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    border-radius: 0.375rem;
}

.input-group:focus-within .input-group-text,
.input-group:focus-within .form-control,
.input-group:focus-within .btn {
    border-color: #86b7fe;
}

/* Botón de login mejorado */
.login-btn {
    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
    border: none;
    transition: all 0.3s ease;
    font-size: 1rem;
}

.login-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(13, 110, 253, 0.4);
}

.login-btn:active:not(:disabled) {
    transform: translateY(0);
}

.login-btn:disabled {
    opacity: 0.7;
}

/* Botón mostrar/ocultar contraseña */
.btn-outline-secondary {
    border-left: 0;
    background: #f8f9fa;
}

.btn-outline-secondary:hover {
    background: #e9ecef;
    color: #0d6efd;
}

/* Alert de error */
.alert-danger {
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    border: none;
    border-left: 4px solid #dc3545;
    border-radius: 8px;
}

/* Responsive */
@media (max-width: 576px) {
    .login-wrapper {
        padding: 0.5rem;
    }

    .login-container {
        max-width: 100%;
    }

    .login-card {
        border-radius: 12px;
        margin: 0.5rem;
    }

    .card-body {
        padding: 1.25rem !important;
    }

    .card-header {
        padding: 1rem !important;
    }

    .logo-icon {
        width: 50px;
        height: 50px;
    }

    .logo-icon i {
        font-size: 1.5rem !important;
    }

    .gradient-header h2 {
        font-size: 1.25rem;
    }

    .gradient-header p {
        font-size: 0.75rem;
    }

    .form-label {
        font-size: 0.875rem;
    }

    .input-group .form-control,
    .input-group-text {
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
    }

    .login-btn {
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
    }
}

/* Pantallas muy pequeñas */
@media (max-width: 360px) {
    .card-body {
        padding: 1rem !important;
    }

    .gradient-header h2 {
        font-size: 1.1rem;
    }

    .logo-icon {
        width: 45px;
        height: 45px;
    }
}
</style>