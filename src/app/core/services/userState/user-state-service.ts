// user-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '../../../Interfaces/models-interface';

@Injectable({ providedIn: 'root' })

export class UserStateService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.userSubject.asObservable();

  constructor() {
    this.loadInitialState();
  }

  private loadInitialState(): void {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      this.userSubject.next(JSON.parse(userData));
    }
  }

  updateUser(updatedData: Partial<User>): void {
    const currentUser = this.userSubject.value;
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedData };
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      this.userSubject.next(newUser);
    }
  }

  getCurrentUser(): User | null {
    return this.userSubject.value;
  }
}