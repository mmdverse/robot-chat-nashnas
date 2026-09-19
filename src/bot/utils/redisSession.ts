import Redis from 'ioredis';
import { StorageAdapter } from 'grammy';
import { SessionData } from '../../types/context';

/**
 * نگه‌داشتن نشست کاربران در Redis.
 *
 * README می‌گفت «Redis — Caching (optional)» و `ioredis` نصب بود، ولی هیچ‌جا
 * import نمی‌شد و `REDIS_URL` هم بی‌استفاده بود. با این آداپتور، اگر
 * REDIS_URL تنظیم شده باشد نشست‌ها بین رستارت‌ها و بین نمونه‌های ربات مشترک
 * می‌مانند؛ وگرنه همان حافظهٔ پیش‌فرض grammy استفاده می‌شود.
 */
export class RedisSessionStorage implements StorageAdapter<SessionData> {
  constructor(private readonly redis: Redis, private readonly ttlSeconds = 24 * 60 * 60) {}

  async read(key: string): Promise<SessionData | undefined> {
    const raw = await this.redis.get(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      // دادهٔ خراب ⇒ مثل نبودن نشست رفتار می‌کنیم
      return undefined;
    }
  }

  async write(key: string, value: SessionData): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export interface RedisSessionOptions {
  storage?: RedisSessionStorage;
  client?: Redis;
}

/**
 * اگر REDIS_URL داده شده باشد، تلاش می‌کند وصل شود.
 * در صورت شکست (سرور پایین، آدرس غلط) ربات با حافظهٔ پیش‌فرض بالا می‌آید؛
 * پایین آمدن ربات به‌خاطر یک کش اختیاری منطقی نیست.
 */
export async function tryRedisSessionStorage(url: string): Promise<RedisSessionOptions> {
  if (!url) return {};

  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  client.on('error', () => {
    // خطاها در همان لحظهٔ وصل شدن مدیریت می‌شوند
  });

  try {
    await client.connect();
    await client.ping();
    return { storage: new RedisSessionStorage(client), client };
  } catch {
    client.disconnect();
    return {};
  }
}
