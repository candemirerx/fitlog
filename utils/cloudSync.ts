// cloudSync.ts - Firestore Cloud Sync Utility
import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db as firestore } from '../firebase';
import { AppData } from '../types';

const COLLECTION_NAME = 'userData';

export const cloudSync = {
    /**
     * Save user data to Firestore
     */
    save: async (data: AppData, userId: string): Promise<void> => {
        try {
            const userDocRef = doc(firestore, COLLECTION_NAME, userId);
            await setDoc(userDocRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            console.log('Cloud sync: Data saved successfully');
        } catch (error) {
            console.error('Cloud sync save error:', error);
            throw error;
        }
    },

    /**
     * Load user data from Firestore
     */
    load: async (userId: string): Promise<AppData | null> => {
        try {
            const userDocRef = doc(firestore, COLLECTION_NAME, userId);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Remove the updatedAt field before returning
                const { updatedAt, ...appData } = data;
                return appData as AppData;
            }
            return null;
        } catch (error) {
            console.error('Cloud sync load error:', error);
            return null;
        }
    },

    /**
     * Subscribe to real-time updates for user data
     */
    subscribe: (userId: string, onDataChange: (data: AppData) => void): Unsubscribe => {
        const userDocRef = doc(firestore, COLLECTION_NAME, userId);

        return onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const { updatedAt, ...appData } = data;
                onDataChange(appData as AppData);
            }
        }, (error) => {
            console.error('Cloud sync subscription error:', error);
        });
    }
};
