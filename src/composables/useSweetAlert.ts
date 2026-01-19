import Swal from 'sweetalert2'

export function useSweetAlert() {
  const showSuccess = (message: string, title: string = '¡Éxito!') => {
    return Swal.fire({
      icon: 'success',
      title,
      text: message,
      confirmButtonText: 'OK',
      confirmButtonColor: '#198754',
    })
  }

  const showError = (message: string, title: string = 'Error') => {
    return Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonText: 'OK',
      confirmButtonColor: '#dc3545',
    })
  }

  const showWarning = (message: string, title: string = 'Advertencia') => {
    return Swal.fire({
      icon: 'warning',
      title,
      text: message,
      confirmButtonText: 'OK',
      confirmButtonColor: '#856404',
    })
  }

  const showConfirm = async (message: string, title: string = '¿Estás seguro?') => {
    const result = await Swal.fire({
      icon: 'question',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    })

    return result.isConfirmed
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showConfirm,
  }
}
