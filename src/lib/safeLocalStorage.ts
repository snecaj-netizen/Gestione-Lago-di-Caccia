class SafeLocalStorage {
  private inMemoryStorage: Record<string, string> = {};
  private hasChecked = false;
  private isStorageAvailable = false;

  private checkStorage(): boolean {
    if (this.hasChecked) {
      return this.isStorageAvailable;
    }
    this.hasChecked = true;
    try {
      if (typeof window === 'undefined') {
        this.isStorageAvailable = false;
        return false;
      }
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch (err) {
        this.isStorageAvailable = false;
        return false;
      }
      if (!storage) {
        this.isStorageAvailable = false;
        return false;
      }
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      this.isStorageAvailable = true;
      return true;
    } catch (e) {
      this.isStorageAvailable = false;
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.checkStorage()) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback
      }
    }
    return this.inMemoryStorage.hasOwnProperty(key) ? this.inMemoryStorage[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.checkStorage()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemoryStorage[key] = String(value);
  }

  removeItem(key: string): void {
    if (this.checkStorage()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    delete this.inMemoryStorage[key];
  }

  clear(): void {
    if (this.checkStorage()) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemoryStorage = {};
  }
}

class SafeSessionStorage {
  private inMemoryStorage: Record<string, string> = {};
  private hasChecked = false;
  private isStorageAvailable = false;

  private checkStorage(): boolean {
    if (this.hasChecked) {
      return this.isStorageAvailable;
    }
    this.hasChecked = true;
    try {
      if (typeof window === 'undefined') {
        this.isStorageAvailable = false;
        return false;
      }
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch (err) {
        this.isStorageAvailable = false;
        return false;
      }
      if (!storage) {
        this.isStorageAvailable = false;
        return false;
      }
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      this.isStorageAvailable = true;
      return true;
    } catch (e) {
      this.isStorageAvailable = false;
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.checkStorage()) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (e) {
        // Fallback
      }
    }
    return this.inMemoryStorage.hasOwnProperty(key) ? this.inMemoryStorage[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.checkStorage()) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemoryStorage[key] = String(value);
  }

  removeItem(key: string): void {
    if (this.checkStorage()) {
      try {
        window.sessionStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    delete this.inMemoryStorage[key];
  }

  clear(): void {
    if (this.checkStorage()) {
      try {
        window.sessionStorage.clear();
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemoryStorage = {};
  }
}

export const safeLocalStorage = new SafeLocalStorage();
export const safeSessionStorage = new SafeSessionStorage();
