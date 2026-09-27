import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type Vehicle = {
  id: string;
  ownerId: string;
  ownerTag: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  year: number;
  status: "active" | "suspended";
  createdAt: string;
};

export type License = {
  userId: string;
  userTag: string;
  name: string;
  className: string;
  expiresAt: string;
  status: "valid" | "suspended" | "expired";
  issuedAt: string;
};

export type Inspection = {
  id: string;
  plate: string;
  inspectorId: string;
  inspectorTag: string;
  result: "passed" | "failed";
  notes: string;
  inspectedAt: string;
};

export type Appointment = {
  id: string;
  userId: string;
  userTag: string;
  service: string;
  date: string;
  notes: string;
  status: "booked" | "cancelled" | "completed";
};

export type Store = {
  vehicles: Vehicle[];
  licenses: License[];
  inspections: Inspection[];
  appointments: Appointment[];
};

const dataPath = path.join(process.cwd(), "data", "records.json");
const emptyStore: Store = { vehicles: [], licenses: [], inspections: [], appointments: [] };

export async function loadStore(): Promise<Store> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  try {
    const raw = await readFile(dataPath, "utf8");
    return { ...emptyStore, ...JSON.parse(raw) } as Store;
  } catch {
    await saveStore(emptyStore);
    return structuredClone(emptyStore);
  }
}

export async function saveStore(store: Store): Promise<void> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}