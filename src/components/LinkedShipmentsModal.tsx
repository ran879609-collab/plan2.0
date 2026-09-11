import React from 'react';
import {
  X,
  Link2,
  Boxes,
  Building2,
  Calendar,
  ExternalLink,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Package,
  Layers,
} from 'lucide-react';
import { Shipment } from '../types';

interface LinkedShipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetShipment: Shipment | null;
  allShipments: Shipment[];
  onSelectShipment: (shipmentId: string) => void;
  onEditShipment?: (shipment: Shipment) => void;
}

export const LinkedShipmentsModal: React.FC<LinkedShipmentsModalProps> = ({
  isOpen,
  onClose,
  targetShipment,
  allShipments,
  onSelectShipment,
  onEditShipment,
}) => {
  if (!isOpen || !targetShipment) return null;

  // Gather target shipment + all linked peer shipments
  const peerIds = (targetShipment.mergedCustomsShipmentIds || []).map((id) =>
    id.toUpperCase()
  );
  const clusterShipments: Shipment[] = [targetShipment];

  peerIds.forEach((pId) => {
    if (pId !== targetShipment.id.toUpperCase()) {
      const found = allShipments.find((s) => s.id.toUpperCase() === pId);
      if (found && !clusterShipments.some((s) => s.id.toUpperCase() === found.id.toUpperCase())) {
        clusterShipments.push(found);
      }
    }
  });

  // Calculate cluster summary totals
  const totalShipments = clusterShipments.length;
  const totalShipQty = clusterShipments.reduce((sum, s) => sum + (s.totalShipQty || 0), 0);
  const totalReceivedQty = clusterShipments.reduce((sum, s) => sum + (s.totalReceivedQty || 0), 0);
  const totalDiscrepancyQty = clusterShipments.reduce((sum, s) => sum + (s.totalDiscrepancyQty || 0), 0);
  const totalCartons = clusterShipments.reduce((sum, s) => sum + (s.totalCartons || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  同批报关拼单货件明细与对比
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[11px] font-semibold">
                  共 {totalShipments} 票拼单
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                当前聚焦货件：<span className="font-mono font-bold text-white">{targetShipment.id}</span> · 
                共享报关费与申报品类配额（合并报关 ¥175/票）
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cluster Summary Metrics Banner */}
        <div className="bg-blue-50/70 border-b border-blue-100 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs flex-shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">拼单总票数</span>
            <span className="text-lg font-bold text-blue-900 font-mono mt-0.5 block">
              {totalShipments} <span className="text-xs font-normal text-slate-400">票</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">合计发货总件数</span>
            <span className="text-lg font-bold text-slate-800 font-mono mt-0.5 block">
              {totalShipQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">合计接收总件数</span>
            <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">
              {totalReceivedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">差异总件数</span>
            <span className={`text-lg font-bold font-mono mt-0.5 block ${totalDiscrepancyQty > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {totalDiscrepancyQty > 0 ? `-${totalDiscrepancyQty.toLocaleString()}` : '0'}{' '}
              <span className="text-xs font-normal text-slate-400">件</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">合计总箱数</span>
            <span className="text-lg font-bold text-slate-800 font-mono mt-0.5 block">
              {totalCartons} <span className="text-xs font-normal text-slate-400">箱</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">报关费分摊标准</span>
            <span className="text-xs font-semibold text-indigo-700 mt-1 block">
              ¥175/票 (整批合并)
            </span>
          </div>
        </div>

        {/* Scrollable List of Shipments in this Cluster */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {clusterShipments.map((shp, index) => {
            const isCurrentTarget = shp.id.toUpperCase() === targetShipment.id.toUpperCase();
            return (
              <div
                key={shp.id}
                className={`rounded-xl border transition-all ${
                  isCurrentTarget
                    ? 'border-blue-400 bg-blue-50/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Shipment Card Header */}
                <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 rounded-t-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {shp.id}
                        </span>
                        {isCurrentTarget ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">
                            当前聚焦票件
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5" />
                            关联同批拼单
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {shp.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        {shp.shipmentName}
                      </span>
                    </div>
                  </div>

                  {/* Actions for this shipment */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onSelectShipment(shp.id);
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      打开货件详情
                    </button>
                    {onEditShipment && (
                      <button
                        onClick={() => {
                          onClose();
                          onEditShipment(shp);
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        编辑
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Metadata Row */}
                <div className="p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-100 bg-white">
                  <div>
                    <span className="text-slate-400 text-[11px] block">目标仓库 (FC)</span>
                    <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                      {shp.fc}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">运输渠道</span>
                    <span className="font-medium text-slate-700 mt-0.5 block">
                      {shp.channel || shp.carrier || '美森限时达'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">发货日期 / 到仓</span>
                    <span className="font-mono text-slate-700 mt-0.5 block">
                      {shp.shipDate || '未填'} → {shp.arrivalDate || shp.eta || '未到仓'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">箱数 / 发收差异</span>
                    <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                      {shp.totalCartons} 箱 · 发 {shp.totalShipQty} / 收 {shp.totalReceivedQty}{' '}
                      {shp.totalDiscrepancyQty > 0 && (
                        <span className="text-red-600 font-bold ml-1">
                          (差异 -{shp.totalDiscrepancyQty})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* SKU Items List in this shipment */}
                <div className="p-3.5 sm:p-4 bg-slate-50/40">
                  <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-blue-600" />
                    商品明细清单 ({shp.items?.length || 0} 个 SKU):
                  </div>

                  {shp.items && shp.items.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200">
                          <tr>
                            <th className="p-2 pl-3">SKU</th>
                            <th className="p-2">商品名称</th>
                            <th className="p-2 text-right">发货数量</th>
                            <th className="p-2 text-right">已接收</th>
                            <th className="p-2 text-right">差异</th>
                            <th className="p-2 text-center">箱数</th>
                            <th className="p-2 text-center">装箱规格</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {shp.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="p-2 pl-3 font-mono font-semibold text-slate-900">
                                {it.sku}
                              </td>
                              <td className="p-2 text-slate-600 max-w-[220px] truncate" title={it.productName}>
                                {it.productName}
                              </td>
                              <td className="p-2 text-right font-mono font-medium text-slate-800">
                                {it.shipQty}
                              </td>
                              <td className="p-2 text-right font-mono font-medium text-blue-600">
                                {it.receivedQty}
                              </td>
                              <td className="p-2 text-right font-mono font-bold">
                                {it.discrepancyQty > 0 ? (
                                  <span className="text-red-600">-{it.discrepancyQty}</span>
                                ) : (
                                  <span className="text-emerald-600">0</span>
                                )}
                              </td>
                              <td className="p-2 text-center font-mono text-slate-600">
                                {it.cartons || '-'} 箱
                              </td>
                              <td className="p-2 text-center font-mono text-slate-500 text-[11px]">
                                {it.qtyPerCarton ? `${it.qtyPerCarton} 件/箱` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-1">暂未录入具体 SKU 细分数据</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            提示：只有经手动配置关联的货件才会进入此拼单列表，绝不按同日同渠道强制归并。
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
