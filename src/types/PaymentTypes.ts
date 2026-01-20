import type { Cuenta } from './BankingTypes';

export interface DetallePago {
    id?: number;
    numero_factura: string;
    monto_pagar: number; // Nota: El backend espera 'monto_pagar' en el request
    monto_pagado?: number; // El backend devuelve 'monto_pagado' en el response
    saldo_anterior?: number; // Saldo antes del pago (del backend)
    saldo_nuevo?: number; // Saldo después del pago (del backend)
}

// Estado ahora booleano: true = activo, false = inactivo
export interface Pago {
    numero_pago: string;
    cedula_cliente: string;
    nombre_cliente?: string;
    codigo_cuenta: string;
    cuenta_bancaria?: Cuenta;
    descripcion: string;
    fecha: string;
    // monto_total se calcula en el frontend si no lo trae el backend
    monto_total?: number;

    estado: boolean;
    fecha_impresion?: string | null;
    detalles: DetallePago[];
}

export interface PagoPayload {
    cedula_cliente: string;
    codigo_cuenta: string;
    descripcion: string;
    fecha: string;
    detalles: DetallePago[];
}