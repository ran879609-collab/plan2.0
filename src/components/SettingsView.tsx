import React, { useState } from 'react';
import {
  Settings,
  Calendar,
  RotateCcw,
  Download,
  UploadCloud,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Cloud,
  Server,
  RefreshCw,
} from 'lucide-react';
import { AppSettings } from '../types';
import { getTodayString } from '../utils/dateUtils';
import { isSupabaseConfigured } from '../lib/supabase';
import { CloudSyncStatus } from '../utils/storage';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDemo: () => void;
  onClearAllData: () => void;
  onExportJsonBackup: () => void;
  onImportJsonBackup: (jsonContent: string) => void;
  user?: { email?: string; id?: string } | null;
  syncStatus?: CloudSyncStatus;
  onTriggerCloudSync?: () => void;
  onTriggerMigrationModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetDemo,
  onClearAllData,
  onExportJsonBackup,
  onImportJsonBackup,
  user,
  syncStatus = 'idle',
  onTriggerCloudSync,
  onTriggerMigrationModal,
}) => {
  const [caseRuleDays, setCaseRuleDays] = useState<number>(settings.caseRuleDays || 10);
  const [approachingDays, setApproachingDays] = useState<number>(
    settings.approachingAlertDays || 3
  );
  const [autoStatusCalculation, setAutoStatusCalculation] = useState<boolean>(
    settings.autoStatusCalculation ?? true
  );

  // Time-Traveler / Custom Today
  const [simulatedDate, setSimulatedDate] = useState<string>(
    settings.customTodayDate || getTodayString()
  );

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      caseRuleDays,
      approachingAlertDays: approachingDays,
      autoStatusCalculation,
      customTodayDate: simulatedDate !== getTodayString() ? simulatedDate : undefined,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetToRealToday = () => {
    const realToday = new Date().toISOString().slice(0, 10);
    setSimulatedDate(realToday);
    onUpdateSettings({
      ...settings,
      customTodayDate: undefined,
    });
  };

  const handleJsonFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJsonBackup(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          系统设置
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          配置业务规则周期、基准日期、云端同步状态与数据持久化
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          系统参数已成功更新并生效
        </div>
      )}

      {/* Cloud & Supabase Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200">
          <Cloud className="w-4 h-4 text-blue-600" />
          Supabase 云端数据库与多端同步
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-slate-500">连接状态:</span>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured ? (
                <span className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  已配置 Supabase 云端
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-100/60 px-2.5 py-1 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  未检测到云端环境变量
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              数据表结构（RLS行级安全与触发器）已构建于 supabase/schema.sql。
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-slate-500">当前账号与同步:</span>
            <div className="font-semibold text-slate-800 truncate">
              {user ? user.email : '未登录 (本地模式)'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">实时同步状态:</span>
              <span className="font-mono font-semibold text-slate-700">
                {syncStatus === 'synced' ? '已同步 (OK)' : syncStatus === 'syncing' ? '正在同步...' : syncStatus === 'error' ? '异常 (已转本地暂存)' : '就绪'}
              </span>
            </div>
          </div>
        </div>

        {user && onTriggerMigrationModal && (
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTriggerMigrationModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>检测并迁移本机历史数据至云端</span>
            </button>

            {onTriggerCloudSync && (
              <button
                type="button"
                onClick={onTriggerCloudSync}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>从云端重新拉取最新数据</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Form Section 1: Business Rules */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          业务规则配置
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Case 判定基准周期 (默认 10 天)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={caseRuleDays}
                onChange={(e) => setCaseRuleDays(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-slate-500">天 (实际到仓日 + N 天)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              以实际到仓日期起算，未到仓前不开立 Case
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Case 预警提前量
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="7"
                value={approachingDays}
                onChange={(e) => setApproachingDays(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-slate-500">天 (进入待办提醒)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              提前预警即将到达 10 天处理时效的货件
            </p>
          </div>
        </div>

        {/* Section 2: Time Travel / Date Simulation */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                系统基准日期
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                可调整系统的当前业务日期，用于测试跨周期的状态流转与预警触发
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetToRealToday}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              恢复今日
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={simulatedDate}
              onChange={(e) => setSimulatedDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              当前基准日: <strong className="font-mono text-purple-700">{simulatedDate}</strong>
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            保存并应用配置
          </button>
        </div>
      </form>

      {/* Section 3: Data Backup & Reset */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
          数据持久化备份与环境重置
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Backup */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-blue-600" />
              导出完整 JSON 备份
            </div>
            <p className="text-[11px] text-slate-500">
              将所有货件、库存、Case记录及流水导出为一份独立的 JSON 文件保存。
            </p>
            <button
              onClick={onExportJsonBackup}
              className="w-full py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg shadow-xs transition-colors"
            >
              导出备份文件
            </button>
          </div>

          {/* Restore */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-purple-600" />
              导入恢复 JSON 备份
            </div>
            <p className="text-[11px] text-slate-500">
              从先前导出的 JSON 备份中完整还原所有业务数据。
            </p>
            <label className="w-full py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer">
              <span>选择备份文件还原</span>
              <input
                type="file"
                accept=".json"
                onChange={handleJsonFileInput}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset Demo */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              运行 / 重置参考数据
            </div>
            <p className="text-[11px] text-amber-700">
              重新载入包含 8 大经典业务场景（包括超期Case、即将达标、正常全部接收等）的标准参考测试数据。
            </p>
            <button
              onClick={onResetDemo}
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              运行参考数据
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              清空全部本地数据
            </div>
            <div className="text-[11px] text-slate-400">
              彻底清空浏览器 LocalStorage 中的所有货件、库存与流水，以空数据库重新开始。
            </div>
          </div>
          <button
            onClick={onClearAllData}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空所有数据
          </button>
        </div>
      </div>
    </div>
  );
};
