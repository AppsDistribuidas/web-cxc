<script setup lang="ts">
import api from '@/api/axios';
import { ref, computed, onMounted, watch } from 'vue';

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

const allPistas = ref<PistaAuditoria[]>([]);
const pistas = ref<PistaAuditoria[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Paginación
const pagination = ref<Pagination | null>(null);
const currentPage = ref(1);
const limit = ref(15);

// Filtros de API (se envían al servidor para filtrar todos los registros)
const filtroFechaInicio = ref('');
const filtroFechaFin = ref('');

// Filtros locales (se aplican sobre los resultados de la página actual)
const filtroUsuario = ref('');
const filtroAccion = ref<'all' | 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE'>('all');
const filtroDescripcion = ref('');
const filtroFuncion = ref('');
const filtroIP = ref('');

// Ordenamiento
const sortBy = ref<string | null>('fecha');
const sortDir = ref<'asc' | 'desc'>('desc');

const toggleSort = (key: string) => {
    if (sortBy.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortDir.value = 'asc';
    }
    aplicarFiltrosLocales();
};

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

const aplicarFiltrosLocales = () => {
    let resultado = allPistas.value.slice();

    // Filtro por usuario (parcial)
    if (filtroUsuario.value.trim()) {
        const q = filtroUsuario.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.usuario?.username ?? '').toLowerCase().includes(q));
    }

    // Filtro por acción
    if (filtroAccion.value !== 'all') {
        resultado = resultado.filter(p => p.accion === filtroAccion.value);
    }

    // Filtro por descripción (parcial)
    if (filtroDescripcion.value.trim()) {
        const q = filtroDescripcion.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.descripcion ?? '').toLowerCase().includes(q));
    }

    // Filtro por función (parcial)
    if (filtroFuncion.value.trim()) {
        const q = filtroFuncion.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.funcion?.nombre ?? '').toLowerCase().includes(q));
    }

    // Filtro por IP (parcial)
    if (filtroIP.value.trim()) {
        const q = filtroIP.value.trim().toLowerCase();
        resultado = resultado.filter(p => (p.ipUsuario ?? '').toLowerCase().includes(q));
    }

    // Ordenamiento
    if (sortBy.value) {
        resultado.sort((a: any, b: any) => {
            let aVal: string;
            let bVal: string;

            // Manejar campos anidados
            if (sortBy.value === 'usuario') {
                aVal = (a.usuario?.username ?? '').toString();
                bVal = (b.usuario?.username ?? '').toString();
            } else if (sortBy.value === 'funcion') {
                aVal = (a.funcion?.nombre ?? '').toString();
                bVal = (b.funcion?.nombre ?? '').toString();
            } else {
                aVal = (a[sortBy.value!] ?? '').toString();
                bVal = (b[sortBy.value!] ?? '').toString();
            }

            // Para fechas, comparar como fechas
            if (sortBy.value === 'fecha') {
                const dateA = new Date(aVal).getTime() || 0;
                const dateB = new Date(bVal).getTime() || 0;
                return sortDir.value === 'asc' ? dateA - dateB : dateB - dateA;
            }

            return sortDir.value === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }

    pistas.value = resultado;
};

const obtenerPistas = async () => {
    loading.value = true;
    error.value = null;

    try {
        const params: Record<string, any> = {
            page: currentPage.value,
            limit: limit.value,
        };

        // Enviar filtros de fecha a la API
        if (filtroFechaInicio.value) {
            params.fecha_inicio = filtroFechaInicio.value;
        }
        if (filtroFechaFin.value) {
            params.fecha_fin = filtroFechaFin.value;
        }

        const response = await api.get('/v1/reportes/auditoria', { params });

        if (response.data.success) {
            allPistas.value = response.data.data || [];
            pagination.value = response.data.pagination || null;
            aplicarFiltrosLocales();
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

const limpiarFiltros = () => {
    // Limpiar filtros de API
    filtroFechaInicio.value = '';
    filtroFechaFin.value = '';
    // Limpiar filtros locales
    filtroUsuario.value = '';
    filtroAccion.value = 'all';
    filtroDescripcion.value = '';
    filtroFuncion.value = '';
    filtroIP.value = '';
    currentPage.value = 1;
    obtenerPistas();
};

// Función para buscar con los filtros de fecha (recarga desde API)
const buscarPorFecha = () => {
    currentPage.value = 1;
    obtenerPistas();
};



// Watch para aplicar filtros locales automáticamente con debounce
let timeout: ReturnType<typeof setTimeout>;
watch([filtroUsuario, filtroAccion, filtroDescripcion, filtroFuncion, filtroIP], () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        aplicarFiltrosLocales();
    }, 300);
});

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
    if (startPage > 3) {
        pages.push('...');
    }

    // Agregar páginas del rango
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    // Agregar elipsis al final si es necesario
    if (endPage < totalPages - 2) {
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

        <!-- Filtros de fecha y controles -->
        <div class="card shadow-sm border-0 mb-4 bg-light">
            <div class="card-body py-2">
                <div class="row align-items-center g-2">
                    <div class="col-auto">
                        <div class="d-flex align-items-center gap-2">
                            <label class="form-label mb-0 small text-muted">Desde:</label>
                            <input type="date" v-model="filtroFechaInicio" class="form-control form-control-sm"
                                style="width: 140px;">
                            <label class="form-label mb-0 small text-muted">Hasta:</label>
                            <input type="date" v-model="filtroFechaFin" class="form-control form-control-sm"
                                style="width: 140px;">
                            <button @click="buscarPorFecha" class="btn btn-primary btn-sm">
                                <i class="bi bi-search"></i> Buscar
                            </button>
                        </div>
                    </div>
                    <div class="col text-end">
                        <button @click="limpiarFiltros" class="btn btn-outline-secondary btn-sm me-2"
                            title="Limpiar filtros">
                            <i class="bi bi-x-circle"></i> Limpiar
                        </button>
                        <button @click="obtenerPistas" class="btn btn-outline-secondary btn-sm" title="Actualizar">
                            <i class="bi bi-arrow-clockwise"></i> Refrescar
                        </button>
                    </div>
                </div>
                <div class="row mt-2" v-if="pagination">
                    <div class="col">
                        <span class="text-muted small">
                            Mostrando <strong>{{ pistas.length }}</strong> de <strong>{{ pagination.total_records
                                }}</strong> registros
                            | Página <strong>{{ pagination.current_page }}</strong> de <strong>{{ pagination.total_pages
                                }}</strong>
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
                            <th class="ps-3" @click="toggleSort('fecha')" style="cursor:pointer">Fecha/Hora <small
                                    v-if="sortBy === 'fecha'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('usuario')" style="cursor:pointer">Usuario <small
                                    v-if="sortBy === 'usuario'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('accion')" style="cursor:pointer">Acción <small
                                    v-if="sortBy === 'accion'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('descripcion')" style="cursor:pointer">Descripción <small
                                    v-if="sortBy === 'descripcion'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('funcion')" style="cursor:pointer">Función <small
                                    v-if="sortBy === 'funcion'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                            <th @click="toggleSort('ipUsuario')" style="cursor:pointer">IP <small
                                    v-if="sortBy === 'ipUsuario'">{{ sortDir === 'asc' ? '▲' : '▼' }}</small></th>
                        </tr>
                        <!-- Filter row -->
                        <tr class="bg-white">
                            <th class="ps-3">
                                <!-- Fecha se filtra arriba -->
                            </th>
                            <th>
                                <input v-model="filtroUsuario" class="form-control form-control-sm"
                                    placeholder="Usuario">
                            </th>
                            <th>
                                <select v-model="filtroAccion" class="form-select form-select-sm">
                                    <option value="all">Todas</option>
                                    <option value="LOGIN">LOGIN</option>
                                    <option value="LOGOUT">LOGOUT</option>
                                    <option value="CREATE">CREATE</option>
                                    <option value="UPDATE">UPDATE</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="ACTIVATE">ACTIVATE</option>
                                </select>
                            </th>
                            <th>
                                <input v-model="filtroDescripcion" class="form-control form-control-sm"
                                    placeholder="Descripción">
                            </th>
                            <th>
                                <input v-model="filtroFuncion" class="form-control form-control-sm"
                                    placeholder="Función">
                            </th>
                            <th>
                                <input v-model="filtroIP" class="form-control form-control-sm" placeholder="IP">
                            </th>
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
                                <span class="text-truncate d-inline-block" style="max-width: 300px;"
                                    :title="pista.descripcion">
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
                        <li v-for="(page, index) in paginasVisibles" :key="index" class="page-item"
                            :class="{ active: page === currentPage, disabled: page === '...' }">
                            <button class="page-link" @click="page !== '...' ? irAPagina(page as number) : null"
                                :disabled="page === '...'" :aria-label="page === '...' ? 'Más páginas' : undefined">
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
