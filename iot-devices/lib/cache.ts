import debug from 'debug';
import { createClient } from 'redis';

const log = debug('devices:cache');

type RedisClient = ReturnType<typeof createClient>;

const registeredKeys: string[] = [];
let client: RedisClient;

const REDIS_URL = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

export async function init(): Promise<void> {
    client = await createClient({ url: REDIS_URL })
        .on('error', (err) => log('Redis Client Error', err))
        .connect();
}

export async function get(key: string): Promise<string | null> {
    return client.get(key);
}

export async function set(key: string, value: string): Promise<string | null> {
    if (!registeredKeys.includes(key)) {
        registeredKeys.push(key);
    }
    return client.set(key, value);
}

export function setCacheValues(data: Record<string, string>): void {
    Object.entries(data).forEach(async ([key, value]) => {
        if (!registeredKeys.includes(key)) {
            registeredKeys.push(key);
        }
        log(`${key}, ${value}`);
        await client.set(key, value);
    });
}

export function keys(): string[] {
    return registeredKeys;
}

export function exists(key: string): boolean {
    return registeredKeys.includes(key);
}
