<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
// @ts-ignore
import vSelect from 'vue-select';
import 'vue-select/dist/vue-select.css';

interface Cliente {
    cedula: string;
    nombre: string;
}

const props = defineProps<{
    modelValue: string;
    clientes: Cliente[];
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    required?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'select', cliente: Cliente | null): void;
}>();

// Generar ID único para accesibilidad
const uid = `cliente-select-${Math.random().toString(36).substr(2, 9)}`;

// Computed para encontrar el cliente seleccionado actual
const selectedCliente = computed(() => {
    if (!props.modelValue) return null;
    return props.clientes.find(c => c.cedula === props.modelValue) || null;
});

// Handler cuando se selecciona un cliente
const onSelect = (cliente: Cliente | null) => {
    emit('update:modelValue', cliente?.cedula || '');
    emit('select', cliente);
};

// Estado de búsqueda
const searchQuery = ref('');

// Handler cuando el usuario escribe
const onSearch = (query: string) => {
    searchQuery.value = query;
};

// Handler al perder foco: intentar seleccionar por cédula exacta si no hay selección
const onSearchBlur = () => {
    if (!props.modelValue && searchQuery.value) {
        const val = searchQuery.value.trim();
        // Buscar coincidencia exacta por cédula
        const exactMatch = props.clientes.find(c => c.cedula === val);
        if (exactMatch) {
            onSelect(exactMatch);
        }
    }
};

// Función de filtro personalizada que cumple con Vue Select v4
// Firma requerida: (options: Option[], search: string) => Option[]
const filterClientes = (options: Cliente[], search: string) => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(option =>
        option.cedula.toLowerCase().includes(searchLower) ||
        (option.nombre || '').toLowerCase().includes(searchLower)
    );
};

// Función para obtener etiqueta (mejora accesibilidad y filtrado)
const getOptionLabel = (option: Cliente) => {
    return `${option.cedula} - ${option.nombre}`;
};
</script>

<template>
    <div class="cliente-autocomplete">
        <label v-if="label" :for="uid" class="form-label fw-bold">
            <i class="bi bi-person-fill me-1" aria-hidden="true"></i>{{ label }}
        </label>
        <vSelect :inputId="uid" :modelValue="selectedCliente" @update:modelValue="onSelect" :options="clientes"
            :filterable="true" :filter="filterClientes" @search="onSearch" @search:blur="onSearchBlur"
            :get-option-label="getOptionLabel" :placeholder="placeholder || 'Escriba cédula o nombre...'"
            :disabled="disabled" :clearable="true" class="cliente-select" :class="{ 'has-selection': selectedCliente }"
            aria-label="Buscar cliente por cédula o nombre">
            <!-- Slot para cada opción en el dropdown -->
            <template #option="{ cedula, nombre }">
                <div class="cliente-option">
                    <div class="cliente-cedula">{{ cedula }}</div>
                    <div class="cliente-nombre">{{ nombre }}</div>
                </div>
            </template>

            <!-- Slot para el valor seleccionado (Diseño simple tipo input) -->
            <template #selected-option="{ cedula, nombre }">
                <div class="cliente-selected-simple">
                    {{ cedula }}
                </div>
            </template>

            <!-- Slot cuando no hay resultados -->
            <template #no-options="{ search }">
                <div class="no-options">
                    <i class="bi bi-search me-2"></i>
                    <span v-if="search">No se encontró "{{ search }}"</span>
                    <span v-else>Escriba para buscar...</span>
                </div>
            </template>
        </vSelect>

        <!-- Placeholder para mantener altura constante del componente -->
        <div class="form-text mt-1" :class="selectedCliente ? 'text-success' : 'invisible'">
            <template v-if="selectedCliente">
                <i class="bi bi-check-circle me-1"></i>
                Cliente: <strong>{{ selectedCliente.nombre }}</strong>
            </template>
            <template v-else>Seleccione un Cliente</template>
        </div>
    </div>
</template>

<style scoped>
.cliente-autocomplete {
    width: 100%;
}

/* Opciones del dropdown (Mantener diseño rico para la lista) */
.cliente-option {
    padding: 6px 8px;
    border-bottom: 1px solid #f8f9fa;
}

.cliente-option:last-child {
    border-bottom: none;
}

.cliente-cedula {
    font-weight: 600;
    color: #0d6efd;
    font-size: 0.9rem;
}

.cliente-nombre {
    color: #495057;
    font-size: 0.85rem;
}

/* Valor seleccionado (Minimalista) */
.cliente-selected-simple {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #212529;
    /* Color texto estándar */
    font-size: 1rem;
}

/* Estilos globales de vue-select para igualar form-control de Bootstrap */
:deep(.vs__dropdown-toggle) {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    padding: 0 0.75rem;
    /* Padding horizontal solamente, vertical controlado por flex */
    height: 38px;
    /* Altura fija igual a bootstrap form-control */
    min-height: 38px;
    background-color: #fff;
    display: flex;
    align-items: center;
    transition: border-color .15s ease-in-out, box-shadow .15s ease-in-out;
}

:deep(.vs__dropdown-toggle:focus-within) {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

:deep(.vs__selected-options) {
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
    align-items: center;
    width: 100%;
}

:deep(.vs__search) {
    margin: 0;
    padding: 0;
    color: #212529;
}

:deep(.vs__search::placeholder) {
    color: #6c757d;
}

:deep(.vs__actions) {
    padding-top: 0;
}

/* Ajuste del botón X */
:deep(.vs__clear) {
    fill: #dc3545;
    /* Rojo suave para borrar */
    margin-right: 4px;
}

:deep(.vs__open-indicator) {
    fill: #6c757d;
}

/* Ocultar chevron cuando hay selección - solo mostrar X para borrar */
/* Ocultar chevron cuando hay selección - solo mostrar X para borrar */
.has-selection :deep(.vs__open-indicator) {
    display: none;
}

/* Estado de error: borde rojo cuando el componente tiene clase is-invalid */
.cliente-autocomplete.is-invalid :deep(.vs__dropdown-toggle) {
    border-color: #dc3545;
}

/* Mejora de contraste en Hover/Highlight */
:deep(.vs__dropdown-option--highlight) {
    background: #0d6efd;
    /* Azul primario */
    color: #fff;
}

:deep(.vs__dropdown-option--highlight) .cliente-cedula,
:deep(.vs__dropdown-option--highlight) .cliente-nombre {
    color: #fff !important;
}
</style>
