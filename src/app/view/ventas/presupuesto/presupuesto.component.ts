import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ClienteService } from './../../clientes/clientes.services';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-presupuesto',
  standalone: false,
  templateUrl: './presupuesto.component.html',
  styleUrls: ['./presupuesto.component.scss']
})

export class PresupuestoComponent implements OnInit {
  @ViewChild('clienteCedulaInput') clienteCedulaInput!: ElementRef;

  // Variables principales
  mostrarModalNuevoPresupuesto: boolean = false;
  mostrarModalDetallePresupuesto: boolean = false;
  mostrarModalEliminar: boolean = false;

  filtroBusqueda: string = '';
  filtroEstado: string = '';
  tabActiva: string = 'vigentes';
  diasParaAutoArchivo: number = 30;

  // En tu componente
  terminoBusqueda: string = '';
  productosFiltrados: any[] = [];

  // Nuevo presupuesto
  nuevoPresupuesto: any = {
    codigo: '',
    cliente: this.getClienteVacio(),
    fechaCreacion: new Date(),
    fechaVencimiento: new Date(),
    diasVencimiento: 7,
    vendedor: '',
    productos: [],
    subtotal: 0,
    iva: 0,
    total: 0,
    observaciones: '',
    estado: 'vigente'
  };

  // Variables para validación de cliente (usando tu estructura)
  validandoCliente: boolean = false;
  clienteEncontrado: boolean = false;
  validacionIntentada: boolean = false;
  mensajeValidacionCliente: string = '';
  cedulaAnterior: string = '';
  clienteSinPaciente = this.getClienteVacio();

  // Presupuesto seleccionado para detalle/edición
  presupuestoSeleccionado: any = null;
  presupuestoAEliminar: any = null;

  // Opciones
  opcionesVencimiento = [
    { valor: 7, texto: '7 días' },
    { valor: 10, texto: '10 días' },
    { valor: 20, texto: '20 días' },
    { valor: 30, texto: '30 días' }
  ];

  // Datos
  presupuestosVigentes: any[] = [];
  presupuestosVencidos: any[] = [];
  productosDisponibles: any[] = [];

  // Estadísticas
  estadisticas = {
    totalVigentes: 0,
    totalVencidos: 0,
    totalValor: 0,
    proximosAVencer: 0
  };

  // Modal para agregar producto
  mostrarModalAgregarProducto: boolean = false;
  busquedaProducto: string = '';

  constructor(
    private clienteService: ClienteService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.cargarDatos();
    this.inicializarNuevoPresupuesto();
  }

  // ========== MÉTODOS PARA CLIENTE (usando tu código existente) ==========

  getClienteVacio() {
    return {
      tipoPersona: 'natural',
      cedula: '',
      nombreCompleto: '',
      telefono: '',
      email: '',
      direccion: '',
      razonSocial: ''
    };
  }

  inicializarNuevoPresupuesto() {
    this.nuevoPresupuesto = {
      codigo: '',
      cliente: this.getClienteVacio(),
      fechaCreacion: new Date(),
      fechaVencimiento: new Date(),
      diasVencimiento: 7,
      vendedor: '',
      productos: [],
      subtotal: 0,
      iva: 0,
      total: 0,
      observaciones: '',
      estado: 'vigente'
    };
    this.clienteSinPaciente = this.getClienteVacio();
    this.resetearEstadoValidacionCliente();
  }

  resetearEstadoValidacionCliente() {
    this.validandoCliente = false;
    this.clienteEncontrado = false;
    this.validacionIntentada = false;
    this.mensajeValidacionCliente = '';
    this.cedulaAnterior = '';
  }

  onTipoPersonaChange(): void {
    if (this.clienteSinPaciente.tipoPersona === 'juridica') {
      this.clienteSinPaciente.nombreCompleto = '';
      this.clienteSinPaciente.razonSocial = '';
    } else {
      this.clienteSinPaciente.razonSocial = '';
    }
    this.actualizarClienteEnPresupuesto();
    this.cdr.detectChanges();
  }

  actualizarClienteEnPresupuesto() {
    this.nuevoPresupuesto.cliente = { ...this.clienteSinPaciente };
  }

