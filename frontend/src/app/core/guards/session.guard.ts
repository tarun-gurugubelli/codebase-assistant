import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { SessionService } from '../services/session.service';

export const sessionGuard: CanActivateFn = (route) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const id = route.paramMap.get('id')!;

  // If already cached, allow immediately
  if (sessionService.sessions().some(s => s.id === id)) {
    sessionService.setActive(id);
    return true;
  }

  return sessionService.getOne(id).pipe(
    map(session => {
      if (session) {
        sessionService.setActive(id);
        return true;
      }
      return router.createUrlTree(['/upload']);
    }),
    catchError(() => of(router.createUrlTree(['/upload'])))
  );
};
