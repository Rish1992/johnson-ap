interface LineItem {
  desc: string;
  qty: number;
  rate: number;
}

interface MockInvoiceDocumentProps {
  vendorName: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: string;
  lineItems?: LineItem[];
  /** Override the document title (default: "TAX INVOICE") */
  documentTitle?: string;
  poNumber?: string;
  dueDate?: string;
  subtotal?: string;
  gstAmount?: string;
}

const DEFAULT_LINE_ITEMS: LineItem[] = [
  { desc: 'HVAC Installation - Unit A', qty: 2, rate: 45000 },
  { desc: 'Ductwork & Fittings', qty: 1, rate: 28500 },
  { desc: 'Control Panel Assembly', qty: 3, rate: 12750 },
  { desc: 'Labour Charges - Electrical', qty: 1, rate: 18000 },
];

export function MockInvoiceDocument({
  vendorName,
  invoiceNumber = 'INV-2025001',
  invoiceDate = '2025-01-15',
  totalAmount,
  lineItems,
  documentTitle = 'TAX INVOICE',
  poNumber = 'PO-44821',
  dueDate = 'Net 30',
  subtotal,
  gstAmount,
}: MockInvoiceDocumentProps) {
  const items = lineItems ?? DEFAULT_LINE_ITEMS;
  const computedSubtotal = subtotal ?? items.reduce((s, r) => s + r.qty * r.rate, 0).toLocaleString('en-AU');
  const computedTotal = totalAmount ?? computedSubtotal;

  return (
    <div
      className="w-full max-w-[520px] mx-auto bg-white rounded shadow-md border border-gray-200 p-0 overflow-hidden select-none"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="relative bg-[#fafaf7]" style={{ transform: 'rotate(-0.3deg)' }}>
        {/* Header area */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-300">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-28 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                <span className="text-[9px] text-gray-600 font-bold tracking-wider">LOGO</span>
              </div>
              <div className="text-[10px] text-gray-700 leading-tight">
                <div className="font-bold text-xs">{vendorName || 'Vendor Name'}</div>
                <div>123 Business Park, Level 5</div>
                <div>Sydney, NSW 2000</div>
                <div>ABN: 51 824 753 556</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800 tracking-wide">{documentTitle}</div>
              <div className="text-[10px] text-gray-600 mt-1">Original for Recipient</div>
            </div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="px-6 py-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] text-gray-700 border-b border-gray-200">
          <div className="flex justify-between">
            <span className="text-gray-500">Invoice No:</span>
            <span className="font-semibold">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date:</span>
            <span className="font-semibold">{invoiceDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">PO Number:</span>
            <span className="font-semibold">{poNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Due Date:</span>
            <span className="font-semibold">{dueDate}</span>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="px-6 py-3 grid grid-cols-2 gap-x-8 text-[10px] text-gray-700 border-b border-gray-200">
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Bill To</div>
            <div className="font-semibold">Johnson Controls Australia</div>
            <div>Level 12, 100 Pacific Highway</div>
            <div>North Sydney, NSW 2060</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Ship To</div>
            <div className="font-semibold">JCI Facility - Melbourne</div>
            <div>45 Innovation Drive</div>
            <div>Scoresby, VIC 3179</div>
          </div>
        </div>

        {/* Line items table */}
        <div className="px-6 py-3">
          <table className="w-full text-[9px] text-gray-700">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-1 w-6">#</th>
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1 w-10">Qty</th>
                <th className="text-right py-1 w-16">Rate</th>
                <th className="text-right py-1 w-16">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">{row.desc}</td>
                  <td className="py-1 text-right">{row.qty}</td>
                  <td className="py-1 text-right">{row.rate.toLocaleString('en-AU')}</td>
                  <td className="py-1 text-right">{(row.qty * row.rate).toLocaleString('en-AU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-3 border-t border-gray-300">
          <div className="flex flex-col items-end text-[10px] text-gray-700 gap-0.5">
            <div className="flex justify-between w-44">
              <span>Subtotal:</span>
              <span>{computedSubtotal}</span>
            </div>
            <div className="flex justify-between w-44">
              <span>GST (10%):</span>
              <span>{gstAmount ?? '—'}</span>
            </div>
            <div className="flex justify-between w-44 font-bold border-t border-gray-400 pt-1 mt-1 text-xs text-gray-900">
              <span>Total:</span>
              <span>{computedTotal}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-end justify-between">
          <div className="text-[8px] text-gray-400 leading-snug">
            <div>Bank: Commonwealth Bank, Branch North Sydney</div>
            <div>BSB: 062-000 | A/C: 1234 5678</div>
            <div className="mt-1">E&OE - Subject to Australian law</div>
          </div>
          <div className="text-center">
            <div className="w-20 h-10 border border-dashed border-gray-300 rounded flex items-center justify-center text-[8px] text-gray-400">
              Stamp & Sign
            </div>
            <div className="text-[8px] text-gray-400 mt-0.5">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
