import { Injectable, signal } from '@angular/core';
import { IssueRepositoryTreeNode } from '../../../core/models/issue-objects.models';

export type CreateFlag = 'new-object' | 'new-category' | null;

@Injectable({
  providedIn: 'root'
})
export class RepositorySelectionService {
  readonly searchQuery = signal<string>('');
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedObjectId = signal<string | null>(null);
  readonly createFlag = signal<CreateFlag>(null);

  setSearch(query: string): void {
    this.searchQuery.set(query);
  }

  selectCategory(id: string | null): void {
    this.selectedCategoryId.set(id);
    if (id !== null) {
      this.selectedObjectId.set(null);
      this.createFlag.set(null);
    }
  }

  selectObject(id: string | null): void {
    this.selectedObjectId.set(id);
    if (id !== null) {
      this.selectedCategoryId.set(null);
      this.createFlag.set(null);
    }
  }

  requestCreateObject(): void {
    this.selectedObjectId.set(null);
    this.selectedCategoryId.set(null);
    this.createFlag.set('new-object');
  }

  requestCreateCategory(): void {
    this.selectedObjectId.set(null);
    this.selectedCategoryId.set(null);
    this.createFlag.set('new-category');
  }

  clearCreateFlag(): void {
    this.createFlag.set(null);
  }

  clear(): void {
    this.searchQuery.set('');
    this.selectedCategoryId.set(null);
    this.selectedObjectId.set(null);
    this.createFlag.set(null);
  }

  findObjectInTree(tree: IssueRepositoryTreeNode[], id: string): IssueRepositoryTreeNode | null {
    for (const node of tree) {
      if (node.type === 'object' && node.id === id) {
        return node;
      }
      if (node.type === 'category' && node.children) {
        const found = this.findObjectInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  findCategoryInTree(tree: IssueRepositoryTreeNode[], id: string): IssueRepositoryTreeNode | null {
    for (const node of tree) {
      if (node.type === 'category' && node.id === id) {
        return node;
      }
      if (node.type === 'category' && node.children) {
        const found = this.findCategoryInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }
}
