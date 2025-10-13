export function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

export function pickOne<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)];
}

export function pickMany<T>(
  rand: () => number,
  list: readonly T[],
  k: number,
): T[] {
  const copy = [...list];
  const out: T[] = [];
  for (let i = 0; i < Math.min(k, copy.length); i++) {
    const index = Math.floor(rand() * copy.length);
    out.push(copy.splice(index, 1)[0]);
  }
  return out;
}

export const GEO_POOL = [
  'US',
  'CA',
  'GB',
  'DE',
  'FR',
  'AU',
  'IN',
  'BR',
] as const;
export const DEVICE_POOL = ['desktop', 'mobile'] as const;
export const TAG_POOL = [
  'tech',
  'gaming',
  'news',
  'sports',
  'entertainment',
  'finance',
  'fashion',
  'automotive',
  'food',
  'travel',
  'home',
  'beauty',
] as const;

export const BRANDS = [
  'Acme',
  'Globex',
  'Initech',
  'Umbrella',
  'Soylent',
  'Vandelay',
  'Stark',
  'Wayne',
  'Wonka',
  'Tyrell',
  'Hooli',
  'Aperture',
] as const;

export function makeUuid(): string {
  return crypto.randomUUID();
}
