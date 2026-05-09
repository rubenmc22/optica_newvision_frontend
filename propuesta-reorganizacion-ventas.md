# Propuesta de reorganizacion del modulo de ventas

## Objetivo

Reorganizar el frontend del dominio de ventas para mejorar:

- mantenibilidad
- navegacion
- rendimiento percibido
- claridad de responsabilidades
- facilidad de crecimiento futuro

Sin tocar backend ni contratos API existentes.

## Diagnostico actual

La estructura actual funciona, pero tiene cuatro problemas principales:

1. La ruta ventas actua como contenedor unico de cuatro submodulos grandes.
2. La navegacion interna depende de query params y estado local, no de rutas hijas reales.
3. Los componentes principales son demasiado grandes y mezclan UI, reglas, integraciones y handoffs.
4. Los flujos entre historia medica, presupuesto y generar venta dependen de sessionStorage como mecanismo principal.

## Criterio de diseno

La nueva estructura debe cumplir esto:

- Ventas sigue siendo el dominio padre.
- Cada submodulo debe tener URL propia.
- El usuario puede entrar desde Ventas y tambien aterrizar directo en un submodulo.
- Los handoffs deben centralizarse en un flujo formal del frontend.
- La UX debe seguir siendo rapida y operativa.
- La migracion debe poder hacerse por fases sin romper el sistema actual.

## Estructura de rutas propuesta

```text
/ventas
/ventas/resumen
/ventas/generar
/ventas/presupuestos
/ventas/presupuestos/nuevo
/ventas/presupuestos/:id
/ventas/historial
/ventas/cierres
/ventas/cierres/:fecha
/ventas/rendimiento
```

## Comportamiento esperado por ruta

### /ventas

Landing operativa del dominio.

Debe mostrar:

- resumen rapido
- accesos a generar venta
- accesos a presupuestos
- accesos a historial
- accesos a cierres
- indicadores de negocio rapidos

No debe montar los cuatro modulos completos al mismo tiempo.

### /ventas/generar

Pantalla exclusiva para generar venta.

Debe soportar origen opcional:

- desde historia medica
- desde presupuesto
- desde cliente manual

### /ventas/presupuestos

Listado y gestion de presupuestos.

Debe permitir:

- crear
- editar
- renovar
- convertir a venta
- imprimir
- enviar correo

### /ventas/historial

Pantalla exclusiva de historial de ventas.

Debe concentrar:

- filtros
- resumenes
- pagos
- edicion puntual
- recibos
- exportaciones

### /ventas/cierres

Pantalla exclusiva de cierre de caja.

Debe separar visualmente:

- cierre operativo actual
- historial de cierres
- exportaciones
- impresion y envio

### /ventas/rendimiento

Pantalla analitica separada.

No debe depender del shell principal de ventas.

## Estructura de carpetas propuesta

```text
src/app/view/ventas/
  shell/
    ventas-shell.component.ts
    ventas-shell.component.html
    ventas-shell.component.scss
    ventas-summary.component.ts
    ventas-summary.component.html
    ventas-summary.component.scss
  generar-venta/
    page/
      generar-venta-page.component.ts
      generar-venta-page.component.html
      generar-venta-page.component.scss
    components/
      venta-header/
      venta-paciente-panel/
      venta-carrito/
      venta-pagos/
      venta-resumen/
      venta-historias-relacionadas/
    services/
      generar-venta-facade.service.ts
      generar-venta-ui.service.ts
  presupuesto/
    page/
      presupuesto-page.component.ts
      presupuesto-page.component.html
      presupuesto-page.component.scss
    components/
      presupuesto-toolbar/
      presupuesto-list/
      presupuesto-card/
      presupuesto-form-modal/
      presupuesto-detalle-modal/
      presupuesto-correo-dialog/
    services/
      presupuesto-facade.service.ts
    models/
      presupuesto.interfaz.ts
    utils/
      presupuesto-report.util.ts
  historial-ventas/
    page/
      historial-ventas-page.component.ts
      historial-ventas-page.component.html
      historial-ventas-page.component.scss
    components/
      historial-filtros/
      historial-tabla/
      historial-resumen/
      historial-pago-modal/
      historial-detalle-modal/
    services/
      historial-ventas-facade.service.ts
  cierre-caja/
    page/
      cierre-caja-page.component.ts
      cierre-caja-page.component.html
      cierre-caja-page.component.scss
    components/
      cierre-resumen/
      cierre-conciliacion/
      cierre-transacciones/
      cierre-historial/
      cierre-exportacion/
    services/
      cierre-caja-facade.service.ts
    utils/
      cierre-caja-report.util.ts
  rendimiento-comercial/
    page/
      rendimiento-comercial-page.component.ts
      rendimiento-comercial-page.component.html
      rendimiento-comercial-page.component.scss
  shared/
    services/
      ventas-flow.service.ts
      ventas-context.service.ts
    models/
      venta-interfaz.ts
    utils/
      payment-catalog.util.ts
      receipt-html.util.ts
      venta-item-classification.util.ts
    handoff/
      presupuesto-venta-handoff.util.ts
      historia-venta-handoff.util.ts
      historia-presupuesto-handoff.util.ts
```

