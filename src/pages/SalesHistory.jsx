import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { backendUrl, currency } from '../App';
import { toast } from 'react-toastify';
import { getCustomerName, getFlatLabel, getInvoiceDate } from '../utils/invoiceDisplay';
import { analyzeSalesPeriod } from '../utils/salesProfit';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All sales' },
];

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${currency}${num.toFixed(2)}`;
}

function formatPct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${num.toFixed(1)}%`;
}

function SalesHistory({ token }) {
  const [period, setPeriod] = useState('today');
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setSelectedRow(null);
    try {
      const [salesRes, productsRes] = await Promise.all([
        axios.get(
          backendUrl + '/api/invoice/admin/sales?period=' + encodeURIComponent(period),
          { headers: { token } }
        ),
        axios.get(backendUrl + '/api/product/list'),
      ]);

      if (salesRes.data.success) {
        const list = salesRes.data.invoices ?? [];
        setInvoices(Array.isArray(list) ? list : []);
      } else {
        toast.error(salesRes.data.message || 'Could not load sales');
        setInvoices([]);
      }

      if (productsRes.data.products) {
        setProducts(productsRes.data.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || error.message);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const analysis = useMemo(
    () => analyzeSalesPeriod(invoices, products),
    [invoices, products]
  );

  const { summary, rows, productBreakdown } = analysis;

  const formatWhen = (inv) => {
    const d = getInvoiceDate(inv);
    return d ? d.toLocaleString() : '—';
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold mb-1 text-green-800">Sales history</h3>
        <p className="text-sm text-green-900/80">
          Profit is calculated from invoice selling prices vs product sourced prices (set when adding items).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-green-900 mr-2">Period</span>
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              period === key
                ? 'bg-green-800 text-white border-green-800'
                : 'bg-white text-green-900 border-gray-300 hover:border-green-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {summary.linesMissingCost > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {summary.linesMissingCost} line item{summary.linesMissingCost === 1 ? '' : 's'} in{' '}
          {summary.invoicesMissingCost} invoice{summary.invoicesMissingCost === 1 ? '' : 's'} have no sourced
          price (not on the invoice line and not on the matching product option). Profit for those lines is
          excluded from cost totals.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <p className="text-xs uppercase text-gray-600 tracking-wide">Revenue</p>
          <p className="text-lg font-semibold text-green-900 mt-1">{formatMoney(summary.revenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.invoiceCount} invoices</p>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <p className="text-xs uppercase text-gray-600 tracking-wide">Sourced cost</p>
          <p className="text-lg font-semibold text-green-900 mt-1">{formatMoney(summary.cost)}</p>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <p className="text-xs uppercase text-gray-600 tracking-wide">Profit</p>
          <p className={`text-lg font-semibold mt-1 ${summary.profit >= 0 ? 'text-green-800' : 'text-red-600'}`}>
            {formatMoney(summary.profit)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <p className="text-xs uppercase text-gray-600 tracking-wide">Margin</p>
          <p className="text-lg font-semibold text-green-900 mt-1">{formatPct(summary.marginPct)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-800 mb-2">Invoices</p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            {loading && <p className="p-6 text-sm text-gray-600">Loading…</p>}
            {!loading && rows.length === 0 && (
              <p className="p-6 text-sm text-gray-600">No sales in this period.</p>
            )}
            {!loading && rows.length > 0 && (
              <table className="w-full text-sm text-left text-green-900 min-w-[720px]">
                <thead className="bg-gray-100 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Invoice</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold text-right">Revenue</th>
                    <th className="px-3 py-2 font-semibold text-right">Cost</th>
                    <th className="px-3 py-2 font-semibold text-right">Profit</th>
                    <th className="px-3 py-2 font-semibold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const inv = row.invoice;
                    const active = selectedRow?.invoiceId === row.invoiceId;
                    return (
                      <tr
                        key={row.invoiceId + idx}
                        onClick={() => setSelectedRow(row)}
                        className={`border-b border-gray-100 cursor-pointer hover:bg-green-50/80 ${
                          active ? 'bg-green-100/60' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-medium">{row.invoiceId || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatWhen(inv)}</td>
                        <td className="px-3 py-2">{getCustomerName(inv) || '—'}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td>
                        <td className="px-3 py-2 text-right">
                          {row.costComplete ? formatMoney(row.cost) : (
                            <span className="text-amber-700 text-xs">Partial</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatMoney(row.profit)}</td>
                        <td className="px-3 py-2 text-right">{formatPct(row.marginPct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex-1 border border-gray-200 rounded-lg bg-white p-4 min-h-[220px] min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-green-800">Invoice profit details</h4>
            {selectedRow && (
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-xs text-gray-600 hover:text-green-800"
              >
                Clear
              </button>
            )}
          </div>
          {!selectedRow && (
            <p className="text-sm text-gray-600">Select an invoice to see line-level profit.</p>
          )}
          {selectedRow && (
            <div className="text-sm space-y-3">
              <div>
                <p>
                  <span className="text-gray-600">Invoice:</span>{' '}
                  <span className="font-semibold">{selectedRow.invoiceId}</span>
                </p>
                <p>
                  <span className="text-gray-600">Customer:</span> {getCustomerName(selectedRow.invoice) || '—'}
                </p>
                <p>
                  <span className="text-gray-600">Flat:</span> {getFlatLabel(selectedRow.invoice) || '—'}
                </p>
                <p>
                  <span className="text-gray-600">Profit:</span>{' '}
                  <span className="font-semibold">{formatMoney(selectedRow.profit)}</span>
                  {' '}
                  <span className="text-gray-600">({formatPct(selectedRow.marginPct)} margin)</span>
                </p>
              </div>
              <table className="w-full text-xs border border-gray-100 rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left">Item</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Sell</th>
                    <th className="px-2 py-1 text-right">Sourced</th>
                    <th className="px-2 py-1 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRow.items.map((line, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1">{line.name}</td>
                      <td className="px-2 py-1 text-right">{line.quantity}</td>
                      <td className="px-2 py-1 text-right">{formatMoney(line.sellingUnit)}</td>
                      <td className="px-2 py-1 text-right">
                        {line.costKnown ? formatMoney(line.sourcedUnit) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">
                        {line.profit != null ? formatMoney(line.profit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold text-green-800 mb-2">Profit by product</p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          {productBreakdown.length === 0 ? (
            <p className="p-6 text-sm text-gray-600">No line items in this period.</p>
          ) : (
            <table className="w-full text-sm text-left text-green-900 min-w-[560px]">
              <thead className="bg-gray-100 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold text-right">Qty sold</th>
                  <th className="px-3 py-2 font-semibold text-right">Revenue</th>
                  <th className="px-3 py-2 font-semibold text-right">Cost</th>
                  <th className="px-3 py-2 font-semibold text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {productBreakdown.map((row, idx) => (
                  <tr key={row.name + idx} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">
                      {row.name}
                      {row.unknownLines > 0 && (
                        <span className="block text-xs text-amber-700">Some lines missing sourced price</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{row.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.cost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalesHistory;
