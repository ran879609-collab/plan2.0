import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

// Chunk array helper for safe batch upserts
function chunkArray<T>(items: T[], chunkSize = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export const cloudStorage = {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  },

  // -------------------------------------------------------------
  // Shipments
  // -------------------------------------------------------------
  async fetchShipments(userId: string): Promise<Shipment[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching shipments from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): Shipment => ({
      id: row.id,
      shipmentName: row.shipment_name,
      shipDate: row.ship_date,
      eta: row.eta || undefined,
      arrivalDate: row.arrival_date || undefined,
      fc: row.fc,
      tracking: row.tracking || undefined,
      carrier: row.carrier || undefined,
      status: row.status,
      items: Array.isArray(row.items) ? row.items : [],
      totalShipQty: Number(row.total_ship_qty || 0),
      totalReceivedQty: Number(row.total_received_qty || 0),
      totalDiscrepancyQty: Number(row.total_discrepancy_qty || 0),
      totalCartons: Number(row.total_cartons || 0),
      totalReceivedCartons: Number(row.total_received_cartons || 0),
      missingCartons: Number(row.missing_cartons || 0),
      channel: row.channel || undefined,
      isMergedCustoms: Boolean(row.is_merged_customs),
      customsDeclarationType: row.customs_declaration_type || undefined,
      customsBatchId: row.customs_batch_id || undefined,
      mergedCustomsShipmentIds: Array.isArray(row.merged_customs_shipment_ids)
        ? row.merged_customs_shipment_ids
        : [],
      caseId: row.case_id || undefined,
      caseStatus: row.case_status || 'Not Eligible',
      caseEligibleDate: row.case_eligible_date || undefined,
      daysSinceArrival: row.days_since_arrival !== null ? Number(row.days_since_arrival) : undefined,
      daysUntilCase: row.days_until_case !== null ? Number(row.days_until_case) : undefined,
      notes: row.notes || undefined,
      source: row.source || 'Manual',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));
  },

  async upsertShipments(userId: string, shipments: Shipment[]): Promise<void> {
    if (!isSupabaseConfigured || shipments.length === 0) return;

    const rows = shipments.map((s) => ({
      user_id: userId,
      id: s.id,
      shipment_name: s.shipmentName,
      ship_date: s.shipDate,
      eta: s.eta || null,
      arrival_date: s.arrivalDate || null,
      fc: s.fc,
      tracking: s.tracking || null,
      carrier: s.carrier || null,
      status: s.status,
      items: s.items || [],
      total_ship_qty: s.totalShipQty || 0,
      total_received_qty: s.totalReceivedQty || 0,
      total_discrepancy_qty: s.totalDiscrepancyQty || 0,
      total_cartons: s.totalCartons || 0,
      total_received_cartons: s.totalReceivedCartons || 0,
      missing_cartons: s.missingCartons || 0,
      channel: s.channel || null,
      is_merged_customs: Boolean(s.isMergedCustoms),
      customs_declaration_type: s.customsDeclarationType || null,
      customs_batch_id: s.customsBatchId || null,
      merged_customs_shipment_ids: s.mergedCustomsShipmentIds || [],
      case_id: s.caseId || null,
      case_status: s.caseStatus || null,
      case_eligible_date: s.caseEligibleDate || null,
      days_since_arrival: s.daysSinceArrival ?? null,
      days_until_case: s.daysUntilCase ?? null,
      notes: s.notes || null,
      source: s.source || 'Manual',
      updated_at: new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('shipments')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting shipments:', error);
        throw error;
      }
    }
  },

  async deleteShipment(userId: string, shipmentId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('user_id', userId)
      .eq('id', shipmentId);
    if (error) throw error;
  },

  // -------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------
  async fetchInventory(userId: string): Promise<InventoryItem[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching inventory from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): InventoryItem => ({
      sku: row.sku,
      itemId: row.item_id || undefined,
      gtin: row.gtin || undefined,
      productName: row.product_name,
      productType: row.product_type || undefined,
      available: Number(row.available || 0),
      reserved: Number(row.reserved || 0),
      inbound: Number(row.inbound || 0),
      receiving: Number(row.receiving || 0),
      totalProjected: Number(row.total_projected || 0),
      safetyStock: Number(row.safety_stock || 0),
      minStock: row.min_stock !== null ? Number(row.min_stock) : undefined,
      maxStock: row.max_stock !== null ? Number(row.max_stock) : undefined,
      targetStock: row.target_stock !== null ? Number(row.target_stock) : undefined,
      sales30Days: row.sales30_days !== null ? Number(row.sales30_days) : undefined,
      dailyAvgSales: row.daily_avg_sales !== null ? Number(row.daily_avg_sales) : undefined,
      daysOfSupply: row.days_of_supply !== null ? Number(row.days_of_supply) : undefined,
      lastUpdated: row.last_updated || new Date().toISOString(),
      source: row.source || 'Manual',
      updatedAt: row.updated_at || undefined,
      reimbursedUnits: row.reimbursed_units !== null ? Number(row.reimbursed_units) : undefined,
      reimbursedAmount: row.reimbursed_amount !== null ? Number(row.reimbursed_amount) : undefined,
      reimbursementCurrency: row.reimbursement_currency || undefined,
      reimbursementCases: Array.isArray(row.reimbursement_cases) ? row.reimbursement_cases : [],
    }));
  },

  async upsertInventory(userId: string, items: InventoryItem[]): Promise<void> {
    if (!isSupabaseConfigured || items.length === 0) return;

    const rows = items.map((item) => ({
      user_id: userId,
      sku: item.sku,
      item_id: item.itemId || null,
      gtin: item.gtin || null,
      product_name: item.productName,
      product_type: item.productType || null,
      available: item.available || 0,
      reserved: item.reserved || 0,
      inbound: item.inbound || 0,
      receiving: item.receiving || 0,
      total_projected: item.totalProjected || 0,
      safety_stock: item.safetyStock || 0,
      min_stock: item.minStock ?? null,
      max_stock: item.maxStock ?? null,
      target_stock: item.targetStock ?? null,
      sales30_days: item.sales30Days ?? null,
      daily_avg_sales: item.dailyAvgSales ?? null,
      days_of_supply: item.daysOfSupply ?? null,
      last_updated: item.lastUpdated || new Date().toISOString(),
      source: item.source || 'Manual',
      reimbursed_units: item.reimbursedUnits || 0,
      reimbursed_amount: item.reimbursedAmount || 0,
      reimbursement_currency: item.reimbursementCurrency || null,
      reimbursement_cases: item.reimbursementCases || [],
      updated_at: new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('inventory')
        .upsert(chunk, { onConflict: 'user_id,sku' });
      if (error) {
        console.error('Error upserting inventory:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Cases
  // -------------------------------------------------------------
  async fetchCases(userId: string): Promise<CaseRecord[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching cases from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): CaseRecord => ({
      id: row.id,
      shipmentId: row.shipment_id,
      sku: row.sku,
      itemId: row.item_id || undefined,
      productName: row.product_name,
      discrepancyQty: Number(row.discrepancy_qty || 0),
      shipQty: Number(row.ship_qty || 0),
      receivedQty: Number(row.received_qty || 0),
      arrivalDate: row.arrival_date,
      eligibleDate: row.eligible_date,
      caseOpenDate: row.case_open_date || undefined,
      status: row.status,
      walmartResponse: row.walmart_response || undefined,
      resolutionQty: row.resolution_qty !== null ? Number(row.resolution_qty) : undefined,
      finalDifference: row.final_difference !== null ? Number(row.final_difference) : undefined,
      closedDate: row.closed_date || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      reimbursementStatus: row.reimbursement_status || undefined,
      reimbursementType: row.reimbursement_type || undefined,
      reimbursedUnits: row.reimbursed_units !== null ? Number(row.reimbursed_units) : undefined,
      reimbursedAmount: row.reimbursed_amount !== null ? Number(row.reimbursed_amount) : undefined,
      reimbursementCurrency: row.reimbursement_currency || undefined,
      reimbursementNote: row.reimbursement_note || undefined,
    }));
  },

  async upsertCases(userId: string, cases: CaseRecord[]): Promise<void> {
    if (!isSupabaseConfigured || cases.length === 0) return;

    const rows = cases.map((c) => ({
      user_id: userId,
      id: c.id,
      shipment_id: c.shipmentId,
      sku: c.sku,
      item_id: c.itemId || null,
      product_name: c.productName,
      discrepancy_qty: c.discrepancyQty || 0,
      ship_qty: c.shipQty || 0,
      received_qty: c.receivedQty || 0,
      arrival_date: c.arrivalDate,
      eligible_date: c.eligibleDate,
      case_open_date: c.caseOpenDate || null,
      status: c.status,
      walmart_response: c.walmartResponse || null,
      resolution_qty: c.resolutionQty ?? null,
      final_difference: c.finalDifference ?? null,
      closed_date: c.closedDate || null,
      notes: c.notes || null,
      reimbursement_status: c.reimbursementStatus || null,
      reimbursement_type: c.reimbursementType || null,
      reimbursed_units: c.reimbursedUnits ?? null,
      reimbursed_amount: c.reimbursedAmount ?? null,
      reimbursement_currency: c.reimbursementCurrency || null,
      reimbursement_note: c.reimbursementNote || null,
      updated_at: new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('cases')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting cases:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Inventory Ledger
  // -------------------------------------------------------------
  async fetchLedger(userId: string): Promise<InventoryLedgerEntry[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('inventory_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching ledger from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): InventoryLedgerEntry => ({
      id: row.id,
      date: row.date,
      sku: row.sku,
      productName: row.product_name || undefined,
      beforeQty: Number(row.before_qty || 0),
      changeQty: Number(row.change_qty || 0),
      afterQty: Number(row.after_qty || 0),
      changeType: row.change_type,
      source: row.source || 'Manual',
      reference: row.reference || '',
      notes: row.notes || undefined,
      timestamp: row.timestamp || new Date().toISOString(),
    }));
  },

  async upsertLedger(userId: string, entries: InventoryLedgerEntry[]): Promise<void> {
    if (!isSupabaseConfigured || entries.length === 0) return;

    const rows = entries.map((entry) => ({
      user_id: userId,
      id: entry.id,
      date: entry.date,
      sku: entry.sku,
      product_name: entry.productName || null,
      before_qty: entry.beforeQty || 0,
      change_qty: entry.changeQty || 0,
      after_qty: entry.afterQty || 0,
      change_type: entry.changeType,
      source: entry.source || 'Manual',
      reference: entry.reference || '',
      notes: entry.notes || null,
      timestamp: entry.timestamp || new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('inventory_ledger')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting ledger:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Products
  // -------------------------------------------------------------
  async fetchProducts(userId: string): Promise<Product[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching products from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): Product => ({
      sku: row.sku,
      itemId: row.item_id || undefined,
      gtin: row.gtin || undefined,
      productName: row.product_name,
      productType: row.product_type || undefined,
      safetyStock: row.safety_stock !== null ? Number(row.safety_stock) : undefined,
      minStock: row.min_stock !== null ? Number(row.min_stock) : undefined,
      maxStock: row.max_stock !== null ? Number(row.max_stock) : undefined,
      targetStock: row.target_stock !== null ? Number(row.target_stock) : undefined,
      recent30DaysSales: row.recent30_days_sales !== null ? Number(row.recent30_days_sales) : undefined,
    }));
  },

  async upsertProducts(userId: string, products: Product[]): Promise<void> {
    if (!isSupabaseConfigured || products.length === 0) return;

    const rows = products.map((p) => ({
      user_id: userId,
      sku: p.sku,
      item_id: p.itemId || null,
      gtin: p.gtin || null,
      product_name: p.productName,
      product_type: p.productType || null,
      safety_stock: p.safetyStock ?? null,
      min_stock: p.minStock ?? null,
      max_stock: p.maxStock ?? null,
      target_stock: p.targetStock ?? null,
      recent30_days_sales: p.recent30DaysSales ?? null,
      updated_at: new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'user_id,sku' });
      if (error) {
        console.error('Error upserting products:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Audit Logs
  // -------------------------------------------------------------
  async fetchAuditLogs(userId: string): Promise<AuditLog[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching audit logs from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): AuditLog => ({
      id: row.id,
      timestamp: row.timestamp,
      targetType: row.target_type,
      targetId: row.target_id,
      action: row.action || undefined,
      field: row.field || undefined,
      beforeValue: row.before_value,
      afterValue: row.after_value,
      source: row.source || undefined,
      operator: row.operator || undefined,
      details: row.details || undefined,
    }));
  },

  async upsertAuditLogs(userId: string, logs: AuditLog[]): Promise<void> {
    if (!isSupabaseConfigured || logs.length === 0) return;

    const rows = logs.slice(0, 500).map((l) => ({
      user_id: userId,
      id: l.id,
      timestamp: l.timestamp,
      target_type: l.targetType,
      target_id: l.targetId,
      action: l.action || null,
      field: l.field || null,
      before_value: l.beforeValue !== undefined ? String(l.beforeValue) : null,
      after_value: l.afterValue !== undefined ? String(l.afterValue) : null,
      source: l.source || null,
      operator: l.operator || null,
      details: l.details || null,
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('audit_logs')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting audit logs:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Anomalies
  // -------------------------------------------------------------
  async fetchAnomalies(userId: string): Promise<AnomalyItem[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('anomalies')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching anomalies from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): AnomalyItem => ({
      id: row.id,
      level: row.level,
      type: row.type,
      title: row.title || undefined,
      message: row.message || undefined,
      description: row.description || undefined,
      shipmentId: row.shipment_id || '',
      referenceId: row.reference_id || undefined,
      referenceType: row.reference_type || undefined,
      detectedAt: row.detected_at || undefined,
      data: row.data || undefined,
    }));
  },

  async upsertAnomalies(userId: string, anomalies: AnomalyItem[]): Promise<void> {
    if (!isSupabaseConfigured || anomalies.length === 0) return;

    const rows = anomalies.map((a) => ({
      user_id: userId,
      id: a.id,
      level: a.level,
      type: a.type,
      title: a.title || null,
      message: a.message || null,
      description: a.description || null,
      shipment_id: a.shipmentId || null,
      reference_id: a.referenceId || null,
      reference_type: a.referenceType || null,
      detected_at: a.detectedAt || new Date().toISOString(),
      data: a.data || null,
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('anomalies')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting anomalies:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Freight Items
  // -------------------------------------------------------------
  async fetchFreightItems(userId: string): Promise<FreightShippingItem[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('freight_items')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching freight items from cloud:', error);
      throw error;
    }

    return (data || []).map((row: any): FreightShippingItem => ({
      id: row.id,
      shipmentId: row.shipment_id,
      warehouse: row.warehouse,
      shipDate: row.ship_date,
      monthKey: row.month_key,
      sku: row.sku,
      productName: row.product_name,
      actualQty: Number(row.actual_qty || 0),
      boxCount: Number(row.box_count || 0),
      boxWeight: Number(row.box_weight || 0),
      boxLength: Number(row.box_length || 0),
      boxWidth: Number(row.box_width || 0),
      boxHeight: Number(row.box_height || 0),
      dimensionsText: row.dimensions_text || '',
      channel: row.channel,
      unitPrice: Number(row.unit_price || 0),
      isMergedCustoms: Boolean(row.is_merged_customs),
      customsDeclarationType: row.customs_declaration_type || undefined,
      customsBatchKey: row.customs_batch_key || undefined,
      mergedCustomsShipmentIds: Array.isArray(row.merged_customs_shipment_ids)
        ? row.merged_customs_shipment_ids
        : [],
      extraCategoriesCount: row.extra_categories_count !== null ? Number(row.extra_categories_count) : undefined,
      extraCategoryUnitPrice: row.extra_category_unit_price !== null ? Number(row.extra_category_unit_price) : undefined,
      extraCategoryFee: row.extra_category_fee !== null ? Number(row.extra_category_fee) : undefined,
      mixedBoxGroup: row.mixed_box_group || undefined,
      isSecondaryMixedItem: Boolean(row.is_secondary_mixed_item),
      mixedBoxRole: row.mixed_box_role || undefined,
      notes: row.notes || undefined,
      volumetricWeight: Number(row.volumetric_weight || 0),
      volumetricWeightPerBox: Number(row.volumetric_weight_per_box || 0),
      billedWeightPerBox: Number(row.billed_weight_per_box || 0),
      chargeableWeightPerBox: Number(row.chargeable_weight_per_box || 0),
      totalChargeableWeight: Number(row.total_chargeable_weight || 0),
      pricingMethod: row.pricing_method || 'Weight',
      chargeableType: row.chargeable_type || 'ACTUAL_WEIGHT',
      minWeightApplied: Boolean(row.min_weight_applied),
      estimatedItemFreight: Number(row.estimated_item_freight || 0),
    }));
  },

  async upsertFreightItems(userId: string, items: FreightShippingItem[]): Promise<void> {
    if (!isSupabaseConfigured || items.length === 0) return;

    const rows = items.map((f) => ({
      user_id: userId,
      id: f.id,
      shipment_id: f.shipmentId,
      warehouse: f.warehouse,
      ship_date: f.shipDate,
      month_key: f.monthKey,
      sku: f.sku,
      product_name: f.productName,
      actual_qty: f.actualQty || 0,
      box_count: f.boxCount || 0,
      box_weight: f.boxWeight || 0,
      box_length: f.boxLength || 0,
      box_width: f.boxWidth || 0,
      box_height: f.boxHeight || 0,
      dimensions_text: f.dimensionsText || null,
      channel: f.channel,
      unit_price: f.unitPrice || 0,
      is_merged_customs: Boolean(f.isMergedCustoms),
      customs_declaration_type: f.customsDeclarationType || null,
      customs_batch_key: f.customsBatchKey || null,
      merged_customs_shipment_ids: f.mergedCustomsShipmentIds || [],
      extra_categories_count: f.extraCategoriesCount ?? 0,
      extra_category_unit_price: f.extraCategoryUnitPrice ?? 0,
      extra_category_fee: f.extraCategoryFee ?? 0,
      mixed_box_group: f.mixedBoxGroup || null,
      is_secondary_mixed_item: Boolean(f.isSecondaryMixedItem),
      mixed_box_role: f.mixedBoxRole || null,
      notes: f.notes || null,
      volumetric_weight: f.volumetricWeight || 0,
      volumetric_weight_per_box: f.volumetricWeightPerBox || 0,
      billed_weight_per_box: f.billedWeightPerBox || 0,
      chargeable_weight_per_box: f.chargeableWeightPerBox || 0,
      total_chargeable_weight: f.totalChargeableWeight || 0,
      pricing_method: f.pricingMethod || 'Weight',
      chargeable_type: f.chargeableType || 'ACTUAL_WEIGHT',
      min_weight_applied: Boolean(f.minWeightApplied),
      estimated_item_freight: f.estimatedItemFreight || 0,
      updated_at: new Date().toISOString(),
    }));

    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('freight_items')
        .upsert(chunk, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error upserting freight items:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Freight Actuals
  // -------------------------------------------------------------
  async fetchFreightActuals(userId: string): Promise<Record<string, any>> {
    if (!isSupabaseConfigured) return {};
    const { data, error } = await supabase
      .from('freight_actuals')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching freight actuals from cloud:', error);
      throw error;
    }

    const actualsMap: Record<string, any> = {};
    for (const row of data || []) {
      const compositeKey = `${row.month_key}__${row.shipment_id}`;
      actualsMap[compositeKey] = {
        actualChargeableWeight: row.actual_chargeable_weight !== null ? Number(row.actual_chargeable_weight) : undefined,
        actualCost: row.actual_cost !== null ? Number(row.actual_cost) : undefined,
        actualUnitPrice: row.actual_unit_price !== null ? Number(row.actual_unit_price) : undefined,
        actualCustomsFee: row.actual_customs_fee !== null ? Number(row.actual_customs_fee) : undefined,
        actualExtraCategoryFee: row.actual_extra_category_fee !== null ? Number(row.actual_extra_category_fee) : undefined,
        reconciliationNotes: row.reconciliation_notes || undefined,
      };
      // Also support legacy/direct key shipmentId if monthKey not split
      actualsMap[row.shipment_id] = actualsMap[compositeKey];
    }
    return actualsMap;
  },

  async upsertFreightActuals(userId: string, actuals: Record<string, any>): Promise<void> {
    if (!isSupabaseConfigured || !actuals || Object.keys(actuals).length === 0) return;

    const rows: any[] = [];
    for (const [key, val] of Object.entries(actuals)) {
      if (!val || typeof val !== 'object') continue;
      // Key may be "YYYY-MM__ShipmentId" or just "ShipmentId"
      let monthKey = 'GLOBAL';
      let shipmentId = key;
      if (key.includes('__')) {
        const parts = key.split('__');
        monthKey = parts[0];
        shipmentId = parts[1];
      }

      rows.push({
        user_id: userId,
        month_key: monthKey,
        shipment_id: shipmentId,
        actual_chargeable_weight: val.actualChargeableWeight ?? null,
        actual_cost: val.actualCost ?? null,
        actual_unit_price: val.actualUnitPrice ?? null,
        actual_customs_fee: val.actualCustomsFee ?? null,
        actual_extra_category_fee: val.actualExtraCategoryFee ?? null,
        reconciliation_notes: val.reconciliationNotes || null,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length === 0) return;
    const chunks = chunkArray(rows, 100);
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('freight_actuals')
        .upsert(chunk, { onConflict: 'user_id,month_key,shipment_id' });
      if (error) {
        console.error('Error upserting freight actuals:', error);
        throw error;
      }
    }
  },

  // -------------------------------------------------------------
  // Settings & Synced IDs
  // -------------------------------------------------------------
  async fetchSettings(userId: string): Promise<{ settings: AppSettings; isDemo: boolean; syncedShipmentIds: string[]; migrationCompleted: boolean } | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings from cloud:', error);
      return null;
    }

    if (!data) return null;

    return {
      settings: {
        caseRuleDays: data.case_rule_days ?? 10,
        caseEligibilityDays: data.case_eligibility_days ?? 10,
        approachingAlertDays: data.approaching_alert_days ?? 3,
        approachingDaysWarning: data.approaching_days_warning ?? 3,
        autoStatusCalculation: data.auto_status_calculation ?? true,
        autoCalculateCase: data.auto_calculate_case ?? true,
        autoCloseCaseOnReceipt: data.auto_close_case_on_receipt ?? true,
        allowNegativeInventory: data.allow_negative_inventory ?? false,
        strictArrivalDateRequired: data.strict_arrival_date_required ?? true,
        customTodayDate: data.custom_today_date || undefined,
        currentSimulatedDate: data.current_simulated_date || undefined,
      },
      isDemo: Boolean(data.is_demo),
      syncedShipmentIds: Array.isArray(data.synced_shipment_ids) ? data.synced_shipment_ids : [],
      migrationCompleted: Boolean(data.migration_completed),
    };
  },

  async upsertSettings(
    userId: string,
    settings: AppSettings,
    isDemo = false,
    syncedShipmentIds: string[] = [],
    migrationCompleted = false
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    const row = {
      user_id: userId,
      case_rule_days: settings.caseRuleDays ?? 10,
      case_eligibility_days: settings.caseEligibilityDays ?? 10,
      approaching_alert_days: settings.approachingAlertDays ?? 3,
      approaching_days_warning: settings.approachingDaysWarning ?? 3,
      auto_status_calculation: settings.autoStatusCalculation ?? true,
      auto_calculate_case: settings.autoCalculateCase ?? true,
      auto_close_case_on_receipt: settings.autoCloseCaseOnReceipt ?? true,
      allow_negative_inventory: settings.allowNegativeInventory ?? false,
      strict_arrival_date_required: settings.strictArrivalDateRequired ?? true,
      custom_today_date: settings.customTodayDate || null,
      current_simulated_date: settings.currentSimulatedDate || null,
      is_demo: isDemo,
      synced_shipment_ids: syncedShipmentIds,
      migration_completed: migrationCompleted,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(row, { onConflict: 'user_id' });

    if (error) {
      console.error('Error upserting settings:', error);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // Bulk Clear Data (for current user only)
  // -------------------------------------------------------------
  async clearUserData(userId: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    // Delete in parallel or sequence with user_id filter
    const tables = [
      'shipments',
      'inventory',
      'cases',
      'inventory_ledger',
      'products',
      'audit_logs',
      'anomalies',
      'freight_items',
      'freight_actuals',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);
      if (error) {
        console.error(`Error clearing ${table}:`, error);
      }
    }

    // Reset settings row
    await this.upsertSettings(
      userId,
      {
        caseRuleDays: 10,
        caseEligibilityDays: 10,
        approachingAlertDays: 3,
        approachingDaysWarning: 3,
        autoStatusCalculation: true,
        autoCalculateCase: true,
        autoCloseCaseOnReceipt: true,
        allowNegativeInventory: false,
        strictArrivalDateRequired: true,
      },
      false,
      [],
      true
    );
  },
};