## Responsabilidades por capa

### Shell de ventas

Responsable de:

- layout comun del dominio ventas
- tabs o menu local del modulo
- breadcrumbs
- resumen corto
- router-outlet de subrutas

No debe contener logica de negocio de generar, presupuestos, historial o cierre.

### Page components

Responsables de:

- orquestacion de la pantalla
- lectura de query params o params
- coordinacion con facade
- apertura de modales principales

No deben contener calculos grandes ni transformaciones complejas.

### Components

Responsables de:

- UI puntual y eventos
- formularios locales
- render de tablas, cards, filtros y modales

No deben llamar directamente multiples servicios de negocio si puede evitarse.

### Facade services

Responsables de:

- coordinar servicios existentes
- manejar estado de pantalla
- exponer observables o signals de UI
- encapsular flujo de carga, guardado y transformacion

Esta capa reduce el peso de los componentes gigantes.

### Shared flow services

Responsables de:

- handoff entre historia, presupuesto y venta
- estado temporal de navegacion
- persistencia transitoria cuando sea necesaria

La idea es que sessionStorage quede como respaldo, no como centro del flujo.

## Reglas de navegacion propuestas

### Desde dashboard principal

- Ir a generar venta: /ventas/generar
- Ir a historial: /ventas/historial
- Ir a presupuestos: /ventas/presupuestos
- Ir a cierres: /ventas/cierres
- Ir a rendimiento: /ventas/rendimiento

### Desde historia medica

- Generar venta desde historia: navegar a /ventas/generar con un flow state controlado
- Crear presupuesto desde historia: navegar a /ventas/presupuestos/nuevo con contexto precargado

### Desde presupuesto

- Convertir a venta: navegar a /ventas/generar con draft formalizado

## Patron de estado recomendado

Sin cambiar backend, hay dos opciones validas:

### Opcion recomendada

Usar facades por submodulo y un service de flujo compartido.

Ventajas:

- bajo impacto
- facil migracion incremental
- poco riesgo
- suficiente para el tamaño actual del sistema

### Opcion mas robusta

Migrar el estado de ventas a store formal.

Ejemplos:

- NgRx ComponentStore
- Signal Store
- NgRx completo si el equipo ya lo domina

Para este proyecto yo no pisaria NgRx completo de entrada. Empezaria con facades y services de flujo.

## Estructura de menu para el cliente final

Dentro de ventas, el cliente deberia ver una navegacion clara y directa:

- Resumen
- Nueva venta
- Presupuestos
- Historial
- Cierre de caja
- Rendimiento

Esto mantiene el concepto de que presupuesto depende del dominio ventas, pero evita que parezca una pestaña escondida dentro de una pantalla unica.

## Beneficios esperados

### Modernidad

- URLs claras
- navegacion mas predecible
- arquitectura por dominio
- mejor separacion de responsabilidades

### Eficiencia tecnica

- menos carga simultanea de componentes enormes
- menor acoplamiento por estado escondido
- mas facil lazy loading futuro
- pruebas mas localizadas

### Facilidad para el cliente final

- acceso directo a cada pantalla
- menos confusion de contexto
- posibilidad de compartir rutas internas exactas
- menor riesgo de perder estado al cambiar entre areas

## Plan de migracion por fases

### Fase 1

Crear la estructura de rutas sin cambiar logica interna pesada.

- crear ventas shell
- registrar rutas hijas
- mover ventas-dashboard a rol de resumen o shell temporal
- mantener componentes actuales casi intactos

### Fase 2

Separar navegacion y handoffs.

- reemplazar query param vista por rutas reales
- crear ventas-flow.service
- encapsular sessionStorage
- adaptar dashboard e historia medica a rutas nuevas

### Fase 3

Partir los componentes mas grandes.

Prioridad sugerida:

1. presupuesto
2. generar venta
3. cierre de caja
4. historial de ventas

### Fase 4

Optimizar UX y rendimiento.

- carga diferida de paneles pesados
- resolver filtros y tablas grandes
- unificar modales y dialogs
- revisar accesibilidad y consistencia visual

## Recomendacion final

La mejor decision no es sacar presupuesto fuera de ventas como dominio, sino dejarlo dentro de ventas con identidad propia de ruta.

En resumen:

- si a que presupuesto pertenezca a ventas
- no a que dependa de una sola pantalla contenedora con tabs internas y componentes gigantes vivos

La estructura objetivo correcta para este proyecto es:

- ventas como dominio padre
- submodulos con rutas hijas reales
- shell liviano
- facades por submodulo
- flujo compartido formal para historia, presupuesto y venta
