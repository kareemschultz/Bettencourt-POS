// === Organization & Location ===
export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
}

export interface Location {
  id: string
  organization_id: string
  name: string
  address: string | null
  phone: string | null
  timezone: string
  receipt_header: string | null
  receipt_footer: string | null
  is_active: boolean
  created_at: string
}

export interface Register {
  id: string
  location_id: string
  name: string
  department_filter: string[] | null
  is_active: boolean
  created_at: string
}

// === Departments / Product Categories ===
export interface Department {
  id: string
  organization_id: string
  name: string
  sort_order: number
  is_active: boolean
}

// === Products ===
export interface Product {
  id: string
  organization_id: string
  name: string
  reporting_name: string | null
  department_id: string | null
  sku: string | null
  price: number
  cost: number
  tax_rate: number
  is_combo: boolean
  is_active: boolean
  image_url: string | null
  sort_order: number
  department_name?: string
  combo_components?: ComboComponent[]
}

export interface ComboProduct {
  id: string
  product_id: string
  name: string
  price: number
  components: ComboComponent[]
}

export interface ComboComponent {
  id: string
  combo_product_id: string
  component_name: string
  department_id: string
  department_name?: string
  allocated_price: number
}

export interface ModifierGroup {
  id: string
  organization_id: string
  name: string
  required: boolean
  min_select: number
  max_select: number
}

export interface Modifier {
  id: string
  modifier_group_id: string
  name: string
  price: number
  is_active: boolean
  sort_order: number
}

// === Orders ===
export interface Order {
  id: string
  organization_id: string
  location_id: string
  register_id: string | null
  table_id: string | null
  user_id: string | null
  order_number: string
  daily_number: number | null
  status: string
  order_type: string
  subtotal: number
  tax_total: number
  discount_total: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  user_name?: string
  department_name?: string
  register_name?: string
}

export interface OrderLineItem {
  id: string
  order_id: string
  product_id: string | null
  product_name_snapshot: string
  department_snapshot: string | null
  quantity: number
  unit_price: number
  tax_rate_snapshot: number
  tax_amount: number
  line_total: number
  notes: string | null
  sort_order: number
  is_combo_component: boolean
  parent_line_item_id: string | null
}

export interface OrderLineModifier {
  id: string
  order_line_item_id: string
  modifier_name: string
  modifier_price: number
}

export interface Payment {
  id: string
  order_id: string
  method: string
  amount: number
  reference: string | null
  status: string
  created_at: string
}

// === Cart (client-side) ===
export interface CartItem {
  id: string
  product: Product
  quantity: number
  modifiers: CartModifier[]
  notes: string
  line_total: number
}

export interface CartModifier {
  id: string
  name: string
  price: number
}

// === Inventory ===
export interface InventoryItem {
  id: string
  organization_id: string
  sku: string
  name: string
  category: string | null
  unit_of_measure: string
  preferred_supplier_id: string | null
  reorder_point: number
  avg_cost: number
  is_active: boolean
  quantity_on_hand?: number
}

export interface Supplier {
  id: string
  organization_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  is_active: boolean
}

export interface PurchaseOrder {
  id: string
  organization_id: string
  location_id: string
  supplier_id: string
  status: string
  created_by: string | null
  approved_by: string | null
  notes: string | null
  total: number
  created_at: string
  supplier_name?: string
}

export interface Transfer {
  id: string
  organization_id: string
  from_location_id: string
  to_location_id: string
  status: string
  created_by: string | null
  notes: string | null
  created_at: string
  from_location_name?: string
  to_location_name?: string
}

export interface StockCount {
  id: string
  organization_id: string
  location_id: string
  type: string
  status: string
  created_by: string | null
  created_at: string
  finalized_at: string | null
}

// === Cash Control ===
export interface CashSession {
  id: string
  register_id: string
  location_id: string
  opened_by: string
  opened_at: string
  opening_float: number
  closed_by: string | null
  closed_at: string | null
  closing_count: number | null
  expected_cash: number | null
  variance: number | null
  status: string
  notes: string | null
  opener_name?: string
}

export interface CashDrop {
  id: string
  cash_session_id: string
  amount: number
  user_id: string
  reason: string | null
  created_at: string
}

export interface CashPayout {
  id: string
  cash_session_id: string
  amount: number
  user_id: string
  reason: string
  created_at: string
}

// === Restaurant ===
export interface TableLayout {
  id: string
  location_id: string
  name: string
  section: string | null
  seats: number
  position_x: number
  position_y: number
  shape: string
  status: string
}

export interface KitchenOrderTicket {
  id: string
  order_id: string
  location_id: string
  status: string
  printer_target: string | null
  created_at: string
  updated_at: string
  items?: KitchenOrderItem[]
  order_number?: string
  table_name?: string
}

export interface KitchenOrderItem {
  product_name: string
  quantity: number
  modifiers: string
  notes: string | null
}

// === Audit ===
export interface AuditLog {
  id: string
  user_id: string | null
  user_name_snapshot: string | null
  role_snapshot: string | null
  location_id: string | null
  entity_type: string
  entity_id: string | null
  action_type: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  diff_data: Record<string, unknown> | null
  reason: string | null
  ip_address: string | null
  created_at: string
}

// === Roles ===
export interface CustomRole {
  id: string
  organization_id: string
  name: string
  permissions: Record<string, string[]>
  is_system: boolean
}

// === Auth User ===
export interface AppUser {
  id: string
  name: string
  email: string
  role: string
  organization_id: string | null
  location_id: string | null
  custom_role_id: string | null
  permissions: Record<string, string[]>
}

// === Tax Rate ===
export interface TaxRate {
  id: string
  organization_id: string
  name: string
  rate: number
  is_default: boolean
  is_active: boolean
}

// === Currency formatting ===
export function formatGYD(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
