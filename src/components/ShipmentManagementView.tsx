import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  FileCheck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Edit2,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  FileSpreadsheet,
  UploadCloud,
  Boxes,
  Tag,
  BellRing,
  Link2,
  ArrowRightLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Shipment, ShipmentStatus, CaseStatus } from '../types';
import { exportShipmentsToExcel } from '../utils/excelExporter';
import { getCaseTimeDisplay, getTodayString } from '../utils/dateUtils';
import { downloadShipmentBatchTemplate } from '../utils/excelParser';
import { calculateShipmentMetrics } from '../utils/statusCalculator';
import { LinkedShipmentsModal } from './LinkedShipmentsModal';

interface ShipmentManagementViewProps {
  shipments: Shipment[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSelectShipment: (shipmentId: string) => void;
  onOpenNewShipmentModal: (shipment?: Shipment, mode?: 'manual' | 'batch') => void;
  onOpenCaseModal: (shipment: Shipment) => void;
  onOpenProductSupplement?: (shipment: Shipment) => void;
  onDeleteShipment: (shipmentId: string) => void;
  onBatchDeleteShipments: (shipmentIds: string[]) => void;
  onOpenFreightSync?: () => void;
  onUpdateShipment?: (shipment: Shipment) => void;
}

interface DisplayShipmentRow {
  shipment: Shipment;
  isDirectMatch: boolean;
  isExactIdMatch: boolean;
  isLinkedPeer: boolean;
  peerOfShipmentId?: string;
}

export const ShipmentManagementView: React.FC<ShipmentManagementViewProps> = ({
  shipments,
  searchQuery,
  onSearchChange,
  onSelectShipment,
  onOpenNewShipmentModal,
  onOpenCaseModal,
  onOpenProductSupplement,
  onDeleteShipment,
  onBatchDeleteShipments,
  onOpenFreightSync,
  onUpdateShipment,
}) => {
  // Local search state decoupled from global header
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(searchQuery || '');

  // Year & Month Filter state (Default to current month as requested)
  const currentMonthKey = useMemo(() => getTodayString().slice(0, 7), []);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Quick filter tabs & secondary filters
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedFc, setSelectedFc] = useState<string>('all');
  const [customsModeFilter, setCustomsModeFilter] = useState<'all' | 'STANDALONE' | 'MERGED'>('all');
  const [caseFilter, setCaseFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(15);

  // Cluster Detail Modal state
  const [clusterModalTarget, setClusterModalTarget] = useState<Shipment | null>(null);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState<boolean>(false);

  // Sync search query changes if external handler is provided
  const handleSearchChange = (val: string) => {
    setLocalSearchQuery(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  // Extract unique years, months, and their shipment counts
  const { availableYears, availableMonths } = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    const counts: Record<string, number> = {};

    const curYear = currentMonthKey.slice(0, 4);
    yearsSet.add(curYear);
    monthsSet.add(currentMonthKey);

    shipments.forEach((s) => {
      const d = s.shipDate || s.createDate || s.arrivalDate;
      if (d && d.length >= 7) {
        const y = d.slice(0, 4);
        const m = d.slice(0, 7);
        yearsSet.add(y);
        monthsSet.add(m);
        counts[m] = (counts[m] || 0) + 1;
      }
    });

    const sortedYears = Array.from(yearsSet).sort().reverse();
    const sortedMonths = Array.from(monthsSet).sort().reverse();

    return {
      availableYears: sortedYears,
      availableMonths: sortedMonths.map((m) => ({
        key: m,
        year: m.slice(0, 4),
        monthNum: m.slice(5, 7),
        display: `${m.slice(0, 4)}年${m.slice(5, 7)}月`,
        shortDisplay: `${parseInt(m.slice(5, 7), 10)}月`,
        count: counts[m] || 0,
        isCurrent: m === currentMonthKey,
      })),
    };
  }, [shipments, currentMonthKey]);

  // Unique FCs
  const uniqueFcs = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach((s) => {
      if (s.fc) set.add(s.fc);
    });
    return Array.from(set);
  }, [shipments]);

  // Live count per quick status tab calculated based on currently selected Month / Year
  const tabCounts = useMemo(() => {
    const monthFiltered = shipments.filter((shp) => {
      const d = shp.shipDate || shp.createDate || shp.arrivalDate || '';
      if (selectedMonth !== 'all') {
        if (!d.startsWith(selectedMonth)) return false;
      } else if (selectedYear !== 'all') {
        if (!d.startsWith(selectedYear)) return false;
      }
      return true;
    });

    const counts = {
      all: monthFiltered.length,
      in_transit: 0,
      receiving: 0,
      partially: 0,
      fully: 0,
      discrepancy: 0,
      case_eligible: 0,
      case_processing: 0,
      resolved: 0,
    };

    monthFiltered.forEach((shp) => {
      // In Transit
      if (
        shp.status === 'In Transit' ||
        (!shp.arrivalDate && shp.totalReceivedQty === 0 && shp.status !== 'Arrived' && shp.status !== 'Receiving')
      ) {
        counts.in_transit++;
      }
      // Arrived / Receiving
      if (
        shp.status === 'Receiving' ||
        shp.status === 'Arrived' ||
        (Boolean(shp.arrivalDate) && shp.totalReceivedQty === 0)
      ) {
        counts.receiving++;
      }
      // Partially Received
      if (
        shp.status === 'Partially Received' ||
        (shp.totalReceivedQty > 0 && shp.totalReceivedQty < shp.totalShipQty)
      ) {
        counts.partially++;
      }
      // Fully Received
      if (
        shp.status === 'Fully Received' ||
        (shp.totalReceivedQty >= shp.totalShipQty && shp.totalShipQty > 0)
      ) {
        counts.fully++;
      }
      // Discrepancy
      if (shp.totalDiscrepancyQty > 0) {
        counts.discrepancy++;
      }
      // Case Eligible
      if (
        shp.caseStatus === 'Eligible' ||
        (shp.totalDiscrepancyQty > 0 &&
          Boolean(shp.arrivalDate) &&
          shp.daysUntilCase !== undefined &&
          shp.daysUntilCase <= 0)
      ) {
        counts.case_eligible++;
      }
      // Case Processing
      if (
        shp.caseStatus === 'Opened' ||
        shp.caseStatus === 'In Review' ||
        shp.caseStatus === 'Partially Resolved' ||
        shp.status === 'Case Processing' ||
        shp.status === 'Case Opened'
      ) {
        counts.case_processing++;
      }
      // Resolved
      if (
        shp.caseStatus === 'Resolved' ||
        shp.caseStatus === 'Closed' ||
        shp.status === 'Resolved'
      ) {
        counts.resolved++;
      }
    });

    return counts;
  }, [shipments, selectedMonth, selectedYear]);

  // Base filtering by Month / Year + Tabs + FC + Customs Mode + Case Status
  const baseFilteredShipments = useMemo(() => {
    return shipments.filter((shp) => {
      // 1. Year / Month filter
      const d = shp.shipDate || shp.createDate || shp.arrivalDate || '';
      if (selectedMonth !== 'all') {
        if (!d.startsWith(selectedMonth)) return false;
      } else if (selectedYear !== 'all') {
        if (!d.startsWith(selectedYear)) return false;
      }

      // 2. Tab Filter (Robust classification matching business lifecycle)
      if (activeTab === 'in_transit') {
        const isInTransit =
          shp.status === 'In Transit' ||
          (!shp.arrivalDate && shp.totalReceivedQty === 0 && shp.status !== 'Arrived' && shp.status !== 'Receiving');
        if (!isInTransit) return false;
      }
      if (activeTab === 'receiving') {
        const isReceiving =
          shp.status === 'Receiving' ||
          shp.status === 'Arrived' ||
          (Boolean(shp.arrivalDate) && shp.totalReceivedQty === 0);
        if (!isReceiving) return false;
      }
      if (activeTab === 'partially') {
        const isPartial =
          shp.status === 'Partially Received' ||
          (shp.totalReceivedQty > 0 && shp.totalReceivedQty < shp.totalShipQty);
        if (!isPartial) return false;
      }
      if (activeTab === 'fully') {
        const isFully =
          shp.status === 'Fully Received' ||
          (shp.totalReceivedQty >= shp.totalShipQty && shp.totalShipQty > 0);
        if (!isFully) return false;
      }
      if (activeTab === 'discrepancy' && shp.totalDiscrepancyQty <= 0) return false;
      if (
        activeTab === 'case_eligible' &&
        shp.caseStatus !== 'Eligible' &&
        !(shp.totalDiscrepancyQty > 0 && Boolean(shp.arrivalDate) && shp.daysUntilCase !== undefined && shp.daysUntilCase <= 0)
      ) {
        return false;
      }
      if (
        activeTab === 'case_processing' &&
        shp.caseStatus !== 'Opened' &&
        shp.caseStatus !== 'In Review' &&
        shp.caseStatus !== 'Partially Resolved' &&
        shp.status !== 'Case Processing' &&
        shp.status !== 'Case Opened'
      ) {
        return false;
      }
      if (
        activeTab === 'resolved' &&
        shp.caseStatus !== 'Resolved' &&
        shp.caseStatus !== 'Closed' &&
        shp.status !== 'Resolved'
      ) {
        return false;
      }

      // 3. FC Filter
      if (selectedFc !== 'all' && shp.fc !== selectedFc) return false;

      // 4. Customs Mode Filter
      if (customsModeFilter === 'STANDALONE' && shp.customsDeclarationType !== 'STANDALONE') return false;
      if (customsModeFilter === 'MERGED' && shp.customsDeclarationType !== 'MERGED' && !shp.isMergedCustoms) return false;

      // 5. Case Status Filter
      if (caseFilter !== 'all' && shp.caseStatus !== caseFilter) return false;

      return true;
    });
  }, [
    shipments,
    selectedMonth,
    selectedYear,
    activeTab,
    selectedFc,
    customsModeFilter,
    caseFilter,
  ]);

  // Display rows computation: prioritize exact ID & direct search matches,
  // and immediately append their linked customs peer shipments!
  const { displayRows, matchedDirectCount, linkedPeerCount, firstMatchedWithPeers } = useMemo(() => {
    const trimmedQuery = localSearchQuery.trim().toLowerCase();

    // If no search query, return normal filtered list
    if (!trimmedQuery) {
      return {
        displayRows: baseFilteredShipments.map((shp) => ({
          shipment: shp,
          isDirectMatch: false,
          isExactIdMatch: false,
          isLinkedPeer: false,
        })),
        matchedDirectCount: 0,
        linkedPeerCount: 0,
        firstMatchedWithPeers: null,
      };
    }

    // 1. Find direct matches in baseFilteredShipments (or global if not found in current month)
    const directMatches: { shipment: Shipment; isExact: boolean }[] = [];

    // First search in currently filtered list
    baseFilteredShipments.forEach((shp) => {
      const isExact = shp.id.trim().toLowerCase() === trimmedQuery;
      const matchesId = shp.id.toLowerCase().includes(trimmedQuery);
      const matchesName = shp.shipmentName.toLowerCase().includes(trimmedQuery);
      const matchesFc = shp.fc.toLowerCase().includes(trimmedQuery);
      const matchesTracking = (shp.tracking || '').toLowerCase().includes(trimmedQuery);
      const matchesCase = (shp.caseId || '').toLowerCase().includes(trimmedQuery);
      const matchesSku = shp.items?.some(
        (it) =>
          it.sku.toLowerCase().includes(trimmedQuery) ||
          it.productName.toLowerCase().includes(trimmedQuery) ||
          (it.itemId || '').toLowerCase().includes(trimmedQuery)
      );

      if (isExact || matchesId || matchesName || matchesFc || matchesTracking || matchesCase || matchesSku) {
        directMatches.push({ shipment: shp, isExact });
      }
    });

    // If user searched for a specific shipment ID that might exist in another month,
    // also check global shipments list so user never misses a specific query!
    if (directMatches.length === 0) {
      shipments.forEach((shp) => {
        const isExact = shp.id.trim().toLowerCase() === trimmedQuery;
        const matchesId = shp.id.toLowerCase().includes(trimmedQuery);
        if (isExact || matchesId) {
          directMatches.push({ shipment: shp, isExact });
        }
      });
    }

    // Sort direct matches: exact matches first
    directMatches.sort((a, b) => (b.isExact ? 1 : 0) - (a.isExact ? 1 : 0));

    // 2. Identify linked peer shipments
    const resultRows: DisplayShipmentRow[] = [];
    const includedIds = new Set<string>();
    let firstWithPeers: Shipment | null = null;
    let peersAddedCount = 0;

    directMatches.forEach(({ shipment, isExact }) => {
      if (!includedIds.has(shipment.id.toUpperCase())) {
        includedIds.add(shipment.id.toUpperCase());
        resultRows.push({
          shipment,
          isDirectMatch: true,
          isExactIdMatch: isExact,
          isLinkedPeer: false,
        });

        const peers = shipment.mergedCustomsShipmentIds || [];
        if (peers.length > 0 && !firstWithPeers) {
          firstWithPeers = shipment;
        }

        peers.forEach((peerId) => {
          const normPeerId = peerId.trim().toUpperCase();
          if (!includedIds.has(normPeerId)) {
            const peerShp = shipments.find(
              (s) => s.id.trim().toUpperCase() === normPeerId
            );
            if (peerShp) {
              includedIds.add(normPeerId);
              peersAddedCount++;
              resultRows.push({
                shipment: peerShp,
                isDirectMatch: false,
                isExactIdMatch: false,
                isLinkedPeer: true,
                peerOfShipmentId: shipment.id,
              });
            }
          }
        });
      }
    });

    return {
      displayRows: resultRows,
      matchedDirectCount: directMatches.length,
      linkedPeerCount: peersAddedCount,
      firstMatchedWithPeers: firstWithPeers,
    };
  }, [baseFilteredShipments, localSearchQuery, shipments]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(displayRows.map((r) => r.shipment.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 票货件吗？此操作无法撤销。`)) {
      onBatchDeleteShipments(selectedIds);
      setSelectedIds([]);
    }
  };

  const resetFilters = () => {
    handleSearchChange('');
    setSelectedYear('all');
    setSelectedMonth('all');
    setActiveTab('all');
    setSelectedFc('all');
    setCustomsModeFilter('all');
    setCaseFilter('all');
  };

  // Quick action: mark In Transit shipment as Arrived at warehouse
  const handleQuickMarkArrived = (shp: Shipment) => {
    if (!onUpdateShipment) return;
    const today = getTodayString();
    const updated = calculateShipmentMetrics({
      ...shp,
      arrivalDate: today,
      status: 'Arrived',
    });
    onUpdateShipment(updated);
  };

  // Quick action: mark Arrived/Partial shipment as Fully Received
  const handleQuickMarkFullyReceived = (shp: Shipment) => {
    if (!onUpdateShipment) return;
    const today = getTodayString();
    const updatedItems = (shp.items || []).map((it) => ({
      ...it,
      receivedQty: it.shipQty,
      receivedCartons: it.cartons,
      discrepancyQty: 0,
      receivedDate: it.receivedDate || today,
    }));
    const updated = calculateShipmentMetrics({
      ...shp,
      arrivalDate: shp.arrivalDate || today,
      status: 'Fully Received',
      items: updatedItems,
      totalReceivedQty: shp.totalShipQty,
      totalDiscrepancyQty: 0,
    });
    onUpdateShipment(updated);
  };

  // Find latest active month for zero-count banner suggestion
  const latestActiveMonth = availableMonths.find((m) => m.count > 0);
  const selectedMonthObj = availableMonths.find((m) => m.key === selectedMonth);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* 1. Header with Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Walmart 货件全生命周期管理
            <span className="text-xs font-normal text-slate-500 font-mono">
              ({displayRows.length} / {shipments.length} 票货件)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            涵盖备货、发货、到仓、接收清点、差异核对与 10 天 Case 全流程记录
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              批量删除 ({selectedIds.length})
            </button>
          )}

          {onOpenFreightSync && (
            <button
              onClick={onOpenFreightSync}
              title="从月头程费用汇总表中反向提取 Shipment ID 及仓库"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              从头程提取货件
            </button>
          )}

          <button
            onClick={() => exportShipmentsToExcel(displayRows.map((r) => r.shipment))}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            导出数据
          </button>

          <button
            onClick={() => onOpenNewShipmentModal(undefined, 'batch')}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            批量表格导入
          </button>

          <button
            onClick={() => onOpenNewShipmentModal(undefined, 'manual')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            新增货件
          </button>
        </div>
      </div>

      {/* 2. Year & Month Filter Strip + Localized Search Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Year & Month Control Group */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>出货月份:</span>
            </div>

            {/* Year Selector Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedMonth('all');
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedYear === 'all' && selectedMonth === 'all'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部年份
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => {
                    setSelectedYear(yr);
                    const firstM = availableMonths.find((m) => m.year === yr);
                    setSelectedMonth(firstM ? firstM.key : 'all');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    selectedYear === yr
                      ? 'bg-white text-blue-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {yr}年
                </button>
              ))}
            </div>

            {/* Month Select Dropdown */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMonth(val);
                if (val !== 'all') {
                  setSelectedYear(val.slice(0, 4));
                }
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="all">全部月份汇总 ({shipments.length} 票)</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.display} {m.isCurrent ? ' (当月)' : ''} — {m.count} 票
                </option>
              ))}
            </select>

            {/* Quick Switch to Current Month Button */}
            {selectedMonth !== currentMonthKey && (
              <button
                onClick={() => {
                  setSelectedYear(currentMonthKey.slice(0, 4));
                  setSelectedMonth(currentMonthKey);
                }}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition-colors"
              >
                回到当月 ({currentMonthKey})
              </button>
            )}
          </div>

          {/* Localized Search Box */}
          <div className="relative flex-1 lg:max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索货件编号 / SKU / 产品名称 / 仓库 / 运单号 / Case ID..."
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs"
            />
            {localSearchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-0.5"
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Month Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100">
          <button
            onClick={() => {
              setSelectedYear('all');
              setSelectedMonth('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedMonth === 'all'
                ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>全部月份</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedMonth === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {shipments.length}
            </span>
          </button>

          {availableMonths
            .filter((m) => selectedYear === 'all' || m.year === selectedYear)
            .map((m) => {
              const isSelected = selectedMonth === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setSelectedMonth(m.key);
                    setSelectedYear(m.year);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{m.display}</span>
                  {m.isCurrent && (
                    <span className={`text-[9px] px-1 py-0.2 rounded ${isSelected ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-700 font-bold'}`}>
                      当月
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {m.count}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Zero Count in Current Month Notice Banner */}
      {selectedMonth !== 'all' && selectedMonthObj && selectedMonthObj.count === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              您当前所选月份（<strong>{selectedMonthObj.display}</strong>{selectedMonthObj.isCurrent ? ' · 当月' : ''}）暂无出货记录。
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {latestActiveMonth && (
              <button
                onClick={() => {
                  setSelectedMonth(latestActiveMonth.key);
                  setSelectedYear(latestActiveMonth.year);
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors shadow-2xs"
              >
                切换至最近有货月份 ({latestActiveMonth.display} · {latestActiveMonth.count}票)
              </button>
            )}
            <button
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold transition-colors"
            >
              查看全部月份
            </button>
          </div>
        </div>
      )}

      {/* 3. Search Result & Associated Shipments Banner */}
      {localSearchQuery.trim() && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <span>搜索结果：命中 {matchedDirectCount} 票目标货件</span>
                {linkedPeerCount > 0 && (
                  <span className="text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold text-[11px]">
                    + 已优先关联展开 {linkedPeerCount} 票同批拼单货件
                  </span>
                )}
              </div>
              <p className="text-blue-700/80 text-[11px] mt-0.5">
                已为您优先置顶目标货件，并紧随呈现其同批合并报关拼单货件（共享报关与申报配额）。
              </p>
            </div>
          </div>

          {firstMatchedWithPeers && (
            <button
              onClick={() => {
                setClusterModalTarget(firstMatchedWithPeers);
                setIsClusterModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Boxes className="w-3.5 h-3.5" />
              查看关联货件及拼单明细对比
            </button>
          )}
        </div>
      )}

      {/* 4. Quick Status Filter Tabs with Live Counters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'all', label: '全部货件', count: tabCounts.all },
          { id: 'in_transit', label: '在途运输中', count: tabCounts.in_transit },
          { id: 'receiving', label: '待接收/清点', count: tabCounts.receiving },
          { id: 'partially', label: '部分接收', count: tabCounts.partially },
          { id: 'fully', label: '全部接收', count: tabCounts.fully },
          { id: 'discrepancy', label: '存在差异', count: tabCounts.discrepancy },
          { id: 'case_eligible', label: '已达10天Case', count: tabCounts.case_eligible },
          { id: 'case_processing', label: 'Case处理中', count: tabCounts.case_processing },
          { id: 'resolved', label: '已解决闭环', count: tabCounts.resolved },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5. Streamlined Secondary Filters Bar (No Duplicates) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* FC Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">目的仓 (FC):</span>
            <select
              value={selectedFc}
              onChange={(e) => setSelectedFc(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部仓库 (All FCs)</option>
              {uniqueFcs.map((fc) => (
                <option key={fc} value={fc}>
                  {fc}
                </option>
              ))}
            </select>
          </div>

          {/* Customs Declaration Mode Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">报关申报:</span>
            <select
              value={customsModeFilter}
              onChange={(e) => setCustomsModeFilter(e.target.value as 'all' | 'STANDALONE' | 'MERGED')}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部报关方式</option>
              <option value="STANDALONE">独立报关</option>
              <option value="MERGED">合并报关拼单</option>
            </select>
          </div>

          {/* Case Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Case 状态:</span>
            <select
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部 Case 状态</option>
              <option value="Not Eligible">未达条件 (Not Eligible)</option>
              <option value="Eligible">可以开Case (Eligible)</option>
              <option value="Opened">已提交 (Opened)</option>
              <option value="In Review">调查中 (In Review)</option>
              <option value="Partially Resolved">部分解决 (Partially Resolved)</option>
              <option value="Resolved">已解决闭环 (Resolved)</option>
              <option value="Rejected">已驳回 (Rejected)</option>
            </select>
          </div>
        </div>

        <button
          onClick={resetFilters}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-slate-100 rounded-md"
          title="恢复默认筛选状态"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置筛选
        </button>
      </div>

      {/* 6. Main Full Shipment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-xs text-left whitespace-nowrap border-separate border-spacing-0">
            <thead className="bg-slate-900 text-slate-200 font-semibold">
              <tr>
                {/* 1. Sticky Checkbox */}
                <th className="p-3 text-center w-10 min-w-[40px] max-w-[40px] sticky left-0 z-20 bg-slate-900 border-b border-slate-800">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 &&
                      selectedIds.length === displayRows.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-600 text-blue-600"
                  />
                </th>
                {/* 2. Sticky Shipment ID */}
                <th className="p-3 w-[185px] min-w-[185px] max-w-[185px] sticky left-[40px] z-20 bg-slate-900 border-b border-slate-800">
                  货件编号 (Shipment ID)
                </th>
                {/* 3. Sticky SKU & Product */}
                <th className="p-3 w-[210px] min-w-[210px] max-w-[210px] sticky left-[225px] z-20 bg-slate-900 border-b border-slate-800">
                  SKU / 产品信息
                </th>
                {/* 4. Sticky FC Warehouse */}
                <th className="p-3 w-[100px] min-w-[100px] max-w-[100px] sticky left-[435px] z-20 bg-slate-900 border-b border-slate-800 border-r border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  目标 FC
                </th>
                <th className="p-3 text-right border-b border-slate-800">发货数量 (Ship)</th>
                <th className="p-3 text-right border-b border-slate-800">Walmart接收 (Recv)</th>
                <th className="p-3 text-right border-b border-slate-800">差异 (Diff)</th>
                <th className="p-3 text-center border-b border-slate-800">箱数 (发/收)</th>
                <th className="p-3 border-b border-slate-800">发货日期</th>
                <th className="p-3 border-b border-slate-800">实际到仓日期</th>
                <th className="p-3 border-b border-slate-800">10天Case状态</th>
                <th className="p-3 text-center border-b border-slate-800">货件状态</th>
                <th className="p-3 text-center border-b border-slate-800">Case 状态</th>
                <th className="p-3 text-center border-b border-slate-800">操作</th>
              </tr>
            </thead>
            <tbody>
              {(showAllRows ? displayRows : displayRows.slice(0, displayLimit)).map(
                ({ shipment: shp, isExactIdMatch, isLinkedPeer, isDirectMatch }) => {
                  const firstItem = shp.items?.[0];
                  const time = getCaseTimeDisplay(shp.arrivalDate);
                  const isSelected = selectedIds.includes(shp.id);
                  const stickyBg = isSelected
                    ? 'bg-blue-50/95 group-hover:bg-blue-100/90'
                    : isLinkedPeer
                    ? 'bg-amber-50/50 group-hover:bg-amber-100/50'
                    : 'bg-white group-hover:bg-slate-50';

                  return (
                    <tr
                      key={shp.id}
                      className={`group hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : isLinkedPeer ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* 1. Sticky Checkbox */}
                      <td className={`p-3 text-center w-10 min-w-[40px] max-w-[40px] sticky left-0 z-10 ${stickyBg} border-b border-slate-200`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(shp.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                      </td>

                      {/* 2. Sticky Shipment ID & Name */}
                      <td className={`p-3 w-[185px] min-w-[185px] max-w-[185px] sticky left-[40px] z-10 ${stickyBg} border-b border-slate-200`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => onSelectShipment(shp.id)}
                            className="font-mono font-bold text-blue-600 hover:underline block text-left truncate max-w-[125px]"
                            title={shp.id}
                          >
                            {shp.id}
                          </button>

                          {isExactIdMatch && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold">
                              搜索目标
                            </span>
                          )}

                          {shp.mergedCustomsShipmentIds && shp.mergedCustomsShipmentIds.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setClusterModalTarget(shp);
                                setIsClusterModalOpen(true);
                              }}
                              className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 flex-shrink-0 cursor-pointer transition-colors"
                              title={`手动关联拼单：包含本票共 ${shp.mergedCustomsShipmentIds.length + 1} 票货件 (点击查看对比明细)`}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              拼单 {shp.mergedCustomsShipmentIds.length + 1}票
                            </button>
                          )}
                        </div>

                        {isLinkedPeer && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-semibold">
                              <Link2 className="w-2 h-2" /> 关联拼单货件 (同批报关)
                            </span>
                          </div>
                        )}

                        <span className="text-[11px] text-slate-500 truncate max-w-[170px] block mt-0.5">
                          {shp.shipmentName}
                        </span>
                      </td>

                      {/* 3. Sticky SKU & Product Name */}
                      <td className={`p-3 w-[210px] min-w-[210px] max-w-[210px] sticky left-[225px] z-10 ${stickyBg} border-b border-slate-200`}>
                        {shp.items && shp.items.length > 0 ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-semibold text-slate-900 truncate max-w-[170px]" title={firstItem?.sku}>
                                {shp.items.length === 1 ? firstItem?.sku : `${firstItem?.sku} 等 ${shp.items.length}个SKU`}
                              </span>
                              {shp.items.some((it) => it.requiresFollowup) && (
                                <span className="p-0.5 text-red-500 flex-shrink-0" title="包含重点跟进差异SKU">
                                  <BellRing className="w-3 h-3 animate-pulse" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[190px]" title={firstItem?.productName}>
                              {shp.items.length === 1 ? firstItem?.productName : `${shp.items.length} 个商品项`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] text-slate-400 block italic">未补充SKU明细</span>
                            {onOpenProductSupplement && (
                              <button
                                onClick={() => onOpenProductSupplement(shp)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-medium"
                              >
                                <Plus className="w-2.5 h-2.5" /> 补充SKU
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Sticky FC Warehouse & Channel */}
                      <td className={`p-3 w-[100px] min-w-[100px] max-w-[100px] sticky left-[435px] z-10 ${stickyBg} border-b border-slate-200 border-r border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]`}>
                        <span className="font-mono font-semibold text-slate-800 block">
                          {shp.fc}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block mt-0.5" title={shp.channel || shp.carrier || '美森限时达'}>
                          {shp.channel || shp.carrier || '美森限时达'}
                        </span>
                      </td>

                      {/* Ship Qty */}
                      <td className="p-3 text-right font-mono font-semibold text-slate-900 border-b border-slate-200">
                        {shp.totalShipQty}
                      </td>

                      {/* Received Qty */}
                      <td className="p-3 text-right font-mono font-bold text-blue-600 border-b border-slate-200">
                        {shp.totalReceivedQty}
                      </td>

                      {/* Discrepancy Qty */}
                      <td className="p-3 text-right border-b border-slate-200">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            shp.totalDiscrepancyQty > 0
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'text-emerald-600 font-medium'
                          }`}
                        >
                          {shp.totalDiscrepancyQty > 0 ? `-${shp.totalDiscrepancyQty}` : '0'}
                        </span>
                      </td>

                      {/* Cartons */}
                      <td className="p-3 text-center font-mono text-slate-600 border-b border-slate-200">
                        {shp.totalCartons} / {shp.totalReceivedCartons}
                        {shp.missingCartons > 0 && (
                          <span className="text-red-500 ml-1 text-[10px]">
                            (-{shp.missingCartons})
                          </span>
                        )}
                      </td>

                      {/* Ship Date */}
                      <td className="p-3 font-mono text-slate-600 border-b border-slate-200">{shp.shipDate}</td>

                      {/* Arrival Date */}
                      <td className="p-3 font-mono border-b border-slate-200">
                        {shp.arrivalDate ? (
                          <span className="font-semibold text-slate-900">{shp.arrivalDate}</span>
                        ) : (
                          <span className="text-slate-400">ETA: {shp.eta || '未填'}</span>
                        )}
                      </td>

                      {/* 10-Day Case Status */}
                      <td className="p-3 border-b border-slate-200">
                        {shp.totalDiscrepancyQty > 0 ? (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border inline-block ${time.badgeClass}`}
                          >
                            {time.text}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> 无差异
                          </span>
                        )}
                      </td>

                      {/* Shipment Status */}
                      <td className="p-3 text-center border-b border-slate-200">
                        <div className="flex flex-col items-center gap-1">
                          {(() => {
                            if (shp.status === 'Fully Received') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  全部接收
                                </span>
                              );
                            }
                            if (shp.status === 'Resolved') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                                  已闭环
                                </span>
                              );
                            }
                            if (shp.status === 'Case Eligible') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  达10天Case
                                </span>
                              );
                            }
                            if (shp.status === 'Case Processing' || shp.status === 'Case Opened') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                  Case调查中
                                </span>
                              );
                            }
                            if (shp.status === 'Partially Received') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  部分接收
                                </span>
                              );
                            }
                            if (shp.status === 'Receiving') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                  待接收/清点
                                </span>
                              );
                            }
                            if (shp.status === 'Arrived') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  已到仓待收
                                </span>
                              );
                            }
                            if (shp.status === 'Draft') {
                              return (
                                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  草稿
                                </span>
                              );
                            }
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                在途运输中
                              </span>
                            );
                          })()}

                          {/* Quick status progression actions */}
                          {onUpdateShipment && (shp.status === 'In Transit' || !shp.arrivalDate) && (
                            <button
                              onClick={() => handleQuickMarkArrived(shp)}
                              title="一键标记货件今日已送达仓库，自动转入已到仓/待接收状态"
                              className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium border border-blue-200 transition-colors"
                            >
                              标记到仓
                            </button>
                          )}
                          {onUpdateShipment && (shp.status === 'Arrived' || shp.status === 'Receiving') && shp.totalDiscrepancyQty <= 0 && (
                            <button
                              onClick={() => handleQuickMarkFullyReceived(shp)}
                              title="一键确认全额接收完毕无差异"
                              className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium border border-emerald-200 transition-colors"
                            >
                              标记全收
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Case Status */}
                      <td className="p-3 text-center border-b border-slate-200">
                        {(() => {
                          if (shp.caseStatus === 'Resolved' || shp.caseStatus === 'Closed') {
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                已解决闭环
                              </span>
                            );
                          }
                          if (shp.caseStatus === 'In Review' || shp.caseStatus === 'Opened') {
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                调查处理中
                              </span>
                            );
                          }
                          if (shp.caseStatus === 'Eligible') {
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-50 text-red-700 border border-red-200">
                                可以开Case
                              </span>
                            );
                          }
                          if (shp.caseStatus === 'Rejected') {
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                已驳回
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] text-slate-400">
                              未达条件
                            </span>
                          );
                        })()}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3 text-center border-b border-slate-200">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectShipment(shp.id)}
                            title="查看详情"
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* View Associated Cluster Details Button (Requirement 3) */}
                          {(shp.mergedCustomsShipmentIds && shp.mergedCustomsShipmentIds.length > 0 || isLinkedPeer) && (
                            <button
                              onClick={() => {
                                setClusterModalTarget(shp);
                                setIsClusterModalOpen(true);
                              }}
                              title="查看同批关联拼单及明细对比"
                              className="p-1 hover:bg-blue-100 rounded text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onOpenProductSupplement && (
                            <button
                              onClick={() => onOpenProductSupplement(shp)}
                              title="补充/编辑商品明细与差异标注"
                              className="p-1 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-800 transition-colors"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {shp.totalDiscrepancyQty > 0 && (
                            <button
                              onClick={() => onOpenCaseModal(shp)}
                              title="开Case / 更新处理"
                              className="p-1 hover:bg-purple-100 rounded text-purple-600 hover:text-purple-800 transition-colors"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenNewShipmentModal(shp)}
                            title="编辑货件主信息"
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm(`确定要删除货件 ${shp.id} 吗？`)) {
                                onDeleteShipment(shp.id);
                              }
                            }}
                            title="删除货件"
                            className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-xs text-slate-500">
                    <div className="max-w-sm mx-auto flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-slate-700">暂无符合条件的 Walmart 货件记录</p>
                      <p className="text-[11px] text-slate-400">
                        {selectedMonth !== 'all'
                          ? `当前筛选月份为 ${selectedMonth}。您可以点击“查看全部月份”或通过表单录入新货件。`
                          : '您可以直接下载标准模板填写后批量导入，或通过表单手动录入。'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedMonth !== 'all' && (
                          <button
                            onClick={() => {
                              setSelectedYear('all');
                              setSelectedMonth('all');
                            }}
                            className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            查看全部月份
                          </button>
                        )}
                        <button
                          onClick={() => downloadShipmentBatchTemplate('xlsx')}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-2xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          下载模板
                        </button>
                        <button
                          onClick={() => onOpenNewShipmentModal(undefined, 'batch')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          批量表格导入
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Display Limit & Pagination / Show More Control */}
        {displayRows.length > 15 && (
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              当前显示{' '}
              <span className="font-bold text-slate-900 font-mono">
                {showAllRows
                  ? displayRows.length
                  : Math.min(displayLimit, displayRows.length)}
              </span>{' '}
              / 共 <span className="font-bold text-slate-900 font-mono">{displayRows.length}</span> 条货件
            </div>

            <div className="flex items-center gap-2">
              {!showAllRows && displayLimit < displayRows.length && (
                <button
                  onClick={() => setDisplayLimit((prev) => prev + 15)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 shadow-2xs"
                >
                  继续加载 15 条
                </button>
              )}

              <button
                onClick={() => {
                  setShowAllRows(!showAllRows);
                  if (showAllRows) setDisplayLimit(15);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-2xs"
              >
                {showAllRows ? '折叠为默认 15 条' : `展开全部 (${displayRows.length} 条)`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 8. Linked Shipments Detail Modal (Requirement 3) */}
      <LinkedShipmentsModal
        isOpen={isClusterModalOpen}
        onClose={() => setIsClusterModalOpen(false)}
        targetShipment={clusterModalTarget}
        allShipments={shipments}
        onSelectShipment={onSelectShipment}
        onEditShipment={(shp) => onOpenNewShipmentModal(shp, 'manual')}
      />
    </div>
  );
};
