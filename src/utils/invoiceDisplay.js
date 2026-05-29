/** Normalize invoice-shaped documents from vanya-ecoproducts-backend (or similar). */

export function getInvoiceId(inv) {
  if (!inv) return '';
  return (
    inv.invoiceId ??
    inv.invoiceNumber ??
    inv.billNumber ??
    inv.orderId ??
    (inv._id && String(inv._id)) ??
    ''
  );
}

export function getCustomerName(inv) {
  if (!inv) return '';
  const addr = inv.address || inv.shippingAddress || inv.deliveryAddress || {};
  const fromAddr = [addr.firstName, addr.lastName].filter(Boolean).join(' ').trim();
  return (
    inv.customerName ||
    inv.customer?.name ||
    inv.user?.name ||
    inv.name ||
    fromAddr ||
    ''
  );
}

export function getFlatLabel(inv) {
  if (!inv) return '';
  const addr = inv.address || inv.shippingAddress || inv.deliveryAddress || {};
  const fn = String(inv.flatName ?? "").trim();
  const fnum = String(inv.flatNumber ?? "").trim();
  if (fn && fnum) return `${fn} · ${fnum}`;
  if (fn) return fn;
  if (fnum) return fnum;
  return (
    inv.flat ??
    inv.apartment ??
    inv.unit ??
    addr.flat ??
    addr.flatNumber ??
    addr.apartment ??
    ''
  );
}

export function getInvoiceDate(inv) {
  if (!inv) return null;
  const raw = inv.createdAt ?? inv.date ?? inv.invoiceDate ?? inv.updatedAt;
  if (raw == null) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getInvoiceTotal(inv) {
  if (!inv) return 0;
  const n =
    inv.totalAmount ??
    inv.total ??
    inv.amount ??
    inv.grandTotal ??
    inv.payableAmount ??
    inv.netAmount;
  const num = Number(n);
  return Number.isFinite(num) ? num : 0;
}

export function getInvoiceDiscount(inv) {
  if (!inv) return 0;
  const n = inv.discount;
  const num = Number(n);
  return Number.isFinite(num) ? num : 0;
}

export function getInvoiceItems(inv) {
  if (!inv) return [];
  const items =
    inv.itemsOrdered ?? inv.items ?? inv.lineItems ?? inv.products ?? [];
  return Array.isArray(items) ? items : [];
}

export function invoiceMatchesQuery(inv, q) {
  if (!q || !inv) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const id = String(getInvoiceId(inv)).toLowerCase();
  const name = getCustomerName(inv).toLowerCase();
  const flat = getFlatLabel(inv).toLowerCase();
  const email = String(inv.email ?? '').toLowerCase();
  const mobile = String(inv.mobile ?? '').toLowerCase();
  const flatNum = String(inv.flatNumber ?? '').toLowerCase();
  return (
    id.includes(s) ||
    name.includes(s) ||
    flat.includes(s) ||
    email.includes(s) ||
    mobile.includes(s) ||
    flatNum.includes(s)
  );
}
