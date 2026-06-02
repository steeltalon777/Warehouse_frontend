import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-issued-assets-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="wh-page issued-assets-page">
      <!-- Page Header -->
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Репозиторий выдачи</h1>
          <p class="page-subtitle">Управление выданным имуществом и объектами выдачи.</p>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-bar">
        <a class="tab-btn"
          [class.active]="isActiveTab('property')"
          [class.inactive]="!isActiveTab('property')"
          routerLink="/issued-assets/property"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }">
          Имущество
        </a>
        <a class="tab-btn"
          [class.active]="isActiveTab('objects')"
          [class.inactive]="!isActiveTab('objects')"
          routerLink="/issued-assets/objects"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }">
          Объекты
        </a>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .issued-assets-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #F1F5F9;
      overflow: hidden;
    }

    .page-header {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
    }
    .header-info { min-width: 0; }
    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    .page-subtitle {
      font-size: 13px;
      color: #64748B;
      margin: 4px 0 0;
    }

    .tab-bar {
      flex-shrink: 0;
      display: flex;
      gap: 0;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
      padding: 0 20px;
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 20px;
      font-size: 14px;
      font-weight: 500;
      color: #64748B;
      text-decoration: none;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
      cursor: pointer;
      font-family: inherit;
    }
    .tab-btn.active {
      color: #0F172A;
      border-bottom-color: #334155;
      font-weight: 600;
    }
    .tab-btn:hover:not(.active) {
      color: #334155;
      background: #F8FAFC;
    }

    .tab-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  `]
})
export class IssuedAssetsPageComponent {
  isActiveTab(tab: string): boolean {
    return window.location.pathname.startsWith(`/issued-assets/${tab}`);
  }
}
