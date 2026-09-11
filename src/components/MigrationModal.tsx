import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  ArrowRight,
  Shield,
  Loader2,
} from 'lucide-react';
import { migrationService, LocalDataSummary, MigrationResult } from '../services/migrationService';

interface MigrationModalProps {
  userId: string;
  summary: LocalDataSummary;
  isOpen: boolean;
  onClose: () => void;
  onMigrated: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  userId,
  summary,
  isOpen,
  onClose,
  onMigrated,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await migrationService.migrateToCloud(userId);
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          onMigrated();
        }, 1200);
      }
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    migrationService.dismissMigrationPrompt();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">检测到本机历史数据</h3>
              <p className="text-xs text-blue-100 mt-0.5">
                是否将此前浏览器本地录入的业务数据迁移至云端数据库？
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!result ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>待迁移数据清单</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">货件记录</span>
                    <span className="font-bold text-slate-900">{summary.shipments} 笔</span>
                  </div>
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">库存 SKU</span>
                    <span className="font-bold text-slate-900">{summary.inventory} 条</span>
                  </div>
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">Case 工单</span>
                    <span className="font-bold text-slate-900">{summary.cases} 笔</span>
                  </div>
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">头程运费项</span>
                    <span className="font-bold text-slate-900">{summary.freightItems} 项</span>
                  </div>
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">商品主库</span>
                    <span className="font-bold text-slate-900">{summary.products} 个</span>
                  </div>
                  <div className="flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">库存流水</span>
                    <span className="font-bold text-slate-900">{summary.ledger} 条</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  迁移将保留所有业务状态与货件计算逻辑，并在云端为您建立专属隔离存储。原有本地数据仍将保留备份，确保零风险。
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isMigrating}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  暂不同步
                </button>
                <button
                  type="button"
                  onClick={handleStartMigration}
                  disabled={isMigrating}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>正在同步至云端...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>一键迁移至云端</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-3">
                {result.success ? (
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                )}
                <h4 className="font-bold text-sm text-slate-900">
                  {result.success ? '历史数据已成功迁移至云端！' : '部分数据迁移完成'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  共迁移 {result.totalMigrated} 项数据
                  {result.totalFailed > 0 && `，失败 ${result.totalFailed} 项`}
                </p>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                {result.categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <span className="text-slate-600">{cat.name}</span>
                    <span className="font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {cat.migrated} 项
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onMigrated}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  <span>进入工作台</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
