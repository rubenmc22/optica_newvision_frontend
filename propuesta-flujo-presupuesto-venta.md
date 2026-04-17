# Planificacion funcional: cambio de modelo para cristales formulados

## Objetivo

Definir la afectacion funcional de cambiar el manejo de cristales para que ya no se traten como productos separados dentro del inventario, sino como un cristal configurable cuyo precio depende del laboratorio, la combinacion elegida y el rango de formula del paciente.

La meta es alinear el sistema con la operacion real del negocio y evitar que materiales, filtros o tratamientos se manejen como productos independientes cuando en la practica forman parte de un solo cristal final.

## Cambio de enfoque

### Modelo actual

Hoy el sistema parte de esta logica:

- cristal por separado
- material por separado
- blue block por separado
- fotocromatico por separado
- otros tratamientos por separado

Eso funciona como inventario de componentes, pero no representa correctamente como compra y vende el laboratorio.

### Modelo propuesto

El nuevo enfoque seria:

- el cristal se maneja como un producto configurable, no como piezas comerciales separadas
- material y tratamientos pasan a ser opciones del cristal
- el precio sale de la combinacion completa y del laboratorio
- la formula del paciente cambia el precio por rangos tarifarios

Ejemplo de como deberia entenderse:

- cristal vision sencilla
- material policarbonato
- tratamientos blue block y fotocromatico
- rango de formula o formula del paciente
- precio final del cristal

## Principio funcional

Para cristales formulados, el sistema no deberia vender material, blue block, fotocromatico o antirreflejo como lineas separadas. Deberia registrar un cristal configurado como una unidad comercial compuesta.

Segun la respuesta del dueño, comercialmente lo usual es vender el par, pero operativamente conviene trabajarlo de forma individual. Eso significa que para una venta con montura el sistema deberia poder reflejar algo equivalente a:

- 2 cristales configurados
- 1 montura

La idea no es separar tratamientos como productos, sino permitir que el cristal conserve su configuracion completa y que el sistema pueda mostrar o controlar que el par representa dos unidades fisicas.

## Reglas del negocio ya confirmadas

Con la respuesta del dueño ya quedaron claras estas definiciones:

- la venta de cristales normalmente se hace por par
- el sistema debe poder trabajar el cristal de forma individual para reflejar 2 cristales dentro de una misma venta
- el precio depende de laboratorio, material, tratamiento y formula
- la formula se clasifica por rangos tarifarios y no solo caso a caso
- los tratamientos casi siempre vienen anclados al precio final del cristal
- algunos tratamientos especiales pueden cobrarse como extra, pero son excepciones
- existen varios laboratorios con tarifas distintas
- en un sistema administrativo completo conviene guardar costo laboratorio y precio de venta
- todos los cristales se pueden manejar por stock dentro del sistema
- para los cristales de baja rotacion o bajo pedido se puede usar un stock alto o de referencia para no bloquear la venta
- adicionalmente conviene marcar cuales configuraciones son bajo pedido para fines operativos y de seguimiento
- bajo pedido debe tratarse como una condicion interna de disponibilidad o abastecimiento, sin mezclarla con reglas de entrega al paciente

Los productos que si existen por unidad fisica y con stock seguirian en inventario normal, por ejemplo:

- monturas
- lentes de contacto por modelo
- soluciones
- accesorios
- otros productos de tienda

## Alcance del cambio

Este cambio afecta principalmente la forma en que se modelan, recomiendan, cotizan, venden y envian a laboratorio los cristales formulados.

No implica cambiar toda la logica del sistema. Implica rediseñar especificamente el flujo de cristales.

## Modulos afectados

### 1. Inventario

Nivel de afectacion: alto

Impacto funcional:

- los cristales dejarian de manejarse como productos simples de inventario por componentes
- materiales y tratamientos dejarian de ser productos vendibles por separado en el flujo de cristales
- esos elementos pasarian a ser catalogos u opciones de configuracion dentro de un tarifario
- las categorias actuales relacionadas con materiales y filtros tendrian que revisarse
- debe definirse un unico esquema de stock para todos los cristales, con apoyo de banderas operativas para bajo pedido
- la bandera de bajo pedido debe servir para clasificar disponibilidad dentro del sistema, sin meter al modulo en logica de tiempos de entrega

Decisiones necesarias:

- que categorias se mantienen como inventario real
- que categorias pasan a ser solo catalogos
- que se hace con los productos de cristales ya creados
- como se definira el stock de referencia o stock alto para cristales bajo pedido
- como se marcara operativamente que una configuracion requiere pedido a laboratorio
- como se mostrara la disponibilidad de esas configuraciones al momento de vender

### 2. Historial medico

Nivel de afectacion: medio-alto

Impacto funcional:

- la recomendacion ya no deberia pensar en productos separados para cristal, material y tratamientos
- deberia sugerir una configuracion de cristal
- la formula del paciente se vuelve parte importante del proceso porque afecta el precio final

Decisiones necesarias:

- si desde historial medico solo se sugiere la configuracion
- o si tambien se debe precargar una cotizacion aproximada

### 3. Generar venta

