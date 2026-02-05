<script setup lang="ts">
import { computed, ref } from 'vue';
// @ts-ignore
import vSelect from 'vue-select';
import 'vue-select/dist/vue-select.css';
import type { Cuenta } from '@/types/BankingTypes';

const props = defineProps<{
    modelValue: string;
    cuentas: Cuenta[];
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    required?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'select', cuenta: Cuenta | null): void;
}>();

// Computed para encontrar la cuenta seleccionada actual por código
const selectedCuenta = computed(() => {
    if (!props.modelValue) return null;
    return props.cuentas.find(c => c.codigo === props.modelValue) || null;
});

// Handler cuando se selecciona una cuenta
const onSelect = (cuenta: Cuenta | null) => {
    emit('update:modelValue', cuenta?.codigo || '');
    emit('select', cuenta);
};

// Estado de búsqueda
const searchQuery = ref('');

// Handler cuando el usuario escribe
const onSearch = (query: string) => {
    searchQuery.value = query;
};

// Handler al perder foco: intentar seleccionar por código exacto
const onSearchBlur = () => {
    if (!props.modelValue && searchQuery.value) {
        const val = searchQuery.value.trim();
        const exactMatch = props.cuentas.find(c => c.codigo === val);
        if (exactMatch) {
            onSelect(exactMatch);
        }
    }
};

// Función de filtro personalizada que cumple con Vue Select v4
const filterCuentas = (options: Cuenta[], search: string) => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(option => {
        const bancoNombre = option.entidad_bancaria?.nombre || '';
        return (
            option.codigo.toLowerCase().includes(searchLower) ||
            bancoNombre.toLowerCase().includes(searchLower)
        );
    });
};

// Función para etiqueta (mejora accesibilidad y filtrado)
const getOptionLabel = (option: Cuenta) => {
    const banco = option.entidad_bancaria?.nombre || 'Banco desconocido';
    return `${option.codigo} - ${banco}`;
};
</script>

<template>
    <div class="cuenta-autocomplete">
        <label v-if="label" class="form-label fw-bold">
            <i class="bi bi-bank2 me-1" aria-hidden="true"></i>{{ label }}
        </label>
        <vSelect :modelValue="selectedCuenta" @update:modelValue="onSelect" :options="cuentas" :filterable="true"
            :filter="filterCuentas" @search="onSearch" @search:blur="onSearchBlur" :get-option-label="getOptionLabel"
            :placeholder="placeholder || 'Buscar cuenta...'" :disabled="disabled" :clearable="true"
            class="cuenta-select">
            <!-- Slot para cada opción en el dropdown -->
            <template #option="{ codigo, entidad_bancaria }">
                <div class="cuenta-option">
                    <div class="cuenta-codigo">{{ codigo }}</div>
                    <div class="cuenta-banco">{{ entidad_bancaria?.nombre || 'Banco desconocido' }}</div>
                </div>
            </template>

            <!-- Slot para el valor seleccionado (Diseño limpio y simple) -->
            <template #selected-option="{ codigo }">
                <div class="cuenta-selected-simple">
                    {{ codigo }}
                </div>
            </template>

            <!-- Slot cuando no hay resultados -->
            <template #no-options="{ search }">
                <div class="no-options">
                    <i class="bi bi-search me-2"></i>
                    <span v-if="search">No se encontró "{{ search }}"</span>
                    <span v-else>Escriba código o banco...</span>
                </div>
            </template>
        </vSelect>

        <!-- Placeholder para mantener altura constante del componente -->
        <div class="form-text mt-1" :class="selectedCuenta ? 'text-success' : 'invisible'">
            <template v-if="selectedCuenta">
                <i class="bi bi-check-circle me-1"></i>
                Banco: <strong>{{ selectedCuenta.entidad_bancaria?.nombre }}</strong>
            </template>
            <template v-else>Seleccione una Cuenta</template>
        </div>
    </div>
</template>

<style scoped>
.cuenta-autocomplete {
    width: 100%;
}

/* Opciones del dropdown */
.cuenta-option {
    padding: 6px 8px;
    border-bottom: 1px solid #f8f9fa;
}

.cuenta-option:last-child {
    border-bottom: none;
}

.cuenta-codigo {
    font-weight: 600;
    color: #0d6efd;
    font-size: 0.9rem;
}

.cuenta-banco {
    color: #495057;
    font-size: 0.85rem;
}

/* Valor seleccionado (Minimalista) */
.cuenta-selected-simple {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #212529;
    font-size: 1rem;
}

/* Estilos de vue-select para igualar Bootstrap form-control */
:deep(.vs__dropdown-toggle) {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    padding: 0 0.75rem;
    height: 38px;
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

:deep(.vs__clear) {
    fill: #dc3545;
    margin-right: 4px;
}

:deep(.vs__open-indicator) {
    fill: #6c757d;
}

/* Estilos adicionales para dropdown menu */
:deep(.vs__dropdown-menu) {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0;
}

:deep(.vs__dropdown-option--highlight) {
    background: rgba(13, 110, 253, 0.08);
    color: inherit;
}
</style>
