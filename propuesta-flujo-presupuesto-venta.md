# Propuesta funcional: Presupuesto -> Venta con validacion clinica condicional

## Objetivo

Definir un flujo de conversion desde Presupuestos hacia Generar Venta que permita:

- convertir directamente presupuestos comerciales simples
- exigir soporte clinico cuando el presupuesto incluya productos que requieran formulacion
- soportar distintos origenes de formula sin obligar historia medica en todos los casos
- preparar una estructura segura para que luego backend reciba contratos claros y consistentes

## Problema actual

Hoy la conversion desde Presupuesto hacia Generar Venta se comporta como una venta de `solo_productos`.

Eso tiene dos efectos no deseados:

1. No se selecciona paciente ni historia medica aunque el presupuesto lo necesite.
2. La venta puede intentar continuar sin contexto clinico aunque haya cristales, lentes formulados o productos que deban generar orden tecnica.

## Principio rector

La conversion no debe decidirse por el origen `presupuesto`, sino por el contenido del presupuesto.

Regla central:

- si el presupuesto no requiere formulacion, puede convertirse directo a venta
- si el presupuesto requiere formulacion, debe pasar por validacion clinica antes de quedar listo para venta/orden de trabajo

La necesidad de laboratorio no se maneja como bandera primaria separada. Debe tratarse como una consecuencia operativa de ciertos items formulados ya validados.

## Motor de decision

Cada item del presupuesto debe poder evaluarse con un conjunto pequeno y estable de atributos:

- `tipoItem`
- `requiereFormula`
- `requierePaciente`
- `requiereHistoriaMedica`
- `permiteFormulaExterna`
- `requiereItemPadre` solo para addons tecnicos

Regla de mejores practicas:

- `requiereFormula` es la bandera principal de negocio
- `requiereLaboratorio` no debe ser una bandera maestra adicional en esta fase
- si en el futuro se necesita exponer `requiereOrdenTrabajo`, debe derivarse del `tipoItem` y del estado de soporte clinico, no duplicarse como verdad paralela

Reglas sugeridas:

1. Items comerciales inventariables como monturas, accesorios, repuestos, liquidos o estuches:
   - `tipoItem = inventariable`
   - `requiereFormula = false`
   - `requierePaciente = false` por defecto
   - `requiereHistoriaMedica = false`

2. Items base que representan un producto formulado para fabricar, adaptar o parametrizar:
   - `tipoItem = base_formulado`
   - `requiereFormula = true`
   - `requierePaciente = true`
   - `requiereHistoriaMedica = false` si existe formula manual o externa valida
   - `permiteFormulaExterna = true`

3. Items tecnicos seleccionables como tratamientos, filtros, materiales o acabados:
   - `tipoItem = addon_tecnico`
   - `requiereFormula = false` por si mismo
   - `requiereItemPadre = true`
   - no deben venderse solos si dependen de un item base formulado

4. Si al menos un item requiere formula:
   - la conversion completa pasa a modo `venta con soporte clinico`

5. Si un item llega sin clasificacion confiable:
   - no debe asumirse como venta comercial directa
   - debe pasar a revision manual antes de habilitar conversion automatica

## Estructura maestra segura de inventario y venta

La propuesta segura no depende solo de la categoria visual del producto. Depende de una clasificacion funcional reusable entre inventario, presupuesto, venta y orden tecnica.

### 1. Tipos maestros de item

#### `inventariable`

Uso:

- productos que pueden venderse de forma independiente
- no necesitan formula
- no dependen de otro item

Ejemplos:

- monturas
- liquidos
- estuches
- panos
- accesorios

#### `base_formulado`

Uso:

- item principal que representa lo que se formula, adapta o manda a proceso tecnico
- concentra la necesidad de soporte clinico
- puede tener addons tecnicos asociados

Ejemplos:

- cristal monofocal
- cristal bifocal
- cristal progresivo
- lente de contacto formulado

#### `addon_tecnico`

Uso:

- opcion tecnica seleccionable que complementa a un `base_formulado`
- no debe existir como linea autonoma de venta operativa cuando depende del item base
- puede ser visible al usuario como producto seleccionable, pero siempre ligado a una linea padre

Ejemplos:

- blue block
- fotocromatico
- antirreflejo
- material CR-39
- policarbonato

### 2. Reglas de modelado seguras

1. Una familia comercial no define por si sola si un item requiere formula.
2. La misma familia puede tener variantes formuladas y no formuladas.
3. Los lentes de contacto deben permitir ambos casos:
   - variante comercial sin formula
   - variante formulada con soporte clinico
