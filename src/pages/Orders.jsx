import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {  backendUrl, currency } from '../App';
import { toast } from 'react-toastify';
import {
  getCustomerName,
  getFlatLabel,
  getInvoiceDate,
  getInvoiceDiscount,
  getInvoiceId,
  getInvoiceItems,
  getInvoiceTotal,
  invoiceMatchesQuery,
} from '../utils/invoiceDisplay';

/**
 * Vanya-Ecoproducts-backend (invoice routes, adminAuth):
 * Header on every request: { token } — same as product/add (adminAuth reads req.headers.token)
 * GET /api/invoice/admin/sales?period=...  (period: today|week|month|year|all; backend also accepts POST + body)
 * GET /api/invoice/admin/search?query=...
 * GET /api/invoice/admin/:id
 * POST /api/invoice/admin/update/:id
 * POST /api/invoice/admin/delete  body: { id }
 */

function invoiceToEditForm(inv) {
  const items = getInvoiceItems(inv).map((item) => ({
    name: item.name ?? item.productName ?? item.title ?? '',
    quantity: item.quantity ?? item.qty ?? 1,
    price: item.price ?? '',
    originalPrice: item.originalPrice ?? '',
    displayQuantity: item.displayQuantity ?? item.quantityLabel ?? item.label ?? '',
  }));
  return {
    _id: inv._id,
    invoiceId: inv.invoiceId ?? getInvoiceId(inv),
    flatName: inv.flatName ?? '',
    flatNumber: inv.flatNumber ?? '',
    customerName: getCustomerName(inv),
    mobile: inv.mobile ?? '',
    email: inv.email ?? '',
    discount: inv.discount ?? 0,
    shippingCharges: inv.shippingCharges ?? 0,
    totalAmount: getInvoiceTotal(inv),
    itemsOrdered: items.length ? items : [{ name: '', quantity: 1, price: '', originalPrice: '', displayQuantity: '' }],
  };
}

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All sales' },
];

