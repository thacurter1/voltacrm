import React, { useState } from 'react';
import { Zap, Flame, FileText, Upload, ShieldCheck, CheckCircle2, Phone, Calendar, ArrowUpRight, Clock } from 'lucide-react';
import { Customer, CustomerBill, UtilityPoint } from '../../types';

interface SubitoMySuppliesProps {
  customer: Customer;
  bills: CustomerBill[];
  onUploadBill: () => void;
  onOpenBillDetails?: (bill: CustomerBill) => void;
}

export const SubitoMySupplies: React.FC<SubitoMySuppliesProps> = ({
  customer,
  bills,
  onUploadBill,
  onOpenBillDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'supplies' | 'bills' | 'readings'>('supplies');

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Forniture Attive & Certificate</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {customer.name}
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Codice Fiscale: <span className="font-mono text-white">{customer.fiscalCode}</span> • Città: {customer.city}
          </p>
        </div>

        {/* Action button */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={onUploadBill}
            className="px-4 py-2.5 rounded-xl bg-[#e02424] hover:bg-[#c81e1e] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Carica Nuova Bolletta</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('supplies')}
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === 'supplies' ? 'text-[#e02424]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Punti di Fornitura ({customer.utilityPoints?.length || 0})</span>
          {activeTab === 'supplies' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e02424] rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === 'bills' ? 'text-[#e02424]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Storico Bollette ({bills.length})</span>
          {activeTab === 'bills' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e02424] rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Utility Points */}
      {activeTab === 'supplies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customer.utilityPoints?.map((point: UtilityPoint) => {
            const isLuce = point.type === 'luce';
            return (
              <div
                key={point.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isLuce ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isLuce ? <Zap className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Fornitura {point.type}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 font-mono">
                        {point.podOrPdr}
                      </h4>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Attiva
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fornitore Attuale</span>
                    <span className="font-bold text-slate-900">{point.currentSupplier}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Piano Tariffario</span>
                    <span className="font-semibold text-slate-700">{point.currentOfferName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Consumo Annuo</span>
                    <span className="font-bold text-slate-900">
                      {point.annualConsumption.toLocaleString('it-IT')} {isLuce ? 'kWh' : 'Smc'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Costo Unitario</span>
                    <span className="font-bold text-slate-900">
                      {point.currentUnitCost} {isLuce ? '€/kWh' : '€/Smc'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Garanzia prezzo tutelato
                  </span>
                  <span>Quota fissa: €{point.currentFixedFeeYear}/anno</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Bills */}
      {activeTab === 'bills' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {bills.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">Nessuna bolletta caricata finora.</p>
              <button
                onClick={onUploadBill}
                className="px-4 py-2 rounded-xl bg-[#e02424] text-white text-xs font-bold"
              >
                Carica la prima bolletta
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bills.map((bill: CustomerBill) => (
                <div
                  key={bill.id}
                  onClick={() => onOpenBillDetails?.(bill)}
                  className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-[#e02424] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 hover:text-[#e02424] transition-colors">
                        {bill.fileName}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Caricata il {bill.uploadDate} • {bill.utilityType.toUpperCase()} • {bill.fileSizeKb} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {bill.extractedSavingsEur ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        Risparmio: €{Math.round(bill.extractedSavingsEur)}/anno
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        In analisi
                      </span>
                    )}
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dedicated Consultant Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 text-slate-700">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-800">
            MR
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Consulente Energetico Assegnato</span>
            <span className="font-bold text-slate-900">{customer.accountManager || 'Matteo Riva (Broker Dedicato)'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:+393471122334"
            className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Contatta Consulente</span>
          </a>
        </div>
      </div>
    </div>
  );
};
