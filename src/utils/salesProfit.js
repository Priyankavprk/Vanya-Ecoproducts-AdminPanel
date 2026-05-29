import { getInvoiceDiscount, getInvoiceId, getInvoiceItems, getInvoiceTotal } from './invoiceDisplay';

function normName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function normPrice(price) {
  const n = Number(price);
  return Number.isFinite(n) ? n : null;
}

/** Billing app stores lines as "Product name (label)" */
export function parseInvoiceItemName(itemName) {
  const s = String(itemName ?? '').trim();
  const match = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { productName: match[1].trim(), label: match[2].trim(), displayName: s };
  }
  return { productName: s, label: '', displayName: s };
}

function sourcedFromOption(opt) {
  if (!opt) return null;
  const n = Number(opt.originalPrice ?? opt.sourcedPrice ?? opt.costPrice);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Map keys: "productname|price" and "product name (label)|price" → cost info */
export function buildProductCostLookup(products) {
  const map = new Map();
  if (!Array.isArray(products)) return map;

  for (const product of products) {
    const productName = product.name ?? '';
    const keyName = normName(productName);
    for (const opt of product.quantityOptions ?? []) {
      const selling = normPrice(opt.price);
      const sourced = sourcedFromOption(opt);
      if (!keyName || selling == null) continue;

      const base = {
        productName,
        label: opt.label ?? '',
        sellingPrice: selling,
        originalPrice: sourced,
      };

      map.set(`${keyName}|${selling}`, base);

      const label = String(opt.label ?? '').trim();
      if (label) {
        const displayName = `${productName} (${label})`;
        map.set(`${normName(displayName)}|${selling}`, base);
      }
    }
  }
  return map;
}

function findProductByName(products, nameKey) {
  if (!nameKey) return null;
  const exact = (products ?? []).find((p) => normName(p.name) === nameKey);
  if (exact) return exact;

  return (
    (products ?? []).find((p) => {
      const pn = normName(p.name);
      return nameKey === pn || nameKey.startsWith(`${pn} (`) || nameKey.startsWith(`${pn}(`);
    }) ?? null
  );
}

export function resolveSourcedUnitPrice(products, lookup, itemName, sellingUnitPrice, itemOriginalPrice) {
  const lineSourced = normPrice(itemOriginalPrice);
  if (lineSourced != null) return lineSourced;

  const fullNameKey = normName(itemName);
  const selling = normPrice(sellingUnitPrice);
  if (!fullNameKey || selling == null) return null;

  const exactDisplay = lookup.get(`${fullNameKey}|${selling}`);
  if (exactDisplay?.originalPrice != null) return exactDisplay.originalPrice;

  const { productName, label } = parseInvoiceItemName(itemName);
  const productKey = normName(productName);

  if (productKey) {
    const exactProduct = lookup.get(`${productKey}|${selling}`);
    if (exactProduct?.originalPrice != null) return exactProduct.originalPrice;
  }

  const product = findProductByName(products, productKey || fullNameKey);
  if (!product?.quantityOptions?.length) return null;

  if (label) {
    const labelKey = normName(label);
    const byLabel = product.quantityOptions.find((o) => normName(o.label) === labelKey);
    const fromLabel = sourcedFromOption(byLabel);
    if (fromLabel != null) return fromLabel;
  }

  let option = product.quantityOptions.find((o) => normPrice(o.price) === selling);
  if (!option) {
    option = product.quantityOptions.reduce((best, o) => {
      const diff = Math.abs((normPrice(o.price) ?? 0) - selling);
      const bestDiff = Math.abs((normPrice(best.price) ?? 0) - selling);
      return diff < bestDiff ? o : best;
    });
  }

  return sourcedFromOption(option);
}

export function analyzeLineItem(item, products, lookup) {
  const quantity = Number(item.quantity) || 0;
  const sellingUnit = normPrice(item.price) ?? 0;
  const revenue = sellingUnit * quantity;
  const sourcedUnit = resolveSourcedUnitPrice(
    products,
    lookup,
    item.name,
    sellingUnit,
    item.originalPrice
  );
  const costKnown = sourcedUnit != null;
  const cost = costKnown ? sourcedUnit * quantity : null;
  const profit = costKnown ? revenue - cost : null;

  return {
    name: item.name ?? 'Item',
    quantity,
    sellingUnit,
    sourcedUnit,
    revenue,
    cost,
    profit,
    costKnown,
  };
}

export function analyzeInvoice(invoice, products, lookup) {
  const items = getInvoiceItems(invoice).map((item) => analyzeLineItem(item, products, lookup));
  const lineRevenue = items.reduce((sum, line) => sum + line.revenue, 0);
  const knownCost = items.reduce((sum, line) => sum + (line.cost ?? 0), 0);
  const allCostsKnown = items.length > 0 && items.every((line) => line.costKnown);
  const knownProfit = items.reduce((sum, line) => sum + (line.profit ?? 0), 0);
  const revenue = getInvoiceTotal(invoice) || lineRevenue;
  const discount = getInvoiceDiscount(invoice);
  const profit = allCostsKnown ? revenue - knownCost : knownProfit;
  const marginPct = revenue > 0 && profit != null ? (profit / revenue) * 100 : null;

  return {
    invoiceId: getInvoiceId(invoice),
    invoice,
    items,
    revenue,
    discount,
    cost: knownCost,
    costComplete: allCostsKnown,
    profit,
    marginPct,
    unknownCostLines: items.filter((l) => !l.costKnown).length,
  };
}

export function analyzeSalesPeriod(invoices, products) {
  const lookup = buildProductCostLookup(products);
  const rows = (invoices ?? []).map((inv) => analyzeInvoice(inv, products, lookup));

  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const cost = rows.reduce((sum, r) => sum + r.cost, 0);
  const partialProfit = rows.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  const completeRows = rows.filter((r) => r.costComplete);
  const profit =
    completeRows.length === rows.length && rows.length > 0 ? revenue - cost : partialProfit;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

  const byProduct = {};
  for (const row of rows) {
    for (const line of row.items) {
      const key = normName(line.name) || 'unknown';
      if (!byProduct[key]) {
        byProduct[key] = {
          name: line.name,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          unknownLines: 0,
        };
      }
      const bucket = byProduct[key];
      bucket.quantity += line.quantity;
      bucket.revenue += line.revenue;
      if (line.costKnown) {
        bucket.cost += line.cost;
        bucket.profit += line.profit;
      } else {
        bucket.unknownLines += 1;
      }
    }
  }

  const productBreakdown = Object.values(byProduct).sort((a, b) => b.profit - a.profit);

  return {
    rows,
    summary: {
      invoiceCount: rows.length,
      revenue,
      cost,
      profit,
      marginPct,
      invoicesMissingCost: rows.filter((r) => !r.costComplete).length,
      linesMissingCost: rows.reduce((sum, r) => sum + r.unknownCostLines, 0),
    },
    productBreakdown,
    lookup,
  };
}
