
+++ b/src/lib/business-manager/domain.ts
@@
+/**
+ * AURALUXE Business Manager — domain primitives.
+ *
+ * Pure helpers only: no database, browser storage, network, or Netlify imports.
+ * Historical inventory movements should be append-only. Corrections should be
+ * new compensating movements, never edits to prior history.
+ */
+
+export type StockMovementKind =
+  | 'opening'
+  | 'purchase_received'
+  | 'sale'
+  | 'sale_return'
+  | 'customer_exchange_in'
+  | 'supplier_return'
+  | 'damage'
+  | 'loss'
+  | 'adjustment_in'
+  | 'adjustment_out'
+
+export interface StockMovement {
+  /** Stable unique ID generated before attempting sync. */
+  id: string
+  sku: string
+  kind: StockMovementKind
+  /** Positive whole units; direction is determined by kind. */
+  quantity: number
+  occurredAt: string
+  source: 'admin' | 'pos' | 'sync' | 'migration'
+  referenceId?: string
+  note?: string
+}
+
+const INBOUND_KINDS = new Set<StockMovementKind>([
+  'opening',
+  'purchase_received',
+  'sale_return',
+  'customer_exchange_in',
+  'adjustment_in',
+])
+
+const OUTBOUND_KINDS = new Set<StockMovementKind>([
+  'sale',
+  'supplier_return',
+  'damage',
+  'loss',
+  'adjustment_out',
+])
+
+export function normalizeSku(value: string): string {
+  return value.trim().normalize('NFKC').toUpperCase().replace(/\s+/g, '-')
+}
+
+export function validateStockMovement(movement: StockMovement): string[] {
+  const errors: string[] = []
+  if (!movement.id.trim()) errors.push('Movement ID is required.')
+  if (!normalizeSku(movement.sku)) errors.push('SKU is required.')
+  if (!Number.isSafeInteger(movement.quantity) || movement.quantity <= 0) {
+    errors.push('Quantity must be a positive whole number.')
+  }
+  if (!Number.isFinite(Date.parse(movement.occurredAt))) {
+    errors.push('A valid movement timestamp is required.')
+  }
+  if (!INBOUND_KINDS.has(movement.kind) && !OUTBOUND_KINDS.has(movement.kind)) {
+    errors.push('Unsupported stock movement type.')
+  }
+  return errors
+}
+
+/**
+ * Returns on-hand units for one SKU. Duplicate movement IDs count once so a
+ * retry cannot double-count a movement. Invalid records are ignored; callers
+ * should surface their validation errors separately.
+ */
+export function stockOnHand(
+  movements: readonly StockMovement[],
+  sku: string,
+): number {
+  const target = normalizeSku(sku)
+  const seen = new Set<string>()
+  let balance = 0
+
+  for (const movement of movements) {
+    if (normalizeSku(movement.sku) !== target || seen.has(movement.id)) continue
+    if (validateStockMovement(movement).length > 0) continue
+
+    seen.add(movement.id)
+    if (INBOUND_KINDS.has(movement.kind)) balance += movement.quantity
+    else if (OUTBOUND_KINDS.has(movement.kind)) balance -= movement.quantity
+  }
+
+  return balance
+}
+
+export interface OfflineSaleLine {
+  sku: string
+  quantity: number
+}
+
+export interface OfflineSale {
+  /** Create once at checkout and persist locally before showing success. */
+  id: string
+  deviceId: string
+  createdAt: string
+  lines: OfflineSaleLine[]
+  /** Queued is local-only; never treat it as cloud-confirmed. */
+  status: 'queued' | 'syncing' | 'synced' | 'conflict'
+}
+
+export function validateOfflineSale(sale: OfflineSale): string[] {
+  const errors: string[] = []
+  if (!sale.id.trim()) errors.push('Sale ID is required.')
+  if (!sale.deviceId.trim()) errors.push('Device ID is required.')
+  if (!Number.isFinite(Date.parse(sale.createdAt))) {
+    errors.push('A valid sale timestamp is required.')
+  }
+  if (sale.lines.length === 0) errors.push('A sale must contain at least one line.')
+
+  for (const [index, line] of sale.lines.entries()) {
+    if (!normalizeSku(line.sku)) errors.push(`Line ${index + 1}: SKU is required.`)
+    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
+      errors.push(`Line ${index + 1}: quantity must be a positive whole number.`)
+    }
+  }
+
+  return errors
+}
+
+/**
+ * Intentionally does not decide if an offline sale is safe against shared stock.
+ * Multiple disconnected devices can sell the same last unit. Server sync must
+ * detect and report this conflict rather than silently overwrite inventory.
+ */
diff --git a/docs/business-manager.md b/docs/business-manager.md
new file mode 100644
--- /dev/null
+++ b/docs/business-manager.md
@@
+# AURALUXE Business Manager — first implementation slice
+
+## Safety boundaries
+
+- Work only on `business-manager/phase-0-staging-audit`.
+- Do not merge to `main` or deploy without explicit approval.
+- This slice is isolated from current routes, database, checkout, and Netlify.
+- Do not add or run production migrations as part of this prototype.
+- Preserve current online checkout's server-side price calculation, row locking,
+  stock reservation, and idempotency safeguards.
+- Offline sales remain queued until the server confirms synchronization.
+- Disconnected devices cannot guarantee globally accurate shared stock. Report
+  overselling conflicts instead of silently overwriting quantities.
+- Never store payment-card data. Only record cash, bank/QR/digital payment types
+  and references if/when the POS workflow is implemented.
+
+## Inventory movement model
+
+| Movement | Stock effect |
+|---|---:|
+| Opening balance | + |
+| Purchase received | + |
+| Sale | − |
+| Sale return / exchange in | + |
+| Supplier return / damage / loss | − |
+| Adjustment in / out | + / − |
+
+Movement IDs must be stable and unique. Retrying a movement with the same ID
+must not count it twice. Corrections are new compensating movements, not edits
+to historical movements.
+
+## Acceptance cases for this slice
+
+1. SKU ` ab-12 ` normalizes to `AB-12`.
+2. Opening 10, sale 3, return 1 produces on-hand 8.
+3. Repeating a movement ID does not double-count it.
+4. Zero, negative, fractional, missing-SKU, or invalid-timestamp movements are
+   rejected from the derived balance.
+5. An offline sale with no lines or invalid quantities fails validation.
+6. This module has no database or network imports and performs no writes.
+
+## Gated next steps
+
+1. Run a reproducible local install/build check.
+2. Design a SKU/variant mapping to existing catalogue items and size keys.
+3. Plan a migration that backfills opening movements from current size-stock JSON.
+   Compare totals before and after; do not run it against production.
+4. Add a POS UI and durable local queue only after migration and authentication
+   design are reviewed.
+5. Add database schema/migrations only when a safe test database is available.
+6. Add supplier/purchase flows and double-entry accounting after POS records and
+   inventory movement rules are stable.