function Orders({ token }) {
  const [salesPeriod, setSalesPeriod] = useState('today');
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchSales = useCallback(async () => {
    if (!token) return;
    setSalesLoading(true);
    setSummary(null);
    try {
      const response = await axios.get(
        backendUrl + '/api/invoice/admin/sales?period=' + encodeURIComponent(salesPeriod),
        { headers: { token } }
      );
      if (response.data.success) {
        const list = response.data.invoices ?? response.data.data ?? [];
        setSales(Array.isArray(list) ? list : []);
        setSummary(response.data.summary ?? null);
      } else {
        toast.error(response.data.message || 'Could not load sales');
        setSales([]);
      }
    } catch (error) {
      console.log(error);
      const msg =
        error.response?.data?.message ||
        (error.response?.status === 404
          ? 'Sales API not found (GET /api/invoice/admin/sales)'
          : error.message);
      toast.error(msg);
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  }, [token, salesPeriod]);

  const runSearch = useCallback(
    async (query) => {
      const q = query.trim();
      if (!token || !q) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await axios.get(
          backendUrl + '/api/invoice/admin/search?query=' + encodeURIComponent(q),
          { headers: { token } }
        );
        if (response.data.success) {
          const list = response.data.invoices ?? response.data.data ?? [];
          setSearchResults(Array.isArray(list) ? list : []);
        } else {
          toast.error(response.data.message || 'Search failed');
          setSearchResults([]);
        }
      } catch (error) {
        console.log(error);
        const local = sales.filter((inv) => invoiceMatchesQuery(inv, q));
        if (local.length) {
          setSearchResults(local);
          toast.info('Using results from the current sales list; configure search API for full history.');
        } else {
          const msg =
            error.response?.data?.message ||
            (error.response?.status === 404
              ? 'Search API not found (GET /api/invoice/admin/search)'
              : error.message);
          toast.error(msg);
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [token, sales]
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchInput.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => runSearch(q), 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchInput, runSearch]);

  const openInvoice = async (inv) => {
    if (!inv) return;
    const id = inv._id;
    if (!id) {
      setSelectedInvoice(inv);
      return;
    }
    setDetailLoading(true);
    setSelectedInvoice(inv);
    try {
      const res = await axios.get(backendUrl + '/api/invoice/admin/' + id, { headers: { token } });
      if (res.data.success && res.data.invoice) {
        setSelectedInvoice(res.data.invoice);
      }
    } catch {
      /* keep list payload */
    } finally {
      setDetailLoading(false);
    }
  };

  const startEditInvoice = async (inv, e) => {
    e.stopPropagation();
    if (!inv?._id) {
      toast.error('Cannot edit: missing invoice id');
      return;
    }
    let full = inv;
    try {
      const res = await axios.get(backendUrl + '/api/invoice/admin/' + inv._id, { headers: { token } });
      if (res.data.success && res.data.invoice) full = res.data.invoice;
    } catch {
      /* use list payload */
    }
    setEditingInvoice(invoiceToEditForm(full));
  };

  const deleteInvoice = async (inv, e) => {
    e.stopPropagation();
    const id = inv._id;
    if (!id) {
      toast.error('Cannot delete: missing invoice id');
      return;
    }
    const label = getInvoiceId(inv) || id;
    if (!window.confirm(`Delete invoice ${label}? This cannot be undone.`)) return;
    try {
      const response = await axios.post(
        backendUrl + '/api/invoice/admin/delete',
        { id },
        { headers: { token } }
      );
      if (response.data.success) {
        toast.success(response.data.message || 'Invoice deleted');
        setSales((prev) => prev.filter((s) => String(s._id) !== String(id)));
        setSearchResults((prev) => prev.filter((s) => String(s._id) !== String(id)));
        if (selectedInvoice && String(selectedInvoice._id) === String(id)) {
          setSelectedInvoice(null);
        }
        fetchSales();
      } else {
        toast.error(response.data.message || 'Could not delete invoice');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingInvoice?._id) return;
    setEditSaving(true);
    try {
      const itemsOrdered = editingInvoice.itemsOrdered.map((item) => {
        const entry = {
          name: item.name.trim(),
          quantity: Number(item.quantity),
          price: Number(item.price),
        };
        if (item.displayQuantity?.trim()) entry.displayQuantity = item.displayQuantity.trim();
        if (item.originalPrice !== '' && item.originalPrice != null) {
          entry.originalPrice = Number(item.originalPrice);
        }
        return entry;
      });
      const payload = {
        invoiceId: editingInvoice.invoiceId.trim(),
        flatName: editingInvoice.flatName.trim(),
        flatNumber: editingInvoice.flatNumber.trim(),
        customerName: editingInvoice.customerName.trim(),
        mobile: editingInvoice.mobile.trim(),
        email: editingInvoice.email.trim(),
        itemsOrdered,
        totalAmount: Number(editingInvoice.totalAmount),
        discount: Number(editingInvoice.discount) || 0,
        shippingCharges: Number(editingInvoice.shippingCharges) || 0,
      };
      const response = await axios.post(
        backendUrl + '/api/invoice/admin/update/' + editingInvoice._id,
        payload,
        { headers: { token } }
      );
      if (response.data.success) {
        toast.success(response.data.message || 'Invoice updated');
        setEditingInvoice(null);
        await fetchSales();
        if (selectedInvoice && String(selectedInvoice._id) === String(editingInvoice._id)) {
          setSelectedInvoice(response.data.invoice ?? selectedInvoice);
        }
      } else {
        toast.error(response.data.message || 'Could not update invoice');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setEditSaving(false);
    }
  };

  const salesTotals = useMemo(() => {
    if (summary && typeof summary.total === 'number') {
      return { count: summary.count ?? sales.length, total: summary.total };
    }
    const count = sales.length;
    const total = sales.reduce((acc, inv) => acc + getInvoiceTotal(inv), 0);
    return { count, total };
  }, [sales, summary]);

  const formatWhen = (inv) => {
    const d = getInvoiceDate(inv);
    return d ? d.toLocaleString() : '—';
  };

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-xl font-semibold mb-1 text-green-800">Sales &amp; invoices</h3>
        <p className="text-sm text-green-900/80 mb-4">
          Search by invoice id, customer name, or flat. Sales history defaults to today; switch period below.
        </p>

        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="flex-1 space-y-3">
            <label className="block text-sm font-medium text-green-900">Find invoice</label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Invoice id, customer name, or flat…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-900 bg-white"
            />
            {searchInput.trim() && (
              <div className="border border-gray-200 rounded-md bg-white max-h-56 overflow-y-auto shadow-sm">
                {searchLoading && (
                  <p className="p-3 text-sm text-gray-600">Searching…</p>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <p className="p-3 text-sm text-gray-600">No matches.</p>
                )}
                {!searchLoading &&
                  searchResults.map((inv, idx) => (
                    <button
                      type="button"
                      key={getInvoiceId(inv) + idx}
                      onClick={() => openInvoice(inv)}
                      className="w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-green-50 text-green-900"
                    >
                      <span className="font-semibold">{getInvoiceId(inv) || '—'}</span>
                      <span className="text-gray-600"> · {getCustomerName(inv) || '—'}</span>
                      {getFlatLabel(inv) ? (
                        <span className="text-gray-600"> · {getFlatLabel(inv)}</span>
                      ) : null}
                      <span className="float-right font-medium">
                        {currency}
                        {getInvoiceTotal(inv).toFixed(2)}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="flex-1 border border-gray-200 rounded-lg bg-white p-4 min-h-[200px]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-800">Invoice details</h4>
              {selectedInvoice && (
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="text-xs text-gray-600 hover:text-green-800"
                >
                  Clear
                </button>
              )}
            </div>
            {!selectedInvoice && (
              <p className="text-sm text-gray-600">Select a row from sales or pick a search result.</p>
            )}
            {selectedInvoice && (
              <div className={`text-sm space-y-2 ${detailLoading ? 'opacity-70' : ''}`}>
                <p>
                  <span className="text-gray-600">Invoice:</span>{' '}
                  <span className="font-semibold">{getInvoiceId(selectedInvoice)}</span>
                </p>
                <p>
                  <span className="text-gray-600">Customer:</span> {getCustomerName(selectedInvoice) || '—'}
                </p>
                <p>
                  <span className="text-gray-600">Flat / unit:</span> {getFlatLabel(selectedInvoice) || '—'}
                </p>
                <p>
                  <span className="text-gray-600">When:</span> {formatWhen(selectedInvoice)}
                </p>
                {(selectedInvoice.email || selectedInvoice.mobile) && (
                  <p>
                    <span className="text-gray-600">Contact:</span>{' '}
                    {[selectedInvoice.mobile, selectedInvoice.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                )}
                {getInvoiceDiscount(selectedInvoice) > 0 && (
                  <p>
                    <span className="text-gray-600">Discount:</span>{' '}
                    {currency}
                    {getInvoiceDiscount(selectedInvoice)}
                  </p>
                )}
                <p>
                  <span className="text-gray-600">Total:</span>{' '}
                  <span className="font-semibold">
                    {currency}
                    {getInvoiceTotal(selectedInvoice).toFixed(2)}
                  </span>
                </p>
                {getInvoiceItems(selectedInvoice).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-gray-600 mb-1">Items</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {getInvoiceItems(selectedInvoice).map((item, i) => {
                        const name = item.name ?? item.productName ?? item.title ?? 'Item';
                        const qty = item.quantity ?? item.qty ?? 1;
                        const label = item.quantityLabel ?? item.label ?? item.unit ?? '';
                        const price = Number(item.price);
                        const pricePart = Number.isFinite(price) ? ` @ ${currency}${price}` : '';
                        return (
                          <li key={i}>
                            {name}{' '}
                            <span className="text-gray-600">
                              × {qty}
                              {pricePart}
                              {label ? ` ${label}` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {(selectedInvoice.address || selectedInvoice.shippingAddress) && (
                  <div className="mt-2 text-gray-700">
                    <p className="text-gray-600">Address</p>
                    {(() => {
                      const a = selectedInvoice.address || selectedInvoice.shippingAddress || {};
                      const lines = [
                        [a.firstName, a.lastName].filter(Boolean).join(' '),
                        a.street,
                        [a.city, a.state, a.zipcode, a.country].filter(Boolean).join(', '),
                        a.phone,
                        a.email,
                      ].filter(Boolean);
                      return lines.map((line, i) => <p key={i}>{line}</p>);
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-green-900 mr-2">Sales history</span>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSalesPeriod(key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                salesPeriod === key
                  ? 'bg-green-800 text-white border-green-800'
                  : 'bg-white text-green-900 border-gray-300 hover:border-green-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-green-900/90 mb-3">
          {salesTotals.count} invoice{salesTotals.count === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold">
            {currency}
            {salesTotals.total.toFixed(2)}
          </span>{' '}
          in this period
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          {salesLoading && (
            <p className="p-6 text-sm text-gray-600">Loading sales…</p>
          )}
          {!salesLoading && sales.length === 0 && (
            <p className="p-6 text-sm text-gray-600">No invoices in this period.</p>
          )}
          {!salesLoading && sales.length > 0 && (
            <table className="w-full text-sm text-left text-green-900 min-w-[640px]">
              <thead className="bg-gray-100 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Invoice</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Flat</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((inv, idx) => {
                  const id = getInvoiceId(inv);
                  const active =
                    selectedInvoice &&
                    (inv._id && selectedInvoice._id
                      ? String(selectedInvoice._id) === String(inv._id)
                      : getInvoiceId(selectedInvoice) === id && Boolean(id));
                  return (
                    <tr
                      key={id + String(idx)}
                      onClick={() => openInvoice(inv)}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-green-50/80 ${
                        active ? 'bg-green-100/60' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">{id || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(inv)}</td>
                      <td className="px-3 py-2">{getCustomerName(inv) || '—'}</td>
                      <td className="px-3 py-2">{getFlatLabel(inv) || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {currency}
                        {getInvoiceTotal(inv).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => startEditInvoice(inv, e)}
                          className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => deleteInvoice(inv, e)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editingInvoice && (
        <div className="fixed inset-0 bg-green-50/80 z-50 flex items-center justify-center px-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white shadow-md border border-gray-200 rounded-xl w-full max-w-2xl p-6 md:p-8 overflow-y-auto max-h-[90vh] text-green-900"
          >
            <h2 className="text-xl font-bold mb-4 text-green-800">Edit invoice</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <p className="mb-1 text-sm">Invoice ID</p>
                <input
                  type="text"
                  value={editingInvoice.invoiceId}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, invoiceId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Customer name</p>
                <input
                  type="text"
                  value={editingInvoice.customerName}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Flat name</p>
                <input
                  type="text"
                  value={editingInvoice.flatName}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, flatName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Flat number</p>
                <input
                  type="text"
                  value={editingInvoice.flatNumber}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, flatNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Mobile</p>
                <input
                  type="text"
                  value={editingInvoice.mobile}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Email</p>
                <input
                  type="email"
                  value={editingInvoice.email}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">Line items</p>
              {editingInvoice.itemsOrdered.map((item, i) => (
                <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                  <input
                    type="text"
                    placeholder="Product name"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...editingInvoice.itemsOrdered];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                    }}
                    className="px-3 py-2 flex-1 min-w-[140px] border border-gray-300 rounded"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    min="1"
                    step="1"
                    onChange={(e) => {
                      const updated = [...editingInvoice.itemsOrdered];
                      updated[i] = { ...updated[i], quantity: e.target.value };
                      setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                    }}
                    className="px-3 py-2 w-[72px] border border-gray-300 rounded"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Unit label"
                    value={item.displayQuantity}
                    onChange={(e) => {
                      const updated = [...editingInvoice.itemsOrdered];
                      updated[i] = { ...updated[i], displayQuantity: e.target.value };
                      setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                    }}
                    className="px-3 py-2 w-[100px] border border-gray-300 rounded"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.price}
                    min="0"
                    step="0.01"
                    onChange={(e) => {
                      const updated = [...editingInvoice.itemsOrdered];
                      updated[i] = { ...updated[i], price: e.target.value };
                      setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                    }}
                    className="px-3 py-2 w-[100px] border border-gray-300 rounded"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Sourced"
                    value={item.originalPrice}
                    min="0"
                    step="0.01"
                    onChange={(e) => {
                      const updated = [...editingInvoice.itemsOrdered];
                      updated[i] = { ...updated[i], originalPrice: e.target.value };
                      setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                    }}
                    className="px-3 py-2 w-[100px] border border-gray-300 rounded"
                  />
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-red-600 text-sm"
                      onClick={() => {
                        const updated = editingInvoice.itemsOrdered.filter((_, idx) => idx !== i);
                        setEditingInvoice({ ...editingInvoice, itemsOrdered: updated });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-green-800 text-sm"
                onClick={() =>
                  setEditingInvoice({
                    ...editingInvoice,
                    itemsOrdered: [
                      ...editingInvoice.itemsOrdered,
                      { name: '', quantity: 1, price: '', originalPrice: '', displayQuantity: '' },
                    ],
                  })
                }
              >
                + Add line item
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div>
                <p className="mb-1 text-sm">Total amount</p>
                <input
                  type="number"
                  value={editingInvoice.totalAmount}
                  min="0"
                  step="0.01"
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, totalAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Discount</p>
                <input
                  type="number"
                  value={editingInvoice.discount}
                  min="0"
                  step="0.01"
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, discount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <p className="mb-1 text-sm">Shipping</p>
                <input
                  type="number"
                  value={editingInvoice.shippingCharges}
                  min="0"
                  step="0.01"
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, shippingCharges: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-800 text-white rounded disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Orders;
