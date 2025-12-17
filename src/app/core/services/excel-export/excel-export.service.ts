import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  constructor() { }

  /**
   * Exporta datos a un archivo Excel
   * @param data Array de objetos a exportar
   * @param fileName Nombre del archivo (sin extensión)
   * @param sheetName Nombre de la hoja (opcional)
   * @param columnWidths Anchos personalizados de columnas (opcional)
   */
  exportToExcel(
    data: any[],
    fileName: string,
    sheetName: string = 'Datos',
    columnWidths?: { [key: string]: number }
  ): void {
    try {
      if (!data || data.length === 0) {
        throw new Error('No hay datos para exportar');
      }

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Convertir datos a hoja de cálculo
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Aplicar formatos si se proporcionan
      if (columnWidths) {
        this.applyColumnWidths(ws, columnWidths);
      }
      
      // Aplicar formato de números automáticamente
      this.autoFormatNumbers(ws, data);
      
      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Generar fecha para el nombre del archivo
      const fecha = new Date();
      const fechaStr = fecha.toISOString().split('T')[0];
      const nombreCompleto = `${fileName}_${fechaStr}.xlsx`;
      
      // Escribir archivo
      XLSX.writeFile(wb, nombreCompleto);
      
    } catch (error: any) {
      console.error('Error al exportar a Excel:', error);
      throw new Error(`Error al exportar a Excel: ${error.message}`);
    }
  }

  /**
   * Exporta múltiples hojas a un archivo Excel
   * @param sheets Array de objetos con datos de cada hoja
   * @param fileName Nombre del archivo (sin extensión)
   */
  exportMultipleSheets(
    sheets: Array<{
      data: any[];
      sheetName: string;
      columnWidths?: { [key: string]: number };
    }>,
    fileName: string
  ): void {
    try {
      if (!sheets || sheets.length === 0) {
        throw new Error('No hay hojas para exportar');
      }

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Procesar cada hoja
      sheets.forEach((sheet, index) => {
        if (sheet.data && sheet.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(sheet.data);
          
          if (sheet.columnWidths) {
            this.applyColumnWidths(ws, sheet.columnWidths);
          }
          
          this.autoFormatNumbers(ws, sheet.data);
          
          XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName || `Hoja${index + 1}`);
        }
      });
      
      // Generar fecha para el nombre del archivo
      const fecha = new Date();
      const fechaStr = fecha.toISOString().split('T')[0];
      const nombreCompleto = `${fileName}_${fechaStr}.xlsx`;
      
      // Escribir archivo
      XLSX.writeFile(wb, nombreCompleto);
      
    } catch (error: any) {
      console.error('Error al exportar múltiples hojas a Excel:', error);
      throw new Error(`Error al exportar a Excel: ${error.message}`);
    }
  }

  /**
   * Exporta datos con formato de tabla compleja
   * @param data Array de objetos a exportar
   * @param fileName Nombre del archivo
   * @param options Opciones de formato
   */
  exportWithFormats(
    data: any[],
    fileName: string,
    options?: {
      sheetName?: string;
      headerStyle?: any;
      columnStyles?: { [key: string]: any };
      columnWidths?: { [key: string]: number };
      freezePane?: string; // Ej: 'A2'
      autoFilter?: string; // Ej: 'A1:K1'
    }
  ): void {
    try {
      if (!data || data.length === 0) {
        throw new Error('No hay datos para exportar');
      }

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Convertir datos
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Aplicar configuraciones
      if (options?.columnWidths) {
        this.applyColumnWidths(ws, options.columnWidths);
      }
      
      // Formato automático de números
      this.autoFormatNumbers(ws, data);
      
      // Agregar hoja
      XLSX.utils.book_append_sheet(wb, ws, options?.sheetName || 'Datos');
      
      // Nombre del archivo
      const fecha = new Date();
      const fechaStr = fecha.toISOString().split('T')[0];
      const nombreCompleto = `${fileName}_${fechaStr}.xlsx`;
      
      // Escribir archivo
      XLSX.writeFile(wb, nombreCompleto);
      
    } catch (error: any) {
      console.error('Error al exportar con formatos:', error);
      throw new Error(`Error al exportar a Excel: ${error.message}`);
    }
  }

  /**
   * Aplica anchos de columnas a la hoja
   */
  private applyColumnWidths(worksheet: XLSX.WorkSheet, columnWidths: { [key: string]: number }): void {
    if (!worksheet['!cols']) {
      worksheet['!cols'] = [];
    }
    
    Object.keys(columnWidths).forEach(col => {
      const colIndex = col.charCodeAt(0) - 65; // Convertir letra a índice
      if (!worksheet['!cols'][colIndex]) {
        worksheet['!cols'][colIndex] = {};
      }
      worksheet['!cols'][colIndex].wch = columnWidths[col];
    });
  }

  /**
   * Formato automático de números
   */
  private autoFormatNumbers(worksheet: XLSX.WorkSheet, data: any[]): void {
    if (!data.length) return;
    
    // Detectar columnas numéricas
    const sampleRow = data[0];
    const numericColumns: string[] = [];
    
    Object.keys(sampleRow).forEach((key, index) => {
      const cellValue = sampleRow[key];
      if (typeof cellValue === 'number') {
        const colLetter = String.fromCharCode(65 + index); // A, B, C...
        numericColumns.push(colLetter);
      }
    });
    
    // Aplicar formato de moneda a las columnas que lo requieran
    const currencyKeywords = ['total', 'precio', 'costo', 'valor', 'monto', 'subtotal', 'iva', 'descuento'];
    
    numericColumns.forEach(colLetter => {
      const headerCell = worksheet[`${colLetter}1`];
      if (headerCell && headerCell.v) {
        const headerValue = headerCell.v.toString().toLowerCase();
        if (currencyKeywords.some(keyword => headerValue.includes(keyword))) {
          // Formato de moneda
          this.applyNumberFormat(worksheet, colLetter, '"$"#,##0.00');
        } else {
          // Formato de número con separadores de miles
          this.applyNumberFormat(worksheet, colLetter, '#,##0.00');
        }
      }
    });
  }

  /**
   * Aplica formato numérico a una columna
   */
  private applyNumberFormat(worksheet: XLSX.WorkSheet, colLetter: string, format: string): void {
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = `${colLetter}${row + 1}`;
      if (worksheet[cellAddress]) {
        if (!worksheet[cellAddress].z) {
          worksheet[cellAddress].z = format;
        }
      }
    }
  }

  /**
   * Crea un Excel con datos procesados específicamente para presupuestos
   */
  exportPresupuestos(presupuestos: any[], fileName: string): void {
    const sheets = this.preparePresupuestoSheets(presupuestos);
    this.exportMultipleSheets(sheets, fileName);
  }

  /**
   * Prepara hojas específicas para presupuestos
   */
  private preparePresupuestoSheets(presupuestos: any[]): any[] {
    const resumen: any[] = [];
    const detalle: any[] = [];
    const clientes: any[] = [];
    const clientesMap = new Map();

    presupuestos.forEach(presupuesto => {
      // Hoja de resumen
      resumen.push({
        'Código': presupuesto.codigo,
        'Cliente': presupuesto.cliente?.nombreCompleto || '',
        'Cédula/RIF': presupuesto.cliente?.cedula || '',
        'Fecha Creación': this.formatDateForExcel(presupuesto.fechaCreacion),
        'Fecha Vencimiento': this.formatDateForExcel(presupuesto.fechaVencimiento),
        'Días Válido': presupuesto.diasVencimiento || 0,
        'Días Restantes': presupuesto.diasRestantes || 0,
        'Estado': presupuesto.estado || '',
        'Vendedor': presupuesto.vendedor || '',
        'Subtotal': presupuesto.subtotal || 0,
        'IVA (16%)': presupuesto.iva || 0,
        'Descuento Total': presupuesto.descuentoTotal || 0,
        'Total': presupuesto.total || 0,
        'Productos': presupuesto.productos?.length || 0,
        'Observaciones': presupuesto.observaciones || ''
      });

      // Hoja de detalle de productos
      presupuesto.productos?.forEach((producto: any, index: number) => {
        detalle.push({
          'Código Presupuesto': presupuesto.codigo,
          'Cliente': presupuesto.cliente?.nombreCompleto || '',
          'N° Item': index + 1,
          'Descripción': producto.descripcion || '',
          'Código Producto': producto.codigo || '',
          'Precio Unitario': producto.precio || 0,
          'Cantidad': producto.cantidad || 0,
          'Descuento %': producto.descuento || 0,
          'Descuento $': (producto.precio || 0) * (producto.cantidad || 0) * ((producto.descuento || 0) / 100),
          'Total Producto': producto.total || 0,
          'Fecha Presupuesto': this.formatDateForExcel(presupuesto.fechaCreacion)
        });
      });

      // Hoja de clientes (solo clientes únicos)
      const cedula = presupuesto.cliente?.cedula;
      if (cedula && !clientesMap.has(cedula)) {
        clientesMap.set(cedula, true);
        clientes.push({
          'Nombre': presupuesto.cliente?.nombreCompleto || '',
          'Cédula/RIF': cedula,
          'Tipo Persona': presupuesto.cliente?.tipoPersona === 'natural' ? 'Persona Natural' : 'Persona Jurídica',
          'Teléfono': presupuesto.cliente?.telefono || '',
          'Email': presupuesto.cliente?.email || '',
          'Dirección': presupuesto.cliente?.direccion || '',
          'Total Presupuestos': 1,
          'Total Compras': presupuesto.total || 0
        });
      } else if (cedula) {
        // Actualizar cliente existente
        const clienteExistente = clientes.find(c => c['Cédula/RIF'] === cedula);
        if (clienteExistente) {
          clienteExistente['Total Presupuestos'] += 1;
          clienteExistente['Total Compras'] += (presupuesto.total || 0);
        }
      }
    });

    return [
      {
        data: resumen,
        sheetName: 'Resumen',
        columnWidths: {
          'A': 15, 'B': 30, 'C': 15, 'D': 12, 'E': 12,
          'F': 10, 'G': 12, 'H': 12, 'I': 12, 'J': 12,
          'K': 10, 'L': 12, 'M': 12, 'N': 10, 'O': 30
        }
      },
      {
        data: detalle,
        sheetName: 'Detalle Productos',
        columnWidths: {
          'A': 20, 'B': 30, 'C': 8, 'D': 40, 'E': 15,
          'F': 12, 'G': 8, 'H': 10, 'I': 12, 'J': 12, 'K': 12
        }
      },
      {
        data: clientes,
        sheetName: 'Clientes',
        columnWidths: {
          'A': 30, 'B': 15, 'C': 15, 'D': 15, 'E': 25,
          'F': 35, 'G': 15, 'H': 15
        }
      }
    ];
  }

  /**
   * Formatea fecha para Excel
   */
  private formatDateForExcel(date: any): string {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  /**
   * Exporta datos a CSV (alternativa simple)
   */
  exportToCSV(data: any[], fileName: string): void {
    try {
      if (!data || data.length === 0) {
        throw new Error('No hay datos para exportar');
      }

      // Convertir a CSV
      const headers = Object.keys(data[0]);
      const csvRows = [];
      
      // Agregar encabezados
      csvRows.push(headers.join(','));
      
      // Agregar filas
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Escapar comas y comillas
          const escaped = ('' + value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      });
      
      // Crear archivo
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const fecha = new Date().toISOString().split('T')[0];
      const nombreCompleto = `${fileName}_${fecha}.csv`;
      
      saveAs(blob, nombreCompleto);
      
    } catch (error: any) {
      console.error('Error al exportar a CSV:', error);
      throw new Error(`Error al exportar a CSV: ${error.message}`);
    }
  }
}