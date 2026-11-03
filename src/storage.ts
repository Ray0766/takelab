import type { Project } from "./model";
import { parseProject } from "./model";

let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("takelab", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("project");
      request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error("Close other TakeLab tabs and reload."));
    };
  });
  return connection;
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
export async function loadProject() {
  const value = await read<unknown>("project", "active");
  return value ? parseProject(value) : undefined;
}
export const readMedia = (id: string) => read<Blob>("media", id);
export async function saveProject(project: Project) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("project", "readwrite");
    tx.objectStore("project").put(project, "active");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error("Could not save the project."));
  });
}
export async function writeMedia(id: string, blob: Blob) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ??
          new Error(
            "Local storage is full. Export a backup and free disk space.",
          ),
      );
  });
}
// The frame and its marker/decision references commit together, or not at all.
export async function saveProjectWithMedia(
  project: Project,
  media: Map<string, Blob>,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["project", "media"], "readwrite");
    for (const [id, blob] of media) tx.objectStore("media").put(blob, id);
    tx.objectStore("project").put(project, "active");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ??
          new Error("Could not save the frame. Free disk space and retry."),
      );
  });
}
// Atomic replacement: failures leave the previous project and its sources intact.
export async function replaceProject(
  project: Project,
  media: Map<string, Blob>,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["project", "media"], "readwrite");
    tx.objectStore("media").clear();
    for (const [id, blob] of media) tx.objectStore("media").put(blob, id);
    tx.objectStore("project").put(project, "active");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ??
          new Error(
            "Could not restore project. Your existing project is unchanged.",
          ),
      );
  });
}
export async function removeProjectMedia(project: Project, ids: string[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["project", "media"], "readwrite");
    ids.forEach((id) => tx.objectStore("media").delete(id));
    tx.objectStore("project").put(project, "active");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
