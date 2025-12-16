import { AppData } from '../types';

const DB_NAME = 'FitLogProDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const DATA_KEY = 'root_data';

export const db = {
  open: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  },

  save: async (data: AppData, userId: string = DATA_KEY): Promise<void> => {
    try {
      const database = await db.open();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, userId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB Save Error:", error);
      throw error;
    }
  },

  load: async (userId: string = DATA_KEY): Promise<AppData | null> => {
    try {
      const database = await db.open();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB Load Error:", error);
      return null;
    }
  },
  
  getEstimate: async (): Promise<{ usage: number, quota: number } | null> => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return null;
  }
};