4. Los tratamientos y materiales no deben obligar a crear un producto final por cada combinacion posible.
5. El sistema debe componer una linea tecnica a partir de:
   - un `base_formulado`
   - cero o mas `addon_tecnico`
6. Si el negocio quiere mostrar filtros o materiales como items independientes en UI, internamente deben quedar vinculados a un item padre.

### 3. Estructura funcional minima por linea de venta

Cada linea que viaje desde presupuesto hacia venta deberia poder expresar, como minimo:

- `lineaKey`
- `productoId`
- `descripcion`
- `tipoItem`
- `requiereFormula`
- `cantidad`
- `precioUnitario`
- `lineaPadreKey` opcional
- `configuracionTecnica` opcional
- `origenClinico` opcional

Con esto se cubren dos escenarios reales sin inflar el modelo:

- linea comercial simple
- linea tecnica compuesta por un item base mas addons asociados

## Estados funcionales de conversion

### 1. Venta comercial

Aplica cuando ningun item requiere formula.

Comportamiento:

- convierte directo a Generar Venta
- no exige paciente
- no exige historia medica
- mantiene cliente y productos del presupuesto

### 2. Venta con soporte clinico

Aplica cuando existe al menos un item con formula.

Comportamiento:

- no puede quedar lista sin origen de formula valido
- debe asociar paciente si la operacion lo requiere
- debe definir si existe historia medica o formula valida externa/manual
- debe habilitar orden de trabajo/proceso tecnico solo cuando el soporte clinico este completo

## Origenes de formula permitidos

El sistema debe manejar estos origenes de formula:

1. `historia_interna_optometrista`
2. `historia_interna_oftalmologo`
3. `formula_manual_desde_lente_actual`
4. `formula_externa`

## Reglas por escenario de negocio

### Escenario 1: Consulta gratis con optometrista en tienda

Condicion:

- el paciente ya fue atendido en tienda
- existe historia medica interna

Regla:

- convertir con paciente sugerido
- cargar historias del paciente
- sugerir la historia mas reciente con formula completa
- permitir cambio manual de historia si hay varias

### Escenario 2: Consulta pagada con oftalmologo en tienda

Condicion:

- el paciente ya fue atendido por oftalmologo
- existe historia medica interna

Regla:

- mismo flujo que escenario 1
- adicionalmente, si el negocio lo necesita, puede validarse estado de pago o estatus de consulta antes de habilitar el proceso tecnico

### Escenario 3: El asesor lee la formula desde el lente/cristal actual

Condicion:

- no necesariamente existe historia medica interna
- la formula es capturada desde lo que porta el paciente

Regla:

- permitir venta con soporte clinico sin historia interna obligatoria
- exigir captura manual de formula
- marcar el origen como `manual`
- no registrar esto automaticamente como historia medica formal

### Escenario 4: Formula externa de otro medico

Condicion:

- la prescripcion no proviene del sistema interno

Regla:

- permitir venta con soporte clinico sin historia interna obligatoria
- exigir captura de formula externa
- guardar metadatos minimos:
  - nombre del medico o centro
  - fecha de formula si existe
  - observacion opcional
  - adjunto opcional en fase posterior

## Flujo recomendado al pulsar "Convertir a venta"

### Caso A: Presupuesto comercial

1. El usuario pulsa `Convertir a venta`.
2. El sistema detecta que no hay productos formulados.
3. Navega directo a Generar Venta.
4. Precarga cliente y productos.

### Caso B: Presupuesto con requerimiento clinico

1. El usuario pulsa `Convertir a venta`.
2. El sistema detecta items con formula.
3. Se abre un paso intermedio `Validacion clinica para venta`.
4. El usuario selecciona el origen de formula.
5. Segun la opcion elegida:
   - historia interna: paciente + historia sugerida/seleccionada
   - formula manual: captura manual
   - formula externa: captura externa
6. Solo despues de completar esto se navega a Generar Venta.

## Comportamiento esperado en Generar Venta

### Si la conversion es comercial

- abrir en modo equivalente a `solo_productos`
- precargar cliente y productos
- no mostrar bloqueo por historia medica

### Si la conversion requiere soporte clinico

- no abrir como `solo_productos` puro
- debe llegar con uno de estos estados:
  - paciente + historia sugerida
  - paciente + historias para elegir
  - formula manual pendiente/completada
  - formula externa pendiente/completada

### Regla de habilitacion

La orden de trabajo/proceso tecnico solo puede habilitarse cuando:

- exista formula valida para los productos que la exigen
- existan datos minimos operativos para ejecutar el proceso tecnico

