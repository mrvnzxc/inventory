export type Role = 'owner' | 'salesman'

export interface Profile {
  id: string
  email: string | null
  first_name?: string | null
  last_name?: string | null
  role: Role
}

export interface Branch {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  branch_id: string
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
}

export interface Product {
  id: string
  branch_id: string
  category_id: string | null
  subcategory_id: string | null
  name: string
  price: number | null
  image_url: string | null
  deleted_at?: string | null
  created_at: string
  categories?: { name: string } | null
  subcategories?: { name: string } | null
  branches?: { name: string } | null
}

export interface InventoryRow {
  id: string
  product_id: string
  branch_id: string
  stock: number
  updated_at: string
  products?: Product | null
  branches?: Branch | null
}

export interface Sale {
  id: string
  transaction_code?: string | null
  product_id: string
  branch_id: string
  quantity: number
  unit_price?: number | null
  sold_by: string
  created_at: string
  products?: { name: string; price: number | null } | null
  branches?: { name: string } | null
}

export interface SalesmanBranch {
  id: string
  user_id: string
  branch_id: string
}
