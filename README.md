# Portal Web - Sistema de Cuentas por Cobrar (CxC)

## 🎯 Problema de Negocio que Resuelve

En muchas empresas, el equipo de finanzas, ventas y administración interactúa con múltiples sistemas o planillas de Excel para hacer seguimiento a los pagos de los clientes, lo que dificulta la comunicación y propicia los errores humanos.

Este **Portal Web de Cuentas por Cobrar (Frontend)** es la interfaz orientada al usuario que resuelve el problema de la fragmentación visual y operativa. Permite al personal de la empresa:
- **Gestión visual intuitiva:** Operar todo el ciclo de ingresos (cuentas bancarias, entidades, clientes y pagos) desde una única pantalla moderna y accesible.
- **Reducción de errores manuales:** Facilita la carga de detalles de pago y la validación de montos mediante interfaces claras que se comunican directamente con la lógica central de negocio.
- **Acceso a la información en tiempo real:** Ofrece a los tomadores de decisiones reportes y vistas rápidas sobre el estado del flujo de caja, los pagos procesados y los pagos pendientes, mejorando la velocidad de respuesta comercial.

---

## 🛠 Tecnologías Utilizadas

Este proyecto es una aplicación web moderna construida con tecnologías ágiles y de alto rendimiento:

- **Empaquetador/Build Tool:** [Vite](https://vitejs.dev/) (Rápido y eficiente)
- **Lenguaje Principal:** [TypeScript](https://www.typescriptlang.org/) para un tipado estricto y un código más seguro.
- **Pruebas Unitarias:** [Vitest](https://vitest.dev/)
- **Pruebas E2E (End-to-End):** [Cypress](https://www.cypress.io/)
- **Linter y Formateo:** ESLint y Prettier.

## 🚀 Requisitos Previos

Asegúrate de tener instalado en tu entorno de desarrollo local:
- [Node.js](https://nodejs.org/) (se recomienda versión LTS)
- Un gestor de paquetes (`npm`, `yarn`, `pnpm` o `bun`)

## ⚙️ Instalación y Ejecución

1. **Clonar/Navegar a la carpeta del proyecto:**
   ```bash
   cd web-cxc
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Ejecutar en servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   *El servidor de desarrollo iniciará por lo general en `http://localhost:5173/` con Hot Module Replacement (HMR).*

4. **Construir para Producción:**
   ```bash
   npm run build
   ```
   Esto generará una carpeta `dist/` lista para ser desplegada en un servidor web estático.

## 🧪 Pruebas (Testing)

El proyecto cuenta con un entorno de pruebas robusto.

- **Pruebas Unitarias (Vitest):**
  ```bash
  npm run test:unit
  ```
  *(o el script correspondiente definido en `package.json`)*

- **Pruebas End-to-End (Cypress):**
  ```bash
  npm run test:e2e
  ```
  *(o el script correspondiente definido en `package.json`)*

## 📄 Licencia

Este proyecto es de uso exclusivo o licenciado bajo los términos que defina la empresa o propietario del software.
