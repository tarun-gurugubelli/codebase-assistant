import { Routes } from '@angular/router';
import { sessionGuard } from './core/guards/session.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/upload', pathMatch: 'full' },
  {
    path: 'upload',
    loadComponent: () =>
      import('./features/upload/upload.component').then(m => m.UploadComponent),
  },
  {
    path: 'session/:id',
    loadComponent: () =>
      import('./features/chat/chat.component').then(m => m.ChatComponent),
    canActivate: [sessionGuard],
  },
  { path: '**', redirectTo: '/upload' },
];
