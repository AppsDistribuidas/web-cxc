<script setup lang="ts">
import api from '@/api/axios';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface PistaAuditoria {
    id: number;
    accion: string;
    descripcion: string;
    observacion: string;
    ipUsuario: string;
    fecha: string;
    usuario?: { username: string };
    funcion?: { nombre: string };
}

interface Pagination {
    total_records: number;
    current_page: number;
    total_pages: number;
    limit_applied: number;
}

const router = useRouter();

const pistas = ref<PistaAuditoria[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Paginación
const pagination = ref<Pagination | null>(null);
const currentPage = ref(1);
const limit = ref(15);

// Filtros
const fechaInicio = ref('');
const fechaFin = ref('');

const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'N/A';
    
    try {
        const fecha = new Date(fechaString);
        if (isNaN(fecha.getTime())) {
            return fechaString;
        }
        return new Intl.DateTimeFormat('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(fecha);
    } catch (e) {
        return fechaString;
    }
};

const getBadgeClass = (accion: string) => {
    const clases: Record<string, string> = {
        'LOGIN': 'bg-success',
        'LOGOUT': 'bg-secondary',
        'CREATE': 'bg-primary',
        'UPDATE': 'bg-warning text-dark',
        'DELETE': 'bg-danger',
        'VIEW': 'bg-info text-dark',
    };
    return clases[accion] || 'bg-light text-dark';
};

const obtenerPistas = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        const params: Record<string, any> = {
            page: currentPage.value,
            limit: limit.value,
        };
        
        if (fechaInicio.value) {
            params.fecha_inicio = fechaInicio.value;
        }
        if (fechaFin.value) {
            params.fecha_fin = fechaFin.value;
        }

        const response = await api.get('/v1/reportes/auditoria', { params });
        
        if (response.data.success) {
            pistas.value = response.data.data || [];
            pagination.value = response.data.pagination || null;
        } else {
            error.value = response.data.message || 'Error al obtener las pistas';
        }
    } catch (e: any) {
        console.error(e);
        if (e.response?.status === 403) {
            error.value = 'No tiene permisos para ver las pistas de auditoría';
        } else {
            error.value = e.response?.data?.message || 'Error al cargar las pistas de auditoría';
        }
    } finally {
        loading.value = false;
    }
};

const buscar = () => {
    currentPage.value = 1;
    obtenerPistas();
};

const limpiarFiltros = () => {
    fechaInicio.value = '';
    fechaFin.value = '';
    currentPage.value = 1;
    obtenerPistas();
};

const irAPagina = (pagina: number) => {
    if (pagina >= 1 && pagina <= (pagination.value?.total_pages || 1)) {
        currentPage.value = pagina;
        obtenerPistas();
    }
};

// Computed property para generar páginas visibles de forma eficiente
const paginasVisibles = computed(() => {
    if (!pagination.value) return [];
    
    const totalPages = pagination.value.total_pages;
    const current = currentPage.value;
    const pages: (number | string)[] = [];
    
    // Si hay 7 páginas o menos, mostrar todas
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }
    
    // Siempre mostrar primera página
    pages.push(1);
    
    // Determinar el rango de páginas alrededor de la actual
    let startPage = Math.max(2, current - 1);
    let endPage = Math.min(totalPages - 1, current + 1);
    
    // Ajustar si estamos cerca del inicio
    if (current <= 3) {
        startPage = 2;
        endPage = Math.min(4, totalPages - 1);
    }
    
    // Ajustar si estamos cerca del final
    if (current >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
        endPage = totalPages - 1;
    }
    
    // Agregar elipsis al inicio si es necesario
    if (startPage > 2) {
        pages.push('...');
    }
    
    // Agregar páginas del rango
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }
    
    // Agregar elipsis al final si es necesario
    if (endPage < totalPages - 1) {
        pages.push('...');
    }
    
    // Siempre mostrar última página si no está ya incluida en el rango
    if (endPage < totalPages) {
        pages.push(totalPages);
    }
    
    return pages;
});

