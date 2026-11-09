import { PUBLIC_GATEWAY_URL } from '@/lib/marketplace';

export interface TrialKeyInfo {
  apiKey: string;
  balanceCny: string;
  balanceBaseUnits: number;
  singleTxCapCny: string;
  rateLimitRpm: number;
  expiresAt: number;
  expiresInHours: number;
  claimUrl: string;
  claimedAt: number;
}

const STORAGE_KEY = 'agentfinops_trial_key_info';

/**
 * Retrieves the stored trial key info from localStorage if present and not expired.
 */
export function getStoredTrialKey(): TrialKeyInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as TrialKeyInfo;
    if (!info.apiKey || !info.expiresAt) return null;

    // Check expiration (expiresAt is epoch in seconds)
    if (info.expiresAt * 1000 <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

/**
 * Saves trial key info into localStorage.
 */
export function saveStoredTrialKey(info: TrialKeyInfo): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {}
}

/**
 * Removes the stored trial key info from localStorage.
 */
export function clearStoredTrialKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Requests a new guest trial API key from the gateway.
 */
export async function requestTrialKey(): Promise<TrialKeyInfo> {
  const endpoint = `${PUBLIC_GATEWAY_URL}/api/v1/public/marketplace/trial-key`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_fingerprint:
        typeof window !== 'undefined'
          ? `${window.navigator.userAgent.slice(0, 32)}`
          : 'web_guest',
    }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    const message =
      errData?.error?.message ||
      (resp.status === 429
        ? '当前 IP 申领过于频繁，请直接登录控制台获取长期免费 API Key'
        : '申领试用 Key 失败，请稍后重试');
    throw new Error(message);
  }

  const data = await resp.json();
  const info: TrialKeyInfo = {
    apiKey: data.api_key,
    balanceCny: data.balance_cny || '5.00',
    balanceBaseUnits: data.balance_base_units || 5000000,
    singleTxCapCny: data.single_tx_cap_cny || '0.50',
    rateLimitRpm: data.rate_limit_rpm || 6,
    expiresAt: data.expires_at || Math.floor(Date.now() / 1000) + 86400,
    expiresInHours: data.expires_in_hours || 24,
    claimUrl: data.claim_url || 'https://console.aipmedia.cn',
    claimedAt: Date.now(),
  };

  saveStoredTrialKey(info);
  return info;
}
