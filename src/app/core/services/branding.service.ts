import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly productName = 'Quartermaster';
  readonly productVersion = '3.1';
  readonly productTagline = 'Система складского и имущественного учёта';
  readonly brandPrimaryColor = '#1a365d';
  readonly brandLogoPath = '/static/img/logo.svg';
  readonly brandFaviconPath = '/static/img/favicon.ico';
}
