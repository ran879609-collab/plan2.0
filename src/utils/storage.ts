import {
  Shipment,
  InventoryItem,
  InventoryLedgerEntry,
  CaseRecord,
  Product,
  AuditLog,
  AnomalyItem,
  AppSettings,
  FreightShippingItem,
} from '../types';
import { generateDemoData, generateDemoFreightData } from './demoData';
import { calculateShipmentMetrics } from './statusCalculator';
import { getTodayString } from './dateUtils';
import { cloudStorage } from '../services/cloudStorage';

const STORAGE_KEYS = {
  SHIPMENTS: 'wmt_shipments_v1',
  INVENTORY: 'wmt_inventory_v1',
  LEDGER: 'wmt_ledger_v1',
  CASES: 'wmt_cases_v1',
  PRODUCTS: 'wmt_products_v1',
  AUDIT_LOGS: 'wmt_audit_logs_v1',
  ANOMALIES: 'wmt_anomalies_v1',
  SETTINGS: 'wmt_settings_v1',
  IS_DEMO: 'wmt_is_demo_mode_v1',
  FREIGHT_ITEMS: 'wmt_freight_items_v1',
  FREIGHT_ACTUALS: 'wmt_freight_actuals_v1',
  FREIGHT_SYNCED_SHIPMENTS: 'wmt_freight_synced_shipments_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  caseRuleDays: 10,
  caseEligibilityDays: 10,
  approachingAlertDays: 3,
  approachingDaysWarning: 3,
  autoStatusCalculation: true,
  autoCalculateCase: true,
  autoCloseCaseOnReceipt: true,
  allowNegativeInventory: false,
  strictArrivalDateRequired: true,
};

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type SyncListener = (status: CloudSyncStatus, error?: string) => void;

export class AppStorage {
  private static isInitialized = false;
  private static currentUserId: string | null = null;
  private static syncStatus: CloudSyncStatus = 'idle';
  private static syncListeners: Set<SyncListener> = new Set();

  // In-memory caching layer
  private static _shipments: Shipment[] = [];
  private static _inventory: InventoryItem[] = [];
  private static _cases: CaseRecord[] = [];
  private static _ledger: InventoryLedgerEntry[] = [];
  private static _products: Product[] = [];
  private static _auditLogs: AuditLog[] = [];
  private static _anomalies: AnomalyItem[] = [];
  private static _settings: AppSettings = DEFAULT_SETTINGS;
  private static _isDemo = false;
  private static _freightItems: FreightShippingItem[] = [];
  private static _freightActuals: Record<string, any> = {};
  private static _syncedShipmentIds: string[] = [];

