"use client";

import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";
import { WashTransaction } from "@/lib/types";

interface ThermalReceiptProps {
  wash: WashTransaction | null;
  onClose: () => void;
  autoPrint?: boolean;
}

export default function ThermalReceipt({ wash, onClose, autoPrint = false }: ThermalReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoPrint && wash) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, wash]);

  if (!wash) return null;

  function handlePrint() {
    window.print();
  }

  const startedDate = wash.started_at
    ? new Date(wash.started_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString();

  const servicesList = Array.isArray(wash.services) && wash.services.length > 0
    ? wash.services
    : ["Standard Exterior Wash"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      {/* Modal Actions Header (Hidden when printing) */}
      <div className="bg-panel border border-line rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-line flex items-center justify-between no-print bg-panel-2">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-accent" />
            <h3 className="text-sm font-bold text-text">Thermal POS Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="icon-btn p-1.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Receipt Container */}
        <div className="p-6 overflow-y-auto flex justify-center bg-zinc-900/40">
          <div
            ref={receiptRef}
            id="washos-thermal-slip"
            className="thermal-receipt bg-white text-black p-5 rounded font-mono text-[11px] leading-tight shadow-md w-full max-w-[280px]"
            style={{ color: "#000", fontFamily: "Courier, monospace" }}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-zinc-400 space-y-1">
              <p className="font-bold text-sm tracking-wider">WASHOS CAR WASH</p>
              <p className="text-[10px] text-zinc-600">Bole Main Branch · Addis Ababa</p>
              <p className="text-[10px] text-zinc-600">Tel: +251 911 234 567</p>
              <div className="inline-block px-2 py-0.5 mt-1 border border-black text-[10px] font-bold uppercase">
                {wash.status === "completed" ? "OFFICIAL RECEIPT" : "BAY DISPATCH TICKET"}
              </div>
            </div>

            {/* Ticket Info */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-zinc-600">RECEIPT #:</span>
                <span className="font-bold">{wash.receipt_number || "REC-" + wash.id?.slice(0, 6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">DATE:</span>
                <span>{startedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">WASH BAY:</span>
                <span className="font-bold text-xs">BAY {wash.bay_number || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">ATTENDANT:</span>
                <span>{wash.washer_name || "Assigned Crew"}</span>
              </div>
            </div>

            {/* Vehicle Details Highlight */}
            <div className="my-2 p-2 bg-zinc-100 border border-zinc-300 text-center rounded">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">Plate Number</p>
              <p className="text-base font-black tracking-widest uppercase my-0.5">{wash.plate || "NO PLATE"}</p>
              <p className="text-[9px] uppercase text-zinc-600">
                {wash.vehicle_type_id?.toUpperCase()} VEHICLE
                {wash.customer_name ? ` · ${wash.customer_name}` : ""}
              </p>
            </div>

            {/* Services List */}
            <div className="py-2 border-b border-dashed border-zinc-400 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-zinc-300">
                <span>SERVICE ITEM</span>
                <span>PRICE</span>
              </div>
              {servicesList.map((srv, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="truncate max-w-[170px]">• {srv}</span>
                  <span>ETB</span>
                </div>
              ))}
              <div className="flex justify-between text-[9px] text-zinc-500 pt-1">
                <span>Formula Soap Allocation:</span>
                <span>{wash.soap_used_ml || 180} ml</span>
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b-2 border-black space-y-1">
              <div className="flex justify-between text-xs font-black">
                <span>TOTAL AMOUNT:</span>
                <span>{Number(wash.price || 0).toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>PAYMENT METHOD:</span>
                <span className="uppercase font-bold">{wash.payment_method || "CASH"}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>PAYMENT STATUS:</span>
                <span className="uppercase font-bold">{wash.payment_status || "PAID"}</span>
              </div>
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-3 space-y-1.5">
              {/* Stylized Barcode */}
              <div className="flex justify-center items-center py-1">
                <div className="flex items-end gap-[1.5px] h-9 px-2 bg-zinc-50">
                  {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1].map((w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w * 1.5}px`, height: "100%", backgroundColor: "#000" }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[9px] tracking-widest font-mono text-zinc-600">
                *{wash.receipt_number || wash.id?.slice(0, 8)}*
              </p>
              <p className="text-[9px] text-zinc-600 font-sans italic pt-1">
                Thank you for washing with WashOS!
              </p>
              <p className="text-[8px] text-zinc-400">Powered by WashOS Cloud ERP</p>
            </div>
          </div>
        </div>

        {/* Print Stylesheet Hook */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #washos-thermal-slip, #washos-thermal-slip * {
              visibility: visible !important;
            }
            #washos-thermal-slip {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 58mm !important;
              max-width: 58mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
