// Safe LocalStorage & SessionStorage wrapper with Cookie and In-Memory fallback

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()!.split(';').shift() || '');
    }
  } catch (e) {}
  return null;
}

function setCookie(name: string, value: string, days = 365) {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {}
}

function removeCookie(name: string) {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch (e) {}
}

class SafeLocalStorage {
  private inMemoryStorage: Record<string, string> = {};

  private getNativeStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const testKey = '__test_ls__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return window.localStorage;
      }
    } catch (e) {
      // Storage access blocked or restricted
    }
    return null;
  }

  getItem(key: string): string | null {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        const val = storage.getItem(key);
        if (val !== null) return val;
      } catch (e) {}
    }

    // Cookie fallback for critical keys
    const cookieVal = getCookie(key);
    if (cookieVal !== null) {
      return cookieVal;
    }

    return this.inMemoryStorage.hasOwnProperty(key) ? this.inMemoryStorage[key] : null;
  }

  setItem(key: string, value: string): void {
    const strVal = String(value);
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.setItem(key, strVal);
      } catch (e) {}
    }

    // Always mirror to cookie for critical app session keys
    if (key.startsWith('lake_')) {
      setCookie(key, strVal);
    }

    this.inMemoryStorage[key] = strVal;
  }

  removeItem(key: string): void {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch (e) {}
    }

    if (key.startsWith('lake_')) {
      removeCookie(key);
    }

    delete this.inMemoryStorage[key];
  }

  clear(): void {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.clear();
      } catch (e) {}
    }
    this.inMemoryStorage = {};
  }
}

class SafeSessionStorage {
  private inMemoryStorage: Record<string, string> = {};

  private getNativeStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const testKey = '__test_ss__';
        window.sessionStorage.setItem(testKey, '1');
        window.sessionStorage.removeItem(testKey);
        return window.sessionStorage;
      }
    } catch (e) {
      // Storage access blocked or restricted
    }
    return null;
  }

  getItem(key: string): string | null {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        const val = storage.getItem(key);
        if (val !== null) return val;
      } catch (e) {}
    }
    return this.inMemoryStorage.hasOwnProperty(key) ? this.inMemoryStorage[key] : null;
  }

  setItem(key: string, value: string): void {
    const strVal = String(value);
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.setItem(key, strVal);
      } catch (e) {}
    }
    this.inMemoryStorage[key] = strVal;
  }

  removeItem(key: string): void {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch (e) {}
    }
    delete this.inMemoryStorage[key];
  }

  clear(): void {
    const storage = this.getNativeStorage();
    if (storage) {
      try {
        storage.clear();
      } catch (e) {}
    }
    this.inMemoryStorage = {};
  }
}

export const safeLocalStorage = new SafeLocalStorage();
export const safeSessionStorage = new SafeSessionStorage();
