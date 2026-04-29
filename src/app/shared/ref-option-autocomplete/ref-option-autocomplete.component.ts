import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';

interface RefOptionItem {
  value: string | number | null;
  label: string;
}

@Component({
  selector: 'app-ref-option-autocomplete',
  standalone: false,
  template: `
    <ng-container *ngIf="useNativeList; else materialAutocompleteMode">
      <input
        #inputElement
        type="text"
        class="ref-autocomplete-input"
        [ngModel]="searchTerm"
        (ngModelChange)="handleNativeInputChange($event)"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [attr.list]="datalistId"
        autocomplete="off"
        (focus)="handleNativeFocus()"
        (click)="handleNativeFocus()"
        (change)="handleNativeCommit()"
        (blur)="handleNativeBlur()"
      />

      <datalist [id]="datalistId">
        <option *ngFor="let item of filteredItems" [value]="item.label"></option>
      </datalist>
    </ng-container>

    <ng-template #materialAutocompleteMode>
      <input
        #inputElement
        type="text"
        class="ref-autocomplete-input"
        [ngModel]="searchTerm"
        (ngModelChange)="handleInputChange($event)"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [matAutocomplete]="auto"
        matAutocompletePosition="auto"
        autocomplete="off"
        (focus)="handleFocus()"
        (click)="handleFocus()"
        (blur)="handleBlur()"
      />

      <mat-autocomplete
        #auto="matAutocomplete"
        class="ref-autocomplete-panel"
        autoActiveFirstOption
        (optionSelected)="handleOptionSelected($event)"
      >
        <mat-option *ngFor="let item of filteredItems" [value]="item.label">
          {{ item.label }}
        </mat-option>
      </mat-autocomplete>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .ref-autocomplete-input {
      width: 100%;
      height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #0f172a;
      font-size: 13px;
      line-height: 36px;
      padding: 0 10px;
      text-align: center;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    }

    .ref-autocomplete-input::placeholder {
      color: #94a3b8;
      opacity: 1;
      text-align: center;
    }

    .ref-autocomplete-input:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
    }

    .ref-autocomplete-input:disabled {
      background: #f8fafc;
      color: #475569;
      cursor: not-allowed;
    }
  `]
})
export class RefOptionAutocompleteComponent implements OnChanges {
  @Input() items: RefOptionItem[] = [];
  @Input() placeholder: string = '';
  @Input() disabled: boolean = false;
  @Input() useNativeList: boolean = false;
  @Input() selectedValue: string | number | null = null;
  @Output() selectedValueChange = new EventEmitter<string | number | null>();
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger?: MatAutocompleteTrigger;
  @ViewChild('inputElement') inputElement?: ElementRef<HTMLInputElement>;

  searchTerm: string = '';
  private static nextInstanceId = 0;
  private isEditingSelection: boolean = false;
  private openPanelTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private suppressOpenUntil = 0;
  readonly datalistId = `ref-option-datalist-${RefOptionAutocompleteComponent.nextInstanceId++}`;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedValue'] || changes['items']) {
      this.syncSearchTermFromValue();
    }
  }

  get filteredItems(): RefOptionItem[] {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.items;
    }

    return this.items.filter((item) => {
      const label = String(item.label ?? '').toLowerCase();
      const value = String(item.value ?? '').toLowerCase();
      return label.includes(query) || value.includes(query);
    });
  }

  handleInputChange(value: string): void {
    this.searchTerm = value ?? '';

    this.openPanel();
  }

  handleFocus(): void {
    if (this.disabled) {
      return;
    }

    if (Date.now() < this.suppressOpenUntil) {
      return;
    }

    this.isEditingSelection = true;
    this.searchTerm = '';
    this.openPanel();
  }

  handleBlur(): void {
    setTimeout(() => {
      const query = this.searchTerm.trim();

      if (this.autocompleteTrigger?.panelOpen) {
        return;
      }

      if (!query) {
        this.isEditingSelection = false;
        this.syncSearchTermFromValue();
        return;
      }

      const match = this.findItemByLabelOrValue(query);

      if (match) {
        this.isEditingSelection = false;
        this.searchTerm = match.label;
        this.emitSelectedValue(match.value);
        return;
      }

      this.isEditingSelection = false;
      this.syncSearchTermFromValue();
    }, 150);
  }

  handleOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selected = this.findItemByLabelOrValue(event.option.value);

    if (!selected) {
      return;
    }

    this.isEditingSelection = false;
    this.searchTerm = selected.label;
    this.emitSelectedValue(selected.value);
    this.forceClosePanel();
  }

  handleNativeInputChange(value: string): void {
    this.searchTerm = value ?? '';
  }

  handleNativeFocus(): void {
    if (this.disabled) {
      return;
    }

    this.isEditingSelection = true;
    this.searchTerm = '';
  }

  handleNativeCommit(): void {
    const match = this.findItemByLabelOrValue(this.searchTerm);

    if (!match) {
      return;
    }

    this.isEditingSelection = false;
    this.searchTerm = match.label;
    this.emitSelectedValue(match.value);
    this.inputElement?.nativeElement.blur();
  }

  handleNativeBlur(): void {
    const match = this.findItemByLabelOrValue(this.searchTerm);

    this.isEditingSelection = false;

    if (match) {
      this.searchTerm = match.label;
      this.emitSelectedValue(match.value);
      return;
    }

    this.syncSearchTermFromValue();
  }

  private emitSelectedValue(value: string | number | null): void {
    this.selectedValueChange.emit(value);
  }

  private openPanel(): void {
    if (Date.now() < this.suppressOpenUntil) {
      return;
    }

    if (this.openPanelTimeoutId) {
      clearTimeout(this.openPanelTimeoutId);
    }

    this.openPanelTimeoutId = setTimeout(() => {
      if (Date.now() < this.suppressOpenUntil) {
        return;
      }

      this.autocompleteTrigger?.openPanel();
      this.openPanelTimeoutId = null;
    }, 0);
  }

  private forceClosePanel(): void {
    this.suppressOpenUntil = Date.now() + 400;

    if (this.openPanelTimeoutId) {
      clearTimeout(this.openPanelTimeoutId);
      this.openPanelTimeoutId = null;
    }

    this.autocompleteTrigger?.closePanel();

    queueMicrotask(() => {
      this.autocompleteTrigger?.closePanel();
    });

    setTimeout(() => {
      this.autocompleteTrigger?.closePanel();
      this.inputElement?.nativeElement.blur();
    }, 0);

    setTimeout(() => {
      this.autocompleteTrigger?.closePanel();
    }, 50);
  }

  private syncSearchTermFromValue(): void {
    if (this.isEditingSelection) {
      return;
    }

    this.searchTerm = this.findItemByValue(this.selectedValue)?.label ?? '';
  }

  private findItemByValue(value: string | number | null): RefOptionItem | undefined {
    return this.items.find((item) => item.value === value || String(item.value) === String(value));
  }

  private findItemByLabelOrValue(rawValue: string | number | null): RefOptionItem | undefined {
    const normalized = String(rawValue ?? '').trim().toLowerCase();

    return this.items.find((item) => {
      const itemLabel = String(item.label ?? '').trim().toLowerCase();
      const itemValue = String(item.value ?? '').trim().toLowerCase();
      return itemLabel === normalized || itemValue === normalized;
    });
  }
}