Nivel de afectacion: muy alto

Impacto funcional:

- ya no se venderia cristal base mas tratamientos como lineas separadas
- se venderia un bloque comercial de cristal configurado, usualmente equivalente a un par
- el sistema deberia poder reflejar operativamente 2 cristales cuando aplique
- el precio no saldria de sumar varios productos
- el sistema tendria que guardar el detalle tecnico y tarifario del cristal que se esta vendiendo

Decisiones necesarias:

- como se arma la seleccion del cristal en pantalla
- cuando se calcula el precio
- como se muestra el detalle al asesor y al paciente
- si en pantalla se mostrara como par, como 2 unidades o ambas vistas

### 4. Orden de trabajo

Nivel de afectacion: muy alto

Impacto funcional:

- la orden debe reflejar exactamente lo que se enviara al laboratorio
- debe guardar laboratorio, marca o linea de lente, material, tratamientos y rango de formula
- debe diferenciar claramente lo vendido al paciente de lo solicitado al laboratorio
- debe contemplar que varios laboratorios pueden tener tarifas distintas para configuraciones parecidas

Decisiones necesarias:

- que campos tecnicos deben verse en la orden
- como se selecciona el laboratorio
- si se guardara costo laboratorio, precio de venta o ambos

### 5. Historial de ventas

Nivel de afectacion: medio

Impacto funcional:

- las ventas nuevas de cristales ya no se verian como varias lineas separadas
- deberian verse como una sola linea con detalle de configuracion
- el detalle historico debe seguir siendo entendible

Decisiones necesarias:

- si el detalle mostrado incluira material y tratamientos como parte de la descripcion
- si se mostraran tambien los valores clinicos o solo el resumen comercial

### 6. Reportes y cierres

Nivel de afectacion: medio

Impacto funcional:

- ya no tendria sentido reportar blue block o fotocromatico como productos independientes dentro del flujo de cristales
- si se quiere medir uso de tratamientos, deberia hacerse como caracteristicas del cristal y no como productos sueltos
- los reportes deberian permitir ver ventas por laboratorio, linea de lente, material y rango de formula

Decisiones necesarias:

- como se reportaran los cristales vendidos
- si los tratamientos se mediran como atributos o como categorias comerciales

### 7. Datos ya cargados

Nivel de afectacion: alto

Impacto funcional:

- hay productos ya creados bajo el modelo anterior
- puede haber historias medicas, ventas y ordenes registradas con esa estructura

Recomendacion funcional:

- no modificar ventas historicas cerradas
- aplicar el nuevo modelo solo a operaciones nuevas
- migrar catalogos solo si hace falta, no rehacer historicos

## Impacto resumido por modulo

- inventario: alto
- historial medico: medio-alto
- generar venta: muy alto
- orden de trabajo: muy alto
- historial de ventas: medio
- reportes: medio
- datos historicos: alto
- capacitacion de usuarios: medio-alto

## Nuevo modelo funcional propuesto

### 1. Inventario real

Se mantiene para productos fisicos independientes con stock.

Ejemplos:

- monturas
- lentes de contacto por modelo
- soluciones
- accesorios

Para cristales formulados debe existir una regla adicional:

- todos los cristales se manejaran dentro del esquema de stock
- los cristales de alta rotacion pueden usar stock real controlado
- los cristales bajo pedido pueden usar stock alto o stock de referencia para permitir la operacion comercial
- ademas conviene una marca operativa para indicar que requieren solicitud a laboratorio
- esa marca sirve para distinguir inventario disponible inmediato de configuraciones que dependen de reposicion o solicitud interna

Eso permite mantener una sola logica de inventario sin convertir el cristal en servicio ni separar dos modelos tecnicos distintos.

### 2. Configurador de cristales

Se crea una logica separada para cristales formulados.

Cada cristal deberia poder configurarse con elementos como:

- laboratorio
- marca o linea del lente
- tipo de cristal
- material
- tratamientos
- formula o rango de formula
- si se vende como par con reflejo operativo de 2 unidades
- si la configuracion es stock regular o bajo pedido
- costo laboratorio y precio final, cuando aplique

### 3. Tarifario de cristales

El precio del cristal no deberia salir de sumar productos sueltos. Deberia salir de una tarifa o una cotizacion basada en:

- laboratorio
- marca o linea de lente
- combinacion del cristal
- complejidad o rango de formula
- extras puntuales, solo si el laboratorio los cobra por separado

## Formas posibles de manejar el precio

### Opcion 1. Tarifa por laboratorio, combinacion y rango

Cada laboratorio define una tarifa por linea de lente, material, tratamientos integrados y rango de formula.

Ventaja:

- se parece a como ya trabaja el negocio
- permite automatizar sin perder precision

Limite:

- requiere carga y mantenimiento del tarifario por laboratorio

### Opcion 2. Tarifa base mas extras excepcionales

La mayoria del precio viene cerrada en la tarifa principal, pero ciertos tratamientos especiales se agregan como extra solo cuando aplique.

Ventaja:

- respeta que la mayoria de tratamientos vienen incluidos
- deja margen para laboratorios que si cobran extras puntuales