## Contrato funcional minimo entre Presupuesto y Generar Venta

El draft de conversion ya no deberia enviar solo cliente y productos. Debe incluir contexto clinico suficiente y clasificacion funcional consistente.

Campos sugeridos:

- `origenPresupuesto`
- `cliente`
- `lineas`
- `requiereSoporteClinico`
- `requiereProcesoTecnico`
- `pacienteId` opcional
- `pacienteCedula` opcional
- `historiaId` opcional
- `origenFormula` opcional
- `formulaManual` opcional
- `formulaExterna` opcional
- `observaciones`
- `lineasConRequerimientoClinico`
- `estadoValidacionClinica`

Nota de implementacion:

- `requiereProcesoTecnico` debe calcularse a partir de las lineas clasificadas y no depender de texto libre o de categorias legacy
- los contratos JSON exactos pueden definirse despues, cuando esta estructura quede aprobada

## UX sugerida

### Modal de conversion

Si el presupuesto no requiere formula:

- mensaje: `Este presupuesto puede cargarse directamente a venta.`

Si el presupuesto requiere formula:

- mensaje: `Este presupuesto incluye items que requieren formulacion. Antes de continuar debes indicar el origen de la formula.`

Opciones del modal/paso:

1. `Usar historia clinica existente`
2. `Registrar formula externa`
3. `Capturar formula manual desde lente actual`

### Banner en Generar Venta

Si llega sin soporte clinico resuelto y lo necesita:

- mostrar alerta superior fija
- texto sugerido: `Esta venta incluye items formulados. Debes completar el soporte clinico antes de generar orden de trabajo.`

## Reglas de bloqueo

### Bloquear conversion directa a venta completa cuando:

- el presupuesto requiere formula y no existe origen de formula definido
- hay paciente requerido pero no identificado
- hay historia interna requerida pero ninguna historia valida disponible
- existen addons tecnicos sin item padre valido

### Permitir continuar con advertencia cuando:

- la venta es comercial y no necesita proceso tecnico
- la formula manual o externa esta completa aunque no exista historia interna

## Mejores practicas de implementacion

1. Centralizar la clasificacion funcional en una sola utilidad compartida entre presupuesto y venta.
2. No decidir comportamiento clinico leyendo nombres de categoria renderizados en pantalla.
3. Mantener compatibilidad hacia atras mediante adaptadores mientras el backend siga plano.
4. Validar en modo defensivo: si falta clasificacion, no habilitar conversion automatica plena.
5. Evitar duplicar verdad entre `producto`, `linea de venta` y `draft de conversion`; la linea derivada debe ser la fuente operativa.
6. Separar claramente reglas de negocio de reglas de UI para que el flujo sea testeable.
7. Tratar `addon_tecnico` como hijo de un `base_formulado`, aunque en interfaz se seleccione como item independiente.
8. Introducir la estructura por fases, sin reventar primero la compatibilidad del flujo comercial simple.

## Recomendacion de implementacion por fases

### Fase 0

- definir tabla maestra de clasificacion funcional
- mapear categorias actuales a `tipoItem` y `requiereFormula`
- identificar productos ambiguos que requieran revision manual

### Fase 1

- mover la deteccion a una utilidad compartida
- ampliar draft entre modulos con `lineas` y estado clinico minimo
- mantener compatibilidad con el flujo actual de venta comercial

### Fase 2

- agregar paso intermedio de validacion clinica
- soportar historia interna, formula manual y formula externa
- soportar lineas padre/hijo para addons tecnicos

### Fase 3

- adjuntos para formula externa
- reglas mas finas por categoria de producto
- sugerencia automatica de paciente por cedula
- sugerencia automatica de historia mas reciente valida

### Fase 4

- trazabilidad completa proceso tecnico -> origen de formula
- reportes de ventas comerciales vs ventas clinicas
- definicion final de contratos JSON para backend

## Decision recomendada

Implementar la opcion 2: `conversion inteligente con fallback`, con una compuerta clinica condicional.

Resumen:

- Presupuesto sin productos formulados: conversion directa
- Presupuesto con productos formulados: conversion asistida con validacion clinica
- Historia medica no obligatoria en todos los casos
- Formula valida si obligatoria para cualquier item `base_formulado`
- Tratamientos y materiales modelados como `addon_tecnico`, no como producto final combinado

## Resultado esperado

Con este enfoque se logra:

- menos friccion para presupuestos simples
- control operativo para el proceso tecnico
- coherencia entre venta comercial y venta clinica
- soporte real para los 4 escenarios del negocio