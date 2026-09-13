import { program, connection } from "../provider";
import { PROGRAM_ID } from "../config";

// Получить все аккаунты определённого типа с фильтрами
export async function fetchAll(accountName: string, filters: any[] = []) {
  return (program.account as any)[accountName].all(filters);
}

// Получить один аккаунт по адресу (возвращает null если не найден)
export async function fetchOne(accountName: string, address: any) {
  try {
    return await (program.account as any)[accountName].fetch(address);
  } catch {
    return null;
  }
}

// Фильтр по смещению в данных аккаунта (для поиска по владельцу/минту)
export function memcmpFilter(offset: number, bytesBase58: string) {
  return { memcmp: { offset, bytes: bytesBase58 } };
}

export { connection, PROGRAM_ID };