onMounted(() => {
    obtenerPistas();
});
</script>

<template>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="text-primary mb-1">Reporte de Auditorías</h2>
                <p class="text-muted small mb-0">Historial de acciones realizadas en el sistema</p>
            </div>
        </div>

        <!-- Filtros -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-3">
                        <label class="form-label small text-muted">Fecha Inicio</label>
                        <input type="date" v-model="fechaInicio" class="form-control">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small text-muted">Fecha Fin</label>
                        <input type="date" v-model="fechaFin" class="form-control">
                    </div>
                    <div class="col-md-6 d-flex gap-2">
                        <button @click="buscar" class="btn btn-primary">
                            <i class="bi bi-search me-1"></i> Buscar
                        </button>
                        <button @click="limpiarFiltros" class="btn btn-outline-secondary">
                            <i class="bi bi-x-circle me-1"></i> Limpiar
                        </button>
                        <button @click="obtenerPistas" class="btn btn-outline-secondary" title="Actualizar">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Info de registros -->
        <div class="card shadow-sm border-0 mb-4 bg-light" v-if="pagination">
            <div class="card-body py-2">
                <div class="row align-items-center">
                    <div class="col">
                        <span class="text-muted small">
                            Mostrando <strong>{{ pistas.length }}</strong> de <strong>{{ pagination.total_records }}</strong> registros
                            | Página <strong>{{ pagination.current_page }}</strong> de <strong>{{ pagination.total_pages }}</strong>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Cargando pistas de auditoría...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="alert alert-danger shadow-sm">
            <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ error }}
        </div>

        <!-- Tabla -->
        <div v-else class="card shadow-sm border-0 overflow-hidden">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-light text-secondary">
                        <tr>
                            <th class="ps-3">Fecha/Hora</th>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Descripción</th>
                            <th>Función</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="pista in pistas" :key="pista.id">
                            <td class="ps-3">
                                <small class="text-muted">{{ formatearFecha(pista.fecha) }}</small>
                            </td>
                            <td>
                                <span class="fw-medium">{{ pista.usuario?.username || 'N/A' }}</span>
                            </td>
                            <td>
                                <span :class="`badge rounded-pill ${getBadgeClass(pista.accion)}`">
                                    {{ pista.accion }}
                                </span>
                            </td>
                            <td>
                                <span class="text-truncate d-inline-block" style="max-width: 300px;" :title="pista.descripcion">
                                    {{ pista.descripcion }}
                                </span>
                                <br v-if="pista.observacion">
                                <small class="text-muted" v-if="pista.observacion">{{ pista.observacion }}</small>
                            </td>
                            <td>
                                <span class="badge bg-light text-dark border">
                                    {{ pista.funcion?.nombre || 'N/A' }}
                                </span>
                            </td>
                            <td>
                                <code class="small">{{ pista.ipUsuario }}</code>
                            </td>
                        </tr>
                        <tr v-if="pistas.length === 0">
                            <td colspan="6" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                                No se encontraron pistas de auditoría.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Paginación -->
            <div class="card-footer bg-light" v-if="pagination && pagination.total_pages > 1">
                <nav>
                    <ul class="pagination pagination-sm justify-content-center mb-0">
                        <li class="page-item" :class="{ disabled: currentPage === 1 }">
                            <button class="page-link" @click="irAPagina(currentPage - 1)">Anterior</button>
                        </li>
                        <li 
                            v-for="(page, index) in paginasVisibles" 
                            :key="index" 
                            class="page-item"
                            :class="{ active: page === currentPage, disabled: page === '...' }">
                            <button 
                                class="page-link" 
                                @click="page !== '...' ? irAPagina(page as number) : null"
                                :disabled="page === '...'">
                                {{ page }}
                            </button>
                        </li>
                        <li class="page-item" :class="{ disabled: currentPage === pagination.total_pages }">
                            <button class="page-link" @click="irAPagina(currentPage + 1)">Siguiente</button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    </div>
</template>
