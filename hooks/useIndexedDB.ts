"use client";

import { useEffect, useState } from "react";

/**
 * IndexedDB hook for storing large binary data (images).
 * IndexedDB is preferred over localStorage for images because:
 * - localStorage has a ~5-10MB size limit
 * - localStorage stores data as strings (base64), which is inefficient
 * - IndexedDB can handle much larger files (hundreds of MB+)
 * - IndexedDB is asynchronous and doesn't block the main thread
 */

const DB_NAME = "spline-editor-db";
const DB_VERSION = 1;
const STORE_NAME = "images";

interface ImageData {
  id: string;
  data: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function getImage(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as ImageData | undefined;
        resolve(result?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting image from IndexedDB:", error);
    return null;
  }
}

async function setImage(key: string, data: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: key, data });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error setting image in IndexedDB:", error);
  }
}

async function deleteImage(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error deleting image from IndexedDB:", error);
  }
}

export function useIndexedDBImage(key: string) {
  const [image, setImageState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      let data = await getImage(key);

      // Migration: Check localStorage for old image data
      if (!data && typeof window !== "undefined") {
        const oldKey = "spline-editor-image";
        try {
          const oldData = window.localStorage.getItem(oldKey);
          if (oldData) {
            const parsed = JSON.parse(oldData);
            if (typeof parsed === "string" && parsed.startsWith("data:image")) {
              // Migrate to IndexedDB
              await setImage(key, parsed);
              data = parsed;
              // Remove from localStorage
              window.localStorage.removeItem(oldKey);
            }
          }
        } catch (error) {
          console.error("Error migrating image from localStorage:", error);
        }
      }

      setImageState(data);
      setIsLoaded(true);
    };

    loadImage();
  }, [key]);

  const updateImage = async (data: string | null) => {
    if (data === null) {
      await deleteImage(key);
      setImageState(null);
    } else {
      await setImage(key, data);
      setImageState(data);
    }
  };

  const removeImage = async () => {
    await deleteImage(key);
    setImageState(null);
  };

  return [image, updateImage, removeImage, isLoaded] as const;
}
