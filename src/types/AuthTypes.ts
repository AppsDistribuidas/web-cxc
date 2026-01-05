// Define cómo es el usuario que viene del API
export interface ApiUser {
    username: string;
    email: string;
    dni: string;
}

// Define la función (permiso)
export interface Funcion {
    funcion_id: number;
    nombre: string;
}

// Define el módulo
export interface Modulo {
    modulo_id: number;
    nombre: string;
    funciones: Funcion[];
}

// --- ESTADO GLOBAL ---
export interface UserData extends ApiUser {
    modulo: Modulo;
}