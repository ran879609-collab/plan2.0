import { cloudStorage } from './cloudStorage';
import {
  Shipment,
  InventoryItem,
  CaseRecord,
  InventoryLedgerEntry,
  Product,
  AuditLog,
  AnomalyItem,
  AppSettings,
  FreightShippingItem,
} from '../types';

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
  MIGRATION_COMPLETED: 'wmt_cloud_migration_completed_v1',
};

export interface LocalDataSummary {
  hasData: boolean;
  shipments: number;
  inventory: number;
  cases: number;
  products: number;
  ledger: number;
  auditLogs: number;
  anomalies: number;
  freightItems: number;
  freightActuals: number;
  alreadyMigrated: boolean;
}

export interface MigrationResult {
  success: boolean;
  categories: {
    name: string;
    total: number;
    migrated: number;
    failed: number;
    error?: string;
  }[];
  totalMigrated: number;
  totalFailed: number;
}

export const migrationService = {
  detectLocalData(): LocalDataSummary {
    try {
      const shipments: Shipment[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHIPMENTS) || '[]');
      const inventory: InventoryItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
      const cases: CaseRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CASES) || '[]');
      const products: Product[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      const ledger: InventoryLedgerEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER) || '[]');
      const auditLogs: AuditLog[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
      const anomalies: AnomalyItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANOMALIES) || '[]');
      const freightItems: FreightShippingItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREIGHT_ITEMS) || '[]');
      const freightActuals = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREIGHT_ACTUALS) || '{}');
      const alreadyMigrated = localStorage.getItem(STORAGE_KEYS.MIGRATION_COMPLETED) === 'true';

      const totalItems =
        shipments.length +
        inventory.length +
        cases.length +
        products.length +
        ledger.length +
        freightItems.length;

      return {
        hasData: totalItems > 0,
        shipments: shipments.length,
        inventory: inventory.length,
        cases: cases.length,
        products: products.length,
        ledger: ledger.length,
        auditLogs: auditLogs.length,
        anomalies: anomalies.length,
        freightItems: freightItems.length,
        freightActuals: Object.keys(freightActuals).length,
        alreadyMigrated,
      };
    } catch (e) {
      console.error('Error detecting local data:', e);
      return {
        hasData: false,
        shipments: 0,
        inventory: 0,
        cases: 0,
        products: 0,
        ledger: 0,
        auditLogs: 0,
        anomalies: 0,
        freightItems: 0,
        freightActuals: 0,
        alreadyMigrated: false,
      };
    }
  },

  async migrateToCloud(userId: string): Promise<MigrationResult> {
    const summary = this.detectLocalData();
    const result: MigrationResult = {
      success: true,
      categories: [],
      totalMigrated: 0,
      totalFailed: 0,
    };

    // 1. Shipments
    try {
      const shipments: Shipment[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHIPMENTS) || '[]');
      if (shipments.length > 0) {
        await cloudStorage.upsertShipments(userId, shipments);
      }
      result.categories.push({
        name: '货件数据 (Shipments)',
        total: shipments.length,
        migrated: shipments.length,
        failed: 0,
      });
      result.totalMigrated += shipments.length;
    } catch (err: any) {
      console.error('Error migrating shipments:', err);
      result.categories.push({
        name: '货件数据 (Shipments)',
        total: summary.shipments,
        migrated: 0,
        failed: summary.shipments,
        error: err.message,
      });
      result.totalFailed += summary.shipments;
      result.success = false;
    }

    // 2. Inventory
    try {
      const inventory: InventoryItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
      if (inventory.length > 0) {
        await cloudStorage.upsertInventory(userId, inventory);
      }
      result.categories.push({
        name: '库存数据 (Inventory)',
        total: inventory.length,
        migrated: inventory.length,
        failed: 0,
      });
      result.totalMigrated += inventory.length;
    } catch (err: any) {
      console.error('Error migrating inventory:', err);
      result.categories.push({
        name: '库存数据 (Inventory)',
        total: summary.inventory,
        migrated: 0,
        failed: summary.inventory,
        error: err.message,
      });
      result.totalFailed += summary.inventory;
      result.success = false;
    }

    // 3. Cases
    try {
      const cases: CaseRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CASES) || '[]');
      if (cases.length > 0) {
        await cloudStorage.upsertCases(userId, cases);
      }
      result.categories.push({
        name: '工单数据 (Cases)',
        total: cases.length,
        migrated: cases.length,
        failed: 0,
      });
      result.totalMigrated += cases.length;
    } catch (err: any) {
      console.error('Error migrating cases:', err);
      result.categories.push({
        name: '工单数据 (Cases)',
        total: summary.cases,
        migrated: 0,
        failed: summary.cases,
        error: err.message,
      });
      result.totalFailed += summary.cases;
      result.success = false;
    }

    // 4. Products
    try {
      const products: Product[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      if (products.length > 0) {
        await cloudStorage.upsertProducts(userId, products);
      }
      result.categories.push({
        name: '商品主库 (Products)',
        total: products.length,
        migrated: products.length,
        failed: 0,
      });
      result.totalMigrated += products.length;
    } catch (err: any) {
      console.error('Error migrating products:', err);
      result.categories.push({
        name: '商品主库 (Products)',
        total: summary.products,
        migrated: 0,
        failed: summary.products,
        error: err.message,
      });
      result.totalFailed += summary.products;
      result.success = false;
    }

    // 5. Inventory Ledger
    try {
      const ledger: InventoryLedgerEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER) || '[]');
      if (ledger.length > 0) {
        await cloudStorage.upsertLedger(userId, ledger);
      }
      result.categories.push({
        name: '库存流水 (Ledger)',
        total: ledger.length,
        migrated: ledger.length,
        failed: 0,
      });
      result.totalMigrated += ledger.length;
    } catch (err: any) {
      console.error('Error migrating ledger:', err);
      result.categories.push({
        name: '库存流水 (Ledger)',
        total: summary.ledger,
        migrated: 0,
        failed: summary.ledger,
        error: err.message,
      });
      result.totalFailed += summary.ledger;
      result.success = false;
    }

    // 6. Freight Items & Actuals
    try {
      const freightItems: FreightShippingItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREIGHT_ITEMS) || '[]');
      if (freightItems.length > 0) {
        await cloudStorage.upsertFreightItems(userId, freightItems);
      }
      const freightActuals = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREIGHT_ACTUALS) || '{}');
      if (Object.keys(freightActuals).length > 0) {
        await cloudStorage.upsertFreightActuals(userId, freightActuals);
      }
      result.categories.push({
        name: '头程运费与对账 (Freight)',
        total: freightItems.length + Object.keys(freightActuals).length,
        migrated: freightItems.length + Object.keys(freightActuals).length,
        failed: 0,
      });
      result.totalMigrated += freightItems.length + Object.keys(freightActuals).length;
    } catch (err: any) {
      console.error('Error migrating freight:', err);
      result.categories.push({
        name: '头程运费与对账 (Freight)',
        total: summary.freightItems + summary.freightActuals,
        migrated: 0,
        failed: summary.freightItems + summary.freightActuals,
        error: err.message,
      });
      result.totalFailed += summary.freightItems + summary.freightActuals;
      result.success = false;
    }

    // 7. Audit Logs & Anomalies
    try {
      const auditLogs: AuditLog[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
      if (auditLogs.length > 0) {
        await cloudStorage.upsertAuditLogs(userId, auditLogs);
      }
      const anomalies: AnomalyItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANOMALIES) || '[]');
      if (anomalies.length > 0) {
        await cloudStorage.upsertAnomalies(userId, anomalies);
      }
      result.categories.push({
        name: '审计日志与异常 (Audit & Anomalies)',
        total: auditLogs.length + anomalies.length,
        migrated: auditLogs.length + anomalies.length,
        failed: 0,
      });
      result.totalMigrated += auditLogs.length + anomalies.length;
    } catch (err: any) {
      console.error('Error migrating audit & anomalies:', err);
    }

    // 8. Settings
    try {
      const rawSettings: AppSettings = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'
      );
      const isDemo = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === 'true';
      const syncedShipmentIds: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.FREIGHT_SYNCED_SHIPMENTS) || '[]'
      );
      await cloudStorage.upsertSettings(userId, rawSettings, isDemo, syncedShipmentIds, true);
    } catch (err) {
      console.error('Error migrating settings:', err);
    }

    // Mark migration completed locally
    localStorage.setItem(STORAGE_KEYS.MIGRATION_COMPLETED, 'true');

    return result;
  },

  dismissMigrationPrompt() {
    localStorage.setItem(STORAGE_KEYS.MIGRATION_COMPLETED, 'dismissed');
  },
};
