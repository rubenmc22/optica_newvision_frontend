import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ClienteService } from './../../clientes/clientes.services';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExcelExportService } from './../../../core/services/excel-export/excel-export.service';

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
  modoEditable: boolean = false;


  filtroBusqueda: string = '';
  filtroEstado: string = '';
  tabActiva: string = 'vigentes';
  diasParaAutoArchivo: number = 30;
  diasVencimientoSeleccionado: number = 7;

  // En tu componente
  terminoBusqueda: string = '';
  productosFiltrados: any[] = [];

  // Agrega estas variables al componente
  mostrarMenuExportar: boolean = false;
  opcionesExportar = [
    { id: 'vigentes', texto: 'Exportar Vigentes', icono: 'bi-file-earmark-check' },
    { id: 'vencidos', texto: 'Exportar Vencidos', icono: 'bi-file-earmark-x' },
    { id: 'todos', texto: 'Exportar Todos', icono: 'bi-files' }
  ];
  // Variables para el menú de exportar
  timeoutCerrarMenu: any;

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
    private cdr: ChangeDetectorRef,
    private excelExportService: ExcelExportService,
  ) { }

  ngOnInit() {
    this.cargarDatos();
    this.inicializarNuevoPresupuesto();
    this.diasVencimientoSeleccionado = 7;
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
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Establecer hora a medianoche para cálculos precisos

      // Presupuestos VIGENTES (con diferentes días restantes)
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
          fechaCreacion: new Date(hoy.getTime() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
          fechaVencimiento: new Date(hoy.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 días en el futuro
          diasVencimiento: 17,
          vendedor: '12332',
          productos: [
            {
              descripcion: '758684-RETRO-0',
              codigo: '758684-RETRO-0',
              precio: 1108.23,
              cantidad: 1,
              descuento: 0,
              total: 1108.23
            },
            {
              descripcion: 'Lente Blue Filter',
              codigo: 'PR-000038',
              precio: 380.00,
              cantidad: 2,
              descuento: 5,
              total: 722.00
            }
          ],
          subtotal: 1488.23,
          iva: 238.12,
          descuentoTotal: 38.00,
          total: 1688.35,
          observaciones: 'Cliente regular, 5% de descuento especial',
          estado: 'vigente',
          diasRestantes: 14,
          estadoColor: 'vigente'
        },
        {
          id: 2,
          codigo: 'P-2025-002',
          cliente: {
            tipoPersona: 'juridica',
            cedula: 'J-123456789',
            nombreCompleto: 'Óptica Vision Plus C.A.',
            telefono: '+584141234567',
            email: 'ventas@opticavisionplus.com',
            direccion: 'Av. Principal, Centro Comercial Galerías'
          },
          fechaCreacion: new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
          fechaVencimiento: new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 días en el futuro
          diasVencimiento: 9,
          vendedor: '45678',
          productos: [
            {
              descripcion: 'Lente Progresivo Essilor',
              codigo: 'PR-000001',
              precio: 850.00,
              cantidad: 3,
              descuento: 10,
              total: 2295.00
            },
            {
              descripcion: 'Armazón Ray-Ban',
              codigo: 'PR-000042',
              precio: 320.50,
              cantidad: 5,
              descuento: 15,
              total: 1362.13
            }
          ],
          subtotal: 5852.50,
          iva: 936.40,
          descuentoTotal: 1001.87,
          total: 5787.03,
          observaciones: 'Empresa cliente, descuento por volumen',
          estado: 'vigente',
          diasRestantes: 7,
          estadoColor: 'vigente'
        },
        {
          id: 3,
          codigo: 'P-2025-003',
          cliente: {
            tipoPersona: 'natural',
            cedula: '23456789',
            nombreCompleto: 'María Gabriela López Pérez',
            telefono: '+584147894561',
            email: 'maria.gabriela@email.com',
            direccion: 'Urbanización Los Naranjos, Calle 5'
          },
          fechaCreacion: new Date(hoy.getTime() - 1 * 24 * 60 * 60 * 1000), // Hace 1 día
          fechaVencimiento: new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 días en el futuro
          diasVencimiento: 4,
          vendedor: '78901',
          productos: [
            {
              descripcion: 'Lente Fotocromático',
              codigo: 'PR-000027',
              precio: 720.00,
              cantidad: 1,
              descuento: 0,
              total: 720.00
            },
            {
              descripcion: 'Armazón Oakley',
              codigo: 'PR-000045',
              precio: 450.00,
              cantidad: 1,
              descuento: 0,
              total: 450.00
            }
          ],
          subtotal: 1170.00,
          iva: 187.20,
          descuentoTotal: 0,
          total: 1357.20,
          observaciones: '',
          estado: 'vigente',
          diasRestantes: 3,
          estadoColor: 'proximo'
        },
        {
          id: 4,
          codigo: 'P-2025-004',
          cliente: {
            tipoPersona: 'juridica',
            cedula: 'J-987654321',
            nombreCompleto: 'Clínica Visual Integral',
            telefono: '+584242345678',
            email: 'info@clinicavisual.com',
            direccion: 'Centro Médico Las Mercedes'
          },
          fechaCreacion: new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
          fechaVencimiento: new Date(hoy.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 día en el futuro
          diasVencimiento: 3,
          vendedor: '12332',
          productos: [
            {
              descripcion: 'Lente Antirreflejo',
              codigo: 'PR-000015',
              precio: 550.00,
              cantidad: 4,
              descuento: 8,
              total: 2024.00
            }
          ],
          subtotal: 2200.00,
          iva: 352.00,
          descuentoTotal: 176.00,
          total: 2376.00,
          observaciones: 'Entrega urgente requerida',
          estado: 'vigente',
          diasRestantes: 1,
          estadoColor: 'proximo'
        },
        {
          id: 5,
          codigo: 'P-2025-005',
          cliente: {
            tipoPersona: 'natural',
            cedula: '34567890',
            nombreCompleto: 'Carlos Eduardo Rodríguez',
            telefono: '+584148765432',
            email: 'carlos.rodriguez@email.com',
            direccion: 'Residencias El Bosque'
          },
          fechaCreacion: new Date(hoy.getTime() - 1 * 24 * 60 * 60 * 1000), // Hace 1 día
          fechaVencimiento: new Date(hoy.getTime()), // Vence hoy
          diasVencimiento: 1,
          vendedor: '45678',
          productos: [
            {
              descripcion: '758684-RETRO-0',
              codigo: '758684-RETRO-0',
              precio: 1108.23,
              cantidad: 1,
              descuento: 0,
              total: 1108.23
            },
            {
              descripcion: 'Lente Blue Filter',
              codigo: 'PR-000038',
              precio: 380.00,
              cantidad: 1,
              descuento: 0,
              total: 380.00
            }
          ],
          subtotal: 1488.23,
          iva: 238.12,
          descuentoTotal: 0,
          total: 1726.35,
          observaciones: 'Cliente nuevo',
          estado: 'vigente',
          diasRestantes: 0,
          estadoColor: 'hoy'
        }
      ];

      // Presupuestos VENCIDOS (con fechas pasadas)
      this.presupuestosVencidos = [
        {
          id: 6,
          codigo: 'P-2025-006',
          cliente: {
            tipoPersona: 'natural',
            cedula: '45678901',
            nombreCompleto: 'Ana Isabel Contreras',
            telefono: '+584142345678',
            email: 'ana.contreras@email.com',
            direccion: 'Sector La Victoria'
          },
          fechaCreacion: new Date(hoy.getTime() - 27 * 24 * 60 * 60 * 1000), // Hace 27 días
          fechaVencimiento: new Date(hoy.getTime() - 13 * 24 * 60 * 60 * 1000), // Hace 13 días
          diasVencimiento: 14,
          vendedor: '78901',
          productos: [
            {
              descripcion: 'Armazón Ray-Ban',
              codigo: 'PR-000042',
              precio: 320.50,
              cantidad: 2,
              descuento: 10,
              total: 576.90
            }
          ],
          subtotal: 641.00,
          iva: 102.56,
          descuentoTotal: 64.10,
          total: 679.46,
          observaciones: 'Presupuesto vencido hace 13 días',
          estado: 'vencido',
          diasRestantes: -13,
          estadoColor: 'vencido'
        },
        {
          id: 7,
          codigo: 'P-2025-007',
          cliente: {
            tipoPersona: 'juridica',
            cedula: 'J-456789123',
            nombreCompleto: 'Centro Óptico Moderno',
            telefono: '+584261234567',
            email: 'ventas@opticomoderno.com',
            direccion: 'Centro Comercial Sambil'
          },
          fechaCreacion: new Date(hoy.getTime() - 22 * 24 * 60 * 60 * 1000), // Hace 22 días
          fechaVencimiento: new Date(hoy.getTime() - 8 * 24 * 60 * 60 * 1000), // Hace 8 días
          diasVencimiento: 14,
          vendedor: '12332',
          productos: [
            {
              descripcion: 'Lente Progresivo Essilor',
              codigo: 'PR-000001',
              precio: 850.00,
              cantidad: 2,
              descuento: 12,
              total: 1496.00
            },
            {
              descripcion: 'Lente Fotocromático',
              codigo: 'PR-000027',
              precio: 720.00,
              cantidad: 3,
              descuento: 12,
              total: 1900.80
            },
            {
              descripcion: 'Lente Antirreflejo',
              codigo: 'PR-000015',
              precio: 550.00,
              cantidad: 2,
              descuento: 12,
              total: 968.00
            }
          ],
          subtotal: 4370.00,
          iva: 699.20,
          descuentoTotal: 616.20,
          total: 4453.00,
          observaciones: 'Gran pedido corporativo - Vencido hace 8 días',
          estado: 'vencido',
          diasRestantes: -8,
          estadoColor: 'vencido'
        },
        {
          id: 8,
          codigo: 'P-2025-008',
          cliente: {
            tipoPersona: 'natural',
            cedula: '56789012',
            nombreCompleto: 'José Gregorio Méndez',
            telefono: '+584143216789',
            email: 'jose.mendez@email.com',
            direccion: 'Urbanización Los Samanes'
          },
          fechaCreacion: new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000), // Hace 15 días
          fechaVencimiento: new Date(hoy.getTime() - 8 * 24 * 60 * 60 * 1000), // Hace 8 días
          diasVencimiento: 7,
          vendedor: '45678',
          productos: [
            {
              descripcion: 'Armazón Oakley',
              codigo: 'PR-000045',
              precio: 450.00,
              cantidad: 1,
              descuento: 5,
              total: 427.50
            }
          ],
          subtotal: 450.00,
          iva: 72.00,
          descuentoTotal: 22.50,
          total: 499.50,
          observaciones: 'Vencido hace 8 días',
          estado: 'vencido',
          diasRestantes: -8,
          estadoColor: 'vencido'
        },
        {
          id: 9,
          codigo: 'P-2025-009',
          cliente: {
            tipoPersona: 'juridica',
            cedula: 'J-789123456',
            nombreCompleto: 'Laboratorio Óptico Premium',
            telefono: '+584263456789',
            email: 'lab@opticopremium.com',
            direccion: 'Zona Industrial La Yaguara'
          },
          fechaCreacion: new Date(hoy.getTime() - 25 * 24 * 60 * 60 * 1000), // Hace 25 días
          fechaVencimiento: new Date(hoy.getTime() - 11 * 24 * 60 * 60 * 1000), // Hace 11 días
          diasVencimiento: 14,
          vendedor: '78901',
          productos: [
            {
              descripcion: '758684-RETRO-0',
              codigo: '758684-RETRO-0',
              precio: 1108.23,
              cantidad: 5,
              descuento: 18,
              total: 4543.74
            },
            {
              descripcion: 'Lente Blue Filter',
              codigo: 'PR-000038',
              precio: 380.00,
              cantidad: 10,
              descuento: 18,
              total: 3116.00
            }
          ],
          subtotal: 9141.15,
          iva: 1462.58,
          descuentoTotal: 1804.91,
          total: 8798.82,
          observaciones: 'Pedido mayorista - Vencido hace 11 días',
          estado: 'vencido',
          diasRestantes: -11,
          estadoColor: 'vencido'
        },
        {
          id: 10,
          codigo: 'P-2025-010',
          cliente: {
            tipoPersona: 'natural',
            cedula: '67890123',
            nombreCompleto: 'Laura Valentina Sánchez',
            telefono: '+584144567890',
            email: 'laura.sanchez@email.com',
            direccion: 'Residencias El Paraíso'
          },
          fechaCreacion: new Date(hoy.getTime() - 12 * 24 * 60 * 60 * 1000), // Hace 12 días
          fechaVencimiento: new Date(hoy.getTime() - 5 * 24 * 60 * 60 * 1000), // Hace 5 días
          diasVencimiento: 7,
          vendedor: '12332',
          productos: [
            {
              descripcion: 'Lente Antirreflejo',
              codigo: 'PR-000015',
              precio: 550.00,
              cantidad: 1,
              descuento: 0,
              total: 550.00
            },
            {
              descripcion: 'Armazón Ray-Ban',
              codigo: 'PR-000042',
              precio: 320.50,
              cantidad: 1,
              descuento: 0,
              total: 320.50
            }
          ],
          subtotal: 870.50,
          iva: 139.28,
          descuentoTotal: 0,
          total: 1009.78,
          observaciones: 'Presupuesto vencido hace 5 días',
          estado: 'vencido',
          diasRestantes: -5,
          estadoColor: 'vencido'
        },
        {
          id: 11,
          codigo: 'P-2025-011',
          cliente: {
            tipoPersona: 'natural',
            cedula: '78901234',
            nombreCompleto: 'Pedro Antonio Rojas',
            telefono: '+584145678901',
            email: 'pedro.rojas@email.com',
            direccion: 'Urbanización Los Jardines'
          },
          fechaCreacion: new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000), // Hace 10 días
          fechaVencimiento: new Date(hoy.getTime() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
          diasVencimiento: 7,
          vendedor: '45678',
          productos: [
            {
              descripcion: 'Lente Fotocromático',
              codigo: 'PR-000027',
              precio: 720.00,
              cantidad: 2,
              descuento: 7,
              total: 1339.20
            }
          ],
          subtotal: 1440.00,
          iva: 230.40,
          descuentoTotal: 100.80,
          total: 1569.60,
          observaciones: 'Vencido recientemente hace 3 días',
          estado: 'vencido',
          diasRestantes: -3,
          estadoColor: 'vencido'
        }
      ];

      // Llamar al método para calcular días restantes dinámicamente
      this.actualizarDiasRestantesDinamicos();

      this.calcularEstadisticas();
    }, 500);
  }

  actualizarDiasRestantesDinamicos(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Establece la hora a medianoche para comparar solo fechas

    // Actualizar presupuestos vigentes
    this.presupuestosVigentes.forEach(presupuesto => {
      const fechaVencimiento = new Date(presupuesto.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0); // Solo fecha

      // Calcular diferencia en días
      const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

      presupuesto.diasRestantes = diasRestantes;

      // IMPORTANTE: Actualizar estadoColor basado en díasRestantes
      if (diasRestantes < 0) {
        // Si está vencido, moverlo a vencidos
        presupuesto.estadoColor = 'vencido';
        this.moverPresupuestoAVencidos(presupuesto);
      } else {
        // Mantener en vigentes con el estado correcto
        presupuesto.estadoColor = this.getEstadoColor(diasRestantes);
      }
    });

    // Actualizar presupuestos vencidos
    this.presupuestosVencidos.forEach(presupuesto => {
      const fechaVencimiento = new Date(presupuesto.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0);

      const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

      presupuesto.diasRestantes = diasRestantes;
      presupuesto.estadoColor = 'vencido'; // Siempre vencido en esta lista
    });

    this.calcularEstadisticas();
  }

  // Método para mover presupuesto a vencidos
  moverPresupuestoAVencidos(presupuesto: any): void {
    // Remover de vigentes
    this.presupuestosVigentes = this.presupuestosVigentes.filter(p => p.id !== presupuesto.id);

    // Agregar a vencidos (si no existe ya)
    if (!this.presupuestosVencidos.some(p => p.id === presupuesto.id)) {
      this.presupuestosVencidos.push(presupuesto);
    }
  }

  // Asegúrate de que getEstadoColor esté definido
  getEstadoColor(diasRestantes: number): string {
    if (diasRestantes < 0) {
      return 'vencido';
    } else if (diasRestantes === 0) {
      return 'hoy';
    } else if (diasRestantes <= 3) {
      return 'proximo';
    } else {
      return 'vigente';
    }
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

  confirmarEliminarPresupuesto(presupuesto: any) {
    this.presupuestoAEliminar = presupuesto;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.presupuestoAEliminar = null;
  }

  // Método para calcular descuento total
  calcularDescuentoTotalPresupuesto(): number {
    if (!this.presupuestoSeleccionado) return 0;

    return this.presupuestoSeleccionado.productos.reduce((total: number, producto: any) => {
      const subtotalProducto = producto.precio * producto.cantidad;
      return total + (subtotalProducto * (producto.descuento / 100));
    }, 0);
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
    this.actualizarDiasRestantesDinamicos();
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

  getEstadoTexto(estadoColor: string): string {
    const estados = {
      'vigente': 'Vigente',
      'proximo': 'Próximo a vencer',
      'hoy': 'Vence hoy',
      'vencido': 'Vencido'
    };
    return estados[estadoColor] || 'Vigente';
  }

  calcularEstadisticas() {
    this.estadisticas.totalVigentes = this.presupuestosVigentes.length;
    this.estadisticas.totalVencidos = this.presupuestosVencidos.length;

    const totalVigentes = this.presupuestosVigentes.reduce((sum, p) => sum + p.total, 0);
    const totalVencidos = this.presupuestosVencidos.reduce((sum, p) => sum + p.total, 0);
    this.estadisticas.totalValor = totalVigentes + totalVencidos;

    this.estadisticas.proximosAVencer = this.presupuestosVigentes.filter(p => p.diasRestantes! <= 3).length;
  }

  // Método para exportar con opciones
  exportarExcel(tipo: 'vigentes' | 'vencidos' | 'todos' = 'vigentes'): void {
    try {
      let presupuestos: any[] = [];
      let nombre = '';

      switch (tipo) {
        case 'vigentes':
          presupuestos = this.presupuestosVigentes;
          nombre = 'Presupuestos_Vigentes';
          break;
        case 'vencidos':
          presupuestos = this.presupuestosVencidos;
          nombre = 'Presupuestos_Vencidos';
          break;
        case 'todos':
          presupuestos = [...this.presupuestosVigentes, ...this.presupuestosVencidos];
          nombre = 'Todos_Presupuestos';
          break;
        default:
          presupuestos = this.presupuestosVigentes;
          nombre = 'Presupuestos';
      }

      this.excelExportService.exportPresupuestos(presupuestos, nombre);

      this.snackBar.open(`Exportado ${presupuestos.length} presupuesto(s) a Excel`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-success']
      });

    } catch (error: any) {
      console.error('Error al exportar a Excel:', error);
      this.snackBar.open(`Error: ${error.message}`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-error']
      });
    }
  }

  filtrarPresupuestos() {
    this.calcularEstadisticas();
  }

  // Métodos para controlar el menú desplegable
  abrirMenuExportar(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
    this.mostrarMenuExportar = true;
  }

  cerrarMenuExportar(): void {
    // Usar timeout para permitir mover el mouse entre el botón y el menú
    this.timeoutCerrarMenu = setTimeout(() => {
      this.mostrarMenuExportar = false;
    }, 300);
  }

  mantenerMenuAbierto(): void {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
  }

  seleccionarOpcionExportar(tipo: 'vigentes' | 'vencidos' | 'todos'): void {
    this.exportarExcel(tipo);
    this.mostrarMenuExportar = false;
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
  }

  // Limpiar timeout cuando se destruye el componente
  ngOnDestroy() {
    if (this.timeoutCerrarMenu) {
      clearTimeout(this.timeoutCerrarMenu);
    }
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

  // Método para imprimir presupuesto con auto-impresión y cierre automático
  imprimirPresupuesto(presupuesto: any) {
    console.log('🖨️ Imprimiendo presupuesto:', presupuesto);

    // Calcular descuento total si no existe
    if (!presupuesto.descuentoTotal) {
      presupuesto.descuentoTotal = this.calcularDescuentoTotalPresupuestoParaImpresion(presupuesto);
    }

    // Crear contenido HTML para impresión
    const contenidoHTML = `
    <html>
      <head>
        <title>Presupuesto ${presupuesto.codigo}</title>
        <style>
          /* Estilos de impresión */
          @media print {
            @page {
              margin: 10mm;
              size: A4 portrait;
            }
            
            body {
              margin: 0;
              font-family: 'Arial', sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              background: white;
            }
            
            .no-print, button {
              display: none !important;
            }
            
            .header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            
            .info-cliente {
              margin-bottom: 15px;
              padding: 10px;
              border: 1px solid #ccc;
              background: #f9f9f9;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: center;
              vertical-align: middle;
              font-size: 11px;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .totales {
              margin-top: 20px;
              border-top: 2px solid #000;
              padding-top: 10px;
            }
            
            .total-final {
              font-weight: bold;
              font-size: 13px;
            }
            
            .footer {
              margin-top: 25px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            
            .text-center {
              text-align: center !important;
            }
          }
          
          /* Estilos para vista previa */
          @media screen {
            body {
              font-family: 'Arial', sans-serif;
              font-size: 12px;
              line-height: 1.4;
              margin: 20px;
              background: #f5f5f5;
            }
            
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              border-radius: 5px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              vertical-align: middle;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .text-center {
              text-align: center !important;
              vertical-align: middle !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Cabecera -->
          <div class="header">
            <h1>NEW VISION LENS 2020</h1>
            <p>Calle Confecio Centro Comercial Candelaria Plaza Planta Baja Local PB</p>
            <p>Teléfono: 022.365.394.2 | Email: newvisionlens2020@email.com</p>
          </div>
          
          <h2 class="text-center">PRESUPUESTO N° ${presupuesto.codigo}</h2>
          
          <!-- Información del cliente -->
          <div class="info-cliente">
            <h3 class="text-center">CLIENTE</h3>
            <div style="text-align: center;">
              <p><strong>Nombre:</strong> ${presupuesto.cliente.nombreCompleto}</p>
              <p><strong>Cédula/RIF:</strong> ${presupuesto.cliente.cedula}</p>
              <p><strong>Teléfono:</strong> ${presupuesto.cliente.telefono || 'No especificado'}</p>
              <p><strong>Dirección:</strong> ${presupuesto.cliente.direccion || 'No especificada'}</p>
            </div>
          </div>
          
          <!-- Productos -->
          <h3 class="text-center">DETALLE DE PRODUCTOS</h3>
          <table>
            <thead>
              <tr>
                <th class="text-center">#</th>
                <th class="text-center">DESCRIPCIÓN</th>
                <th class="text-center">CÓDIGO</th>
                <th class="text-center">PRECIO UNIT.</th>
                <th class="text-center">CANTIDAD</th>
                <th class="text-center">DESCUENTO %</th>
                <th class="text-center">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${presupuesto.productos.map((p: any, i: number) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td class="text-center">${p.descripcion}</td>
                  <td class="text-center">${p.codigo || '-'}</td>
                  <td class="text-center">${this.formatMoneda(p.precio)}</td>
                  <td class="text-center">${p.cantidad}</td>
                  <td class="text-center">${p.descuento > 0 ? p.descuento + '%' : '-'}</td>
                  <td class="text-center">${this.formatMoneda(p.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Totales -->
          <div class="totales">
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal:</span>
              <span>${this.formatMoneda(presupuesto.subtotal)}</span>
            </div>
            ${presupuesto.descuentoTotal > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Descuento total:</span>
              <span>- ${this.formatMoneda(presupuesto.descuentoTotal)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
              <span>IVA (16%):</span>
              <span>${this.formatMoneda(presupuesto.iva)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;" class="total-final">
              <strong>TOTAL:</strong>
              <strong>${this.formatMoneda(presupuesto.total)}</strong>
            </div>
          </div>
          
          <!-- Firma -->
          <div class="footer">
            <div style="text-align: center; margin-bottom: 30px;">
              <p>________________________________</p>
              <p>Firma del Cliente</p>
            </div>
            <p class="text-center">Presupuesto válido por ${presupuesto.diasVencimiento} días</p>
            <p class="text-center">Estado: ${this.getEstadoTexto(presupuesto.estadoColor)}</p>
          </div>
        </div>
        
        <script>
          // Imprimir automáticamente al cargar
          window.onload = function() {
            window.print();
          };
          
          // Cerrar la ventana después de imprimir
          window.onafterprint = function() {
            setTimeout(function() {
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

    // Abrir ventana de impresión
    const ventanaImpresion = window.open('', '_blank');

    if (ventanaImpresion) {
      ventanaImpresion.document.write(contenidoHTML);
      ventanaImpresion.document.close();

      // Notificación
      this.snackBar.open(`Preparando impresión del presupuesto ${presupuesto.codigo}`, 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-info']
      });
    } else {
      this.snackBar.open('Por favor, permite las ventanas emergentes para imprimir', 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-warning']
      });
    }
  }

  // Método auxiliar para calcular descuento total para impresión
  calcularDescuentoTotalPresupuestoParaImpresion(presupuesto: any): number {
    if (!presupuesto || !presupuesto.productos) return 0;

    return presupuesto.productos.reduce((total: number, producto: any) => {
      const subtotalProducto = producto.precio * producto.cantidad;
      return total + (subtotalProducto * (producto.descuento / 100));
    }, 0);
  }

  // Método para formatear fecha (ya existe, pero lo incluyo por referencia)
  formatFecha(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Método para formatear moneda (ya existe, pero lo incluyo por referencia)
  formatMoneda(valor: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
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

  // En el método verDetallePresupuesto, agregar:
  verDetallePresupuesto(presupuesto: any) {
    this.presupuestoSeleccionado = JSON.parse(JSON.stringify(presupuesto)); // Copia profunda
    this.modoEditable = false; // Siempre empieza en modo vista
    this.diasVencimientoSeleccionado = presupuesto.diasVencimiento || 7;
    this.mostrarModalDetallePresupuesto = true;
  }

  // Método para seleccionar días de vencimiento en modal de detalle
  seleccionarDiasVencimientoDetalle(dias: number): void {
    if (!this.presupuestoSeleccionado || !this.modoEditable) return;

    this.diasVencimientoSeleccionado = dias;

    // Calcular nueva fecha de vencimiento
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaCreacion);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + dias);

    this.presupuestoSeleccionado.fechaVencimiento = fechaVencimiento;
    this.presupuestoSeleccionado.diasVencimiento = dias;

    // Recalcular días restantes
    this.actualizarDiasRestantes();
  }

  // Método para actualizar días restantes
  actualizarDiasRestantes(): void {
    if (!this.presupuestoSeleccionado) return;

    const hoy = new Date();
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaVencimiento);
    const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTiempo / (1000 * 3600 * 24));

    this.presupuestoSeleccionado.diasRestantes = diasRestantes;
    this.presupuestoSeleccionado.estadoColor = this.getEstadoColor(diasRestantes);
  }

  // Método para calcular días de validez (ya existe, pero actualizado)
  calcularDiasValidez(): number {
    if (!this.presupuestoSeleccionado) return 0;

    const fechaCreacion = new Date(this.presupuestoSeleccionado.fechaCreacion);
    const fechaVencimiento = new Date(this.presupuestoSeleccionado.fechaVencimiento);
    const diffTiempo = fechaVencimiento.getTime() - fechaCreacion.getTime();
    return Math.ceil(diffTiempo / (1000 * 3600 * 24));
  }

  // Método para actualizar fecha de vencimiento cuando se cambia manualmente
  // Método para actualizar fecha de vencimiento (ya existe, pero actualizado)
  onFechaVencimientoChange(event: any): void {
    if (!this.presupuestoSeleccionado || !this.modoEditable) return;

    const fecha = new Date(event.target.value);
    this.presupuestoSeleccionado.fechaVencimiento = fecha;

    // Recalcular días de validez basado en la fecha de creación
    const fechaCreacion = new Date(this.presupuestoSeleccionado.fechaCreacion);
    const diffTiempo = fecha.getTime() - fechaCreacion.getTime();
    const diasValidez = Math.ceil(diffTiempo / (1000 * 3600 * 24));

    // Actualizar días de vencimiento
    this.diasVencimientoSeleccionado = diasValidez;
    this.presupuestoSeleccionado.diasVencimiento = diasValidez;

    // Recalcular días restantes
    this.actualizarDiasRestantes();

    // Encontrar la opción de vencimiento más cercana
    const opcionesDias = [7, 10, 20, 30];
    let opcionMasCercana = 7;
    let diferenciaMinima = Math.abs(diasValidez - 7);

    opcionesDias.forEach(opcion => {
      const diferencia = Math.abs(diasValidez - opcion);
      if (diferencia < diferenciaMinima) {
        diferenciaMinima = diferencia;
        opcionMasCercana = opcion;
      }
    });

    // Actualizar botón seleccionado
    this.diasVencimientoSeleccionado = opcionMasCercana;
  }

  // Método para resetear el estado de edición al cerrar el modal
  resetearEstadoEdicion(): void {
    this.modoEditable = false;
    this.diasVencimientoSeleccionado = 7;
  }

  // Actualizar el método cerrarModalDetalle
  cerrarModalDetalle(): void {
    this.mostrarModalDetallePresupuesto = false;
    this.presupuestoSeleccionado = null;
    this.resetearEstadoEdicion();
  }

  // Método para calcular porcentaje de descuento
  calcularPorcentajeDescuento(): number {
    if (!this.presupuestoSeleccionado ||
      !this.presupuestoSeleccionado.subtotal ||
      this.presupuestoSeleccionado.subtotal === 0) {
      return 0;
    }

    const porcentaje = (this.presupuestoSeleccionado.descuentoTotal / this.presupuestoSeleccionado.subtotal) * 100;
    return Math.round(porcentaje * 100) / 100; // Redondear a 2 decimales
  }

  // Método para guardar cambios del presupuesto
  guardarCambiosPresupuesto(): void {
    if (!this.presupuestoSeleccionado) return;

    // Actualizar días de vencimiento según la selección actual
    if (this.modoEditable) {
      this.presupuestoSeleccionado.diasVencimiento = this.diasVencimientoSeleccionado;
    }

    // Buscar y actualizar el presupuesto en la lista correspondiente
    let listaPresupuestos: any[];
    let indice: number;

    // Determinar en qué lista está el presupuesto
    if (this.presupuestoSeleccionado.estadoColor === 'vencido') {
      listaPresupuestos = this.presupuestosVencidos;
    } else {
      listaPresupuestos = this.presupuestosVigentes;
    }

    indice = listaPresupuestos.findIndex(p => p.id === this.presupuestoSeleccionado.id);

    if (indice !== -1) {
      // Si cambió de estado, moverlo a la lista correspondiente
      const presupuestoOriginal = listaPresupuestos[indice];

      if (presupuestoOriginal.estadoColor !== this.presupuestoSeleccionado.estadoColor) {
        // Remover de la lista actual
        listaPresupuestos.splice(indice, 1);

        // Agregar a la nueva lista
        if (this.presupuestoSeleccionado.estadoColor === 'vencido') {
          this.presupuestosVencidos.push(this.presupuestoSeleccionado);
        } else {
          this.presupuestosVigentes.push(this.presupuestoSeleccionado);
        }
      } else {
        // Actualizar en la misma lista
        listaPresupuestos[indice] = { ...this.presupuestoSeleccionado };
      }

      // Recalcular estadísticas
      this.calcularEstadisticas();

      // Mostrar mensaje de éxito
      this.snackBar.open('Presupuesto actualizado correctamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });

      // Cerrar modal
      this.cerrarModalDetalle();
    } else {
      // Si no se encuentra, mostrar error
      this.snackBar.open('Error: No se encontró el presupuesto', 'Cerrar', {
        duration: 3000,
        panelClass: ['snackbar-error']
      });
    }
  }

  // Método para obtener texto de días restantes para un presupuesto específico
  getTextoDiasRestantesParaPresupuesto(presupuesto: any): string {
    if (!presupuesto || presupuesto.diasRestantes === undefined) return '';

    const diasRestantes = presupuesto.diasRestantes;

    if (diasRestantes < 0) {
      return `Vencido hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''}`;
    } else if (diasRestantes === 0) {
      return 'Vence hoy';
    } else if (diasRestantes === 1) {
      return 'Vence mañana';
    } else {
      return `Vence en ${diasRestantes} días`;
    }
  }

  // Y modificar el original para usar con presupuestoSeleccionado
  getTextoDiasRestantes(): string {
    return this.getTextoDiasRestantesParaPresupuesto(this.presupuestoSeleccionado);
  }

}