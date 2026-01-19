export interface EntidadBancaria {
  id: number
  nombre: string
}

export interface Cuenta {
  codigo: string
  nombre_cuenta: string
  estado: boolean
  id_entidad_bancaria?: number
  descripcion?: string
  entidad_bancaria?: { nombre: string }
  created_at?: string
}