  // =============================================================
  // Sync Status Listeners
  // =============================================================
  public static onSyncStatusChange(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.syncStatus);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private static setSyncStatus(status: CloudSyncStatus, error?: string): void {
    this.syncStatus = status;
    this.syncListeners.forEach((listener) => {
      try {
        listener(status, error);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  public static getSyncStatus(): CloudSyncStatus {
    return this.syncStatus;
  }

  public static setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  public static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // =============================================================
  // Primary Cloud Loader (Invoked after user authentication)
  // =============================================================
  public static async loadFromCloud(userId: string): Promise<{
    shipments: Shipment[];
    inventory: InventoryItem[];
    ledger: InventoryLedgerEntry[];
    cases: CaseRecord[];
    products: Product[];
    auditLogs: AuditLog[];
    anomalies: AnomalyItem[];
    settings: AppSettings;
    isDemo: boolean;
    freightItems: FreightShippingItem[];
    freightActuals: Record<string, any>;
    syncedShipmentIds: string[];
    isNewUser: boolean;
  }> {
    this.currentUserId = userId;
    this.setSyncStatus('syncing');

    try {
      // Parallel fetch from Supabase
      const [
        cloudShipments,
        cloudInventory,
        cloudCases,
        cloudLedger,
        cloudProducts,
        cloudAuditLogs,
        cloudAnomalies,
        cloudFreightItems,
        cloudFreightActuals,
        cloudSettingsData,
      ] = await Promise.all([
        cloudStorage.fetchShipments(userId),
        cloudStorage.fetchInventory(userId),
        cloudStorage.fetchCases(userId),
        cloudStorage.fetchLedger(userId),
        cloudStorage.fetchProducts(userId),
        cloudStorage.fetchAuditLogs(userId),
        cloudStorage.fetchAnomalies(userId),
        cloudStorage.fetchFreightItems(userId),
        cloudStorage.fetchFreightActuals(userId),
        cloudStorage.fetchSettings(userId),
      ]);

      const isNewUser =
        cloudShipments.length === 0 &&
        cloudInventory.length === 0 &&
        cloudCases.length === 0 &&
        cloudFreightItems.length === 0;

      const activeSettings = cloudSettingsData?.settings || DEFAULT_SETTINGS;
      const isDemo = cloudSettingsData?.isDemo || false;
      const syncedShipmentIds = cloudSettingsData?.syncedShipmentIds || [];

      // Update in-memory cache
      this._shipments = cloudShipments;
      this._inventory = cloudInventory;
      this._cases = cloudCases;
      this._ledger = cloudLedger;
      this._products = cloudProducts;
      this._auditLogs = cloudAuditLogs;
      this._anomalies = cloudAnomalies;
      this._settings = activeSettings;
      this._isDemo = isDemo;
      this._freightItems = cloudFreightItems;
      this._freightActuals = cloudFreightActuals;
      this._syncedShipmentIds = syncedShipmentIds;

      // Update local storage mirror
      this.syncCacheToLocalStorage();

      this.isInitialized = true;
      this.setSyncStatus('synced');

      return {
        shipments: this._shipments,
        inventory: this._inventory,
        ledger: this._ledger,
        cases: this._cases,
        products: this._products,
        auditLogs: this._auditLogs,
        anomalies: this._anomalies,
        settings: this._settings,
        isDemo: this._isDemo,
        freightItems: this._freightItems,
        freightActuals: this._freightActuals,
        syncedShipmentIds: this._syncedShipmentIds,
        isNewUser,
      };
    } catch (err: any) {
      console.error('Failed to load data from Supabase cloud:', err);
      this.setSyncStatus('error', err.message || '从云端同步数据失败');
      throw err;
    }
  }

  // =============================================================
  // Legacy / Local Cache Initialization
  // =============================================================
  public static initialize(): {
    shipments: Shipment[];
    inventory: InventoryItem[];
    ledger: InventoryLedgerEntry[];
    cases: CaseRecord[];
    products: Product[];
    auditLogs: AuditLog[];
    settings: AppSettings;
    isDemo: boolean;
  } {
    try {
      const storedShipments = localStorage.getItem(STORAGE_KEYS.SHIPMENTS);
      const storedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      const storedLedger = localStorage.getItem(STORAGE_KEYS.LEDGER);
      const storedCases = localStorage.getItem(STORAGE_KEYS.CASES);
      const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const storedAuditLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const storedIsDemo = localStorage.getItem(STORAGE_KEYS.IS_DEMO);
      const storedFreight = localStorage.getItem(STORAGE_KEYS.FREIGHT_ITEMS);
      const storedActuals = localStorage.getItem(STORAGE_KEYS.FREIGHT_ACTUALS);

      this._shipments = storedShipments ? JSON.parse(storedShipments) : [];
      this._inventory = storedInventory ? JSON.parse(storedInventory) : [];
      this._ledger = storedLedger ? JSON.parse(storedLedger) : [];
      this._cases = storedCases ? JSON.parse(storedCases) : [];
      this._products = storedProducts ? JSON.parse(storedProducts) : [];
      this._auditLogs = storedAuditLogs ? JSON.parse(storedAuditLogs) : [];
      this._settings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;
      this._isDemo = storedIsDemo === 'true';
      this._freightItems = storedFreight ? JSON.parse(storedFreight) : [];
      this._freightActuals = storedActuals ? JSON.parse(storedActuals) : {};

      this.isInitialized = true;
      return {
        shipments: this._shipments,
        inventory: this._inventory,
        ledger: this._ledger,
        cases: this._cases,
        products: this._products,
        auditLogs: this._auditLogs,
        settings: this._settings,
        isDemo: this._isDemo,
      };
    } catch (e) {
      console.error('Failed to initialize local storage cache:', e);
      return {
        shipments: [],
        inventory: [],
        ledger: [],
        cases: [],
        products: [],
        auditLogs: [],
        settings: DEFAULT_SETTINGS,
        isDemo: false,
      };
    }
  }

  private static syncCacheToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(this._shipments));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this._inventory));
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(this._cases));
      localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(this._ledger));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this._products));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this._auditLogs));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this._settings));
      localStorage.setItem(STORAGE_KEYS.IS_DEMO, this._isDemo ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEYS.FREIGHT_ITEMS, JSON.stringify(this._freightItems));
      localStorage.setItem(STORAGE_KEYS.FREIGHT_ACTUALS, JSON.stringify(this._freightActuals));
      localStorage.setItem(STORAGE_KEYS.FREIGHT_SYNCED_SHIPMENTS, JSON.stringify(this._syncedShipmentIds));
    } catch (e) {
      console.warn('Unable to mirror cache to localStorage:', e);
    }
  }

  // =============================================================
  // Synchronous Getters (Return in-memory cache)
  // =============================================================
  public static getShipments(): Shipment[] {
    if (this._shipments.length > 0) return this._shipments;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHIPMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getInventory(): InventoryItem[] {
    if (this._inventory.length > 0) return this._inventory;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getCases(): CaseRecord[] {
    if (this._cases.length > 0) return this._cases;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CASES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getLedger(): InventoryLedgerEntry[] {
    if (this._ledger.length > 0) return this._ledger;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEDGER);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getProducts(): Product[] {
    if (this._products.length > 0) return this._products;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getAuditLogs(): AuditLog[] {
    if (this._auditLogs.length > 0) return this._auditLogs;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getAnomalies(): AnomalyItem[] {
    if (this._anomalies.length > 0) return this._anomalies;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANOMALIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getSettings(): AppSettings {
    if (this._settings) return this._settings;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public static getIsDemo(): boolean {
    return this._isDemo;
  }

  public static getFreightItems(): FreightShippingItem[] {
    if (this._freightItems.length > 0) return this._freightItems;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FREIGHT_ITEMS);
      if (data) return JSON.parse(data);
      return [];
    } catch {
      return [];
    }
  }

  public static getFreightActuals(): Record<string, any> {
    if (Object.keys(this._freightActuals).length > 0) return this._freightActuals;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FREIGHT_ACTUALS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public static getSyncedShipmentIds(): string[] {
    if (this._syncedShipmentIds.length > 0) return this._syncedShipmentIds;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FREIGHT_SYNCED_SHIPMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // =============================================================
  // Setters / Savers (Async Cloud Sync + Local Cache Update)
  // =============================================================
  public static async saveShipments(shipments: Shipment[]): Promise<void> {
    this._shipments = shipments;
    localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(shipments));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertShipments(this.currentUserId, shipments);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving shipments to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveInventory(inventory: InventoryItem[]): Promise<void> {
    this._inventory = inventory;
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertInventory(this.currentUserId, inventory);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving inventory to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveLedger(ledger: InventoryLedgerEntry[]): Promise<void> {
    this._ledger = ledger;
    localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(ledger));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertLedger(this.currentUserId, ledger);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving ledger to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveCases(cases: CaseRecord[]): Promise<void> {
    this._cases = cases;
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertCases(this.currentUserId, cases);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving cases to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveProducts(products: Product[]): Promise<void> {
    this._products = products;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertProducts(this.currentUserId, products);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving products to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveAuditLogs(auditLogs: AuditLog[]): Promise<void> {
    this._auditLogs = auditLogs;
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      try {
        await cloudStorage.upsertAuditLogs(this.currentUserId, auditLogs);
      } catch (err) {
        console.error('Error saving audit logs to cloud:', err);
      }
    }
  }

  public static async saveAnomalies(anomalies: AnomalyItem[]): Promise<void> {
    this._anomalies = anomalies;
    localStorage.setItem(STORAGE_KEYS.ANOMALIES, JSON.stringify(anomalies));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      try {
        await cloudStorage.upsertAnomalies(this.currentUserId, anomalies);
      } catch (err) {
        console.error('Error saving anomalies to cloud:', err);
      }
    }
  }

  public static async saveSettings(settings: AppSettings): Promise<void> {
    this._settings = settings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertSettings(
          this.currentUserId,
          settings,
          this._isDemo,
          this._syncedShipmentIds
        );
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving settings to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static saveIsDemo(isDemo: boolean): void {
    this._isDemo = isDemo;
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, isDemo ? 'true' : 'false');

    if (this.currentUserId && cloudStorage.isConfigured()) {
      cloudStorage.upsertSettings(
        this.currentUserId,
        this._settings,
        isDemo,
        this._syncedShipmentIds
      ).catch(console.error);
    }
  }

  public static async saveFreightItems(items: FreightShippingItem[]): Promise<void> {
    this._freightItems = items;
    localStorage.setItem(STORAGE_KEYS.FREIGHT_ITEMS, JSON.stringify(items));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertFreightItems(this.currentUserId, items);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving freight items to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveFreightActuals(actuals: Record<string, any>): Promise<void> {
    this._freightActuals = actuals;
    localStorage.setItem(STORAGE_KEYS.FREIGHT_ACTUALS, JSON.stringify(actuals));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.upsertFreightActuals(this.currentUserId, actuals);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error saving freight actuals to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  public static async saveSyncedShipmentIds(ids: string[]): Promise<void> {
    this._syncedShipmentIds = ids;
    localStorage.setItem(STORAGE_KEYS.FREIGHT_SYNCED_SHIPMENTS, JSON.stringify(ids));

    if (this.currentUserId && cloudStorage.isConfigured()) {
      try {
        await cloudStorage.upsertSettings(
          this.currentUserId,
          this._settings,
          this._isDemo,
          ids
        );
      } catch (err) {
        console.error('Error saving synced shipment IDs to cloud:', err);
      }
    }
  }

  public static logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newLog: AuditLog = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const updated = [newLog, ...this.getAuditLogs()].slice(0, 500);
    this.saveAuditLogs(updated);
  }

  public static async saveAll(data: {
    shipments: Shipment[];
    inventory: InventoryItem[];
    ledger: InventoryLedgerEntry[];
    cases: CaseRecord[];
    products: Product[];
    auditLogs: AuditLog[];
    settings: AppSettings;
    isDemo: boolean;
    freightItems?: FreightShippingItem[];
    freightActuals?: Record<string, any>;
  }): Promise<void> {
    this._shipments = data.shipments;
    this._inventory = data.inventory;
    this._ledger = data.ledger;
    this._cases = data.cases;
    this._products = data.products;
    this._auditLogs = data.auditLogs;
    this._settings = data.settings;
    this._isDemo = data.isDemo;
    if (data.freightItems) this._freightItems = data.freightItems;
    if (data.freightActuals) this._freightActuals = data.freightActuals;

    this.syncCacheToLocalStorage();

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await Promise.all([
          cloudStorage.upsertShipments(this.currentUserId, data.shipments),
          cloudStorage.upsertInventory(this.currentUserId, data.inventory),
          cloudStorage.upsertLedger(this.currentUserId, data.ledger),
          cloudStorage.upsertCases(this.currentUserId, data.cases),
          cloudStorage.upsertProducts(this.currentUserId, data.products),
          cloudStorage.upsertAuditLogs(this.currentUserId, data.auditLogs),
          cloudStorage.upsertSettings(this.currentUserId, data.settings, data.isDemo),
          data.freightItems ? cloudStorage.upsertFreightItems(this.currentUserId, data.freightItems) : Promise.resolve(),
          data.freightActuals ? cloudStorage.upsertFreightActuals(this.currentUserId, data.freightActuals) : Promise.resolve(),
        ]);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error in saveAll to cloud:', err);
        this.setSyncStatus('error', err.message);
      }
    }
  }

  // =============================================================
  // Reset Demo Data (Explicit user action only)
  // =============================================================
  public static async resetDemoData(simulatedToday?: string): Promise<void> {
    await this.resetToDemoData(simulatedToday);
  }

  public static async resetToDemoData(simulatedToday?: string): Promise<{
    shipments: Shipment[];
    inventory: InventoryItem[];
    ledger: InventoryLedgerEntry[];
    cases: CaseRecord[];
    products: Product[];
    auditLogs: AuditLog[];
    settings: AppSettings;
    isDemo: boolean;
    freightItems: FreightShippingItem[];
    freightActuals: Record<string, any>;
  }> {
    const demo = generateDemoData(simulatedToday);
    const demoFreight = generateDemoFreightData();
    const initialAudit: AuditLog[] = [
      {
        id: `AUD-${Date.now()}-reset`,
        timestamp: new Date().toISOString(),
        targetType: 'Import',
        targetId: 'RESET-DEMO',
        field: 'ALL',
        beforeValue: 'User Data',
        afterValue: 'Standard Demo Data Loaded',
        source: 'User Action',
        operator: 'User',
        details: '用户手动载入标准业务演示数据（含8大业务场景与月头程出货对账）',
      },
    ];

    const data = {
      shipments: demo.shipments,
      inventory: demo.inventory,
      ledger: demo.ledger,
      cases: demo.cases,
      products: demo.products,
      auditLogs: initialAudit,
      settings: DEFAULT_SETTINGS,
      isDemo: true,
      freightItems: demoFreight.items,
      freightActuals: demoFreight.actuals,
    };

    await this.saveAll(data);
    return data;
  }

  // =============================================================
  // Clear All Data (Current User Only)
  // =============================================================
  public static async clearAllData(): Promise<{
    shipments: Shipment[];
    inventory: InventoryItem[];
    ledger: InventoryLedgerEntry[];
    cases: CaseRecord[];
    products: Product[];
    auditLogs: AuditLog[];
    settings: AppSettings;
    isDemo: boolean;
    freightItems: FreightShippingItem[];
    freightActuals: Record<string, any>;
  }> {
    const emptyData = {
      shipments: [],
      inventory: [],
      ledger: [],
      cases: [],
      products: [],
      auditLogs: [
        {
          id: `AUD-${Date.now()}-clear`,
          timestamp: new Date().toISOString(),
          targetType: 'Import',
          targetId: 'CLEAR-ALL',
          field: 'ALL',
          beforeValue: 'Existing Data',
          afterValue: 'Cleared',
          source: 'User Action',
          operator: 'User',
          details: '清空当前账号全部业务与头程数据',
        },
      ],
      settings: DEFAULT_SETTINGS,
      isDemo: false,
      freightItems: [],
      freightActuals: {},
    };

    this._shipments = [];
    this._inventory = [];
    this._cases = [];
    this._ledger = [];
    this._products = [];
    this._auditLogs = emptyData.auditLogs;
    this._settings = DEFAULT_SETTINGS;
    this._isDemo = false;
    this._freightItems = [];
    this._freightActuals = {};

    this.syncCacheToLocalStorage();

    if (this.currentUserId && cloudStorage.isConfigured()) {
      this.setSyncStatus('syncing');
      try {
        await cloudStorage.clearUserData(this.currentUserId);
        this.setSyncStatus('synced');
      } catch (err: any) {
        console.error('Error clearing cloud data:', err);
        this.setSyncStatus('error', err.message);
      }
    }

    return emptyData;
  }

  // =============================================================
  // JSON Backup Export & Import
  // =============================================================
  public static exportAllDataAsJson(): string {
    return this.exportAllToJson();
  }

  public static exportAllToJson(): string {
    const data = {
      version: '2.0-cloud',
      exportedAt: new Date().toISOString(),
      userId: this.currentUserId || 'local',
      shipments: this.getShipments(),
      inventory: this.getInventory(),
      ledger: this.getLedger(),
      cases: this.getCases(),
      products: this.getProducts(),
      auditLogs: this.getAuditLogs(),
      settings: this.getSettings(),
      freightItems: this.getFreightItems(),
      freightActuals: this.getFreightActuals(),
      isDemo: this._isDemo,
    };
    return JSON.stringify(data, null, 2);
  }

  public static async importDataFromJson(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      const shipments = Array.isArray(parsed.shipments) ? parsed.shipments : this.getShipments();
      const inventory = Array.isArray(parsed.inventory) ? parsed.inventory : this.getInventory();
      const ledger = Array.isArray(parsed.ledger) ? parsed.ledger : this.getLedger();
      const cases = Array.isArray(parsed.cases) ? parsed.cases : this.getCases();
      const products = Array.isArray(parsed.products) ? parsed.products : this.getProducts();
      const auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : this.getAuditLogs();
      const settings = parsed.settings || this.getSettings();
      const freightItems = Array.isArray(parsed.freightItems) ? parsed.freightItems : this.getFreightItems();
      const freightActuals = typeof parsed.freightActuals === 'object' ? parsed.freightActuals : this.getFreightActuals();

      await this.saveAll({
        shipments,
        inventory,
        ledger,
        cases,
        products,
        auditLogs,
        settings,
        isDemo: Boolean(parsed.isDemo),
        freightItems,
        freightActuals,
      });

      this.logAudit({
        targetType: 'Import',
        targetId: 'JSON-BACKUP-RESTORE',
        action: 'Restore Backup',
        details: '从 JSON 备份中成功还原数据并同步至云端',
      });
      return true;
    } catch (e) {
      console.error('Failed to import JSON backup:', e);
      return false;
    }
  }
}
