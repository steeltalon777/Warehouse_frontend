import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { STATUS_TABS } from '../../../../core/models/operations.models';

@Component({
  selector: 'app-operations-status-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-tabs">
      @for (tab of tabs; track tab.key) {
        <button
          class="tab"
          [class.active]="activeTab() === tab.key"
          (click)="tabChange.emit(tab.key)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
  styles: [`
    .status-tabs {
      display: flex;
      gap: 4px;
      padding-top: 10px;
      border-top: 1px solid #E2E8F0;
      margin-top: 10px;
    }
    .tab {
      height: 32px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #64748B;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .tab:hover { background: #F8FAFC; color: #374151; }
    .tab.active {
      background: #FFFFFF;
      color: #1E293B;
      border-color: #E2E8F0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
  `]
})
export class OperationsStatusTabsComponent {
  activeTab = input.required<string>();
  tabChange = output<string>();

  readonly tabs = STATUS_TABS;
}
