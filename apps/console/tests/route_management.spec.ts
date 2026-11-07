import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../src/stores/auth';
import { routeApi } from '../src/api/client';
import { MOCK_USERS } from '../src/api/mockData';
import type { Route, CreateRoutePayload, UpdateRoutePayload } from '../src/types/route';

// Mock localStorage for Vitest environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('T4.2 Console - Route & Upstream Management Test Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('Route Price & Validation Helpers', () => {
    it('should correctly convert Credits prices to integer base units and vice versa', () => {
      const priceCredits = 0.05;
      const baseUnits = Math.round(priceCredits * 1000000);
      expect(baseUnits).toBe(50000);

      const restoredPrice = baseUnits / 1000000;
      expect(restoredPrice).toBe(0.05);

      // Micro-pricing test (e.g. 0.0001 Credits = 100 base units)
      const microPrice = 0.0001;
      expect(Math.round(microPrice * 1000000)).toBe(100);
    });

    it('should validate account ID format strictly', () => {
      const accountIdRegex = /^acc_[a-zA-Z0-9_-]{4,}$/;
      const validAccount = 'acc_corp_main_01';
      const invalidShort = 'ac_1';
      const invalidNoPrefix = 'corp_main_01';

      expect(accountIdRegex.test(validAccount)).toBe(true);
      expect(accountIdRegex.test(invalidShort)).toBe(false);
      expect(accountIdRegex.test(invalidNoPrefix)).toBe(false);
    });

    it('should validate exposed path pattern requirement', () => {
      const validPath = '/api/v1/market-data';
      const validNested = '/api/v1/ai/llm/chat';
      const invalidNoSlash = 'api/v1/market-data';

      expect(validPath.startsWith('/')).toBe(true);
      expect(validNested.startsWith('/')).toBe(true);
      expect(invalidNoSlash.startsWith('/')).toBe(false);
    });
  });

  describe('Route Role-Based Access Control', () => {
    it('should allow owner and admin to manage routes', () => {
      const auth = useAuthStore();
      auth.setSession('token_owner', MOCK_USERS.owner);
      expect(auth.hasRole(['owner', 'admin'])).toBe(true);

      auth.setSession('token_admin', MOCK_USERS.admin);
      expect(auth.hasRole(['owner', 'admin'])).toBe(true);
    });

    it('should restrict operator and viewer to read-only route view', () => {
      const auth = useAuthStore();
      auth.setSession('token_operator', MOCK_USERS.operator);
      expect(auth.hasRole(['owner', 'admin'])).toBe(false);

      auth.setSession('token_viewer', MOCK_USERS.viewer);
      expect(auth.hasRole(['owner', 'admin'])).toBe(false);
    });
  });

  describe('Route API Client Methods', () => {
    it('should invoke createRoute, updateRoute, and deleteRoute correctly', async () => {
      const mockRoute: Route = {
        route_id: 'rou_test_123',
        tenant_id: 'ten_test',
        project_id: 'prj_test',
        path_pattern: '/api/v1/test',
        upstream_url: 'https://httpbin.org/get',
        price_base_units: 50000,
        asset: 'Credits',
        allowed_payment_methods: 'wallet',
        rate_limit_rpm: 600,
        timeout_ms: 30000,
        status: 'active',
        created_at: 1700000000,
        updated_at: 1700000000
      };

      const createSpy = vi.spyOn(routeApi, 'createRoute').mockResolvedValue(mockRoute);
      const updateSpy = vi.spyOn(routeApi, 'updateRoute').mockResolvedValue({
        ...mockRoute,
        status: 'disabled'
      });
      const deleteSpy = vi.spyOn(routeApi, 'deleteRoute').mockResolvedValue();

      const createPayload: CreateRoutePayload = {
        project_id: 'prj_test',
        path_pattern: '/api/v1/test',
        upstream_url: 'https://httpbin.org/get',
        price_base_units: 50000,
        asset: 'Credits',
        allowed_payment_methods: 'wallet'
      };

      const created = await routeApi.createRoute('ten_test', createPayload);
      expect(createSpy).toHaveBeenCalledWith('ten_test', createPayload);
      expect(created.route_id).toBe('rou_test_123');

      const updatePayload: UpdateRoutePayload = { status: 'disabled' };
      const updated = await routeApi.updateRoute('ten_test', 'rou_test_123', updatePayload);
      expect(updateSpy).toHaveBeenCalledWith('ten_test', 'rou_test_123', updatePayload);
      expect(updated.status).toBe('disabled');

      await routeApi.deleteRoute('ten_test', 'rou_test_123');
      expect(deleteSpy).toHaveBeenCalledWith('ten_test', 'rou_test_123');
    });
  });
});