Limite:

- exige definir claramente que entra en tarifa y que va como adicional

### Opcion 3. Precio manual o cotizacion manual

El asesor o encargado coloca el precio del cristal segun el caso.

Ventaja:

- flexible para excepciones

Limite:

- depende demasiado del usuario
- dificulta control y estandarizacion

### Recomendacion funcional

La mejor opcion parece ser una mezcla de:

- configuracion de cristal
- tarifario por laboratorio, combinacion y rango
- extras solo para excepciones muy puntuales
- ajuste por rango de formula
- precio manual solo para excepciones

## Fases de trabajo sugeridas

### Fase 1. Validacion del modelo con el dueno

Objetivo:

Confirmar exactamente como se compra y vende el cristal en la operacion diaria.

Entregable:

- definicion clara del nuevo modelo de cristales

Resultado de esta fase con la respuesta recibida:

- la venta se maneja principalmente por par
- la operacion debe poder reflejar 2 cristales por venta
- la formula afecta el precio por rangos
- los tratamientos normalmente vienen integrados
- existen varios laboratorios con tarifas distintas
- todos los cristales se pueden manejar bajo stock en sistema
- los casos bajo pedido deben resolverse con stock de referencia y marca operativa
- guardar costo es deseable si el sistema sera administrativo completo

### Fase 2. Redefinicion de catalogos

Objetivo:

Separar lo que es inventario real de lo que sera configuracion de cristales.

Entregable:

- lista de categorias que siguen como inventario
- lista de catalogos de cristales, materiales y tratamientos
- regla de stock de referencia para configuraciones bajo pedido
- criterio operativo para marcar configuraciones bajo pedido
- forma de mostrar disponibilidad al usuario de venta sin mezclarlo con logistica posterior

### Fase 3. Diseno del flujo operativo

Objetivo:

Definir como viaja la informacion desde historia medica hasta venta y orden de trabajo.

Entregable:

- flujo aprobado para recomendacion, cotizacion, venta y orden de trabajo

### Fase 4. Diseno del tarifario

Objetivo:

Definir como se obtendra el precio del cristal.

Entregable:

- regla clara de precio automatico
- casos de excepcion para precio manual
- definicion de unidad comercial: par con reflejo operativo individual

### Fase 5. Rediseño funcional de modulos

Objetivo:

Precisar que debe cambiar en cada pantalla o proceso.

Entregable:

- lista de ajustes funcionales por modulo

### Fase 6. Plan de transicion

Objetivo:

Evitar romper historicos o afectar la operacion actual.

Entregable:

- plan de entrada en vigencia
- reglas para convivir con datos anteriores

## Riesgos funcionales

- seguir mezclando inventario fisico con configuracion de laboratorio
- no definir bien como se calcula el precio
- usar stock sin una regla clara para diferenciar disponibilidad comercial y requerimiento real de pedido a laboratorio
- marcar demasiadas configuraciones como bajo pedido sin una regla clara de disponibilidad y generar ruido operativo innecesario
- querer automatizar el precio sin tener reglas claras del negocio
- afectar ventas historicas o reportes ya cerrados
- que el asesor no entienda cuando vende inventario normal y cuando vende un cristal configurado

## Decisiones que deben cerrarse antes de implementar

1. Como se modelaran exactamente los rangos de formula.
2. Si la unidad comercial se mostrara como par, como 2 cristales o en doble vista.
3. Que tratamientos pueden cobrarse como extra y cuales siempre van integrados.
4. Como se registrara el laboratorio en venta y orden de trabajo.
5. Como se definira el stock de referencia para cristales bajo pedido.
6. Como se mostrara la disponibilidad de un cristal bajo pedido dentro del sistema de venta.
7. Si costo laboratorio sera obligatorio u opcional.
8. Desde que fecha aplicara el nuevo modelo.

## Recomendacion final

La recomendacion funcional es esta:

1. Mantener inventario normal solo para productos fisicos independientes.
2. Sacar cristales del esquema de inventario por componentes.
3. Manejar los cristales como un producto configurable con unidad comercial por par y reflejo operativo individual.
4. Crear un tarifario por laboratorio, combinacion y rango de formula.
5. Registrar en venta y orden de trabajo toda la configuracion del cristal sin separar tratamientos como productos.
6. Manejar todos los cristales bajo una sola logica de stock, con marca operativa para bajo pedido.
7. Tratar el bajo pedido como una condicion interna de disponibilidad, no como una regla de tiempos dentro de este alcance.

## Siguiente paso sugerido

Antes de programar cualquier cambio, hace falta una validacion funcional corta con el dueno para confirmar:

- que sigue siendo inventario real
- que pasa a ser configuracion de cristal
- como se modelaran los rangos de formula
- como se definira la regla de stock alto o stock de referencia para configuraciones bajo pedido
- como se mostrara la disponibilidad de un cristal bajo pedido dentro del proceso de venta
- desde donde se armara el cristal: historial medico, venta o ambos

Una vez eso quede aprobado, ya se puede convertir esta planificacion en un plan de implementacion por etapas.
