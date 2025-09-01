import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError, TimeoutError } from 'rxjs';
import { SwalService } from './../services/swal/swal.service'; // Ajusta la ruta según tu proyecto

@Injectable({
    providedIn: 'root'
})
export class ErrorHandlerService {

    constructor(private swalService: SwalService) { }

    /**
     * Maneja errores HTTP y de timeout de forma centralizada y defensiva.
     */
    handleHttpError(error: HttpErrorResponse | TimeoutError) {
        console.error('[HTTP ERROR]', error);

        // ⏳ Timeout detectado (RxJS)
        if (error instanceof TimeoutError) {
            this.swalService.showError(
                'Tiempo de espera agotado',
                'El servidor tardó demasiado en responder.'
            );
            return throwError(() => error);
        }

        // A partir de aquí, tratamos como HttpErrorResponse
        if (error instanceof HttpErrorResponse) {

            // 🔌 Sin conexión o backend caído
            if (error.status === 0) {
                this.swalService.showError(
                    'No pudimos conectar con el servidor',
                    'Parece que hay un problema de conexión. Revisa tu internet o intenta nuevamente en unos minutos.'
                );
                return throwError(() => error);
            }

            // ⚠️ Errores HTTP conocidos
            switch (error.status) {
                case 400:
                    this.swalService.showError(
                        'Solicitud inválida',
                        this.getErrorMessage(error) || 'Revisa los datos enviados.'
                    );
                    break;
                case 401:
                    this.swalService.showError(
                        'No autorizado',
                        'Tu sesión ha expirado o no tienes permisos.'
                    );
                    break;
                case 403:
                    this.swalService.showError(
                        'Acceso denegado',
                        'No tienes permisos para realizar esta acción.'
                    );
                    break;
                case 404:
                    this.swalService.showError(
                        'Recurso no encontrado',
                        'El recurso solicitado no existe o fue movido.'
                    );
                    break;
                case 500:
                    this.swalService.showError(
                        'Error interno del servidor',
                        'Ocurrió un problema inesperado. Intenta más tarde.'
                    );
                    break;
                default:
                    this.swalService.showError(
                        `Error ${error.status}`,
                        this.getErrorMessage(error) || 'Ocurrió un error inesperado.'
                    );
                    break;
            }
        }

        // 🔄 Propagar el error para que el flujo continúe
        return throwError(() => error);
    }

    /**
     * Extrae un mensaje legible del error si existe
     */
    private getErrorMessage(error: HttpErrorResponse): string | null {
        if (error.error) {
            if (typeof error.error === 'string') {
                return error.error;
            }
            if (error.error.message) {
                return error.error.message;
            }
        }
        return null;
    }
}
