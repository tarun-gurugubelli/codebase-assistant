import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message =
        err.error?.error?.message ??
        err.error?.message ??
        err.message ??
        'An unexpected error occurred';

      if (err.status === 0) {
        toast.show('Cannot reach server. Is the backend running?', 'error');
      } else if (err.status >= 500) {
        toast.show(`Server error: ${message}`, 'error');
      } else if (err.status === 404) {
        // let components handle 404s
      } else if (err.status >= 400) {
        toast.show(message, 'error');
      }

      return throwError(() => err);
    })
  );
};