  onCedulaBlur(): void {
    const cedula = this.clienteSinPaciente.cedula?.trim();
    const tipoPersona = this.clienteSinPaciente.tipoPersona;

    if (!cedula) {
      return;
    }

    if (!this.validarCedula(cedula, tipoPersona)) {
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
      return;
    }

    if (cedula.length >= 4) {
      this.validarClientePorCedula();
    }
  }

  forzarValidacionCliente(): void {
    const cedula = this.clienteSinPaciente.cedula?.trim();

    if (!cedula) {
      this.mensajeValidacionCliente = 'Ingrese una cédula o RIF para validar';
      return;
    }

    if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
      return;
    }

    this.validarClientePorCedula();
  }

  async validarClientePorCedula(): Promise<void> {
    const cedula = this.clienteSinPaciente.cedula?.trim();

    // Validaciones básicas
    if (!cedula) {
      this.mensajeValidacionCliente = 'Ingrese una cédula o RIF para validar';
      this.validacionIntentada = false;
      return;
    }

    if (!this.validarCedula(cedula, this.clienteSinPaciente.tipoPersona)) {
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
      this.validacionIntentada = false;
      return;
    }

    // Guardar la cédula actual por si necesitamos restaurarla
    const cedulaActual = this.clienteSinPaciente.cedula;

    // Iniciar validación
    this.validandoCliente = true;
    this.clienteEncontrado = false;
    this.validacionIntentada = false;
    this.mensajeValidacionCliente = '🔍 Buscando cliente en la base de datos...';
    this.cdr.detectChanges();

    try {
      const respuesta = await lastValueFrom(this.clienteService.buscarPorCedula(cedula));

      // MARCAR QUE LA VALIDACIÓN SE INTENTÓ
      this.validacionIntentada = true;

      if (respuesta.cliente) {
        this.clienteEncontrado = true;
        this.mensajeValidacionCliente = '✅ Cliente encontrado - Datos autocompletados';
        this.autocompletarDatosCliente(respuesta.cliente);

        this.snackBar.open('Cliente encontrado - Datos autocompletados', 'Cerrar', {
          duration: 3000,
          panelClass: ['snackbar-success']
        });
      } else {
        this.clienteEncontrado = false;
        this.mensajeValidacionCliente = 'Cliente no encontrado - Complete los datos manualmente';

        this.limpiarCamposCliente();
        this.clienteSinPaciente.cedula = cedulaActual;

        this.snackBar.open('Cliente no encontrado. Complete los datos manualmente.', 'Cerrar', {
          duration: 4000,
          panelClass: ['snackbar-info']
        });
      }

    } catch (error: any) {
      this.validacionIntentada = true;
      this.clienteEncontrado = false;
      this.mensajeValidacionCliente = '⚠️ Error al conectar con el servidor';

      this.limpiarCamposCliente();
      this.clienteSinPaciente.cedula = cedulaActual;

      let mensajeError = 'Error al validar cliente. Verifique su conexión.';
      if (error.error?.message) {
        mensajeError = error.error.message;
      } else if (error.message) {
        mensajeError = error.message;
      }

      this.snackBar.open(mensajeError, 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });

    } finally {
      this.validandoCliente = false;
      this.cdr.detectChanges();
    }
  }

  autocompletarDatosCliente(cliente: any) {
    this.clienteSinPaciente = {
      tipoPersona: cliente.tipoPersona || 'natural',
      cedula: cliente.cedula || '',
      nombreCompleto: cliente.nombreCompleto || cliente.nombre || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      razonSocial: cliente.razonSocial || ''
    };
    this.actualizarClienteEnPresupuesto();
  }

  limpiarCamposCliente() {
    const cedulaActual = this.clienteSinPaciente.cedula;
    this.clienteSinPaciente = this.getClienteVacio();
    this.clienteSinPaciente.cedula = cedulaActual;
    this.actualizarClienteEnPresupuesto();
  }

  onCedulaChange(): void {
    const cedula = this.clienteSinPaciente.cedula;
    const tipoPersona = this.clienteSinPaciente.tipoPersona;

    // Resetear estado de validación anterior solo si cambia la cédula
    if (cedula !== this.cedulaAnterior) {
      this.clienteEncontrado = false;
      this.mensajeValidacionCliente = '';
      this.validacionIntentada = false;
      this.cedulaAnterior = cedula;
    }

    if (!this.validarCedula(cedula, tipoPersona)) {
      this.mensajeValidacionCliente = this.getMensajeErrorCedula();
    } else {
      this.mensajeValidacionCliente = '';
    }

    this.actualizarEstadoValidacion();
  }

  validarCedula(cedula: string, tipoPersona: string): boolean {
    if (!cedula || cedula.trim() === '') return false;

    const cedulaLimpia = cedula.trim();

    if (tipoPersona === 'juridica') {
      // Para persona jurídica (RIF): J-123456789
      const rifRegex = /^[JjVGgEe]-?\d{7,9}$/;
      if (!rifRegex.test(cedulaLimpia)) return false;

      // Si no tiene la J al inicio, agregarla automáticamente
      if (!cedulaLimpia.toUpperCase().startsWith('J')) {
        this.clienteSinPaciente.cedula = 'J-' + cedulaLimpia.replace(/[^0-9]/g, '');
        this.actualizarClienteEnPresupuesto();
      }
      return true;
    } else {
      // Para persona natural: solo números, máximo 8 dígitos
      const cedulaRegex = /^\d{1,8}$/;
      return cedulaRegex.test(cedulaLimpia);
    }
  }

  getMensajeErrorCedula(): string {
    const cedula = this.clienteSinPaciente.cedula;
    const tipoPersona = this.clienteSinPaciente.tipoPersona;

    if (!cedula || cedula.trim() === '') {
      return 'La cédula/RIF es obligatorio';
    }

    if (tipoPersona === 'juridica') {
      return 'Formato RIF inválido. Ej: J-123456789';
    } else {
      return 'Cédula inválida. Solo números, máximo 8 dígitos';
    }
  }

  getEstadoCampoCedula(): { valido: boolean, mensaje: string } {
    const cedula = this.clienteSinPaciente.cedula;
    const tipoPersona = this.clienteSinPaciente.tipoPersona;
    if (!cedula || cedula.trim() === '') {
      return { valido: false, mensaje: 'La cédula/RIF es obligatorio' };
    }
    return {
      valido: this.validarCedula(cedula, tipoPersona),
      mensaje: this.getMensajeErrorCedula()
    };
  }

  getTooltipBotonValidar(): string {
    if (this.validandoCliente) {
      return 'Buscando cliente...';
    } else if (this.clienteEncontrado) {
      return 'Cliente encontrado - Click para re-validar';
    } else if (this.validacionIntentada && !this.clienteEncontrado) {
      return 'Cliente no encontrado - Complete los datos manualmente';
    } else if (!this.clienteSinPaciente.cedula) {
      return 'Ingrese una cédula para buscar';
    } else if (!this.validarCedula(this.clienteSinPaciente.cedula, this.clienteSinPaciente.tipoPersona)) {
      return 'Cédula inválida - Corrija el formato';
    } else if (this.clienteSinPaciente.cedula.length < 4) {
      return 'Ingrese al menos 4 caracteres para buscar';
    } else {
      return 'Buscar cliente en base de datos';
    }
  }

  getClaseBotonValidar(): string {
    let baseClass = 'btn-validar-cedula';

    if (this.validandoCliente) {
      return `${baseClass} validando`;
    } else if (this.clienteEncontrado) {
      return `${baseClass} encontrado`;
    } else if (this.validacionIntentada && !this.clienteEncontrado) {
      return `${baseClass} no-encontrado`;
    } else {
      return `${baseClass} default`;
    }
  }

  onNombreChange(): void {
    this.actualizarClienteEnPresupuesto();
    this.onCampoEditadoManualmente();
  }

  onTelefonoBlur(): void {
    const telefono = this.clienteSinPaciente.telefono;
    if (telefono) {
      this.clienteSinPaciente.telefono = this.formatearTelefono(telefono);
      this.actualizarClienteEnPresupuesto();
    }
  }

  onTelefonoChange(): void {
    this.actualizarClienteEnPresupuesto();
    this.onCampoEditadoManualmente();
  }

  onEmailChange(): void {
    this.actualizarClienteEnPresupuesto();
    this.onCampoEditadoManualmente();
  }

  onCampoEditadoManualmente(): void {
    this.clienteEncontrado = false;
    this.validacionIntentada = false;
  }

  actualizarEstadoValidacion(): void {
    this.cdr.detectChanges();
  }

  formatearTelefono(telefono: string): string {
    const limpio = telefono.replace(/\D/g, '');

    // Si comienza con 58 (código de Venezuela)
    if (limpio.startsWith('58')) {
      return `+${limpio}`;
    }

    // Si tiene 11 dígitos (04121234567)
    if (limpio.length === 11) {
      return `+58${limpio.slice(1)}`;
    }

    // Si tiene 10 dígitos (4121234567)
    if (limpio.length === 10) {
      return `+58${limpio}`;
    }

    return telefono;
  }

  // ========== MÉTODOS PARA PRESUPUESTOS ==========

  cargarDatos() {
    // Cargar datos iniciales
    this.cargarPresupuestos();
    this.cargarProductos();
  }

  cargarPresupuestos() {
    // Simular carga de datos
    setTimeout(() => {
      this.presupuestosVigentes = [
        {
          id: 1,
          codigo: 'P-2025-001',
          cliente: {
            tipoPersona: 'natural',
            cedula: '12345678',
            nombreCompleto: 'Ruben Darío Martínez Castro',
            telefono: '+5841223920817',
            email: 'ruben.martinez@email.com',
            direccion: 'Las rosas, conj res, country villas'
          },
          fechaCreacion: new Date('2025-06-11'),
          fechaVencimiento: new Date('2025-06-25'),
          diasVencimiento: 14,
          vendedor: '12332',
          productos: [
            {
              descripcion: '758684-RETRO-0',
              codigo: '758684-RETRO-0',
              precio: 1108.23,
              cantidad: 1,
              descuento: 0,
              total: 1108.23
            }
          ],
          subtotal: 1108.23,
          iva: 177.32,
          total: 1285.55,
          observaciones: '',
          estado: 'vigente',
          diasRestantes: 14,
          estadoColor: 'vigente'
        }
      ];
      this.calcularEstadisticas();
    }, 500);
  }

  cargarProductos() {
    // Simular productos disponibles
    this.productosDisponibles = [
      { id: 1, codigo: '758684-RETRO-0', descripcion: '758684-RETRO-0', precio: 1108.23, categoria: 'Lentes' },
      { id: 2, codigo: 'PR-000001', descripcion: 'Lente Progresivo Essilor', precio: 850.00, categoria: 'Lentes' },
      { id: 3, codigo: 'PR-000042', descripcion: 'Armazón Ray-Ban', precio: 320.50, categoria: 'Armazones' },
      { id: 4, codigo: 'PR-000027', descripcion: 'Lente Fotocromático', precio: 720.00, categoria: 'Lentes' },
      { id: 5, codigo: 'PR-000045', descripcion: 'Armazón Oakley', precio: 450.00, categoria: 'Armazones' },
      { id: 6, codigo: 'PR-000038', descripcion: 'Lente Blue Filter', precio: 380.00, categoria: 'Lentes' },
      { id: 7, codigo: 'PR-000015', descripcion: 'Lente Antirreflejo', precio: 550.00, categoria: 'Lentes' }
    ];
  }

  // ========== MÉTODOS PARA PRODUCTOS ==========
  // Método unificado para buscar/filtrar productos
  filtrarProductos(termino?: string) {
    const busqueda = termino || this.terminoBusqueda;

    if (!busqueda) {
      this.productosFiltrados = [];
      return;
    }

    const terminoBusqueda = busqueda.toLowerCase();
    this.productosFiltrados = this.productosDisponibles.filter(producto =>
      producto.descripcion.toLowerCase().includes(terminoBusqueda) ||
      producto.codigo.toLowerCase().includes(terminoBusqueda)
    );
  }

  // Método de compatibilidad para el HTML antiguo
  buscarProductos(termino: string): any[] {
    if (!termino) {
      return this.productosDisponibles;
    }

    const busqueda = termino.toLowerCase();
    return this.productosDisponibles.filter(producto =>
      producto.descripcion.toLowerCase().includes(busqueda) ||
      producto.codigo.toLowerCase().includes(busqueda)
    );
  }

  eliminarProducto(index: number) {
    this.nuevoPresupuesto.productos.splice(index, 1);
    this.calcularTotales();
  }

  actualizarCantidad(producto: any, nuevaCantidad: number) {
    if (nuevaCantidad > 0) {
      producto.cantidad = nuevaCantidad;
      producto.total = producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100);
      this.calcularTotales();
    }
  }

  actualizarDescuento(producto: any, nuevoDescuento: number) {
    if (nuevoDescuento >= 0 && nuevoDescuento <= 100) {
      producto.descuento = nuevoDescuento;
      producto.total = producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100);
      this.calcularTotales();
    }
  }

  // ========== MÉTODOS PARA MODALES ==========
  abrirModalNuevoPresupuesto() {
    this.mostrarModalNuevoPresupuesto = true;
    this.inicializarNuevoPresupuesto();
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
  }

  cerrarModalNuevoPresupuesto() {
    this.mostrarModalNuevoPresupuesto = false;
    this.inicializarNuevoPresupuesto();
    // Restaurar scroll del body
    document.body.classList.remove('modal-open');
  }

  abrirModalAgregarProducto() {
    this.mostrarModalAgregarProducto = true;
    this.busquedaProducto = '';
    this.buscarProductos('');
  }

  cerrarModalAgregarProducto() {
    this.mostrarModalAgregarProducto = false;
    this.busquedaProducto = '';
  }

  verDetallePresupuesto(presupuesto: any) {
    this.presupuestoSeleccionado = { ...presupuesto };
    this.mostrarModalDetallePresupuesto = true;
  }

  cerrarModalDetalle() {
    this.mostrarModalDetallePresupuesto = false;
    this.presupuestoSeleccionado = null;
  }

  guardarCambiosPresupuesto() {
    if (!this.presupuestoSeleccionado) return;

    // Simular actualización
    const index = this.presupuestosVigentes.findIndex(p => p.id === this.presupuestoSeleccionado.id);
    if (index !== -1) {
      this.presupuestosVigentes[index] = { ...this.presupuestoSeleccionado };
      this.snackBar.open('Presupuesto actualizado correctamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });
    }
    this.cerrarModalDetalle();
  }

  confirmarEliminarPresupuesto(presupuesto: any) {
    this.presupuestoAEliminar = presupuesto;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.presupuestoAEliminar = null;
  }

  eliminarPresupuesto() {
    if (!this.presupuestoAEliminar) return;

    if (this.tabActiva === 'vigentes') {
      this.presupuestosVigentes = this.presupuestosVigentes.filter(p => p.id !== this.presupuestoAEliminar.id);
    } else {
      this.presupuestosVencidos = this.presupuestosVencidos.filter(p => p.id !== this.presupuestoAEliminar.id);
    }

    this.calcularEstadisticas();
    this.cerrarModalEliminar();
    this.snackBar.open('Presupuesto eliminado correctamente', 'Cerrar', {
      duration: 3000,
      panelClass: ['snackbar-success']
    });
  }

  // ========== UTILIDADES ==========

  cambiarTab(tab: string) {
    this.tabActiva = tab;
  }

  seleccionarDiasVencimiento(dias: number) {
    this.nuevoPresupuesto.diasVencimiento = dias;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    this.nuevoPresupuesto.fechaVencimiento = fecha;
  }

  generarPresupuesto() {
    if (!this.nuevoPresupuesto.cliente.cedula || !this.nuevoPresupuesto.cliente.nombreCompleto) {
      this.snackBar.open('Complete los datos del cliente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    if (this.nuevoPresupuesto.productos.length === 0) {
      this.snackBar.open('Agregue al menos un producto', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    // Generar código
    const nuevoCodigo = `P-${new Date().getFullYear()}-${(this.presupuestosVigentes.length + this.presupuestosVencidos.length + 1).toString().padStart(3, '0')}`;
    this.nuevoPresupuesto.codigo = nuevoCodigo;
    this.nuevoPresupuesto.id = this.presupuestosVigentes.length + 1;

    // Agregar a la lista
    this.presupuestosVigentes.push({ ...this.nuevoPresupuesto });
    this.calcularEstadisticas();
    this.cerrarModalNuevoPresupuesto();

    this.snackBar.open(`Presupuesto ${nuevoCodigo} generado exitosamente`, 'Cerrar', {
      duration: 4000,
      panelClass: ['snackbar-success']
    });
  }

  getEstadoColor(diasRestantes: number): string {
    if (diasRestantes < 0) return 'vencido';
    if (diasRestantes === 0) return 'hoy';
    if (diasRestantes <= 3) return 'proximo';
    return 'vigente';
  }

  getEstadoTexto(estadoColor: string): string {
    const estados = {
      'vigente': 'Vigente',
      'proximo': 'Próximo a vencer',
      'hoy': 'Vence hoy',
      'vencido': 'Vencido'
    };
    return estados[estadoColor] || 'Vigente';
  }

  formatFecha(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatMoneda(valor: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

  calcularEstadisticas() {
    this.estadisticas.totalVigentes = this.presupuestosVigentes.length;
    this.estadisticas.totalVencidos = this.presupuestosVencidos.length;

    const totalVigentes = this.presupuestosVigentes.reduce((sum, p) => sum + p.total, 0);
    const totalVencidos = this.presupuestosVencidos.reduce((sum, p) => sum + p.total, 0);
    this.estadisticas.totalValor = totalVigentes + totalVencidos;

    this.estadisticas.proximosAVencer = this.presupuestosVigentes.filter(p => p.diasRestantes! <= 3).length;
  }

  filtrarPresupuestos() {
    this.calcularEstadisticas();
  }

  exportarExcel() {
    this.snackBar.open('Funcionalidad de exportación en desarrollo', 'Cerrar', {
      duration: 3000,
      panelClass: ['snackbar-info']
    });
  }

  convertirAVenta(presupuesto: any) {
    if (confirm(`¿Convertir el presupuesto ${presupuesto.codigo} en una venta/orden de trabajo?`)) {
      this.snackBar.open(`Presupuesto ${presupuesto.codigo} convertido a venta`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });
      // Aquí redirigir al módulo de ventas
    }
  }

  renovarPresupuesto(presupuesto: any) {
    if (confirm(`¿Renovar el presupuesto ${presupuesto.codigo} por 7 días más?`)) {
      // Mover de vencidos a vigentes
      this.presupuestosVencidos = this.presupuestosVencidos.filter(p => p.id !== presupuesto.id);
      presupuesto.fechaVencimiento = new Date(new Date().setDate(new Date().getDate() + 7));
      presupuesto.diasRestantes = 7;
      presupuesto.estadoColor = 'vigente';
      this.presupuestosVigentes.push(presupuesto);

      this.calcularEstadisticas();
      this.snackBar.open(`Presupuesto ${presupuesto.codigo} renovado por 7 días`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });
    }
  }

  // Agregar estos métodos al componente

  actualizarProductoDetalle(index: number) {
    const producto = this.presupuestoSeleccionado!.productos[index];
    producto.total = producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100);
    this.calcularTotalesDetalle();
  }

  eliminarProductoDetalle(index: number) {
    this.presupuestoSeleccionado!.productos.splice(index, 1);
    this.calcularTotalesDetalle();
  }

  abrirModalAgregarProductoDetalle() {
    // Implementar lógica para agregar producto en edición
  }

  calcularTotalesDetalle() {
    if (!this.presupuestoSeleccionado) return;

    this.presupuestoSeleccionado.subtotal = this.presupuestoSeleccionado.productos.reduce((sum: number, producto: any) =>
      sum + producto.total, 0);

    this.presupuestoSeleccionado.iva = this.presupuestoSeleccionado.subtotal * 0.16;
    this.presupuestoSeleccionado.total = this.presupuestoSeleccionado.subtotal + this.presupuestoSeleccionado.iva;
  }

  onFechaVencimientoChange(event: any) {
    const fecha = new Date(event.target.value);
    this.presupuestoSeleccionado!.fechaVencimiento = fecha;

    // Calcular días restantes
    const hoy = new Date();
    const diasRestantes = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    this.presupuestoSeleccionado!.diasRestantes = diasRestantes;
    this.presupuestoSeleccionado!.estadoColor = this.getEstadoColor(diasRestantes);
  }

  // Agrega este método a tu clase PresupuestoComponent
  imprimirPresupuesto(presupuesto: any) {
    console.log('🖨️ Imprimiendo presupuesto:', presupuesto);

    // Aquí puedes implementar la lógica de impresión
    // Por ejemplo, abrir una ventana de impresión o generar PDF

    // Simulación de impresión
    const contenidoImpresion = `
    ==================================
           NEW VISION LENS 2020
    ==================================
    
    PRESUPUESTO: ${presupuesto.codigo}
    Fecha: ${this.formatFecha(new Date())}
    
    CLIENTE:
    ${presupuesto.cliente.nombreCompleto}
    ${presupuesto.cliente.cedula}
    Tel: ${presupuesto.cliente.telefono}
    
    VENDEDOR: ${presupuesto.vendedor}
    
    PRODUCTOS:
    ==================================
    ${presupuesto.productos.map((p: any, i: number) =>
      `${i + 1}. ${p.descripcion} - ${p.cantidad} x ${this.formatMoneda(p.precio)} = ${this.formatMoneda(p.total)}`
    ).join('\n')}
    
    ==================================
    Subtotal: ${this.formatMoneda(presupuesto.subtotal)}
    IVA (16%): ${this.formatMoneda(presupuesto.iva)}
    TOTAL: ${this.formatMoneda(presupuesto.total)}
    
    ==================================
    Vence: ${this.formatFecha(presupuesto.fechaVencimiento)}
    Estado: ${this.getEstadoTexto(presupuesto.estadoColor)}
    
    Observaciones:
    ${presupuesto.observaciones || 'Ninguna'}
    
    ==================================
    Maked by optolapp.com
  `;

    // Abrir ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Presupuesto ${presupuesto.codigo}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              line-height: 1.4;
              margin: 20px;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .info-cliente {
              margin-bottom: 20px;
              padding: 10px;
              border: 1px solid #ccc;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
            }
            .totales {
              margin-top: 20px;
              border-top: 2px solid #000;
              padding-top: 10px;
            }
            .total-final {
              font-weight: bold;
              font-size: 14px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>NEW VISION LENS 2020</h2>
            <p>Calle Confecio Centro Comercial Candelaria Plaza Planta Baja Local PB</p>
            <p>Teléfono: 022.365.394.2 | Email: newvisionlens2020@email.com</p>
          </div>
          
          <h3>PRESUPUESTO N° ${presupuesto.codigo}</h3>
          
          <div class="info-cliente">
            <h4>CLIENTE</h4>
            <p><strong>${presupuesto.cliente.nombreCompleto}</strong></p>
            <p>${presupuesto.cliente.direccion || 'Dirección no especificada'}</p>
            <p>Teléfono: ${presupuesto.cliente.telefono}</p>
            <p>Fecha: ${this.formatFecha(new Date())}</p>
          </div>
          
          <h4>PRODUCTOS</h4>
          <table>
            <thead>
              <tr>
                <th>DESCRIPCIÓN</th>
                <th>PRECIO</th>
                <th>CANTIDAD</th>
                <th>DESCUENTO %</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${presupuesto.productos.map((p: any) => `
                <tr>
                  <td>${p.descripcion}</td>
                  <td>${this.formatMoneda(p.precio)}</td>
                  <td>${p.cantidad}</td>
                  <td>${p.descuento}%</td>
                  <td>${this.formatMoneda(p.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totales">
            <p><strong>Subtotal:</strong> ${this.formatMoneda(presupuesto.subtotal)}</p>
            <p><strong>IVA Total (16%):</strong> ${this.formatMoneda(presupuesto.iva)}</p>
            <p class="total-final"><strong>TOTAL:</strong> ${this.formatMoneda(presupuesto.total)}</p>
          </div>
          
          <div class="info-adicional">
            <p><strong>Fecha de Vencimiento:</strong> ${this.formatFecha(presupuesto.fechaVencimiento)}</p>
            <p><strong>Válido por:</strong> ${presupuesto.diasVencimiento} días</p>
            ${presupuesto.observaciones ? `<p><strong>Observaciones:</strong> ${presupuesto.observaciones}</p>` : ''}
          </div>
          
          <div class="footer">
            <p>________________________________</p>
            <p>Firma del Cliente</p>
            <p>Maked by optolapp.com</p>
            <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
            <button class="no-print" onclick="window.close()">❌ Cerrar</button>
          </div>
          
          <script>
            // Auto-imprimir si se desea
            // window.print();
          </script>
        </body>
      </html>
    `);
      ventanaImpresion.document.close();
    }

    // También puedes usar un snackbar para notificar
    this.snackBar.open(`Preparando impresión del presupuesto ${presupuesto.codigo}`, 'Cerrar', {
      duration: 3000,
      panelClass: ['snackbar-info']
    });
  }

  // También necesitas este método auxiliar para la impresión
  formatFechaParaImpresion(fecha: Date): string {
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  agregarProducto(producto: any) {
    // Verificar si el producto ya existe en la lista
    const productoExistente = this.nuevoPresupuesto.productos.find((p: any) => p.id === producto.id);

    if (productoExistente) {
      // Si ya existe, incrementar la cantidad
      productoExistente.cantidad += 1;
      this.actualizarProductoPorId(producto.id);
    } else {
      // Si no existe, agregar nuevo producto
      const productoAgregar = {
        id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        precio: producto.precio,
        cantidad: 1,
        descuento: 0,
        total: producto.precio
      };

      this.nuevoPresupuesto.productos.push(productoAgregar);
    }

    this.calcularTotales();
    this.terminoBusqueda = '';
    this.productosFiltrados = [];

    // Mostrar mensaje de confirmación
    this.snackBar.open(`${producto.descripcion} agregado al presupuesto`, 'Cerrar', {
      duration: 2000,
      panelClass: ['snackbar-success']
    });
  }

  actualizarProductoPorId(productoId: number) {
    const index = this.nuevoPresupuesto.productos.findIndex((p: any) => p.id === productoId);
    if (index !== -1) {
      this.actualizarProducto(index);
    }
  }

  actualizarProducto(index: number) {
    const producto = this.nuevoPresupuesto.productos[index];

    // Validar valores
    if (producto.cantidad < 1) producto.cantidad = 1;
    if (producto.descuento < 0) producto.descuento = 0;
    if (producto.descuento > 100) producto.descuento = 100;

    // Calcular total
    const subtotal = producto.precio * producto.cantidad;
    const descuentoValor = subtotal * (producto.descuento / 100);
    producto.total = subtotal - descuentoValor;

    this.calcularTotales();
  }

  modificarCantidad(index: number, cambio: number) {
    const producto = this.nuevoPresupuesto.productos[index];
    const nuevaCantidad = producto.cantidad + cambio;

    if (nuevaCantidad < 1) {
      // Si la cantidad llega a 0, eliminar el producto
      this.eliminarProducto(index);
      return;
    }

    producto.cantidad = nuevaCantidad;
    this.actualizarProducto(index);
  }

  calcularTotales() {
    this.nuevoPresupuesto.subtotal = this.nuevoPresupuesto.productos
      .reduce((sum, producto) => sum + (producto.precio * producto.cantidad), 0);

    this.nuevoPresupuesto.descuentoTotal = this.nuevoPresupuesto.productos
      .reduce((sum, producto) => sum + (producto.precio * producto.cantidad * (producto.descuento / 100)), 0);

    const baseImponible = this.nuevoPresupuesto.subtotal - this.nuevoPresupuesto.descuentoTotal;
    this.nuevoPresupuesto.iva = baseImponible * 0.16;
    this.nuevoPresupuesto.total = baseImponible + this.nuevoPresupuesto.iva;
  }

}