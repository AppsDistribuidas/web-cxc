<script setup lang="ts">
import { computed } from 'vue';
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

// Función de filtro personalizada
const filterClientes = (option: Cliente, label: string, search: string) => {
    const searchLower = search.toLowerCase();
    return (
        option.cedula.toLowerCase().includes(searchLower) ||
        (option.nombre || '').toLowerCase().includes(searchLower)
    );
};
</script>

<template>
    <div class="cliente-autocomplete">
        <label v-if="label" class="form-label fw-bold">
            <i class="bi bi-person-fill me-1" aria-hidden="true"></i>{{ label }}
        </label>
        <vSelect :modelValue="selectedCliente" @update:modelValue="onSelect" :options="clientes" :filterable="true"
            :filter="filterClientes" :placeholder="placeholder || 'Escriba cédula o nombre...'" :disabled="disabled"
            :clearable="true" label="cedula" class="cliente-select">
            <!-- Slot para cada opción en el dropdown -->
            <template #option="{ cedula, nombre }">
                <div class="cliente-option">
                    <div class="cliente-cedula">{{ cedula }}</div>
                    <div class="cliente-nombre">{{ nombre }}</div>
                </div>
            </template>

            <!-- Slot para el valor seleccionado -->
            <template #selected-option="{ cedula, nombre }">
                <div class="cliente-selected">
                    <span class="cedula">{{ cedula }}</span>
                    <span class="separator">-</span>
                    <span class="nombre">{{ nombre }}</span>
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
    </div>
</template>

<style scoped>
.cliente-autocomplete {
    width: 100%;
}

/* Opciones del dropdown */
.cliente-option {
    padding: 8px 4px;
    border-bottom: 1px solid #f0f0f0;
}

.cliente-option:last-child {
    border-bottom: none;
}

.cliente-cedula {
    font-weight: 600;
    color: #0d6efd;
    font-size: 0.95rem;
}

.cliente-nombre {
    color: #6c757d;
    font-size: 0.85rem;
    margin-top: 2px;
}

/* Valor seleccionado */
.cliente-selected {
    display: flex;
    align-items: center;
    gap: 6px;
}

.cliente-selected .cedula {
    font-weight: 600;
    color: #1a1a2e;
}

.cliente-selected .separator {
    color: #adb5bd;
}

.cliente-selected .nombre {
    color: #495057;
    font-size: 0.9rem;
}

/* Sin resultados */
.no-options {
    padding: 12px;
    text-align: center;
    color: #6c757d;
}

/* Estilos globales de vue-select (deep) */
:deep(.vs__dropdown-toggle) {
    border: 1px solid #ced4da;
    border-radius: 0.375rem;
    padding: 6px 10px;
    min-height: 38px;
}

:deep(.vs__dropdown-toggle:focus-within) {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

:deep(.vs__search) {
    margin: 0;
    padding: 0;
}

:deep(.vs__search::placeholder) {
    color: #6c757d;
}

:deep(.vs__dropdown-menu) {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    padding: 0;
}

:deep(.vs__dropdown-option) {
    padding: 0;
}

:deep(.vs__dropdown-option--highlight) {
    background: rgba(13, 110, 253, 0.08);
}

:deep(.vs__clear) {
    fill: #6c757d;
}

:deep(.vs__open-indicator) {
    fill: #6c757d;
}

:deep(.vs--disabled .vs__dropdown-toggle) {
    background-color: #e9ecef;
    cursor: not-allowed;
}

:deep(.vs--disabled .vs__search) {
    background-color: transparent;
}
</style>
