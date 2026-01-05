export interface Funcion {
    funcion_id: number;
    nombre: string;
}

export interface UserData {
    usuario: {
        username: string;
        email?: string;
        id_externo?: any;
    };
    modulo: {
        modulo_id: number;
        nombre: string;
        funciones: Funcion[];
    };
}