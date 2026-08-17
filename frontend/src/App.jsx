import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Globe2,
  Handshake,
  Layers3,
  LogOut,
  MapPinned,
  Moon,
  Package,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  Truck,
  Trash2,
  Upload,
  Users,
  WalletCards,
  Workflow,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, getToken, setToken, validationSummary } from './lib/api'
import './App.css'

const documentUploadAccept = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.dwg,.dxf,.jpg,.jpeg,.png,.webp'
const drawingUploadAccept = '.pdf,.dwg,.dxf'
const financeWorkbookAccept = '.xls,.xlsx,.xlsm,.csv'

const navItems = [
  { id: 'platform', label: 'Cloud Console', icon: ShieldCheck, permissions: ['platform.manage'] },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, permissions: ['reports.view'] },
  { id: 'crm', label: 'CRM', icon: Handshake, permissions: ['crm.manage'] },
  { id: 'tendering', label: 'Tendering', icon: ClipboardList, permissions: ['tenders.manage'] },
  { id: 'estimating', label: 'Estimating', icon: Calculator, permissions: ['estimating.manage'] },
  { id: 'projects', label: 'Projects', icon: FolderKanban, permissions: ['projects.manage'] },
  { id: 'procurement', label: 'Procurement', icon: Truck, permissions: ['procurement.manage'] },
  { id: 'inventory', label: 'Inventory', icon: Package, permissions: ['inventory.manage'] },
  { id: 'field', label: 'Site Management', icon: MapPinned, permissions: ['field.manage', 'attendance.manage'] },
  { id: 'finance', label: 'Finance', icon: WalletCards, permissions: ['finance.manage'] },
  { id: 'people', label: 'HR & Workforce', icon: Users, permissions: ['payroll.manage'] },
  { id: 'equipment', label: 'Equipment', icon: Truck, permissions: ['equipment.manage'] },
  { id: 'compliance', label: 'QA/HSE', icon: ShieldCheck, permissions: ['quality.manage', 'safety.manage'] },
  { id: 'portals', label: 'Portals', icon: Building2, permissions: ['portals.manage'] },
  { id: 'documents', label: 'Documents', icon: FileText, permissions: ['documents.manage'] },
  { id: 'reports', label: 'Reports', icon: ClipboardList, permissions: ['reports.view'] },
  { id: 'bi', label: 'Intelligence', icon: BarChart3, permissions: ['bi.manage'] },
  { id: 'automation', label: 'Automation', icon: Workflow, permissions: ['automation.manage'] },
  { id: 'account', label: 'Account Security', icon: ShieldCheck, permissions: [] },
  { id: 'admin', label: 'Admin', icon: Settings, permissions: ['settings.manage'] },
]

const accessCategories = [
  { id: 'dashboard_reports', label: 'Dashboard & Reports', description: 'Executive KPIs, dashboards, reports, and audit logs.', permissions: ['reports.view'] },
  { id: 'crm', label: 'CRM', description: 'Leads, opportunities, and customer pipeline.', permissions: ['crm.manage'] },
  { id: 'tendering', label: 'Tendering', description: 'Tender documents, RFIs, submissions, wins, and losses.', permissions: ['tenders.manage'] },
  { id: 'estimating', label: 'Estimating', description: 'Pricing items, estimates, markups, and approvals.', permissions: ['estimating.manage'] },
  { id: 'projects', label: 'Projects', description: 'Project records, tasks, budgets, and schedules.', permissions: ['projects.manage'] },
  { id: 'procurement', label: 'Procurement', description: 'Requests, RFQs, quotations, POs, GRNs, invoices, and supplier contracts.', permissions: ['procurement.manage', 'procurement.approve', 'suppliers.manage'] },
  { id: 'inventory', label: 'Inventory', description: 'Warehouses, stock items, stock movements, and reorder controls.', permissions: ['inventory.manage'] },
  { id: 'field', label: 'Site Management & Attendance', description: 'Daily reports, site issues, clock-in, and clock-out.', permissions: ['field.manage', 'attendance.manage'] },
  { id: 'finance', label: 'Finance', description: 'Invoices, payments, expenses, journals, and financial approvals.', permissions: ['finance.manage'] },
  { id: 'people', label: 'HR & Workforce', description: 'Recruitment, employees, workforce allocation, attendance, payroll, training, and HR records.', permissions: ['payroll.manage'] },
  { id: 'equipment', label: 'Equipment', description: 'Assets, assignments, maintenance, and fuel logs.', permissions: ['equipment.manage'] },
  { id: 'compliance', label: 'Quality Assurance and Health, Safety, and Environment', description: 'Inspections, Non-Conformance Reports(NCRs), observations, incidents, permits, and corrective actions.', permissions: ['quality.manage', 'safety.manage'] },
  { id: 'portals', label: 'Portals', description: 'Client and consultant portal access, submittals, and approvals.', permissions: ['portals.manage'] },
  { id: 'documents', label: 'Documents & Drawings', description: 'Document register, drawings, revisions, markups, and reviews.', permissions: ['documents.manage'] },
  { id: 'bi', label: 'Intelligence', description: 'Executive analytics, drill-down reporting, and operational scorecards.', permissions: ['bi.manage'] },
  { id: 'automation', label: 'Automation', description: 'Automation rules, execution runs, and system workflows.', permissions: ['automation.manage'] },
  { id: 'admin', label: 'Admin Settings', description: 'Company settings, users, roles, branches, clients, and suppliers.', permissions: ['settings.manage'] },
]

const allAccessPermissions = [...new Set(accessCategories.flatMap((category) => category.permissions))]

const africanCountryNames = {
  DZ: 'Algeria',
  AO: 'Angola',
  BJ: 'Benin',
  BW: 'Botswana',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  CV: 'Cabo Verde',
  CM: 'Cameroon',
  CF: 'Central African Republic',
  TD: 'Chad',
  KM: 'Comoros',
  CG: 'Republic of the Congo',
  CD: 'Democratic Republic of the Congo',
  CI: "Cote d'Ivoire",
  DJ: 'Djibouti',
  EG: 'Egypt',
  GQ: 'Equatorial Guinea',
  ER: 'Eritrea',
  SZ: 'Eswatini',
  ET: 'Ethiopia',
  GA: 'Gabon',
  GM: 'Gambia',
  GH: 'Ghana',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  KE: 'Kenya',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  MG: 'Madagascar',
  MW: 'Malawi',
  ML: 'Mali',
  MR: 'Mauritania',
  MU: 'Mauritius',
  MA: 'Morocco',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NE: 'Niger',
  NG: 'Nigeria',
  RW: 'Rwanda',
  ST: 'Sao Tome and Principe',
  SN: 'Senegal',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'South Sudan',
  SD: 'Sudan',
  TZ: 'Tanzania',
  TG: 'Togo',
  TN: 'Tunisia',
  UG: 'Uganda',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
  EH: 'Western Sahara',
}

const africanCurrencyNames = {
  DZD: 'Algerian Dinar',
  AOA: 'Angolan Kwanza',
  XOF: 'West African CFA Franc',
  BWP: 'Botswana Pula',
  BIF: 'Burundian Franc',
  CVE: 'Cabo Verdean Escudo',
  XAF: 'Central African CFA Franc',
  KMF: 'Comorian Franc',
  CDF: 'Congolese Franc',
  DJF: 'Djiboutian Franc',
  EGP: 'Egyptian Pound',
  ERN: 'Eritrean Nakfa',
  SZL: 'Eswatini Lilangeni',
  ETB: 'Ethiopian Birr',
  GMD: 'Gambian Dalasi',
  GHS: 'Ghanaian Cedi',
  GNF: 'Guinean Franc',
  KES: 'Kenyan Shilling',
  LSL: 'Lesotho Loti',
  LRD: 'Liberian Dollar',
  LYD: 'Libyan Dinar',
  MGA: 'Malagasy Ariary',
  MWK: 'Malawian Kwacha',
  MRU: 'Mauritanian Ouguiya',
  MUR: 'Mauritian Rupee',
  MAD: 'Moroccan Dirham',
  MZN: 'Mozambican Metical',
  NAD: 'Namibian Dollar',
  NGN: 'Nigerian Naira',
  RWF: 'Rwandan Franc',
  STN: 'Sao Tome and Principe Dobra',
  SCR: 'Seychellois Rupee',
  SLE: 'Sierra Leonean Leone',
  SOS: 'Somali Shilling',
  ZAR: 'South African Rand',
  SSP: 'South Sudanese Pound',
  SDG: 'Sudanese Pound',
  TZS: 'Tanzanian Shilling',
  TND: 'Tunisian Dinar',
  UGX: 'Ugandan Shilling',
  ZMW: 'Zambian Kwacha',
  ZWL: 'Zimbabwean Dollar',
  USD: 'United States Dollar',
}

const emptyProcurementData = { summary: {}, recent_activity: [], requisitions: [], rfqs: [], quotations: [], purchase_orders: [], goods_receipts: [], quality_inspections: [], supplier_invoices: [], payments: [], contracts: [], traceability: [], reports: {}, settings: {} }
const emptySalesData = { leads: [], opportunities: [], tenders: [], estimates: [], pricing_items: [] }
const emptyInventoryData = { warehouses: [], items: [], movements: [], supplier_prices: [], supplier_reviews: [], reorder_alerts: [] }
const emptyFieldData = { daily_reports: [], issues: [], attendance: [], open_attendance: null }
const emptyFinanceData = {
  summary: {},
  invoices: [],
  payments: [],
  expenses: [],
  journal_entries: [],
  accounts_receivable: {},
  accounts_payable: {},
  customers: [],
  suppliers: [],
  credit_notes: [],
  budgets: {},
  cash_flow: {},
  bank_accounts: [],
  bank_reconciliations: [],
  chart_of_accounts: {},
  general_ledger: {},
  cost_centers: [],
  fixed_assets: {},
  payroll_integration: {},
  taxes: {},
  retentions: [],
  progress_billings: [],
  purchase_invoice_matching: [],
  financial_reports: {},
  approvals: {},
  audit_trail: [],
  automation: {},
  finance_settings: {},
}
const emptyPeopleData = {
  summary: {},
  employees: [],
  leave_requests: [],
  payroll_runs: [],
  recruitment: { vacancies: [], candidates: [], applications: [], interviews: [] },
  onboarding: [],
  attendance: { records: [], summary: {} },
  shifts: [],
  shift_assignments: [],
  timesheets: [],
  workforce_allocations: [],
  overtime_requests: [],
  benefits: [],
  performance_reviews: [],
  training_courses: [],
  training_records: [],
  certifications: [],
  health_safety: { ppe_issues: [], expiring_ppe: [], certification_risk: [] },
  ppe_issues: [],
  contractors: [],
  employee_assets: [],
  documents: [],
  self_service: {},
  manager_portal: {},
  exit_records: [],
  reports: {},
  analytics: {},
  automation: {},
  settings: {},
  asset_candidates: [],
}
const emptyEquipmentData = { summary: {}, assets: [], assignments: [], maintenance: [], fuel_logs: [] }
const emptyComplianceData = { summary: {}, inspections: [], ncrs: [], incidents: [], toolbox_talks: [], observations: [], permits: [] }
const emptyPortalData = {
  summary: {},
  portal_users: [],
  accesses: [],
  client_approvals: [],
  consultant_submittals: [],
  work_items: [],
  portal_types: [],
  project_snapshots: [],
  supplier_purchase_orders: [],
  supplier_invoices: [],
  client_invoices: [],
  inspections: [],
  daily_reports: [],
  activity: [],
}
const emptyBiData = { dashboards: [], snapshots: [], datasets: {}, metrics: {}, filters: {}, meta: {}, executive: {}, portfolio: {}, project_controls: {}, financial: {}, commercial: {}, procurement: {}, inventory: {}, schedule: {}, workforce: {}, equipment: {}, quality: {}, hse: {}, risk: {}, sustainability: {}, client_reporting: {}, alerts: {} }
const emptyAutomationData = { summary: {}, rules: [], runs: [], templates: [], catalog: {}, analytics: {}, notifications: [], notification_settings: {} }
const emptyPlatformAdminData = {
  summary: {},
  command_center: { status: 'healthy', status_label: '', cards: [], alerts: [], recent_signups: [], companies_needing_attention: [] },
  companies: [],
  archived_companies: [],
  plans: [],
  subscriptions: [],
  feature_flags: [],
  billing_records: [],
  support_tickets: [],
  deployments: [],
  security_events: [],
  backups: [],
  settings: [],
  integrations: [],
  notifications: [],
  audit_logs: [],
  automation_workflows: { summary: {}, rules: [], recent_runs: [] },
  support_metrics: {},
  platform_staff: [],
  search_results: [],
  analytics: {},
  monitoring: {},
  catalog: {
    console_layers: [],
    modules: [],
    countries: [],
    currencies: [],
    plans: [],
    statuses: [],
    plan_statuses: [],
    subscription_statuses: [],
    billing_intervals: [],
    support_levels: [],
    support_priorities: [],
    support_ticket_statuses: [],
    billing_record_types: [],
    billing_statuses: [],
    backup_types: [],
    deployment_scopes: [],
  },
}
const emptyAdminApprovalData = { summary: {}, items: [] }
const emptyOrganizationData = { company: { branches: [], roles: [], users: [], settings: {} }, clients: [], suppliers: [] }
const emptyAccountSecurity = { mfa: { enabled: false, enabled_at: null, last_used_at: null, recovery_codes_remaining: 0 } }
const emptySecurityForms = { current_password: '', password: '', password_confirmation: '', mfa_code: '', recovery_code: '' }
const emptyList = []

const currencyFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat('en-GH', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const liveRefreshMs = Math.max(0, Number(import.meta.env.VITE_LIVE_REFRESH_MS ?? 30000) || 0)

const cloudConsolePaths = ['/cloud-console', '/platform-admin', '/super-admin']

function isCloudConsolePath(pathname = window.location.pathname) {
  return cloudConsolePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

const statusColor = {
  active: 'good',
  healthy: 'good',
  operational: 'good',
  inactive: 'neutral',
  suspended: 'bad',
  degraded: 'warn',
  attention: 'warn',
  approved: 'good',
  approved_for_construction: 'good',
  on_track: 'good',
  submitted: 'warn',
  issued: 'warn',
  issued_for_review: 'warn',
  at_risk: 'warn',
  blocked: 'bad',
  critical: 'bad',
  rejected: 'bad',
  lost: 'bad',
  cancelled: 'bad',
  draft: 'neutral',
  planning: 'neutral',
  qualified: 'neutral',
  new: 'neutral',
  under_review: 'warn',
  bid_decision_pending: 'warn',
  no_bid: 'bad',
  bid_approved: 'good',
  estimating: 'warn',
  proposal_preparation: 'warn',
  internal_review: 'warn',
  awaiting_approval: 'warn',
  ready_for_submission: 'good',
  under_evaluation: 'warn',
  clarification_requested: 'warn',
  negotiation: 'warn',
  preferred_bidder: 'good',
  withdrawn: 'bad',
  archived: 'neutral',
  open: 'warn',
  waiting_customer: 'warn',
  closed: 'good',
  resolved: 'good',
  paid: 'good',
  passed: 'good',
  completed: 'good',
  available: 'good',
  partial: 'warn',
  unpaid: 'warn',
  pending: 'warn',
  scheduled: 'neutral',
  pass: 'good',
  fail: 'bad',
  na: 'neutral',
  configured: 'neutral',
  queued: 'warn',
  current: 'good',
  connected: 'good',
  delivered: 'good',
  received: 'good',
  accepted: 'good',
  awarded: 'good',
  quotations_received: 'warn',
  rfq_sent: 'warn',
  sent: 'warn',
  responded: 'good',
  finance_approved: 'good',
  partially_paid: 'warn',
  invoiced: 'warn',
  recommended: 'good',
  green: 'good',
  amber: 'warn',
  red: 'bad',
  grey: 'neutral',
  low: 'good',
  medium: 'warn',
  high: 'bad',
  rework_required: 'bad',
  reopened: 'bad',
  in_review: 'warn',
  corrective_action: 'warn',
  investigating: 'warn',
  reported: 'warn',
  assigned: 'warn',
  maintenance: 'warn',
  changes_required: 'warn',
  revise_and_resubmit: 'warn',
  failed: 'bad',
  valid: 'good',
  online: 'good',
  enabled: 'good',
  disabled: 'neutral',
  warning: 'warn',
}

const emptyProjectForm = {
  branch_id: '',
  client_id: '',
  client_name: '',
  code: '',
  name: '',
  description: '',
  status: 'active',
  health_status: 'on_track',
  risk_level: 'medium',
  project_type: '',
  sector: '',
  contract_type: '',
  priority: 'normal',
  contract_value: '',
  currency: 'GHS',
  approved_variations: '',
  revised_contract_value: '',
  retention_percent: '',
  advance_payment: '',
  payment_terms: '',
  tax_configuration: '',
  funding_source: '',
  start_date: '',
  planned_start_date: '',
  actual_start_date: '',
  target_end_date: '',
  contract_completion_date: '',
  defects_liability_end_date: '',
  future_image: null,
  future_image_preview: '',
  country: 'GH',
  region: '',
  city: '',
  site_address: '',
  gps_coordinates: '',
  site_map_url: '',
  project_director: '',
  project_manager: '',
  site_manager: '',
  quantity_surveyor: '',
  project_engineer: '',
  hse_manager: '',
  qa_qc_manager: '',
  planner: '',
  commercial_manager: '',
  cost_code_structure: '',
  wbs_template: '',
  budget_template: '',
  approval_workflow: '',
  working_calendar: '',
  default_warehouse: '',
  default_document_folders: '',
  linked_crm_opportunity: '',
  linked_tender: '',
  linked_estimate: '',
  linked_contract: '',
}

const projectNumericFields = [
  'contract_value',
  'approved_variations',
  'revised_contract_value',
  'retention_percent',
  'advance_payment',
]

const emptyTaskForm = {
  title: '',
  status: 'todo',
  priority: 'normal',
  progress_percent: 0,
  due_date: '',
}

const emptyBudgetForm = {
  cost_code: '',
  description: '',
  category: 'materials',
  budget_amount: '',
}

const emptyLeadForm = {
  branch_id: '',
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  source: 'direct',
  estimated_value: '',
  next_follow_up_at: '',
}

const emptyTenderForm = {
  opportunity_id: '',
  branch_id: '',
  client_id: '',
  client_name: '',
  title: '',
  tender_manager_id: '',
  business_development_officer_id: '',
  tender_type: '',
  procurement_method: '',
  project_sector: '',
  project_category: '',
  project_location: '',
  priority: '',
  confidentiality_level: '',
  deadline_at: '',
  expected_award_at: '',
  value: '',
  tender_fee: '',
  currency: 'GHS',
  description: '',
  scope_summary: '',
  funding_source: '',
  tender_authority: '',
  bid_decision: '',
  bid_decision_score: '',
}

const emptyEstimateForm = {
  tender_id: '',
  title: '',
  overhead_percent: 8,
  profit_percent: 12,
  tax_percent: 0,
  cost_code: '',
  description: '',
  category: 'materials',
  quantity: 1,
  unit: 'each',
  unit_cost: '',
}

const emptyInventoryForms = {
  warehouse: { branch_id: '', code: '', name: '', location: '' },
  item: { sku: '', name: '', category: 'materials', unit: 'each', reorder_level: 0, average_cost: '' },
  movement: { warehouse_id: '', to_warehouse_id: '', inventory_item_id: '', type: 'receipt', quantity: 1, unit_cost: '', reason: '' },
  supplierPrice: { supplier_id: '', inventory_item_id: '', description: '', unit: 'each', unit_price: '', lead_time_days: 7 },
  supplierReview: { supplier_id: '', rating: 4, quality_score: 4, delivery_score: 4, cost_score: 4, notes: '' },
}

const emptyFieldForms = {
  dailyReport: { project_id: '', report_date: new Date().toISOString().slice(0, 10), weather: '', shift: 'day', labour_count: 0, progress_notes: '', safety_notes: '' },
  issue: { project_id: '', title: '', category: 'blocker', severity: 'medium', status: 'open', description: '', due_date: '' },
  clock: { project_id: '', clock_in_latitude: '', clock_in_longitude: '', clock_out_latitude: '', clock_out_longitude: '' },
}

const emptyFinanceForms = {
  invoice: { project_id: '', client_id: '', title: '', due_date: '', retention_percent: 0, progress_percent: 0, billing_stage: '', line_description: '', cost_code: '', quantity: 1, unit: 'each', unit_price: '', tax_rate: 0 },
  payment: { invoice_id: '', finance_bank_account_id: '', amount: '', method: 'bank_transfer', reference: '' },
  expense: { project_id: '', supplier_id: '', description: '', category: 'site_cost', cost_code: '', amount: '', tax_amount: 0 },
  journal: { entry_date: new Date().toISOString().slice(0, 10), reference: '', description: '', debit_account_code: '1200', debit_account_name: 'Accounts receivable', debit_amount: '', credit_account_code: '4100', credit_account_name: 'Construction revenue', credit_amount: '' },
  account: { account_code: '', account_name: '', account_type: 'asset', normal_balance: 'debit', description: '' },
  bankAccount: { branch_id: '', account_name: '', bank_name: '', account_number: '', currency: 'GHS', opening_balance: 0, is_default: false },
  reconciliation: { finance_bank_account_id: '', statement_date: new Date().toISOString().slice(0, 10), statement_balance: '', notes: '' },
  workbook: { branch_id: '', project_id: '', title: '', workbook_type: 'general_finance', description: '', file: null },
  creditNote: { invoice_id: '', amount: '', tax_amount: 0, reason: '' },
  retention: { project_id: '', invoice_id: '', supplier_invoice_id: '', party_type: 'client', base_amount: '', retention_percent: 10, retention_amount: '', due_date: '' },
  progressBilling: { project_id: '', milestone_name: '', progress_percent: '', billable_amount: '', retention_percent: 10, due_date: '', create_invoice: false },
  taxRule: { tax_name: '', tax_type: 'vat', rate: '', applies_to: 'sales', effective_from: '' },
  costCenter: { project_id: '', code: '', name: '', type: 'project', description: '' },
  fixedAsset: { equipment_asset_id: '', branch_id: '', name: '', category: 'equipment', purchase_date: '', purchase_cost: '', depreciation_method: 'straight_line', useful_life_months: 60 },
}

const emptyPeopleForms = {
  employee: {
    user_id: '',
    branch_id: '',
    manager_id: '',
    current_project_id: '',
    employment_type: 'full_time',
    department: 'operations',
    position: '',
    gender: '',
    date_of_birth: '',
    nationality: 'Ghanaian',
    marital_status: '',
    national_id: '',
    tax_number: '',
    ssnit_number: '',
    base_salary: '',
    hourly_rate: 0,
    allowances: 0,
    bonuses: 0,
    deductions: 0,
    hire_date: '',
    emergency_contact: '',
    bank_name: '',
    bank_account: '',
    skills: '',
    licenses: '',
    medical_notes: '',
  },
  vacancy: { branch_id: '', project_id: '', title: '', department: 'construction', employment_type: 'full_time', openings: 1, priority: 'high', description: '', required_skills: '', closes_on: '' },
  candidate: { full_name: '', email: '', phone: '', trade: '', location: '', source: 'direct', rating: 3, notes: '' },
  application: { job_vacancy_id: '', candidate_id: '', expected_salary: '', screening_score: 0, background_check_status: 'pending', offer_status: 'not_sent', notes: '' },
  hire: { branch_id: '', project_id: '', manager_id: '', base_salary: '', hourly_rate: '', hire_date: new Date().toISOString().slice(0, 10) },
  interview: { application_id: '', scheduled_at: '', stage: 'technical', interviewers: '', result: 'scheduled', score: 0, notes: '' },
  onboarding: { employee_profile_id: '', due_date: '', completed_items: '' },
  shift: { branch_id: '', project_id: '', name: '', shift_type: 'day', start_time: '07:00', end_time: '17:00', break_minutes: 60 },
  shiftAssignment: { shift_id: '', employee_profile_id: '', project_id: '', starts_on: new Date().toISOString().slice(0, 10), ends_on: '' },
  timesheet: { employee_profile_id: '', project_id: '', shift_id: '', work_date: new Date().toISOString().slice(0, 10), hours_worked: 8, overtime_hours: 0, cost_rate: '', notes: '' },
  allocation: { employee_profile_id: '', project_id: '', supervisor_id: '', role: '', allocation_percent: 100, start_date: new Date().toISOString().slice(0, 10), end_date: '' },
  overtime: { employee_profile_id: '', project_id: '', work_date: new Date().toISOString().slice(0, 10), hours: 1, reason: '' },
  leave: { employee_profile_id: '', leave_type: 'annual', starts_on: '', ends_on: '', reason: '' },
  payroll: { branch_id: '', period_start: new Date().toISOString().slice(0, 8) + '01', period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10) },
  benefit: { employee_profile_id: '', benefit_type: 'health_insurance', provider: '', amount: '', starts_on: '', ends_on: '' },
  performance: { employee_profile_id: '', period_start: '', period_end: '', safety_score: 4, quality_score: 4, productivity_score: 4, teamwork_score: 4, goals: '', notes: '' },
  trainingCourse: { title: '', category: 'safety', provider: '', duration_hours: 2 },
  trainingRecord: { employee_profile_id: '', training_course_id: '', status: 'scheduled', scheduled_on: '', completed_on: '', score: 0, certificate_number: '' },
  certification: { employee_profile_id: '', name: '', issuing_authority: '', issued_on: '', expires_on: '', document_path: '' },
  ppeIssue: { employee_profile_id: '', project_id: '', item_name: '', size: '', quantity: 1, issued_on: new Date().toISOString().slice(0, 10), replacement_due_on: '', condition: 'new' },
  contractor: { supplier_id: '', name: '', contact_name: '', email: '', phone: '', trade: '', worker_count: 0, contract_expires_on: '', insurance_expires_on: '' },
  asset: { employee_profile_id: '', equipment_asset_id: '', item_name: '', category: 'tool', serial_number: '', assigned_on: new Date().toISOString().slice(0, 10), return_due_on: '' },
  document: { employee_profile_id: '', candidate_id: '', document_type: 'contract', title: '', file_path: '', expiry_date: '' },
  exit: { employee_profile_id: '', exit_type: 'resignation', notice_date: '', exit_date: '', reason: '' },
}

const emptyEquipmentForms = {
  asset: { branch_id: '', name: '', category: 'plant', meter_reading: 0, hourly_rate: '' },
  assignment: { asset_id: '', project_id: '', meter_start: '' },
  maintenance: { asset_id: '', status: 'completed', service_date: new Date().toISOString().slice(0, 10), meter_reading: '', cost_amount: '', description: '' },
  fuel: { asset_id: '', project_id: '', quantity: '', unit_cost: '', meter_reading: '' },
}

const emptyComplianceForms = {
  inspection: {
    project_id: '',
    type: 'quality',
    area: '',
    scheduled_on: new Date().toISOString().slice(0, 10),
    notes: '',
    first_item: 'Work matches approved drawings and specifications',
    first_requirement: 'Approved drawing / specification',
    first_result: 'pending',
    first_severity: 'medium',
    second_item: 'Method statement and inspection test plan followed',
    second_requirement: 'Approved method statement',
    second_result: 'pending',
    second_severity: 'medium',
  },
  ncr: {
    project_id: '',
    inspection_id: '',
    title: '',
    department: 'qa',
    category: 'concrete',
    location: '',
    contractor: '',
    subcontractor: '',
    description: '',
    reference_documents: '',
    evidence: '',
    root_cause: '',
    corrective_action: '',
    preventive_action: '',
    verification_notes: '',
    severity: 'medium',
    due_date: '',
    close_status: 'closed',
  },
  incident: {
    project_id: '',
    incident_type: 'near_miss',
    location: '',
    occurred_at: '',
    injured_person: '',
    description: '',
    immediate_action: '',
    root_cause: '',
    severity: 'medium',
    corrective_action: '',
    close_status: 'closed',
  },
  talk: { project_id: '', topic: '', talk_date: new Date().toISOString().slice(0, 10), attendee_count: 0, summary: '', hazards_discussed: '' },
  observation: { project_id: '', observation_type: 'unsafe', location: '', description: '', severity: 'medium', corrective_action: '' },
  permit: { project_id: '', permit_type: 'hot_work', location: '', valid_from: '', valid_until: '', hazards: '', controls: '' },
}

const emptyPortalForms = {
  user: { client_id: '', user_type: 'client', name: '', email: '', organization: '' },
  access: { portal_user_id: '', project_id: '', access_level: 'view', access_scope: 'project' },
  clientApproval: { project_id: '', portal_user_id: '', drawing_id: '', document_id: '', title: '' },
  submittal: { project_id: '', portal_user_id: '', drawing_id: '', document_id: '', title: '', discipline: 'architectural' },
  workItem: {
    project_id: '',
    portal_user_id: '',
    supplier_id: '',
    portal_type: 'client',
    item_type: 'rfi',
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  },
}

const emptyPhaseFourForms = {
  dashboard: { name: '', audience: 'operations', refresh_interval: 'daily', is_default: 'false' },
  automation: {
    name: '',
    description: '',
    module: 'procurement',
    rule_type: 'event_workflow',
    trigger_event: 'material_request_submitted',
    condition_field: 'amount',
    condition_operator: 'greater_than',
    condition_value: '20000',
    condition_mode: 'all',
    action_type: 'create_insight',
    action_message: 'Review the matched record and assign the next owner.',
    schedule_frequency: 'event_driven',
    approval_mode: 'sequential',
    severity: 'high',
    is_active: 'true',
  },
}

const emptyPlatformForms = {
  company: {
    name: '',
    registration_number: '',
    industry: 'construction',
    country: 'GH',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    currency: 'GHS',
    timezone: 'Africa/Accra',
    language: 'en',
    date_format: 'Y-m-d',
    fiscal_year_start: '01-01',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    admin_password: '',
    subscription_plan_id: '',
    status: 'trial',
    trial_days: 14,
    storage_limit_mb: '',
    employee_limit: '',
    project_limit: '',
    branch_limit: 1,
    enabled_feature_keys: [],
  },
  plan: { id: '', code: '', name: '', status: 'active', currency: 'GHS', monthly_price: 0, yearly_price: 0, maximum_users: '', maximum_projects: '', maximum_storage_mb: '', support_level: 'standard', api_access: 'false', custom_branding: 'true', sso_available: 'false' },
  subscription: { id: '', platform_subscription_plan_id: '', status: 'active', billing_interval: 'monthly', amount: '', currency: 'GHS', seats: '', renewal_at: '' },
  feature: { id: '', name: '', module: '', category: 'feature', description: '', rollout_status: 'active', rollout_percentage: 100, default_enabled: 'false', requires_subscription: 'true', pricing_tier: '' },
  feature_company: { company_id: '' },
  branding: { company_id: '', primary_color: '#2364d8', secondary_color: '#188a5a', accent_color: '#b66a05', sidebar_color: '#102033', button_color: '#2364d8', typography: 'Inter', login_welcome_message: '', company_motto: '' },
  billing: { company_id: '', company_subscription_id: '', record_type: 'invoice', status: 'issued', amount: 0, currency: 'GHS', issued_on: '', due_on: '', paid_at: '' },
  support: { company_id: '', title: '', category: 'support', priority: 'medium', assigned_to: '', description: '', sla_due_at: '' },
  support_update: { id: '', status: 'open', priority: 'medium', assigned_to: '', resolution_notes: '' },
  deployment: { title: '', release_version: '', target_scope: 'all_customers', scheduled_at: '', notes: '' },
  backup: { company_id: '', backup_type: 'tenant', storage_path: '' },
  settings: { database_warning_ms: 250, database_critical_ms: 1000, queue_pending_warning: 50, failed_jobs_critical: 1, storage_warning_percent: 85, storage_critical_percent: 95, security_alert_critical: 1, server_count: '', servers_online: '', ai_enabled: 'false', ai_usage_percent: '', ai_monthly_token_limit: '', ai_monthly_budget: '', ai_cost_month_to_date: '' },
  impersonation: { company_id: '', user_id: '', reason: '', authorization_reference: '', expires_minutes: 30 },
  success: { company_id: '', success_manager: '', last_meeting_at: '', next_meeting_at: '', training_completed_percent: '', adoption_percent: '', risk_percent: '', expansion_opportunity: '', notes: '' },
  staff: { id: '', name: '', email: '', password: '', phone: '', job_title: '', status: 'active', permissions: ['platform.manage'] },
  profile: { user_id: '', name: '', email: '', phone: '', job_title: '', current_password: '', password: '', password_confirmation: '' },
  company_account: { company_id: '', name: '', registration_number: '', industry: '', country: 'GH', city: '', address: '', phone: '', email: '', website: '', tax_id: '', currency: 'GHS', timezone: 'Africa/Accra', language: 'en', date_format: 'Y-m-d', fiscal_year_start: '01-01', status: 'active', storage_limit_mb: '', employee_limit: '', project_limit: '', branch_limit: '', subscription_plan_id: '' },
}

function coerceAutomationValue(value) {
  if (value === undefined || value === null || value === '') return null

  const numeric = Number(value)

  return Number.isFinite(numeric) && String(value).trim() !== '' ? numeric : value
}

function automationPayloadFromForm(form) {
  const value = coerceAutomationValue(form.condition_value)
  const condition = form.condition_field
    ? {
        field: form.condition_field,
        operator: form.condition_operator || 'equals',
        ...(form.condition_operator === 'between'
          ? {
              min: Number(String(form.condition_value || '').split(',')[0] || 0),
              max: Number(String(form.condition_value || '').split(',')[1] || 0),
            }
          : {}),
        ...(!['empty', 'not_empty', 'today', 'yesterday', 'between'].includes(form.condition_operator || '') ? { value } : {}),
      }
    : null
  const conditions = condition ? [condition] : []
  const action = {
    type: form.action_type || 'create_insight',
    message: form.action_message || 'Review the matched automation record.',
    recommendation: form.action_message || 'Review the matched automation record.',
  }
  const approvalSteps = form.approval_mode && form.approval_mode !== 'none' ? ['Originator', 'Manager', 'Finance'] : []
  const nodes = [
    { id: 'trigger', type: 'trigger', label: labelize(form.trigger_event || 'manual') },
    ...(conditions.length ? [{ id: 'conditions', type: 'condition', label: 'Decision Engine', conditions }] : []),
    ...(approvalSteps.length ? [{ id: 'approval', type: 'approval', label: labelize(form.approval_mode), steps: approvalSteps }] : []),
    { id: 'action', type: 'action', label: labelize(action.type), action },
    { id: 'log', type: 'log', label: 'Audit Log' },
  ]

  return {
    name: form.name,
    description: form.description,
    module: form.module,
    rule_type: form.rule_type || 'event_workflow',
    trigger_event: form.trigger_event || 'manual',
    severity: form.severity || 'medium',
    status: form.is_active === 'true' || form.is_active === true ? 'active' : 'paused',
    is_active: form.is_active === 'true' || form.is_active === true,
    execution_mode: 'sync',
    conditions,
    actions: [action],
    schedule_config: { frequency: form.schedule_frequency || 'event_driven' },
    approval_config: { mode: form.approval_mode || 'none', steps: approvalSteps },
    notification_config: { channels: ['in_app'] },
    settings: { condition_mode: form.condition_mode || 'all', retry_policy: { max_retries: 2, on_failure: 'notify_admin' } },
    workflow_definition: {
      schema: 'navkwabuild.workflow.v1',
      nodes,
      edges: nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1].id })),
    },
  }
}

function notificationSettingsForm(settings = {}) {
  return {
    in_app_enabled: settings.in_app_enabled === false ? 'false' : 'true',
    email_enabled: settings.email_enabled === false ? 'false' : 'true',
    email_from_name: settings.email_from_name || '',
    email_from_address: settings.email_from_address || '',
    reply_to_email: settings.reply_to_email || '',
    minimum_email_severity: settings.minimum_email_severity || 'medium',
    digest_frequency: settings.digest_frequency || 'immediate',
    default_channels: Array.isArray(settings.default_channels) && settings.default_channels.length ? settings.default_channels : ['in_app', 'email'],
    max_retries: settings.retry_policy?.max_retries ?? 2,
    on_failure: settings.retry_policy?.on_failure || 'notify_admin',
  }
}

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light'
}

function normalizeThemePreference(theme) {
  return theme === 'dark' || theme === 'light' ? theme : null
}

const THEME_PREFERENCE_KEY = 'navkwabuild.theme.preference'

function userThemePreferenceKey(userId) {
  return userId ? `${THEME_PREFERENCE_KEY}.${userId}` : THEME_PREFERENCE_KEY
}

function readThemePreference(userId = null, fallbackToGlobal = true) {
  try {
    const scopedTheme = userId ? normalizeThemePreference(localStorage.getItem(userThemePreferenceKey(userId))) : null
    if (scopedTheme) return scopedTheme

    return fallbackToGlobal ? normalizeThemePreference(localStorage.getItem(THEME_PREFERENCE_KEY)) : null
  } catch {
    return null
  }
}

function writeThemePreference(theme, userId = null) {
  const nextTheme = normalizeTheme(theme)

  try {
    localStorage.setItem(THEME_PREFERENCE_KEY, nextTheme)
    if (userId) {
      localStorage.setItem(userThemePreferenceKey(userId), nextTheme)
    }
  } catch {
    // Theme changes should still work for the current session if storage is unavailable.
  }

  return nextTheme
}

function App() {
  const cloudConsolePortal = isCloudConsolePath()
  const [tokenReady, setTokenReady] = useState(Boolean(getToken()))
  const refreshInFlight = useRef(false)
  const refreshWorkspaceRef = useRef(null)
  const refreshProjectRef = useRef(null)
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    mfa_code: '',
    recovery_code: '',
  })
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [activeView, setActiveView] = useState(cloudConsolePortal ? 'platform' : 'dashboard')
  const [cloudConsoleLayer, setCloudConsoleLayer] = useState('platform')
  const [cloudConsoleTab, setCloudConsoleTab] = useState('executive')
  const [expandedCloudConsoleLayers, setExpandedCloudConsoleLayers] = useState(() => new Set())
  const [user, setUser] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [requisitions, setRequisitions] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [procurement, setProcurement] = useState(emptyProcurementData)
  const [documents, setDocuments] = useState([])
  const [drawings, setDrawings] = useState([])
  const [sales, setSales] = useState(emptySalesData)
  const [inventory, setInventory] = useState(emptyInventoryData)
  const [fieldOps, setFieldOps] = useState(emptyFieldData)
  const [finance, setFinance] = useState(emptyFinanceData)
  const [people, setPeople] = useState(emptyPeopleData)
  const [equipment, setEquipment] = useState(emptyEquipmentData)
  const [compliance, setCompliance] = useState(emptyComplianceData)
  const [portals, setPortals] = useState(emptyPortalData)
  const [businessIntelligence, setBusinessIntelligence] = useState(emptyBiData)
  const [automation, setAutomation] = useState(emptyAutomationData)
  const [platformAdmin, setPlatformAdmin] = useState(emptyPlatformAdminData)
  const [accountSecurity, setAccountSecurity] = useState(emptyAccountSecurity)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [adminApprovals, setAdminApprovals] = useState(emptyAdminApprovalData)
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(false)
  const [projectSubmitting, setProjectSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [themePreference, setThemePreference] = useState(() => readThemePreference())

  const [projectForm, setProjectForm] = useState(emptyProjectForm)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm)
  const [documentForm, setDocumentForm] = useState({})
  const [drawingForm, setDrawingForm] = useState({})
  const [revisionForm, setRevisionForm] = useState({ drawing_id: '', revision_code: '', notes: '' })
  const [markupForm, setMarkupForm] = useState({ drawing_id: '', comment: '', x: 0.5, y: 0.5 })
  const [reviewForm, setReviewForm] = useState({ drawing_id: '', decision: 'approved', comments: '' })
  const [leadForm, setLeadForm] = useState(emptyLeadForm)
  const [tenderForm, setTenderForm] = useState(emptyTenderForm)
  const [estimateForm, setEstimateForm] = useState(emptyEstimateForm)
  const [inventoryForms, setInventoryForms] = useState(emptyInventoryForms)
  const [fieldForms, setFieldForms] = useState(emptyFieldForms)
  const [financeForms, setFinanceForms] = useState(emptyFinanceForms)
  const [peopleForms, setPeopleForms] = useState(emptyPeopleForms)
  const [equipmentForms, setEquipmentForms] = useState(emptyEquipmentForms)
  const [complianceForms, setComplianceForms] = useState(emptyComplianceForms)
  const [portalForms, setPortalForms] = useState(emptyPortalForms)
  const [phaseFourForms, setPhaseFourForms] = useState(emptyPhaseFourForms)
  const [platformForms, setPlatformForms] = useState(emptyPlatformForms)
  const [securityForms, setSecurityForms] = useState(emptySecurityForms)
  const [adminForms, setAdminForms] = useState({
    company: {},
    branch: { code: '', name: '', city: '', country: 'GH' },
    client: { id: '', name: '', contact_name: '', email: '', phone: '', status: 'active' },
    supplier: { id: '', name: '', contact_name: '', email: '', phone: '', rating: 4, lead_time_days: 7, status: 'active' },
    user: { id: '', name: '', email: '', password: '', branch_id: '', role_id: '', role_name: '', permissions: [], status: 'active' },
  })

  const branches = organization?.company?.branches || emptyList
  const suppliers = organization?.suppliers || emptyList
  const clients = organization?.clients || emptyList
  const roles = organization?.company?.roles || emptyList
  const users = organization?.company?.users || emptyList
  const currentUserId = user?.id || null
  const firstBranchId = branches[0]?.id || ''
  const allowedNavItems = useMemo(() => accessibleNavItems(user, { cloudConsole: cloudConsolePortal }), [cloudConsolePortal, user])
  const persistedCompanyTheme = normalizeTheme(organization?.company?.settings?.appearance?.theme)
  const adminSelectedTheme = canAdministerRecords(user) ? adminForms.company?.appearance_theme : null
  const userThemePreference = normalizeThemePreference(themePreference)
  const activeTheme = tokenReady ? normalizeTheme(userThemePreference || adminSelectedTheme || persistedCompanyTheme) : normalizeTheme(userThemePreference || 'light')

  useEffect(() => {
    refreshWorkspaceRef.current = refreshWorkspace
    refreshProjectRef.current = refreshProject
  })

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme
    document.documentElement.style.colorScheme = activeTheme
  }, [activeTheme])

  useEffect(() => {
    if (!currentUserId) return
    setThemePreference(readThemePreference(currentUserId, false))
  }, [currentUserId])

  useEffect(() => {
    if (tokenReady) {
      refreshWorkspaceRef.current?.()
    }
  }, [tokenReady])

  useEffect(() => {
    if (!tokenReady || !currentUserId || liveRefreshMs <= 0) {
      return undefined
    }

    const refreshLiveData = () => {
      if (document.visibilityState === 'visible') {
        refreshWorkspaceRef.current?.({ silent: true })
        refreshProjectRef.current?.(selectedProjectId, { silent: true })
      }
    }

    const intervalId = window.setInterval(refreshLiveData, liveRefreshMs)
    window.addEventListener('focus', refreshLiveData)
    document.addEventListener('visibilitychange', refreshLiveData)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshLiveData)
      document.removeEventListener('visibilitychange', refreshLiveData)
    }
  }, [currentUserId, selectedProjectId, tokenReady])

  useEffect(() => {
    if (!tokenReady || !user || allowedNavItems.length === 0) {
      return
    }

    if (!allowedNavItems.some((item) => item.id === activeView)) {
      setActiveView(allowedNavItems[0].id)
    }
  }, [activeView, allowedNavItems, tokenReady, user])

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (selectedProjectId && tokenReady) {
      refreshProject(selectedProjectId)
    }
  }, [selectedProjectId, tokenReady])

  useEffect(() => {
    if (firstBranchId && !projectForm.branch_id) {
      setProjectForm((current) => ({ ...current, branch_id: firstBranchId }))
    }

    if (firstBranchId && !leadForm.branch_id) {
      setLeadForm((current) => ({ ...current, branch_id: firstBranchId }))
    }

    if (firstBranchId && !inventoryForms.warehouse.branch_id) {
      setInventoryForms((current) => ({
        ...current,
        warehouse: { ...current.warehouse, branch_id: firstBranchId },
      }))
    }

    if (firstBranchId && !peopleForms.employee.branch_id) {
      setPeopleForms((current) => ({
        ...current,
        employee: { ...current.employee, branch_id: firstBranchId },
      }))
    }

    if (firstBranchId && (!peopleForms.vacancy.branch_id || !peopleForms.shift.branch_id || !peopleForms.payroll.branch_id)) {
      setPeopleForms((current) => ({
        ...current,
        vacancy: { ...current.vacancy, branch_id: firstBranchId },
        shift: { ...current.shift, branch_id: firstBranchId },
        payroll: { ...current.payroll, branch_id: firstBranchId },
      }))
    }

    if (firstBranchId && !equipmentForms.asset.branch_id) {
      setEquipmentForms((current) => ({
        ...current,
        asset: { ...current.asset, branch_id: firstBranchId },
      }))
    }

    if (firstBranchId && !adminForms.user.branch_id) {
      setAdminForms((current) => ({
        ...current,
        user: { ...current.user, branch_id: firstBranchId },
      }))
    }

  }, [firstBranchId, projectForm.branch_id, leadForm.branch_id, inventoryForms.warehouse.branch_id, peopleForms.employee.branch_id, peopleForms.vacancy.branch_id, peopleForms.shift.branch_id, peopleForms.payroll.branch_id, equipmentForms.asset.branch_id, adminForms.user.branch_id])

  async function refreshWorkspace(options = {}) {
    if (refreshInFlight.current && !options.force) {
      return null
    }

    const silent = options.silent === true
    refreshInFlight.current = true

    if (!silent) {
      setLoading(true)
      setError('')
    }

    try {
      const me = await api.me()
      const currentUser = me.user
      const can = (permissions) => hasAnyPermission(currentUser, permissions)
      const nextNavItems = accessibleNavItems(currentUser, { cloudConsole: cloudConsolePortal })

      if (nextNavItems.length === 0) {
        setToken(null)
        setTokenReady(false)
        setUser(null)
        setError(cloudConsolePortal ? 'Use a Navkwa Build Cloud Console administrator account.' : 'Use your company Navkwa Build account on this login page.')

        return null
      }

      const moduleLoadFailures = []
      const organizationFallback = {
        ...emptyOrganizationData,
        company: {
          ...emptyOrganizationData.company,
          ...(currentUser.company || {}),
          branches: currentUser.company?.branches || emptyList,
        },
      }
      const loadIf = async (label, condition, loader, fallback) => {
        if (!condition) {
          return fallback
        }

        try {
          return await loader()
        } catch (err) {
          if (err?.status === 401) {
            throw err
          }

          moduleLoadFailures.push(label)
          console.warn(`Navkwa Build could not load ${label}.`, err)

          return fallback
        }
      }
      const needsProjects = can([
        'projects.manage',
        'procurement.manage',
        'field.manage',
        'equipment.manage',
        'quality.manage',
        'safety.manage',
        'portals.manage',
        'documents.manage',
        'finance.manage',
        'payroll.manage',
      ])
      const needsDocuments = can(['documents.manage', 'portals.manage'])

      const [
        dashboardData,
        orgData,
        projectData,
        procurementData,
        docData,
        drawingData,
        salesData,
        inventoryData,
        fieldData,
        financeData,
        peopleData,
        equipmentData,
        complianceData,
        portalData,
        reportData,
        biData,
        automationData,
        platformAdminData,
        securityData,
        adminApprovalData,
      ] = await Promise.all([
        loadIf('Dashboard', !cloudConsolePortal && can(['reports.view']), api.dashboard, null),
        loadIf('Organization', !cloudConsolePortal, api.organization, organizationFallback),
        loadIf('Projects', !cloudConsolePortal && needsProjects, api.projects, { data: [] }),
        loadIf('Procurement', !cloudConsolePortal && can(['procurement.manage']), api.procurement, emptyProcurementData),
        loadIf('Documents', !cloudConsolePortal && needsDocuments, api.documents, { data: [] }),
        loadIf('Drawings', !cloudConsolePortal && needsDocuments, api.drawings, { data: [] }),
        loadIf('CRM, Tendering, and Estimating', !cloudConsolePortal && can(['crm.manage', 'tenders.manage', 'estimating.manage']), api.sales, emptySalesData),
        loadIf('Inventory', !cloudConsolePortal && can(['inventory.manage']), api.inventory, emptyInventoryData),
        loadIf('Site Management and Attendance', !cloudConsolePortal && can(['field.manage', 'attendance.manage']), api.field, emptyFieldData),
        loadIf('Finance', !cloudConsolePortal && can(['finance.manage']), api.finance, emptyFinanceData),
        loadIf('HR and Workforce', !cloudConsolePortal && can(['payroll.manage']), api.people, emptyPeopleData),
        loadIf('Equipment', !cloudConsolePortal && can(['equipment.manage']), api.equipment, emptyEquipmentData),
        loadIf('QA/HSE', !cloudConsolePortal && can(['quality.manage', 'safety.manage']), api.compliance, emptyComplianceData),
        loadIf('Portals', !cloudConsolePortal && can(['portals.manage']), api.portals, emptyPortalData),
        loadIf('Reports', !cloudConsolePortal && can(['reports.view']), api.reports, null),
        loadIf('Intelligence', !cloudConsolePortal && can(['bi.manage']), api.businessIntelligence, emptyBiData),
        loadIf('Automation', !cloudConsolePortal && can(['automation.manage']), api.automation, emptyAutomationData),
        loadIf('Platform Administration', cloudConsolePortal && can(['platform.manage']), api.platformAdmin, emptyPlatformAdminData),
        loadIf('Account security', true, api.mfaStatus, { security: emptyAccountSecurity }),
        loadIf('Admin approvals', !cloudConsolePortal && can(['settings.manage']), api.adminApprovals, emptyAdminApprovalData),
      ])

      setUser(me.user)
      setDashboard(dashboardData)
      setOrganization(orgData)
      setProjects(projectData.data || [])
      setProcurement(procurementData)
      setRequisitions(procurementData.requisitions || [])
      setPurchaseOrders(procurementData.purchase_orders || [])
      setDocuments(docData.data || [])
      setDrawings(drawingData.data || [])
      setSales(salesData)
      setInventory(inventoryData)
      setFieldOps(fieldData)
      setFinance(financeData)
      setPeople(peopleData)
      setEquipment(equipmentData)
      setCompliance(complianceData)
      setPortals(portalData)
      setReports(reportData)
      setBusinessIntelligence(biData)
      setAutomation(automationData)
      setPlatformAdmin(platformAdminData)
      setAccountSecurity(securityData?.security || emptyAccountSecurity)
      setAdminApprovals(adminApprovalData)
      if (nextNavItems.length > 0 && !nextNavItems.some((item) => item.id === activeView)) {
        setActiveView(nextNavItems[0].id)
      }
      setAdminForms((current) => ({
        ...current,
        company: {
          name: orgData.company?.name || '',
          registration_number: orgData.company?.registration_number || '',
          tax_id: orgData.company?.tax_id || '',
          default_currency: orgData.company?.default_currency || 'GHS',
          country: orgData.company?.country || 'GH',
          base_timezone: orgData.company?.base_timezone || 'Africa/Accra',
          settings: orgData.company?.settings || {},
          appearance_theme: normalizeTheme(orgData.company?.settings?.appearance?.theme),
        },
      }))
      if (moduleLoadFailures.length > 0 && !silent) {
        setError(`Some modules could not be loaded: ${moduleLoadFailures.join(', ')}.`)
      }
    } catch (err) {
      if (err.status === 401) {
        setToken(null)
        setTokenReady(false)
        setAccountSecurity(emptyAccountSecurity)
        setMfaSetup(null)
        setSecurityForms(emptySecurityForms)
      }

      if (!silent) {
        setError(validationSummary(err))
      }
      return null
    } finally {
      refreshInFlight.current = false
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function refreshProject(projectId = selectedProjectId, options = {}) {
    if (!projectId) return

    try {
      const payload = await api.project(projectId)
      setSelectedProject(payload.project)
    } catch (err) {
      if (!options.silent) {
        setError(validationSummary(err))
      }
    }
  }

  async function runAction(action, _successMessage, options = {}) {
    setError('')
    setNotice('')

    try {
      const result = await action()

      if (options.skipRefresh) {
        setNotice(_successMessage || '')
        return result
      }

      if (options.refreshProjectOnly) {
        await refreshProject()
      } else {
        await refreshWorkspace({ force: true })
      }

      setNotice(_successMessage || '')
      return result
    } catch (err) {
      setError(validationSummary(err))
      return null
    }
  }

  async function archiveCompany() {
    const result = await runAction(() => api.deleteCompany(), 'Company archived. Signed out.', { skipRefresh: true })

    if (result) {
      setToken(null)
      setTokenReady(false)
      setUser(null)
      setOrganization(null)
      setSelectedProject(null)
      setSelectedProjectId(null)
      setAccountSecurity(emptyAccountSecurity)
      setMfaSetup(null)
      setSecurityForms(emptySecurityForms)
    }
  }

  async function handleAuth(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = mfaChallenge?.challenge_token
        ? await api.completeMfaChallenge({
            challenge_token: mfaChallenge.challenge_token,
            mfa_code: authForm.mfa_code || null,
            recovery_code: authForm.recovery_code || null,
          })
        : await api.login({ email: authForm.email, password: authForm.password })

      if (payload.mfa_required) {
        setMfaChallenge({
          challenge_token: payload.challenge_token,
          expires_at: payload.expires_at,
        })
        setAuthForm((current) => ({
          ...current,
          password: '',
          mfa_code: '',
          recovery_code: '',
        }))

        return
      }

      const nextNavItems = accessibleNavItems(payload.user, { cloudConsole: cloudConsolePortal })

      if (nextNavItems.length === 0) {
        setToken(payload.token)
        try {
          await api.logout()
        } finally {
          setToken(null)
        }
        setUser(null)
        setTokenReady(false)
        setMfaChallenge(null)
        setAccountSecurity(emptyAccountSecurity)
        setMfaSetup(null)
        setSecurityForms(emptySecurityForms)
        setError(cloudConsolePortal ? 'Use a Navkwa Build Cloud Console administrator account.' : 'Use your company Navkwa Build account on this login page.')

        return
      }

      setToken(payload.token)
      setUser(payload.user)
      setMfaChallenge(null)
      setAuthForm((current) => ({ ...current, password: '', mfa_code: '', recovery_code: '' }))
      setActiveView(nextNavItems[0]?.id || (cloudConsolePortal ? 'platform' : 'dashboard'))
      setTokenReady(true)
    } catch (err) {
      setAuthForm((current) => ({ ...current, password: '', mfa_code: '', recovery_code: '' }))
      setError(validationSummary(err))
    } finally {
      setLoading(false)
    }
  }

  function resetMfaChallenge() {
    setMfaChallenge(null)
    setAuthForm((current) => ({ ...current, password: '', mfa_code: '', recovery_code: '' }))
    setError('')
  }

  async function handleLogout() {
    await runAction(() => api.logout(), 'Signed out.', { skipRefresh: true })
    setToken(null)
    setTokenReady(false)
    setUser(null)
    setMfaChallenge(null)
    setAccountSecurity(emptyAccountSecurity)
    setMfaSetup(null)
    setSecurityForms(emptySecurityForms)
    setActiveView(cloudConsolePortal ? 'platform' : 'dashboard')
  }

  function setAdminFormValue(section) {
    return (event) => {
      const { name, value } = event.target
      setAdminForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function toggleThemePreference() {
    setThemePreference(writeThemePreference(activeTheme === 'dark' ? 'light' : 'dark', currentUserId))
  }

  async function createProject(event) {
    event.preventDefault()
    if (projectSubmitting) return

    const branchId = projectForm.branch_id || firstBranchId

    setProjectSubmitting(true)
    const submittedForm = { ...projectForm, branch_id: branchId }
    const payload = projectPayloadFromForm(submittedForm)

    try {
      setError('')
      setNotice('')
      const result = await api.createProject(payload)

      if (result?.project?.id) {
        let imageWarning = ''
        if (projectForm.future_image) {
          const imageData = new FormData()
          imageData.append('future_image', projectForm.future_image)
          try {
            await api.uploadProjectImage(result.project.id, imageData)
          } catch (imageError) {
            imageWarning = ` The project was saved, but its image could not be uploaded: ${validationSummary(imageError)}`
          }
        }

        setProjects((current) => [result.project, ...current.filter((project) => project.id !== result.project.id)])
        setSelectedProjectId(result.project.id)
        setProjectForm({ ...emptyProjectForm, branch_id: branchId })
        setNotice(`Project created.${imageWarning}`)
        await refreshWorkspace({ force: true, silent: true })
      }
    } catch (err) {
      setError(validationSummary(err))
    } finally {
      setProjectSubmitting(false)
    }
  }

  async function createTask(event) {
    event.preventDefault()
    if (!selectedProject) return

    await runAction(
      () =>
        api.createTask(selectedProject.id, {
          ...taskForm,
          progress_percent: Number(taskForm.progress_percent || 0),
        }),
      'Task added.',
    )
    setTaskForm(emptyTaskForm)
  }

  async function createBudgetLine(event) {
    event.preventDefault()
    if (!selectedProject) return

    await runAction(
      () =>
        api.createBudgetLine(selectedProject.id, {
          ...budgetForm,
          budget_amount: Number(budgetForm.budget_amount || 0),
        }),
      'Budget line added.',
    )
    setBudgetForm(emptyBudgetForm)
  }

  async function createLead(event) {
    event.preventDefault()

    await runAction(
      () =>
        api.createLead({
          ...leadForm,
          branch_id: Number(leadForm.branch_id || firstBranchId),
          estimated_value: Number(leadForm.estimated_value || 0),
          next_follow_up_at: leadForm.next_follow_up_at || null,
        }),
      'Lead created.',
    )
    setLeadForm({ ...emptyLeadForm, branch_id: leadForm.branch_id })
  }

  async function createTender(event) {
    event.preventDefault()

    const action = tenderForm.opportunity_id
      ? () =>
          api.createTenderFromOpportunity(Number(tenderForm.opportunity_id), {
            title: tenderForm.title,
            deadline_at: tenderForm.deadline_at || null,
            expected_award_at: tenderForm.expected_award_at || null,
            tender_type: tenderForm.tender_type || null,
            procurement_method: tenderForm.procurement_method || null,
            project_sector: tenderForm.project_sector || null,
            project_category: tenderForm.project_category || null,
            project_location: tenderForm.project_location || null,
            priority: tenderForm.priority || null,
            confidentiality_level: tenderForm.confidentiality_level || null,
          })
      : () =>
          api.createTender({
            branch_id: Number(tenderForm.branch_id || firstBranchId),
            client_id: tenderForm.client_id ? Number(tenderForm.client_id) : null,
            client_name: tenderForm.client_id ? null : tenderForm.client_name,
            title: tenderForm.title,
            tender_manager_id: tenderForm.tender_manager_id ? Number(tenderForm.tender_manager_id) : null,
            business_development_officer_id: tenderForm.business_development_officer_id ? Number(tenderForm.business_development_officer_id) : null,
            tender_type: tenderForm.tender_type || null,
            procurement_method: tenderForm.procurement_method || null,
            project_sector: tenderForm.project_sector || null,
            project_category: tenderForm.project_category || null,
            project_location: tenderForm.project_location,
            deadline_at: tenderForm.deadline_at || null,
            expected_award_at: tenderForm.expected_award_at || null,
            value: Number(tenderForm.value || 0),
            tender_fee: Number(tenderForm.tender_fee || 0),
            currency: tenderForm.currency || 'GHS',
            description: tenderForm.description,
            scope_summary: tenderForm.scope_summary,
            funding_source: tenderForm.funding_source,
            tender_authority: tenderForm.tender_authority,
            priority: tenderForm.priority || null,
            confidentiality_level: tenderForm.confidentiality_level || null,
            bid_decision: tenderForm.bid_decision || null,
            bid_decision_score: tenderForm.bid_decision_score ? Number(tenderForm.bid_decision_score) : null,
          })

    await runAction(action, tenderForm.opportunity_id ? 'Tender created from opportunity.' : 'Tender created.')
    setTenderForm({ ...emptyTenderForm, branch_id: tenderForm.branch_id })
  }

  async function createEstimate(event) {
    event.preventDefault()

    await runAction(
      () =>
        api.createEstimate({
          tender_id: estimateForm.tender_id ? Number(estimateForm.tender_id) : null,
          title: estimateForm.title,
          overhead_percent: Number(estimateForm.overhead_percent || 0),
          profit_percent: Number(estimateForm.profit_percent || 0),
          tax_percent: Number(estimateForm.tax_percent || 0),
          lines: [
            {
              cost_code: estimateForm.cost_code,
              description: estimateForm.description,
              category: estimateForm.category,
              quantity: Number(estimateForm.quantity || 1),
              unit: estimateForm.unit || 'each',
              unit_cost: Number(estimateForm.unit_cost || 0),
            },
          ],
        }),
      'Estimate created.',
    )
    setEstimateForm({ ...emptyEstimateForm, tender_id: estimateForm.tender_id })
  }

  function setInventoryForm(section) {
    return (event) => {
      const { name, value } = event.target
      setInventoryForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setFieldForm(section) {
    return (event) => {
      const { name, value } = event.target
      setFieldForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setFinanceForm(section) {
    return (event) => {
      const { checked, name, type, value } = event.target
      setFinanceForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: type === 'checkbox' ? checked : value },
      }))
    }
  }

  function setPeopleForm(section) {
    return (event) => {
      const { name, value } = event.target
      setPeopleForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setEquipmentForm(section) {
    return (event) => {
      const { name, value } = event.target
      setEquipmentForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setComplianceForm(section) {
    return (event) => {
      const { name, value } = event.target
      setComplianceForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setPortalForm(section) {
    return (event) => {
      const { name, value } = event.target
      setPortalForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setPhaseFourForm(section) {
    return (event) => {
      const { name, value } = event.target
      setPhaseFourForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setPlatformForm(section) {
    return (event) => {
      const { name, value } = event.target
      setPlatformForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  async function createWarehouse(event) {
    event.preventDefault()
    await runAction(
      () => api.createWarehouse({ ...inventoryForms.warehouse, branch_id: Number(inventoryForms.warehouse.branch_id || firstBranchId) }),
      'Warehouse created.',
    )
    setInventoryForms((current) => ({ ...current, warehouse: { branch_id: firstBranchId, code: '', name: '', location: '' } }))
  }

  async function createInventoryItem(event) {
    event.preventDefault()
    await runAction(
      () =>
        api.createInventoryItem({
          ...inventoryForms.item,
          reorder_level: Number(inventoryForms.item.reorder_level || 0),
          average_cost: Number(inventoryForms.item.average_cost || 0),
        }),
      'Inventory item created.',
    )
    setInventoryForms((current) => ({ ...current, item: emptyInventoryForms.item }))
  }

  async function createStockMovement(event) {
    event.preventDefault()
    const movement = inventoryForms.movement

    await runAction(
      () =>
        api.createStockMovement({
          ...movement,
          warehouse_id: Number(movement.warehouse_id),
          to_warehouse_id: movement.to_warehouse_id ? Number(movement.to_warehouse_id) : null,
          inventory_item_id: Number(movement.inventory_item_id),
          quantity: Number(movement.quantity || 0),
          unit_cost: Number(movement.unit_cost || 0),
        }),
      'Stock movement recorded.',
    )
    setInventoryForms((current) => ({ ...current, movement: { ...emptyInventoryForms.movement, warehouse_id: movement.warehouse_id, inventory_item_id: movement.inventory_item_id } }))
  }

  async function createSupplierPrice(event) {
    event.preventDefault()
    const form = inventoryForms.supplierPrice
    if (!form.supplier_id) {
      setError('Select a supplier before adding a supplier price.')
      return
    }

    await runAction(
      () =>
        api.createSupplierPrice(form.supplier_id, {
          ...form,
          inventory_item_id: form.inventory_item_id ? Number(form.inventory_item_id) : null,
          unit_price: Number(form.unit_price || 0),
          lead_time_days: Number(form.lead_time_days || 7),
        }),
      'Supplier price added.',
    )
    setInventoryForms((current) => ({ ...current, supplierPrice: { ...emptyInventoryForms.supplierPrice, supplier_id: form.supplier_id } }))
  }

  async function createSupplierReview(event) {
    event.preventDefault()
    const form = inventoryForms.supplierReview
    if (!form.supplier_id) {
      setError('Select a supplier before recording a review.')
      return
    }

    await runAction(
      () =>
        api.createSupplierReview(form.supplier_id, {
          rating: Number(form.rating || 3),
          quality_score: Number(form.quality_score || form.rating || 3),
          delivery_score: Number(form.delivery_score || form.rating || 3),
          cost_score: Number(form.cost_score || form.rating || 3),
          notes: form.notes,
        }),
      'Supplier review added.',
    )
    setInventoryForms((current) => ({ ...current, supplierReview: { ...emptyInventoryForms.supplierReview, supplier_id: form.supplier_id } }))
  }

  async function createDailyReport(event) {
    event.preventDefault()
    const form = fieldForms.dailyReport
    if (!form.project_id) {
      setError('Select a project before creating a daily report.')
      return
    }

    await runAction(
      () =>
        api.createDailyReport(form.project_id, {
          ...form,
          labour_count: Number(form.labour_count || 0),
        }),
      'Daily report created.',
    )
    setFieldForms((current) => ({ ...current, dailyReport: { ...emptyFieldForms.dailyReport, project_id: form.project_id, report_date: new Date().toISOString().slice(0, 10) } }))
  }

  async function createFieldIssue(event) {
    event.preventDefault()
    const form = fieldForms.issue
    if (!form.project_id) {
      setError('Select a project before creating a site issue.')
      return
    }

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    await runAction(() => api.createFieldIssue(form.project_id, formData), 'Site issue created.')
    setFieldForms((current) => ({ ...current, issue: { ...emptyFieldForms.issue, project_id: form.project_id } }))
    event.target.reset()
  }

  async function clockIn(event) {
    event.preventDefault()
    const form = fieldForms.clock
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    await runAction(() => api.clockIn(formData), 'Clocked in.')
  }

  async function clockOut(event) {
    event.preventDefault()
    if (!fieldOps.open_attendance?.id) return

    const form = fieldForms.clock
    const formData = new FormData()
    if (form.clock_out_latitude) formData.append('clock_out_latitude', form.clock_out_latitude)
    if (form.clock_out_longitude) formData.append('clock_out_longitude', form.clock_out_longitude)
    if (form.face) formData.append('face', form.face)

    await runAction(() => api.clockOut(fieldOps.open_attendance.id, formData), 'Clocked out.')
  }

  async function createInvoice(event) {
    event.preventDefault()
    const form = financeForms.invoice

    await runAction(
      () =>
        api.createInvoice({
          project_id: form.project_id ? Number(form.project_id) : null,
          client_id: form.client_id ? Number(form.client_id) : null,
          title: form.title,
          due_date: form.due_date || null,
          retention_percent: Number(form.retention_percent || 0),
          progress_percent: Number(form.progress_percent || 0),
          billing_stage: form.billing_stage || null,
          lines: [
            {
              description: form.line_description,
              cost_code: form.cost_code || null,
              quantity: Number(form.quantity || 1),
              unit: form.unit || 'each',
              unit_price: Number(form.unit_price || 0),
              tax_rate: Number(form.tax_rate || 0),
            },
          ],
        }),
      'Invoice created.',
    )
    setFinanceForms((current) => ({ ...current, invoice: { ...emptyFinanceForms.invoice, project_id: form.project_id, client_id: form.client_id } }))
  }

  async function recordPayment(event) {
    event.preventDefault()
    const form = financeForms.payment
    if (!form.invoice_id) {
      setError('Select an invoice before recording a payment.')
      return
    }

    await runAction(
      () =>
        api.recordPayment(form.invoice_id, {
          amount: Number(form.amount || 0),
          finance_bank_account_id: form.finance_bank_account_id ? Number(form.finance_bank_account_id) : null,
          method: form.method,
          reference: form.reference,
        }),
      'Payment recorded.',
    )
    setFinanceForms((current) => ({ ...current, payment: { ...emptyFinanceForms.payment, invoice_id: form.invoice_id } }))
  }

  async function createExpense(event) {
    event.preventDefault()
    const form = financeForms.expense

    await runAction(
      () =>
        api.createExpense({
          project_id: form.project_id ? Number(form.project_id) : null,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          description: form.description,
          category: form.category,
          cost_code: form.cost_code || null,
          amount: Number(form.amount || 0),
          tax_amount: Number(form.tax_amount || 0),
        }),
      'Expense submitted.',
    )
    setFinanceForms((current) => ({ ...current, expense: { ...emptyFinanceForms.expense, project_id: form.project_id, supplier_id: form.supplier_id } }))
  }

  async function createJournalEntry(event) {
    event.preventDefault()
    const form = financeForms.journal
    const debitAmount = Number(form.debit_amount || 0)
    const creditAmount = Number(form.credit_amount || debitAmount)

    await runAction(
      () =>
        api.createJournalEntry({
          entry_date: form.entry_date,
          reference: form.reference,
          description: form.description,
          status: 'posted',
          lines: [
            { account_code: form.debit_account_code, account_name: form.debit_account_name, debit: debitAmount, credit: 0 },
            { account_code: form.credit_account_code, account_name: form.credit_account_name, debit: 0, credit: creditAmount },
          ],
        }),
      'Journal entry posted.',
    )
    setFinanceForms((current) => ({ ...current, journal: { ...emptyFinanceForms.journal, entry_date: form.entry_date } }))
  }

  async function uploadFinanceWorkbook(event) {
    event.preventDefault()
    const form = financeForms.workbook

    if (!form.file) {
      setError('Choose a finance workbook before uploading.')
      return
    }

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    const result = await runAction(() => api.uploadFinanceWorkbook(formData), 'Finance workbook uploaded.')
    if (result) {
      setFinanceForms((current) => ({ ...current, workbook: emptyFinanceForms.workbook }))
      event.currentTarget.reset()
    }
  }

  async function createEmployee(event) {
    event.preventDefault()
    const form = peopleForms.employee
    if (!form.user_id) {
      setError('Select a user before creating an employee profile.')
      return
    }

    await runAction(
      () =>
        api.createEmployee({
          ...form,
          user_id: Number(form.user_id),
          branch_id: Number(form.branch_id || firstBranchId),
          manager_id: form.manager_id ? Number(form.manager_id) : null,
          current_project_id: form.current_project_id ? Number(form.current_project_id) : null,
          base_salary: Number(form.base_salary || 0),
          hourly_rate: Number(form.hourly_rate || 0),
          allowances: Number(form.allowances || 0),
          bonuses: Number(form.bonuses || 0),
          deductions: Number(form.deductions || 0),
        }),
      'Employee profile created.',
    )
    setPeopleForms((current) => ({ ...current, employee: { ...emptyPeopleForms.employee, branch_id: form.branch_id } }))
  }

  async function createLeaveRequest(event) {
    event.preventDefault()
    const form = peopleForms.leave
    if (!form.employee_profile_id) {
      setError('Select an employee before creating a leave request.')
      return
    }

    await runAction(
      () =>
        api.createLeaveRequest({
          employee_profile_id: Number(form.employee_profile_id),
          leave_type: form.leave_type,
          starts_on: form.starts_on,
          ends_on: form.ends_on,
          reason: form.reason,
        }),
      'Leave request created.',
    )
    setPeopleForms((current) => ({ ...current, leave: { ...emptyPeopleForms.leave, employee_profile_id: form.employee_profile_id } }))
  }

  async function createPayrollRun(event) {
    event.preventDefault()
    const form = peopleForms.payroll

    await runAction(
      () =>
        api.createPayrollRun({
          branch_id: form.branch_id ? Number(form.branch_id) : null,
          period_start: form.period_start,
          period_end: form.period_end,
        }),
      'Payroll run created.',
    )
  }

  async function createEquipmentAsset(event) {
    event.preventDefault()
    const form = equipmentForms.asset

    await runAction(
      () =>
        api.createEquipmentAsset({
          ...form,
          branch_id: Number(form.branch_id || firstBranchId),
          meter_reading: Number(form.meter_reading || 0),
          hourly_rate: Number(form.hourly_rate || 0),
        }),
      'Equipment asset created.',
    )
    setEquipmentForms((current) => ({ ...current, asset: { ...emptyEquipmentForms.asset, branch_id: form.branch_id } }))
  }

  async function assignEquipment(event) {
    event.preventDefault()
    const form = equipmentForms.assignment
    if (!form.asset_id || !form.project_id) {
      setError('Select both equipment and a project before assigning it.')
      return
    }

    await runAction(
      () =>
        api.assignEquipmentAsset(form.asset_id, {
          project_id: Number(form.project_id),
          meter_start: form.meter_start ? Number(form.meter_start) : null,
        }),
      'Equipment assigned.',
    )
    setEquipmentForms((current) => ({ ...current, assignment: { ...emptyEquipmentForms.assignment, project_id: form.project_id } }))
  }

  async function createMaintenanceLog(event) {
    event.preventDefault()
    const form = equipmentForms.maintenance
    if (!form.asset_id) {
      setError('Select equipment before creating a maintenance log.')
      return
    }

    await runAction(
      () =>
        api.createMaintenanceLog(form.asset_id, {
          status: form.status,
          service_date: form.service_date,
          meter_reading: form.meter_reading ? Number(form.meter_reading) : null,
          cost_amount: Number(form.cost_amount || 0),
          description: form.description,
        }),
      'Maintenance logged.',
    )
    setEquipmentForms((current) => ({ ...current, maintenance: { ...emptyEquipmentForms.maintenance, asset_id: form.asset_id } }))
  }

  async function createFuelLog(event) {
    event.preventDefault()
    const form = equipmentForms.fuel
    if (!form.asset_id) {
      setError('Select equipment before recording fuel usage.')
      return
    }

    await runAction(
      () =>
        api.createFuelLog(form.asset_id, {
          project_id: form.project_id ? Number(form.project_id) : null,
          quantity: Number(form.quantity || 0),
          unit_cost: Number(form.unit_cost || 0),
          meter_reading: form.meter_reading ? Number(form.meter_reading) : null,
        }),
      'Fuel log recorded.',
    )
    setEquipmentForms((current) => ({ ...current, fuel: { ...emptyEquipmentForms.fuel, asset_id: form.asset_id, project_id: form.project_id } }))
  }

  async function createInspection(event) {
    event.preventDefault()
    const form = complianceForms.inspection
    if (!form.project_id) {
      setError('Select a project before creating an inspection.')
      return
    }

    await runAction(
      () =>
        api.createInspection(form.project_id, {
          type: form.type,
          area: form.area,
          scheduled_on: form.scheduled_on || null,
          notes: form.notes,
          items: [
            { checklist_item: form.first_item, requirement: form.first_requirement, result: form.first_result, severity: form.first_severity },
            { checklist_item: form.second_item, requirement: form.second_requirement, result: form.second_result, severity: form.second_severity },
          ].filter((item) => item.checklist_item),
        }),
      'Inspection created.',
    )
    setComplianceForms((current) => ({ ...current, inspection: { ...emptyComplianceForms.inspection, project_id: form.project_id } }))
  }

  async function createNcr(event) {
    event.preventDefault()
    const form = complianceForms.ncr
    if (!form.project_id) {
      setError('Select a project before creating an NCR.')
      return
    }

    await runAction(
      () =>
        api.createNcr(form.project_id, {
          inspection_id: form.inspection_id ? Number(form.inspection_id) : null,
          title: form.title,
          department: form.department,
          category: form.category,
          location: form.location,
          contractor: form.contractor,
          subcontractor: form.subcontractor,
          description: form.description,
          reference_documents: csvList(form.reference_documents),
          evidence: csvList(form.evidence),
          root_cause: form.root_cause,
          corrective_action: form.corrective_action,
          preventive_action: form.preventive_action,
          severity: form.severity,
          due_date: form.due_date || null,
        }),
      'Non-Conformance Report(NCR) created.',
    )
    setComplianceForms((current) => ({ ...current, ncr: { ...emptyComplianceForms.ncr, project_id: form.project_id, inspection_id: form.inspection_id } }))
  }

  async function createSafetyIncident(event) {
    event.preventDefault()
    const form = complianceForms.incident

    await runAction(
      () =>
        api.createSafetyIncident({
          project_id: form.project_id ? Number(form.project_id) : null,
          incident_type: form.incident_type,
          location: form.location,
          occurred_at: form.occurred_at || null,
          injured_person: form.injured_person,
          description: form.description,
          immediate_action: form.immediate_action,
          severity: form.severity,
        }),
      'Safety incident logged.',
    )
    setComplianceForms((current) => ({ ...current, incident: { ...emptyComplianceForms.incident, project_id: form.project_id } }))
  }

  async function createToolboxTalk(event) {
    event.preventDefault()
    const form = complianceForms.talk

    await runAction(
      () =>
        api.createToolboxTalk({
          project_id: form.project_id ? Number(form.project_id) : null,
          topic: form.topic,
          talk_date: form.talk_date || null,
          attendee_count: Number(form.attendee_count || 0),
          summary: form.summary,
          hazards_discussed: csvList(form.hazards_discussed),
        }),
      'Toolbox talk recorded.',
    )
    setComplianceForms((current) => ({ ...current, talk: { ...emptyComplianceForms.talk, project_id: form.project_id } }))
  }

  async function createSafetyObservation(event) {
    event.preventDefault()
    const form = complianceForms.observation

    await runAction(
      () =>
        api.createSafetyObservation({
          project_id: form.project_id ? Number(form.project_id) : null,
          observation_type: form.observation_type,
          severity: form.severity,
          location: form.location,
          description: form.description,
          corrective_action: form.corrective_action,
        }),
      'Safety observation logged.',
    )
    setComplianceForms((current) => ({ ...current, observation: { ...emptyComplianceForms.observation, project_id: form.project_id } }))
  }

  async function createWorkPermit(event) {
    event.preventDefault()
    const form = complianceForms.permit

    await runAction(
      () =>
        api.createWorkPermit({
          project_id: form.project_id ? Number(form.project_id) : null,
          permit_type: form.permit_type,
          location: form.location,
          valid_from: form.valid_from || null,
          valid_until: form.valid_until || null,
          hazards: form.hazards,
          controls: form.controls,
        }),
      'Permit submitted.',
    )
    setComplianceForms((current) => ({ ...current, permit: { ...emptyComplianceForms.permit, project_id: form.project_id } }))
  }

  async function createPortalUser(event) {
    event.preventDefault()
    const form = portalForms.user

    await runAction(
      () =>
        api.createPortalUser({
          client_id: form.client_id ? Number(form.client_id) : null,
          user_type: form.user_type,
          name: form.name,
          email: form.email,
          organization: form.organization,
        }),
      'Portal user created.',
    )
    setPortalForms((current) => ({ ...current, user: { ...emptyPortalForms.user, user_type: form.user_type, client_id: form.client_id } }))
  }

  async function grantPortalAccess(event) {
    event.preventDefault()
    const form = portalForms.access
    if (!form.portal_user_id || !form.project_id) {
      setError('Select both a portal user and a project before granting access.')
      return
    }

    await runAction(
      () =>
        api.grantPortalAccess(form.portal_user_id, {
          project_id: Number(form.project_id),
          access_level: form.access_level,
          access_scope: form.access_scope,
        }),
      'Portal access granted.',
    )
    setPortalForms((current) => ({ ...current, access: { ...emptyPortalForms.access, portal_user_id: form.portal_user_id, project_id: form.project_id } }))
  }

  async function createClientApproval(event) {
    event.preventDefault()
    const form = portalForms.clientApproval
    if (!form.project_id) {
      setError('Select a project before creating a client approval.')
      return
    }

    await runAction(
      () =>
        api.createClientApproval(form.project_id, {
          portal_user_id: form.portal_user_id ? Number(form.portal_user_id) : null,
          drawing_id: form.drawing_id ? Number(form.drawing_id) : null,
          document_id: form.document_id ? Number(form.document_id) : null,
          title: form.title,
        }),
      'Client approval requested.',
    )
    setPortalForms((current) => ({ ...current, clientApproval: { ...emptyPortalForms.clientApproval, project_id: form.project_id, portal_user_id: form.portal_user_id } }))
  }

  async function createConsultantSubmittal(event) {
    event.preventDefault()
    const form = portalForms.submittal
    if (!form.project_id) {
      setError('Select a project before creating a consultant submittal.')
      return
    }

    await runAction(
      () =>
        api.createConsultantSubmittal(form.project_id, {
          portal_user_id: form.portal_user_id ? Number(form.portal_user_id) : null,
          drawing_id: form.drawing_id ? Number(form.drawing_id) : null,
          document_id: form.document_id ? Number(form.document_id) : null,
          title: form.title,
          discipline: form.discipline,
        }),
      'Consultant submittal created.',
    )
    setPortalForms((current) => ({ ...current, submittal: { ...emptyPortalForms.submittal, project_id: form.project_id, portal_user_id: form.portal_user_id } }))
  }

  async function createPortalWorkItem(event) {
    event.preventDefault()
    const form = portalForms.workItem
    if (!form.project_id) {
      setError('Select a project before creating a portal work item.')
      return
    }

    await runAction(
      () =>
        api.createPortalWorkItem(form.project_id, {
          portal_user_id: form.portal_user_id ? Number(form.portal_user_id) : null,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          portal_type: form.portal_type,
          item_type: form.item_type,
          title: form.title,
          description: form.description,
          priority: form.priority,
          due_date: form.due_date || null,
        }),
      'Portal work item created.',
    )
    setPortalForms((current) => ({ ...current, workItem: { ...emptyPortalForms.workItem, project_id: form.project_id, portal_type: form.portal_type, portal_user_id: form.portal_user_id } }))
  }

  async function createBiDashboard(event) {
    event.preventDefault()
    const form = phaseFourForms.dashboard

    await runAction(
      () =>
        api.createBiDashboard({
          name: form.name,
          audience: form.audience,
          refresh_interval: form.refresh_interval,
          is_default: form.is_default === 'true',
        }),
      'BI dashboard created.',
    )
    setPhaseFourForms((current) => ({ ...current, dashboard: { ...emptyPhaseFourForms.dashboard, audience: form.audience } }))
  }

  async function createMetricSnapshot() {
    await runAction(
      () => api.createMetricSnapshot({ period_label: new Date().toISOString().slice(0, 7) }),
      'Metric snapshot created.',
    )
  }

  async function createAutomationRule(event) {
    event.preventDefault()
    const form = phaseFourForms.automation

    await runAction(
      () =>
        api.createAutomationRule(automationPayloadFromForm(form)),
      'Automation rule created.',
    )
    setPhaseFourForms((current) => ({
      ...current,
      automation: {
        ...emptyPhaseFourForms.automation,
        module: form.module,
        rule_type: form.rule_type,
        trigger_event: form.trigger_event,
        schedule_frequency: form.schedule_frequency,
      },
    }))
  }

  async function createPlatformCompany(event) {
    event?.preventDefault?.()
    const form = platformForms.company
    const payload = {
      ...form,
      subscription_plan_id: form.subscription_plan_id ? Number(form.subscription_plan_id) : null,
      trial_days: Number(form.trial_days || 0),
      storage_limit_mb: form.storage_limit_mb ? Number(form.storage_limit_mb) : null,
      employee_limit: form.employee_limit ? Number(form.employee_limit) : null,
      project_limit: form.project_limit ? Number(form.project_limit) : null,
      branch_limit: form.branch_limit ? Number(form.branch_limit) : null,
      admin_password: form.admin_password || null,
      enabled_feature_keys: Array.isArray(form.enabled_feature_keys) ? form.enabled_feature_keys : [],
      branding: {
        primary_color: platformForms.branding.primary_color,
        secondary_color: platformForms.branding.secondary_color,
        accent_color: platformForms.branding.accent_color,
        sidebar_color: platformForms.branding.sidebar_color,
        button_color: platformForms.branding.button_color,
        typography: platformForms.branding.typography,
        login_welcome_message: platformForms.branding.login_welcome_message,
        company_motto: platformForms.branding.company_motto,
      },
    }

    const result = await runAction(() => api.createPlatformCompany(payload), 'Company provisioned.')
    if (result) {
      setPlatformForms((current) => ({ ...current, company: emptyPlatformForms.company }))
    }

    return result
  }

  async function savePlatformCompanyAccount(event) {
    event.preventDefault()
    const form = platformForms.company_account
    if (!form.company_id) {
      setError('Select a company before saving account details.')
      return
    }

    await runAction(
      () =>
        api.updatePlatformCompany(form.company_id, {
          name: form.name,
          registration_number: form.registration_number || null,
          industry: form.industry || null,
          country: form.country,
          city: form.city || null,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          tax_id: form.tax_id || null,
          currency: form.currency,
          timezone: form.timezone || null,
          language: form.language || null,
          date_format: form.date_format || null,
          fiscal_year_start: form.fiscal_year_start || null,
          status: form.status,
          storage_limit_mb: form.storage_limit_mb === '' ? null : Number(form.storage_limit_mb),
          employee_limit: form.employee_limit === '' ? null : Number(form.employee_limit),
          project_limit: form.project_limit === '' ? null : Number(form.project_limit),
          branch_limit: form.branch_limit === '' ? null : Number(form.branch_limit),
          subscription_plan_id: form.subscription_plan_id ? Number(form.subscription_plan_id) : null,
        }),
      'Company account updated.',
    )
  }

  async function archivePlatformCompany(company) {
    if (!window.confirm(`Archive ${company.name}? Their users will be signed out, but the account can be restored later.`)) {
      return
    }

    await runAction(() => api.archivePlatformCompany(company.id), 'Company archived.')
    setPlatformForms((current) => ({ ...current, company_account: emptyPlatformForms.company_account }))
  }

  async function restorePlatformCompany(company) {
    await runAction(() => api.restorePlatformCompany(company.id), 'Company restored.')
  }

  async function deleteArchivedPlatformCompany(company) {
    if (!window.confirm(`Permanently delete ${company.name}? This cannot be undone and will remove the account, users, subscriptions, and tenant files.`)) {
      return
    }

    await runAction(() => api.deleteArchivedPlatformCompany(company.id), 'Company permanently deleted.')
  }

  async function searchPlatformAdmin(query) {
    const data = await api.platformAdmin(query ? { q: query } : {})
    setPlatformAdmin(data)
  }

  async function createPlatformPlan(event) {
    event.preventDefault()
    const form = platformForms.plan
    const payload = {
      ...form,
      monthly_price: Number(form.monthly_price || 0),
      yearly_price: Number(form.yearly_price || 0),
      maximum_users: form.maximum_users ? Number(form.maximum_users) : null,
      maximum_projects: form.maximum_projects ? Number(form.maximum_projects) : null,
      maximum_storage_mb: form.maximum_storage_mb ? Number(form.maximum_storage_mb) : null,
      api_access: form.api_access === 'true',
      custom_branding: form.custom_branding === 'true',
      sso_available: form.sso_available === 'true',
    }
    delete payload.id

    await runAction(
      () =>
        form.id ? api.updatePlatformPlan(form.id, payload) : api.createPlatformPlan(payload),
      form.id ? 'Plan updated.' : 'Plan created.',
    )
    setPlatformForms((current) => ({ ...current, plan: emptyPlatformForms.plan }))
  }

  async function deletePlatformPlan(plan) {
    if (!window.confirm(`Delete ${plan.name}? Plans with subscription history will be archived and hidden from new sales.`)) {
      return
    }

    await runAction(() => api.deletePlatformPlan(plan.id), 'Plan deleted.')
    setPlatformForms((current) => ({ ...current, plan: String(current.plan.id) === String(plan.id) ? emptyPlatformForms.plan : current.plan }))
  }

  async function savePlatformSubscription(event) {
    event.preventDefault()
    const form = platformForms.subscription
    if (!form.id) {
      setError('Select a subscription before saving.')
      return
    }

    await runAction(
      () =>
        api.updatePlatformSubscription(form.id, {
          platform_subscription_plan_id: form.platform_subscription_plan_id ? Number(form.platform_subscription_plan_id) : null,
          status: form.status,
          billing_interval: form.billing_interval,
          amount: form.amount === '' ? null : Number(form.amount),
          currency: form.currency || null,
          seats: form.seats === '' ? null : Number(form.seats),
          renewal_at: form.renewal_at || null,
        }),
      'Subscription updated.',
    )
  }

  async function upgradePlatformSubscription(event) {
    event.preventDefault()
    const form = platformForms.subscription
    if (!form.id || !form.platform_subscription_plan_id) {
      setError('Select a subscription and target plan before upgrading.')
      return
    }

    await runAction(
      () =>
        api.upgradePlatformSubscription(form.id, {
          platform_subscription_plan_id: Number(form.platform_subscription_plan_id),
          billing_interval: form.billing_interval === 'yearly' ? 'yearly' : 'monthly',
          amount: form.amount === '' ? null : Number(form.amount),
          seats: form.seats === '' ? null : Number(form.seats),
          renewal_at: form.renewal_at || null,
        }),
      'Subscription upgraded.',
    )
  }

  async function deletePlatformSubscription(subscription) {
    if (!window.confirm(`Delete ${subscription.company?.name || 'this company'} subscription? The subscription will be cancelled and removed from the active list.`)) {
      return
    }

    await runAction(() => api.deletePlatformSubscription(subscription.id), 'Subscription deleted.')
    setPlatformForms((current) => ({ ...current, subscription: String(current.subscription.id) === String(subscription.id) ? emptyPlatformForms.subscription : current.subscription }))
  }

  async function savePlatformFeature(event) {
    event.preventDefault()
    const form = platformForms.feature
    if (!form.id) {
      setError('Select a feature release before saving.')
      return
    }

    await runAction(
      () =>
        api.updatePlatformFeature(form.id, {
          name: form.name,
          module: form.module,
          category: form.category,
          description: form.description || null,
          rollout_status: form.rollout_status,
          rollout_percentage: Number(form.rollout_percentage || 0),
          default_enabled: form.default_enabled === 'true',
          requires_subscription: form.requires_subscription === 'true',
          pricing_tier: form.pricing_tier || null,
        }),
      'Feature release updated.',
    )
  }

  async function savePlatformBranding(event) {
    event.preventDefault()
    const form = platformForms.branding
    if (!form.company_id) {
      setError('Select a company before saving branding.')
      return
    }

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (key !== 'company_id' && value !== undefined && value !== null) {
        formData.append(key, value)
      }
    })

    await runAction(() => api.updatePlatformBranding(form.company_id, formData), 'Branding updated.')
  }

  async function savePlatformSuccess(event) {
    event.preventDefault()
    const form = platformForms.success
    if (!form.company_id) {
      setError('Select a company before saving customer success.')
      return
    }

    await runAction(
      () =>
        api.updatePlatformCompanySuccess(form.company_id, {
          success_manager: form.success_manager,
          last_meeting_at: form.last_meeting_at || null,
          next_meeting_at: form.next_meeting_at || null,
          training_completed_percent: form.training_completed_percent === '' ? null : Number(form.training_completed_percent),
          adoption_percent: form.adoption_percent === '' ? null : Number(form.adoption_percent),
          risk_percent: form.risk_percent === '' ? null : Number(form.risk_percent),
          expansion_opportunity: form.expansion_opportunity,
          notes: form.notes,
        }),
      'Customer success updated.',
    )
  }

  async function savePlatformStaffUser(event) {
    event.preventDefault()
    const form = platformForms.staff
    const permissions = normalizePermissionList(form.permissions).length > 0 ? normalizePermissionList(form.permissions) : ['platform.manage']
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      job_title: form.job_title || null,
      status: form.status || 'active',
      permissions,
    }

    if (form.password) {
      payload.password = form.password
    }

    const action = form.id
      ? () => api.updatePlatformStaffUser(form.id, payload)
      : () => api.createPlatformStaffUser({ ...payload, password: form.password })

    await runAction(action, form.id ? 'Cloud Console user updated.' : 'Cloud Console user created.')
    setPlatformForms((current) => ({ ...current, staff: emptyPlatformForms.staff }))
  }

  async function deletePlatformStaffUser(item) {
    if (!window.confirm(`Delete ${item.name}? This removes their Navkwa Build Cloud Console access.`)) {
      return
    }

    await runAction(() => api.deletePlatformStaffUser(item.id), 'Cloud Console user deleted.')
    setPlatformForms((current) => String(current.staff.id) === String(item.id) ? { ...current, staff: emptyPlatformForms.staff } : current)
  }

  async function savePlatformProfile(event) {
    event.preventDefault()
    const form = platformForms.profile
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      job_title: form.job_title || null,
    }

    if (form.current_password) {
      payload.current_password = form.current_password
    }
    if (form.password) {
      payload.password = form.password
      payload.password_confirmation = form.password_confirmation
    }

    const result = await runAction(() => api.updatePlatformProfile(payload), 'Login details updated.', { skipRefresh: true })
    if (result?.user) {
      setUser(result.user)
      setPlatformForms((current) => ({
        ...current,
        profile: {
          user_id: String(result.user.id),
          name: result.user.name || '',
          email: result.user.email || '',
          phone: result.user.phone || '',
          job_title: result.user.job_title || '',
          current_password: '',
          password: '',
          password_confirmation: '',
        },
      }))
      await refreshWorkspace({ force: true })
    }
  }

  async function startMfaSetup(event) {
    event.preventDefault()
    const result = await runAction(
      () => api.setupMfa({ current_password: securityForms.current_password }),
      'Multi-factor setup started.',
      { skipRefresh: true },
    )

    if (result?.security) {
      setAccountSecurity(result.security)
      setMfaSetup(result.setup || null)
      setSecurityForms(emptySecurityForms)
    } else {
      setSecurityForms(emptySecurityForms)
    }
  }

  async function changeOwnPassword(event) {
    event.preventDefault()
    const result = await runAction(
      () =>
        api.changePassword({
          current_password: securityForms.current_password,
          password: securityForms.password,
          password_confirmation: securityForms.password_confirmation,
        }),
      'Password changed.',
      { skipRefresh: true },
    )

    if (result?.user) {
      setUser(result.user)
      setSecurityForms(emptySecurityForms)
      await refreshWorkspace({ force: true })
    } else {
      setSecurityForms(emptySecurityForms)
    }
  }

  async function enableMfa(event) {
    event.preventDefault()
    const result = await runAction(
      () =>
        api.enableMfa({
          current_password: securityForms.current_password,
          mfa_code: securityForms.mfa_code,
        }),
      'Multi-factor authentication enabled.',
      { skipRefresh: true },
    )

    if (result?.security) {
      setAccountSecurity(result.security)
      setMfaSetup((current) => (current ? { ...current, enabled: true } : null))
      setSecurityForms(emptySecurityForms)
    } else {
      setSecurityForms(emptySecurityForms)
    }
  }

  async function disableMfa(event) {
    event.preventDefault()
    if (!window.confirm('Disable multi-factor authentication for your account?')) {
      return
    }

    const result = await runAction(
      () =>
        api.disableMfa({
          current_password: securityForms.current_password,
          mfa_code: securityForms.mfa_code || null,
          recovery_code: securityForms.recovery_code || null,
        }),
      'Multi-factor authentication disabled.',
      { skipRefresh: true },
    )

    if (result?.security) {
      setAccountSecurity(result.security)
      setMfaSetup(null)
      setSecurityForms(emptySecurityForms)
    } else {
      setSecurityForms(emptySecurityForms)
    }
  }

  async function regenerateMfaRecoveryCodes(event) {
    event.preventDefault()
    const result = await runAction(
      () =>
        api.regenerateMfaRecoveryCodes({
          current_password: securityForms.current_password,
          mfa_code: securityForms.mfa_code,
        }),
      'Recovery codes regenerated.',
      { skipRefresh: true },
    )

    if (result?.security) {
      setAccountSecurity(result.security)
      setMfaSetup({ recovery_codes: result.recovery_codes || [] })
      setSecurityForms(emptySecurityForms)
    } else {
      setSecurityForms(emptySecurityForms)
    }
  }

  async function createPlatformBillingRecord(event) {
    event.preventDefault()
    const form = platformForms.billing
    await runAction(
      () =>
        api.createPlatformBillingRecord({
          ...form,
          company_id: Number(form.company_id),
          company_subscription_id: form.company_subscription_id ? Number(form.company_subscription_id) : null,
          amount: Number(form.amount || 0),
          paid_at: form.paid_at || null,
        }),
      'Billing record created.',
    )
    setPlatformForms((current) => ({ ...current, billing: { ...emptyPlatformForms.billing, company_id: form.company_id } }))
  }

  async function createPlatformSupportTicket(event) {
    event.preventDefault()
    const form = platformForms.support
    await runAction(
      () =>
        api.createPlatformSupportTicket({
          ...form,
          company_id: form.company_id ? Number(form.company_id) : null,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          sla_due_at: form.sla_due_at || null,
        }),
      'Support ticket created.',
    )
    setPlatformForms((current) => ({ ...current, support: { ...emptyPlatformForms.support, company_id: form.company_id } }))
  }

  async function updatePlatformSupportTicket(event) {
    event.preventDefault()
    const form = platformForms.support_update
    if (!form.id) {
      setError('Select a support ticket before saving.')
      return
    }

    await runAction(
      () =>
        api.updatePlatformSupportTicket(form.id, {
          status: form.status,
          priority: form.priority,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          resolution_notes: form.resolution_notes || null,
        }),
      'Support ticket updated.',
    )
  }

  async function createPlatformDeployment(event) {
    event.preventDefault()
    const form = platformForms.deployment
    await runAction(
      () => api.createPlatformDeployment({ ...form, scheduled_at: form.scheduled_at || null }),
      'Deployment created.',
    )
    setPlatformForms((current) => ({ ...current, deployment: emptyPlatformForms.deployment }))
  }

  async function createPlatformBackup(event) {
    event.preventDefault()
    const form = platformForms.backup
    await runAction(
      () => api.createPlatformBackup({ ...form, company_id: form.company_id ? Number(form.company_id) : null }),
      'Backup queued.',
    )
  }

  async function updatePlatformSettings(event) {
    event.preventDefault()
    const monitoringKeys = ['database_warning_ms', 'database_critical_ms', 'queue_pending_warning', 'failed_jobs_critical', 'storage_warning_percent', 'storage_critical_percent', 'security_alert_critical', 'server_count', 'servers_online']
    const monitoring = monitoringKeys.reduce((payload, key) => ({
      ...payload,
      [key]: platformForms.settings[key] === '' ? null : Number(platformForms.settings[key]),
    }), { enabled: true })

    await runAction(
      () =>
        api.updatePlatformSettings({
          settings: {
            monitoring,
            ai: {
              enabled: platformForms.settings.ai_enabled === 'true',
              usage_percent: platformForms.settings.ai_usage_percent === '' ? null : Number(platformForms.settings.ai_usage_percent),
              monthly_token_limit: platformForms.settings.ai_monthly_token_limit === '' ? null : Number(platformForms.settings.ai_monthly_token_limit),
              monthly_budget: platformForms.settings.ai_monthly_budget === '' ? null : Number(platformForms.settings.ai_monthly_budget),
              cost_month_to_date: platformForms.settings.ai_cost_month_to_date === '' ? null : Number(platformForms.settings.ai_cost_month_to_date),
            },
          },
        }),
      'Platform settings updated.',
    )
  }

  async function startPlatformImpersonation(event) {
    event.preventDefault()
    const form = platformForms.impersonation
    await runAction(
      () =>
        api.startPlatformImpersonation(form.company_id, {
          user_id: Number(form.user_id),
          reason: form.reason,
          authorization_reference: form.authorization_reference,
          expires_minutes: Number(form.expires_minutes || 30),
        }),
      'Impersonation token created.',
    )
    setPlatformForms((current) => ({ ...current, impersonation: { ...emptyPlatformForms.impersonation, company_id: form.company_id } }))
  }

  async function uploadDocument(event) {
    event.preventDefault()

    const formData = new FormData()
    Object.entries(documentForm).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    if (!formData.get('branch_id') && user?.branch?.id) formData.append('branch_id', user.branch.id)

    await runAction(() => api.uploadDocument(formData), 'Document uploaded.')
    setDocumentForm({})
    event.target.reset()
  }

  async function uploadDrawing(event) {
    event.preventDefault()

    const formData = new FormData()
    Object.entries(drawingForm).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    if (!formData.get('branch_id') && user?.branch?.id) formData.append('branch_id', user.branch.id)

    await runAction(() => api.uploadDrawing(formData), 'Drawing uploaded.')
    setDrawingForm({})
    event.target.reset()
  }

  async function reviseDrawing(event) {
    event.preventDefault()
    if (!revisionForm.drawing_id) return

    const formData = new FormData()
    Object.entries(revisionForm).forEach(([key, value]) => {
      if (key !== 'drawing_id' && value !== undefined && value !== null && value !== '') {
        formData.append(key, value)
      }
    })

    await runAction(() => api.reviseDrawing(revisionForm.drawing_id, formData), 'Drawing revision issued.')
    setRevisionForm({ drawing_id: '', revision_code: '', notes: '' })
    event.target.reset()
  }

  const selectedProjectRequisitions = useMemo(
    () => requisitions.filter((item) => item.project_id === selectedProject?.id),
    [requisitions, selectedProject],
  )

  const selectedProjectOrders = useMemo(
    () => purchaseOrders.filter((item) => item.project_id === selectedProject?.id),
    [purchaseOrders, selectedProject],
  )

  if (!tokenReady) {
    return (
      <AuthScreen
        brandName={cloudConsolePortal ? 'Navkwa Build Cloud Console' : 'Navkwa Build'}
        authForm={authForm}
        setAuthForm={setAuthForm}
        handleAuth={handleAuth}
        mfaChallenge={mfaChallenge}
        resetMfaChallenge={resetMfaChallenge}
        loading={loading}
        error={error}
      />
    )
  }

  const activeTitle = activeView === 'compliance'
    ? 'Quality Assurance and Health, Safety, and Environment'
    : activeView === 'account'
      ? 'Account Security'
    : activeView === 'crm'
      ? 'Customer Relation Management(CRM)'
      : activeView === 'platform'
        ? 'Navkwa Build Cloud Console'
        : navItems.find((item) => item.id === activeView)?.label || 'Workspace'
  const cloudConsoleLayers = platformAdmin.catalog?.console_layers || []
  const sidebarLayerIconMap = { platform: BarChart3, customers: Building2, product: Layers3, security: ShieldCheck, engineering: Workflow }
  const sidebarTabIconMap = {
    executive: BarChart3,
    'operations-center': BarChart3,
    reports: ClipboardList,
    companies: Building2,
    subscriptions: WalletCards,
    'customer-success': Handshake,
    support: AlertTriangle,
    billing: WalletCards,
    payments: WalletCards,
    features: Layers3,
    deployment: Upload,
    marketplace: Package,
    ai: BarChart3,
    localization: Globe2,
    security: ShieldCheck,
    audit: Clock3,
    backups: Download,
    data: FileText,
    identity: Globe2,
    roles: ShieldCheck,
    users: Users,
    monitoring: BarChart3,
    automation: Workflow,
    integrations: Layers3,
    developer: Workflow,
    notifications: Send,
    usage: BarChart3,
    licenses: CheckCircle2,
    settings: Settings,
  }

  function toggleCloudConsoleLayer(layer) {
    setActiveView('platform')
    if (cloudConsoleLayer !== layer.id) {
      setCloudConsoleLayer(layer.id)
      setCloudConsoleTab(layer.primary_tab || layer.items?.[0]?.id || 'executive')
    }
    setExpandedCloudConsoleLayers((current) => {
      const next = new Set(current)
      if (next.has(layer.id)) next.delete(layer.id)
      else next.add(layer.id)
      return next
    })
  }

  function openCloudConsoleTab(layer, item) {
    setActiveView('platform')
    setCloudConsoleLayer(layer.id)
    setCloudConsoleTab(item.id)
    setExpandedCloudConsoleLayers((current) => {
      const next = new Set(current)
      next.add(layer.id)
      return next
    })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">N</div>
          <div>
            <strong>Navkwa Build</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {allowedNavItems.map((item) => {
            const Icon = item.icon
            const isCloudConsoleItem = item.id === 'platform'
            return (
              <div key={item.id} className={`nav-item-shell ${isCloudConsoleItem ? 'cloud-console-nav-shell' : ''}`}>
                <button
                  type="button"
                  className={activeView === item.id ? 'active' : ''}
                  onClick={() => setActiveView(item.id)}
                  title={item.label}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>

                {isCloudConsoleItem && activeView === 'platform' && cloudConsoleLayers.length > 0 && (
                  <div className="sidebar-cloud-nav" aria-label="Cloud Console sections">
                    {cloudConsoleLayers.map((layer) => {
                      const LayerIcon = sidebarLayerIconMap[layer.id] || BarChart3
                      const expanded = expandedCloudConsoleLayers.has(layer.id)
                      return (
                        <div key={layer.id} className={`sidebar-cloud-nav-group ${expanded ? 'expanded' : ''}`}>
                          <button
                            type="button"
                            className={`sidebar-cloud-nav-trigger ${cloudConsoleLayer === layer.id ? 'active' : ''}`}
                            onClick={() => toggleCloudConsoleLayer(layer)}
                            aria-expanded={expanded}
                          >
                            <LayerIcon size={16} />
                            <span>{layer.label}</span>
                            <ChevronRight className="sidebar-cloud-nav-arrow" size={15} />
                          </button>

                          {expanded && (
                            <div className="sidebar-cloud-nav-children">
                              {(layer.items || []).map((child) => {
                                const ChildIcon = sidebarTabIconMap[child.id] || BarChart3
                                return (
                                  <button
                                    key={child.id}
                                    type="button"
                                    className={`sidebar-cloud-nav-child ${cloudConsoleLayer === layer.id && cloudConsoleTab === child.id ? 'active' : ''}`}
                                    onClick={() => openCloudConsoleTab(layer, child)}
                                  >
                                    <ChildIcon size={14} />
                                    <span>{child.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            <span>{initials(user?.name)}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>{roleLabel(user?.role)}</small>
            </div>
          </div>
          <div className="powered-by">Powered by Navkwa Group Ltd</div>
        </div>
      </aside>

      <main className="workspace">
        <header className={`topbar ${activeView === 'platform' ? 'cloud-app-topbar' : ''}`}>
          <div className="topbar-title">
            <h1>{activeTitle}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={activeTheme} onToggle={toggleThemePreference} disabled={loading} />
            <button type="button" className="icon-button" onClick={refreshWorkspace} title="Refresh">
              <RefreshCcw size={17} />
            </button>
            <button type="button" className="icon-button" onClick={handleLogout} title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {error && (
          <div className="workspace-feedback error" role="alert" aria-live="assertive">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
        {!error && notice && (
          <div className="workspace-feedback success" role="status" aria-live="polite">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}

        {activeView === 'platform' && (
          <PlatformAdminView
            currentUser={user}
            platform={platformAdmin}
            error={error}
            accountSecurity={accountSecurity}
            mfaSetup={mfaSetup}
            forms={platformForms}
            securityForms={securityForms}
            setPlatformForm={setPlatformForm}
            setSecurityForm={setForm(setSecurityForms)}
            setPlatformForms={setPlatformForms}
            createCompany={createPlatformCompany}
            saveCompanyAccount={savePlatformCompanyAccount}
            archiveCompany={archivePlatformCompany}
            restoreCompany={restorePlatformCompany}
            deleteArchivedCompany={deleteArchivedPlatformCompany}
            activeTab={cloudConsoleTab}
            setActiveLayer={setCloudConsoleLayer}
            setActiveTab={setCloudConsoleTab}
            createPlan={createPlatformPlan}
            deletePlan={deletePlatformPlan}
            saveSubscription={savePlatformSubscription}
            upgradeSubscription={upgradePlatformSubscription}
            deleteSubscription={deletePlatformSubscription}
            saveFeature={savePlatformFeature}
            saveBranding={savePlatformBranding}
            saveSuccess={savePlatformSuccess}
            saveStaffUser={savePlatformStaffUser}
            deleteStaffUser={deletePlatformStaffUser}
            saveProfile={savePlatformProfile}
            startMfaSetup={startMfaSetup}
            changePassword={changeOwnPassword}
            enableMfa={enableMfa}
            disableMfa={disableMfa}
            regenerateMfaRecoveryCodes={regenerateMfaRecoveryCodes}
            createBillingRecord={createPlatformBillingRecord}
            createSupportTicket={createPlatformSupportTicket}
            updateSupportTicket={updatePlatformSupportTicket}
            createDeployment={createPlatformDeployment}
            createBackup={createPlatformBackup}
            updateSettings={updatePlatformSettings}
            startImpersonation={startPlatformImpersonation}
            searchPlatform={searchPlatformAdmin}
            runAction={runAction}
          />
        )}
        {activeView === 'dashboard' && <DashboardView dashboard={dashboard} projects={projects} />}
        {activeView === 'crm' && (
          <CrmView
            branches={branches}
            sales={sales}
            leadForm={leadForm}
            setLeadForm={setLeadForm}
            createLead={createLead}
            runAction={runAction}
          />
        )}
        {activeView === 'tendering' && (
          <TenderingView
            branches={branches}
            clients={clients}
            users={users}
            sales={sales}
            tenderForm={tenderForm}
            setTenderForm={setTenderForm}
            createTender={createTender}
            runAction={runAction}
          />
        )}
        {activeView === 'estimating' && (
          <EstimatingView
            sales={sales}
            estimateForm={estimateForm}
            setEstimateForm={setEstimateForm}
            createEstimate={createEstimate}
            runAction={runAction}
          />
        )}
        {activeView === 'projects' && (
          <ProjectsView
            branches={branches}
            clients={clients}
            users={users}
            projects={projects}
            selectedProject={selectedProject}
            setSelectedProjectId={setSelectedProjectId}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            taskForm={taskForm}
            setTaskForm={setTaskForm}
            budgetForm={budgetForm}
            setBudgetForm={setBudgetForm}
            createProject={createProject}
            projectSubmitting={projectSubmitting}
            reportError={setError}
            createTask={createTask}
            createBudgetLine={createBudgetLine}
            currentUser={user}
            runAction={runAction}
          />
        )}
        {activeView === 'procurement' && (
          <ProcurementView
            selectedProject={selectedProject}
            projects={projects}
            suppliers={suppliers}
            procurement={procurement}
            requisitions={requisitions}
            purchaseOrders={purchaseOrders}
            selectedProjectRequisitions={selectedProjectRequisitions}
            selectedProjectOrders={selectedProjectOrders}
            runAction={runAction}
          />
        )}
        {activeView === 'inventory' && (
          <InventoryView
            branches={branches}
            suppliers={suppliers}
            inventory={inventory}
            forms={inventoryForms}
            setInventoryForm={setInventoryForm}
            setInventoryForms={setInventoryForms}
            createWarehouse={createWarehouse}
            createInventoryItem={createInventoryItem}
            createStockMovement={createStockMovement}
            createSupplierPrice={createSupplierPrice}
            createSupplierReview={createSupplierReview}
            runAction={runAction}
          />
        )}
        {activeView === 'field' && (
          <FieldOpsView
            projects={projects}
            fieldOps={fieldOps}
            forms={fieldForms}
            setFieldForm={setFieldForm}
            setFieldForms={setFieldForms}
            createDailyReport={createDailyReport}
            createFieldIssue={createFieldIssue}
            clockIn={clockIn}
            clockOut={clockOut}
            runAction={runAction}
          />
        )}
        {activeView === 'finance' && (
          <FinanceView
            branches={branches}
            projects={projects}
            clients={clients}
            suppliers={suppliers}
            finance={finance}
            forms={financeForms}
            setFinanceForm={setFinanceForm}
            setFinanceForms={setFinanceForms}
            createInvoice={createInvoice}
            recordPayment={recordPayment}
            createExpense={createExpense}
            createJournalEntry={createJournalEntry}
            uploadFinanceWorkbook={uploadFinanceWorkbook}
            runAction={runAction}
          />
        )}
        {activeView === 'people' && (
          <PeopleView
            branches={branches}
            projects={projects}
            suppliers={suppliers}
            users={users}
            roles={roles}
            currentUser={user}
            people={people}
            forms={peopleForms}
            setPeopleForm={setPeopleForm}
            setPeopleForms={setPeopleForms}
            createEmployee={createEmployee}
            createLeaveRequest={createLeaveRequest}
            createPayrollRun={createPayrollRun}
            runAction={runAction}
          />
        )}
        {activeView === 'equipment' && (
          <EquipmentView
            branches={branches}
            projects={projects}
            equipment={equipment}
            forms={equipmentForms}
            setEquipmentForm={setEquipmentForm}
            createEquipmentAsset={createEquipmentAsset}
            assignEquipment={assignEquipment}
            createMaintenanceLog={createMaintenanceLog}
            createFuelLog={createFuelLog}
            runAction={runAction}
          />
        )}
        {activeView === 'compliance' && (
          <ComplianceView
            projects={projects}
            compliance={compliance}
            forms={complianceForms}
            setComplianceForm={setComplianceForm}
            createInspection={createInspection}
            createNcr={createNcr}
            createSafetyIncident={createSafetyIncident}
            createToolboxTalk={createToolboxTalk}
            createSafetyObservation={createSafetyObservation}
            createWorkPermit={createWorkPermit}
            runAction={runAction}
          />
        )}
        {activeView === 'portals' && (
          <PortalsView
            projects={projects}
            clients={clients}
            suppliers={suppliers}
            drawings={drawings}
            documents={documents}
            portals={portals}
            forms={portalForms}
            setPortalForm={setPortalForm}
            createPortalUser={createPortalUser}
            grantPortalAccess={grantPortalAccess}
            createClientApproval={createClientApproval}
            createConsultantSubmittal={createConsultantSubmittal}
            createPortalWorkItem={createPortalWorkItem}
            runAction={runAction}
          />
        )}
        {activeView === 'documents' && (
          <DocumentsView
            branches={branches}
            projects={projects}
            drawings={drawings}
            documents={documents}
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            drawingForm={drawingForm}
            setDrawingForm={setDrawingForm}
            revisionForm={revisionForm}
            setRevisionForm={setRevisionForm}
            uploadDocument={uploadDocument}
            uploadDrawing={uploadDrawing}
            reviseDrawing={reviseDrawing}
            markupForm={markupForm}
            setMarkupForm={setMarkupForm}
            reviewForm={reviewForm}
            setReviewForm={setReviewForm}
            runAction={runAction}
          />
        )}
        {activeView === 'reports' && <ReportsView reports={reports} dashboard={dashboard} />}
        {activeView === 'bi' && (
          <BusinessIntelligenceView
            bi={businessIntelligence}
            forms={phaseFourForms}
            setPhaseFourForm={setPhaseFourForm}
            createBiDashboard={createBiDashboard}
            createMetricSnapshot={createMetricSnapshot}
            runAction={runAction}
          />
        )}
        {activeView === 'automation' && (
          <AutomationView
            automation={automation}
            forms={phaseFourForms}
            setPhaseFourForm={setPhaseFourForm}
            createAutomationRule={createAutomationRule}
            runAction={runAction}
          />
        )}
        {activeView === 'account' && (
          <AccountSecurityPanel
            currentUser={user}
            accountSecurity={accountSecurity}
            mfaSetup={mfaSetup}
            securityForms={securityForms}
            setSecurityForm={setForm(setSecurityForms)}
            changePassword={changeOwnPassword}
            startMfaSetup={startMfaSetup}
            enableMfa={enableMfa}
            disableMfa={disableMfa}
            regenerateMfaRecoveryCodes={regenerateMfaRecoveryCodes}
          />
        )}
        {activeView === 'admin' && (
          <AdminView
            organization={organization}
            branches={branches}
            clients={clients}
            suppliers={suppliers}
            users={users}
            currentUser={user}
            approvals={adminApprovals}
            accountSecurity={accountSecurity}
            mfaSetup={mfaSetup}
            forms={adminForms}
            securityForms={securityForms}
            setForms={setAdminForms}
            setAdminFormValue={setAdminFormValue}
            setSecurityForm={setForm(setSecurityForms)}
            archiveCompany={archiveCompany}
            startMfaSetup={startMfaSetup}
            changePassword={changeOwnPassword}
            enableMfa={enableMfa}
            disableMfa={disableMfa}
            regenerateMfaRecoveryCodes={regenerateMfaRecoveryCodes}
            runAction={runAction}
          />
        )}
      </main>
    </div>
  )
}

function ThemeToggle({ theme, onToggle, disabled = false }) {
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${dark ? 'dark' : 'light'}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          {dark ? <Moon size={14} /> : <Sun size={14} />}
        </span>
      </span>
      <span>{dark ? 'Dark' : 'Light'}</span>
    </button>
  )
}

function AuthScreen({ brandName, authForm, setAuthForm, handleAuth, mfaChallenge, resetMfaChallenge, loading, error }) {
  const [showPassword, setShowPassword] = useState(false)
  const isMfaStep = Boolean(mfaChallenge?.challenge_token)
  const loginPasswordFieldName = useMemo(() => `nb-login-${Math.random().toString(36).slice(2)}`, [])

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="auth-showcase">
          <div className="auth-brand-lockup">
            <div className="brand-mark auth-logo-mark">N</div>
            <div className="auth-brand-copy">
              <strong>{brandName}</strong>
              <small>Powered by Navkwa Group Ltd.</small>
            </div>
          </div>
          <div className="auth-site-telemetry" aria-hidden="true">
            <div className="auth-blueprint">
              <span />
              <span />
              <span />
            </div>
            <div className="auth-progress-indicators">
              <span />
              <span />
              <span />
            </div>
            <div className="auth-data-points">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <form onSubmit={handleAuth} className="auth-form" autoComplete="off">
          <div className="auth-autofill-decoys" aria-hidden="true">
            <input type="text" name="username" autoComplete="username" tabIndex={-1} defaultValue="" />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} defaultValue="" />
          </div>
          <div className="form-header">
            <h1>{isMfaStep ? 'Verify sign in' : 'Sign in'}</h1>
          </div>

          <Field label="Email" type="email" name="email" value={authForm.email} onChange={setForm(setAuthForm)} autoComplete="username" required disabled={isMfaStep} />
          {isMfaStep ? (
            <>
              <Field label="Authenticator Code" name="mfa_code" value={authForm.mfa_code} onChange={setForm(setAuthForm)} inputMode="numeric" autoComplete="one-time-code" required={!authForm.recovery_code} />
              <Field label="Recovery Code" name="recovery_code" value={authForm.recovery_code} onChange={setForm(setAuthForm)} autoComplete="one-time-code" />
            </>
          ) : (
            <label className="field password-field">
              <span>Password</span>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name={loginPasswordFieldName}
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  spellCheck="false"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="auth-action-row">
            <button type="submit" className="primary-action" disabled={loading}>
              <ShieldCheck size={18} />
              {loading ? 'Working...' : isMfaStep ? 'Verify' : 'Sign in'}
            </button>
            {isMfaStep && (
              <button type="button" className="table-action" onClick={resetMfaChallenge} disabled={loading}>
                Back
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}

function AccountSecurityPanel({
  currentUser,
  accountSecurity = emptyAccountSecurity,
  mfaSetup,
  securityForms = emptySecurityForms,
  setSecurityForm,
  changePassword,
  startMfaSetup,
  enableMfa,
  disableMfa,
  regenerateMfaRecoveryCodes,
}) {
  const mfaStatus = accountSecurity?.mfa || emptyAccountSecurity.mfa
  const recoveryCodes = mfaSetup?.recovery_codes || []
  const fieldNames = useMemo(() => {
    const suffix = Math.random().toString(36).slice(2)

    return {
      current: `nb-current-${suffix}`,
      password: `nb-new-${suffix}`,
      confirmation: `nb-confirm-${suffix}`,
    }
  }, [])
  const setSecurityField = (field) => (event) => setSecurityForm?.({ target: { name: field, value: event.target.value } })
  const passwordInputSecurityProps = {
    autoComplete: 'off',
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-bwignore': 'true',
    spellCheck: 'false',
  }

  return (
    <section className="panel security-mfa-panel">
      <PanelTitle icon={ShieldCheck} title="My Account Protection" />
      {currentUser?.must_change_password && (
        <p className="security-warning">Change the temporary password before continuing with sensitive work.</p>
      )}
      <div className="security-status-row">
        <Metric label="Password" value={currentUser?.must_change_password ? 'Change required' : 'Active'} />
        <Metric label="Multi-factor" value={mfaStatus.enabled ? 'Enabled' : 'Disabled'} />
        <Metric label="Recovery Codes" value={mfaStatus.recovery_codes_remaining ?? 0} />
        <Metric label="Last Verified" value={mfaStatus.last_used_at ? shortDate(mfaStatus.last_used_at) : 'Not recorded'} />
      </div>

      {changePassword && (
        <form className="form-grid two" onSubmit={changePassword} autoComplete="off">
          <Field label="Current Password" type="password" name={fieldNames.current} value={securityForms.current_password} onChange={setSecurityField('current_password')} required {...passwordInputSecurityProps} />
          <Field label="New Password" type="password" name={fieldNames.password} value={securityForms.password} onChange={setSecurityField('password')} required {...passwordInputSecurityProps} />
          <Field label="Confirm New Password" type="password" name={fieldNames.confirmation} value={securityForms.password_confirmation} onChange={setSecurityField('password_confirmation')} required {...passwordInputSecurityProps} />
          <button type="submit" className="primary-action">
            <CheckCircle2 size={17} />
            Change password
          </button>
        </form>
      )}

      {recoveryCodes.length > 0 && (
        <div className="mfa-recovery-block">
          <span>Recovery Codes</span>
          <div className="recovery-code-grid">
            {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
          </div>
        </div>
      )}

      {!mfaStatus.enabled && !mfaSetup && (
        <form className="form-grid two" onSubmit={startMfaSetup} autoComplete="off">
          <Field label="Current Password" type="password" name={fieldNames.current} value={securityForms.current_password} onChange={setSecurityField('current_password')} required {...passwordInputSecurityProps} />
          <button type="submit" className="primary-action">
            <ShieldCheck size={17} />
            Start MFA setup
          </button>
        </form>
      )}

      {!mfaStatus.enabled && mfaSetup && (
        <>
          {mfaSetup.secret && (
            <Field className="span-2" label="Authenticator Secret" name="mfa_secret" value={mfaSetup.secret} readOnly />
          )}
          <form className="form-grid two" onSubmit={enableMfa} autoComplete="off">
            <Field label="Current Password" type="password" name={fieldNames.current} value={securityForms.current_password} onChange={setSecurityField('current_password')} required {...passwordInputSecurityProps} />
            <Field label="Authenticator Code" name="mfa_code" value={securityForms.mfa_code} onChange={setSecurityForm} inputMode="numeric" autoComplete="one-time-code" required />
            <button type="submit" className="primary-action">
              <CheckCircle2 size={17} />
              Enable MFA
            </button>
          </form>
        </>
      )}

      {mfaStatus.enabled && (
        <div className="security-mfa-actions">
          <form className="form-grid two" onSubmit={regenerateMfaRecoveryCodes} autoComplete="off">
            <Field label="Current Password" type="password" name={fieldNames.current} value={securityForms.current_password} onChange={setSecurityField('current_password')} required {...passwordInputSecurityProps} />
            <Field label="Authenticator Code" name="mfa_code" value={securityForms.mfa_code} onChange={setSecurityForm} inputMode="numeric" autoComplete="one-time-code" required />
            <button type="submit" className="primary-action">
              <RefreshCcw size={17} />
              Regenerate codes
            </button>
          </form>

          <form className="form-grid two" onSubmit={disableMfa} autoComplete="off">
            <Field label="Current Password" type="password" name={fieldNames.current} value={securityForms.current_password} onChange={setSecurityField('current_password')} required {...passwordInputSecurityProps} />
            <Field label="Authenticator Code" name="mfa_code" value={securityForms.mfa_code} onChange={setSecurityForm} inputMode="numeric" autoComplete="one-time-code" />
            <Field label="Recovery Code" name="recovery_code" value={securityForms.recovery_code} onChange={setSecurityForm} autoComplete="one-time-code" />
            <button type="submit" className="table-action danger">
              Disable MFA
            </button>
          </form>
        </div>
      )}
    </section>
  )
}

function PlatformAdminView({
  currentUser,
  platform = emptyPlatformAdminData,
  error = '',
  accountSecurity = emptyAccountSecurity,
  mfaSetup,
  forms,
  securityForms,
  setPlatformForm,
  setSecurityForm,
  setPlatformForms,
  createCompany,
  saveCompanyAccount,
  archiveCompany,
  restoreCompany,
  deleteArchivedCompany,
  createPlan,
  deletePlan,
  saveSubscription,
  upgradeSubscription,
  deleteSubscription,
  saveFeature,
  saveBranding,
  saveSuccess,
  saveStaffUser,
  deleteStaffUser,
  saveProfile,
  changePassword,
  activeTab = 'executive',
  setActiveLayer,
  setActiveTab,
  startMfaSetup,
  enableMfa,
  disableMfa,
  regenerateMfaRecoveryCodes,
  createBillingRecord,
  createSupportTicket,
  updateSupportTicket,
  createDeployment,
  createBackup,
  updateSettings,
  startImpersonation,
  searchPlatform,
  runAction,
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [companyWorkspaceTab, setCompanyWorkspaceTab] = useState('overview')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardInstance, setWizardInstance] = useState(0)
  const [provisioning, setProvisioning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const companies = useMemo(() => platform.companies || [], [platform.companies])
  const archivedCompanies = useMemo(() => platform.archived_companies || [], [platform.archived_companies])
  const plans = useMemo(() => platform.plans || [], [platform.plans])
  const featureFlags = useMemo(() => platform.feature_flags || [], [platform.feature_flags])
  const subscriptions = useMemo(() => platform.subscriptions || [], [platform.subscriptions])
  const billingRecords = useMemo(() => platform.billing_records || [], [platform.billing_records])
  const tickets = useMemo(() => platform.support_tickets || [], [platform.support_tickets])
  const deployments = useMemo(() => platform.deployments || [], [platform.deployments])
  const securityEvents = useMemo(() => platform.security_events || [], [platform.security_events])
  const backups = useMemo(() => platform.backups || [], [platform.backups])
  const auditLogs = useMemo(() => platform.audit_logs || [], [platform.audit_logs])
  const platformStaff = useMemo(() => platform.platform_staff || [], [platform.platform_staff])
  const notifications = useMemo(() => platform.notifications || [], [platform.notifications])
  const integrations = useMemo(() => platform.integrations || [], [platform.integrations])
  const automationWorkflows = platform.automation_workflows || { summary: {}, rules: [], recent_runs: [] }
  const supportMetrics = platform.support_metrics || {}
  const analytics = platform.analytics || {}
  const summary = platform.summary || {}
  const commandCenter = platform.command_center || {}
  const settingsByKey = useMemo(() => Object.fromEntries((platform.settings || []).map((setting) => [setting.setting_key, setting.setting_value || {}])), [platform.settings])
  const monitoringThresholds = platform.monitoring?.thresholds
  const searchResults = platform.search_results || []
  const catalog = platform.catalog || {}
  const platformPermissions = catalog.platform_permissions?.length
    ? catalog.platform_permissions
    : [{ key: 'platform.manage', label: 'Cloud Console Access', description: 'Can sign in to Navkwa Build Cloud Console.' }]
  const tabIconMap = {
    executive: BarChart3,
    'operations-center': ActivityIcon,
    companies: Building2,
    'customer-success': Handshake,
    subscriptions: WalletCards,
    features: Layers3,
    support: AlertTriangle,
    payment: WalletCards,
    company: Building2,
    module: Layers3,
    billing: WalletCards,
    payments: WalletCards,
    deployment: Upload,
    backup: Download,
    notifications: Send,
    automation: Workflow,
    monitoring: ActivityIcon,
    security: ShieldCheck,
    audit: Clock3,
    backups: Download,
    developer: Workflow,
    integrations: Layers3,
    data: FileText,
    settings: Settings,
    usage: BarChart3,
    reports: ClipboardList,
    licenses: CheckCircle2,
    marketplace: Package,
    ai: BarChart3,
    localization: Globe2,
    identity: Globe2,
    account: Building2,
    roles: ShieldCheck,
    users: Users,
    subscription: WalletCards,
    revenue: WalletCards,
    storage: FileText,
    timeline: Clock3,
    analytics: BarChart3,
  }
  const cardIconMap = {
    platform_health: ShieldCheck,
    live_users: Users,
    companies_online: Building2,
    revenue_today: WalletCards,
    pending_support: AlertTriangle,
    deployments_running: Upload,
    security_threats: ShieldCheck,
    failed_jobs: Workflow,
    storage: FileText,
    ai_usage: BarChart3,
  }
  const firstCompanyId = companies[0]?.id ? String(companies[0].id) : ''
  const selectedCompanyExists = companies.some((company) => String(company.id) === String(selectedCompanyId))
  const effectiveSelectedCompanyId = selectedCompanyExists ? selectedCompanyId : firstCompanyId
  const selectedCompany = companies.find((company) => String(company.id) === String(effectiveSelectedCompanyId)) || companies[0]
  const featureCompanyId = forms.feature_company.company_id || firstCompanyId
  const featureCompany = companies.find((company) => String(company.id) === String(featureCompanyId)) || companies[0]
  const impersonationCompany = companies.find((company) => String(company.id) === String(forms.impersonation.company_id))
  const selectedCompanyUsers = impersonationCompany?.users || []
  const selectedCompanyFeatures = featureCompany?.enabled_features || []
  const productFeatures = featureFlags.filter((flag) => flag.category !== 'module')
  const platformPermissionSummary = (permissions = []) => {
    const normalized = normalizePermissionList(permissions)
    if (normalized.includes('platform.*')) return 'Super Admin Access'
    if (normalized.includes('platform.manage')) return 'Cloud Console Access'
    return 'No Cloud Console access'
  }
  const hydrateCompanyAccountForm = useCallback((company) => {
    if (!company?.id) return

    setPlatformForms((current) => ({
      ...current,
      company_account: {
        ...current.company_account,
        company_id: String(company.id),
        name: company.name || '',
        registration_number: company.registration_number || '',
        industry: company.industry || '',
        country: company.country || 'GH',
        city: company.city || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        tax_id: company.tax_id || '',
        currency: company.default_currency || 'GHS',
        timezone: company.base_timezone || 'Africa/Accra',
        language: company.language || 'en',
        date_format: company.date_format || 'Y-m-d',
        fiscal_year_start: company.fiscal_year_start || '01-01',
        status: company.status || 'active',
        storage_limit_mb: company.storage_limit_mb ?? '',
        employee_limit: company.employee_limit ?? '',
        project_limit: company.project_limit ?? '',
        branch_limit: company.branch_limit ?? '',
        subscription_plan_id: company.subscription?.plan?.id ? String(company.subscription.plan.id) : '',
      },
    }))
  }, [setPlatformForms])
  const roleRows = companies.flatMap((company) => (company.roles || []).map((role) => [company.name, role.name, role.slug, (role.permissions || []).includes('*') ? 'All tenant access' : `${(role.permissions || []).length} permissions`, role.is_system ? 'System' : 'Custom']))
  const countryOptions = useMemo(
    () => (catalog.countries || emptyList).map((country) => ({ value: country, label: countryName(country), meta: country })),
    [catalog.countries],
  )
  const currencyOptions = useMemo(
    () => (catalog.currencies || emptyList).map((currency) => ({ value: currency, label: currencyName(currency), meta: currency })),
    [catalog.currencies],
  )
  const catalogCompanyStatuses = catalog.statuses || []
  const catalogPlanStatuses = catalog.plan_statuses || []
  const catalogSubscriptionStatuses = catalog.subscription_statuses || []
  const catalogBillingIntervals = catalog.billing_intervals || []
  const catalogSupportLevels = catalog.support_levels || []
  const catalogSupportPriorities = catalog.support_priorities || []
  const catalogSupportTicketStatuses = catalog.support_ticket_statuses || []
  const catalogBillingRecordTypes = catalog.billing_record_types || []
  const catalogBillingStatuses = catalog.billing_statuses || []
  const catalogDeploymentScopes = catalog.deployment_scopes || []
  const catalogBackupTypes = catalog.backup_types || []
  const monitoring = platform.monitoring || {}
  const monitoringChecks = monitoring.checks || {}
  const checkTone = (key) => monitoringChecks[key]?.status || 'neutral'
  const checkValue = (key, fallback = 'Unavailable') => monitoringChecks[key]?.value || fallback
  const openSupportTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status))
  const urgentSupportTickets = openSupportTickets.filter((ticket) => ['urgent', 'critical'].includes(ticket.priority))
  const awaitingCustomerTickets = openSupportTickets.filter((ticket) => ticket.status === 'waiting_customer')
  const resolvedTodayTickets = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status) && dateFrom(ticket.updated_at)?.toDateString() === new Date().toDateString())
  const paidBillingRecords = billingRecords.filter((record) => record.status === 'paid')
  const outstandingBillingRecords = billingRecords.filter((record) => record.record_type === 'invoice' && !['paid', 'void'].includes(record.status))
  const failedPayments = billingRecords.filter((record) => record.record_type === 'failed_payment' || record.status === 'failed')
  const renewalSubscriptions = subscriptions.filter((subscription) => {
    const renewalDate = dateFrom(subscription.renewal_at)
    return renewalDate && renewalDate >= new Date() && renewalDate <= new Date(Date.now() + 30 * 86400000)
  })
  const currentVersion = deployments.find((deployment) => deployment.release_version && ['completed', 'deployed', 'successful'].includes(deployment.status))?.release_version
    || commandCenter.latest_deployment?.release_version
    || deployments.find((deployment) => deployment.release_version)?.release_version
    || monitoring.app_version
    || 'Not configured'
  const storagePercent = summary.storage_usage_percent ?? monitoring.storage_usage_percent
  const latestBackup = commandCenter.latest_backup || backups[0]
  const latestDeployment = commandCenter.latest_deployment || deployments[0]
  const activityFeed = useMemo(() => {
    const events = []
    companies.slice(0, 20).forEach((company) => {
      events.push({ type: 'company', at: company.created_at, title: 'Company onboarded', detail: company.name, company_id: company.id })
      ;(company.timeline || []).slice(0, 6).forEach((event) => events.push({ ...event, at: event.occurred_at, company_id: company.id, detail: event.detail || company.name }))
    })
    paidBillingRecords.slice(0, 20).forEach((record) => events.push({ type: 'payment', at: record.paid_at || record.updated_at || record.created_at, title: 'Payment received', detail: `${record.company?.name || 'Platform'} ${money(record.amount)}`, company_id: record.company_id }))
    tickets.slice(0, 20).forEach((ticket) => events.push({ type: 'support', at: ticket.updated_at || ticket.created_at, title: `Support ticket ${labelize(ticket.status)}`, detail: `${ticket.ticket_number} ${ticket.title}`, company_id: ticket.company_id }))
    deployments.slice(0, 10).forEach((deployment) => events.push({ type: 'deployment', at: deployment.deployed_at || deployment.scheduled_at || deployment.created_at, title: `Deployment ${labelize(deployment.status)}`, detail: `${deployment.release_version || deployment.deployment_number} ${deployment.title || ''}`.trim() }))
    backups.slice(0, 10).forEach((backup) => events.push({ type: 'backup', at: backup.completed_at || backup.started_at || backup.created_at, title: `Backup ${labelize(backup.status)}`, detail: `${backup.company?.name || 'Platform'} ${labelize(backup.backup_type)}` }))
    securityEvents.slice(0, 10).forEach((event) => events.push({ type: 'security', at: event.created_at, title: `${labelize(event.event_type)} ${labelize(event.status)}`, detail: event.company?.name || event.ip_address || 'Platform' }))

    return events
      .filter((event) => dateFrom(event.at))
      .sort((a, b) => dateFrom(b.at) - dateFrom(a.at))
      .slice(0, 24)
  }, [backups, companies, deployments, paidBillingRecords, securityEvents, tickets])
  const revenueTrend = useMemo(() => {
    const revenue = [...(analytics.monthly_revenue || [])].sort((a, b) => String(a.month).localeCompare(String(b.month)))
    const current = Number(revenue.at(-1)?.revenue || 0)
    const previous = Number(revenue.at(-2)?.revenue || 0)
    if (!previous) return null
    return Math.round(((current - previous) / previous) * 100)
  }, [analytics.monthly_revenue])
  const topModuleAdoption = [...(analytics.module_adoption || [])]
    .sort((a, b) => Number(b.companies || 0) - Number(a.companies || 0))
    .slice(0, 2)
  const executiveRecommendation = commandCenter.companies_needing_attention?.[0]
    ? `Contact ${commandCenter.companies_needing_attention[0].name}. ${(commandCenter.companies_needing_attention[0].health_reasons || [])[0]?.label || 'Their account needs follow-up.'}`
    : companies.find((company) => company.storage_limit_mb && Number(company.usage?.storage_mb || 0) >= Number(company.storage_limit_mb) * 0.85)
      ? `Review storage for ${companies.find((company) => company.storage_limit_mb && Number(company.usage?.storage_mb || 0) >= Number(company.storage_limit_mb) * 0.85)?.name}. They are approaching their storage limit.`
      : 'No urgent customer intervention required.'
  const platformHealthItems = [
    { label: 'Platform Status', value: commandCenter.status_label || monitoring.status_label || 'Operational', tone: commandCenter.status || monitoring.status || 'operational' },
    { label: 'Current Version', value: currentVersion, tone: currentVersion === 'Not configured' ? 'neutral' : 'current' },
    { label: 'Servers Online', value: monitoring.servers_online_label || 'Not configured', tone: monitoring.servers_online_label ? 'operational' : 'neutral' },
    { label: 'Queues', value: checkValue('queue'), tone: checkTone('queue') },
    { label: 'Database', value: checkValue('database'), tone: checkTone('database') },
    { label: 'Redis', value: checkValue('redis', 'Not used by current config'), tone: checkTone('redis') },
    { label: 'API', value: checkValue('api'), tone: checkTone('api') },
    { label: 'Background Jobs', value: `${summary.failed_background_jobs || 0} failed`, tone: (summary.failed_background_jobs || 0) > 0 ? 'critical' : 'healthy' },
    { label: 'Storage', value: storagePercent === null || storagePercent === undefined ? `${summary.storage_used_mb || 0} MB` : `${storagePercent}%`, tone: Number(storagePercent || 0) >= 85 ? 'warning' : 'healthy' },
    { label: 'Backups', value: checkValue('backups', latestBackup?.status ? labelize(latestBackup.status) : 'No backups recorded'), tone: checkTone('backups') },
    { label: 'SSL Certificates', value: checkValue('ssl', 'Not configured'), tone: checkTone('ssl') },
  ]
  const customerGrowthMetrics = [
    { label: 'New Companies', value: summary.new_companies_this_month || 0 },
    { label: 'Trial Started', value: summary.trial_companies || 0 },
    { label: 'Converted', value: summary.converted_companies_this_month || 0 },
    { label: 'Cancelled', value: summary.cancelled_companies_this_month || 0 },
    { label: 'Net Growth', value: (summary.new_companies_this_month || 0) - (summary.cancelled_companies_this_month || 0) },
  ]
  const revenueMetrics = [
    { label: 'MRR', value: money(summary.monthly_recurring_revenue || 0) },
    { label: 'ARR', value: money(summary.annual_recurring_revenue || 0) },
    { label: 'Revenue Today', value: money(summary.revenue_today || 0) },
    { label: 'Revenue This Week', value: money(summary.revenue_this_week || 0) },
    { label: 'Revenue This Month', value: money(summary.revenue_this_month || 0) },
    { label: 'Average Subscription', value: money(summary.average_revenue_per_account || 0) },
    { label: 'Churn', value: `${summary.churn_rate || 0}%` },
    { label: 'Renewals', value: summary.renewals_due_30_days || renewalSubscriptions.length },
    { label: 'Expansion Revenue', value: money(summary.expansion_revenue || 0) },
    { label: 'Outstanding Invoices', value: `${summary.outstanding_invoices || outstandingBillingRecords.length} / ${money(summary.outstanding_invoice_amount || outstandingBillingRecords.reduce((total, record) => total + Number(record.amount || 0), 0))}` },
    { label: 'Forecast Revenue', value: money((summary.monthly_recurring_revenue || 0) + (summary.outstanding_invoice_amount || 0)) },
  ]
  useEffect(() => {
    if (!firstCompanyId || forms.feature_company.company_id) return

    setPlatformForms((current) => ({
      ...current,
      feature_company: { ...current.feature_company, company_id: firstCompanyId },
    }))
  }, [firstCompanyId, forms.feature_company.company_id, setPlatformForms])

  useEffect(() => {
    if (!firstCompanyId) {
      if (selectedCompanyId) setSelectedCompanyId('')
      return
    }

    if (!selectedCompanyId || !companies.some((company) => String(company.id) === String(selectedCompanyId))) {
      setSelectedCompanyId(firstCompanyId)
    }
  }, [companies, firstCompanyId, selectedCompanyId])

  useEffect(() => {
    const company = companies.find((item) => String(item.id) === String(effectiveSelectedCompanyId))
    if (!company?.id || forms.success.company_id === String(company.id)) return
    const success = company.customer_success || {}
    setPlatformForms((current) => ({
      ...current,
      success: {
        ...current.success,
        company_id: String(company.id),
        success_manager: success.success_manager || '',
        last_meeting_at: success.last_meeting_at ? String(success.last_meeting_at).slice(0, 10) : '',
        next_meeting_at: success.next_meeting_at ? String(success.next_meeting_at).slice(0, 10) : '',
        training_completed_percent: success.training_completed_percent ?? '',
        adoption_percent: success.adoption_percent ?? '',
        risk_percent: success.risk_percent ?? '',
        expansion_opportunity: success.expansion_opportunity || '',
        notes: success.notes || '',
      },
    }))
  }, [companies, effectiveSelectedCompanyId, forms.success.company_id, setPlatformForms])

  useEffect(() => {
    const company = companies.find((item) => String(item.id) === String(effectiveSelectedCompanyId))
    if (!company?.id || forms.company_account.company_id === String(company.id)) return
    hydrateCompanyAccountForm(company)
  }, [companies, effectiveSelectedCompanyId, forms.company_account.company_id, hydrateCompanyAccountForm])

  useEffect(() => {
    const keys = ['database_warning_ms', 'database_critical_ms', 'queue_pending_warning', 'failed_jobs_critical', 'storage_warning_percent', 'storage_critical_percent', 'security_alert_critical', 'server_count', 'servers_online']
    if (!monitoringThresholds || !keys.some((key) => monitoringThresholds[key] !== undefined)) return

    setPlatformForms((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...keys.reduce((values, key) => ({
          ...values,
          [key]: monitoringThresholds[key] ?? current.settings[key],
        }), {}),
      },
    }))
  }, [monitoringThresholds, setPlatformForms])

  useEffect(() => {
    const aiSettings = settingsByKey.ai || {}
    setPlatformForms((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ai_enabled: aiSettings.enabled ? 'true' : 'false',
        ai_usage_percent: aiSettings.usage_percent ?? '',
        ai_monthly_token_limit: aiSettings.monthly_token_limit ?? '',
        ai_monthly_budget: aiSettings.monthly_budget ?? '',
        ai_cost_month_to_date: aiSettings.cost_month_to_date ?? '',
      },
    }))
  }, [settingsByKey, setPlatformForms])

  useEffect(() => {
    if (!currentUser?.id || forms.profile.user_id === String(currentUser.id)) return

    setPlatformForms((current) => ({
      ...current,
      profile: {
        ...current.profile,
        user_id: String(currentUser.id),
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        job_title: currentUser.job_title || '',
        current_password: '',
        password: '',
        password_confirmation: '',
      },
    }))
  }, [currentUser?.email, currentUser?.id, currentUser?.job_title, currentUser?.name, currentUser?.phone, forms.profile.user_id, setPlatformForms])

  useEffect(() => {
    if ((forms.company.enabled_feature_keys || []).length > 0 || plans.length === 0) return
    const plan = plans.find((item) => String(item.id) === String(forms.company.subscription_plan_id)) || plans.find((item) => item.code === 'professional') || plans[0]
    if (!plan) return
    setPlatformForms((current) => ({
      ...current,
      company: { ...current.company, subscription_plan_id: current.company.subscription_plan_id || String(plan.id), enabled_feature_keys: [...(plan.modules || []), ...(plan.features || [])] },
    }))
  }, [forms.company.enabled_feature_keys, forms.company.subscription_plan_id, plans, setPlatformForms])

  useEffect(() => {
    if (activeTab === 'companies') {
      setCompanyWorkspaceTab('overview')
    }
  }, [activeTab])

  async function submitSearch(event) {
    event.preventDefault()
    await searchPlatform(searchQuery.trim())
  }

  function hydrateSuccessForm(company) {
    const success = company?.customer_success || {}
    setPlatformForms((current) => ({
      ...current,
      success: {
        ...current.success,
        company_id: company?.id ? String(company.id) : '',
        success_manager: success.success_manager || '',
        last_meeting_at: success.last_meeting_at ? String(success.last_meeting_at).slice(0, 10) : '',
        next_meeting_at: success.next_meeting_at ? String(success.next_meeting_at).slice(0, 10) : '',
        training_completed_percent: success.training_completed_percent ?? '',
        adoption_percent: success.adoption_percent ?? '',
        risk_percent: success.risk_percent ?? '',
        expansion_opportunity: success.expansion_opportunity || '',
        notes: success.notes || '',
      },
    }))
  }

  function selectWorkspaceCompany(companyId) {
    const company = companies.find((item) => String(item.id) === String(companyId))
    setSelectedCompanyId(String(companyId))
    setCompanyWorkspaceTab('overview')
    if (company) {
      hydrateSuccessForm(company)
      hydrateCompanyAccountForm(company)
      setPlatformForms((current) => ({
        ...current,
        branding: { ...current.branding, company_id: String(company.id) },
        feature_company: { ...current.feature_company, company_id: String(company.id) },
      }))
    }
  }

  function toggleProvisioningModule(flagKey) {
    setPlatformForms((current) => {
      const selected = new Set(current.company.enabled_feature_keys || [])
      if (selected.has(flagKey)) selected.delete(flagKey)
      else selected.add(flagKey)

      return {
        ...current,
        company: { ...current.company, enabled_feature_keys: [...selected] },
      }
    })
  }

  function selectedPlan() {
    return plans.find((plan) => String(plan.id) === String(forms.company.subscription_plan_id)) || plans.find((plan) => plan.code === 'professional') || plans[0]
  }

  function seedModulesFromPlan(planId) {
    const plan = plans.find((item) => String(item.id) === String(planId)) || plans.find((item) => item.code === 'professional') || plans[0]
    if (!plan) return
    setPlatformForms((current) => ({
      ...current,
      company: { ...current.company, subscription_plan_id: planId, enabled_feature_keys: [...(plan.modules || []), ...(plan.features || [])] },
    }))
  }

  function openProvisioningWizard() {
    const plan = plans.find((item) => item.code === 'professional') || plans[0]
    setPlatformForms((current) => ({
      ...current,
      company: {
        ...emptyPlatformForms.company,
        subscription_plan_id: plan?.id ? String(plan.id) : '',
        enabled_feature_keys: plan ? [...(plan.modules || []), ...(plan.features || [])] : [],
      },
      branding: emptyPlatformForms.branding,
    }))
    setWizardStep(1)
    setWizardInstance((current) => current + 1)
    setWizardOpen(true)
  }

  function selectCompanyFor(section) {
    return (event) => {
      const { value } = event.target
      const company = companies.find((item) => String(item.id) === String(value))
      const profile = company?.branding_profile || {}
      const success = company?.customer_success || {}
      setPlatformForms((current) => ({
        ...current,
        [section]: {
          ...current[section],
          ...(section === 'branding'
            ? {
                primary_color: profile.primary_color || current.branding.primary_color,
                secondary_color: profile.secondary_color || current.branding.secondary_color,
                accent_color: profile.accent_color || current.branding.accent_color,
                sidebar_color: profile.sidebar_color || current.branding.sidebar_color,
                button_color: profile.button_color || current.branding.button_color,
                typography: profile.typography || current.branding.typography,
                login_welcome_message: profile.login_welcome_message || '',
                company_motto: profile.company_motto || '',
              }
            : {}),
          ...(section === 'success'
            ? {
                success_manager: success.success_manager || '',
                last_meeting_at: success.last_meeting_at ? String(success.last_meeting_at).slice(0, 10) : '',
                next_meeting_at: success.next_meeting_at ? String(success.next_meeting_at).slice(0, 10) : '',
                training_completed_percent: success.training_completed_percent ?? '',
                adoption_percent: success.adoption_percent ?? '',
                risk_percent: success.risk_percent ?? '',
                expansion_opportunity: success.expansion_opportunity || '',
                notes: success.notes || '',
              }
            : {}),
          company_id: value,
        },
      }))
    }
  }

  function resetPlatformPlanForm() {
    setPlatformForms((current) => ({ ...current, plan: emptyPlatformForms.plan }))
  }

  function editPlatformPlan(plan) {
    setPlatformForms((current) => ({
      ...current,
      plan: {
        id: String(plan.id),
        code: plan.code || '',
        name: plan.name || '',
        status: plan.status || 'active',
        currency: plan.currency || 'GHS',
        monthly_price: plan.monthly_price ?? 0,
        yearly_price: plan.yearly_price ?? 0,
        maximum_users: plan.maximum_users ?? '',
        maximum_projects: plan.maximum_projects ?? '',
        maximum_storage_mb: plan.maximum_storage_mb ?? '',
        support_level: plan.support_level || 'standard',
        api_access: plan.api_access ? 'true' : 'false',
        custom_branding: plan.custom_branding ? 'true' : 'false',
        sso_available: plan.sso_available ? 'true' : 'false',
      },
    }))
  }

  function nextUpgradePlan(subscription) {
    const currentMonthly = Number(subscription?.plan?.monthly_price ?? plans.find((plan) => String(plan.id) === String(subscription?.platform_subscription_plan_id))?.monthly_price ?? 0)
    const sortedPlans = [...plans].sort((a, b) => Number(a.monthly_price || 0) - Number(b.monthly_price || 0))

    return sortedPlans.find((plan) => Number(plan.monthly_price || 0) > currentMonthly) || sortedPlans[sortedPlans.length - 1]
  }

  function editPlatformSubscription(subscription, mode = 'edit') {
    const targetPlan = mode === 'upgrade' ? nextUpgradePlan(subscription) : subscription.plan
    setPlatformForms((current) => ({
      ...current,
      subscription: {
        id: String(subscription.id),
        platform_subscription_plan_id: targetPlan?.id ? String(targetPlan.id) : '',
        status: mode === 'upgrade' ? 'active' : subscription.status || 'active',
        billing_interval: ['monthly', 'yearly'].includes(subscription.billing_interval) ? subscription.billing_interval : 'monthly',
        amount: mode === 'upgrade' && targetPlan
          ? (subscription.billing_interval === 'yearly' ? targetPlan.yearly_price : targetPlan.monthly_price)
          : subscription.amount ?? '',
        currency: targetPlan?.currency || subscription.currency || 'GHS',
        seats: subscription.seats ?? '',
        renewal_at: subscription.renewal_at ? String(subscription.renewal_at).slice(0, 10) : '',
      },
    }))
  }

  function editPlatformFeature(flag) {
    setPlatformForms((current) => ({
      ...current,
      feature: {
        id: String(flag.id),
        name: flag.name || '',
        module: flag.module || '',
        category: flag.category || 'feature',
        description: flag.description || '',
        rollout_status: flag.rollout_status || 'active',
        rollout_percentage: flag.rollout_percentage ?? 0,
        default_enabled: flag.default_enabled ? 'true' : 'false',
        requires_subscription: flag.requires_subscription === false ? 'false' : 'true',
        pricing_tier: flag.pricing_tier || '',
      },
    }))
  }

  function editPlatformSupportTicket(ticket) {
    setPlatformForms((current) => ({
      ...current,
      support_update: {
        id: String(ticket.id),
        status: ticket.status || 'open',
        priority: ticket.priority || 'medium',
        assigned_to: ticket.assigned_to ? String(ticket.assigned_to) : '',
        resolution_notes: ticket.resolution_notes || '',
      },
    }))
  }

  function resetPlatformStaffForm() {
    setPlatformForms((current) => ({ ...current, staff: emptyPlatformForms.staff }))
  }

  function editPlatformStaffUser(item) {
    setPlatformForms((current) => ({
      ...current,
      staff: {
        id: String(item.id),
        name: item.name || '',
        email: item.email || '',
        password: '',
        phone: item.phone || '',
        job_title: item.job_title || '',
        status: item.status || 'active',
        permissions: normalizePermissionList(item.effective_permissions || item.permissions || ['platform.manage']).filter((permission) => permission.startsWith('platform.')),
      },
    }))
  }

  function togglePlatformStaffPermission(permission) {
    setPlatformForms((current) => {
      const permissions = new Set(normalizePermissionList(current.staff.permissions))
      if (permissions.has(permission)) {
        permissions.delete(permission)
      } else {
        permissions.add(permission)
      }

      if (permissions.size === 0) {
        permissions.add('platform.manage')
      }

      return {
        ...current,
        staff: { ...current.staff, permissions: [...permissions] },
      }
    })
  }

  function setBrandingFile(event) {
    const { name, files } = event.target
    setPlatformForms((current) => ({
      ...current,
      branding: { ...current.branding, [name]: files?.[0] || '' },
    }))
  }

  function featureEnabledForSelected(flag) {
    return selectedCompanyFeatures.some((item) => item.key === flag.key)
  }

  function toggleSelectedFeature(flag) {
    if (!featureCompany?.id) return

    runAction(
      () => api.updatePlatformCompanyFeature(featureCompany.id, flag.id, { is_enabled: !featureEnabledForSelected(flag) }),
      'Feature flag updated.',
    )
  }

  function renderCompanySelector(section, label = 'Company') {
    return (
      <Select label={label} name="company_id" value={forms[section].company_id || ''} onChange={selectCompanyFor(section)}>
        <option value="">Select company</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </Select>
    )
  }

  function formatConsoleCardValue(card) {
    return card.format === 'money' ? money(card.value || 0) : card.value
  }

  function renderGlobalSearch() {
    return (
      <form className="cloud-search" onSubmit={submitSearch}>
        <Field aria-label="Global search" label="Global Search" name="platform_search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Company, invoice, user, project, subscription, payment, ticket" />
        <button type="submit" className="primary-action"><BarChart3 size={17} />Search</button>
      </form>
    )
  }

  function renderSearchResults() {
    if (!searchQuery.trim()) return null

    return (
      <section className="panel cloud-search-results">
        <PanelTitle icon={BarChart3} title="Global Search Results" />
        <DataTable
          columns={['Type', 'Record', 'Detail', 'Company', 'Action']}
          rows={searchResults.map((item) => [
            <Badge key="type" value={item.type} />,
            item.label,
            item.detail,
            item.company || '',
            item.company_id ? <button key="open" type="button" className="table-action" onClick={() => { setActiveLayer('customers'); setActiveTab('companies'); selectWorkspaceCompany(item.company_id) }}>Open company</button> : '',
          ])}
        />
      </section>
    )
  }

  function renderCommandCenter() {
    const cards = commandCenter.cards?.length ? commandCenter.cards : []
    return (
      <section className="view-stack cloud-command-center">
        <div className={`cloud-status-hero cloud-command-hero ${commandCenter.status || 'unavailable'}`}>
          <div>
            <span>Navkwa Build Cloud Console</span>
            <h2>{commandCenter.status_label || 'Platform status unavailable'}</h2>
            <p>{revenueTrend === null ? 'Platform operations are ready for review.' : `Revenue is ${revenueTrend >= 0 ? 'up' : 'down'} ${Math.abs(revenueTrend)}% against the previous revenue period.`}</p>
          </div>
          <div className="cloud-status-meta">
            <Metric label="MRR" value={money(summary.monthly_recurring_revenue || 0)} />
            <Metric label="ARR" value={money(summary.annual_recurring_revenue || 0)} />
            <Metric label="SLA" value={summary.support_sla_compliance === null || summary.support_sla_compliance === undefined ? 'N/A' : `${summary.support_sla_compliance}%`} />
            <Metric label="Version" value={currentVersion} />
          </div>
        </div>

        <section className="panel cloud-ai-summary">
          <PanelTitle icon={BarChart3} title="Today's Platform Summary" />
          <div className="cloud-summary-grid">
            <div>
              <strong>{summary.new_companies_this_month || 0} new companies joined this month.</strong>
              <span>{summary.renewals_due_30_days || renewalSubscriptions.length} subscription renewal{(summary.renewals_due_30_days || renewalSubscriptions.length) === 1 ? '' : 's'} due within 30 days.</span>
              <span>Support SLA is {summary.support_sla_compliance === null || summary.support_sla_compliance === undefined ? 'not yet measured' : `${summary.support_sla_compliance}%`}.</span>
              <span>{summary.security_alerts || 0} critical security alert{(summary.security_alerts || 0) === 1 ? '' : 's'} open.</span>
            </div>
            <div>
              <strong>Module adoption</strong>
              {topModuleAdoption.length > 0 ? topModuleAdoption.map((module) => <span key={module.module}>{moduleLabel(module.module)}: {module.companies || 0} companies</span>) : <span>No module adoption data yet.</span>}
            </div>
            <div>
              <strong>Recommendation</strong>
              <span>{executiveRecommendation}</span>
            </div>
          </div>
        </section>

        <section className="cloud-health-matrix" aria-label="Platform health">
          {platformHealthItems.map((item) => (
            <div key={item.label} className="cloud-health-cell">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <Badge value={item.tone} />
            </div>
          ))}
        </section>

        <div className="cloud-metric-strip">
          {customerGrowthMetrics.map((item) => <Metric key={item.label} label={item.label} value={item.value} />)}
        </div>

        <div className="cloud-metric-strip revenue-strip">
          {revenueMetrics.map((item) => <Metric key={item.label} label={item.label} value={item.value} />)}
        </div>

        {cards.length > 0 && (
          <div className="kpi-grid cloud-status-grid">
            {cards.map((card) => {
              const Icon = cardIconMap[card.key] || BarChart3
              return <Kpi key={card.key} icon={Icon} label={card.label} value={formatConsoleCardValue(card)} sub={card.sub} />
            })}
          </div>
        )}

        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Command Alerts" />
            <DataTable columns={['Severity', 'Alert', 'Count']} rows={(commandCenter.alerts || []).map((alert) => [<Badge key="severity" value={alert.severity} />, alert.title, alert.count])} />
          </section>
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Activity Feed" />
            <div className="cloud-activity-feed">
              {activityFeed.slice(0, 8).map((event, index) => {
                const Icon = tabIconMap[event.type] || Clock3
                return (
                  <article key={`${event.title}-${event.at}-${index}`}>
                    <Icon size={15} />
                    <div>
                      <span>{timelineTime(event.at)}</span>
                      <strong>{event.title}</strong>
                      <small>{event.detail}</small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>

        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Companies Needing Attention" />
            <DataTable columns={['Company', 'Health', 'Status', 'Reason']} rows={(commandCenter.companies_needing_attention || []).map((company) => [company.name, `${company.health_score || 0}%`, <Badge key="status" value={company.status} />, (company.health_reasons || [])[0]?.label || 'Review account'])} />
          </section>
          <section className="panel">
            <PanelTitle icon={Upload} title="Release & Backup Status" />
            <DataTable columns={['Area', 'Latest Record', 'Status', 'When']} rows={[
              ['Deployment', commandCenter.latest_deployment?.deployment_number || 'None', commandCenter.latest_deployment?.status || '', shortDate(commandCenter.latest_deployment?.created_at)],
              ['Backup', commandCenter.latest_backup?.backup_number || 'None', commandCenter.latest_backup?.status || '', shortDate(commandCenter.latest_backup?.created_at)],
            ]} />
          </section>
        </div>

        {renderExecutive()}
      </section>
    )
  }

  function renderOperationsCenter() {
    const operationalGroups = [
      {
        title: 'Platform Health',
        icon: ShieldCheck,
        rows: platformHealthItems.slice(0, 8).map((item) => [item.label, item.value, <Badge key={item.label} value={item.tone} />]),
      },
      {
        title: 'Security',
        icon: ShieldCheck,
        rows: [
          ['Failed Logins', securityEvents.filter((event) => String(event.event_type || '').includes('login')).length, <Badge key="failed-logins" value={securityEvents.length ? 'warning' : 'healthy'} />],
          ['Open Alerts', summary.security_alerts || 0, <Badge key="open-alerts" value={(summary.security_alerts || 0) > 0 ? 'critical' : 'healthy'} />],
          ['Suspicious Activity', securityEvents.filter((event) => ['open', 'investigating'].includes(event.status)).length, <Badge key="suspicious" value={(summary.security_alerts || 0) > 0 ? 'warning' : 'healthy'} />],
        ],
      },
      {
        title: 'Business',
        icon: WalletCards,
        rows: [
          ['Revenue Today', money(summary.revenue_today || 0), <Badge key="revenue" value="healthy" />],
          ['Trials Started', summary.trial_companies || 0, <Badge key="trial" value="active" />],
          ['Conversions', summary.converted_companies_this_month || 0, <Badge key="converted" value="healthy" />],
          ['Renewals', summary.renewals_due_30_days || renewalSubscriptions.length, <Badge key="renewals" value={(summary.renewals_due_30_days || renewalSubscriptions.length) > 0 ? 'warning' : 'healthy'} />],
        ],
      },
      {
        title: 'Customer Success',
        icon: Handshake,
        rows: [
          ['At Risk', companies.filter((company) => Number(company.health_score || 0) < 70).length, <Badge key="risk" value={companies.some((company) => Number(company.health_score || 0) < 70) ? 'warning' : 'healthy'} />],
          ['Needs Follow-up', commandCenter.companies_needing_attention?.length || 0, <Badge key="follow" value={(commandCenter.companies_needing_attention?.length || 0) > 0 ? 'warning' : 'healthy'} />],
          ['Training Pending', companies.filter((company) => Number(company.customer_success?.training_completed_percent || 100) < 80).length, <Badge key="training" value="neutral" />],
          ['Renewals Due', renewalSubscriptions.length, <Badge key="customer-renewals" value={renewalSubscriptions.length > 0 ? 'warning' : 'healthy'} />],
        ],
      },
      {
        title: 'Engineering',
        icon: Workflow,
        rows: [
          ['Failed Jobs', summary.failed_background_jobs || 0, <Badge key="jobs" value={(summary.failed_background_jobs || 0) > 0 ? 'critical' : 'healthy'} />],
          ['Queue Length', monitoring.jobs_pending ?? 0, <Badge key="queue" value={checkTone('queue')} />],
          ['API Errors', securityEvents.filter((event) => String(event.event_type || '').includes('api')).length, <Badge key="api" value={securityEvents.some((event) => String(event.event_type || '').includes('api')) ? 'warning' : 'healthy'} />],
          ['Deployments', summary.deployments_running || 0, <Badge key="deployments" value={(summary.deployments_running || 0) > 0 ? 'warning' : 'healthy'} />],
        ],
      },
    ]

    return (
      <section className="view-stack">
        <div className="cloud-console-top">
          <div>
            <span>Platform Operations Center</span>
            <h2>Live operating picture</h2>
          </div>
          <div className="cloud-status-meta">
            <Metric label="API" value={checkValue('api')} />
            <Metric label="Queues" value={checkValue('queue')} />
            <Metric label="Storage" value={storagePercent === null || storagePercent === undefined ? `${summary.storage_used_mb || 0} MB` : `${storagePercent}%`} />
          </div>
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Live Activity" />
            <div className="cloud-activity-feed">
              {activityFeed.slice(0, 14).map((event, index) => {
                const Icon = tabIconMap[event.type] || Clock3
                return (
                  <article key={`${event.title}-${event.at}-${index}`}>
                    <Icon size={15} />
                    <div>
                      <span>{timelineTime(event.at)}</span>
                      <strong>{event.title}</strong>
                      <small>{event.detail}</small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Operations Queue" />
            <DataTable columns={['Area', 'Count', 'Status']} rows={(commandCenter.alerts || []).map((alert) => [alert.title, alert.count, <Badge key={alert.type} value={alert.severity} />])} />
          </section>
        </div>
        <div className="cloud-ops-grid">
          {operationalGroups.map((group) => (
            <section key={group.title} className="panel">
              <PanelTitle icon={group.icon} title={group.title} />
              <DataTable columns={['Signal', 'Value', 'Status']} rows={group.rows} />
            </section>
          ))}
        </div>
      </section>
    )
  }

  function renderSuccessForm() {
    return (
      <form className="form-grid two cloud-success-form" onSubmit={saveSuccess}>
        {renderCompanySelector('success')}
        <Field label="Success Manager" name="success_manager" value={forms.success.success_manager} onChange={setPlatformForm('success')} />
        <Field label="Last Meeting" type="date" name="last_meeting_at" value={forms.success.last_meeting_at} onChange={setPlatformForm('success')} />
        <Field label="Next Meeting" type="date" name="next_meeting_at" value={forms.success.next_meeting_at} onChange={setPlatformForm('success')} />
        <Field label="Training Completed %" type="number" name="training_completed_percent" value={forms.success.training_completed_percent} onChange={setPlatformForm('success')} />
        <Field label="Adoption %" type="number" name="adoption_percent" value={forms.success.adoption_percent} onChange={setPlatformForm('success')} />
        <Field label="Risk %" type="number" name="risk_percent" value={forms.success.risk_percent} onChange={setPlatformForm('success')} />
        <Field label="Expansion Opportunity" name="expansion_opportunity" value={forms.success.expansion_opportunity} onChange={setPlatformForm('success')} />
        <TextArea className="span-2" label="Notes" name="notes" value={forms.success.notes} onChange={setPlatformForm('success')} />
        <button type="submit" className="primary-action span-2"><CheckCircle2 size={17} />Save customer success</button>
      </form>
    )
  }

  function renderCompanyAccountForm(company) {
    if (!company?.id) return null

    return (
      <section className="panel">
        <PanelTitle icon={Building2} title="Edit Company Account" />
        <form className="form-grid two" onSubmit={saveCompanyAccount}>
          <Field label="Company Name" name="name" value={forms.company_account.name} onChange={setPlatformForm('company_account')} required />
          <Field label="Registration Number" name="registration_number" value={forms.company_account.registration_number} onChange={setPlatformForm('company_account')} />
          <Field label="Industry" name="industry" value={forms.company_account.industry} onChange={setPlatformForm('company_account')} />
          <Select label="Status" name="status" value={forms.company_account.status} onChange={setPlatformForm('company_account')}>
            {catalogCompanyStatuses.filter((status) => status !== 'archived').map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
          </Select>
          <Select label="Subscription Plan" name="subscription_plan_id" value={forms.company_account.subscription_plan_id} onChange={setPlatformForm('company_account')}>
            <option value="">No plan</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </Select>
          <PickerField label="Country" name="country" value={forms.company_account.country} options={countryOptions} onChange={setPlatformForm('company_account')} searchPlaceholder="Search countries" />
          <PickerField label="Currency" name="currency" value={forms.company_account.currency} options={currencyOptions} onChange={setPlatformForm('company_account')} searchPlaceholder="Search currencies" />
          <Field label="City" name="city" value={forms.company_account.city} onChange={setPlatformForm('company_account')} />
          <Field label="Address" name="address" value={forms.company_account.address} onChange={setPlatformForm('company_account')} />
          <Field label="Phone" name="phone" value={forms.company_account.phone} onChange={setPlatformForm('company_account')} />
          <Field label="Email" type="email" name="email" value={forms.company_account.email} onChange={setPlatformForm('company_account')} />
          <Field label="Website" type="url" name="website" value={forms.company_account.website} onChange={setPlatformForm('company_account')} />
          <Field label="Tax Number" name="tax_id" value={forms.company_account.tax_id} onChange={setPlatformForm('company_account')} />
          <Field label="Timezone" name="timezone" value={forms.company_account.timezone} onChange={setPlatformForm('company_account')} />
          <Field label="Language" name="language" value={forms.company_account.language} onChange={setPlatformForm('company_account')} />
          <Field label="Date Format" name="date_format" value={forms.company_account.date_format} onChange={setPlatformForm('company_account')} />
          <Field label="Fiscal Year Start" name="fiscal_year_start" value={forms.company_account.fiscal_year_start} onChange={setPlatformForm('company_account')} />
          <Field label="Storage Limit MB" type="number" name="storage_limit_mb" value={forms.company_account.storage_limit_mb} onChange={setPlatformForm('company_account')} />
          <Field label="Employee Limit" type="number" name="employee_limit" value={forms.company_account.employee_limit} onChange={setPlatformForm('company_account')} />
          <Field label="Project Limit" type="number" name="project_limit" value={forms.company_account.project_limit} onChange={setPlatformForm('company_account')} />
          <Field label="Branch Limit" type="number" name="branch_limit" value={forms.company_account.branch_limit} onChange={setPlatformForm('company_account')} />
          <div className="row-actions span-2">
            <button type="submit" className="primary-action"><CheckCircle2 size={17} />Update account</button>
            <button type="button" className="table-action danger" onClick={() => archiveCompany(company)}><Archive size={14} />Archive / Delete account</button>
          </div>
        </form>
      </section>
    )
  }

  function companyRevenue(company) {
    const workspace = company?.workspace || {}
    const platformBilling = workspace.billing_records || []
    const tenantInvoices = workspace.invoices || []
    const tenantPayments = workspace.payments || []

    return {
      platformRevenue: platformBilling.filter((record) => record.status === 'paid').reduce((total, record) => total + Number(record.amount || 0), 0),
      outstanding: platformBilling.filter((record) => record.record_type === 'invoice' && !['paid', 'void'].includes(record.status)).reduce((total, record) => total + Number(record.amount || 0), 0),
      tenantInvoiceValue: tenantInvoices.reduce((total, invoice) => total + Number(invoice.total_amount || 0), 0),
      tenantPayments: tenantPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
    }
  }

  function companyHealthSignals(company) {
    const workspace = company?.workspace || {}
    const success = company?.customer_success || {}
    const usage = company?.usage || {}
    const lastLogin = dateFrom(usage.last_login_at)
    const lastLoginDays = lastLogin ? Math.floor((Date.now() - lastLogin.getTime()) / 86400000) : null
    const openTickets = (workspace.support_tickets || []).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length
    const overdueBilling = (workspace.billing_records || []).filter((record) => record.record_type === 'invoice' && !['paid', 'void'].includes(record.status) && dateFrom(record.due_on) && dateFrom(record.due_on) < new Date()).length
    const securityAlerts = (workspace.security_events || []).filter((event) => ['open', 'investigating'].includes(event.status)).length
    const storagePressure = company?.storage_limit_mb ? Math.round((Number(usage.storage_mb || 0) / Math.max(1, Number(company.storage_limit_mb))) * 100) : null
    const renewalDate = dateFrom(success.renewal_date || company?.subscription?.renewal_at)
    const renewalDays = renewalDate ? Math.ceil((renewalDate - new Date()) / 86400000) : null

    return [
      { label: 'Company Health', value: `${company?.health_score || 0}%`, tone: Number(company?.health_score || 0) >= 80 ? 'healthy' : Number(company?.health_score || 0) >= 60 ? 'warning' : 'critical' },
      { label: 'Login Activity', value: lastLoginDays === null ? 'No logins' : lastLoginDays <= 7 ? 'Excellent' : `${lastLoginDays} days ago`, tone: lastLoginDays === null || lastLoginDays > 28 ? 'warning' : 'healthy' },
      { label: 'Payment', value: overdueBilling > 0 ? `${overdueBilling} overdue` : 'Healthy', tone: overdueBilling > 0 ? 'critical' : 'healthy' },
      { label: 'Support', value: openTickets > 0 ? `${openTickets} open` : 'Healthy', tone: openTickets > 0 ? 'warning' : 'healthy' },
      { label: 'Usage', value: Number(usage.score || 0) > 0 ? 'Excellent' : 'Low', tone: Number(usage.score || 0) > 0 ? 'healthy' : 'neutral' },
      { label: 'Security', value: securityAlerts > 0 ? `${securityAlerts} alert${securityAlerts === 1 ? '' : 's'}` : 'Good', tone: securityAlerts > 0 ? 'critical' : 'healthy' },
      { label: 'Storage', value: storagePressure === null ? `${usage.storage_mb || 0} MB` : `${storagePressure}%`, tone: storagePressure !== null && storagePressure >= 85 ? 'warning' : 'healthy' },
      { label: 'API', value: workspace.api?.access_enabled ? 'Healthy' : 'Not enabled', tone: workspace.api?.access_enabled ? 'healthy' : 'neutral' },
      { label: 'Automation', value: Number(usage.automation_runs || 0) > 0 ? 'Healthy' : 'Quiet', tone: Number(usage.automation_runs || 0) > 0 ? 'healthy' : 'neutral' },
      { label: 'Renewal', value: renewalDays === null ? 'Not set' : `${renewalDays} days`, tone: renewalDays !== null && renewalDays <= 30 ? 'warning' : 'healthy' },
    ]
  }

  function renderWorkspaceTabContent(company) {
    const workspace = company?.workspace || {}
    const success = company?.customer_success || {}
    const enabledModules = (company?.enabled_features || []).filter((feature) => feature.category === 'module')
    const revenue = companyRevenue(company)
    const healthSignals = companyHealthSignals(company)

    if (companyWorkspaceTab === 'overview') {
      return (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Company Health" />
            <div className="cloud-health-band">
              {healthSignals.map((signal) => (
                <div key={signal.label} className="cloud-health-cell compact">
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <Badge value={signal.tone} />
                </div>
              ))}
            </div>
            <div className="cloud-reason-list">
              {(company.health_reasons || []).map((reason, index) => <span key={`${reason.label}-${index}`} className={`cloud-reason ${reason.tone}`}>{reason.label}</span>)}
            </div>
          </section>
          <section className="panel">
            <PanelTitle icon={Handshake} title="Customer Success" />
            <div className="cloud-success-scorecard">
              <Metric label="Health" value={`${success.health_score || company.health_score || 0}%`} />
              <Metric label="Risk" value={success.risk_percent === null || success.risk_percent === undefined ? 'Low' : `${success.risk_percent}%`} />
              <Metric label="Renewal" value={success.renewal_date ? shortDate(success.renewal_date) : 'Not set'} />
              <Metric label="Adoption" value={success.adoption_percent === null || success.adoption_percent === undefined ? 'N/A' : `${success.adoption_percent}%`} />
              <Metric label="Training" value={success.training_completed_percent === null || success.training_completed_percent === undefined ? 'N/A' : `${success.training_completed_percent}%`} />
              <Metric label="Expansion" value={success.expansion_opportunity || 'None'} />
            </div>
            {renderSuccessForm()}
          </section>
          <section className="panel">
            <PanelTitle icon={Clock3} title="Company Timeline" />
            <div className="cloud-timeline">
              {(company.timeline || []).map((event, index) => (
                <article key={`${event.title}-${index}`}>
                  {(() => {
                    const Icon = tabIconMap[event.type] || Clock3
                    return <Icon size={15} />
                  })()}
                  <div>
                    <span>{timelineTime(event.occurred_at)}</span>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )
    }

    if (companyWorkspaceTab === 'subscription') return <section className="panel"><PanelTitle icon={WalletCards} title="Subscription" /><DataTable columns={['Subscription', 'Plan', 'Status', 'Amount', 'Interval', 'Seats', 'Renewal']} rows={company.subscription ? [[company.subscription.subscription_number, company.subscription.plan?.name || '', <Badge key="status" value={company.subscription.status} />, money(company.subscription.amount), labelize(company.subscription.billing_interval), company.subscription.seats || 'Unlimited', shortDate(company.subscription.renewal_at)]] : []} /></section>
    if (companyWorkspaceTab === 'modules') return <section className="panel"><PanelTitle icon={Layers3} title="Modules" /><div className="platform-feature-grid">{featureFlags.filter((flag) => flag.category === 'module').map((flag) => <button key={flag.id} type="button" className={`feature-toggle ${(company.enabled_features || []).some((feature) => feature.key === flag.key) ? 'enabled' : ''}`} onClick={() => runAction(() => api.updatePlatformCompanyFeature(company.id, flag.id, { is_enabled: !(company.enabled_features || []).some((feature) => feature.key === flag.key) }), 'Feature flag updated.')}><span>{flag.module}</span><strong>{flag.name}</strong><small>{flag.key}</small></button>)}</div></section>
    if (companyWorkspaceTab === 'account') return renderCompanyAccountForm(company)
    if (companyWorkspaceTab === 'users') return <section className="panel"><PanelTitle icon={Users} title="Users" /><DataTable columns={['Name', 'Email', 'Role', 'Branch', 'Status', 'Last Login']} rows={(workspace.users || []).map((user) => [user.name, user.email, user.role?.name || '', user.branch?.name || '', <Badge key="status" value={user.status} />, shortDate(user.last_login_at)])} /></section>
    if (companyWorkspaceTab === 'branches') return <section className="panel"><PanelTitle icon={Building2} title="Branches" /><DataTable columns={['Name', 'Code', 'City', 'Country', 'Email']} rows={(workspace.branches || []).map((branch) => [branch.name, branch.code, branch.city || '', branch.country, branch.email || ''])} /></section>
    if (companyWorkspaceTab === 'projects') return <section className="panel"><PanelTitle icon={FolderKanban} title="Projects" /><DataTable columns={['Code', 'Name', 'Status', 'Health', 'Value', 'Progress']} rows={(workspace.projects || []).map((project) => [project.code, project.name, <Badge key="status" value={project.status} />, <Badge key="health" value={project.health_status} />, money(project.contract_value), `${project.progress_percent || 0}%`])} /></section>
    if (companyWorkspaceTab === 'revenue') return <div className="grid-main"><section className="panel"><PanelTitle icon={WalletCards} title="Revenue" /><div className="cloud-success-scorecard"><Metric label="Platform Revenue" value={money(revenue.platformRevenue)} /><Metric label="Outstanding" value={money(revenue.outstanding)} /><Metric label="ERP Invoice Value" value={money(revenue.tenantInvoiceValue)} /><Metric label="ERP Payments" value={money(revenue.tenantPayments)} /></div></section><section className="panel"><PanelTitle icon={WalletCards} title="Invoices" /><DataTable columns={['Invoice', 'Title', 'Status', 'Total', 'Paid', 'Balance']} rows={(workspace.invoices || []).map((invoice) => [invoice.invoice_number, invoice.title, <Badge key="status" value={invoice.status} />, money(invoice.total_amount), money(invoice.amount_paid), money(invoice.balance_due)])} /></section></div>
    if (companyWorkspaceTab === 'payments') return <section className="panel"><PanelTitle icon={WalletCards} title="Payments" /><DataTable columns={['Payment', 'Invoice', 'Amount', 'Method', 'Received']} rows={(workspace.payments || []).map((payment) => [payment.payment_number, payment.invoice?.invoice_number || '', money(payment.amount), labelize(payment.method), shortDate(payment.received_at)])} /></section>
    if (companyWorkspaceTab === 'support') return <section className="panel"><PanelTitle icon={AlertTriangle} title="Support" /><DataTable columns={['Ticket', 'Title', 'Priority', 'Status', 'SLA']} rows={(workspace.support_tickets || []).map((ticket) => [ticket.ticket_number, ticket.title, <Badge key="priority" value={ticket.priority} />, <Badge key="status" value={ticket.status} />, shortDate(ticket.sla_due_at)])} /></section>
    if (companyWorkspaceTab === 'billing') return <section className="panel"><PanelTitle icon={WalletCards} title="Platform Billing" /><DataTable columns={['Record', 'Type', 'Status', 'Amount', 'Issued', 'Due']} rows={(workspace.billing_records || []).map((record) => [record.record_number, labelize(record.record_type), <Badge key="status" value={record.status} />, money(record.amount), shortDate(record.issued_on), shortDate(record.due_on)])} /></section>
    if (companyWorkspaceTab === 'branding') return renderBranding()
    if (companyWorkspaceTab === 'automation') return <section className="panel"><PanelTitle icon={Workflow} title="Automation" /><DataTable columns={['Metric', 'Value']} rows={[['Automation Runs', company.usage?.automation_runs || 0], ['Automation Features Enabled', enabledModules.filter((feature) => feature.module === 'automation').length]]} /></section>
    if (companyWorkspaceTab === 'security') return <section className="panel"><PanelTitle icon={ShieldCheck} title="Security" /><DataTable columns={['Event', 'Severity', 'Status', 'IP', 'Created']} rows={(workspace.security_events || []).map((event) => [labelize(event.event_type), <Badge key="severity" value={event.severity} />, <Badge key="status" value={event.status} />, event.ip_address || '', shortDate(event.created_at)])} /></section>
    if (companyWorkspaceTab === 'storage') return <section className="panel"><PanelTitle icon={FileText} title="Storage" /><div className="cloud-success-scorecard"><Metric label="Storage Used" value={`${company.usage?.storage_mb || 0} MB`} /><Metric label="Storage Limit" value={company.storage_limit_mb ? `${company.storage_limit_mb} MB` : 'Unlimited'} /><Metric label="Documents" value={company.usage?.documents || 0} /><Metric label="Backups" value={company.usage?.backups || 0} /></div></section>
    if (companyWorkspaceTab === 'audit') return <section className="panel"><PanelTitle icon={Clock3} title="Audit Logs" /><DataTable columns={['When', 'Action', 'Record', 'IP']} rows={(workspace.audit_logs || []).map((log) => [timelineTime(log.created_at), labelize(log.action), String(log.auditable_type || '').split('\\').pop(), log.ip_address || ''])} /></section>
    if (companyWorkspaceTab === 'backups') return <section className="panel"><PanelTitle icon={Download} title="Backups" /><DataTable columns={['Backup', 'Type', 'Status', 'Size', 'Started']} rows={(workspace.backups || []).map((backup) => [backup.backup_number, labelize(backup.backup_type), <Badge key="status" value={backup.status} />, `${backup.size_mb || 0} MB`, shortDate(backup.started_at)])} /></section>
    if (companyWorkspaceTab === 'api') return <section className="panel"><PanelTitle icon={Workflow} title="API" /><DataTable columns={['Control', 'Value']} rows={[['API Access', workspace.api?.access_enabled ? 'Enabled' : 'Disabled'], ['API Calls', workspace.api?.api_calls || 0]]} /></section>
    if (companyWorkspaceTab === 'domains') return <section className="panel"><PanelTitle icon={Globe2} title="Domains" /><DataTable columns={['Type', 'Value', 'Status']} rows={(workspace.domains || []).map((domain) => [labelize(domain.type), domain.value || '', <Badge key="status" value={domain.status} />])} /></section>
    if (companyWorkspaceTab === 'integrations') return <section className="panel"><PanelTitle icon={Layers3} title="Integrations" /><DataTable columns={['Provider', 'Name', 'Category', 'Status']} rows={(workspace.integrations || []).map((item) => [item.provider, item.name, labelize(item.category), <Badge key="status" value={item.status} />])} /></section>
    if (companyWorkspaceTab === 'settings') return <section className="panel"><PanelTitle icon={Settings} title="Settings" /><DataTable columns={['Setting', 'Value']} rows={Object.entries(company.settings || {}).map(([key, value]) => [labelize(key), typeof value === 'object' ? JSON.stringify(value) : String(value)])} /></section>
    if (companyWorkspaceTab === 'timeline') return <section className="panel"><PanelTitle icon={Clock3} title="Activity Timeline" /><div className="cloud-timeline">{(company.timeline || []).map((event, index) => { const Icon = tabIconMap[event.type] || Clock3; return <article key={`${event.title}-${index}`}><Icon size={15} /><div><span>{timelineTime(event.occurred_at)}</span><strong>{event.title}</strong><small>{event.detail}</small></div></article> })}</div></section>
    if (companyWorkspaceTab === 'analytics') return <div className="grid-main"><ChartPanel icon={BarChart3} title="Usage Analytics"><AnalyticsBarChart data={Object.entries(company.usage || {}).map(([key, value]) => ({ metric: labelize(key), value: Number(value || 0) })).filter((item) => Number.isFinite(item.value))} xKey="metric" bars={[{ key: 'value', color: '#2364d8' }]} /></ChartPanel><section className="panel"><PanelTitle icon={BarChart3} title="Analytics Summary" /><DataTable columns={['Metric', 'Value']} rows={Object.entries(company.usage || {}).map(([key, value]) => [labelize(key), String(value ?? '')])} /></section></div>

    return <section className="panel"><PanelTitle icon={BarChart3} title="Usage" /><DataTable columns={['Metric', 'Value']} rows={Object.entries(company.usage || {}).map(([key, value]) => [labelize(key), String(value ?? '')])} /></section>
  }

  function renderCompanyWorkspace() {
    const workspaceTabs = ['overview', 'account', 'subscription', 'modules', 'users', 'branches', 'projects', 'revenue', 'usage', 'storage', 'automation', 'security', 'integrations', 'audit', 'backups', 'settings', 'branding', 'support', 'timeline', 'analytics']

    return (
      <section className="cloud-company-workspace">
        <aside className="cloud-company-list">
          <div className="cloud-list-head">
            <div>
              <strong>Companies</strong>
              <span>{companies.length} active</span>
            </div>
            <button type="button" className="table-action" onClick={openProvisioningWizard}><Plus size={14} />Provision</button>
          </div>
          {companies.map((company) => (
            <button key={company.id} type="button" className={String(selectedCompany?.id) === String(company.id) ? 'active' : ''} onClick={() => selectWorkspaceCompany(company.id)}>
              <div className="cloud-company-logo">{initials(company.name)}</div>
              <div>
                <strong>{company.name}</strong>
                <span>{company.country} | {company.subscription?.plan?.name || 'No plan'} | Renewal {shortDate(company.subscription?.renewal_at)}</span>
                <small>{company.usage?.projects || 0} projects | {company.usage?.users || 0} users | {company.storage_limit_mb ? `${Math.round((Number(company.usage?.storage_mb || 0) / Math.max(1, Number(company.storage_limit_mb))) * 100)}% storage` : `${company.usage?.storage_mb || 0} MB storage`}</small>
              </div>
              <Badge value={Number(company.health_score || 0) >= 80 ? 'healthy' : Number(company.health_score || 0) >= 60 ? 'warning' : 'critical'} />
            </button>
          ))}
          <div className="cloud-archived-list">
            <div className="cloud-archive-head">
              <strong>Archived Accounts</strong>
              <span>{archivedCompanies.length}</span>
            </div>
            {archivedCompanies.length > 0 ? (
              archivedCompanies.map((company) => (
                <article key={company.id}>
                  <div>
                    <span>{company.name}</span>
                    <small>{company.tenant_key} | {shortDate(company.deleted_at)}</small>
                  </div>
                  <div className="cloud-archived-actions">
                    <button type="button" className="table-action" onClick={() => restoreCompany(company)}><RefreshCcw size={14} />Reinstate</button>
                    <button type="button" className="table-action danger" onClick={() => deleteArchivedCompany(company)}><Trash2 size={14} />Delete</button>
                  </div>
                </article>
              ))
            ) : (
              <p className="cloud-archive-empty">No archived company accounts.</p>
            )}
          </div>
        </aside>
        <main className="cloud-company-main">
          {selectedCompany ? (
            <>
              <header className="cloud-company-header">
                <div className="cloud-company-heading">
                  <span>{selectedCompany.tenant_key}</span>
                  <h2>{selectedCompany.name}</h2>
                  <small>{selectedCompany.country} | {selectedCompany.default_currency} | {selectedCompany.subscription?.plan?.name || 'No subscription'}</small>
                  <div className="cloud-company-actions">
                    <button type="button" className="table-action" onClick={() => setCompanyWorkspaceTab('account')}><Settings size={14} />Edit account</button>
                    <button type="button" className="table-action danger" onClick={() => archiveCompany(selectedCompany)}><Archive size={14} />Archive / Delete</button>
                  </div>
                </div>
                <div className="cloud-status-meta">
                  <Metric label="Health" value={`${selectedCompany.health_score || 0}%`} />
                  <Metric label="Users" value={selectedCompany.usage?.users || 0} />
                  <Metric label="Projects" value={selectedCompany.usage?.projects || 0} />
                  <Metric label="Renewal" value={shortDate(selectedCompany.subscription?.renewal_at) || 'Not set'} />
                </div>
              </header>
              <nav className="module-tabs cloud-workspace-tabs" aria-label="Company workspace">
                {workspaceTabs.map((tab) => {
                  const Icon = tabIconMap[tab] || BarChart3
                  return <button key={tab} type="button" className={companyWorkspaceTab === tab ? 'active' : ''} onClick={() => setCompanyWorkspaceTab(tab)}><Icon size={14} />{labelize(tab)}</button>
                })}
              </nav>
              {renderWorkspaceTabContent(selectedCompany)}
            </>
          ) : (
            <section className="panel"><PanelTitle icon={Building2} title="No Company Selected" /></section>
          )}
        </main>
        {wizardOpen && renderProvisioningWizard()}
      </section>
    )
  }

  function renderProvisioningWizard() {
    const steps = ['Company Information', 'Subscription', 'Modules', 'Branding', 'Administrator', 'Review']
    const moduleFlags = featureFlags.filter((flag) => flag.category === 'module')
    const selectedKeys = new Set(forms.company.enabled_feature_keys || [])
    const provisioningReady = Boolean(
      forms.company.name?.trim()
      && forms.company.country
      && forms.company.currency
      && forms.company.primary_contact_name?.trim()
      && forms.company.primary_contact_email?.trim(),
    )

    async function provisionCompanyFromButton() {
      if (wizardStep !== steps.length || !provisioningReady || provisioning) return

      setProvisioning(true)
      try {
        const result = await createCompany()
        if (result) {
          setWizardOpen(false)
          setWizardStep(1)
        }
      } finally {
        setProvisioning(false)
      }
    }

    return (
      <section className="cloud-wizard">
        <div className="cloud-wizard-card">
          <header>
            <div>
              <h2>{steps[wizardStep - 1]}</h2>
            </div>
            <button type="button" className="table-action" onClick={() => setWizardOpen(false)}>Close</button>
          </header>
          <div className="cloud-wizard-steps">
            {steps.map((step, index) => <button key={step} type="button" className={wizardStep === index + 1 ? 'active' : ''} onClick={() => setWizardStep(index + 1)}>{index + 1}</button>)}
          </div>

          <form key={wizardInstance} className="form-grid two" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <div className="cloud-autofill-decoys" aria-hidden="true">
              <input type="text" name={`provisioning-decoy-username-${wizardInstance}`} autoComplete="username" tabIndex={-1} defaultValue="" />
              <input type="password" name={`provisioning-decoy-password-${wizardInstance}`} autoComplete="current-password" tabIndex={-1} defaultValue="" />
            </div>
            {wizardStep === 1 && (
              <>
                <Field label="Company Name" name="name" value={forms.company.name} onChange={setPlatformForm('company')} required />
                <Field label="Industry" name="industry" value={forms.company.industry} onChange={setPlatformForm('company')} />
                <PickerField label="Country" name="country" value={forms.company.country} options={countryOptions} onChange={setPlatformForm('company')} searchPlaceholder="Search countries" />
                <PickerField label="Currency" name="currency" value={forms.company.currency} options={currencyOptions} onChange={setPlatformForm('company')} searchPlaceholder="Search currencies" />
                <Field label="City" name="city" value={forms.company.city} onChange={setPlatformForm('company')} />
                <Field label="Timezone" name="timezone" value={forms.company.timezone} onChange={setPlatformForm('company')} />
              </>
            )}
            {wizardStep === 2 && (
              <>
                <Select label="Subscription Plan" name="subscription_plan_id" value={forms.company.subscription_plan_id} onChange={(event) => seedModulesFromPlan(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {money(plan.monthly_price)}/mo</option>)}</Select>
                <Select label="Status" name="status" value={forms.company.status} onChange={setPlatformForm('company')}>{catalogCompanyStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</Select>
                <Field label="Trial Days" type="number" name="trial_days" value={forms.company.trial_days} onChange={setPlatformForm('company')} />
                <Field label="Storage Limit MB" type="number" name="storage_limit_mb" value={forms.company.storage_limit_mb} onChange={setPlatformForm('company')} />
                <Field label="Employee Limit" type="number" name="employee_limit" value={forms.company.employee_limit} onChange={setPlatformForm('company')} />
                <Field label="Project Limit" type="number" name="project_limit" value={forms.company.project_limit} onChange={setPlatformForm('company')} />
              </>
            )}
            {wizardStep === 3 && (
              <div className="platform-feature-grid span-2">
                {moduleFlags.map((flag) => <button key={flag.key} type="button" className={`feature-toggle ${selectedKeys.has(flag.key) ? 'enabled' : ''}`} onClick={() => toggleProvisioningModule(flag.key)}><span>{flag.module}</span><strong>{flag.name}</strong><small>{flag.key}</small></button>)}
              </div>
            )}
            {wizardStep === 4 && (
              <>
                <Field label="Primary Color" name="primary_color" value={forms.branding.primary_color} onChange={setPlatformForm('branding')} />
                <Field label="Secondary Color" name="secondary_color" value={forms.branding.secondary_color} onChange={setPlatformForm('branding')} />
                <Field label="Accent Color" name="accent_color" value={forms.branding.accent_color} onChange={setPlatformForm('branding')} />
                <Field label="Sidebar Color" name="sidebar_color" value={forms.branding.sidebar_color} onChange={setPlatformForm('branding')} />
                <Field label="Button Color" name="button_color" value={forms.branding.button_color} onChange={setPlatformForm('branding')} />
                <TextArea className="span-2" label="Login Welcome Message" name="login_welcome_message" value={forms.branding.login_welcome_message} onChange={setPlatformForm('branding')} />
              </>
            )}
            {wizardStep === 5 && (
              <>
                <Field label="Primary Admin" name="primary_contact_name" value={forms.company.primary_contact_name} onChange={setPlatformForm('company')} autoComplete="off" required />
                <Field label="Admin Email" type="email" name="primary_contact_email" value={forms.company.primary_contact_email} onChange={setPlatformForm('company')} autoComplete={`section-provisioning-${wizardInstance} new-password`} required />
                <Field label="Admin Phone" name="primary_contact_phone" value={forms.company.primary_contact_phone} onChange={setPlatformForm('company')} inputMode="tel" autoComplete="off" />
                <Field label="Temporary Password" type="password" name={`admin_password_${wizardInstance}`} value={forms.company.admin_password} onChange={(event) => setPlatformForm('company')({ target: { name: 'admin_password', value: event.target.value } })} placeholder="Auto-generated if blank" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" />
              </>
            )}
            {wizardStep === 6 && (
              <section className="span-2 cloud-review">
                <Metric label="Company" value={forms.company.name || 'Not set'} />
                <Metric label="Plan" value={selectedPlan()?.name || 'Not set'} />
                <Metric label="Modules" value={(forms.company.enabled_feature_keys || []).filter((key) => key.startsWith('module.')).length} />
                <Metric label="Admin" value={forms.company.primary_contact_name || 'Not set'} />
              </section>
            )}
            {error && <p className="form-error span-2" role="alert" aria-live="assertive">{error}</p>}
            <div className="row-actions span-2">
              <button type="button" className="table-action" disabled={wizardStep === 1 || provisioning} onClick={() => setWizardStep((current) => Math.max(1, current - 1))}>Back</button>
              {wizardStep < steps.length ? (
                <button type="button" className="primary-action" onClick={() => setWizardStep((current) => Math.min(steps.length, current + 1))}>Next</button>
              ) : (
                <button
                  type="button"
                  className="primary-action"
                  disabled={!provisioningReady || provisioning}
                  title={provisioningReady ? 'Provision Company' : 'Complete company and primary admin details first'}
                  onClick={provisionCompanyFromButton}
                >
                  {provisioning ? <RefreshCcw size={17} className="spin" /> : <Plus size={17} />}
                  {provisioning ? 'Provisioning...' : 'Provision Company'}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    )
  }

  function renderCustomerSuccess() {
    const atRiskCompanies = companies.filter((company) => Number(company.health_score || 0) < 70)
    const needsFollowUp = companies.filter((company) => {
      const success = company.customer_success || {}
      const nextMeeting = dateFrom(success.next_meeting_at)
      return Number(company.health_score || 0) < 80 || (nextMeeting && nextMeeting <= new Date(Date.now() + 7 * 86400000))
    })
    const trainingPending = companies.filter((company) => Number(company.customer_success?.training_completed_percent ?? 100) < 80)
    const averageAdoption = companies.length ? Math.round(companies.reduce((total, company) => total + Number(company.customer_success?.adoption_percent || 0), 0) / companies.length) : 0

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={ShieldCheck} label="Customer Health" value={`${companies.length ? Math.round(companies.reduce((total, company) => total + Number(company.health_score || 0), 0) / companies.length) : 0}%`} sub={`${atRiskCompanies.length} at risk`} />
          <Kpi icon={Handshake} label="Adoption" value={`${averageAdoption}%`} sub={`${trainingPending.length} training plans pending`} />
          <Kpi icon={CalendarDays} label="Renewals Due" value={renewalSubscriptions.length} sub="Next 30 days" />
          <Kpi icon={WalletCards} label="Expansion Pipeline" value={companies.filter((company) => company.customer_success?.expansion_opportunity).length} sub="Accounts with opportunity" />
          <Kpi icon={AlertTriangle} label="Needs Follow-up" value={needsFollowUp.length} sub="Health, renewal, or meeting signal" />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Handshake} title="Customer Success Portfolio" />
            <DataTable
              columns={['Company', 'Health', 'Risk', 'Adoption', 'Training', 'Renewal', 'Expansion', 'Manager']}
              rows={companies.map((company) => {
                const success = company.customer_success || {}
                return [
                  company.name,
                  `${company.health_score || 0}%`,
                  success.risk_percent === null || success.risk_percent === undefined ? 'Low' : `${success.risk_percent}%`,
                  success.adoption_percent === null || success.adoption_percent === undefined ? 'N/A' : `${success.adoption_percent}%`,
                  success.training_completed_percent === null || success.training_completed_percent === undefined ? 'N/A' : `${success.training_completed_percent}%`,
                  success.renewal_date ? shortDate(success.renewal_date) : shortDate(company.subscription?.renewal_at),
                  success.expansion_opportunity || '',
                  success.success_manager || '',
                ]
              })}
            />
          </section>
          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Follow-up Queue" />
            <div className="cloud-activity-feed">
              {needsFollowUp.slice(0, 10).map((company) => (
                <article key={company.id}>
                  <Building2 size={15} />
                  <div>
                    <span>{company.subscription?.plan?.name || 'No plan'}</span>
                    <strong>{company.name}</strong>
                    <small>{(company.health_reasons || [])[0]?.label || company.customer_success?.expansion_opportunity || 'Customer success review'}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    )
  }

  function renderExecutive() {
    return (
      <>
        <div className="kpi-grid platform-kpi-grid">
          <Kpi icon={WalletCards} label="MRR" value={money(summary.monthly_recurring_revenue || 0)} sub={`ARR ${money(summary.annual_recurring_revenue || 0)}`} />
          <Kpi icon={WalletCards} label="Revenue Today" value={money(summary.revenue_today || 0)} sub={`Week ${money(summary.revenue_this_week || 0)}`} />
          <Kpi icon={BarChart3} label="Revenue This Month" value={money(summary.revenue_this_month || 0)} sub={`Forecast ${money((summary.monthly_recurring_revenue || 0) + (summary.outstanding_invoice_amount || 0))}`} />
          <Kpi icon={Building2} label="Customer Growth" value={(summary.new_companies_this_month || 0) - (summary.cancelled_companies_this_month || 0)} sub={`${summary.new_companies_this_month || 0} new, ${summary.cancelled_companies_this_month || 0} cancelled`} />
          <Kpi icon={CheckCircle2} label="Trials & Conversions" value={summary.trial_companies || 0} sub={`${summary.converted_companies_this_month || 0} converted this month`} />
          <Kpi icon={WalletCards} label="Average Subscription" value={money(summary.average_revenue_per_account || 0)} sub={`${summary.churn_rate || 0}% churn`} />
          <Kpi icon={CalendarDays} label="Renewals" value={summary.renewals_due_30_days || renewalSubscriptions.length} sub="Due within 30 days" />
          <Kpi icon={FileText} label="Outstanding Invoices" value={summary.outstanding_invoices || outstandingBillingRecords.length} sub={money(summary.outstanding_invoice_amount || 0)} />
          <Kpi icon={AlertTriangle} label="Support SLA" value={summary.support_sla_compliance === null || summary.support_sla_compliance === undefined ? 'N/A' : `${summary.support_sla_compliance}%`} sub={`${summary.support_tickets_open || 0} open tickets`} />
          <Kpi icon={ActivityIcon} label="Platform Health" value={summary.platform_uptime === null || summary.platform_uptime === undefined ? 'Not set' : `${summary.platform_uptime}%`} sub={`${summary.failed_background_jobs || 0} failed jobs`} />
        </div>
        <div className="grid-main">
          <ChartPanel icon={WalletCards} title="Monthly Revenue">
            <AnalyticsBarChart data={analytics.monthly_revenue || []} xKey="month" bars={[{ key: 'revenue', color: '#2364d8' }]} />
          </ChartPanel>
          <ChartPanel icon={Building2} title="Customer Growth">
            <AnalyticsBarChart data={analytics.company_growth || []} xKey="month" bars={[{ key: 'companies', color: '#188a5a' }]} />
          </ChartPanel>
        </div>
        <div className="grid-main">
          <ChartPanel icon={Layers3} title="Module Adoption">
            <AnalyticsBarChart data={analytics.module_adoption || []} xKey="module" bars={[{ key: 'companies', color: '#b66a05' }]} />
          </ChartPanel>
          <ChartPanel icon={Globe2} title="Companies by Country">
            <AnalyticsBarChart data={analytics.companies_by_country || []} xKey="country" bars={[{ key: 'companies', color: '#6d5dfc' }]} />
          </ChartPanel>
        </div>
      </>
    )
  }

  function renderSubscriptions() {
    const isEditingPlan = Boolean(forms.plan.id)
    const selectedSubscription = subscriptions.find((subscription) => String(subscription.id) === String(forms.subscription.id))

    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Plus} title={isEditingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'} />
          <form className="form-grid platform-plan-form" onSubmit={createPlan}>
            <Field label="Code" name="code" value={forms.plan.code} onChange={setPlatformForm('plan')} />
            <Field label="Name" name="name" value={forms.plan.name} onChange={setPlatformForm('plan')} required />
            <Select label="Status" name="status" value={forms.plan.status} onChange={setPlatformForm('plan')}>
              {catalogPlanStatuses.filter((status) => status !== 'archived').map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
            </Select>
            <PickerField label="Currency" name="currency" value={forms.plan.currency} options={currencyOptions} onChange={setPlatformForm('plan')} searchPlaceholder="Search currencies" />
            <Field label="Monthly Price" type="number" name="monthly_price" value={forms.plan.monthly_price} onChange={setPlatformForm('plan')} />
            <Field label="Yearly Price" type="number" name="yearly_price" value={forms.plan.yearly_price} onChange={setPlatformForm('plan')} />
            <Field label="Maximum Users" type="number" name="maximum_users" value={forms.plan.maximum_users} onChange={setPlatformForm('plan')} />
            <Field label="Maximum Projects" type="number" name="maximum_projects" value={forms.plan.maximum_projects} onChange={setPlatformForm('plan')} />
            <Field label="Storage MB" type="number" name="maximum_storage_mb" value={forms.plan.maximum_storage_mb} onChange={setPlatformForm('plan')} />
            <Select label="Support" name="support_level" value={forms.plan.support_level} onChange={setPlatformForm('plan')}>
              {catalogSupportLevels.map((level) => <option key={level} value={level}>{labelize(level)}</option>)}
            </Select>
            <Select label="API Access" name="api_access" value={forms.plan.api_access} onChange={setPlatformForm('plan')}><option value="true">Enabled</option><option value="false">Disabled</option></Select>
            <Select label="Custom Branding" name="custom_branding" value={forms.plan.custom_branding} onChange={setPlatformForm('plan')}><option value="true">Enabled</option><option value="false">Disabled</option></Select>
            <Select label="SSO" name="sso_available" value={forms.plan.sso_available} onChange={setPlatformForm('plan')}><option value="true">Enabled</option><option value="false">Disabled</option></Select>
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">{isEditingPlan ? <CheckCircle2 size={17} /> : <Plus size={17} />}{isEditingPlan ? 'Save plan' : 'Create plan'}</button>
              {isEditingPlan && <button type="button" className="table-action" onClick={resetPlatformPlanForm}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Edit / Upgrade Subscription" />
          <form className="form-grid platform-plan-form" onSubmit={saveSubscription}>
            <Select label="Subscription" name="id" value={forms.subscription.id} onChange={(event) => {
              const subscription = subscriptions.find((item) => String(item.id) === String(event.target.value))
              if (subscription) editPlatformSubscription(subscription)
              else setPlatformForms((current) => ({ ...current, subscription: emptyPlatformForms.subscription }))
            }}>
              <option value="">Select subscription</option>
              {subscriptions.map((subscription) => <option key={subscription.id} value={subscription.id}>{subscription.company?.name || 'Company'} - {subscription.subscription_number}</option>)}
            </Select>
            <Select label="Plan" name="platform_subscription_plan_id" value={forms.subscription.platform_subscription_plan_id} onChange={setPlatformForm('subscription')}>
              <option value="">Select plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {money(plan.monthly_price)}/mo</option>)}
            </Select>
            <Select label="Status" name="status" value={forms.subscription.status} onChange={setPlatformForm('subscription')}>
              {catalogSubscriptionStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
            </Select>
            <Select label="Billing Interval" name="billing_interval" value={forms.subscription.billing_interval} onChange={setPlatformForm('subscription')}>
              {catalogBillingIntervals.map((interval) => <option key={interval} value={interval}>{labelize(interval)}</option>)}
            </Select>
            <Field label="Amount" type="number" name="amount" value={forms.subscription.amount} onChange={setPlatformForm('subscription')} />
            <PickerField label="Currency" name="currency" value={forms.subscription.currency} options={currencyOptions} onChange={setPlatformForm('subscription')} searchPlaceholder="Search currencies" />
            <Field label="Seats" type="number" name="seats" value={forms.subscription.seats} onChange={setPlatformForm('subscription')} />
            <Field label="Renewal Date" type="date" name="renewal_at" value={forms.subscription.renewal_at} onChange={setPlatformForm('subscription')} />
            <div className="row-actions span-2">
              <button type="submit" className="primary-action"><CheckCircle2 size={17} />Save subscription</button>
              <button type="button" className="primary-action" onClick={upgradeSubscription} disabled={!selectedSubscription}><Upload size={17} />Upgrade subscription</button>
              <button type="button" className="table-action" onClick={() => setPlatformForms((current) => ({ ...current, subscription: emptyPlatformForms.subscription }))}>Clear</button>
            </div>
          </form>
        </section>

        <section className="panel span-2">
          <PanelTitle icon={WalletCards} title="Subscription Plans" />
          <DataTable
            columns={['Plan', 'Status', 'Monthly', 'Yearly', 'Users', 'Projects', 'Storage', 'Support', 'Subscribers', 'Actions']}
            rows={plans.map((plan) => [
              plan.name,
              <Badge key="status" value={plan.status} />,
              money(plan.monthly_price),
              money(plan.yearly_price),
              plan.maximum_users || 'Unlimited',
              plan.maximum_projects || 'Unlimited',
              plan.maximum_storage_mb || 'Unlimited',
              labelize(plan.support_level),
              plan.subscriptions_count || 0,
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editPlatformPlan(plan)}>Edit</button>
                <button type="button" className="table-action danger" onClick={() => deletePlan(plan)}>Delete</button>
              </div>,
            ])}
          />
        </section>

        <section className="panel span-2">
          <PanelTitle icon={WalletCards} title="Company Subscriptions" />
          <DataTable
            columns={['Subscription', 'Company', 'Plan', 'Status', 'Amount', 'Interval', 'Seats', 'Renewal', 'Actions']}
            rows={subscriptions.map((subscription) => [
              subscription.subscription_number,
              subscription.company?.name || '',
              subscription.plan?.name || '',
              <Badge key="status" value={subscription.status} />,
              money(subscription.amount),
              labelize(subscription.billing_interval),
              subscription.seats || 'Unlimited',
              shortDate(subscription.renewal_at),
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editPlatformSubscription(subscription)}>Edit</button>
                <button type="button" className="table-action" onClick={() => editPlatformSubscription(subscription, 'upgrade')}>Upgrade</button>
                <button type="button" className="table-action danger" onClick={() => deleteSubscription(subscription)}>Delete</button>
              </div>,
            ])}
          />
        </section>
      </div>
    )
  }

  function renderFeatures() {
    const selectedFeature = featureFlags.find((flag) => String(flag.id) === String(forms.feature.id))
    const featureGroups = Object.entries(featureFlags.reduce((groups, flag) => {
      const group = flag.key?.includes('ai') ? 'AI' : flag.key?.includes('integration') ? 'Integrations' : moduleLabel(flag.module || flag.category)
      groups[group] = [...(groups[group] || []), flag]
      return groups
    }, {})).sort(([a], [b]) => a.localeCompare(b))

    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Layers3} title="Company Feature Flags" />
          {renderCompanySelector('feature_company')}
          <div className="cloud-feature-groups">
            {featureGroups.map(([group, flags]) => (
              <section key={group}>
                <div className="cloud-feature-group-head">
                  <Layers3 size={15} />
                  <strong>{group}</strong>
                  <span>{flags.filter((flag) => featureEnabledForSelected(flag)).length}/{flags.length}</span>
                </div>
                <div className="platform-feature-grid">
                  {flags.map((flag) => (
                    <button key={flag.id} type="button" className={`feature-toggle ${featureEnabledForSelected(flag) ? 'enabled' : ''}`} onClick={() => toggleSelectedFeature(flag)}>
                      <span>{labelize(flag.category)}</span>
                      <strong>{flag.name}</strong>
                      <small>{flag.key}</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={BarChart3} title="Feature Release Settings" />
          <form className="form-grid" onSubmit={saveFeature}>
            <Select label="Feature" name="id" value={forms.feature.id} onChange={(event) => {
              const flag = featureFlags.find((item) => String(item.id) === String(event.target.value))
              if (flag) editPlatformFeature(flag)
              else setPlatformForms((current) => ({ ...current, feature: emptyPlatformForms.feature }))
            }}>
              <option value="">Select feature</option>
              {featureFlags.map((flag) => <option key={flag.id} value={flag.id}>{flag.name}</option>)}
            </Select>
            <Field label="Name" name="name" value={forms.feature.name} onChange={setPlatformForm('feature')} disabled={!selectedFeature} />
            <Field label="Module" name="module" value={forms.feature.module} onChange={setPlatformForm('feature')} disabled={!selectedFeature} />
            <Select label="Category" name="category" value={forms.feature.category} onChange={setPlatformForm('feature')} disabled={!selectedFeature}>
              <option value="module">Module</option>
              <option value="feature">Feature</option>
            </Select>
            <Select label="Rollout Status" name="rollout_status" value={forms.feature.rollout_status} onChange={setPlatformForm('feature')} disabled={!selectedFeature}>
              {['planned', 'beta', 'active', 'paused', 'retired'].map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
            </Select>
            <Field label="Rollout %" type="number" name="rollout_percentage" value={forms.feature.rollout_percentage} onChange={setPlatformForm('feature')} disabled={!selectedFeature} />
            <Select label="Default Enabled" name="default_enabled" value={forms.feature.default_enabled} onChange={setPlatformForm('feature')} disabled={!selectedFeature}><option value="true">Enabled</option><option value="false">Disabled</option></Select>
            <Select label="Requires Subscription" name="requires_subscription" value={forms.feature.requires_subscription} onChange={setPlatformForm('feature')} disabled={!selectedFeature}><option value="true">Required</option><option value="false">Optional</option></Select>
            <Field label="Pricing Tier" name="pricing_tier" value={forms.feature.pricing_tier} onChange={setPlatformForm('feature')} disabled={!selectedFeature} />
            <TextArea className="span-2" label="Description" name="description" value={forms.feature.description} onChange={setPlatformForm('feature')} disabled={!selectedFeature} />
            <button type="submit" className="primary-action span-2" disabled={!selectedFeature}><CheckCircle2 size={17} />Save feature release</button>
          </form>
        </section>
        <section className="panel span-2">
          <PanelTitle icon={BarChart3} title="Feature Usage" />
          <DataTable
            columns={['Feature', 'Module', 'Category', 'Status', 'Rollout', 'Enabled Companies', 'Actions']}
            rows={featureFlags.map((flag) => [
              flag.name,
              moduleLabel(flag.module),
              labelize(flag.category),
              <Badge key="status" value={flag.rollout_status} />,
              `${flag.rollout_percentage}%`,
              flag.enabled_companies_count || 0,
              <button key="edit" type="button" className="table-action" onClick={() => editPlatformFeature(flag)}>Edit</button>,
            ])}
          />
        </section>
      </div>
    )
  }

  function renderBranding() {
    return (
      <section className="panel">
        <PanelTitle icon={Settings} title="Branding Management" />
        <form className="form-grid platform-branding-form" onSubmit={saveBranding}>
          {renderCompanySelector('branding')}
          <Field label="Primary Color" name="primary_color" value={forms.branding.primary_color} onChange={setPlatformForm('branding')} />
          <Field label="Secondary Color" name="secondary_color" value={forms.branding.secondary_color} onChange={setPlatformForm('branding')} />
          <Field label="Accent Color" name="accent_color" value={forms.branding.accent_color} onChange={setPlatformForm('branding')} />
          <Field label="Sidebar Color" name="sidebar_color" value={forms.branding.sidebar_color} onChange={setPlatformForm('branding')} />
          <Field label="Button Color" name="button_color" value={forms.branding.button_color} onChange={setPlatformForm('branding')} />
          <Field label="Typography" name="typography" value={forms.branding.typography} onChange={setPlatformForm('branding')} />
          <Field label="Company Motto" name="company_motto" value={forms.branding.company_motto} onChange={setPlatformForm('branding')} />
          <Field label="Logo" type="file" name="logo" onChange={setBrandingFile} />
          <Field label="Dark Logo" type="file" name="dark_logo" onChange={setBrandingFile} />
          <Field label="Light Logo" type="file" name="light_logo" onChange={setBrandingFile} />
          <Field label="Favicon" type="file" name="favicon" onChange={setBrandingFile} />
          <Field label="Login Background" type="file" name="login_background" onChange={setBrandingFile} />
          <Field label="Dashboard Background" type="file" name="dashboard_background" onChange={setBrandingFile} />
          <Field label="Watermark" type="file" name="watermark" onChange={setBrandingFile} />
          <TextArea className="span-2" label="Login Welcome Message" name="login_welcome_message" value={forms.branding.login_welcome_message} onChange={setPlatformForm('branding')} />
          <button type="submit" className="primary-action"><Upload size={17} />Save branding</button>
        </form>
      </section>
    )
  }

  function renderBilling() {
    const paymentRows = billingRecords.filter((record) => ['payment', 'refund', 'failed_payment'].includes(record.record_type))
    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={WalletCards} label="MRR" value={money(summary.monthly_recurring_revenue || 0)} sub={`ARR ${money(summary.annual_recurring_revenue || 0)}`} />
          <Kpi icon={WalletCards} label="Revenue This Month" value={money(summary.revenue_this_month || 0)} sub={`Today ${money(summary.revenue_today || 0)}`} />
          <Kpi icon={FileText} label="Outstanding" value={money(summary.outstanding_invoice_amount || outstandingBillingRecords.reduce((total, record) => total + Number(record.amount || 0), 0))} sub={`${summary.outstanding_invoices || outstandingBillingRecords.length} invoices`} />
          <Kpi icon={AlertTriangle} label="Failed Payments" value={failedPayments.length} sub="Gateway or payment failures" />
          <Kpi icon={CalendarDays} label="Renewals" value={summary.renewals_due_30_days || renewalSubscriptions.length} sub="Due within 30 days" />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Billing Record" />
            <form className="form-grid" onSubmit={createBillingRecord}>
              {renderCompanySelector('billing')}
              <Select label="Type" name="record_type" value={forms.billing.record_type} onChange={setPlatformForm('billing')}>
                {catalogBillingRecordTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
              </Select>
              <Select label="Status" name="status" value={forms.billing.status} onChange={setPlatformForm('billing')}>
                {catalogBillingStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
              </Select>
              <Field label="Amount" type="number" name="amount" value={forms.billing.amount} onChange={setPlatformForm('billing')} />
              <Field label="Currency" name="currency" value={forms.billing.currency} onChange={setPlatformForm('billing')} />
              <Field label="Issued On" type="date" name="issued_on" value={forms.billing.issued_on} onChange={setPlatformForm('billing')} />
              <Field label="Due On" type="date" name="due_on" value={forms.billing.due_on} onChange={setPlatformForm('billing')} />
              <button type="submit" className="primary-action"><Plus size={17} />Create record</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Billing Mix" />
            <DataTable columns={['Type', 'Records', 'Amount']} rows={Object.entries(billingRecords.reduce((groups, record) => {
              const current = groups[record.record_type] || { count: 0, amount: 0 }
              groups[record.record_type] = { count: current.count + 1, amount: current.amount + Number(record.amount || 0) }
              return groups
            }, {})).map(([type, value]) => [labelize(type), value.count, money(value.amount)])} />
          </section>
          <section className="panel span-2">
            <PanelTitle icon={WalletCards} title={activeTab === 'payments' ? 'Payments' : 'Billing'} />
            <DataTable columns={['No.', 'Company', 'Type', 'Status', 'Amount', 'Issued', 'Due', 'Paid']} rows={(activeTab === 'payments' ? paymentRows : billingRecords).map((record) => [record.record_number, record.company?.name || '', labelize(record.record_type), <Badge key="status" value={record.status} />, money(record.amount), shortDate(record.issued_on), shortDate(record.due_on), shortDate(record.paid_at)])} />
          </section>
        </div>
      </section>
    )
  }

  function renderSupport() {
    const selectedTicket = tickets.find((ticket) => String(ticket.id) === String(forms.support_update.id))
    const topIssues = Object.entries(tickets.reduce((groups, ticket) => {
      const category = ticket.category || 'general'
      groups[category] = (groups[category] || 0) + 1
      return groups
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={AlertTriangle} label="Open Tickets" value={supportMetrics.open_tickets ?? openSupportTickets.length} sub={`${supportMetrics.escalated_tickets ?? urgentSupportTickets.length} escalated`} />
          <Kpi icon={Users} label="Awaiting Customer" value={supportMetrics.awaiting_customer ?? awaitingCustomerTickets.length} sub="Customer-side response" />
          <Kpi icon={CheckCircle2} label="Resolved Today" value={supportMetrics.resolved_today ?? resolvedTodayTickets.length} sub={`${tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length} total resolved`} />
          <Kpi icon={Clock3} label="SLA Compliance" value={summary.support_sla_compliance === null || summary.support_sla_compliance === undefined ? 'N/A' : `${summary.support_sla_compliance}%`} sub="Platform support" />
          <Kpi icon={BarChart3} label="Customer Satisfaction" value={supportMetrics.customer_satisfaction_score === null || supportMetrics.customer_satisfaction_score === undefined ? 'Not tracked' : supportMetrics.customer_satisfaction_score} sub={supportMetrics.customer_satisfaction_source || 'No survey source configured'} />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Create Support Ticket" />
            <form className="form-grid" onSubmit={createSupportTicket}>
              {renderCompanySelector('support')}
              <Field label="Title" name="title" value={forms.support.title} onChange={setPlatformForm('support')} required />
              <Field label="Category" name="category" value={forms.support.category} onChange={setPlatformForm('support')} />
              <Select label="Priority" name="priority" value={forms.support.priority} onChange={setPlatformForm('support')}>
                {catalogSupportPriorities.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
              </Select>
              <Field label="SLA Due" type="datetime-local" name="sla_due_at" value={forms.support.sla_due_at} onChange={setPlatformForm('support')} />
              <TextArea className="span-2" label="Description" name="description" value={forms.support.description} onChange={setPlatformForm('support')} />
              <button type="submit" className="primary-action"><Plus size={17} />Create ticket</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={CheckCircle2} title="Update Support Ticket" />
            <form className="form-grid" onSubmit={updateSupportTicket}>
              <Select label="Ticket" name="id" value={forms.support_update.id} onChange={(event) => {
                const ticket = tickets.find((item) => String(item.id) === String(event.target.value))
                if (ticket) editPlatformSupportTicket(ticket)
                else setPlatformForms((current) => ({ ...current, support_update: emptyPlatformForms.support_update }))
              }}>
                <option value="">Select ticket</option>
                {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.ticket_number} - {ticket.title}</option>)}
              </Select>
              <Select label="Status" name="status" value={forms.support_update.status} onChange={setPlatformForm('support_update')} disabled={!selectedTicket}>
                {catalogSupportTicketStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
              </Select>
              <Select label="Priority" name="priority" value={forms.support_update.priority} onChange={setPlatformForm('support_update')} disabled={!selectedTicket}>
                {catalogSupportPriorities.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
              </Select>
              <Select label="Assigned To" name="assigned_to" value={forms.support_update.assigned_to} onChange={setPlatformForm('support_update')} disabled={!selectedTicket}>
                <option value="">Unassigned</option>
                {platformStaff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <TextArea className="span-2" label="Resolution Notes" name="resolution_notes" value={forms.support_update.resolution_notes} onChange={setPlatformForm('support_update')} disabled={!selectedTicket} />
              <div className="row-actions span-2">
                <button type="submit" className="primary-action" disabled={!selectedTicket}><CheckCircle2 size={17} />Save ticket</button>
                <button type="button" className="table-action" onClick={() => setPlatformForms((current) => ({ ...current, support_update: emptyPlatformForms.support_update }))}>Clear</button>
              </div>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Top Issues" />
            <DataTable columns={['Category', 'Tickets']} rows={topIssues.map(([category, count]) => [labelize(category), count])} />
          </section>
          <section className="panel">
            <PanelTitle icon={Clock3} title="Ticket Activity" />
            <div className="cloud-activity-feed">
              {tickets.slice(0, 8).map((ticket) => (
                <article key={ticket.id}>
                  <AlertTriangle size={15} />
                  <div>
                    <span>{timelineTime(ticket.updated_at || ticket.created_at)}</span>
                    <strong>{ticket.ticket_number} {labelize(ticket.status)}</strong>
                    <small>{ticket.company?.name || ''} | {ticket.title}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel span-2">
            <PanelTitle icon={AlertTriangle} title="Support Center" />
            <DataTable
              columns={['Ticket', 'Company', 'Title', 'Priority', 'Status', 'SLA', 'Assigned', 'Actions']}
              rows={tickets.map((ticket) => [
                ticket.ticket_number,
                ticket.company?.name || '',
                ticket.title,
                <Badge key="priority" value={ticket.priority} />,
                <Badge key="status" value={ticket.status} />,
                shortDate(ticket.sla_due_at),
                ticket.assignee?.name || '',
                <button key="edit" type="button" className="table-action" onClick={() => editPlatformSupportTicket(ticket)}>Edit</button>,
              ])}
            />
          </section>
        </div>
      </section>
    )
  }

  function renderDeployment() {
    const upcomingDeployments = deployments.filter((deployment) => ['scheduled', 'queued'].includes(deployment.status))
    const runningDeployments = deployments.filter((deployment) => ['running', 'deploying'].includes(deployment.status))
    const completedDeployments = deployments.filter((deployment) => ['completed', 'deployed', 'successful'].includes(deployment.status))
    const failedDeployments = deployments.filter((deployment) => ['failed', 'rolled_back'].includes(deployment.status))

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={CalendarDays} label="Upcoming" value={upcomingDeployments.length} sub="Scheduled or queued" />
          <Kpi icon={Upload} label="Running" value={runningDeployments.length} sub="Live deployments" />
          <Kpi icon={CheckCircle2} label="Completed" value={completedDeployments.length} sub={`Latest ${currentVersion}`} />
          <Kpi icon={AlertTriangle} label="Failed" value={failedDeployments.length} sub="Needs engineering review" />
          <Kpi icon={RefreshCcw} label="Rollback Available" value={completedDeployments.length > 0 ? 'Yes' : 'No'} sub={latestDeployment?.deployment_number || 'No deployment'} />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Upload} title="Schedule Deployment" />
            <form className="form-grid" onSubmit={createDeployment}>
              <Field label="Title" name="title" value={forms.deployment.title} onChange={setPlatformForm('deployment')} required />
              <Field label="Release Version" name="release_version" value={forms.deployment.release_version} onChange={setPlatformForm('deployment')} />
              <Select label="Target" name="target_scope" value={forms.deployment.target_scope} onChange={setPlatformForm('deployment')}>
                {catalogDeploymentScopes.map((scope) => <option key={scope} value={scope}>{labelize(scope)}</option>)}
              </Select>
              <Field label="Scheduled At" type="datetime-local" name="scheduled_at" value={forms.deployment.scheduled_at} onChange={setPlatformForm('deployment')} />
              <TextArea className="span-2" label="Notes" name="notes" value={forms.deployment.notes} onChange={setPlatformForm('deployment')} />
              <button type="submit" className="primary-action"><Upload size={17} />Create deployment</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Release Activity" />
            <div className="cloud-activity-feed">
              {deployments.slice(0, 8).map((deployment) => (
                <article key={deployment.id}>
                  <Upload size={15} />
                  <div>
                    <span>{timelineTime(deployment.deployed_at || deployment.scheduled_at || deployment.created_at)}</span>
                    <strong>{deployment.release_version || deployment.deployment_number}</strong>
                    <small>{deployment.title} | {labelize(deployment.status)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel span-2">
            <PanelTitle icon={Upload} title="Deployment Center" />
            <DataTable columns={['No.', 'Title', 'Version', 'Target', 'Status', 'Scheduled', 'Deployed', 'Duration', 'Errors']} rows={deployments.map((deployment) => [deployment.deployment_number, deployment.title, deployment.release_version || '', labelize(deployment.target_scope), <Badge key="status" value={deployment.status} />, shortDate(deployment.scheduled_at), shortDate(deployment.deployed_at), deployment.duration_seconds ? `${deployment.duration_seconds}s` : '', deployment.error_message || ''])} />
          </section>
        </div>
      </section>
    )
  }

  function renderBackups() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Download} title="Queue Backup" />
          <form className="form-grid" onSubmit={createBackup}>
            {renderCompanySelector('backup', 'Tenant')}
            <Select label="Backup Type" name="backup_type" value={forms.backup.backup_type} onChange={setPlatformForm('backup')}>
              {catalogBackupTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
            </Select>
            <Field label="Storage Path" name="storage_path" value={forms.backup.storage_path} onChange={setPlatformForm('backup')} />
            <button type="submit" className="primary-action"><Download size={17} />Queue backup</button>
          </form>
        </section>
        <section className="panel">
          <PanelTitle icon={Download} title="Backups" />
          <DataTable columns={['No.', 'Company', 'Type', 'Status', 'Size', 'Path', 'Started', 'Completed', 'Verified']} rows={backups.map((backup) => [backup.backup_number, backup.company?.name || 'Platform', labelize(backup.backup_type), <Badge key="status" value={backup.status} />, `${backup.size_mb || 0} MB`, backup.storage_path || '', shortDate(backup.started_at), shortDate(backup.completed_at), shortDate(backup.verified_at)])} />
        </section>
      </div>
    )
  }

  function renderSettings() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Settings} title="System Settings" />
          <form className="form-grid" onSubmit={updateSettings}>
            <Field label="Database Warning MS" type="number" name="database_warning_ms" value={forms.settings.database_warning_ms} onChange={setPlatformForm('settings')} />
            <Field label="Database Critical MS" type="number" name="database_critical_ms" value={forms.settings.database_critical_ms} onChange={setPlatformForm('settings')} />
            <Field label="Queue Pending Warning" type="number" name="queue_pending_warning" value={forms.settings.queue_pending_warning} onChange={setPlatformForm('settings')} />
            <Field label="Failed Jobs Critical" type="number" name="failed_jobs_critical" value={forms.settings.failed_jobs_critical} onChange={setPlatformForm('settings')} />
            <Field label="Storage Warning %" type="number" name="storage_warning_percent" value={forms.settings.storage_warning_percent} onChange={setPlatformForm('settings')} />
            <Field label="Storage Critical %" type="number" name="storage_critical_percent" value={forms.settings.storage_critical_percent} onChange={setPlatformForm('settings')} />
            <Field label="Security Alert Critical" type="number" name="security_alert_critical" value={forms.settings.security_alert_critical} onChange={setPlatformForm('settings')} />
            <Field label="Server Count" type="number" name="server_count" value={forms.settings.server_count} onChange={setPlatformForm('settings')} />
            <Field label="Servers Online" type="number" name="servers_online" value={forms.settings.servers_online} onChange={setPlatformForm('settings')} />
            <Select label="AI Services" name="ai_enabled" value={forms.settings.ai_enabled} onChange={setPlatformForm('settings')}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
            <Field label="AI Usage %" type="number" name="ai_usage_percent" value={forms.settings.ai_usage_percent} onChange={setPlatformForm('settings')} />
            <Field label="AI Monthly Token Limit" type="number" name="ai_monthly_token_limit" value={forms.settings.ai_monthly_token_limit} onChange={setPlatformForm('settings')} />
            <Field label="AI Monthly Budget" type="number" name="ai_monthly_budget" value={forms.settings.ai_monthly_budget} onChange={setPlatformForm('settings')} />
            <Field label="AI Cost Month To Date" type="number" name="ai_cost_month_to_date" value={forms.settings.ai_cost_month_to_date} onChange={setPlatformForm('settings')} />
            <button type="submit" className="primary-action"><CheckCircle2 size={17} />Save settings</button>
          </form>
        </section>
        <section className="panel">
          <PanelTitle icon={Settings} title="Configured Settings" />
          <DataTable columns={['Key', 'Value']} rows={(platform.settings || []).map((setting) => [setting.setting_key, JSON.stringify(setting.setting_value || {})])} />
        </section>
      </div>
    )
  }

  function renderSecurity() {
    const failedLogins = securityEvents.filter((event) => String(event.event_type || '').includes('login'))
    const openSecurityEvents = securityEvents.filter((event) => ['open', 'investigating'].includes(event.status))

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={ShieldCheck} label="Failed Logins" value={failedLogins.length} sub="Identity events" />
          <Kpi icon={ShieldCheck} label="Open Alerts" value={openSecurityEvents.length} sub="Open or investigating" />
          <Kpi icon={Users} label="Sessions" value={summary.active_users_today || 0} sub="Users active today" />
          <Kpi icon={ShieldCheck} label="Tokens" value={summary.api_requests || 0} sub="API requests this month" />
          <Kpi icon={CheckCircle2} label="Certificates" value="Valid" sub="SSL certificates" />
        </div>
        <div className="grid-main">
          <AccountSecurityPanel
            currentUser={currentUser}
            accountSecurity={accountSecurity}
            mfaSetup={mfaSetup}
            securityForms={securityForms}
            setSecurityForm={setSecurityForm}
            changePassword={changePassword}
            startMfaSetup={startMfaSetup}
            enableMfa={enableMfa}
            disableMfa={disableMfa}
            regenerateMfaRecoveryCodes={regenerateMfaRecoveryCodes}
          />

          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Secure Impersonation" />
            <form className="form-grid" onSubmit={startImpersonation}>
              {renderCompanySelector('impersonation')}
              <Select label="User" name="user_id" value={forms.impersonation.user_id} onChange={setPlatformForm('impersonation')}>
                <option value="">Select user</option>
                {selectedCompanyUsers.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.email}</option>)}
              </Select>
              <Field label="Authorization Reference" name="authorization_reference" value={forms.impersonation.authorization_reference} onChange={setPlatformForm('impersonation')} required />
              <Field label="Expires Minutes" type="number" name="expires_minutes" value={forms.impersonation.expires_minutes} onChange={setPlatformForm('impersonation')} />
              <TextArea className="span-2" label="Reason" name="reason" value={forms.impersonation.reason} onChange={setPlatformForm('impersonation')} required />
              <button type="submit" className="primary-action"><ShieldCheck size={17} />Start impersonation</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Security Activity" />
            <div className="cloud-activity-feed">
              {securityEvents.slice(0, 8).map((event) => (
                <article key={event.id}>
                  <ShieldCheck size={15} />
                  <div>
                    <span>{timelineTime(event.created_at)}</span>
                    <strong>{labelize(event.event_type)}</strong>
                    <small>{event.company?.name || 'Platform'} | {event.ip_address || ''}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel span-2">
            <PanelTitle icon={ShieldCheck} title="Security Center" />
            <DataTable columns={['Company', 'Event', 'Severity', 'Status', 'IP', 'Created']} rows={securityEvents.map((event) => [event.company?.name || 'Platform', labelize(event.event_type), <Badge key="severity" value={event.severity} />, <Badge key="status" value={event.status} />, event.ip_address || '', shortDate(event.created_at)])} />
          </section>
        </div>
      </section>
    )
  }

  function renderPlatformUsers() {
    const staffPermissions = normalizePermissionList(forms.staff.permissions)
    const isEditingStaff = Boolean(forms.staff.id)

    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Users} title={isEditingStaff ? 'Edit Cloud Console User' : 'Create Cloud Console User'} />
          <form className="form-grid two" onSubmit={saveStaffUser}>
            <Field label="Name" name="name" value={forms.staff.name} onChange={setPlatformForm('staff')} required />
            <Field label="Email" type="email" name="cloud_console_user_email" value={forms.staff.email} onChange={(event) => setPlatformForm('staff')({ target: { name: 'email', value: event.target.value } })} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" required />
            <Field label="Temporary Password" type="password" name="cloud_console_user_secret" value={forms.staff.password} onChange={(event) => setPlatformForm('staff')({ target: { name: 'password', value: event.target.value } })} required={!isEditingStaff} placeholder={isEditingStaff ? 'Leave blank to keep current' : 'Enter a secure temporary password'} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" />
            <Field label="Phone" name="phone" value={forms.staff.phone} onChange={setPlatformForm('staff')} />
            <Field label="Job Title" name="job_title" value={forms.staff.job_title} onChange={setPlatformForm('staff')} />
            <Select label="Status" name="status" value={forms.staff.status} onChange={setPlatformForm('staff')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
            <div className="platform-feature-grid span-2">
              {platformPermissions.map((permission) => (
                <button key={permission.key} type="button" className={`feature-toggle ${staffPermissions.includes(permission.key) ? 'enabled' : ''}`} onClick={() => togglePlatformStaffPermission(permission.key)}>
                  <span>Permission</span>
                  <strong>{permission.label}</strong>
                  <small>{permission.description}</small>
                </button>
              ))}
            </div>
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {isEditingStaff ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {isEditingStaff ? 'Save user' : 'Create user'}
              </button>
              {isEditingStaff && (
                <button type="button" className="table-action" onClick={resetPlatformStaffForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="My Login Details" />
          <form className="form-grid two" onSubmit={saveProfile}>
            <Field label="Name" name="name" value={forms.profile.name} onChange={setPlatformForm('profile')} required />
            <Field label="Email" type="email" name="email" value={forms.profile.email} onChange={setPlatformForm('profile')} required />
            <Field label="Phone" name="phone" value={forms.profile.phone} onChange={setPlatformForm('profile')} />
            <Field label="Job Title" name="job_title" value={forms.profile.job_title} onChange={setPlatformForm('profile')} />
            <Field label="Current Password" type="password" name="cloud_profile_current_secret" value={forms.profile.current_password} onChange={(event) => setPlatformForm('profile')({ target: { name: 'current_password', value: event.target.value } })} placeholder="Required for email or password changes" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" />
            <Field label="New Password" type="password" name="cloud_profile_new_secret" value={forms.profile.password} onChange={(event) => setPlatformForm('profile')({ target: { name: 'password', value: event.target.value } })} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" />
            <Field label="Confirm New Password" type="password" name="cloud_profile_confirm_secret" value={forms.profile.password_confirmation} onChange={(event) => setPlatformForm('profile')({ target: { name: 'password_confirmation', value: event.target.value } })} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" />
            <button type="submit" className="primary-action">
              <CheckCircle2 size={17} />
              Save my login details
            </button>
          </form>
        </section>

        <section className="panel span-2">
          <PanelTitle icon={Users} title="Navkwa Build Cloud Console Users" />
          <DataTable
            columns={['Name', 'Email', 'Job Title', 'Access', 'Status', 'Last Login', 'Actions']}
            rows={platformStaff.map((item) => [
              item.name,
              item.email,
              item.job_title || '',
              platformPermissionSummary(item.effective_permissions || item.permissions || []),
              <Badge key="status" value={item.status} />,
              shortDate(item.last_login_at),
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editPlatformStaffUser(item)}>
                  Edit
                </button>
                <button type="button" className="table-action danger" onClick={() => deleteStaffUser(item)} disabled={String(item.id) === String(currentUser?.id)}>
                  Delete
                </button>
              </div>,
            ])}
          />
        </section>
      </div>
    )
  }

  function renderMonitoring() {
    const checks = Object.entries(monitoring.checks || {}).map(([key, check]) => [
      labelize(key),
      <Badge key="status" value={check.status} />,
      check.value,
    ])
    const metricRows = [
      ['Status', monitoring.status_label || 'Unavailable'],
      ['Last Checked', timelineTime(monitoring.last_checked_at)],
      ['Database Response', monitoring.database_response_time_ms === null || monitoring.database_response_time_ms === undefined ? 'N/A' : `${monitoring.database_response_time_ms} ms`],
      ['Queue Connection', monitoring.queue_connection || 'N/A'],
      ['Pending Jobs', monitoring.jobs_pending ?? 0],
      ['Failed Jobs', monitoring.failed_jobs ?? 0],
      ['Storage Used', `${monitoring.storage_used_mb ?? 0} MB`],
      ['Storage Usage', monitoring.storage_usage_percent === null || monitoring.storage_usage_percent === undefined ? 'No platform cap' : `${monitoring.storage_usage_percent}%`],
      ['Open Security Events', monitoring.open_security_events ?? 0],
      ['Mail Driver', monitoring.mail_driver || 'N/A'],
      ['Active Connectors', monitoring.active_connectors ?? 0],
      ['Connector Issues', monitoring.connector_issues ?? 0],
    ]

    return (
      <section className="view-stack">
        <div className="cloud-telemetry-grid">
          {[
            ['CPU Load', monitoring.server_load_1m === null || monitoring.server_load_1m === undefined ? 'Unavailable' : monitoring.server_load_1m, monitoring.server_load_1m === null || monitoring.server_load_1m === undefined ? 'neutral' : 'healthy'],
            ['PHP Memory', monitoring.php_memory_usage_mb === null || monitoring.php_memory_usage_mb === undefined ? 'Unavailable' : `${monitoring.php_memory_usage_mb} MB`, monitoring.php_memory_usage_mb === null || monitoring.php_memory_usage_mb === undefined ? 'neutral' : 'healthy'],
            ['Database', checkValue('database'), checkTone('database')],
            ['Redis', checkValue('redis', 'Not used by current config'), checkTone('redis')],
            ['Cache', checkValue('cache'), checkTone('cache')],
            ['Queue', checkValue('queue'), checkTone('queue')],
            ['API', checkValue('api'), checkTone('api')],
            ['Email', checkValue('email'), checkTone('email')],
            ['Storage', storagePercent === null || storagePercent === undefined ? `${summary.storage_used_mb || 0} MB` : `${storagePercent}%`, Number(storagePercent || 0) >= 85 ? 'warning' : 'healthy'],
            ['Latency', `${summary.average_response_time_ms ?? 'N/A'} ms`, checkTone('database')],
            ['Errors', summary.failed_background_jobs || 0, (summary.failed_background_jobs || 0) > 0 ? 'critical' : 'healthy'],
            ['Traffic', summary.api_requests || 0, 'healthy'],
            ['Scheduler', checkValue('scheduler'), checkTone('scheduler')],
            ['SSL', checkValue('ssl'), checkTone('ssl')],
          ].map(([label, value, tone]) => (
            <div key={label} className="cloud-health-cell">
              <span>{label}</span>
              <strong>{value}</strong>
              <Badge value={tone} />
            </div>
          ))}
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Live Monitoring" />
            <DataTable columns={['Metric', 'Value']} rows={metricRows} />
          </section>
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Health Checks" />
            <DataTable columns={['Service', 'Status', 'Current']} rows={checks} />
          </section>
        </div>
      </section>
    )
  }

  function renderNotificationCenter() {
    const categories = ['security', 'billing', 'support', 'deployment', 'customer', 'automation', 'ai', 'platform']
    const categoryRows = categories.map((category) => {
      const count = notifications.filter((item) => {
        const haystack = `${item.category || ''} ${item.title || ''} ${item.event_type || ''}`.toLowerCase()
        return haystack.includes(category)
      }).length
      return [labelize(category), count, <Badge key={category} value={count > 0 ? 'active' : 'neutral'} />]
    })

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={Send} label="Notifications" value={notifications.length} sub="All platform events" />
          <Kpi icon={ShieldCheck} label="Security" value={categoryRows.find((row) => row[0] === 'Security')?.[1] || 0} sub="Security category" />
          <Kpi icon={WalletCards} label="Billing" value={categoryRows.find((row) => row[0] === 'Billing')?.[1] || 0} sub="Billing category" />
          <Kpi icon={AlertTriangle} label="Support" value={categoryRows.find((row) => row[0] === 'Support')?.[1] || 0} sub="Support category" />
          <Kpi icon={Workflow} label="Automation" value={categoryRows.find((row) => row[0] === 'Automation')?.[1] || 0} sub="Automation category" />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Send} title="Notification Categories" />
            <DataTable columns={['Category', 'Events', 'Status']} rows={categoryRows} />
          </section>
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Notification Activity" />
            <DataTable columns={['No.', 'Company', 'Title', 'Severity', 'Status', 'Channels', 'Created']} rows={notifications.map((item) => [item.notification_number, item.company?.name || '', item.title, <Badge key="severity" value={item.severity} />, <Badge key="status" value={item.status} />, (item.channels || []).map(labelize).join(', '), shortDate(item.created_at)])} />
          </section>
        </div>
      </section>
    )
  }

  function renderAutomationCenter() {
    const workflowRules = automationWorkflows.rules || []
    const workflowRuns = automationWorkflows.recent_runs || []

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={Workflow} label="Active Rules" value={automationWorkflows.summary?.active_rules || 0} sub={`${workflowRules.length} rules loaded`} />
          <Kpi icon={ActivityIcon} label="Running Runs" value={automationWorkflows.summary?.running_runs || 0} sub="Queued or running" />
          <Kpi icon={AlertTriangle} label="Failed Runs" value={automationWorkflows.summary?.failed_runs || 0} sub="Workflow failures" />
          <Kpi icon={CheckCircle2} label="Completed Today" value={automationWorkflows.summary?.completed_today || 0} sub="Completed automation runs" />
          <Kpi icon={Clock3} label="Average Runtime" value={automationWorkflows.summary?.average_duration_ms === null || automationWorkflows.summary?.average_duration_ms === undefined ? 'N/A' : `${automationWorkflows.summary.average_duration_ms} ms`} sub="Recent runs" />
        </div>
        {workflowRules.length > 0 ? (
          <div className="cloud-workflow-board">
            {workflowRules.map((rule) => (
              <div key={rule.id} className="cloud-workflow-lane">
                {(rule.nodes || []).length > 0 ? rule.nodes.map((step, index) => (
                  <div key={`${rule.id}-${step.id || index}`} className="cloud-workflow-step">
                    <span>{step.type || `Step ${index + 1}`}</span>
                    <strong>{step.label}</strong>
                  </div>
                )) : (
                  <div className="cloud-workflow-step">
                    <span>{rule.module}</span>
                    <strong>{rule.name}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <section className="panel">
            <PanelTitle icon={Workflow} title="Automation Workflows" />
            <DataTable columns={['State', 'Detail']} rows={[['Not configured', 'No platform automation workflows have been created yet.']]} />
          </section>
        )}
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Workflow} title="Automation Controls" />
            <DataTable columns={['Company', 'Automation Runs', 'Enabled Automation Features']} rows={companies.map((company) => [company.name, company.usage?.automation_runs || 0, (company.enabled_features || []).filter((feature) => feature.module === 'automation').length])} />
          </section>
          <section className="panel">
            <PanelTitle icon={ActivityIcon} title="Recent Automation Runs" />
            <DataTable columns={['Run', 'Company', 'Rule', 'Status', 'Actions', 'Duration', 'Started']} rows={workflowRuns.map((run) => [run.run_number, run.company?.name || '', run.rule?.name || '', <Badge key="status" value={run.status} />, run.actions_executed || 0, run.duration_ms === null || run.duration_ms === undefined ? '' : `${run.duration_ms} ms`, timelineTime(run.started_at)])} />
          </section>
        </div>
      </section>
    )
  }

  function renderMarketplace() {
    const marketplaceOffers = productFeatures.map((flag) => [
      flag.name,
      moduleLabel(flag.module),
      flag.pricing_tier || 'base',
      flag.enabled_companies_count || 0,
    ])

    return (
      <section className="view-stack">
        {marketplaceOffers.length > 0 ? (
          <div className="cloud-marketplace-grid">
            {marketplaceOffers.map(([name, module, tier, customers]) => (
              <article key={name}>
                <Package size={18} />
                <div>
                  <span>{module}</span>
                  <strong>{name}</strong>
                  <small>{tier} | {customers} customers</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="panel">
            <PanelTitle icon={Package} title="Marketplace Catalog" />
            <DataTable columns={['State', 'Detail']} rows={[['Not configured', 'No marketplace feature offerings exist yet.']]} />
          </section>
        )}
        <section className="panel">
          <PanelTitle icon={Package} title="Marketplace Catalog" />
          <DataTable columns={['Offering', 'Module', 'Pricing Tier', 'Enabled Companies']} rows={marketplaceOffers} />
        </section>
      </section>
    )
  }

  function renderAiCenter() {
    const aiFlags = productFeatures.filter((flag) => flag.key.includes('ai'))
    const companyRows = [...companies]
      .sort((a, b) => Number(b.usage?.api_calls || 0) - Number(a.usage?.api_calls || 0))
      .slice(0, 8)
      .map((company) => [company.name, company.usage?.api_calls || 0, company.customer_success?.expansion_opportunity || 'None recorded'])

    return (
      <section className="view-stack">
        <div className="kpi-grid cloud-status-grid">
          <Kpi icon={BarChart3} label="AI Usage" value={summary.ai_enabled ? `${summary.ai_usage_percent ?? 0}%` : 'Disabled'} sub={`${summary.ai_monthly_token_limit || 0} monthly token limit`} />
          <Kpi icon={WalletCards} label="AI Cost" value={money(summary.ai_cost_month_to_date || 0)} sub={`Budget ${money(summary.ai_monthly_budget || 0)}`} />
          <Kpi icon={ActivityIcon} label="Requests" value={summary.api_requests || 0} sub="API-backed activity" />
          <Kpi icon={CheckCircle2} label="AI Features" value={aiFlags.length} sub="Configured feature flags" />
          <Kpi icon={Building2} label="Top Companies" value={companyRows.length} sub="Highest request volume" />
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={BarChart3} title="AI Services" />
            <DataTable columns={['Feature', 'Module', 'Tier', 'Rollout', 'Enabled Companies']} rows={aiFlags.map((flag) => [flag.name, moduleLabel(flag.module), flag.pricing_tier || '', `${flag.rollout_percentage}%`, flag.enabled_companies_count || 0])} />
          </section>
          <section className="panel">
            <PanelTitle icon={Building2} title="Top Companies" />
            <DataTable columns={['Company', 'Requests', 'Recommendation']} rows={companyRows} />
          </section>
        </div>
      </section>
    )
  }

  function renderReportsCenter() {
    const reportRows = [
      ['Company Register', companies.length],
      ['Subscriptions', subscriptions.length],
      ['Billing Records', billingRecords.length],
      ['Support Tickets', tickets.length],
      ['Security Events', securityEvents.length],
      ['Audit Logs', auditLogs.length],
    ]
    const downloadReport = (format) => {
      const headers = ['Report', 'Records']
      const serialized = format === 'json'
        ? JSON.stringify(reportRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]]))), null, 2)
        : [headers, ...reportRows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
      const blob = new Blob([serialized], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `navkwabuild-cloud-console-reports.${format === 'json' ? 'json' : 'csv'}`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }

    return (
      <section className="view-stack">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Platform Reports" />
          <div className="cloud-export-actions">
            {['csv', 'json'].map((format) => <button key={format} type="button" className="table-action" onClick={() => downloadReport(format)}><Download size={14} />{format.toUpperCase()}</button>)}
          </div>
          <DataTable columns={['Report', 'Records']} rows={reportRows} />
        </section>
      </section>
    )
  }

  function renderDeveloperTools() {
    return (
      <section className="view-stack">
        <div className="cloud-telemetry-grid">
          {[
            ['Queues', checkValue('queue'), checkTone('queue')],
            ['Jobs', `${monitoring.jobs_pending ?? 0} pending`, checkTone('queue')],
            ['Workers', monitoring.queue_worker_status || 'Not monitored', monitoring.queue_worker_status === 'Sync driver' ? 'healthy' : 'neutral'],
            ['Redis', checkValue('redis', 'Not used by current config'), checkTone('redis')],
            ['Cache', checkValue('cache'), checkTone('cache')],
            ['Scheduler', checkValue('scheduler'), checkTone('scheduler')],
            ['Webhooks', integrations.filter((item) => item.category === 'webhook').length, 'healthy'],
            ['API Logs', summary.api_requests || 0, 'healthy'],
            ['Database', checkValue('database'), checkTone('database')],
            ['Storage', `${summary.storage_used_mb || 0} MB`, Number(storagePercent || 0) >= 85 ? 'warning' : 'healthy'],
            ['Email Queue', monitoring.notification_events_pending ?? 0, (monitoring.notification_events_pending ?? 0) > 0 ? 'warning' : 'healthy'],
            ['SMS Events', monitoring.sms_events ?? 0, (monitoring.sms_events ?? 0) > 0 ? 'neutral' : 'neutral'],
          ].map(([label, value, tone]) => (
            <div key={label} className="cloud-health-cell">
              <span>{label}</span>
              <strong>{value}</strong>
              <Badge value={tone} />
            </div>
          ))}
        </div>
        <section className="panel">
          <PanelTitle icon={Workflow} title="Developer Tools" />
          <DataTable columns={['Company', 'API Access', 'API Calls', 'Integrations']} rows={companies.map((company) => [company.name, (company.enabled_features || []).some((feature) => feature.key === 'platform.api_access') ? 'Enabled' : 'Disabled', company.usage?.api_calls || 0, integrations.filter((item) => item.company_id === company.id).length])} />
        </section>
      </section>
    )
  }

  function renderSimpleTab() {
    if (activeTab === 'identity') {
      return <section className="panel"><PanelTitle icon={Globe2} title="Identity & Domains" /><DataTable columns={['Company', 'Tenant Key', 'Website', 'Login URL', 'Country']} rows={companies.map((company) => [company.name, company.tenant_key, company.website || '', `/login?tenant=${company.tenant_key}`, company.country])} /></section>
    }
    if (activeTab === 'users') return renderPlatformUsers()
    if (activeTab === 'roles') return <section className="panel"><PanelTitle icon={ShieldCheck} title="Roles & Permissions" /><DataTable columns={['Company', 'Role', 'Slug', 'Permissions', 'Type']} rows={roleRows} /></section>
    if (activeTab === 'licenses') return <section className="panel"><PanelTitle icon={CheckCircle2} title="Licenses" /><DataTable columns={['Company', 'Plan', 'Users', 'Projects', 'Storage', 'Portal Users', 'Automation Limit']} rows={companies.map((company) => [company.name, company.subscription?.plan?.name || '', `${company.usage?.users || 0}/${company.employee_limit || 'Unlimited'}`, `${company.usage?.projects || 0}/${company.project_limit || 'Unlimited'}`, `${company.usage?.storage_mb || 0}/${company.storage_limit_mb || 'Unlimited'} MB`, company.subscription?.plan?.portal_users || 'Plan', company.subscription?.plan?.automation_limit || 'Unlimited'])} /></section>
    if (activeTab === 'usage') return <section className="panel"><PanelTitle icon={BarChart3} title="Company Usage" /><DataTable columns={['Company', 'Projects', 'Employees', 'Users', 'Documents', 'API Calls', 'Automation Runs', 'Emails', 'Backups']} rows={companies.map((company) => [company.name, company.usage?.projects || 0, company.usage?.employees || 0, company.usage?.users || 0, company.usage?.documents || 0, company.usage?.api_calls || 0, company.usage?.automation_runs || 0, company.usage?.emails_sent || 0, company.usage?.backups || 0])} /></section>
    if (activeTab === 'notifications') return renderNotificationCenter()
    if (activeTab === 'automation') return renderAutomationCenter()
    if (activeTab === 'integrations') return <section className="panel"><PanelTitle icon={Layers3} title="Integrations" /><DataTable columns={['Company', 'Provider', 'Name', 'Category', 'Status', 'Last Tested']} rows={integrations.map((item) => [item.company?.name || '', item.provider, item.name, labelize(item.category), <Badge key="status" value={item.status} />, shortDate(item.last_tested_at)])} /></section>
    if (activeTab === 'marketplace') return renderMarketplace()
    if (activeTab === 'ai') return renderAiCenter()
    if (activeTab === 'audit') return <section className="panel"><PanelTitle icon={Clock3} title="Audit Logs" /><DataTable columns={['When', 'Company', 'Action', 'Record', 'User', 'IP']} rows={auditLogs.map((log) => [timelineTime(log.created_at), log.company?.name || '', labelize(log.action), String(log.auditable_type || '').split('\\').pop(), log.user_id || '', log.ip_address || ''])} /></section>
    if (activeTab === 'monitoring') return renderMonitoring()
    if (activeTab === 'localization') return <section className="panel"><PanelTitle icon={Globe2} title="Localization" /><DataTable columns={['Company', 'Country', 'Currency', 'Timezone', 'Language', 'Date Format', 'Fiscal Year']} rows={companies.map((company) => [company.name, company.country, company.default_currency, company.base_timezone, company.language, company.date_format, company.fiscal_year_start])} /></section>
    if (activeTab === 'data') return <section className="panel"><PanelTitle icon={FileText} title="Data Management" /><DataTable columns={['Company', 'Tenant Mode', 'Storage Root', 'Storage Used', 'Documents', 'Backups']} rows={companies.map((company) => [company.name, company.settings?.tenant_mode || 'single_database_scoped', company.settings?.storage_root || '', `${company.usage?.storage_mb || 0} MB`, company.usage?.documents || 0, company.usage?.backups || 0])} /></section>
    if (activeTab === 'reports') return renderReportsCenter()
    if (activeTab === 'developer') return renderDeveloperTools()

    return renderExecutive()
  }

  function renderLayerContent() {
    if (activeTab === 'executive') return renderCommandCenter()
    if (activeTab === 'operations-center') return renderOperationsCenter()
    if (activeTab === 'companies') return renderCompanyWorkspace()
    if (activeTab === 'customer-success') return renderCustomerSuccess()
    if (activeTab === 'subscriptions') return renderSubscriptions()
    if (activeTab === 'features') return renderFeatures()
    if (activeTab === 'branding') return renderBranding()
    if (activeTab === 'billing' || activeTab === 'payments') return renderBilling()
    if (activeTab === 'support') return renderSupport()
    if (activeTab === 'security') return renderSecurity()
    if (activeTab === 'deployment') return renderDeployment()
    if (activeTab === 'backups') return renderBackups()
    if (activeTab === 'settings') return renderSettings()

    return renderSimpleTab()
  }

  return (
    <section className="view-stack platform-admin-page cloud-console-page">
      {renderGlobalSearch()}
      {renderSearchResults()}

      <main className="cloud-console-main">
        {renderLayerContent()}
      </main>
    </section>
  )
}

function ActivityIcon(props) {
  return <BarChart3 {...props} />
}

function DashboardView({ dashboard, projects }) {
  const kpis = dashboard?.kpis || {}
  const portfolioCards = dashboard?.portfolio_cards?.length ? dashboard.portfolio_cards : projects.slice(0, 4)
  const budget = dashboard?.budget_overview || {}
  const cashFlowData = (dashboard?.cash_flow_trend || []).map((row) => ({
    ...row,
    inflow: toChartNumber(row.inflow),
    outflow: toChartNumber(row.outflow),
  }))
  const procurementStatuses = dashboard?.procurement_overview?.statuses || dashboard?.procurement_status?.purchase_orders || []
  const procurementChartData = procurementStatuses.map((row) => ({
    name: labelize(row.status),
    value: toChartNumber(row.value ?? row.total),
    key: row.status,
  }))
  const pendingApprovals = dashboard?.pending_approval_items || []
  const inventoryAlerts = dashboard?.inventory_alerts || []
  const workforce = dashboard?.workforce_attendance || {}
  const invoiceSummary = dashboard?.invoice_summary || {}
  const costBreakdown = dashboard?.cost_breakdown?.length
    ? dashboard.cost_breakdown
    : (dashboard?.cost_by_category || []).map((row) => ({
      category: row.category,
      budget: toChartNumber(row.budget),
      committed: toChartNumber(row.committed),
      actual: toChartNumber(row.actual),
      percent: 0,
    }))
  const projectPerformance = dashboard?.project_performance?.length
    ? dashboard.project_performance
    : projects.slice(0, 12).map((project) => ({
      id: project.id,
      code: project.code,
      project: project.name,
      status: project.status,
      health_status: project.health_status,
      progress_percent: Number(project.progress_percent || 0),
      budget: Number(project.budget_total || 0),
      budget_utilized_percent: Number(project.budget_total || 0) > 0 ? Math.round((Number(project.actual_cost || 0) / Number(project.budget_total || 0)) * 100) : 0,
      cost_to_date: Number(project.actual_cost || 0),
      cost_variance: Number(project.budget_total || 0) - Number(project.actual_cost || 0),
      schedule_variance_days: null,
      spi: null,
      cpi: null,
    }))
  const budgetChartData = [
    { name: 'Actual Cost', value: toChartNumber(budget.actual), color: '#2364d8' },
    { name: 'Committed', value: toChartNumber(budget.committed), color: '#188a5a' },
    { name: 'Balance', value: toChartNumber(budget.balance), color: '#e9b949' },
  ].filter((item) => item.value > 0)
  const invoiceRows = [
    ['Paid invoices', invoiceSummary.paid?.count || 0, money(invoiceSummary.paid?.amount), 'good'],
    ['Outstanding invoices', invoiceSummary.outstanding?.count || 0, money(invoiceSummary.outstanding?.amount), 'warn'],
    ['Overdue invoices', invoiceSummary.overdue?.count || 0, money(invoiceSummary.overdue?.amount), 'bad'],
    ['Draft invoices', invoiceSummary.draft?.count || 0, money(invoiceSummary.draft?.amount), 'neutral'],
  ]
  const costTotal = costBreakdown.reduce((total, row) => total + toChartNumber(row.actual), 0)

  return (
    <section className="view-stack erp-dashboard">
      <section className="panel erp-portfolio-panel">
        <PanelTitle icon={FolderKanban} title="Project Portfolio" />
        <div className="erp-project-card-grid">
          {portfolioCards.length ? portfolioCards.map((project) => (
            <DashboardProjectCard key={project.id || project.code || project.name} project={project} />
          )) : (
            <div className="erp-empty-card">No active project portfolio records yet.</div>
          )}
        </div>
      </section>

      <div className="kpi-grid erp-kpi-grid">
        <Kpi icon={WalletCards} label="Total revenue" value={money(kpis.total_revenue)} sub={`${money(kpis.contract_value)} contract value`} />
        <Kpi icon={Calculator} label="Total cost" value={money(kpis.total_cost ?? kpis.actual_cost)} sub={`${money(kpis.budget_total)} budget`} />
        <Kpi icon={BarChart3} label="Gross profit" value={money(kpis.gross_profit)} sub={`${kpis.average_progress || 0}% portfolio progress`} />
        <Kpi icon={AlertTriangle} label="Cost variance" value={money(kpis.cost_variance ?? kpis.variance)} sub={`${kpis.late_tasks || 0} late tasks`} />
        <Kpi icon={FolderKanban} label="Active projects" value={kpis.active_projects || 0} sub={`${kpis.total_projects || 0} total projects`} />
        <Kpi icon={Clock3} label="Days to finish" value={kpis.average_days_to_finish || 0} sub="Average remaining days" />
      </div>

      <div className="erp-dashboard-grid">
        <section className="panel erp-budget-panel">
          <PanelTitle icon={WalletCards} title="Budget Overview" />
          <div className="erp-donut-layout">
            <div className="erp-donut">
              {budgetChartData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={budgetChartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                        {budgetChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="erp-donut-center">
                    <strong>{budget.utilized_percent || 0}%</strong>
                    <span>Utilized</span>
                  </div>
                </>
              ) : (
                <div className="erp-budget-empty-state">
                  <strong>{budget.utilized_percent || 0}%</strong>
                  <span>Budget utilized</span>
                  <DashboardProgress value={budget.utilized_percent || 0} />
                </div>
              )}
            </div>
            <div className="erp-summary-list">
              <DashboardMetricRow label="Budget" value={money(budget.budget)} tone="blue" />
              <DashboardMetricRow label="Committed" value={money(budget.committed)} tone="green" />
              <DashboardMetricRow label="Actual cost" value={money(budget.actual)} tone="amber" />
              <DashboardMetricRow label="Balance" value={money(budget.balance)} tone="neutral" />
            </div>
          </div>
        </section>

        <section className="panel chart-panel erp-wide-panel">
          <PanelTitle icon={BarChart3} title="Cash Flow Trend" />
          {cashFlowData.some((row) => row.inflow > 0 || row.outflow > 0) ? (
            <ResponsiveContainer width="100%" height={282}>
              <LineChart data={cashFlowData} margin={{ top: 10, right: 16, left: 0, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => compactFormatter.format(value)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [money(value), labelize(name)]} />
                <Legend formatter={labelize} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="inflow" stroke="#188a5a" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outflow" stroke="#2364d8" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </section>

        <section className="panel">
          <PanelTitle icon={Truck} title="Procurement Status" />
          <div className="erp-donut compact">
            {procurementChartData.some((item) => item.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={procurementChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                      {procurementChartData.map((entry, index) => (
                        <Cell key={entry.key || entry.name} fill={intelligenceChartColors[index % intelligenceChartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [money(value), labelize(name)]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="erp-donut-center">
                  <strong>{money(dashboard?.procurement_overview?.total_po_value)}</strong>
                  <span>Total PO value</span>
                </div>
              </>
            ) : (
              <EmptyChart />
            )}
          </div>
          <div className="erp-summary-list">
            {procurementStatuses.map((row) => (
              <DashboardMetricRow key={row.status} label={labelize(row.status)} value={money(row.value || 0)} sub={`${row.total || 0} orders`} tone="blue" />
            ))}
          </div>
        </section>
      </div>

      <div className="erp-dashboard-grid three">
        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="Pending Approvals" />
          <div className="erp-signal-list">
            {pendingApprovals.length ? pendingApprovals.map((item, index) => (
              <article key={`${item.type}-${item.title}-${index}`}>
                <span className={`erp-signal-icon ${statusColor[item.severity] || 'neutral'}`}>
                  <CheckCircle2 size={15} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.type}{item.project ? ` | ${item.project}` : ''}</small>
                </div>
                <div className="erp-signal-meta">
                  <strong>{item.amount ? money(item.amount) : shortDate(item.due_date)}</strong>
                  <Badge value={item.severity || item.priority} />
                </div>
              </article>
            )) : (
              <div className="empty-cell">No pending approvals</div>
            )}
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Package} title="Inventory Alerts" />
          <div className="erp-signal-list">
            {inventoryAlerts.length ? inventoryAlerts.map((item) => (
              <article key={item.sku || item.name}>
                <span className="erp-signal-icon warn">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{labelize(item.category)} | {item.sku}</small>
                </div>
                <div className="erp-signal-meta">
                  <strong>{compactFormatter.format(toChartNumber(item.quantity_on_hand))} {item.unit}</strong>
                  <small>Min. {compactFormatter.format(toChartNumber(item.reorder_level))}</small>
                </div>
              </article>
            )) : (
              <div className="empty-cell">No inventory alerts</div>
            )}
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Users} title="Workforce Attendance" />
          <div className="erp-attendance-card">
            <div>
              <strong>{workforce.attendance_rate || 0}%</strong>
              <span>Present today</span>
            </div>
            <DashboardProgress value={workforce.attendance_rate || 0} tone="green" />
          </div>
          <div className="erp-summary-list">
            <DashboardMetricRow label="Total workers" value={workforce.total_workers || 0} tone="blue" />
            <DashboardMetricRow label="Present" value={workforce.present_today || 0} tone="green" />
            <DashboardMetricRow label="Absent" value={workforce.absent_today || 0} tone="red" />
            <DashboardMetricRow label="On leave" value={workforce.on_leave || 0} tone="amber" />
          </div>
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={WalletCards} title="Invoice Summary" />
          <div className="erp-summary-list invoice">
            {invoiceRows.map(([label, count, amount, tone]) => (
              <DashboardMetricRow key={label} label={label} value={amount} sub={`${count} records`} tone={tone} />
            ))}
            <DashboardMetricRow label="Total invoiced" value={money(invoiceSummary.total_invoiced)} tone="blue" />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Calculator} title="Cost Breakdown" />
          <div className="erp-cost-bars">
            {costBreakdown.length ? costBreakdown.map((row, index) => {
              const percent = row.percent || (costTotal > 0 ? Math.round((toChartNumber(row.actual) / costTotal) * 100) : 0)
              return (
                <article key={row.category || index}>
                  <div>
                    <strong>{labelize(row.category || 'Uncategorized')}</strong>
                    <span>{money(row.actual)} | {percent}%</span>
                  </div>
                  <DashboardProgress value={percent} tone={index % 2 ? 'green' : 'blue'} />
                </article>
              )
            }) : (
              <div className="empty-cell">No cost breakdown yet</div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={BarChart3} title="Project Performance" />
        <DataTable
          columns={['Project', 'Progress', 'Budget', 'Budget utilized', 'Cost to date', 'Cost variance', 'Schedule', 'SPI', 'CPI', 'Status']}
          rows={projectPerformance.map((project) => [
            project.project || project.name,
            <div key="progress" className="erp-table-progress">
              <span>{Math.round(toChartNumber(project.progress_percent))}%</span>
              <DashboardProgress value={project.progress_percent || 0} />
            </div>,
            money(project.budget),
            `${project.budget_utilized_percent || 0}%`,
            money(project.cost_to_date),
            money(project.cost_variance),
            formatScheduleVariance(project.schedule_variance_days),
            project.spi ?? 'N/A',
            project.cpi ?? 'N/A',
            <Badge key="status" value={project.status} />,
          ])}
        />
      </section>
    </section>
  )
}

function DashboardProjectCard({ project }) {
  const progress = Math.round(toChartNumber(project.progress_percent))

  return (
    <article className="erp-project-card">
      <ProjectVisual project={project} className="erp-project-mark" />
      <div className="erp-project-card-body">
        <div>
          <strong>{project.name || project.project}</strong>
          <small>{project.client || project.country || 'No client assigned'}</small>
        </div>
        <Badge value={project.status} />
        <DashboardProgress value={progress} />
        <div className="erp-project-card-meta">
          <span>{money(project.contract_value || project.budget_total)}</span>
          <span>{progress}%</span>
        </div>
      </div>
    </article>
  )
}

function ProjectVisual({ project, className = '' }) {
  const imageUrl = projectFutureImageUrl(project)
  const name = project?.name || project?.project || project?.code || 'Project'

  return (
    <div className={`project-visual ${className} ${imageUrl ? 'has-image' : 'placeholder'}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} future view`} loading="lazy" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  )
}

function ProjectImageUpload({ label = 'Future Project Image', imageUrl = '', file, onChange, className = '' }) {
  return (
    <div className={`project-image-upload ${className}`}>
      <div className={`project-image-preview ${imageUrl ? 'has-image' : ''}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="Future project preview" />
        ) : (
          <div>
            <Upload size={22} />
            <strong>No image selected</strong>
            <small>Upload the final project view for dashboard and portfolio cards.</small>
          </div>
        )}
      </div>
      <label className="field project-image-input">
        <span>{label}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} />
        <small>{file?.name || 'JPG, PNG, or WebP up to 6 MB'}</small>
      </label>
    </div>
  )
}

function DashboardMetricRow({ label, value, sub, tone = 'neutral' }) {
  return (
    <div className={`erp-metric-row ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  )
}

function DashboardProgress({ value, tone = 'blue' }) {
  const width = Math.max(0, Math.min(100, toChartNumber(value)))

  return (
    <div className={`erp-progress ${tone}`}>
      <span style={{ width: `${width}%` }} />
    </div>
  )
}

function formatScheduleVariance(value) {
  if (value === null || value === undefined) return 'N/A'

  const days = Number(value)
  if (!Number.isFinite(days)) return 'N/A'
  if (days === 0) return 'Today'

  return `${days > 0 ? '+' : ''}${days} days`
}

function CrmView({ branches, sales, leadForm, setLeadForm, createLead, runAction }) {
  const [editingLeadId, setEditingLeadId] = useState(null)
  const leads = sales.leads || []
  const opportunities = sales.opportunities || []
  const tenders = sales.tenders || []
  const estimates = sales.estimates || []
  const editingLead = leads.find((lead) => lead.id === editingLeadId)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const activeOpportunities = opportunities.filter((opportunity) => !['won', 'lost'].includes(opportunity.stage))
  const submittedTenders = tenders.filter((tender) => ['submitted', 'pending'].includes(tender.status))
  const openTenders = tenders.filter((tender) => !['won', 'lost'].includes(tender.status))
  const wonTenders = tenders.filter((tender) => tender.status === 'won')
  const lostTenders = tenders.filter((tender) => tender.status === 'lost')
  const qualifiedLeads = leads.filter((lead) => lead.stage === 'qualified')
  const pendingFollowUps = leads.filter((lead) => lead.next_follow_up_at && !['won', 'lost'].includes(lead.stage))
  const weightedOpportunityValue = activeOpportunities.reduce((total, opportunity) => total + (Number(opportunity.estimated_value || 0) * Number(opportunity.probability || 0)) / 100, 0)
  const openTenderValue = openTenders.reduce((total, tender) => total + Number(tender.value || 0), 0)
  const pipelineValue = activeOpportunities.reduce((total, opportunity) => total + Number(opportunity.estimated_value || 0), 0) + openTenderValue
  const expectedRevenue = weightedOpportunityValue + openTenderValue
  const revenueThisMonth = wonTenders
    .filter((tender) => dateFrom(tender.won_at || tender.updated_at) >= monthStart)
    .reduce((total, tender) => total + Number(tender.value || 0), 0)
  const conversionBase = leads.length || opportunities.length || tenders.length
  const conversionRate = conversionBase ? Math.round((wonTenders.length / conversionBase) * 100) : 0
  const wonTenderValues = wonTenders.map((tender) => Number(tender.value || 0)).filter((value) => value > 0)
  const activeDealValues = activeOpportunities.map((opportunity) => Number(opportunity.estimated_value || 0)).filter((value) => value > 0)
  const dealValues = wonTenderValues.length ? wonTenderValues : activeDealValues
  const averageDealSize = dealValues.length ? dealValues.reduce((total, value) => total + value, 0) / dealValues.length : 0
  const salesCycleDays = wonTenders
    .map((tender) => daysBetween(tender.created_at, tender.won_at || tender.updated_at))
    .filter((days) => Number.isFinite(days) && days >= 0)
  const averageSalesCycle = salesCycleDays.length ? Math.round(salesCycleDays.reduce((total, value) => total + value, 0) / salesCycleDays.length) : 0
  const assignedCounts = new Map()

  ;[...leads, ...opportunities].forEach((item) => {
    const owner = item.assigned_to ? `User ${item.assigned_to}` : 'Unassigned'
    assignedCounts.set(owner, (assignedCounts.get(owner) || 0) + 1)
  })

  const topSalesperson = [...assignedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unassigned'
  const companyMap = new Map()

  function registerCompany(name, contact, recordType, amount = 0, extras = {}) {
    if (!name) return

    const key = String(name).trim().toLowerCase()
    const current = companyMap.get(key) || {
      name,
      contacts: new Map(),
      leads: 0,
      opportunities: 0,
      tenders: 0,
      estimates: 0,
      projects: 0,
      contracts: 0,
      documents: 0,
      meetings: 0,
      emails: 0,
      payments: 0,
      value: 0,
    }

    current[recordType] = (current[recordType] || 0) + 1
    current.value += Number(amount || 0)
    current.projects += extras.project_id ? 1 : 0
    current.contracts += recordType === 'tenders' && extras.status === 'won' ? 1 : 0
    current.documents += extras.documents || 0
    current.meetings += extras.meetings || 0
    current.emails += extras.email ? 1 : 0
    current.payments += extras.payments || 0

    if (contact?.name || contact?.email || contact?.phone) {
      const contactKey = String(contact.name || contact.email || contact.phone).trim().toLowerCase()
      current.contacts.set(contactKey, {
        name: contact.name || 'Primary contact',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || 'Primary contact',
      })
    }

    companyMap.set(key, current)
  }

  leads.forEach((lead) => {
    registerCompany(
      lead.company_name || lead.client?.name,
      { name: lead.contact_name, email: lead.email, phone: lead.phone },
      'leads',
      lead.estimated_value,
      { email: lead.email, meetings: lead.stage === 'site_visit' ? 1 : 0 },
    )
  })

  opportunities.forEach((opportunity) => {
    registerCompany(
      opportunity.client?.name || opportunity.lead?.company_name,
      {
        name: opportunity.client?.contact_name || opportunity.lead?.contact_name,
        email: opportunity.client?.email || opportunity.lead?.email,
        phone: opportunity.client?.phone || opportunity.lead?.phone,
      },
      'opportunities',
      opportunity.estimated_value,
    )
  })

  tenders.forEach((tender) => {
    registerCompany(
      tender.client?.name || tender.opportunity?.client?.name,
      { name: tender.client?.contact_name, email: tender.client?.email, phone: tender.client?.phone },
      'tenders',
      tender.value,
      {
        project_id: tender.project_id,
        status: tender.status,
        documents: tender.documents?.length || 0,
      },
    )
  })

  estimates.forEach((estimate) => {
    registerCompany(
      estimate.tender?.client?.name || estimate.client?.name,
      { name: estimate.client?.contact_name, email: estimate.client?.email, phone: estimate.client?.phone },
      'estimates',
      estimate.total_amount,
    )
  })

  const companyProfiles = [...companyMap.values()].sort((a, b) => b.value - a.value)
  const topClients = companyProfiles.slice(0, 3)
  const contactRows = companyProfiles.flatMap((profile) =>
    [...profile.contacts.values()].map((contact) => [
      profile.name,
      contact.name,
      contact.role,
      contact.email,
      contact.phone,
    ]),
  )

  const pipelineStages = [
    { label: 'Lead', count: leads.length },
    { label: 'Contacted', count: pendingFollowUps.length },
    { label: 'Qualified', count: qualifiedLeads.length + opportunities.filter((opportunity) => opportunity.stage === 'qualified').length },
    { label: 'Site Visit', count: leads.filter((lead) => lead.stage === 'site_visit').length + opportunities.filter((opportunity) => opportunity.stage === 'site_visit').length },
    { label: 'Needs Assessment', count: opportunities.filter((opportunity) => opportunity.stage === 'needs_assessment').length },
    { label: 'Proposal', count: opportunities.filter((opportunity) => opportunity.stage === 'proposal').length },
    { label: 'Estimate', count: estimates.length },
    { label: 'Tender Submitted', count: submittedTenders.length },
    { label: 'Negotiation', count: tenders.filter((tender) => tender.status === 'pending').length + opportunities.filter((opportunity) => opportunity.stage === 'negotiation').length },
    { label: 'Contract Awarded', count: wonTenders.length },
    { label: 'Project Started', count: wonTenders.filter((tender) => tender.project_id).length },
    { label: 'Project Completed', count: 0 },
    { label: 'Warranty', count: 0 },
    { label: 'Repeat Business', count: 0 },
  ]

  const activityRows = [
    ...leads
      .filter((lead) => lead.next_follow_up_at)
      .map((lead) => ({
        date: lead.next_follow_up_at,
        type: 'Follow-up',
        client: lead.company_name,
        owner: lead.assigned_to ? `User ${lead.assigned_to}` : 'Unassigned',
        outcome: lead.stage === 'new' ? 'Qualify lead' : labelize(lead.stage),
      })),
    ...opportunities
      .filter((opportunity) => opportunity.expected_close_date)
      .map((opportunity) => ({
        date: opportunity.expected_close_date,
        type: 'Opportunity close',
        client: opportunity.client?.name || opportunity.name,
        owner: opportunity.assigned_to ? `User ${opportunity.assigned_to}` : 'Unassigned',
        outcome: `${opportunity.probability || 0}% probability`,
      })),
    ...tenders
      .filter((tender) => tender.deadline_at)
      .map((tender) => ({
        date: tender.deadline_at,
        type: 'Tender deadline',
        client: tender.client?.name || tender.title,
        owner: 'Business development',
        outcome: labelize(tender.status),
      })),
  ].sort((a, b) => dateFrom(a.date) - dateFrom(b.date))

  const upcomingRows = activityRows.filter((item) => dateFrom(item.date) >= now).slice(0, 8)
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowValue = tomorrow.toISOString().slice(0, 10)
  const todayMeetings = activityRows.filter((item) => String(item.date).slice(0, 10) === today && item.type.includes('Meeting')).length
  const tomorrowFollowUps = activityRows.filter((item) => String(item.date).slice(0, 10) === tomorrowValue && item.type === 'Follow-up').length

  const eventTimeline = []
  leads.forEach((lead) => {
    addCrmEvent(eventTimeline, lead.created_at, 'Lead Created', lead.company_name, lead.source || 'Direct', lead.stage)
    addCrmEvent(eventTimeline, lead.next_follow_up_at, 'Follow-up Scheduled', lead.company_name, lead.contact_name || 'Client contact', 'scheduled')
  })
  opportunities.forEach((opportunity) => {
    addCrmEvent(eventTimeline, opportunity.created_at, 'Opportunity Qualified', opportunity.name, opportunity.client?.name || '', opportunity.stage)
  })
  tenders.forEach((tender) => {
    addCrmEvent(eventTimeline, tender.submitted_at, 'Tender Submitted', tender.title, tender.client?.name || '', 'submitted')
    addCrmEvent(eventTimeline, tender.won_at, 'Contract Awarded', tender.title, money(tender.value), tender.status)
  })
  estimates.forEach((estimate) => {
    addCrmEvent(eventTimeline, estimate.approved_at || estimate.created_at, 'Estimate Prepared', estimate.title, money(estimate.total_amount), estimate.status)
  })

  const timelineRows = eventTimeline.sort((a, b) => dateFrom(b.date) - dateFrom(a.date)).slice(0, 10)
  const estimateCategoryTotals = new Map()
  estimates.forEach((estimate) => {
    ;(estimate.lines || []).forEach((line) => {
      const category = line.category || 'uncategorized'
      estimateCategoryTotals.set(category, (estimateCategoryTotals.get(category) || 0) + Number(line.line_total || 0))
    })
  })
  const estimateStackRows = [
    ['Labour', money(estimateCategoryTotals.get('labour')), 'Estimate lines'],
    ['Materials', money(estimateCategoryTotals.get('materials')), 'Estimate lines'],
    ['Equipment', money(estimateCategoryTotals.get('equipment')), 'Estimate lines'],
    ['Subcontractors', money(estimateCategoryTotals.get('subcontractor')), 'Estimate lines'],
    ['Overheads', money(estimates.reduce((total, estimate) => total + Number(estimate.overhead_amount || 0), 0)), 'Estimate header'],
    ['Profit', money(estimates.reduce((total, estimate) => total + Number(estimate.profit_amount || 0), 0)), 'Estimate header'],
    ['Contingency', money(0), 'Pending field'],
    ['Taxes', money(estimates.reduce((total, estimate) => total + Number(estimate.tax_amount || 0), 0)), 'Estimate header'],
    ['Final Price', money(estimates.reduce((total, estimate) => total + Number(estimate.total_amount || 0), 0)), 'Approved total'],
  ]

  const forecastRows = [30, 60, 90].map((days) => {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + days)
    const value = activeOpportunities
      .filter((opportunity) => {
        const closeDate = dateFrom(opportunity.expected_close_date)
        return closeDate && closeDate <= cutoff
      })
      .reduce((total, opportunity) => total + (Number(opportunity.estimated_value || 0) * Number(opportunity.probability || 0)) / 100, 0)

    return [`${days} Days`, money(value), 'Probability weighted']
  })

  const crmMenuItems = [
    'Dashboard',
    'Leads',
    'Companies',
    'Contacts',
    'Activities',
    'Calendar',
    'Opportunities',
    'Site Visits',
    'Estimates',
    'Quotations',
    'Proposals',
    'Tenders',
    'Contracts',
    'Clients',
    'Communications',
    'Documents',
    'Support & Warranty',
    'Business Development',
    'Reports',
    'Analytics',
    'Automation',
    'Settings',
  ]

  function saveLead(event) {
    if (!editingLeadId) {
      createLead(event)
      return
    }

    event.preventDefault()

    runAction(
      () =>
        api.updateLead(editingLeadId, {
          ...leadForm,
          branch_id: Number(leadForm.branch_id || editingLead?.branch_id || branches[0]?.id || 0),
          estimated_value: Number(leadForm.estimated_value || 0),
          next_follow_up_at: leadForm.next_follow_up_at || null,
        }),
      'Lead updated.',
    ).then(() => {
      setEditingLeadId(null)
      setLeadForm({ ...emptyLeadForm, branch_id: leadForm.branch_id })
    })
  }

  function editLead(lead) {
    setEditingLeadId(lead.id)
    setLeadForm({
      branch_id: lead.branch_id || lead.branch?.id || branches[0]?.id || '',
      company_name: lead.company_name || '',
      contact_name: lead.contact_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || 'direct',
      estimated_value: lead.estimated_value || '',
      next_follow_up_at: datetimeLocalInputValue(lead.next_follow_up_at),
    })
  }

  function cancelLeadEdit() {
    setEditingLeadId(null)
    setLeadForm({ ...emptyLeadForm, branch_id: leadForm.branch_id })
  }

  function deleteLead(lead) {
    if (!window.confirm(`Archive lead ${lead.lead_number || lead.company_name}?`)) {
      return
    }

    runAction(() => api.deleteLead(lead.id), 'Lead archived.').then(() => {
      if (editingLeadId === lead.id) {
        cancelLeadEdit()
      }
    })
  }

  return (
    <section className="view-stack crm-page">
      <section className="crm-hero">
        <div>
          <span>Business Development & Client Relationship Hub</span>
        </div>
        <div className="crm-hero-metrics">
          <Metric label="Pipeline Value" value={money(pipelineValue)} />
          <Metric label="Expected Revenue" value={money(expectedRevenue)} />
          <Metric label="Won Projects" value={wonTenders.length} />
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={BarChart3} title="Customer Relation Management(CRM) Dashboard" />
        <div className="kpi-grid crm-dashboard-grid">
          <Kpi icon={Handshake} label="New Leads" value={leads.filter((lead) => lead.stage === 'new').length} sub="Fresh business inquiries" />
          <Kpi icon={CheckCircle2} label="Qualified Leads" value={qualifiedLeads.length} sub="Ready for opportunity tracking" />
          <Kpi icon={ClipboardList} label="Active Opportunities" value={activeOpportunities.length} sub="Live deal records" />
          <Kpi icon={FileText} label="Submitted Tenders" value={submittedTenders.length} sub="Submitted or pending tenders" />
          <Kpi icon={FolderKanban} label="Won Projects" value={wonTenders.length} sub="Awarded tenders" />
          <Kpi icon={AlertTriangle} label="Lost Projects" value={lostTenders.length} sub="Lost tenders to review" />
          <Kpi icon={Clock3} label="Pending Follow-ups" value={pendingFollowUps.length} sub="Lead next actions" />
          <Kpi icon={WalletCards} label="Expected Revenue" value={money(expectedRevenue)} sub="Weighted opportunities and open tenders" />
          <Kpi icon={WalletCards} label="Revenue This Month" value={money(revenueThisMonth)} sub="Won value this month" />
          <Kpi icon={BarChart3} label="Pipeline Value" value={money(pipelineValue)} sub="Open commercial value" />
          <Kpi icon={Layers3} label="Conversion Rate" value={`${conversionRate}%`} sub="Won tenders against lead base" />
          <Kpi icon={Calculator} label="Average Deal Size" value={money(averageDealSize)} sub="Won or active deal average" />
          <Kpi icon={CalendarDays} label="Average Sales Cycle" value={`${averageSalesCycle} days`} sub="Created to award" />
          <Kpi icon={Building2} label="Top Clients" value={topClients.length} sub={topClients.map((client) => client.name).join(', ') || 'No client records'} />
          <Kpi icon={Users} label="Top Salesperson" value={topSalesperson} sub="By assigned lead and opportunity count" />
          <Kpi icon={CalendarDays} label="Upcoming Meetings" value={todayMeetings} sub={`${tomorrowFollowUps} follow-ups tomorrow`} />
        </div>
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Handshake} title={editingLeadId ? 'Edit Lead' : 'New Lead'} />
          <form className="form-grid two" onSubmit={saveLead}>
            <Select label="Branch" name="branch_id" value={leadForm.branch_id} onChange={setForm(setLeadForm)} required>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Field label="Source" name="source" value={leadForm.source} onChange={setForm(setLeadForm)} />
            <Field label="Company" name="company_name" value={leadForm.company_name} onChange={setForm(setLeadForm)} required />
            <Field label="Contact" name="contact_name" value={leadForm.contact_name} onChange={setForm(setLeadForm)} />
            <Field label="Email" type="email" name="email" value={leadForm.email} onChange={setForm(setLeadForm)} />
            <Field label="Phone" name="phone" value={leadForm.phone} onChange={setForm(setLeadForm)} />
            <Field label="Estimated value" type="number" name="estimated_value" value={leadForm.estimated_value} onChange={setForm(setLeadForm)} />
            <Field label="Follow-up" type="datetime-local" name="next_follow_up_at" value={leadForm.next_follow_up_at} onChange={setForm(setLeadForm)} />
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {editingLeadId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {editingLeadId ? 'Save lead' : 'Add lead'}
              </button>
              {editingLeadId && (
                <button type="button" className="table-action" onClick={cancelLeadEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Users} title="Pipeline Summary" />
          <div className="kpi-grid compact">
            <Kpi icon={Handshake} label="Leads" value={leads.length} sub="Open sales records" />
            <Kpi icon={ClipboardList} label="Opportunities" value={opportunities.length} sub="Qualified pipeline" />
            <Kpi icon={ClipboardList} label="Tenders" value={tenders.length} sub="Tender records" />
            <Kpi icon={Calculator} label="Estimates" value={estimates.length} sub="Cost scenarios" />
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Layers3} title="Complete Sales Pipeline" />
        <div className="crm-lifecycle">
          {pipelineStages.map((stage) => (
            <div key={stage.label} className="crm-stage">
              <span>{stage.label}</span>
              <strong>{stage.count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Handshake} title="Leads" />
        <DataTable
          columns={['No.', 'Company', 'Contact', 'Stage', 'Value', 'Follow-up', 'Actions']}
          rows={(sales.leads || []).map((lead) => [
            lead.lead_number,
            lead.company_name,
            lead.contact_name || '',
            <Badge key="stage" value={lead.stage} />,
            money(lead.estimated_value),
            shortDate(lead.next_follow_up_at),
            <div key="actions" className="row-actions">
              <button type="button" className="table-action" onClick={() => editLead(lead)}>
                Edit
              </button>
              {lead.stage === 'new' && (
                <button
                  type="button"
                  className="table-action"
                  onClick={() => runAction(() => api.qualifyLead(lead.id, { name: `${lead.company_name} opportunity` }), 'Lead qualified.')}
                >
                  Qualify
                </button>
              )}
              <button type="button" className="table-action danger" onClick={() => deleteLead(lead)}>
                Archive
              </button>
            </div>,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={ClipboardList} title="Opportunities" />
        <DataTable
          columns={['No.', 'Opportunity', 'Client', 'Stage', 'Probability', 'Value', 'Action']}
          rows={(sales.opportunities || []).map((opportunity) => [
            opportunity.opportunity_number,
            opportunity.name,
            opportunity.client?.name || '',
            <Badge key="stage" value={opportunity.stage} />,
            `${opportunity.probability}%`,
            money(opportunity.estimated_value),
            !['tender', 'won', 'lost'].includes(opportunity.stage) ? (
              <button
                key="tender"
                type="button"
                className="table-action"
                onClick={() => runAction(() => api.createTenderFromOpportunity(opportunity.id, { title: opportunity.name }), 'Tender created.')}
              >
                Create tender
              </button>
            ) : (
              ''
            ),
          ])}
        />
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Building2} title="Companies" />
          <DataTable
            columns={['Company', 'Contacts', 'Projects', 'Tenders', 'Pipeline Value', 'Profile Coverage']}
            rows={companyProfiles.map((profile) => [
              profile.name,
              profile.contacts.size,
              profile.projects,
              profile.tenders,
              money(profile.value),
              <div key="coverage" className="crm-chip-list">
                {['Information', 'Contacts', 'Projects', 'Invoices', 'Meetings', 'Documents', 'Contracts', 'Payments', 'Emails', 'Notes'].map((item) => (
                  <span key={item} className="crm-chip">{item}</span>
                ))}
              </div>,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Users} title="Contact Management" />
          <DataTable
            columns={['Company', 'Contact', 'Role', 'Email', 'Phone']}
            rows={contactRows}
          />
          <MiniList items={['CEO', 'Project Director', 'Quantity Surveyor', 'Procurement Officer', 'Finance Manager', 'Architect']} />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={CalendarDays} title="Activities" />
          <DataTable
            columns={['Date', 'Activity', 'Client', 'Owner', 'Outcome / Next Action']}
            rows={activityRows.slice(0, 10).map((item) => [
              shortDate(item.date),
              item.type,
              item.client,
              item.owner,
              item.outcome,
            ])}
          />
          <MiniList items={['Phone Call', 'Meeting', 'Email', 'Site Visit', 'Presentation', 'Proposal', 'Tender Submission', 'Lunch Meeting', 'Client Visit']} />
        </section>

        <section className="panel">
          <PanelTitle icon={CalendarDays} title="Calendar" />
          <DataTable
            columns={['Date', 'Calendar Item', 'Client', 'Status']}
            rows={upcomingRows.map((item) => [
              shortDate(item.date),
              item.type,
              item.client,
              item.outcome,
            ])}
          />
          <div className="crm-mini-metrics">
            <Metric label="Today Meetings" value={todayMeetings} />
            <Metric label="Tomorrow Follow-ups" value={tomorrowFollowUps} />
            <Metric label="Tender Deadlines" value={upcomingRows.filter((item) => item.type === 'Tender deadline').length} />
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={ClipboardList} title="Tender Management" />
        <DataTable
          columns={['Tender Number', 'Client', 'Submission Date', 'Closing Date', 'Status', 'Estimated Value', 'Bid Bond', 'Competitors', 'Result']}
          rows={tenders.map((tender) => {
            const bidSecurityRecord = (tender.records || []).find((record) => record.record_type === 'bid_security')
            const bidSecurityDocument = (tender.documents || []).find((document) => ['bid_bond', 'bid_security'].includes(document.document_type))
            const competitorRecord = (tender.records || []).find((record) => ['competitor', 'competitor_analysis', 'evaluation', 'outcome'].includes(record.record_type))

            return [
              tender.tender_number,
              tender.client?.name || '',
              shortDate(tender.submitted_at),
              shortDate(tender.deadline_at),
              <Badge key="status" value={tender.status} />,
              money(tender.value),
              bidSecurityRecord ? labelize(bidSecurityRecord.status) : bidSecurityDocument ? 'Document uploaded' : 'Not recorded',
              tender.lost_reason || competitorRecord?.title || 'Not recorded',
              tender.status === 'won' ? 'Awarded' : tender.status === 'lost' ? tender.lost_reason || 'Lost' : 'Pending',
            ]
          })}
        />
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Calculator} title="Estimating" />
          <DataTable columns={['Cost Component', 'Amount', 'Source']} rows={estimateStackRows} />
        </section>

        <section className="panel">
          <PanelTitle icon={FileText} title="Proposals, Quotations, and Contracts" />
          <DataTable
            columns={['Commercial Record', 'Tracks', 'Conversion']}
            rows={[
              ['Proposal Generator', 'Company details, client, scope, timeline, pricing, terms, signature', 'Professional PDF'],
              ['Quotation Management', 'Quotation, accepted, rejected, expired, converted', `${estimates.length} estimate records available`],
              ['Contract Management', 'Milestones, retention, payment schedule, variations, warranty', `${wonTenders.length} award-ready records`],
            ]}
          />
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Clock3} title="Relationship Timeline" />
        <div className="crm-timeline">
          {timelineRows.length === 0 ? (
            <div className="empty-cell">No records</div>
          ) : (
            timelineRows.map((item) => (
              <div key={`${item.date}-${item.title}-${item.type}`} className="crm-timeline-item">
                <span>{shortDate(item.date)}</span>
                <strong>{item.type}</strong>
                <p>{item.title}</p>
                <small>{item.detail}</small>
                <Badge value={item.status} />
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Send} title="Customer Communication" />
          <DataTable
            columns={['Channel', 'Tracked Fields', 'Client Link']}
            rows={[
              ['Emails', 'Subject, body, attachment, sent date', 'Company timeline'],
              ['Phone Calls', 'Call date, duration, outcome, next action', 'Contact record'],
              ['SMS / WhatsApp', 'Message, delivery, reply, follow-up', 'Connector-backed timeline'],
              ['Meetings', 'Agenda, attendees, notes, decisions', 'Activity calendar'],
              ['Letters', 'Reference, document, delivery status', 'Document register'],
            ]}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={FileText} title="Documents" />
          <DataTable
            columns={['Document Type', 'Current Count', 'Linked To']}
            rows={[
              ['Proposal', estimates.length, 'Estimate and client'],
              ['Tender Documents', tenders.reduce((total, tender) => total + (tender.documents?.length || 0), 0), 'Tender and company'],
              ['Contracts', wonTenders.length, 'Awarded tender'],
              ['Drawings', 0, 'Document management'],
              ['Quotation', estimates.length, 'Commercial record'],
              ['Company Registration / Insurance', 0, 'Company profile'],
            ]}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Building2} title="Client Portal Integration" />
          <MiniList items={['Progress', 'Invoices', 'Approvals', 'Documents', 'Meetings', 'Photos', 'Variation Requests', 'Payments']} />
        </section>

        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Client Feedback, Support, and Warranty" />
          <DataTable
            columns={['Area', 'Tracks', 'Status']}
            rows={[
              ['Client Feedback', 'Quality, communication, speed, safety, professionalism, would recommend', 'Post-handover'],
              ['Customer Support', 'Complaints, warranty issues, maintenance requests, support tickets', 'After completion'],
              ['Warranty', 'Warranty period, obligations, service visits, resolution time', 'Contract handover'],
            ]}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Globe2} title="Business Development & Competitor Tracking" />
          <DataTable
            columns={['Area', 'Records', 'Examples']}
            rows={[
              ['Business Development', 'Potential clients, developers, government projects, NGOs, schools, hospitals', `${qualifiedLeads.length + activeOpportunities.length} active records`],
              ['Competitor Tracking', 'Won by, reason lost, bid difference, market segment', 'Lower price / relationship / scope'],
              ['Sales Forecasting', '30 days, 60 days, 90 days, probability weighted', 'Planning view'],
            ]}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={BarChart3} title="Sales Forecasting" />
          <DataTable columns={['Window', 'Expected Revenue', 'Basis']} rows={forecastRows} />
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={BarChart3} title="Reports and Analytics" />
        <DataTable
          columns={['Report Group', 'Metrics']}
          rows={[
            ['Lead Performance', 'Lead sources, lead conversion, sales by branch, sales by employee, sales by industry'],
            ['Tendering', 'Tender success rate, proposal win rate, lost deals, reasons lost, competitor outcomes'],
            ['Pipeline', 'Pipeline value, forecast revenue, average deal size, average sales cycle'],
            ['Client Relationship', 'Top clients, repeat clients, support cases, warranty outcomes, feedback scores'],
          ]}
        />
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Workflow} title="Automation" />
          <DataTable
            columns={['Trigger', 'Automation']}
            rows={[
              ['Lead Created', 'Assign salesperson, send welcome email, schedule follow-up'],
              ['Tender Closing in 3 Days', 'Notify business development manager'],
              ['Proposal Accepted', 'Create project, notify projects and finance, generate contract'],
              ['Project Completed', 'Send satisfaction survey, create warranty period'],
            ]}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Layers3} title="Module Integration" />
          <DataTable
            columns={['Module', 'Client Lifecycle Action']}
            rows={[
              ['Projects', 'Won opportunity creates project'],
              ['Finance', 'Accepted proposal creates invoice schedule'],
              ['Procurement', 'Project start generates procurement plan'],
              ['HR & Workforce', 'Project start allocates workforce'],
              ['Equipment', 'Reserve required equipment'],
              ['Document Management', 'Store all client documents'],
              ['Portals', 'Grant client portal access'],
            ]}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={BarChart3} title="AI Customer Relation Management(CRM)" />
          <DataTable
            columns={['Signal', 'Action']}
            rows={[
              ['Client not contacted in 30 days', 'Create follow-up task'],
              ['Tender win likelihood changed', 'Prompt bid review'],
              ['Follow-up due today', 'Notify salesperson'],
              ['Proposal priced above winning average', 'Flag pricing risk'],
            ]}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Settings} title="Recommended Customer Relation Management(CRM) Menu" />
          <div className="crm-menu-grid">
            {crmMenuItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function TenderingView({ branches, clients, users, sales, tenderForm, setTenderForm, createTender, runAction }) {
  const tenders = sales.tenders || emptyList
  const tendering = sales.tendering || {}
  const catalog = tendering.catalog || {}
  const analytics = tendering.analytics || {}
  const reports = tendering.reports || {}
  const [selectedTenderId, setSelectedTenderId] = useState(null)
  const [recordForm, setRecordForm] = useState({ record_type: '', owner_id: '', title: '', status: 'pending', priority: 'medium', due_at: '', amount: '', currency: 'GHS', notes: '' })
  const [rfiForm, setRfiForm] = useState({ category: '', question: '', submitted_to: '', submitted_at: '', due_at: '', related_drawing: '', related_boq_item: '', related_specification: '', internal_impact: '', cost_impact: '', schedule_impact_days: '' })
  const [documentForm, setDocumentForm] = useState({ title: '', document_type: '', version: '1', status: 'draft', is_mandatory: false, is_confidential: false, expires_at: '', comments: '', file: null })
  const selectedTender = tenders.find((tender) => tender.id === selectedTenderId) || tenders[0] || null
  const selectedRecords = selectedTender?.records || []
  const selectedRecordTypes = Object.entries(catalog.record_types || {})

  useEffect(() => {
    if (!selectedTenderId && tenders[0]?.id) {
      setSelectedTenderId(tenders[0].id)
      return
    }

    if (selectedTenderId && tenders.length > 0 && !tenders.some((tender) => tender.id === selectedTenderId)) {
      setSelectedTenderId(tenders[0].id)
    }
  }, [selectedTenderId, tenders])

  useEffect(() => {
    if (!recordForm.record_type && selectedRecordTypes[0]?.[0]) {
      setRecordForm((current) => ({ ...current, record_type: selectedRecordTypes[0][0] }))
    }
  }, [recordForm.record_type, selectedRecordTypes])

  function catalogOptions(group) {
    return Object.entries(group || {})
  }

  function formatBackendValue(card) {
    if (card.value_type === 'money') return money(card.value)
    if (card.value_type === 'percent') return `${card.value || 0}%`
    if (card.value_type === 'days') return `${card.value || 0} days`
    return card.value ?? 0
  }

  function tenderCardIcon(key) {
    return {
      active_tenders: ClipboardList,
      due_this_week: Clock3,
      awaiting_bid_decision: Handshake,
      under_preparation: Calculator,
      awaiting_approval: ShieldCheck,
      submitted: Send,
      under_evaluation: Eye,
      won: CheckCircle2,
      lost: AlertTriangle,
      active_value: WalletCards,
      weighted_pipeline_value: BarChart3,
      win_rate: Layers3,
      average_preparation_days: CalendarDays,
    }[key] || ClipboardList
  }

  function setBooleanDocumentField(event) {
    const { name, checked } = event.target
    setDocumentForm((current) => ({ ...current, [name]: checked }))
  }

  async function createTenderRecord(event) {
    event.preventDefault()
    if (!selectedTender) return

    await runAction(
      () =>
        api.createTenderRecord(selectedTender.id, {
          ...recordForm,
          owner_id: recordForm.owner_id ? Number(recordForm.owner_id) : null,
          due_at: recordForm.due_at || null,
          amount: Number(recordForm.amount || 0),
          currency: recordForm.currency || selectedTender.currency || 'GHS',
        }),
      'Tender record created.',
    )
    setRecordForm((current) => ({ ...current, title: '', due_at: '', amount: '', notes: '' }))
  }

  async function updateTenderRecordStatus(record, status) {
    await runAction(() => api.updateTenderRecord(record.id, { status }), 'Tender record updated.')
  }

  async function createRfi(event) {
    event.preventDefault()
    if (!selectedTender) return

    await runAction(
      () =>
        api.createTenderRfi(selectedTender.id, {
          ...rfiForm,
          submitted_at: rfiForm.submitted_at || null,
          due_at: rfiForm.due_at || null,
          cost_impact: Number(rfiForm.cost_impact || 0),
          schedule_impact_days: Number(rfiForm.schedule_impact_days || 0),
        }),
      'Tender RFI created.',
    )
    setRfiForm({ category: '', question: '', submitted_to: '', submitted_at: '', due_at: '', related_drawing: '', related_boq_item: '', related_specification: '', internal_impact: '', cost_impact: '', schedule_impact_days: '' })
  }

  async function uploadTenderDocument(event) {
    event.preventDefault()
    if (!selectedTender) return

    const payload = new FormData()
    Object.entries(documentForm).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        payload.append(key, value)
      }
    })

    await runAction(() => api.uploadTenderDocument(selectedTender.id, payload), 'Tender document uploaded.')
    setDocumentForm({ title: '', document_type: '', version: '1', status: 'draft', is_mandatory: false, is_confidential: false, expires_at: '', comments: '', file: null })
    event.target.reset()
  }

  function convertOpportunity(opportunity) {
    runAction(
      () =>
        api.createTenderFromOpportunity(opportunity.id, {
          title: opportunity.name,
          deadline_at: opportunity.expected_close_date || null,
          expected_award_at: opportunity.expected_close_date || null,
        }),
      'Tender created from opportunity.',
    )
  }

  function recordTenderOutcome(tender) {
    const outcome = window.prompt('Outcome status', 'won')
    if (!outcome) return

    const status = outcome.trim().toLowerCase().replaceAll(' ', '_')
    if (status === 'lost') {
      const reason = window.prompt('Loss reason')
      if (!reason) return
      runAction(() => api.loseTender(tender.id, reason), 'Tender outcome recorded.')
      return
    }

    runAction(() => api.updateTender(tender.id, { status }), 'Tender outcome recorded.')
  }

  function convertTenderToProject(tender) {
    runAction(
      () =>
        api.winTender(tender.id, {
          estimate_id: tender.estimates?.[0]?.id,
          project_name: tender.title,
        }),
      'Award converted to project.',
    )
  }

  const recordRows = selectedRecords.map((record) => [
    record.record_number,
    catalog.record_types?.[record.record_type] || labelize(record.record_type),
    record.title,
    record.owner?.name || '',
    <Badge key="status" value={record.status} />,
    <Badge key="priority" value={record.priority} />,
    shortDate(record.due_at),
    money(record.amount),
    <div key="actions" className="row-actions">
      {record.status !== 'completed' && (
        <button type="button" className="table-action" onClick={() => updateTenderRecordStatus(record, 'completed')}>
          Complete
        </button>
      )}
      {record.status !== 'approved' && (
        <button type="button" className="table-action" onClick={() => updateTenderRecordStatus(record, 'approved')}>
          Approve
        </button>
      )}
    </div>,
  ])

  return (
    <section className="view-stack tender-page">
      <section className="tender-hero">
        <div>
          <span>Bid Management & Pre-Construction Control Centre</span>
        </div>
        <div className="tender-hero-metrics">
          <Metric label="Active Value" value={money(tendering.summary?.active_value)} />
          <Metric label="Weighted Pipeline" value={money(tendering.summary?.weighted_pipeline_value)} />
          <Metric label="Win Rate" value={`${tendering.summary?.win_rate || 0}%`} />
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={BarChart3} title="Tender Dashboard" />
        <div className="kpi-grid tender-dashboard-grid">
          {(tendering.summary_cards || []).map((card) => (
            <Kpi key={card.key} icon={tenderCardIcon(card.key)} label={card.label} value={formatBackendValue(card)} sub={card.sub} />
          ))}
        </div>
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Plus} title="Create Tender" />
          <form className="form-grid tender-create-form" onSubmit={createTender}>
            <Select label="Source Opportunity" name="opportunity_id" value={tenderForm.opportunity_id} onChange={setForm(setTenderForm)}>
              <option value="">Create directly</option>
              {(tendering.bid_opportunities || []).map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.opportunity_number} - {opportunity.name}
                </option>
              ))}
            </Select>
            <Select label="Branch" name="branch_id" value={tenderForm.branch_id} onChange={setForm(setTenderForm)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select label="Client" name="client_id" value={tenderForm.client_id} onChange={setForm(setTenderForm)}>
              <option value="">New or opportunity client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Field label="Client Name" name="client_name" value={tenderForm.client_name} onChange={setForm(setTenderForm)} />
            <Field label="Tender Title" name="title" value={tenderForm.title} onChange={setForm(setTenderForm)} required />
            <Select label="Tender Manager" name="tender_manager_id" value={tenderForm.tender_manager_id} onChange={setForm(setTenderForm)}>
              <option value="">Unassigned</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
            <Select label="BD Officer" name="business_development_officer_id" value={tenderForm.business_development_officer_id} onChange={setForm(setTenderForm)}>
              <option value="">Unassigned</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
            <Select label="Tender Type" name="tender_type" value={tenderForm.tender_type} onChange={setForm(setTenderForm)}>
              <option value="">Select type</option>
              {catalogOptions(catalog.tender_types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select label="Procurement Method" name="procurement_method" value={tenderForm.procurement_method} onChange={setForm(setTenderForm)}>
              <option value="">Select method</option>
              {catalogOptions(catalog.procurement_methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select label="Project Sector" name="project_sector" value={tenderForm.project_sector} onChange={setForm(setTenderForm)}>
              <option value="">Select sector</option>
              {catalogOptions(catalog.project_sectors).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select label="Project Category" name="project_category" value={tenderForm.project_category} onChange={setForm(setTenderForm)}>
              <option value="">Select category</option>
              {catalogOptions(catalog.project_categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Field label="Project Location" name="project_location" value={tenderForm.project_location} onChange={setForm(setTenderForm)} />
            <Select label="Priority" name="priority" value={tenderForm.priority} onChange={setForm(setTenderForm)}>
              <option value="">Select priority</option>
              {catalogOptions(catalog.priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select label="Confidentiality" name="confidentiality_level" value={tenderForm.confidentiality_level} onChange={setForm(setTenderForm)}>
              <option value="">Select level</option>
              {catalogOptions(catalog.confidentiality_levels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Field label="Submission Deadline" type="datetime-local" name="deadline_at" value={tenderForm.deadline_at} onChange={setForm(setTenderForm)} />
            <Field label="Expected Award" type="datetime-local" name="expected_award_at" value={tenderForm.expected_award_at} onChange={setForm(setTenderForm)} />
            <Field label="Estimated Value" type="number" name="value" value={tenderForm.value} onChange={setForm(setTenderForm)} />
            <Field label="Tender Fee" type="number" name="tender_fee" value={tenderForm.tender_fee} onChange={setForm(setTenderForm)} />
            <Field label="Currency" name="currency" value={tenderForm.currency} onChange={setForm(setTenderForm)} />
            <Field label="Funding Source" name="funding_source" value={tenderForm.funding_source} onChange={setForm(setTenderForm)} />
            <Field label="Tender Authority" name="tender_authority" value={tenderForm.tender_authority} onChange={setForm(setTenderForm)} />
            <TextArea label="Scope Summary" name="scope_summary" value={tenderForm.scope_summary} onChange={setForm(setTenderForm)} />
            <TextArea label="Description" name="description" value={tenderForm.description} onChange={setForm(setTenderForm)} />
            <button type="submit" className="primary-action">
              <Plus size={17} />
              Create tender
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Tender Alerts" />
          <DataTable
            columns={['Alert', 'Tender', 'Priority', 'Owner']}
            rows={(tendering.alerts || []).map((alert) => [
              alert.message,
              `${alert.tender_number} - ${alert.tender_title}`,
              <Badge key="priority" value={alert.priority} />,
              alert.owner,
            ])}
          />
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Handshake} title="Bid Opportunities" />
        <DataTable
          columns={['Opportunity', 'Client', 'Stage', 'Value', 'Expected Award', 'Action']}
          rows={(tendering.bid_opportunities || []).map((opportunity) => [
            `${opportunity.opportunity_number} - ${opportunity.name}`,
            opportunity.client?.name || '',
            <Badge key="stage" value={opportunity.stage} />,
            money(opportunity.estimated_value),
            shortDate(opportunity.expected_close_date),
            <button key="convert" type="button" className="table-action" onClick={() => convertOpportunity(opportunity)}>
              Convert to tender
            </button>,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={ClipboardList} title="Tender Register" />
        <DataTable
          columns={['No.', 'Title', 'Client', 'Source', 'Status', 'Completion', 'Deadline', 'Days Left', 'Value', 'Probability', 'Actions']}
          rows={tenders.map((tender) => [
            tender.tender_number,
            tender.title,
            tender.client?.name || '',
            tender.source_label || '',
            <Badge key="status" value={tender.status === 'won' ? 'awarded' : tender.status} />,
            `${tender.completion_percent || 0}%`,
            shortDate(tender.deadline_at),
            tender.days_left === null || tender.days_left === undefined ? '' : `${tender.days_left} days`,
            money(tender.value),
            `${tender.probability || 0}%`,
            <div key="actions" className="row-actions">
              <button type="button" className="table-action" onClick={() => setSelectedTenderId(tender.id)}>
                Open
              </button>
              {['draft', 'pending', 'ready_for_submission'].includes(tender.status) && (
                <button type="button" className="table-action" onClick={() => runAction(() => api.submitTender(tender.id), 'Tender submitted.')}>
                  Record submission
                </button>
              )}
              {!['lost', 'cancelled', 'withdrawn', 'archived'].includes(tender.status) && (
                <button type="button" className="table-action" onClick={() => recordTenderOutcome(tender)}>
                  Record outcome
                </button>
              )}
              {['won', 'awarded'].includes(tender.status) && !tender.project_id && (
                <button type="button" className="table-action" onClick={() => convertTenderToProject(tender)}>
                  Convert to project
                </button>
              )}
            </div>,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={FolderKanban} title="Tender Workspace" />
        {selectedTender ? (
          <div className="tender-workspace">
            <div className="project-head tender-workspace-head">
              <div>
                <p>{selectedTender.tender_number}</p>
                <h2>{selectedTender.title}</h2>
              </div>
              <div className="project-metrics">
                <Metric label="Completion" value={`${selectedTender.completion_percent || 0}%`} />
                <Metric label="Value" value={money(selectedTender.value)} />
                <Metric label="Source" value={selectedTender.source_label || ''} />
                <Metric label="Weighted" value={money(selectedTender.weighted_value)} />
              </div>
            </div>

            <div className="grid-main">
              <section className="panel">
                <PanelTitle icon={Settings} title="Tender Status" />
                <form className="form-grid two" onSubmit={(event) => event.preventDefault()}>
                  <Select label="Status" value={selectedTender.status} onChange={(event) => runAction(() => api.updateTender(selectedTender.id, { status: event.target.value }), 'Tender status updated.')}>
                    {catalogOptions(catalog.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <Select label="Bid Decision" value={selectedTender.bid_decision || ''} onChange={(event) => runAction(() => api.updateTender(selectedTender.id, { bid_decision: event.target.value }), 'Bid decision updated.')}>
                    <option value="">No decision</option>
                    {catalogOptions(catalog.bid_decisions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </form>
              </section>

              <section className="panel">
                <PanelTitle icon={Eye} title="Overview" />
                <DataTable
                  columns={['Field', 'Value']}
                  rows={[
                    ['Client', selectedTender.client?.name || ''],
                    ['Source Opportunity', selectedTender.opportunity?.opportunity_number || ''],
                    ['Project', selectedTender.project?.code || ''],
                    ['Tender Type', catalog.tender_types?.[selectedTender.tender_type] || ''],
                    ['Procurement Method', catalog.procurement_methods?.[selectedTender.procurement_method] || ''],
                    ['Sector', catalog.project_sectors?.[selectedTender.project_sector] || ''],
                    ['Category', catalog.project_categories?.[selectedTender.project_category] || ''],
                    ['Location', selectedTender.project_location || ''],
                    ['Authority', selectedTender.tender_authority || ''],
                    ['Funding Source', selectedTender.funding_source || ''],
                  ]}
                />
              </section>
            </div>

            <section className="panel">
              <PanelTitle icon={Plus} title="Add Tender Record" />
              <form className="form-grid tender-create-form" onSubmit={createTenderRecord}>
                <Select label="Record Type" name="record_type" value={recordForm.record_type} onChange={setForm(setRecordForm)} required>
                  {selectedRecordTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select label="Owner" name="owner_id" value={recordForm.owner_id} onChange={setForm(setRecordForm)}>
                  <option value="">Unassigned</option>
                  {users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </Select>
                <Field label="Title" name="title" value={recordForm.title} onChange={setForm(setRecordForm)} required />
                <Select label="Status" name="status" value={recordForm.status} onChange={setForm(setRecordForm)}>
                  {catalogOptions(catalog.record_statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select label="Priority" name="priority" value={recordForm.priority} onChange={setForm(setRecordForm)}>
                  {catalogOptions(catalog.priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Field label="Due At" type="datetime-local" name="due_at" value={recordForm.due_at} onChange={setForm(setRecordForm)} />
                <Field label="Amount" type="number" name="amount" value={recordForm.amount} onChange={setForm(setRecordForm)} />
                <Field label="Currency" name="currency" value={recordForm.currency} onChange={setForm(setRecordForm)} />
                <TextArea label="Notes" name="notes" value={recordForm.notes} onChange={setForm(setRecordForm)} />
                <button type="submit" className="primary-action">
                  <Plus size={17} />
                  Add record
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={ClipboardList} title="Tender Records" />
              <DataTable columns={['No.', 'Type', 'Title', 'Owner', 'Status', 'Priority', 'Due', 'Amount', 'Actions']} rows={recordRows} />
            </section>

            <div className="grid-main">
              {selectedRecordTypes.map(([type, label]) => (
                <section key={type} className="panel">
                  <PanelTitle icon={ClipboardList} title={label} />
                  <DataTable
                    columns={['No.', 'Title', 'Owner', 'Status', 'Due', 'Amount']}
                    rows={selectedRecords
                      .filter((record) => record.record_type === type)
                      .map((record) => [
                        record.record_number,
                        record.title,
                        record.owner?.name || '',
                        <Badge key="status" value={record.status} />,
                        shortDate(record.due_at),
                        money(record.amount),
                      ])}
                  />
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-cell">No tender selected</div>
        )}
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={FileText} title="RFIs and Clarifications" />
          {selectedTender && (
            <form className="form-grid two section-form" onSubmit={createRfi}>
              <Field label="Category" name="category" value={rfiForm.category} onChange={setForm(setRfiForm)} />
              <Field label="Submitted To" name="submitted_to" value={rfiForm.submitted_to} onChange={setForm(setRfiForm)} />
              <Field label="Submitted At" type="datetime-local" name="submitted_at" value={rfiForm.submitted_at} onChange={setForm(setRfiForm)} />
              <Field label="Due At" type="datetime-local" name="due_at" value={rfiForm.due_at} onChange={setForm(setRfiForm)} />
              <Field label="Related Drawing" name="related_drawing" value={rfiForm.related_drawing} onChange={setForm(setRfiForm)} />
              <Field label="Related BOQ Item" name="related_boq_item" value={rfiForm.related_boq_item} onChange={setForm(setRfiForm)} />
              <Field label="Cost Impact" type="number" name="cost_impact" value={rfiForm.cost_impact} onChange={setForm(setRfiForm)} />
              <Field label="Schedule Impact Days" type="number" name="schedule_impact_days" value={rfiForm.schedule_impact_days} onChange={setForm(setRfiForm)} />
              <TextArea label="Question" name="question" value={rfiForm.question} onChange={setForm(setRfiForm)} required />
              <TextArea label="Internal Impact" name="internal_impact" value={rfiForm.internal_impact} onChange={setForm(setRfiForm)} />
              <button type="submit" className="primary-action">
                <Plus size={17} />
                Add RFI
              </button>
            </form>
          )}
          <DataTable
            columns={['No.', 'Tender', 'Category', 'Question', 'Status', 'Due', 'Cost Impact', 'Response']}
            rows={tenders.flatMap((tender) =>
              (tender.rfis || []).map((rfi) => [
                rfi.rfi_number || '',
                tender.tender_number,
                rfi.category || '',
                rfi.question,
                <Badge key="status" value={rfi.status} />,
                shortDate(rfi.due_at),
                money(rfi.cost_impact),
                rfi.response || '',
              ]),
            )}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={FileText} title="Tender Documents" />
          {selectedTender && (
            <form className="form-grid two section-form" onSubmit={uploadTenderDocument}>
              <Field label="Title" name="title" value={documentForm.title} onChange={setForm(setDocumentForm)} required />
              <Field label="Document Type" name="document_type" value={documentForm.document_type} onChange={setForm(setDocumentForm)} />
              <Field label="Version" name="version" value={documentForm.version} onChange={setForm(setDocumentForm)} />
              <Select label="Status" name="status" value={documentForm.status} onChange={setForm(setDocumentForm)}>
                {catalogOptions(catalog.record_statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Field label="Expires At" type="date" name="expires_at" value={documentForm.expires_at} onChange={setForm(setDocumentForm)} />
              <Field label="File" type="file" name="file" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
              <label className="access-option">
                <input type="checkbox" name="is_mandatory" checked={documentForm.is_mandatory} onChange={setBooleanDocumentField} />
                <span><strong>Mandatory</strong></span>
              </label>
              <label className="access-option">
                <input type="checkbox" name="is_confidential" checked={documentForm.is_confidential} onChange={setBooleanDocumentField} />
                <span><strong>Confidential</strong></span>
              </label>
              <TextArea label="Comments" name="comments" value={documentForm.comments} onChange={setForm(setDocumentForm)} />
              <button type="submit" className="primary-action">
                <Upload size={17} />
                Upload document
              </button>
            </form>
          )}
          <DataTable
            columns={['Tender', 'Title', 'Type', 'Version', 'Status', 'Mandatory', 'Confidential', 'Expiry']}
            rows={tenders.flatMap((tender) =>
              (tender.documents || []).map((document) => [
                tender.tender_number,
                document.title,
                document.document_type,
                document.version,
                <Badge key="status" value={document.status} />,
                document.is_mandatory ? 'Yes' : 'No',
                document.is_confidential ? 'Yes' : 'No',
                shortDate(document.expires_at),
              ]),
            )}
          />
        </section>
      </div>

      <div className="grid-main">
        <ChartPanel icon={BarChart3} title="Tenders by Status">
          {(analytics.status_counts || []).length === 0 ? (
            <div className="analytics-chart-empty">No tender status data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.status_counts || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2364d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel icon={WalletCards} title="Tender Value by Month">
          {(analytics.value_by_month || []).length === 0 ? (
            <div className="analytics-chart-empty">No tender value data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.value_by_month || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => compactFormatter.format(value)} />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="value" fill="#11835b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>

      <div className="grid-main">
        <section className="panel chart-panel">
          <PanelTitle icon={CheckCircle2} title="Wins Versus Losses" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={analytics.wins_losses || []} dataKey="value" nameKey="label" innerRadius={56} outerRadius={96} paddingAngle={3}>
                {(analytics.wins_losses || []).map((entry, index) => (
                  <Cell key={entry.label} fill={index === 0 ? '#11835b' : '#c3382f'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <PanelTitle icon={BarChart3} title="Tender Reports" />
          <DataTable
            columns={['Report', 'Records']}
            rows={Object.entries(reports).map(([key, rows]) => [
              labelize(key),
              Array.isArray(rows) ? rows.length : 0,
            ])}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Win/Loss Analysis" />
          <DataTable columns={['Loss Reason', 'Count']} rows={(analytics.loss_reasons || []).map((item) => [item.reason, item.count])} />
        </section>

        <section className="panel">
          <PanelTitle icon={Globe2} title="Tender Source Analysis" />
          <DataTable columns={['Source', 'Count']} rows={(analytics.source_analysis || []).map((item) => [item.source, item.count])} />
        </section>
      </div>
    </section>
  )
}

function EstimatingView({ sales, estimateForm, setEstimateForm, createEstimate, runAction }) {
  return (
    <section className="view-stack">
      <section className="panel">
        <PanelTitle icon={Calculator} title="New Estimate" />
        <form className="form-grid procurement-form" onSubmit={createEstimate}>
          <Select label="Tender" name="tender_id" value={estimateForm.tender_id} onChange={setForm(setEstimateForm)}>
            <option value="">Standalone</option>
            {(sales.tenders || []).map((tender) => (
              <option key={tender.id} value={tender.id}>
                {tender.tender_number} - {tender.title}
              </option>
            ))}
          </Select>
          <Field label="Title" name="title" value={estimateForm.title} onChange={setForm(setEstimateForm)} required />
          <Field label="Overhead %" type="number" name="overhead_percent" value={estimateForm.overhead_percent} onChange={setForm(setEstimateForm)} />
          <Field label="Profit %" type="number" name="profit_percent" value={estimateForm.profit_percent} onChange={setForm(setEstimateForm)} />
          <Field label="Tax %" type="number" name="tax_percent" value={estimateForm.tax_percent} onChange={setForm(setEstimateForm)} />
          <Field label="Cost Code" name="cost_code" value={estimateForm.cost_code} onChange={setForm(setEstimateForm)} placeholder="Auto-generated" />
          <Field label="Line description" name="description" value={estimateForm.description} onChange={setForm(setEstimateForm)} required />
          <Select label="Category" name="category" value={estimateForm.category} onChange={setForm(setEstimateForm)}>
            <option value="materials">Materials</option>
            <option value="labour">Labour</option>
            <option value="equipment">Equipment</option>
            <option value="subcontractor">Subcontractor</option>
          </Select>
          <Field label="Qty" type="number" name="quantity" value={estimateForm.quantity} onChange={setForm(setEstimateForm)} />
          <Field label="Unit" name="unit" value={estimateForm.unit} onChange={setForm(setEstimateForm)} />
          <Field label="Unit cost" type="number" name="unit_cost" value={estimateForm.unit_cost} onChange={setForm(setEstimateForm)} required />
          <button type="submit" className="primary-action">
            <Plus size={17} />
            Create
          </button>
        </form>
      </section>

      <section className="panel">
        <PanelTitle icon={Calculator} title="Estimates" />
        <DataTable
          columns={['No.', 'Title', 'Tender', 'Status', 'Subtotal', 'Total', 'Action']}
          rows={(sales.estimates || []).map((estimate) => [
            estimate.estimate_number,
            estimate.title,
            estimate.tender?.tender_number || '',
            <Badge key="status" value={estimate.status} />,
            money(estimate.subtotal),
            money(estimate.total_amount),
            estimate.status === 'draft' ? (
              <button key="approve" type="button" className="table-action" onClick={() => runAction(() => api.approveEstimate(estimate.id), 'Estimate approved.')}>
                Approve
              </button>
            ) : (
              ''
            ),
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={WalletCards} title="Pricing Library" />
        <DataTable
          columns={['Code', 'Description', 'Category', 'Unit', 'Unit cost', 'Source']}
          rows={(sales.pricing_items || []).map((item) => [
            item.cost_code || '',
            item.description,
            labelize(item.category),
            item.unit,
            money(item.unit_cost),
            item.source,
          ])}
        />
      </section>
    </section>
  )
}

function ProjectsView({
  branches,
  clients = emptyList,
  users = emptyList,
  projects,
  selectedProject,
  setSelectedProjectId,
  projectForm,
  setProjectForm,
  taskForm,
  setTaskForm,
  budgetForm,
  setBudgetForm,
  createProject,
  projectSubmitting,
  reportError,
  createTask,
  createBudgetLine,
  currentUser,
  runAction,
}) {
  const canAdminister = canAdministerRecords(currentUser)
  const [activeProjectSection, setActiveProjectSection] = useState('portfolio')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('overview')
  const [portfolioFilters, setPortfolioFilters] = useState({
    q: '',
    branch_id: '',
    client_id: '',
    project_manager: '',
    project_type: '',
    status: '',
    health_status: '',
    region: '',
    start_from: '',
    end_to: '',
    min_value: '',
    max_value: '',
  })
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingBudgetLineId, setEditingBudgetLineId] = useState(null)
  const [projectAdminForm, setProjectAdminForm] = useState(emptyProjectForm)

  const countryOptions = useMemo(
    () => Object.entries(africanCountryNames).map(([value, label]) => ({ value, label, meta: value })).sort((a, b) => a.label.localeCompare(b.label)),
    [],
  )
  const currencyOptions = useMemo(
    () => Object.entries(africanCurrencyNames).map(([value, label]) => ({ value, label, meta: value })).sort((a, b) => a.label.localeCompare(b.label)),
    [],
  )
  const projectStatusOptions = ['planning', 'active', 'on_hold', 'practical_completion', 'defects_liability', 'final_completion', 'completed', 'closed', 'cancelled']
  const healthOptions = ['on_track', 'at_risk', 'critical']
  const riskOptions = ['low', 'medium', 'high', 'critical']
  const priorityOptions = ['low', 'normal', 'high', 'urgent']
  const projectTypeOptions = uniqueValues(projects.map((project) => projectMeta(project).project_type)).filter(Boolean)
  const regionOptions = uniqueValues(projects.map((project) => projectMeta(project).region)).filter(Boolean)
  const managerOptions = uniqueValues([
    ...projects.map((project) => projectMeta(project).project_manager),
    ...users.map((user) => user.name),
  ]).filter(Boolean)
  const filteredProjects = useMemo(
    () => projects.filter((project) => projectMatchesFilters(project, portfolioFilters)),
    [portfolioFilters, projects],
  )
  const selectedMeta = projectMeta(selectedProject)
  const selectedTasks = selectedProject?.tasks || emptyList
  const selectedBudgetLines = selectedProject?.budget_lines || emptyList
  const selectedRequisitions = selectedProject?.purchase_requisitions || emptyList
  const selectedOrders = selectedProject?.purchase_orders || emptyList
  const selectedRfqs = selectedProject?.procurement_rfqs || emptyList
  const selectedReceipts = selectedProject?.goods_receipts || emptyList
  const selectedSupplierInvoices = selectedProject?.supplier_invoices || emptyList
  const selectedSupplierContracts = selectedProject?.supplier_contracts || emptyList
  const selectedDailyReports = selectedProject?.field_daily_reports || emptyList
  const selectedSiteIssues = selectedProject?.field_issues || emptyList
  const selectedInspections = selectedProject?.inspections || emptyList
  const selectedNcrs = selectedProject?.non_conformance_reports || emptyList
  const selectedIncidents = selectedProject?.safety_incidents || emptyList
  const selectedObservations = selectedProject?.safety_observations || emptyList
  const selectedToolboxTalks = selectedProject?.toolbox_talks || emptyList
  const selectedApprovals = selectedProject?.client_approvals || emptyList
  const selectedSubmittals = selectedProject?.consultant_submittals || emptyList
  const selectedPortalItems = selectedProject?.portal_work_items || emptyList
  const selectedDocuments = selectedProject?.documents || emptyList
  const selectedDrawings = selectedProject?.drawings || emptyList
  const selectedInvoices = selectedProject?.invoices || emptyList
  const selectedExpenses = selectedProject?.expenses || emptyList
  const selectedEquipmentAssignments = selectedProject?.equipment_assignments || emptyList
  const selectedEquipmentAssets = selectedProject?.equipment_assets || emptyList
  const selectedFuelLogs = selectedProject?.fuel_logs || emptyList
  const selectedAllocations = selectedProject?.workforce_allocations || emptyList
  const selectedAttendance = selectedProject?.attendance_records || emptyList
  const selectedTimesheets = selectedProject?.workforce_timesheets || emptyList
  const rfiItems = selectedPortalItems.filter((item) => String(item.item_type || '').toLowerCase().includes('rfi'))
  const submittalItems = [
    ...selectedSubmittals,
    ...selectedPortalItems.filter((item) => String(item.item_type || '').toLowerCase().includes('submittal')),
  ]
  const projectActivity = selectedProject ? buildProjectActivity(selectedProject) : []
  const projectSections = [
    ['portfolio', 'Portfolio Dashboard', FolderKanban],
    ['register', 'Project Register', ClipboardList],
    ['new', 'New Project', Plus],
    ['templates', 'Project Templates', Layers3],
    ['archived', 'Archived Projects', Archive],
    ['reports', 'Reports', BarChart3],
  ]
  const workspaceTabs = [
    ['overview', 'Overview', BarChart3],
    ['schedule', 'Schedule', CalendarDays],
    ['budget', 'Budget & Cost', WalletCards],
    ['commercial', 'Commercial', Calculator],
    ['procurement', 'Procurement', Truck],
    ['site', 'Site', MapPinned],
    ['workforce', 'Workforce', Users],
    ['equipment', 'Equipment', Truck],
    ['quality_hse', 'Quality & HSE', ShieldCheck],
    ['rfis', 'RFIs', ClipboardList],
    ['submittals', 'Submittals', Upload],
    ['meetings', 'Meetings', Users],
    ['risks_issues', 'Risks & Issues', AlertTriangle],
    ['documents', 'Documents', FileText],
    ['finance', 'Finance', WalletCards],
    ['client', 'Client', Handshake],
    ['activity', 'Activity', Clock3],
    ['closeout', 'Closeout', CheckCircle2],
    ['settings', 'Settings', Settings],
  ]

  useEffect(() => {
    if (!selectedProject) return

    setProjectAdminForm(projectFormFromProject(selectedProject))
  }, [selectedProject])

  function saveProjectAdministration(event) {
    event.preventDefault()
    if (!selectedProject) return
    const payload = projectRequestPayload(projectAdminForm)

    runAction(
      () => api.updateProject(selectedProject.id, payload),
      'Project updated.',
      { refreshProjectOnly: true },
    )
  }

  function archiveSelectedProject() {
    if (!selectedProject || !window.confirm(`Archive ${selectedProject.name}? This removes it from active project registers.`)) {
      return
    }

    runAction(() => api.deleteProject(selectedProject.id), 'Project archived.').then(() => {
      const nextProject = projects.find((project) => project.id !== selectedProject.id)
      setSelectedProjectId(nextProject?.id || null)
    })
  }

  function saveTask(event) {
    if (!editingTaskId) {
      createTask(event)
      return
    }

    event.preventDefault()
    if (!selectedProject) return

    runAction(
      () =>
        api.updateTask(selectedProject.id, editingTaskId, {
          ...taskForm,
          progress_percent: Number(taskForm.progress_percent || 0),
          due_date: taskForm.due_date || null,
        }),
      'Task updated.',
      { refreshProjectOnly: true },
    ).then(() => {
      setEditingTaskId(null)
      setTaskForm(emptyTaskForm)
    })
  }

  function editTask(task) {
    setEditingTaskId(task.id)
    setTaskForm({
      title: task.title || '',
      status: task.status || 'todo',
      priority: task.priority || 'normal',
      progress_percent: task.progress_percent ?? 0,
      due_date: dateInputValue(task.due_date),
    })
  }

  function cancelTaskEdit() {
    setEditingTaskId(null)
    setTaskForm(emptyTaskForm)
  }

  function archiveTask(task) {
    if (!selectedProject || !window.confirm(`Archive task "${task.title}"?`)) {
      return
    }

    runAction(() => api.deleteTask(selectedProject.id, task.id), 'Task archived.', { refreshProjectOnly: true }).then(() => {
      if (editingTaskId === task.id) {
        cancelTaskEdit()
      }
    })
  }

  function saveBudgetLine(event) {
    if (!editingBudgetLineId) {
      createBudgetLine(event)
      return
    }

    event.preventDefault()
    if (!selectedProject) return

    runAction(
      () =>
        api.updateBudgetLine(selectedProject.id, editingBudgetLineId, {
          ...budgetForm,
          budget_amount: Number(budgetForm.budget_amount || 0),
        }),
      'Budget line updated.',
      { refreshProjectOnly: true },
    ).then(() => {
      setEditingBudgetLineId(null)
      setBudgetForm(emptyBudgetForm)
    })
  }

  function editBudgetLine(line) {
    setEditingBudgetLineId(line.id)
    setBudgetForm({
      cost_code: line.cost_code || '',
      description: line.description || '',
      category: line.category || 'materials',
      budget_amount: line.budget_amount ?? '',
    })
  }

  function cancelBudgetLineEdit() {
    setEditingBudgetLineId(null)
    setBudgetForm(emptyBudgetForm)
  }

  function archiveBudgetLine(line) {
    if (!selectedProject || !window.confirm(`Archive budget line ${line.cost_code || line.description}?`)) {
      return
    }

    runAction(() => api.deleteBudgetLine(selectedProject.id, line.id), 'Budget line archived.', { refreshProjectOnly: true }).then(() => {
      if (editingBudgetLineId === line.id) {
        cancelBudgetLineEdit()
      }
    })
  }

  function setPortfolioFilter(event) {
    const { name, value } = event.target
    setPortfolioFilters((current) => ({ ...current, [name]: value }))
  }

  function clearPortfolioFilters() {
    setPortfolioFilters({
      q: '',
      branch_id: '',
      client_id: '',
      project_manager: '',
      project_type: '',
      status: '',
      health_status: '',
      region: '',
      start_from: '',
      end_to: '',
      min_value: '',
      max_value: '',
    })
  }

  function openProjectWorkspace(project) {
    setSelectedProjectId(project.id)
    setActiveProjectSection('workspace')
    setActiveWorkspaceTab('overview')
  }

  function projectFormFromProject(project) {
    const meta = projectMeta(project)

    return {
      ...emptyProjectForm,
      branch_id: project.branch_id || project.branch?.id || '',
      client_id: project.client_id || project.client?.id || '',
      client_name: project.client?.name || '',
      code: project.code || '',
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'planning',
      health_status: project.health_status || 'on_track',
      risk_level: project.risk_level || 'medium',
      contract_value: project.contract_value || '',
      currency: project.currency || 'GHS',
      progress_percent: project.progress_percent || 0,
      start_date: dateInputValue(project.start_date),
      target_end_date: dateInputValue(project.target_end_date),
      country: project.country || 'GH',
      site_address: project.site_address || '',
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, value ?? ''])),
    }
  }

  function renderPortfolioDashboard() {
    const activeProjects = projects.filter((project) => project.status === 'active')
    const atRiskProjects = projects.filter((project) => ['at_risk', 'critical'].includes(project.health_status) || ['high', 'critical'].includes(project.risk_level))
    const behindSchedule = projects.filter((project) => projectScheduleVarianceDays(project) < 0)
    const overBudget = projects.filter((project) => projectOverBudget(project))
    const contractValue = sumBy(projects, 'contract_value')
    const forecastRevenue = projects.reduce((total, project) => total + Number(projectMeta(project).revised_contract_value || project.contract_value || 0), 0)
    const openNcrs = projects.reduce((total, project) => total + Number(project.non_conformance_reports_count || 0), 0)
    const openRfis = projects.reduce((total, project) => total + Number(project.portal_work_items_count || 0), 0)
    const pendingApprovals = projects.reduce((total, project) => total + Number(project.client_approvals_count || 0) + Number(project.consultant_submittals_count || 0), 0)
    const outstandingReceivables = sumBy(selectedInvoices.filter((invoice) => ['sent', 'overdue', 'part_paid'].includes(invoice.payment_status || invoice.status)), 'balance_due')

    return (
      <section className="view-stack projects-portfolio">
        <div className="kpi-grid projects-kpis">
          <Kpi icon={FolderKanban} label="Active Projects" value={activeProjects.length} sub={`${projects.length} total in portfolio`} />
          <Kpi icon={AlertTriangle} label="Projects at Risk" value={atRiskProjects.length} sub={`${projects.filter((project) => project.health_status === 'critical').length} critical`} />
          <Kpi icon={Clock3} label="Behind Schedule" value={behindSchedule.length} sub="Past target date and not closed" />
          <Kpi icon={WalletCards} label="Over Budget" value={overBudget.length} sub="Actual or forecast above budget" />
          <Kpi icon={WalletCards} label="Contract Value" value={money(contractValue)} sub="Approved project contract value" />
          <Kpi icon={BarChart3} label="Forecast Revenue" value={money(forecastRevenue)} sub="Contract plus approved variations where set" />
          <Kpi icon={WalletCards} label="Outstanding Receivables" value={money(outstandingReceivables)} sub="Loaded from open project invoices" />
          <Kpi icon={ShieldCheck} label="Open NCRs" value={openNcrs} sub="Quality items across loaded register" />
          <Kpi icon={ClipboardList} label="Open RFIs" value={openRfis} sub="Portal work items marked as RFIs" />
          <Kpi icon={CheckCircle2} label="Pending Approvals" value={pendingApprovals} sub="Client approvals and submittals" />
        </div>

        {renderProjectFilters()}
        {renderProjectRegister(filteredProjects)}
      </section>
    )
  }

  function renderProjectFilters() {
    return (
      <section className="panel project-filter-panel">
        <PanelTitle icon={Eye} title="Portfolio Filters" />
        <div className="form-grid project-filter-grid">
          <Field label="Search" name="q" value={portfolioFilters.q} onChange={setPortfolioFilter} placeholder="Project, client, code, manager, region" />
          <Select label="Branch" name="branch_id" value={portfolioFilters.branch_id} onChange={setPortfolioFilter}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
          <Select label="Client" name="client_id" value={portfolioFilters.client_id} onChange={setPortfolioFilter}>
            <option value="">All clients</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </Select>
          <Select label="Project manager" name="project_manager" value={portfolioFilters.project_manager} onChange={setPortfolioFilter}>
            <option value="">All managers</option>
            {managerOptions.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
          </Select>
          <Select label="Project type" name="project_type" value={portfolioFilters.project_type} onChange={setPortfolioFilter}>
            <option value="">All types</option>
            {projectTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
          <Select label="Status" name="status" value={portfolioFilters.status} onChange={setPortfolioFilter}>
            <option value="">All statuses</option>
            {projectStatusOptions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
          </Select>
          <Select label="Health" name="health_status" value={portfolioFilters.health_status} onChange={setPortfolioFilter}>
            <option value="">All health</option>
            {healthOptions.map((health) => <option key={health} value={health}>{labelize(health)}</option>)}
          </Select>
          <Select label="Region" name="region" value={portfolioFilters.region} onChange={setPortfolioFilter}>
            <option value="">All regions</option>
            {regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}
          </Select>
          <Field label="Start from" type="date" name="start_from" value={portfolioFilters.start_from} onChange={setPortfolioFilter} />
          <Field label="Target before" type="date" name="end_to" value={portfolioFilters.end_to} onChange={setPortfolioFilter} />
          <Field label="Min value" type="number" name="min_value" value={portfolioFilters.min_value} onChange={setPortfolioFilter} />
          <Field label="Max value" type="number" name="max_value" value={portfolioFilters.max_value} onChange={setPortfolioFilter} />
          <button type="button" className="table-action project-filter-clear" onClick={clearPortfolioFilters}>Clear filters</button>
        </div>
      </section>
    )
  }

  function renderProjectRegister(rows = filteredProjects) {
    return (
      <section className="panel">
        <PanelTitle icon={FolderKanban} title="Project Register" />
        <DataTable
          columns={['Project', 'Client', 'Manager', 'Progress', 'Contract Value', 'Budget', 'Schedule', 'Health', 'Status', 'Action']}
          rows={rows.map((project) => [
            <div key="project" className="project-register-project">
              <ProjectVisual project={project} className="project-register-thumb" />
              <div className="project-register-name"><strong>{project.name}</strong><small>{project.code}</small></div>
            </div>,
            projectClientName(project),
            projectMeta(project).project_manager || '',
            <div key="progress" className="erp-table-progress"><span>{project.progress_percent || 0}%</span><DashboardProgress value={project.progress_percent || 0} /></div>,
            money(project.contract_value),
            money(project.budget_total),
            projectScheduleLabel(project),
            <Badge key="health" value={project.health_status} />,
            <Badge key="status" value={project.status} />,
            <button key="open" type="button" className="table-action" onClick={() => openProjectWorkspace(project)}>Open</button>,
          ])}
        />
      </section>
    )
  }

  function renderNewProject() {
    const formHandler = setForm(setProjectForm)

    return (
      <form className="project-create-form" onSubmit={createProject} autoComplete="off">
        <section className="panel">
          <PanelTitle icon={FolderKanban} title="Basic Information" />
          <div className="form-grid project-create-grid">
            <Field label="Project Number" name="code" value={projectForm.code} onChange={formHandler} placeholder="Auto-generated unless entered" />
            <Field label="Project Name" name="name" value={projectForm.name} onChange={formHandler} placeholder="Auto-generated unless entered" />
            <Select label="Client" name="client_id" value={projectForm.client_id} onChange={formHandler}>
              <option value="">Type client name instead</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
            <Field label="Client Name" name="client_name" value={projectForm.client_name} onChange={formHandler} placeholder="Creates client if not selected" />
            <Select label="Branch" name="branch_id" value={projectForm.branch_id} onChange={formHandler}>
              {!branches.length && <option value="">No branches available</option>}
              {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
            </Select>
            <Field label="Project Type" name="project_type" value={projectForm.project_type} onChange={formHandler} placeholder="Residential, commercial, infrastructure" />
            <Field label="Sector" name="sector" value={projectForm.sector} onChange={formHandler} />
            <Field label="Contract Type" name="contract_type" value={projectForm.contract_type} onChange={formHandler} />
            <Select label="Project Status" name="status" value={projectForm.status} onChange={formHandler}>{projectStatusOptions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</Select>
            <Select label="Priority" name="priority" value={projectForm.priority} onChange={formHandler}>{priorityOptions.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}</Select>
            <TextArea className="span-2" label="Description" name="description" value={projectForm.description} onChange={formHandler} />
            <ProjectImageUpload
              className="span-full"
              imageUrl={projectForm.future_image_preview}
              file={projectForm.future_image}
              onChange={setProjectFutureImage(setProjectForm, reportError)}
            />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={MapPinned} title="Location" />
          <div className="form-grid project-create-grid">
            <PickerField label="Country" name="country" value={projectForm.country} options={countryOptions} onChange={formHandler} searchPlaceholder="Search countries" />
            <Field label="Region" name="region" value={projectForm.region} onChange={formHandler} />
            <Field label="City" name="city" value={projectForm.city} onChange={formHandler} />
            <Field label="GPS Coordinates" name="gps_coordinates" value={projectForm.gps_coordinates} onChange={formHandler} placeholder="5.6037,-0.1870" />
            <Field className="span-2" label="Site Address" name="site_address" value={projectForm.site_address} onChange={formHandler} />
            <Field className="span-2" label="Site Map URL" name="site_map_url" value={projectForm.site_map_url} onChange={formHandler} />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={CalendarDays} title="Dates" />
          <div className="form-grid project-create-grid">
            <Field label="Contract Start Date" type="date" name="start_date" value={projectForm.start_date} onChange={formHandler} />
            <Field label="Planned Start Date" type="date" name="planned_start_date" value={projectForm.planned_start_date} onChange={formHandler} />
            <Field label="Actual Start Date" type="date" name="actual_start_date" value={projectForm.actual_start_date} onChange={formHandler} />
            <Field label="Target Completion Date" type="date" name="target_end_date" value={projectForm.target_end_date} onChange={formHandler} />
            <Field label="Contract Completion Date" type="date" name="contract_completion_date" value={projectForm.contract_completion_date} onChange={formHandler} />
            <Field label="Defects Liability End Date" type="date" name="defects_liability_end_date" value={projectForm.defects_liability_end_date} onChange={formHandler} />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Commercial Information" />
          <div className="form-grid project-create-grid">
            <Field label="Original Contract Value" type="number" name="contract_value" value={projectForm.contract_value} onChange={formHandler} />
            <PickerField label="Currency" name="currency" value={projectForm.currency} options={currencyOptions} onChange={formHandler} searchPlaceholder="Search currencies" />
            <Field label="Approved Variations" type="number" name="approved_variations" value={projectForm.approved_variations} onChange={formHandler} />
            <Field label="Revised Contract Value" type="number" name="revised_contract_value" value={projectForm.revised_contract_value} onChange={formHandler} />
            <Field label="Retention %" type="number" min="0" max="100" name="retention_percent" value={projectForm.retention_percent} onChange={formHandler} />
            <Field label="Advance Payment" type="number" name="advance_payment" value={projectForm.advance_payment} onChange={formHandler} />
            <TextArea label="Payment Terms" name="payment_terms" value={projectForm.payment_terms} onChange={formHandler} />
            <TextArea label="Tax Configuration" name="tax_configuration" value={projectForm.tax_configuration} onChange={formHandler} />
            <Field className="span-2" label="Funding Source" name="funding_source" value={projectForm.funding_source} onChange={formHandler} />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Users} title="Project Team" />
          <div className="form-grid project-create-grid">
            {[
              ['project_director', 'Project Director'],
              ['project_manager', 'Project Manager'],
              ['site_manager', 'Site Manager'],
              ['quantity_surveyor', 'Quantity Surveyor'],
              ['project_engineer', 'Project Engineer'],
              ['hse_manager', 'HSE Manager'],
              ['qa_qc_manager', 'QA/QC Manager'],
              ['planner', 'Planner'],
              ['commercial_manager', 'Commercial Manager'],
            ].map(([name, label]) => <Field key={name} label={label} name={name} value={projectForm[name]} onChange={formHandler} list="project-user-list" />)}
            <datalist id="project-user-list">
              {users.map((user) => <option key={user.id} value={user.name} />)}
            </datalist>
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Settings} title="Project Setup" />
          <div className="form-grid project-create-grid">
            <Field label="Cost Code Structure" name="cost_code_structure" value={projectForm.cost_code_structure} onChange={formHandler} />
            <Field label="WBS Template" name="wbs_template" value={projectForm.wbs_template} onChange={formHandler} />
            <Field label="Budget Template" name="budget_template" value={projectForm.budget_template} onChange={formHandler} />
            <Field label="Approval Workflow" name="approval_workflow" value={projectForm.approval_workflow} onChange={formHandler} />
            <Field label="Working Calendar" name="working_calendar" value={projectForm.working_calendar} onChange={formHandler} />
            <Field label="Default Warehouse" name="default_warehouse" value={projectForm.default_warehouse} onChange={formHandler} />
            <TextArea className="span-2" label="Default Document Folders" name="default_document_folders" value={projectForm.default_document_folders} onChange={formHandler} placeholder="01 Contract, 02 Drawings, 03 Specifications..." />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={Handshake} title="Linked Source" />
          <div className="form-grid project-create-grid">
            <Field label="Linked CRM Opportunity" name="linked_crm_opportunity" value={projectForm.linked_crm_opportunity} onChange={formHandler} />
            <Field label="Linked Tender" name="linked_tender" value={projectForm.linked_tender} onChange={formHandler} />
            <Field label="Linked Estimate" name="linked_estimate" value={projectForm.linked_estimate} onChange={formHandler} />
            <Field label="Linked Contract" name="linked_contract" value={projectForm.linked_contract} onChange={formHandler} />
          </div>
        </section>

        <div className="row-actions project-create-actions">
          {!branches.length && <small>A Head Office branch will be created automatically.</small>}
          <button type="submit" className="primary-action" disabled={projectSubmitting}>
            <Plus size={17} />{projectSubmitting ? 'Creating project…' : 'Create project'}
          </button>
        </div>
      </form>
    )
  }

  function renderProjectWorkspace() {
    if (!selectedProject) {
      return <section className="panel"><PanelTitle icon={FolderKanban} title="No Project Selected" /></section>
    }

    const budget = Number(selectedProject.budget_total || 0)
    const actual = Number(selectedProject.actual_cost || 0)
    const committed = Number(selectedProject.committed_total || 0)
    const forecastToComplete = Number(selectedProject.forecast_to_complete || 0)
    const forecastFinalCost = actual + forecastToComplete
    const revisedContract = Number(selectedMeta.revised_contract_value || selectedProject.contract_value || 0)
    const grossMargin = revisedContract - forecastFinalCost

    return (
      <section className="project-workspace project-command-centre">
        <header className="project-head enriched-project-head">
          <ProjectVisual project={selectedProject} className="project-head-visual" />
          <div className="project-head-copy">
            <p>{selectedProject.code} | {projectClientName(selectedProject)} | {selectedMeta.region || selectedProject.country}</p>
            <h2>{selectedProject.name}</h2>
            <small>{selectedMeta.project_type || 'Project'} | {selectedMeta.contract_type || 'Contract type not set'} | {selectedMeta.project_manager || 'No project manager set'}</small>
          </div>
          <div className="project-metrics">
            <Metric label="Progress" value={`${selectedProject.progress_percent || 0}%`} />
            <Metric label="Contract" value={money(selectedProject.contract_value)} />
            <Metric label="Budget" value={money(budget)} />
            <Metric label="Forecast Final Cost" value={money(forecastFinalCost)} />
          </div>
        </header>

        <nav className="module-tabs project-workspace-tabs" aria-label="Project workspace">
          {workspaceTabs.map(([key, label, Icon]) => (
            <button key={key} type="button" className={activeWorkspaceTab === key ? 'active' : ''} onClick={() => setActiveWorkspaceTab(key)}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {activeWorkspaceTab === 'overview' && (
          <>
            <div className="kpi-grid projects-kpis">
              <Kpi icon={BarChart3} label="Overall Progress" value={`${selectedProject.progress_percent || 0}%`} sub={`Planned progress ${plannedProgress(selectedProject)}%`} />
              <Kpi icon={Clock3} label="Schedule Variance" value={projectScheduleLabel(selectedProject)} sub={`Target ${shortDate(selectedProject.target_end_date) || 'not set'}`} />
              <Kpi icon={WalletCards} label="Cost Performance" value={budget > 0 ? `${Math.round((actual / budget) * 100)}%` : 'N/A'} sub={`${money(actual)} actual cost`} />
              <Kpi icon={WalletCards} label="Gross Margin" value={money(grossMargin)} sub={`${money(revisedContract)} revised contract`} />
              <Kpi icon={WalletCards} label="Committed Cost" value={money(committed)} sub={`${money(budget - committed - actual)} remaining budget`} />
              <Kpi icon={WalletCards} label="Cash Position" value={money(projectCashPosition(selectedProject))} sub="Paid client invoices less paid supplier costs" />
              <Kpi icon={AlertTriangle} label="Open Risks" value={['high', 'critical'].includes(selectedProject.risk_level) ? 1 : 0} sub={`Risk level ${labelize(selectedProject.risk_level)}`} />
              <Kpi icon={ShieldCheck} label="Open NCRs" value={selectedNcrs.filter((item) => !['closed', 'verified'].includes(item.status)).length} sub={`${selectedInspections.length} inspections`} />
            </div>
            <section className="panel">
              <PanelTitle icon={ShieldCheck} title="Overall Project Health" />
              <div className="project-health-grid">
                {projectHealthRows(selectedProject).map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <Badge value={item.tone} />
                  </article>
                ))}
              </div>
            </section>
            <div className="grid-main">
              <section className="panel">
                <PanelTitle icon={ClipboardList} title="Command Centre" />
                <DataTable columns={['Signal', 'Value', 'Action']} rows={[
                  ['Outstanding client decisions', selectedApprovals.filter((item) => ['submitted', 'pending', 'in_review'].includes(item.status)).length, 'Review client approval queue.'],
                  ['Open site issues', selectedSiteIssues.filter((item) => !['resolved', 'closed'].includes(item.status)).length, 'Assign owners from Site Management.'],
                  ['Late activities', selectedTasks.filter((task) => taskIsLate(task)).length, 'Update look-ahead or recovery plan.'],
                  ['Long-lead purchase orders', selectedOrders.filter((order) => daysUntil(order.expected_delivery_date) > 45).length, 'Track procurement expediting.'],
                  ['Open safety items', selectedIncidents.filter((item) => !['closed'].includes(item.status)).length + selectedObservations.filter((item) => !['closed'].includes(item.status)).length, 'Review HSE corrective actions.'],
                ]} />
              </section>
              <section className="panel">
                <PanelTitle icon={Clock3} title="Latest Activity" />
                <div className="project-activity-list compact">
                  {projectActivity.slice(0, 8).map((item) => <ProjectActivityItem key={`${item.title}-${item.at}-${item.detail}`} item={item} />)}
                  {!projectActivity.length && <div className="empty-cell">No project activity yet.</div>}
                </div>
              </section>
            </div>
          </>
        )}

        {activeWorkspaceTab === 'schedule' && renderScheduleTab()}
        {activeWorkspaceTab === 'budget' && renderBudgetTab()}
        {activeWorkspaceTab === 'commercial' && renderCommercialTab()}
        {activeWorkspaceTab === 'procurement' && renderProcurementTab()}
        {activeWorkspaceTab === 'site' && renderSiteTab()}
        {activeWorkspaceTab === 'workforce' && renderWorkforceTab()}
        {activeWorkspaceTab === 'equipment' && renderEquipmentTab()}
        {activeWorkspaceTab === 'quality_hse' && renderQualityHseTab()}
        {activeWorkspaceTab === 'rfis' && renderRfiTab()}
        {activeWorkspaceTab === 'submittals' && renderSubmittalTab()}
        {activeWorkspaceTab === 'meetings' && <section className="panel"><PanelTitle icon={Users} title="Meetings" /><div className="empty-cell">No meeting records have been created for this project yet.</div></section>}
        {activeWorkspaceTab === 'risks_issues' && renderRisksIssuesTab()}
        {activeWorkspaceTab === 'documents' && renderDocumentsTab()}
        {activeWorkspaceTab === 'finance' && renderFinanceTab()}
        {activeWorkspaceTab === 'client' && renderClientTab()}
        {activeWorkspaceTab === 'activity' && renderActivityTab()}
        {activeWorkspaceTab === 'closeout' && renderCloseoutTab()}
        {activeWorkspaceTab === 'settings' && renderSettingsTab()}
      </section>
    )
  }

  function renderScheduleTab() {
    const lookaheadTasks = selectedTasks.filter((task) => daysUntil(task.due_date) >= 0 && daysUntil(task.due_date) <= 42)

    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={CalendarDays} title={editingTaskId ? 'Edit Activity' : 'WBS / Activities'} />
          <form className="inline-form project-inline-form" onSubmit={saveTask}>
            <Field label="Activity" name="title" value={taskForm.title} onChange={setForm(setTaskForm)} required />
            <Select label="Status" name="status" value={taskForm.status} onChange={setForm(setTaskForm)}>
              <option value="todo">Todo</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </Select>
            <Select label="Priority" name="priority" value={taskForm.priority} onChange={setForm(setTaskForm)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Field label="Progress %" type="number" min="0" max="100" name="progress_percent" value={taskForm.progress_percent} onChange={setForm(setTaskForm)} />
            <Field label="Due" type="date" name="due_date" value={taskForm.due_date} onChange={setForm(setTaskForm)} />
            <button type="submit" className="icon-button solid" title={editingTaskId ? 'Save activity' : 'Add activity'}>{editingTaskId ? <CheckCircle2 size={17} /> : <Plus size={17} />}</button>
            {editingTaskId && <button type="button" className="table-action" onClick={cancelTaskEdit}>Cancel</button>}
          </form>
          <DataTable
            columns={['Activity', 'Status', 'Priority', 'Progress', 'Due', 'Actions']}
            rows={selectedTasks.map((task) => [
              task.title,
              <Badge key="status" value={task.status} />,
              <Badge key="priority" value={task.priority} />,
              <div key="progress" className="erp-table-progress"><span>{task.progress_percent || 0}%</span><DashboardProgress value={task.progress_percent || 0} /></div>,
              shortDate(task.due_date),
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editTask(task)}>Edit</button>
                {task.status !== 'done' && <button type="button" className="table-action" onClick={() => runAction(() => api.updateTask(selectedProject.id, task.id, { status: 'done' }), 'Activity completed.', { refreshProjectOnly: true })}>Done</button>}
                <button type="button" className="table-action danger" onClick={() => archiveTask(task)}>Archive</button>
              </div>,
            ])}
          />
        </section>
        <section className="panel">
          <PanelTitle icon={Workflow} title="Gantt / Look-Ahead" />
          <div className="project-gantt-list">
            {selectedTasks.map((task) => (
              <article key={task.id}>
                <div><strong>{task.title}</strong><span>{shortDate(task.due_date) || 'No due date'}</span></div>
                <DashboardProgress value={task.progress_percent || 0} tone={taskIsLate(task) ? 'red' : 'blue'} />
              </article>
            ))}
            {!selectedTasks.length && <div className="empty-cell">No schedule activities yet.</div>}
          </div>
          <DataTable columns={['Look-ahead', 'Activity', 'Due', 'Status']} rows={lookaheadTasks.map((task) => [`${Math.max(0, daysUntil(task.due_date))} days`, task.title, shortDate(task.due_date), <Badge key="status" value={task.status} />])} />
        </section>
      </div>
    )
  }

  function renderBudgetTab() {
    const budget = sumBy(selectedBudgetLines, 'budget_amount')
    const committed = sumBy(selectedBudgetLines, 'committed_amount')
    const actual = sumBy(selectedBudgetLines, 'actual_amount')
    const forecast = sumBy(selectedBudgetLines, 'forecast_amount')

    return (
      <section className="panel">
        <PanelTitle icon={WalletCards} title="Budget & Cost Control" />
        <div className="project-cost-equation">
          <Metric label="Original Budget" value={money(budget)} />
          <Metric label="Approved Changes" value={money(Number(selectedMeta.approved_variations || 0))} />
          <Metric label="Revised Budget" value={money(budget + Number(selectedMeta.approved_variations || 0))} />
          <Metric label="Remaining Budget" value={money(budget - committed - actual)} />
          <Metric label="Forecast Cost" value={money(forecast || Number(selectedProject.forecast_to_complete || 0))} />
        </div>
        <form className="inline-form project-inline-form" onSubmit={saveBudgetLine}>
          <Field label="Cost Code" name="cost_code" value={budgetForm.cost_code} onChange={setForm(setBudgetForm)} placeholder="Auto-generated" />
          <Field label="Description" name="description" value={budgetForm.description} onChange={setForm(setBudgetForm)} required />
          <Select label="Category" name="category" value={budgetForm.category} onChange={setForm(setBudgetForm)}>
            <option value="materials">Materials</option>
            <option value="labour">Labour</option>
            <option value="equipment">Equipment</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="overheads">Overheads</option>
            <option value="procurement">Procurement</option>
            <option value="other">Other</option>
          </Select>
          <Field label="Budget" type="number" name="budget_amount" value={budgetForm.budget_amount} onChange={setForm(setBudgetForm)} required />
          <button type="submit" className="icon-button solid" title={editingBudgetLineId ? 'Save budget line' : 'Add budget line'}>{editingBudgetLineId ? <CheckCircle2 size={17} /> : <Plus size={17} />}</button>
          {editingBudgetLineId && <button type="button" className="table-action" onClick={cancelBudgetLineEdit}>Cancel</button>}
        </form>
        <DataTable
          columns={['Cost Code', 'Description', 'Category', 'Budget', 'Committed', 'Actual', 'Forecast', 'Variance', 'Actions']}
          rows={selectedBudgetLines.map((line) => [
            line.cost_code,
            line.description,
            labelize(line.category),
            money(line.budget_amount),
            money(line.committed_amount),
            money(line.actual_amount),
            money(line.forecast_amount),
            money(Number(line.budget_amount || 0) - Number(line.committed_amount || 0) - Number(line.actual_amount || 0)),
            <div key="actions" className="row-actions"><button type="button" className="table-action" onClick={() => editBudgetLine(line)}>Edit</button><button type="button" className="table-action danger" onClick={() => archiveBudgetLine(line)}>Archive</button></div>,
          ])}
        />
      </section>
    )
  }

  function renderCommercialTab() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Calculator} title="Main Contract" />
          <DataTable columns={['Item', 'Value']} rows={[
            ['Original Contract Value', money(selectedProject.contract_value)],
            ['Approved Variations', money(selectedMeta.approved_variations || 0)],
            ['Revised Contract Value', money(selectedMeta.revised_contract_value || selectedProject.contract_value)],
            ['Retention', `${selectedMeta.retention_percent || 0}%`],
            ['Advance Payment', money(selectedMeta.advance_payment || 0)],
            ['Payment Terms', selectedMeta.payment_terms || 'Not set'],
            ['Funding Source', selectedMeta.funding_source || 'Not set'],
            ['Tax Configuration', selectedMeta.tax_configuration || 'Not set'],
          ]} />
        </section>
        <section className="panel">
          <PanelTitle icon={FileText} title="Contracts & Notices" />
          <DataTable columns={['Contract', 'Supplier', 'Status', 'Value', 'Dates']} rows={selectedSupplierContracts.map((contract) => [contract.contract_number || contract.title, contract.supplier?.name || '', <Badge key="status" value={contract.status} />, money(contract.contract_value), `${shortDate(contract.start_date)} - ${shortDate(contract.end_date)}`])} />
        </section>
      </div>
    )
  }

  function renderProcurementTab() {
    return (
      <section className="panel">
        <PanelTitle icon={Truck} title="Project Procurement" />
        <div className="project-cost-equation">
          <Metric label="Material Requests" value={selectedRequisitions.length} />
          <Metric label="RFQs" value={selectedRfqs.length} />
          <Metric label="Purchase Orders" value={selectedOrders.length} />
          <Metric label="GRNs" value={selectedReceipts.length} />
          <Metric label="Supplier Invoices" value={selectedSupplierInvoices.length} />
        </div>
        <DataTable columns={['PO', 'Supplier', 'Status', 'Delivery', 'Payment', 'Total']} rows={selectedOrders.map((order) => [order.po_number, order.supplier?.name || '', <Badge key="status" value={order.status} />, shortDate(order.expected_delivery_date), <Badge key="payment" value={order.payment_status} />, money(order.total_amount)])} />
      </section>
    )
  }

  function renderSiteTab() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={MapPinned} title="Daily Site Reports" />
          <DataTable columns={['Report', 'Date', 'Weather', 'Labour', 'Status']} rows={selectedDailyReports.map((report) => [report.report_number, shortDate(report.report_date), report.weather || '', report.labour_count || 0, <Badge key="status" value={report.status} />])} />
        </section>
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Site Issues" />
          <DataTable columns={['Issue', 'Priority', 'Status', 'Due', 'Assigned']} rows={selectedSiteIssues.map((issue) => [issue.title, <Badge key="priority" value={issue.priority} />, <Badge key="status" value={issue.status} />, shortDate(issue.due_date), issue.assigned_to || ''])} />
        </section>
      </div>
    )
  }

  function renderWorkforceTab() {
    return (
      <section className="panel">
        <PanelTitle icon={Users} title="Project Workforce" />
        <div className="project-cost-equation">
          <Metric label="Assigned Employees" value={selectedAllocations.length} />
          <Metric label="Attendance Records" value={selectedAttendance.length} />
          <Metric label="Timesheets" value={selectedTimesheets.length} />
          <Metric label="Labour Cost" value={money(sumBy(selectedTimesheets, 'cost_amount'))} />
        </div>
        <DataTable columns={['Employee', 'Role', 'Supervisor', 'Allocation', 'Dates', 'Status']} rows={selectedAllocations.map((allocation) => [allocation.employee_profile?.user?.name || '', allocation.role, allocation.supervisor?.name || '', `${allocation.allocation_percent}%`, `${shortDate(allocation.start_date)} - ${shortDate(allocation.end_date)}`, <Badge key="status" value={allocation.status} />])} />
      </section>
    )
  }

  function renderEquipmentTab() {
    return (
      <section className="panel">
        <PanelTitle icon={Truck} title="Project Equipment" />
        <div className="project-cost-equation">
          <Metric label="Assigned Assets" value={selectedEquipmentAssets.length || selectedEquipmentAssignments.length} />
          <Metric label="Fuel Cost" value={money(sumBy(selectedFuelLogs, 'total_cost'))} />
          <Metric label="Maintenance Due" value={selectedEquipmentAssets.filter((asset) => asset.next_service_due_on).length} />
          <Metric label="Active Assignments" value={selectedEquipmentAssignments.filter((assignment) => assignment.status === 'active').length} />
        </div>
        <DataTable columns={['Asset', 'Category', 'Status', 'Meter', 'Rate', 'Service Due']} rows={selectedEquipmentAssets.map((asset) => [asset.name, labelize(asset.category), <Badge key="status" value={asset.status} />, asset.meter_reading || '', money(asset.hourly_rate), shortDate(asset.next_service_due_on)])} />
      </section>
    )
  }

  function renderQualityHseTab() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Quality" />
          <DataTable columns={['Record', 'Type', 'Area', 'Score', 'Status']} rows={selectedInspections.map((inspection) => [inspection.inspection_number, labelize(inspection.type), inspection.area, inspection.score || '', <Badge key="status" value={inspection.status} />])} />
          <DataTable columns={['NCR', 'Title', 'Severity', 'Due', 'Status']} rows={selectedNcrs.map((ncr) => [ncr.ncr_number, ncr.title, <Badge key="severity" value={ncr.severity} />, shortDate(ncr.due_date), <Badge key="status" value={ncr.status} />])} />
        </section>
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="HSE" />
          <DataTable columns={['Incident', 'Severity', 'Location', 'Occurred', 'Status']} rows={selectedIncidents.map((incident) => [incident.incident_number, <Badge key="severity" value={incident.severity} />, incident.location || '', shortDate(incident.occurred_at), <Badge key="status" value={incident.status} />])} />
          <DataTable columns={['Observation', 'Severity', 'Location', 'Observed', 'Status']} rows={selectedObservations.map((observation) => [observation.observation_number, <Badge key="severity" value={observation.severity} />, observation.location || '', shortDate(observation.observed_at), <Badge key="status" value={observation.status} />])} />
          <DataTable columns={['Toolbox Talk', 'Topic', 'Date', 'Attendees', 'Status']} rows={selectedToolboxTalks.map((talk) => [talk.talk_number, talk.topic, shortDate(talk.talk_date), talk.attendee_count || 0, <Badge key="status" value={talk.status} />])} />
        </section>
      </div>
    )
  }

  function renderRfiTab() {
    return <section className="panel"><PanelTitle icon={ClipboardList} title="RFIs" /><DataTable columns={['RFI', 'Title', 'Priority', 'Due', 'Status']} rows={rfiItems.map((item) => [item.item_number, item.title, <Badge key="priority" value={item.priority} />, shortDate(item.due_date), <Badge key="status" value={item.status} />])} /></section>
  }

  function renderSubmittalTab() {
    return <section className="panel"><PanelTitle icon={Upload} title="Submittals" /><DataTable columns={['Submittal', 'Title', 'Discipline', 'Due', 'Status']} rows={submittalItems.map((item) => [item.submittal_number || item.item_number, item.title, item.discipline || item.item_type || '', shortDate(item.due_date), <Badge key="status" value={item.status} />])} /></section>
  }

  function renderRisksIssuesTab() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Risks" />
          <DataTable columns={['Risk', 'Impact', 'Owner', 'Mitigation']} rows={[
            ['Overall risk level', labelize(selectedProject.risk_level), selectedMeta.project_manager || '', selectedProject.risk_level === 'low' ? 'Monitor through normal controls.' : 'Review mitigation and recovery actions.'],
          ]} />
        </section>
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Issues" />
          <DataTable columns={['Issue', 'Priority', 'Status', 'Due']} rows={selectedSiteIssues.map((issue) => [issue.title, <Badge key="priority" value={issue.priority} />, <Badge key="status" value={issue.status} />, shortDate(issue.due_date)])} />
        </section>
      </div>
    )
  }

  function renderDocumentsTab() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={FileText} title="Documents" />
          <DataTable columns={['Document', 'Type', 'Status', 'Uploaded']} rows={selectedDocuments.map((document) => [document.document_number || document.title, labelize(document.document_type), <Badge key="status" value={document.status} />, shortDate(document.created_at)])} />
        </section>
        <section className="panel">
          <PanelTitle icon={FileText} title="Drawings" />
          <DataTable columns={['Drawing', 'Title', 'Status', 'Revisions']} rows={selectedDrawings.map((drawing) => [drawing.drawing_number, drawing.title, <Badge key="status" value={drawing.status} />, (drawing.revisions || []).length])} />
        </section>
      </div>
    )
  }

  function renderFinanceTab() {
    return (
      <section className="panel">
        <PanelTitle icon={WalletCards} title="Project Finance" />
        <div className="project-cost-equation">
          <Metric label="Invoiced" value={money(sumBy(selectedInvoices, 'total_amount'))} />
          <Metric label="Paid" value={money(sumBy(selectedInvoices, 'amount_paid'))} />
          <Metric label="Outstanding" value={money(sumBy(selectedInvoices, 'balance_due'))} />
          <Metric label="Expenses" value={money(sumBy(selectedExpenses, 'amount'))} />
        </div>
        <DataTable columns={['Invoice', 'Title', 'Status', 'Due', 'Total', 'Paid', 'Balance']} rows={selectedInvoices.map((invoice) => [invoice.invoice_number, invoice.title, <Badge key="status" value={invoice.status} />, shortDate(invoice.due_date), money(invoice.total_amount), money(invoice.amount_paid), money(invoice.balance_due)])} />
      </section>
    )
  }

  function renderClientTab() {
    return (
      <section className="panel">
        <PanelTitle icon={Handshake} title="Client Controls" />
        <DataTable columns={['Approval', 'Title', 'Due', 'Status', 'Decision']} rows={selectedApprovals.map((approval) => [approval.approval_number, approval.title, shortDate(approval.due_date), <Badge key="status" value={approval.status} />, approval.decision_notes || ''])} />
      </section>
    )
  }

  function renderActivityTab() {
    return (
      <section className="panel">
        <PanelTitle icon={Clock3} title="Project Activity Timeline" />
        <div className="project-activity-list">
          {projectActivity.map((item) => <ProjectActivityItem key={`${item.title}-${item.at}-${item.detail}`} item={item} />)}
          {!projectActivity.length && <div className="empty-cell">No project activity yet.</div>}
        </div>
      </section>
    )
  }

  function renderCloseoutTab() {
    const closeoutRows = [
      ['Practical Completion', selectedProject.status === 'practical_completion' || closeoutReached(selectedProject.status, 'practical_completion')],
      ['Snag List', selectedSiteIssues.filter((issue) => String(issue.title || '').toLowerCase().includes('snag')).length > 0],
      ['Punch List', selectedSiteIssues.filter((issue) => String(issue.title || '').toLowerCase().includes('punch')).length > 0],
      ['As-Built Drawings', selectedDrawings.some((drawing) => String(drawing.title || '').toLowerCase().includes('as-built'))],
      ['O&M Manuals', selectedDocuments.some((document) => String(document.title || '').toLowerCase().includes('manual'))],
      ['Final Account', selectedProject.status === 'final_completion' || closeoutReached(selectedProject.status, 'final_completion')],
      ['Defects Liability Period', selectedProject.status === 'defects_liability' || Boolean(selectedMeta.defects_liability_end_date)],
      ['Closed / Archived', ['closed', 'cancelled'].includes(selectedProject.status)],
    ]

    return <section className="panel"><PanelTitle icon={CheckCircle2} title="Project Closeout" /><DataTable columns={['Closeout Item', 'Status']} rows={closeoutRows.map(([item, done]) => [item, <Badge key={item} value={done ? 'complete' : 'pending'} />])} /></section>
  }

  function renderSettingsTab() {
    const formHandler = setForm(setProjectAdminForm)

    return (
      <section className="panel">
        <PanelTitle icon={Settings} title="Project Administration" />
        {canAdminister ? (
          <form className="form-grid project-create-grid" onSubmit={saveProjectAdministration}>
            <Field label="Project Number" name="code" value={projectAdminForm.code} onChange={formHandler} />
            <Field label="Project Name" name="name" value={projectAdminForm.name} onChange={formHandler} required />
            <Select label="Client" name="client_id" value={projectAdminForm.client_id} onChange={formHandler}><option value="">No client selected</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select>
            <Field label="Project Type" name="project_type" value={projectAdminForm.project_type} onChange={formHandler} />
            <Select label="Status" name="status" value={projectAdminForm.status} onChange={formHandler}>{projectStatusOptions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</Select>
            <Select label="Health" name="health_status" value={projectAdminForm.health_status} onChange={formHandler}>{healthOptions.map((health) => <option key={health} value={health}>{labelize(health)}</option>)}</Select>
            <Select label="Risk" name="risk_level" value={projectAdminForm.risk_level} onChange={formHandler}>{riskOptions.map((risk) => <option key={risk} value={risk}>{labelize(risk)}</option>)}</Select>
            <Field label="Progress %" type="number" min="0" max="100" name="progress_percent" value={projectAdminForm.progress_percent} onChange={formHandler} />
            <Field label="Contract Value" type="number" name="contract_value" value={projectAdminForm.contract_value} onChange={formHandler} />
            <Field label="Approved Variations" type="number" name="approved_variations" value={projectAdminForm.approved_variations} onChange={formHandler} />
            <Field label="Revised Contract Value" type="number" name="revised_contract_value" value={projectAdminForm.revised_contract_value} onChange={formHandler} />
            <PickerField label="Currency" name="currency" value={projectAdminForm.currency} options={currencyOptions} onChange={formHandler} searchPlaceholder="Search currencies" />
            <Field label="Start" type="date" name="start_date" value={projectAdminForm.start_date} onChange={formHandler} />
            <Field label="Target End" type="date" name="target_end_date" value={projectAdminForm.target_end_date} onChange={formHandler} />
            <Field label="Project Manager" name="project_manager" value={projectAdminForm.project_manager} onChange={formHandler} list="project-user-list" />
            <Field label="Site Manager" name="site_manager" value={projectAdminForm.site_manager} onChange={formHandler} list="project-user-list" />
            <Field className="span-2" label="Site Address" name="site_address" value={projectAdminForm.site_address} onChange={formHandler} />
            <TextArea className="span-2" label="Description" name="description" value={projectAdminForm.description} onChange={formHandler} />
            <ProjectImageUpload
              className="span-full"
              label="Replace Future Project Image"
              imageUrl={projectAdminForm.future_image_preview || projectFutureImageUrl(selectedProject)}
              file={projectAdminForm.future_image}
              onChange={setProjectFutureImage(setProjectAdminForm)}
            />
            <div className="row-actions span-2">
              <button type="submit" className="primary-action"><CheckCircle2 size={17} />Save project</button>
              <button type="button" className="table-action danger" onClick={archiveSelectedProject}>Archive project</button>
            </div>
          </form>
        ) : (
          <DataTable columns={['Setting', 'Value']} rows={Object.entries(selectedMeta).map(([key, value]) => [labelize(key), String(value ?? '')])} />
        )}
      </section>
    )
  }

  return (
    <section className="view-stack projects-module">
      <nav className="module-tabs" aria-label="Projects module">
        {projectSections.map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeProjectSection === key ? 'active' : ''} onClick={() => setActiveProjectSection(key)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
        {selectedProject && (
          <button type="button" className={activeProjectSection === 'workspace' ? 'active' : ''} onClick={() => setActiveProjectSection('workspace')}>
            <FolderKanban size={15} />
            Project Workspace
          </button>
        )}
      </nav>

      {activeProjectSection === 'portfolio' && renderPortfolioDashboard()}
      {activeProjectSection === 'register' && <>{renderProjectFilters()}{renderProjectRegister(filteredProjects)}</>}
      {activeProjectSection === 'new' && renderNewProject()}
      {activeProjectSection === 'templates' && <section className="panel"><PanelTitle icon={Layers3} title="Project Templates" /><div className="empty-cell">No project templates configured yet.</div></section>}
      {activeProjectSection === 'archived' && <section className="panel"><PanelTitle icon={Archive} title="Archived Projects" /><DataTable columns={['Project', 'Client', 'Status', 'Health']} rows={projects.filter((project) => ['closed', 'cancelled'].includes(project.status)).map((project) => [project.name, projectClientName(project), <Badge key="status" value={project.status} />, <Badge key="health" value={project.health_status} />])} /></section>}
      {activeProjectSection === 'reports' && <section className="panel"><PanelTitle icon={BarChart3} title="Project Reports" /><DataTable columns={['Report', 'Records']} rows={[['Portfolio Register', filteredProjects.length], ['Schedule Activities', selectedTasks.length], ['Budget Lines', selectedBudgetLines.length], ['Purchase Orders', selectedOrders.length], ['Site Reports', selectedDailyReports.length]]} /></section>}
      {activeProjectSection === 'workspace' && renderProjectWorkspace()}
    </section>
  )
}

function uniqueValues(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function projectMeta(project) {
  return project?.metadata && typeof project.metadata === 'object' ? project.metadata : {}
}

function projectFutureImageUrl(project) {
  return project?.future_image_url || projectMeta(project).future_image_url || ''
}

function projectPayloadFromForm(form) {
  const payload = Object.fromEntries(
    Object.entries(form).filter(([key]) => !['future_image', 'future_image_preview'].includes(key)),
  )

  payload.branch_id = form.branch_id ? Number(form.branch_id) : ''
  payload.client_id = form.client_id ? Number(form.client_id) : null

  if ('progress_percent' in form) {
    payload.progress_percent = Number(form.progress_percent || 0)
  }

  projectNumericFields.forEach((field) => {
    payload[field] = form[field] === '' || form[field] === null || form[field] === undefined
      ? null
      : Number(form[field])
  })

  return payload
}

function projectRequestPayload(form) {
  const payload = projectPayloadFromForm(form)

  if (!form.future_image) {
    return payload
  }

  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value === null || value === undefined ? '' : String(value))
  })
  formData.append('future_image', form.future_image)

  return formData
}

function setProjectFutureImage(setter, reportError = () => {}) {
  return (event) => {
    const file = event.target.files?.[0] || null

    if (!file) {
      setter((current) => ({ ...current, future_image: null, future_image_preview: '' }))
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      event.target.value = ''
      setter((current) => ({ ...current, future_image: null, future_image_preview: '' }))
      reportError('Project image must be a JPG, PNG, or WebP file.')
      return
    }

    if (file.size > 6 * 1024 * 1024) {
      event.target.value = ''
      setter((current) => ({ ...current, future_image: null, future_image_preview: '' }))
      reportError('Project image must be 6 MB or smaller.')
      return
    }

    reportError('')

    // Store the file immediately so a quick submit cannot race the preview reader.
    setter((current) => ({ ...current, future_image: file, future_image_preview: '' }))
    const reader = new FileReader()
    reader.onload = () => {
      setter((current) => current.future_image === file
        ? { ...current, future_image_preview: String(reader.result || '') }
        : current)
    }
    reader.onerror = () => reportError('The image was selected, but its preview could not be displayed.')
    reader.readAsDataURL(file)
  }
}

function projectClientName(project) {
  return project?.client?.name || project?.client_name || ''
}

function projectMatchesFilters(project, filters) {
  const meta = projectMeta(project)
  const query = String(filters.q || '').trim().toLowerCase()
  const haystack = [
    project.name,
    project.code,
    projectClientName(project),
    project.branch?.name,
    meta.project_manager,
    meta.project_type,
    meta.region,
    meta.city,
  ].join(' ').toLowerCase()
  const startDate = dateInputValue(project.start_date)
  const endDate = dateInputValue(project.target_end_date)
  const contractValue = Number(project.contract_value || 0)

  if (query && !haystack.includes(query)) return false
  if (filters.branch_id && String(project.branch_id || project.branch?.id) !== String(filters.branch_id)) return false
  if (filters.client_id && String(project.client_id || project.client?.id) !== String(filters.client_id)) return false
  if (filters.project_manager && meta.project_manager !== filters.project_manager) return false
  if (filters.project_type && meta.project_type !== filters.project_type) return false
  if (filters.status && project.status !== filters.status) return false
  if (filters.health_status && project.health_status !== filters.health_status) return false
  if (filters.region && meta.region !== filters.region) return false
  if (filters.start_from && startDate && startDate < filters.start_from) return false
  if (filters.end_to && endDate && endDate > filters.end_to) return false
  if (filters.min_value && contractValue < Number(filters.min_value)) return false
  if (filters.max_value && contractValue > Number(filters.max_value)) return false

  return true
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY

  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function projectScheduleVarianceDays(project) {
  if (!project?.target_end_date || ['completed', 'closed', 'cancelled', 'final_completion'].includes(project.status)) return 0

  return daysUntil(project.target_end_date)
}

function projectScheduleLabel(project) {
  const days = projectScheduleVarianceDays(project)

  if (!project?.target_end_date) return 'Not scheduled'
  if (days < 0) return `${Math.abs(days)} days late`
  if (days === 0) return 'Due today'

  return `${days} days remaining`
}

function projectOverBudget(project) {
  const budget = Number(project?.budget_total || 0)
  if (budget <= 0) return false

  return Number(project.actual_cost || 0) > budget || Number(project.forecast_to_complete || 0) > budget
}

function taskIsLate(task) {
  return task?.due_date && task.status !== 'done' && daysUntil(task.due_date) < 0
}

function plannedProgress(project) {
  if (!project?.start_date || !project?.target_end_date) return 0

  const start = new Date(project.start_date)
  const end = new Date(project.target_end_date)
  const now = new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0

  return Math.max(0, Math.min(100, Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)))
}

function projectCashPosition(project) {
  const invoices = project?.invoices || []
  const supplierInvoices = project?.supplier_invoices || []
  const expenses = project?.expenses || []

  return sumBy(invoices, 'amount_paid') - sumBy(supplierInvoices, 'amount_paid') - sumBy(expenses.filter((expense) => expense.paid_at), 'amount')
}

function projectHealthRows(project) {
  const ncrs = project?.non_conformance_reports || []
  const incidents = project?.safety_incidents || []
  const observations = project?.safety_observations || []
  const budget = Number(project?.budget_total || 0)
  const actual = Number(project?.actual_cost || 0)
  const cash = projectCashPosition(project)
  const scheduleDays = projectScheduleVarianceDays(project)
  const openQuality = ncrs.filter((item) => !['closed', 'verified'].includes(item.status)).length
  const openHse = incidents.filter((item) => item.status !== 'closed').length + observations.filter((item) => item.status !== 'closed').length

  return [
    { label: 'Cost', value: budget > 0 ? `${Math.round((actual / budget) * 100)}% used` : 'Not set', tone: budget > 0 && actual > budget ? 'red' : actual > budget * 0.9 ? 'amber' : 'green' },
    { label: 'Schedule', value: projectScheduleLabel(project), tone: scheduleDays < 0 ? 'red' : scheduleDays <= 14 ? 'amber' : 'green' },
    { label: 'Quality', value: `${openQuality} open NCRs`, tone: openQuality > 3 ? 'red' : openQuality > 0 ? 'amber' : 'green' },
    { label: 'HSE', value: `${openHse} open items`, tone: openHse > 3 ? 'red' : openHse > 0 ? 'amber' : 'green' },
    { label: 'Cash Flow', value: money(cash), tone: cash < 0 ? 'red' : cash === 0 ? 'amber' : 'green' },
    { label: 'Risk', value: labelize(project?.risk_level || 'medium'), tone: ['critical', 'high'].includes(project?.risk_level) ? 'red' : project?.risk_level === 'medium' ? 'amber' : 'green' },
  ]
}

function buildProjectActivity(project) {
  const events = []
  const add = (at, title, detail = '') => {
    if (at) events.push({ at, title, detail })
  }

  add(project.created_at, 'Project created', project.code)
  add(project.updated_at, 'Project updated', project.name)
  ;(project.tasks || []).forEach((task) => add(task.updated_at || task.created_at, `Activity ${labelize(task.status || 'updated')}`, task.title))
  ;(project.purchase_orders || []).forEach((order) => add(order.approved_at || order.updated_at || order.created_at, `PO ${labelize(order.status || 'updated')}`, order.po_number))
  ;(project.purchase_requisitions || []).forEach((request) => add(request.submitted_at || request.updated_at || request.created_at, `Requisition ${labelize(request.status || 'updated')}`, request.requisition_number || request.title))
  ;(project.field_daily_reports || []).forEach((report) => add(report.updated_at || report.created_at, 'Daily report submitted', report.report_number))
  ;(project.field_issues || []).forEach((issue) => add(issue.updated_at || issue.created_at, `Site issue ${labelize(issue.status || 'updated')}`, issue.title))
  ;(project.non_conformance_reports || []).forEach((ncr) => add(ncr.updated_at || ncr.created_at, `NCR ${labelize(ncr.status || 'updated')}`, ncr.ncr_number || ncr.title))
  ;(project.client_approvals || []).forEach((approval) => add(approval.reviewed_at || approval.submitted_at || approval.created_at, `Client approval ${labelize(approval.status || 'updated')}`, approval.approval_number || approval.title))
  ;(project.consultant_submittals || []).forEach((submittal) => add(submittal.reviewed_at || submittal.submitted_at || submittal.created_at, `Submittal ${labelize(submittal.status || 'updated')}`, submittal.submittal_number || submittal.title))
  ;(project.invoices || []).forEach((invoice) => add(invoice.paid_at || invoice.issued_at || invoice.updated_at || invoice.created_at, `Invoice ${labelize(invoice.payment_status || invoice.status || 'updated')}`, invoice.invoice_number || invoice.title))

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 60)
}

function ProjectActivityItem({ item }) {
  return (
    <article className="project-activity-item">
      <span>{timelineTime(item.at) || shortDate(item.at)}</span>
      <div>
        <strong>{item.title}</strong>
        {item.detail && <small>{item.detail}</small>}
      </div>
    </article>
  )
}

function closeoutReached(status, checkpoint) {
  const order = ['active', 'practical_completion', 'defects_liability', 'final_completion', 'completed', 'closed']
  const currentIndex = order.indexOf(status)
  const checkpointIndex = order.indexOf(checkpoint)

  return currentIndex >= 0 && checkpointIndex >= 0 && currentIndex >= checkpointIndex
}

function ProcurementView({
  selectedProject,
  projects,
  suppliers,
  procurement = {},
  requisitions,
  purchaseOrders,
  selectedProjectRequisitions,
  selectedProjectOrders,
  runAction,
}) {
  const today = new Date().toISOString().slice(0, 10)
  const selectedProjectId = selectedProject?.id || ''
  const allRequisitions = useMemo(() => (procurement.requisitions?.length ? procurement.requisitions : requisitions), [procurement.requisitions, requisitions])
  const allOrders = useMemo(() => (procurement.purchase_orders?.length ? procurement.purchase_orders : purchaseOrders), [procurement.purchase_orders, purchaseOrders])
  const visibleRequisitions = useMemo(() => {
    const source = selectedProjectId ? selectedProjectRequisitions : allRequisitions
    return (source || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId))
  }, [allRequisitions, selectedProjectId, selectedProjectRequisitions])
  const visibleOrders = useMemo(() => {
    const source = selectedProjectId ? selectedProjectOrders : allOrders
    return (source || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId))
  }, [allOrders, selectedProjectId, selectedProjectOrders])
  const visibleRfqs = useMemo(
    () => (procurement.rfqs || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId)),
    [procurement.rfqs, selectedProjectId],
  )
  const visibleQuotations = useMemo(
    () =>
      (procurement.quotations || []).filter((item) => {
        if (!selectedProjectId) return true
        return visibleRequisitions.some((request) => Number(request.id) === Number(item.purchase_requisition_id || item.requisition?.id))
      }),
    [procurement.quotations, selectedProjectId, visibleRequisitions],
  )
  const visibleReceipts = useMemo(
    () => (procurement.goods_receipts || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId)),
    [procurement.goods_receipts, selectedProjectId],
  )
  const visibleInspections = useMemo(
    () => (procurement.quality_inspections || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId)),
    [procurement.quality_inspections, selectedProjectId],
  )
  const visibleInvoices = useMemo(
    () => (procurement.supplier_invoices || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId)),
    [procurement.supplier_invoices, selectedProjectId],
  )
  const visibleContracts = useMemo(
    () => (procurement.contracts || []).filter((item) => !selectedProjectId || Number(item.project_id || item.project?.id) === Number(selectedProjectId)),
    [procurement.contracts, selectedProjectId],
  )
  const visibleTraceability = useMemo(
    () =>
      (procurement.traceability || []).filter((row) => {
        if (!selectedProjectId) return true
        return visibleRequisitions.some((request) => request.requisition_number === row.material_request)
      }),
    [procurement.traceability, selectedProjectId, visibleRequisitions],
  )
  const [activeTab, setActiveTab] = useState('dashboard')
  const [materialForm, setMaterialForm] = useState({
    project_id: selectedProject?.id ? String(selectedProject.id) : String(projects[0]?.id || ''),
    requested_by_name: '',
    department: '',
    priority: 'medium',
    required_by: '',
    delivery_location: '',
    purpose: '',
    discount_amount: 0,
    drawings: [],
    boq: [],
    specifications: [],
  })
  const [materialLines, setMaterialLines] = useState([emptyMaterialLine()])
  const [rfqForm, setRfqForm] = useState({ requisition_id: '', closing_date: '', terms: '', notes: '', supplier_ids: [] })
  const [quotationForm, setQuotationForm] = useState({ rfq_id: '', supplier_id: '', supplier_reference: '', valid_until: '', lead_time_days: 7, payment_terms: '', warranty_included: 'false', notes: '' })
  const [quoteLines, setQuoteLines] = useState([emptyQuoteLine()])
  const [grnForm, setGrnForm] = useState({ purchase_order_id: '', delivery_note_number: '', delivered_by: '', warehouse: '', received_date: today, notes: '' })
  const [inspectionForm, setInspectionForm] = useState({ goods_receipt_id: '', status: 'passed', result_summary: '', corrective_action: '' })
  const [invoiceForm, setInvoiceForm] = useState({ purchase_order_id: '', goods_receipt_id: '', supplier_reference: '', due_date: '', subtotal_amount: '', tax_amount: 0, discount_amount: 0, notes: '' })
  const [paymentForm, setPaymentForm] = useState({ supplier_invoice_id: '', amount: '', method: 'bank_transfer', reference: '' })
  const [contractForm, setContractForm] = useState({ supplier_id: '', project_id: selectedProject?.id ? String(selectedProject.id) : '', title: '', start_date: '', end_date: '', contract_value: '', terms: '' })
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [editingRequestId, setEditingRequestId] = useState('')

  const procurementTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'material_requests', label: 'Material Requests', icon: Send },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle2 },
    { id: 'rfqs', label: 'RFQs', icon: ClipboardList },
    { id: 'quotations', label: 'Supplier Quotations', icon: FileText },
    { id: 'comparison', label: 'Quotation Comparison', icon: Calculator },
    { id: 'purchase_orders', label: 'Purchase Orders', icon: Truck },
    { id: 'goods_receipts', label: 'Goods Receipts (GRN)', icon: Package },
    { id: 'supplier_invoices', label: 'Supplier Invoices', icon: WalletCards },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'contracts', label: 'Contracts', icon: Handshake },
    { id: 'reports', label: 'Reports', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]
  const summary = procurement.summary || {}
  const analytics = procurement.analytics || {}
  const supplierProfiles = procurement.supplier_profiles || []
  const approvedRequisitions = useMemo(() => visibleRequisitions.filter((item) => ['approved', 'rfq_sent'].includes(item.status)), [visibleRequisitions])
  const pendingApprovals = useMemo(() => visibleRequisitions.filter((item) => item.status === 'submitted'), [visibleRequisitions])
  const receivableOrders = useMemo(() => visibleOrders.filter((order) => ['issued', 'approved', 'delivered'].includes(order.status)), [visibleOrders])
  const selectedQuotationRfq = visibleRfqs.find((rfq) => String(rfq.id) === String(quotationForm.rfq_id))
  const selectedRfqSuppliers = (selectedQuotationRfq?.suppliers || []).map((item) => item.supplier).filter(Boolean)
  const selectedInvoiceOrder = visibleOrders.find((order) => String(order.id) === String(invoiceForm.purchase_order_id))
  const invoiceReceipts = visibleReceipts.filter((receipt) => String(receipt.purchase_order_id || receipt.purchase_order?.id) === String(invoiceForm.purchase_order_id))
  const payableInvoices = useMemo(() => visibleInvoices.filter((invoice) => ['finance_approved', 'partially_paid'].includes(invoice.status) && Number(invoice.balance_due || 0) > 0), [visibleInvoices])
  const selectedRequest = visibleRequisitions.find((request) => String(request.id) === String(selectedRequestId)) || visibleRequisitions[0]
  const materialTotals = useMemo(() => procurementTotals(materialLines, materialForm.discount_amount), [materialLines, materialForm.discount_amount])
  const quotationTotals = useMemo(() => procurementTotals(quoteLines), [quoteLines])
  const bestQuotationByRfq = useMemo(() => {
    const map = new Map()

    visibleQuotations.forEach((quotation) => {
      const rfqId = String(quotation.procurement_rfq_id || quotation.rfq?.id || '')
      const current = map.get(rfqId)

      const quotationScore = Number(quotation.recommendation_score || 0)
      const currentScore = Number(current?.recommendation_score || 0)

      if (!current || quotationScore > currentScore || (quotationScore === currentScore && Number(quotation.total_amount || 0) < Number(current.total_amount || 0))) {
        map.set(rfqId, quotation)
      }
    })

    return map
  }, [visibleQuotations])
  const recommendedQuotation = useMemo(
    () =>
      visibleQuotations.reduce((best, quotation) => {
        if (!best) return quotation

        const quotationScore = Number(quotation.recommendation_score || 0)
        const bestScore = Number(best.recommendation_score || 0)

        if (quotationScore > bestScore) return quotation
        if (quotationScore === bestScore && Number(quotation.total_amount || 0) < Number(best.total_amount || 0)) return quotation

        return best
      }, null),
    [visibleQuotations],
  )
  const traceabilityColumns = ['Material Request', 'Request Status', 'Approval Progress', 'RFQ', 'Quotation', 'Purchase Order', 'GRN', 'Quality', 'Supplier Invoice', 'Invoice Status', 'Payment']
  const traceabilityRows = visibleTraceability.map((row) => [
    row.material_request || '',
    row.request_status || '',
    row.approval_progress || '',
    row.rfq || '',
    row.quotation || '',
    row.purchase_order || '',
    row.goods_receipt || '',
    row.quality || '',
    row.supplier_invoice || '',
    row.invoice_status || '',
    row.payment_status || '',
  ])
  const invoiceReportColumns = ['Invoice', 'Supplier', 'Purchase Order', 'Status', 'Total', 'Paid', 'Balance', 'Due Date']
  const invoiceReportRows = visibleInvoices.map((invoice) => [
    invoice.invoice_number,
    invoice.supplier?.name || '',
    invoice.purchase_order?.po_number || '',
    invoice.status,
    invoice.total_amount,
    invoice.amount_paid,
    invoice.balance_due,
    shortDate(invoice.due_date),
  ])
  const poReportColumns = ['PO', 'Supplier', 'Status', 'Delivery', 'Payment', 'Total', 'Project']
  const poReportRows = visibleOrders.map((order) => [
    order.po_number,
    order.supplier?.name || '',
    order.status,
    order.delivery_status,
    order.payment_status,
    order.total_amount,
    order.project?.name || '',
  ])

  useEffect(() => {
    const projectId = selectedProject?.id || projects[0]?.id || ''

    if (!projectId) return

    setMaterialForm((current) => {
      if (current.project_id === String(projectId)) return current
      return { ...current, project_id: String(projectId) }
    })
    setContractForm((current) => {
      if (current.project_id || !selectedProject?.id) return current
      return { ...current, project_id: String(projectId) }
    })
  }, [selectedProject?.id, projects])

  useEffect(() => {
    if (rfqForm.requisition_id || approvedRequisitions.length === 0) return
    setRfqForm((current) => ({ ...current, requisition_id: String(approvedRequisitions[0].id) }))
  }, [approvedRequisitions, rfqForm.requisition_id])

  useEffect(() => {
    if (quotationForm.rfq_id || visibleRfqs.length === 0) return
    setQuotationForm((current) => ({ ...current, rfq_id: String(visibleRfqs[0].id) }))
  }, [quotationForm.rfq_id, visibleRfqs])

  useEffect(() => {
    if (!quotationForm.rfq_id) return

    const rfq = visibleRfqs.find((item) => String(item.id) === String(quotationForm.rfq_id))
    const supplier = (rfq?.suppliers || []).map((item) => item.supplier).find(Boolean)
    const requisition = visibleRequisitions.find((item) => Number(item.id) === Number(rfq?.purchase_requisition_id || rfq?.requisition?.id))
    const lines = (requisition?.lines || []).map((line) => ({
      item_name: line.item_name || line.description || '',
      description: line.description || '',
      cost_code: line.cost_code || '',
      quantity: line.quantity || 1,
      unit: line.unit || 'each',
      unit_price: line.estimated_unit_cost || '',
      tax_rate: line.tax_rate || 0,
      discount_amount: line.discount_amount || 0,
    }))

    setQuotationForm((current) => {
      const supplierStillValid = (rfq?.suppliers || []).some((item) => String(item.supplier_id || item.supplier?.id) === String(current.supplier_id))

      if (supplierStillValid || !supplier?.id) return current
      return { ...current, supplier_id: String(supplier.id) }
    })

    if (lines.length > 0) {
      setQuoteLines(lines)
    }
  }, [quotationForm.rfq_id, visibleRfqs, visibleRequisitions])

  useEffect(() => {
    if (!grnForm.purchase_order_id && receivableOrders.length > 0) {
      setGrnForm((current) => ({ ...current, purchase_order_id: String(receivableOrders[0].id) }))
    }
  }, [grnForm.purchase_order_id, receivableOrders])

  useEffect(() => {
    if (!inspectionForm.goods_receipt_id && visibleReceipts.length > 0) {
      setInspectionForm((current) => ({ ...current, goods_receipt_id: String(visibleReceipts[0].id) }))
    }
  }, [inspectionForm.goods_receipt_id, visibleReceipts])

  useEffect(() => {
    if (!invoiceForm.purchase_order_id && visibleOrders.length > 0) {
      const order = visibleOrders.find((item) => item.status !== 'cancelled') || visibleOrders[0]
      setInvoiceForm((current) => ({
        ...current,
        purchase_order_id: String(order.id),
        subtotal_amount: current.subtotal_amount || order.subtotal || order.total_amount || '',
        tax_amount: current.tax_amount || order.tax_amount || 0,
      }))
    }
  }, [invoiceForm.purchase_order_id, visibleOrders])

  useEffect(() => {
    if (!invoiceForm.purchase_order_id) return
    const order = visibleOrders.find((item) => String(item.id) === String(invoiceForm.purchase_order_id))

    if (!order) return

    setInvoiceForm((current) => ({
      ...current,
      subtotal_amount: current.subtotal_amount || order.subtotal || order.total_amount || '',
      tax_amount: current.tax_amount || order.tax_amount || 0,
    }))
  }, [invoiceForm.purchase_order_id, visibleOrders])

  useEffect(() => {
    if (!paymentForm.supplier_invoice_id && payableInvoices.length > 0) {
      setPaymentForm((current) => ({ ...current, supplier_invoice_id: String(payableInvoices[0].id), amount: payableInvoices[0].balance_due || '' }))
    }
  }, [payableInvoices, paymentForm.supplier_invoice_id])

  useEffect(() => {
    if (!contractForm.supplier_id && suppliers.length > 0) {
      setContractForm((current) => ({ ...current, supplier_id: String(suppliers[0].id) }))
    }
  }, [contractForm.supplier_id, suppliers])

  useEffect(() => {
    if (selectedRequestId || visibleRequisitions.length === 0) return
    setSelectedRequestId(String(visibleRequisitions[0].id))
  }, [selectedRequestId, visibleRequisitions])

  function updateMaterialLine(index, field, value) {
    setMaterialLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  }

  function updateQuoteLine(index, field, value) {
    setQuoteLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  }

  function toggleRfqSupplier(supplierId) {
    const id = String(supplierId)
    setRfqForm((current) => ({
      ...current,
      supplier_ids: current.supplier_ids.includes(id)
        ? current.supplier_ids.filter((item) => item !== id)
        : [...current.supplier_ids, id],
    }))
  }

  function attachFiles(field) {
    return (event) => {
      setMaterialForm((current) => ({ ...current, [field]: Array.from(event.target.files || []) }))
    }
  }

  async function submitMaterialRequest(event) {
    event.preventDefault()
    const projectId = materialForm.project_id || selectedProject?.id
    const lines = materialLines
      .filter((line) => line.item_name || line.description)
      .map((line) => ({
        item_name: line.item_name || line.description,
        description: line.description || line.item_name,
        cost_code: line.cost_code || null,
        quantity: Number(line.quantity || 1),
        unit: line.unit || 'each',
        estimated_unit_cost: Number(line.estimated_unit_cost || 0),
        tax_rate: Number(line.tax_rate || 0),
        discount_amount: Number(line.discount_amount || 0),
      }))

    if (!projectId || lines.length === 0) return

    const payload = {
      title: materialForm.purpose || lines[0].description || 'Material request',
      requested_by_name: materialForm.requested_by_name,
      department: materialForm.department,
      priority: materialForm.priority || 'medium',
      required_by: materialForm.required_by || null,
      delivery_location: materialForm.delivery_location || '',
      purpose: materialForm.purpose || '',
      discount_amount: Number(materialForm.discount_amount || 0),
      lines,
    }
    const formData = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'lines') return
      if (value !== null && value !== undefined) formData.append(key, value)
    })
    formData.append('lines_payload', JSON.stringify(lines))

    ;['drawings', 'boq', 'specifications'].forEach((field) => {
      ;(materialForm[field] || []).forEach((file) => formData.append(`${field}[]`, file))
    })

    const result = await runAction(
      () => (editingRequestId ? api.updateRequisition(editingRequestId, payload) : api.createRequisition(projectId, formData)),
      editingRequestId ? 'Material request updated.' : 'Material request created.',
    )

    if (!result) return

    setMaterialForm((current) => ({
      ...current,
      requested_by_name: '',
      department: '',
      priority: 'medium',
      required_by: '',
      delivery_location: '',
      purpose: '',
      discount_amount: 0,
      drawings: [],
      boq: [],
      specifications: [],
    }))
    setEditingRequestId('')
    setMaterialLines([emptyMaterialLine()])
  }

  async function submitRfq(event) {
    event.preventDefault()
    if (!rfqForm.requisition_id || rfqForm.supplier_ids.length === 0) return

    const result = await runAction(
      () =>
        api.createRfq(rfqForm.requisition_id, {
          supplier_ids: rfqForm.supplier_ids.map(Number),
          closing_date: rfqForm.closing_date || null,
          terms: rfqForm.terms || null,
          notes: rfqForm.notes || null,
        }),
      'RFQ sent to selected suppliers.',
    )

    if (result) {
      setRfqForm({ requisition_id: '', closing_date: '', terms: '', notes: '', supplier_ids: [] })
    }
  }

  async function submitQuotation(event) {
    event.preventDefault()
    const lines = quoteLines
      .filter((line) => line.item_name || line.description)
      .map((line) => ({
        item_name: line.item_name || line.description,
        description: line.description || line.item_name,
        cost_code: line.cost_code || null,
        quantity: Number(line.quantity || 1),
        unit: line.unit || 'each',
        unit_price: Number(line.unit_price || 0),
        tax_rate: Number(line.tax_rate || 0),
        discount_amount: Number(line.discount_amount || 0),
      }))

    if (!quotationForm.rfq_id || !quotationForm.supplier_id || lines.length === 0) return

    const result = await runAction(
      () =>
        api.createSupplierQuotation(quotationForm.rfq_id, {
          supplier_id: Number(quotationForm.supplier_id),
          supplier_reference: quotationForm.supplier_reference || null,
          valid_until: quotationForm.valid_until || null,
          lead_time_days: Number(quotationForm.lead_time_days || 0),
          payment_terms: quotationForm.payment_terms || null,
          warranty_included: quotationForm.warranty_included === 'true',
          notes: quotationForm.notes || null,
          lines,
        }),
      'Supplier quotation captured.',
    )

    if (result) {
      setQuotationForm((current) => ({ ...current, supplier_reference: '', valid_until: '', payment_terms: '', warranty_included: 'false', notes: '' }))
    }
  }

  async function submitGoodsReceipt(event) {
    event.preventDefault()
    if (!grnForm.purchase_order_id) return

    const result = await runAction(
      () =>
        api.createGoodsReceipt(grnForm.purchase_order_id, {
          delivery_note_number: grnForm.delivery_note_number || null,
          delivered_by: grnForm.delivered_by || null,
          warehouse: grnForm.warehouse || null,
          received_date: grnForm.received_date || null,
          notes: grnForm.notes || null,
        }),
      'Goods receipt recorded.',
    )

    if (result) {
      setGrnForm((current) => ({ ...current, delivery_note_number: '', delivered_by: '', warehouse: '', received_date: today, notes: '' }))
    }
  }

  async function submitQualityInspection(event) {
    event.preventDefault()
    if (!inspectionForm.goods_receipt_id) return

    const result = await runAction(
      () =>
        api.createProcurementQualityInspection(inspectionForm.goods_receipt_id, {
          status: inspectionForm.status,
          result_summary: inspectionForm.result_summary || null,
          corrective_action: inspectionForm.corrective_action || null,
        }),
      'Procurement quality inspection saved.',
    )

    if (result) {
      setInspectionForm((current) => ({ ...current, status: 'passed', result_summary: '', corrective_action: '' }))
    }
  }

  async function submitSupplierInvoice(event) {
    event.preventDefault()
    if (!invoiceForm.purchase_order_id) return

    const result = await runAction(
      () =>
        api.createSupplierInvoice(invoiceForm.purchase_order_id, {
          goods_receipt_id: invoiceForm.goods_receipt_id || null,
          supplier_reference: invoiceForm.supplier_reference || null,
          due_date: invoiceForm.due_date || null,
          subtotal_amount: Number(invoiceForm.subtotal_amount || selectedInvoiceOrder?.subtotal || selectedInvoiceOrder?.total_amount || 0),
          tax_amount: Number(invoiceForm.tax_amount || 0),
          discount_amount: Number(invoiceForm.discount_amount || 0),
          notes: invoiceForm.notes || null,
        }),
      'Supplier invoice submitted.',
    )

    if (result) {
      setInvoiceForm((current) => ({ ...current, goods_receipt_id: '', supplier_reference: '', due_date: '', discount_amount: 0, notes: '' }))
    }
  }

  async function submitSupplierPayment(event) {
    event.preventDefault()
    if (!paymentForm.supplier_invoice_id || !paymentForm.amount) return

    const result = await runAction(
      () =>
        api.paySupplierInvoice(paymentForm.supplier_invoice_id, {
          amount: Number(paymentForm.amount || 0),
          method: paymentForm.method,
          reference: paymentForm.reference || null,
        }),
      'Supplier payment recorded.',
    )

    if (result) {
      setPaymentForm((current) => ({ ...current, amount: '', reference: '' }))
    }
  }

  async function submitSupplierContract(event) {
    event.preventDefault()
    if (!contractForm.supplier_id || !contractForm.title) return

    const result = await runAction(
      () =>
        api.createSupplierContract(contractForm.supplier_id, {
          project_id: contractForm.project_id || null,
          title: contractForm.title,
          start_date: contractForm.start_date || null,
          end_date: contractForm.end_date || null,
          contract_value: Number(contractForm.contract_value || 0),
          terms: contractForm.terms || null,
        }),
      'Supplier contract created.',
    )

    if (result) {
      setContractForm((current) => ({ ...current, title: '', start_date: '', end_date: '', contract_value: '', terms: '' }))
    }
  }

  function viewMaterialRequest(request) {
    setSelectedRequestId(String(request.id))
    setActiveTab('approvals')
  }

  function editMaterialRequest(request) {
    setEditingRequestId(String(request.id))
    setSelectedRequestId(String(request.id))
    setMaterialForm((current) => ({
      ...current,
      project_id: String(request.project_id || request.project?.id || current.project_id),
      requested_by_name: procurementRequesterName(request),
      department: request.department || '',
      priority: request.priority || 'medium',
      required_by: dateInputValue(request.required_by),
      delivery_location: request.delivery_location || '',
      purpose: request.purpose || request.title || '',
      discount_amount: request.discount_amount || 0,
      drawings: [],
      boq: [],
      specifications: [],
    }))
    setMaterialLines((request.lines || []).map((line) => ({
      item_name: line.item_name || '',
      description: line.description || '',
      cost_code: line.cost_code || '',
      quantity: line.quantity || 1,
      unit: line.unit || 'each',
      estimated_unit_cost: line.estimated_unit_cost || '',
      tax_rate: line.tax_rate || 0,
      discount_amount: line.discount_amount || 0,
    })))
    setActiveTab('material_requests')
  }

  async function duplicateMaterialRequest(request) {
    const projectId = request.project_id || request.project?.id
    if (!projectId) return

    await runAction(
      () =>
        api.createRequisition(projectId, {
          title: `${request.title || request.purpose || request.requisition_number} copy`,
          requested_by_name: procurementRequesterName(request),
          department: request.department || '',
          priority: request.priority || 'medium',
          required_by: request.required_by || null,
          delivery_location: request.delivery_location || '',
          purpose: request.purpose || request.title || '',
          discount_amount: 0,
          lines: (request.lines || []).map((line) => ({
            item_name: line.item_name || line.description,
            description: line.description || line.item_name,
            cost_code: line.cost_code || null,
            quantity: Number(line.quantity || 1),
            unit: line.unit || 'each',
            estimated_unit_cost: Number(line.estimated_unit_cost || 0),
            tax_rate: Number(line.tax_rate || 0),
            discount_amount: Number(line.discount_amount || 0),
          })),
        }),
      'Material request duplicated.',
    )
  }

  function archiveMaterialRequest(request) {
    if (!window.confirm(`Archive material request ${request.requisition_number}?`)) {
      return
    }

    runAction(() => api.deleteRequisition(request.id), 'Material request archived.').then(() => {
      if (editingRequestId === String(request.id)) {
        setEditingRequestId('')
        setMaterialLines([emptyMaterialLine()])
      }
    })
  }

  function convertRequestToRfq(request) {
    setRfqForm((current) => ({ ...current, requisition_id: String(request.id) }))
    setSelectedRequestId(String(request.id))
    setActiveTab('rfqs')
  }

  function exportRequestPdf(request) {
    downloadSimplePdf(`${request.requisition_number || `material-request-${request.id}`}.pdf`, request.requisition_number || 'Material Request', [
      ['Project', request.project?.name || ''],
      ['Requested By', procurementRequesterName(request)],
      ['Department', request.department || ''],
      ['Priority', labelize(request.priority || '')],
      ['Status', requestStatusLabel(request)],
      ['Value', money(request.grand_total || request.total_estimated)],
      ['Required Date', shortDate(request.required_by)],
      ['Purpose', request.purpose || request.title || ''],
      ['Progress', approvalProgressLabel(request)],
      ['Lines', (request.lines || []).map((line) => `${line.item_name || line.description}: ${line.quantity} ${line.unit} @ ${money(line.estimated_unit_cost)}`).join('; ')],
    ])
  }

  return (
    <section className="view-stack">
      <nav className="module-tabs" aria-label="Procurement module navigation">
        {procurementTabs.map((tab) => {
          const Icon = tab.icon

          return (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Procurement Analytics" />
            <div className="kpi-grid">
              <Kpi icon={BarChart3} label="Spend This Month" value={money(analytics.spend_this_month ?? summary.month_spend)} sub="Supplier payments posted" />
              <Kpi icon={Clock3} label="Average Approval Time" value={`${analytics.average_approval_time_days ?? summary.average_approval_time_days ?? 0} days`} sub="Submitted to final approval" />
              <Kpi icon={Users} label="Supplier Performance" value={`${analytics.supplier_performance ?? summary.supplier_performance ?? 0}%`} sub="Rating and delivery blend" />
              <Kpi icon={Truck} label="On-Time Delivery" value={`${analytics.on_time_delivery ?? summary.on_time_delivery ?? 0}%`} sub="Against expected delivery" />
              <Kpi icon={ClipboardList} label="Open POs" value={analytics.open_pos ?? summary.open_purchase_orders ?? 0} sub="Issued or awaiting closure" />
              <Kpi icon={WalletCards} label="Pending Payments" value={money(analytics.pending_payments ?? summary.pending_payments)} sub="Supplier invoice balance" />
            </div>
          </section>

          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={CheckCircle2} title="Recent Activity" />
              <MiniList items={(procurement.recent_activity || []).map((item) => `Done - ${item.label}`)} />
            </section>

            <section className="panel">
              <PanelTitle icon={Workflow} title="Lifecycle Traceability" />
              <DataTable
                columns={['MR', 'RFQ', 'Quote', 'PO', 'GRN', 'Quality', 'Invoice', 'Payment']}
                rows={visibleTraceability.slice(0, 8).map((row) => [
                  row.material_request || '',
                  row.rfq || '',
                  row.quotation || '',
                  row.purchase_order || '',
                  row.goods_receipt || '',
                  row.quality ? <Badge key="quality" value={row.quality} /> : '',
                  row.supplier_invoice || '',
                  row.payment_status ? <Badge key="payment" value={row.payment_status} /> : '',
                ])}
              />
            </section>
          </div>
        </>
      )}

      {activeTab === 'material_requests' && (
        <>
          <section className="panel">
            <PanelTitle icon={Send} title="Material Request" />
            <form className="procurement-request" onSubmit={submitMaterialRequest}>
              <div className="form-grid two">
                <Field label="Request No." value="Generated automatically" disabled />
                <Select label="Project" name="project_id" value={materialForm.project_id} onChange={setForm(setMaterialForm)} required>
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
                <Field label="Requested By" name="requested_by_name" value={materialForm.requested_by_name} onChange={setForm(setMaterialForm)} required />
                <Field label="Department" name="department" value={materialForm.department} onChange={setForm(setMaterialForm)} required />
                <Field label="Required Date" type="date" name="required_by" value={materialForm.required_by} onChange={setForm(setMaterialForm)} />
                <Field label="Delivery Location" name="delivery_location" value={materialForm.delivery_location} onChange={setForm(setMaterialForm)} />
                <div className="field span-2">
                  <span>Priority</span>
                  <div className="priority-options">
                    {['low', 'medium', 'high', 'critical'].map((priority) => (
                      <label key={priority}>
                        <input
                          type="radio"
                          name="priority"
                          value={priority}
                          checked={materialForm.priority === priority}
                          onChange={setForm(setMaterialForm)}
                        />
                        <span>{labelize(priority)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <TextArea className="span-2" label="Purpose" name="purpose" value={materialForm.purpose} onChange={setForm(setMaterialForm)} placeholder="Foundation concrete works, facade procurement, MEP first fix..." />
              </div>

              <div className="file-grid">
                <Field label="Upload Drawings" type="file" multiple onChange={attachFiles('drawings')} />
                <Field label="Upload BOQ" type="file" multiple onChange={attachFiles('boq')} />
                <Field label="Upload Specifications" type="file" multiple onChange={attachFiles('specifications')} />
              </div>

              <div className="section-heading">
                <strong>Line Items</strong>
                <button type="button" className="table-action" onClick={() => setMaterialLines((current) => [...current, emptyMaterialLine()])}>
                  <Plus size={14} />
                  Add Line Item
                </button>
              </div>
              <div className="table-wrap input-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Cost Code</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Unit Cost</th>
                      <th>Tax %</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialLines.map((line, index) => (
                      <tr key={index}>
                        <td><input value={line.item_name} onChange={(event) => updateMaterialLine(index, 'item_name', event.target.value)} /></td>
                        <td><input value={line.description} onChange={(event) => updateMaterialLine(index, 'description', event.target.value)} required /></td>
                        <td><input value={line.cost_code} onChange={(event) => updateMaterialLine(index, 'cost_code', event.target.value)} placeholder="Auto-generated" /></td>
                        <td><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateMaterialLine(index, 'quantity', event.target.value)} required /></td>
                        <td><input value={line.unit} onChange={(event) => updateMaterialLine(index, 'unit', event.target.value)} /></td>
                        <td><input type="number" min="0" step="0.01" value={line.estimated_unit_cost} onChange={(event) => updateMaterialLine(index, 'estimated_unit_cost', event.target.value)} required /></td>
                        <td><input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={(event) => updateMaterialLine(index, 'tax_rate', event.target.value)} /></td>
                        <td>{money(lineTotal(line, 'estimated_unit_cost'))}</td>
                        <td>
                          <button type="button" className="table-action danger" onClick={() => setMaterialLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="procurement-totals">
                <span>Subtotal <strong>{money(materialTotals.subtotal)}</strong></span>
                <span>Tax <strong>{money(materialTotals.tax)}</strong></span>
                <label>
                  Discount
                  <input type="number" min="0" step="0.01" name="discount_amount" value={materialForm.discount_amount} onChange={setForm(setMaterialForm)} />
                </label>
                <span>Grand Total <strong>{money(materialTotals.grandTotal)}</strong></span>
              </div>

              <div className="row-actions">
                <button type="submit" className="primary-action compact-action">
                  <Send size={17} />
                  {editingRequestId ? 'Save Material Request' : 'Create Material Request'}
                </button>
                {editingRequestId && (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => {
                      setEditingRequestId('')
                      setMaterialForm((current) => ({ ...current, requested_by_name: '', department: '', required_by: '', delivery_location: '', purpose: '', discount_amount: 0, drawings: [], boq: [], specifications: [] }))
                      setMaterialLines([emptyMaterialLine()])
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Material Request Register" />
            <DataTable
              columns={['Request No', 'Project', 'Requested By', 'Priority', 'Status', 'Value', 'Progress', 'Required Date', 'Actions']}
              rows={visibleRequisitions.map((item) => [
                item.requisition_number,
                item.project?.name || '',
                procurementRequesterName(item),
                <Badge key="priority" value={item.priority} />,
                requestStatusLabel(item),
                money(item.grand_total || item.total_estimated),
                approvalProgressLabel(item),
                shortDate(item.required_by),
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => viewMaterialRequest(item)}>
                    View
                  </button>
                  {['draft', 'rejected'].includes(item.status) && (
                    <>
                      <button type="button" className="table-action" onClick={() => editMaterialRequest(item)}>
                        Edit
                      </button>
                      <button type="button" className="table-action" onClick={() => runAction(() => api.submitRequisition(item.id), 'Material request submitted.')}>
                        Submit
                      </button>
                      <button type="button" className="table-action danger" onClick={() => archiveMaterialRequest(item)}>
                        Archive
                      </button>
                    </>
                  )}
                  {item.status === 'submitted' && (
                    <>
                      <button type="button" className="table-action" onClick={() => runAction(() => api.reviewRequisition(item.id, 'approved'), 'Approval step completed.')}>
                        Approve
                      </button>
                      <button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewRequisition(item.id, 'rejected'), 'Material request rejected.')}>
                        Reject
                      </button>
                    </>
                  )}
                  <button type="button" className="table-action" onClick={() => duplicateMaterialRequest(item)}>
                    Duplicate
                  </button>
                  {['approved', 'rfq_sent'].includes(item.status) && (
                    <button type="button" className="table-action" onClick={() => convertRequestToRfq(item)}>
                      Convert to RFQ
                    </button>
                  )}
                  <button type="button" className="table-action" onClick={() => exportRequestPdf(item)}>
                    Export PDF
                  </button>
                </div>,
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'approvals' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CheckCircle2} title="Approval Queue" />
            <DataTable
              columns={['Request', 'Project', 'Requested By', 'Priority', 'Status', 'Progress', 'Value', 'Decision']}
              rows={pendingApprovals.map((item) => [
                item.requisition_number,
                item.project?.name || '',
                procurementRequesterName(item),
                <Badge key="priority" value={item.priority} />,
                requestStatusLabel(item),
                approvalProgressLabel(item),
                money(item.grand_total || item.total_estimated),
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => setSelectedRequestId(String(item.id))}>
                    View
                  </button>
                  <button type="button" className="table-action" onClick={() => runAction(() => api.reviewRequisition(item.id, 'approved'), 'Approval step completed.')}>
                    Approve
                  </button>
                  <button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewRequisition(item.id, 'rejected'), 'Material request rejected.')}>
                    Reject
                  </button>
                </div>,
              ])}
            />
          </section>

          <section className="panel">
            <PanelTitle icon={Workflow} title="Document Workflow" />
            {selectedRequest ? (
              <>
                <div className="request-summary">
                  <strong>{selectedRequest.requisition_number}</strong>
                  <span>{selectedRequest.project?.name || ''}</span>
                  <span>{procurementRequesterName(selectedRequest)}{selectedRequest.department ? ` - ${selectedRequest.department}` : ''}</span>
                  <span>{requestStatusLabel(selectedRequest)} - {approvalProgressLabel(selectedRequest)}</span>
                </div>
                <ApprovalWorkflowPanel workflow={selectedRequest.approval_workflow || []} />
                <TimelinePanel items={selectedRequest.timeline || []} />
              </>
            ) : (
              <MiniList items={['No requisition selected']} />
            )}
          </section>
        </div>
      )}

      {activeTab === 'rfqs' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Request for Quotation" />
            <form className="form-grid two" onSubmit={submitRfq}>
              <Select label="Material Request" name="requisition_id" value={rfqForm.requisition_id} onChange={setForm(setRfqForm)} required>
                <option value="">Select approved request</option>
                {approvedRequisitions.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.requisition_number} - {request.title}
                  </option>
                ))}
              </Select>
              <Field label="Closing Date" type="date" name="closing_date" value={rfqForm.closing_date} onChange={setForm(setRfqForm)} />
              <TextArea className="span-2" label="Commercial Terms" name="terms" value={rfqForm.terms} onChange={setForm(setRfqForm)} />
              <TextArea className="span-2" label="Notes" name="notes" value={rfqForm.notes} onChange={setForm(setRfqForm)} />
              <div className="field span-2">
                <span>Suppliers</span>
                <div className="check-list">
                  {suppliers.map((supplier) => (
                    <label key={supplier.id} className="check-row">
                      <input type="checkbox" checked={rfqForm.supplier_ids.includes(String(supplier.id))} onChange={() => toggleRfqSupplier(supplier.id)} />
                      <span>{supplier.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="primary-action span-2">
                <Send size={17} />
                Send RFQ
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={ClipboardList} title="RFQ Register" />
            <DataTable
              columns={['RFQ', 'Request', 'Suppliers', 'Closing', 'Status']}
              rows={visibleRfqs.map((rfq) => [
                rfq.rfq_number,
                rfq.requisition?.requisition_number || '',
                rfq.suppliers?.length || 0,
                shortDate(rfq.closing_date),
                <Badge key="status" value={rfq.status} />,
              ])}
            />
          </section>
        </div>
      )}

      {activeTab === 'quotations' && (
        <>
          <section className="panel">
            <PanelTitle icon={FileText} title="Supplier Quotation" />
            <form className="procurement-request" onSubmit={submitQuotation}>
              <div className="form-grid two">
                <Select label="RFQ" name="rfq_id" value={quotationForm.rfq_id} onChange={setForm(setQuotationForm)} required>
                  <option value="">Select RFQ</option>
                  {visibleRfqs.map((rfq) => (
                    <option key={rfq.id} value={rfq.id}>
                      {rfq.rfq_number} - {rfq.title}
                    </option>
                  ))}
                </Select>
                <Select label="Supplier" name="supplier_id" value={quotationForm.supplier_id} onChange={setForm(setQuotationForm)} required>
                  <option value="">Select supplier</option>
                  {selectedRfqSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
                <Field label="Supplier Reference" name="supplier_reference" value={quotationForm.supplier_reference} onChange={setForm(setQuotationForm)} />
                <Field label="Valid Until" type="date" name="valid_until" value={quotationForm.valid_until} onChange={setForm(setQuotationForm)} />
                <Field label="Lead Time Days" type="number" min="0" name="lead_time_days" value={quotationForm.lead_time_days} onChange={setForm(setQuotationForm)} />
                <Field label="Payment Terms" name="payment_terms" value={quotationForm.payment_terms} onChange={setForm(setQuotationForm)} />
                <Select label="Warranty" name="warranty_included" value={quotationForm.warranty_included} onChange={setForm(setQuotationForm)}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
                <TextArea className="span-2" label="Notes" name="notes" value={quotationForm.notes} onChange={setForm(setQuotationForm)} />
              </div>

              <div className="section-heading">
                <strong>Quotation Lines</strong>
                <button type="button" className="table-action" onClick={() => setQuoteLines((current) => [...current, emptyQuoteLine()])}>
                  <Plus size={14} />
                  Add Line
                </button>
              </div>
              <div className="table-wrap input-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Cost Code</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      <th>Tax %</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteLines.map((line, index) => (
                      <tr key={index}>
                        <td><input value={line.item_name} onChange={(event) => updateQuoteLine(index, 'item_name', event.target.value)} /></td>
                        <td><input value={line.description} onChange={(event) => updateQuoteLine(index, 'description', event.target.value)} required /></td>
                        <td><input value={line.cost_code} onChange={(event) => updateQuoteLine(index, 'cost_code', event.target.value)} placeholder="Auto-generated" /></td>
                        <td><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateQuoteLine(index, 'quantity', event.target.value)} required /></td>
                        <td><input value={line.unit} onChange={(event) => updateQuoteLine(index, 'unit', event.target.value)} /></td>
                        <td><input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateQuoteLine(index, 'unit_price', event.target.value)} required /></td>
                        <td><input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={(event) => updateQuoteLine(index, 'tax_rate', event.target.value)} /></td>
                        <td>{money(lineTotal(line, 'unit_price'))}</td>
                        <td>
                          <button type="button" className="table-action danger" onClick={() => setQuoteLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="procurement-totals">
                <span>Subtotal <strong>{money(quotationTotals.subtotal)}</strong></span>
                <span>Tax <strong>{money(quotationTotals.tax)}</strong></span>
                <span>Discount <strong>{money(quotationTotals.discount)}</strong></span>
                <span>Grand Total <strong>{money(quotationTotals.grandTotal)}</strong></span>
              </div>
              <button type="submit" className="primary-action compact-action">
                <CheckCircle2 size={17} />
                Capture Quotation
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={FileText} title="Supplier Quotations" />
            <div className="procurement-cards">
              {visibleQuotations.slice(0, 6).map((quotation) => (
                <article key={quotation.id} className="mini-card">
                  <strong>{quotation.supplier?.name || 'Supplier'}</strong>
                  <span>Total {money(quotation.total_amount)}</span>
                  <span>Delivery {quotation.lead_time_days || 0} days</span>
                  <span>Warranty {quotation.warranty_included ? 'Yes' : 'No'}</span>
                  <Badge value={`${quotation.recommendation_score || 0} score`} />
                </article>
              ))}
            </div>
            <DataTable
              columns={['Quotation', 'RFQ', 'Supplier', 'Delivery', 'Warranty', 'Score', 'Valid Until', 'Total', 'Status']}
              rows={visibleQuotations.map((quotation) => [
                quotation.quotation_number,
                quotation.rfq?.rfq_number || '',
                quotation.supplier?.name || '',
                `${quotation.lead_time_days || 0} days`,
                quotation.warranty_included ? 'Yes' : 'No',
                quotation.recommendation_score || 0,
                shortDate(quotation.valid_until),
                money(quotation.total_amount),
                <Badge key="status" value={quotation.status} />,
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'comparison' && (
        <section className="panel">
          <PanelTitle icon={Calculator} title="Quotation Comparison" />
          <div className="recommendation-strip">
            <span>Recommended Supplier</span>
            <strong>{recommendedQuotation?.supplier?.name || 'No quotations yet'}</strong>
          </div>
          <DataTable
            columns={['Supplier', 'Price', 'Delivery', 'Payment Terms', 'Score', 'RFQ', 'Status', 'Actions']}
            rows={visibleQuotations.map((quotation) => {
              const rfqId = String(quotation.procurement_rfq_id || quotation.rfq?.id || '')
              const isBest = bestQuotationByRfq.get(rfqId)?.id === quotation.id

              return [
                quotation.supplier?.name || '',
                money(quotation.total_amount),
                `${quotation.lead_time_days || 0} days`,
                quotation.payment_terms || '',
                <strong key="score">{quotation.recommendation_score || 0}</strong>,
                quotation.rfq?.rfq_number || '',
                <Badge key="status" value={quotation.status} />,
                <div key="actions" className="row-actions">
                  {isBest && <Badge value="recommended" />}
                  {quotation.status === 'submitted' && (
                    <button type="button" className="table-action" onClick={() => runAction(() => api.acceptQuotation(quotation.id), 'Quotation accepted.')}>
                      Accept
                    </button>
                  )}
                  {quotation.status === 'accepted' && !quotation.purchase_order && (
                    <button type="button" className="table-action" onClick={() => runAction(() => api.createPoFromQuotation(quotation.id), 'Purchase order created from quotation.')}>
                      Create PO
                    </button>
                  )}
                </div>,
              ]
            })}
          />
        </section>
      )}

      {activeTab === 'purchase_orders' && (
        <section className="panel">
          <PanelTitle icon={Truck} title="Purchase Orders" />
          <DataTable
            columns={['PO', 'Supplier', 'Status', 'Expected Delivery', 'Terms', 'Items', 'Total', 'Payment', 'Next']}
            rows={visibleOrders.map((order) => [
              order.po_number,
              order.supplier?.name || '',
              <Badge key="status" value={order.status} />,
              shortDate(order.expected_delivery_date),
              order.terms || '',
              order.lines?.length || 0,
              money(order.total_amount),
              <Badge key="payment" value={order.payment_status} />,
              nextPoStatus(order.status) ? (
                <button
                  key="transition"
                  type="button"
                  className="table-action"
                  onClick={() => runAction(() => api.transitionPurchaseOrder(order.id, nextPoStatus(order.status)), `PO moved to ${labelize(nextPoStatus(order.status))}.`)}
                >
                  {labelize(nextPoStatus(order.status))}
                </button>
              ) : '',
            ])}
          />
        </section>
      )}

      {activeTab === 'goods_receipts' && (
        <>
          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={Package} title="Goods Receipt Note" />
              <form className="form-grid two" onSubmit={submitGoodsReceipt}>
                <Select label="Purchase Order" name="purchase_order_id" value={grnForm.purchase_order_id} onChange={setForm(setGrnForm)} required>
                  <option value="">Select PO</option>
                  {receivableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.po_number} - {order.supplier?.name || ''}
                    </option>
                  ))}
                </Select>
                <Field label="Received Date" type="date" name="received_date" value={grnForm.received_date} onChange={setForm(setGrnForm)} />
                <Field label="Delivery Note No." name="delivery_note_number" value={grnForm.delivery_note_number} onChange={setForm(setGrnForm)} />
                <Field label="Delivered By" name="delivered_by" value={grnForm.delivered_by} onChange={setForm(setGrnForm)} />
                <Field label="Warehouse" name="warehouse" value={grnForm.warehouse} onChange={setForm(setGrnForm)} />
                <TextArea label="Notes" name="notes" value={grnForm.notes} onChange={setForm(setGrnForm)} />
                <button type="submit" className="primary-action span-2">
                  <CheckCircle2 size={17} />
                  Record GRN
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={ShieldCheck} title="Quality Inspection" />
              <form className="form-grid two" onSubmit={submitQualityInspection}>
                <Select label="GRN" name="goods_receipt_id" value={inspectionForm.goods_receipt_id} onChange={setForm(setInspectionForm)} required>
                  <option value="">Select GRN</option>
                  {visibleReceipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.grn_number} - {receipt.purchase_order?.po_number || ''}
                    </option>
                  ))}
                </Select>
                <Select label="Result" name="status" value={inspectionForm.status} onChange={setForm(setInspectionForm)}>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                </Select>
                <TextArea label="Result Summary" name="result_summary" value={inspectionForm.result_summary} onChange={setForm(setInspectionForm)} />
                <TextArea label="Corrective Action" name="corrective_action" value={inspectionForm.corrective_action} onChange={setForm(setInspectionForm)} />
                <button type="submit" className="primary-action span-2">
                  <ShieldCheck size={17} />
                  Save Inspection
                </button>
              </form>
            </section>
          </div>

          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={Package} title="Goods Receipts" />
              <DataTable
                columns={['GRN', 'PO', 'Delivered By', 'Delivery Note', 'Items Received', 'Inspection', 'Warehouse', 'Status']}
                rows={visibleReceipts.map((receipt) => [
                  receipt.grn_number,
                  receipt.purchase_order?.po_number || '',
                  receipt.delivered_by || receipt.supplier?.name || '',
                  receipt.delivery_note_number || '',
                  (receipt.lines || []).map((line) => `${Number(line.received_quantity || 0)} ${line.description}`).join(', '),
                  receipt.quality_inspections?.[0]?.status || receipt.qualityInspections?.[0]?.status || '',
                  receipt.warehouse || '',
                  <Badge key="status" value={receipt.status} />,
                ])}
              />
            </section>

            <section className="panel">
              <PanelTitle icon={ShieldCheck} title="Quality Inspections" />
              <DataTable
                columns={['Inspection', 'GRN', 'PO', 'Result', 'Inspected']}
                rows={visibleInspections.map((inspection) => [
                  inspection.inspection_number,
                  inspection.goods_receipt?.grn_number || '',
                  inspection.purchase_order?.po_number || '',
                  <Badge key="status" value={inspection.status} />,
                  shortDate(inspection.inspected_at),
                ])}
              />
            </section>
          </div>
        </>
      )}

      {activeTab === 'supplier_invoices' && (
        <>
          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={WalletCards} title="Supplier Invoice" />
              <form className="form-grid two" onSubmit={submitSupplierInvoice}>
                <Select label="Purchase Order" name="purchase_order_id" value={invoiceForm.purchase_order_id} onChange={setForm(setInvoiceForm)} required>
                  <option value="">Select PO</option>
                  {visibleOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.po_number} - {order.supplier?.name || ''}
                    </option>
                  ))}
                </Select>
                <Select label="Goods Receipt" name="goods_receipt_id" value={invoiceForm.goods_receipt_id} onChange={setForm(setInvoiceForm)}>
                  <option value="">No GRN linked</option>
                  {invoiceReceipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.grn_number}
                    </option>
                  ))}
                </Select>
                <Field label="Supplier Reference" name="supplier_reference" value={invoiceForm.supplier_reference} onChange={setForm(setInvoiceForm)} />
                <Field label="Due Date" type="date" name="due_date" value={invoiceForm.due_date} onChange={setForm(setInvoiceForm)} />
                <Field label="Subtotal" type="number" min="0" step="0.01" name="subtotal_amount" value={invoiceForm.subtotal_amount} onChange={setForm(setInvoiceForm)} />
                <Field label="Tax" type="number" min="0" step="0.01" name="tax_amount" value={invoiceForm.tax_amount} onChange={setForm(setInvoiceForm)} />
                <Field label="Discount" type="number" min="0" step="0.01" name="discount_amount" value={invoiceForm.discount_amount} onChange={setForm(setInvoiceForm)} />
                <TextArea label="Notes" name="notes" value={invoiceForm.notes} onChange={setForm(setInvoiceForm)} />
                <button type="submit" className="primary-action span-2">
                  <WalletCards size={17} />
                  Submit Invoice
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={WalletCards} title="Payment" />
              <form className="form-grid two" onSubmit={submitSupplierPayment}>
                <Select label="Approved Invoice" name="supplier_invoice_id" value={paymentForm.supplier_invoice_id} onChange={setForm(setPaymentForm)} required>
                  <option value="">Select invoice</option>
                  {payableInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {money(invoice.balance_due)}
                    </option>
                  ))}
                </Select>
                <Field label="Amount" type="number" min="0.01" step="0.01" name="amount" value={paymentForm.amount} onChange={setForm(setPaymentForm)} required />
                <Select label="Method" name="method" value={paymentForm.method} onChange={setForm(setPaymentForm)}>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile money</option>
                </Select>
                <Field label="Reference" name="reference" value={paymentForm.reference} onChange={setForm(setPaymentForm)} />
                <button type="submit" className="primary-action span-2">
                  <CheckCircle2 size={17} />
                  Record Payment
                </button>
              </form>
            </section>
          </div>

          <section className="panel">
            <PanelTitle icon={WalletCards} title="Supplier Invoices" />
            <DataTable
              columns={['Invoice', 'Supplier', 'PO', 'GRN', 'Status', 'Total', 'Balance', 'Actions']}
              rows={visibleInvoices.map((invoice) => [
                invoice.invoice_number,
                invoice.supplier?.name || '',
                invoice.purchase_order?.po_number || '',
                invoice.goods_receipt?.grn_number || '',
                <Badge key="status" value={invoice.status} />,
                money(invoice.total_amount),
                money(invoice.balance_due),
                <div key="actions" className="row-actions">
                  {invoice.status === 'submitted' && (
                    <>
                      <button type="button" className="table-action" onClick={() => runAction(() => api.approveSupplierInvoice(invoice.id, { decision: 'approved' }), 'Supplier invoice approved.')}>
                        Finance Approve
                      </button>
                      <button type="button" className="table-action danger" onClick={() => runAction(() => api.approveSupplierInvoice(invoice.id, { decision: 'rejected' }), 'Supplier invoice rejected.')}>
                        Reject
                      </button>
                    </>
                  )}
                </div>,
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'suppliers' && (
        <section className="panel">
          <PanelTitle icon={Users} title="Supplier Management" />
          <div className="supplier-card-grid">
            {(supplierProfiles.length ? supplierProfiles : suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, rating: supplier.rating || 0, orders: 0, total_spend: 0, on_time_delivery: 0, late_deliveries: 0, open_pos: 0, outstanding_invoices: 0 }))).map((profile) => (
              <article key={profile.id} className="supplier-card">
                <header>
                  <strong>{profile.name}</strong>
                  <span>{ratingStars(profile.rating)}</span>
                </header>
                <div className="supplier-metrics">
                  <span>Rating <strong>{Number(profile.rating || 0).toFixed(1)}</strong></span>
                  <span>Orders <strong>{profile.orders || 0}</strong></span>
                  <span>Total Spend <strong>{money(profile.total_spend)}</strong></span>
                  <span>On-Time Delivery <strong>{profile.on_time_delivery || 0}%</strong></span>
                  <span>Late Deliveries <strong>{profile.late_deliveries || 0}</strong></span>
                  <span>Open POs <strong>{profile.open_pos || 0}</strong></span>
                  <span>Outstanding Invoices <strong>{profile.outstanding_invoices || 0}</strong></span>
                </div>
              </article>
            ))}
          </div>
          <DataTable
            columns={['Supplier', 'Rating', 'Orders', 'Total Spend', 'On-Time Delivery', 'Open POs', 'Outstanding Invoices']}
            rows={suppliers.map((supplier) => [
              supplier.name,
              Number(supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.rating || supplier.rating || 0).toFixed(1),
              supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.orders || 0,
              money(supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.total_spend || 0),
              `${supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.on_time_delivery || 0}%`,
              supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.open_pos || 0,
              supplierProfiles.find((profile) => Number(profile.id) === Number(supplier.id))?.outstanding_invoices || 0,
            ])}
          />
        </section>
      )}

      {activeTab === 'contracts' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Handshake} title="Supplier Contract" />
            <form className="form-grid two" onSubmit={submitSupplierContract}>
              <Select label="Supplier" name="supplier_id" value={contractForm.supplier_id} onChange={setForm(setContractForm)} required>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              <Select label="Project" name="project_id" value={contractForm.project_id} onChange={setForm(setContractForm)}>
                <option value="">Company-wide</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              <Field label="Contract Title" name="title" value={contractForm.title} onChange={setForm(setContractForm)} required />
              <Field label="Contract Value" type="number" min="0" step="0.01" name="contract_value" value={contractForm.contract_value} onChange={setForm(setContractForm)} />
              <Field label="Start Date" type="date" name="start_date" value={contractForm.start_date} onChange={setForm(setContractForm)} />
              <Field label="End Date" type="date" name="end_date" value={contractForm.end_date} onChange={setForm(setContractForm)} />
              <TextArea className="span-2" label="Terms" name="terms" value={contractForm.terms} onChange={setForm(setContractForm)} />
              <button type="submit" className="primary-action span-2">
                <Handshake size={17} />
                Create Contract
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={Handshake} title="Contracts" />
            <DataTable
              columns={['Contract', 'Supplier', 'Project', 'Value', 'Start', 'End', 'Status']}
              rows={visibleContracts.map((contract) => [
                contract.contract_number || contract.title,
                contract.supplier?.name || '',
                contract.project?.name || 'Company-wide',
                money(contract.contract_value),
                shortDate(contract.start_date),
                shortDate(contract.end_date),
                <Badge key="status" value={contract.status} />,
              ])}
            />
          </section>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Download} title="Lifecycle Report" />
            <div className="panel-toolbar">
              <DownloadButton filename="procurement-lifecycle-report.csv" columns={traceabilityColumns} rows={traceabilityRows} />
            </div>
            <DataTable columns={traceabilityColumns} rows={traceabilityRows} />
          </section>

          <section className="panel">
            <PanelTitle icon={Download} title="Spend & Invoice Reports" />
            <div className="panel-toolbar">
              <DownloadButton filename="procurement-purchase-orders.csv" columns={poReportColumns} rows={poReportRows} label="PO CSV" />
              <DownloadButton filename="procurement-supplier-invoices.csv" columns={invoiceReportColumns} rows={invoiceReportRows} label="Invoice CSV" />
            </div>
            <DataTable columns={invoiceReportColumns} rows={invoiceReportRows} />
          </section>
        </div>
      )}

      {activeTab === 'settings' && (
        <section className="panel">
          <PanelTitle icon={Settings} title="Procurement Settings" />
          <MiniList
            items={[
              `Base currency: ${procurement.settings?.base_currency || 'GHS'}`,
              `Approval thresholds: ${Object.keys(procurement.settings?.approval_thresholds || {}).length || 0} configured`,
              `Traceability records: ${visibleTraceability.length}`,
              `Open supplier contracts: ${visibleContracts.filter((contract) => contract.status === 'active').length}`,
            ]}
          />
        </section>
      )}
    </section>
  )
}

function ApprovalWorkflowPanel({ workflow = [] }) {
  return (
    <div className="workflow-steps">
      {workflow.map((step) => (
        <div key={step.key || step.label} className={`workflow-step ${step.status || 'waiting'}`}>
          <span>{workflowStatusSymbol(step.status)}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{labelize(step.status || 'waiting')}{step.acted_by ? ` by ${step.acted_by}` : ''}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelinePanel({ items = [] }) {
  return (
    <div className="timeline-list">
      {items.length === 0 ? (
        <span>No timeline events yet</span>
      ) : (
        items.map((item, index) => (
          <div key={`${item.occurred_at}-${index}`} className="timeline-item">
            <time>{timelineTime(item.occurred_at)}</time>
            <div>
              <strong>{item.label}</strong>
              {item.actor && <small>{item.actor}</small>}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function InventoryView({
  branches,
  suppliers,
  inventory,
  forms,
  setInventoryForm,
  setInventoryForms,
  createWarehouse,
  createInventoryItem,
  createStockMovement,
  createSupplierPrice,
  createSupplierReview,
  runAction,
}) {
  const [editingWarehouseId, setEditingWarehouseId] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)

  function saveWarehouse(event) {
    if (!editingWarehouseId) {
      createWarehouse(event)
      return
    }

    event.preventDefault()

    runAction(
      () =>
        api.updateWarehouse(editingWarehouseId, {
          ...forms.warehouse,
          branch_id: Number(forms.warehouse.branch_id || branches[0]?.id || 0),
        }),
      'Warehouse updated.',
    ).then(() => {
      setEditingWarehouseId(null)
      setInventoryForms((current) => ({
        ...current,
        warehouse: { branch_id: forms.warehouse.branch_id || branches[0]?.id || '', code: '', name: '', location: '' },
      }))
    })
  }

  function editWarehouse(warehouse) {
    setEditingWarehouseId(warehouse.id)
    setInventoryForms((current) => ({
      ...current,
      warehouse: {
        branch_id: warehouse.branch_id || warehouse.branch?.id || branches[0]?.id || '',
        code: warehouse.code || '',
        name: warehouse.name || '',
        location: warehouse.location || '',
      },
    }))
  }

  function cancelWarehouseEdit() {
    setEditingWarehouseId(null)
    setInventoryForms((current) => ({
      ...current,
      warehouse: { branch_id: forms.warehouse.branch_id || branches[0]?.id || '', code: '', name: '', location: '' },
    }))
  }

  function archiveWarehouse(warehouse) {
    if (!window.confirm(`Archive warehouse ${warehouse.code || warehouse.name}?`)) {
      return
    }

    runAction(() => api.deleteWarehouse(warehouse.id), 'Warehouse archived.').then(() => {
      if (editingWarehouseId === warehouse.id) {
        cancelWarehouseEdit()
      }
    })
  }

  function saveInventoryItem(event) {
    if (!editingItemId) {
      createInventoryItem(event)
      return
    }

    event.preventDefault()

    runAction(
      () =>
        api.updateInventoryItem(editingItemId, {
          ...forms.item,
          reorder_level: Number(forms.item.reorder_level || 0),
          average_cost: Number(forms.item.average_cost || 0),
        }),
      'Inventory item updated.',
    ).then(() => {
      setEditingItemId(null)
      setInventoryForms((current) => ({ ...current, item: emptyInventoryForms.item }))
    })
  }

  function editInventoryItem(item) {
    setEditingItemId(item.id)
    setInventoryForms((current) => ({
      ...current,
      item: {
        sku: item.sku || '',
        name: item.name || '',
        category: item.category || 'materials',
        unit: item.unit || 'each',
        reorder_level: item.reorder_level ?? 0,
        average_cost: item.average_cost ?? '',
      },
    }))
  }

  function cancelInventoryItemEdit() {
    setEditingItemId(null)
    setInventoryForms((current) => ({ ...current, item: emptyInventoryForms.item }))
  }

  function archiveInventoryItem(item) {
    if (!window.confirm(`Archive stock item ${item.sku || item.name}?`)) {
      return
    }

    runAction(() => api.deleteInventoryItem(item.id), 'Inventory item archived.').then(() => {
      if (editingItemId === item.id) {
        cancelInventoryItemEdit()
      }
    })
  }

  return (
    <section className="view-stack">
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Package} title={editingWarehouseId ? 'Edit Warehouse' : 'Warehouses & Items'} />
          <form className="form-grid two" onSubmit={saveWarehouse}>
            <Select label="Branch" name="branch_id" value={forms.warehouse.branch_id} onChange={setInventoryForm('warehouse')} required>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Field label="Warehouse Code" name="code" value={forms.warehouse.code} onChange={setInventoryForm('warehouse')} placeholder="Auto-generated" />
            <Field label="Name" name="name" value={forms.warehouse.name} onChange={setInventoryForm('warehouse')} required />
            <Field label="Location" name="location" value={forms.warehouse.location} onChange={setInventoryForm('warehouse')} />
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {editingWarehouseId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {editingWarehouseId ? 'Save warehouse' : 'Add warehouse'}
              </button>
              {editingWarehouseId && (
                <button type="button" className="table-action" onClick={cancelWarehouseEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <form className="form-grid two section-form" onSubmit={saveInventoryItem}>
            <Field label="Stock Keeping Unit (SKU)" name="sku" value={forms.item.sku} onChange={setInventoryForm('item')} placeholder="Auto-generated, e.g. CEM-000001" />
            <Field label="Item" name="name" value={forms.item.name} onChange={setInventoryForm('item')} required />
            <Field label="Category" name="category" value={forms.item.category} onChange={setInventoryForm('item')} placeholder="Cement" />
            <Field label="Unit" name="unit" value={forms.item.unit} onChange={setInventoryForm('item')} />
            <Field label="Reorder level" type="number" name="reorder_level" value={forms.item.reorder_level} onChange={setInventoryForm('item')} />
            <Field label="Average cost" type="number" name="average_cost" value={forms.item.average_cost} onChange={setInventoryForm('item')} />
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {editingItemId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {editingItemId ? 'Save item' : 'Add item'}
              </button>
              {editingItemId && (
                <button type="button" className="table-action" onClick={cancelInventoryItemEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Truck} title="Stock Movement" />
          <form className="form-grid two" onSubmit={createStockMovement}>
            <Select label="Warehouse" name="warehouse_id" value={forms.movement.warehouse_id} onChange={setInventoryForm('movement')} required>
              <option value="">Select</option>
              {(inventory.warehouses || []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </Select>
            <Select label="Item" name="inventory_item_id" value={forms.movement.inventory_item_id} onChange={setInventoryForm('movement')} required>
              <option value="">Select</option>
              {(inventory.items || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.name}
                </option>
              ))}
            </Select>
            <Select label="Type" name="type" value={forms.movement.type} onChange={setInventoryForm('movement')}>
              <option value="receipt">Receipt</option>
              <option value="issue">Issue</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
            </Select>
            <Select label="To warehouse" name="to_warehouse_id" value={forms.movement.to_warehouse_id} onChange={setInventoryForm('movement')}>
              <option value="">None</option>
              {(inventory.warehouses || []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code}
                </option>
              ))}
            </Select>
            <Field label="Qty" type="number" name="quantity" value={forms.movement.quantity} onChange={setInventoryForm('movement')} required />
            <Field label="Unit cost" type="number" name="unit_cost" value={forms.movement.unit_cost} onChange={setInventoryForm('movement')} />
            <Field className="span-2" label="Reason" name="reason" value={forms.movement.reason} onChange={setInventoryForm('movement')} />
            <button type="submit" className="primary-action span-2">
              <Send size={17} />
              Record movement
            </button>
          </form>
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Building2} title="Warehouses" />
          <DataTable
            columns={['Code', 'Warehouse', 'Branch', 'Location', 'Actions']}
            rows={(inventory.warehouses || []).map((warehouse) => [
              warehouse.code,
              warehouse.name,
              warehouse.branch?.name || '',
              warehouse.location || '',
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editWarehouse(warehouse)}>
                  Edit
                </button>
                <button type="button" className="table-action danger" onClick={() => archiveWarehouse(warehouse)}>
                  Archive
                </button>
              </div>,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Package} title="Stock Levels" />
          <DataTable
            columns={['Stock Keeping Unit (SKU)', 'Item', 'Category', 'On hand', 'Reorder', 'Avg cost', 'Actions']}
            rows={(inventory.items || []).map((item) => [
              item.sku,
              item.name,
              labelize(item.category),
              `${item.quantity_on_hand} ${item.unit}`,
              `${item.reorder_level} ${item.unit}`,
              money(item.average_cost),
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => editInventoryItem(item)}>
                  Edit
                </button>
                <button type="button" className="table-action danger" onClick={() => archiveInventoryItem(item)}>
                  Archive
                </button>
              </div>,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Reorder Alerts" />
          <DataTable
            columns={['Stock Keeping Unit (SKU)', 'Item', 'On hand', 'Reorder']}
            rows={(inventory.reorder_alerts || []).map((item) => [
              item.sku,
              item.name,
              `${item.quantity_on_hand} ${item.unit}`,
              `${item.reorder_level} ${item.unit}`,
            ])}
          />
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Truck} title="Supplier Management" />
        <div className="grid-main tight">
          <form className="form-grid two" onSubmit={createSupplierPrice}>
            <Select label="Supplier" name="supplier_id" value={forms.supplierPrice.supplier_id} onChange={setInventoryForm('supplierPrice')} required>
              <option value="">Select</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            <Select label="Inventory item" name="inventory_item_id" value={forms.supplierPrice.inventory_item_id} onChange={setInventoryForm('supplierPrice')}>
              <option value="">None</option>
              {(inventory.items || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Field label="Description" name="description" value={forms.supplierPrice.description} onChange={setInventoryForm('supplierPrice')} required />
            <Field label="Unit price" type="number" name="unit_price" value={forms.supplierPrice.unit_price} onChange={setInventoryForm('supplierPrice')} required />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Add supplier price
            </button>
          </form>

          <form className="form-grid two" onSubmit={createSupplierReview}>
            <Select label="Supplier" name="supplier_id" value={forms.supplierReview.supplier_id} onChange={setInventoryForm('supplierReview')} required>
              <option value="">Select</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            <Field label="Rating" type="number" min="1" max="5" name="rating" value={forms.supplierReview.rating} onChange={setInventoryForm('supplierReview')} />
            <Field label="Quality" type="number" min="1" max="5" name="quality_score" value={forms.supplierReview.quality_score} onChange={setInventoryForm('supplierReview')} />
            <Field label="Delivery" type="number" min="1" max="5" name="delivery_score" value={forms.supplierReview.delivery_score} onChange={setInventoryForm('supplierReview')} />
            <Field className="span-2" label="Notes" name="notes" value={forms.supplierReview.notes} onChange={setInventoryForm('supplierReview')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Add review
            </button>
          </form>
        </div>
      </section>
    </section>
  )
}

function FieldOpsView({
  projects,
  fieldOps,
  forms,
  setFieldForm,
  setFieldForms,
  createDailyReport,
  createFieldIssue,
  clockIn,
  clockOut,
  runAction,
}) {
  const [editingIssueId, setEditingIssueId] = useState(null)
  const dailyReportColumns = ['No.', 'Project', 'Report date', 'Shift', 'Status', 'Labour', 'Weather', 'Progress notes', 'Safety notes']
  const dailyReportRows = (fieldOps.daily_reports || []).map((report) => [
    report.report_number || '',
    report.project?.name || '',
    shortDate(report.report_date),
    labelize(report.shift || ''),
    labelize(report.status || ''),
    report.labour_count || 0,
    report.weather || '',
    report.progress_notes || '',
    report.safety_notes || '',
  ])

  function saveFieldIssue(event) {
    if (!editingIssueId) {
      createFieldIssue(event)
      return
    }

    event.preventDefault()
    const form = forms.issue

    runAction(
      () =>
        api.updateFieldIssue(editingIssueId, {
          title: form.title,
          description: form.description || null,
          category: form.category,
          severity: form.severity,
          status: form.status || 'open',
          due_date: form.due_date || null,
        }),
      'Site issue updated.',
    ).then(() => {
      setEditingIssueId(null)
      setFieldForms((current) => ({ ...current, issue: emptyFieldForms.issue }))
    })
  }

  function editFieldIssue(issue) {
    setEditingIssueId(issue.id)
    setFieldForms((current) => ({
      ...current,
      issue: {
        project_id: issue.project_id || issue.project?.id || '',
        title: issue.title || '',
        category: issue.category || 'blocker',
        severity: issue.severity || 'medium',
        status: issue.status || 'open',
        description: issue.description || '',
        due_date: dateInputValue(issue.due_date),
      },
    }))
  }

  function cancelFieldIssueEdit() {
    setEditingIssueId(null)
    setFieldForms((current) => ({ ...current, issue: emptyFieldForms.issue }))
  }

  function archiveFieldIssue(issue) {
    if (!window.confirm(`Archive site issue ${issue.title}?`)) {
      return
    }

    runAction(() => api.deleteFieldIssue(issue.id), 'Site issue archived.').then(() => {
      if (editingIssueId === issue.id) {
        cancelFieldIssueEdit()
      }
    })
  }

  return (
    <section className="view-stack">
      <div className="kpi-grid">
        <Kpi icon={ClipboardList} label="Daily reports" value={fieldOps.daily_reports?.length || 0} sub="Recent reports" />
        <Kpi icon={AlertTriangle} label="Open issues" value={(fieldOps.issues || []).filter((issue) => !['resolved', 'closed'].includes(issue.status)).length} sub="Site blockers" />
        <Kpi icon={Clock3} label="Clocked in" value={(fieldOps.attendance || []).filter((item) => item.status === 'open').length} sub="Open attendance" />
        <Kpi icon={MapPinned} label="Site mode" value="Web" sub="Responsive browser app" />
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Daily Site Diary" />
          <form className="form-grid two" onSubmit={createDailyReport}>
            <Select label="Project" name="project_id" value={forms.dailyReport.project_id} onChange={setFieldForm('dailyReport')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Date" type="date" name="report_date" value={forms.dailyReport.report_date} onChange={setFieldForm('dailyReport')} required />
            <Field label="Weather" name="weather" value={forms.dailyReport.weather} onChange={setFieldForm('dailyReport')} />
            <Field label="Labour count" type="number" name="labour_count" value={forms.dailyReport.labour_count} onChange={setFieldForm('dailyReport')} />
            <Field className="span-2" label="Progress notes" name="progress_notes" value={forms.dailyReport.progress_notes} onChange={setFieldForm('dailyReport')} />
            <Field className="span-2" label="Safety notes" name="safety_notes" value={forms.dailyReport.safety_notes} onChange={setFieldForm('dailyReport')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Create report
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={AlertTriangle} title={editingIssueId ? 'Edit Issue' : 'Issue Log'} />
          <form className="form-grid two" onSubmit={saveFieldIssue}>
            <Select label="Project" name="project_id" value={forms.issue.project_id} onChange={setFieldForm('issue')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Title" name="title" value={forms.issue.title} onChange={setFieldForm('issue')} required />
            <Select label="Category" name="category" value={forms.issue.category} onChange={setFieldForm('issue')}>
              <option value="blocker">Blocker</option>
              <option value="quality">Quality</option>
              <option value="safety">Safety</option>
              <option value="material">Material</option>
              <option value="design">Design</option>
            </Select>
            <Select label="Severity" name="severity" value={forms.issue.severity} onChange={setFieldForm('issue')}>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Select label="Status" name="status" value={forms.issue.status || 'open'} onChange={setFieldForm('issue')}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
            <Field label="Due" type="date" name="due_date" value={forms.issue.due_date || ''} onChange={setFieldForm('issue')} />
            <Field className="span-2" label="Description" name="description" value={forms.issue.description} onChange={setFieldForm('issue')} />
            <label className="field span-2">
              <span>Photo</span>
              <input type="file" name="photo" onChange={(event) => setFieldForms((current) => ({ ...current, issue: { ...current.issue, photo: event.target.files[0] } }))} />
            </label>
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {editingIssueId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {editingIssueId ? 'Save issue' : 'Log issue'}
              </button>
              {editingIssueId && (
                <button type="button" className="table-action" onClick={cancelFieldIssueEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Clock3} title="Time & Attendance" />
        <form className="inline-form" onSubmit={fieldOps.open_attendance ? clockOut : clockIn}>
          <Select label="Project" name="project_id" value={forms.clock.project_id} onChange={setFieldForm('clock')}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Field label="Latitude" name={fieldOps.open_attendance ? 'clock_out_latitude' : 'clock_in_latitude'} value={fieldOps.open_attendance ? forms.clock.clock_out_latitude : forms.clock.clock_in_latitude} onChange={setFieldForm('clock')} />
          <Field label="Longitude" name={fieldOps.open_attendance ? 'clock_out_longitude' : 'clock_in_longitude'} value={fieldOps.open_attendance ? forms.clock.clock_out_longitude : forms.clock.clock_in_longitude} onChange={setFieldForm('clock')} />
          <label className="field compact-file">
            <span>Face check</span>
            <input type="file" accept="image/*" capture="user" onChange={(event) => setFieldForms((current) => ({ ...current, clock: { ...current.clock, face: event.target.files[0] } }))} />
          </label>
          <button type="submit" className="primary-action">
            <Clock3 size={17} />
            {fieldOps.open_attendance ? 'Clock out' : 'Clock in'}
          </button>
        </form>
        <DataTable
          columns={['Person', 'Status', 'Clock in', 'Clock out', 'Minutes']}
          rows={(fieldOps.attendance || []).map((record) => [
            record.user?.name || '',
            <Badge key="status" value={record.status} />,
            shortDate(record.clock_in_at),
            shortDate(record.clock_out_at),
            record.total_minutes,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={MapPinned} title="Recent Site Records" />
        <div className="panel-toolbar">
          <DownloadButton filename="site-management-daily-reports.csv" columns={dailyReportColumns} rows={dailyReportRows} />
        </div>
        <DataTable
          columns={['Project', 'Report date', 'Status', 'Labour', 'Weather', 'Action']}
          rows={(fieldOps.daily_reports || []).map((report, index) => [
            report.project?.name,
            shortDate(report.report_date),
            <Badge key="status" value={report.status} />,
            report.labour_count,
            report.weather || '',
            <div key="actions" className="row-actions">
              {report.status === 'draft' && (
                <button type="button" className="table-action" onClick={() => runAction(() => api.transitionDailyReport(report.id, 'submitted'), 'Daily report submitted.')}>
                  Submit
                </button>
              )}
              {report.status === 'submitted' && (
                <button type="button" className="table-action" onClick={() => runAction(() => api.transitionDailyReport(report.id, 'approved'), 'Daily report approved.')}>
                  Approve
                </button>
              )}
              <DownloadButton filename={`${report.report_number || `daily-report-${report.id}`}.csv`} columns={dailyReportColumns} rows={[dailyReportRows[index]]} label="CSV" />
            </div>,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={AlertTriangle} title="Open Issues" />
        <DataTable
          columns={['Project', 'Title', 'Category', 'Severity', 'Status', 'Action']}
          rows={(fieldOps.issues || []).map((issue) => [
            issue.project?.name,
            issue.title,
            labelize(issue.category),
            <Badge key="severity" value={issue.severity} />,
            <Badge key="status" value={issue.status} />,
            <div key="actions" className="row-actions">
              <button type="button" className="table-action" onClick={() => editFieldIssue(issue)}>
                Edit
              </button>
              {!['resolved', 'closed'].includes(issue.status) && (
                <button type="button" className="table-action" onClick={() => runAction(() => api.updateFieldIssue(issue.id, { status: 'resolved' }), 'Issue resolved.')}>
                  Resolve
                </button>
              )}
              <button type="button" className="table-action danger" onClick={() => archiveFieldIssue(issue)}>
                Archive
              </button>
            </div>,
          ])}
        />
      </section>
    </section>
  )
}

function FinanceView({
  branches,
  projects,
  clients,
  suppliers,
  finance,
  forms,
  setFinanceForm,
  setFinanceForms,
  createInvoice,
  recordPayment,
  createExpense,
  createJournalEntry,
  uploadFinanceWorkbook,
  runAction,
}) {
  const openInvoices = (finance.invoices || []).filter((invoice) => invoice.status !== 'draft' && invoice.payment_status !== 'paid')
  const issuedInvoices = (finance.invoices || []).filter((invoice) => !['draft', 'void'].includes(invoice.status))
  const bankAccounts = finance.bank_accounts || []
  const financeWorkbooks = finance.workbooks || []
  const accountRows = finance.chart_of_accounts?.accounts || []
  const ledgerRows = finance.general_ledger?.entries || []
  const payableInvoices = [
    ...(finance.accounts_payable?.blocked_invoices || []),
    ...(finance.accounts_payable?.due_this_week || []),
  ].filter((invoice, index, list) => list.findIndex((item) => item.id === invoice.id) === index)
  const aging = finance.accounts_receivable?.aging || {}
  const payableAging = finance.accounts_payable?.aging || {}
  const tabs = [
    ['dashboard', 'Dashboard', BarChart3],
    ['ar', 'Accounts Receivable', WalletCards],
    ['ap', 'Accounts Payable', Truck],
    ['customers', 'Customers', Users],
    ['suppliers', 'Suppliers', Truck],
    ['invoices', 'Invoices', FileText],
    ['credit-notes', 'Credit Notes', FileText],
    ['payments', 'Payments', CheckCircle2],
    ['expenses', 'Expenses', ClipboardList],
    ['budgets', 'Budgets', Calculator],
    ['cash-flow', 'Cash Flow', BarChart3],
    ['bank-accounts', 'Bank Accounts', WalletCards],
    ['bank-reconciliation', 'Bank Reconciliation', RefreshCcw],
    ['workbooks', 'Workbook Imports', Upload],
    ['chart-of-accounts', 'Chart of Accounts', Layers3],
    ['general-ledger', 'General Ledger', FileText],
    ['journal-entries', 'Journal Entries', Send],
    ['cost-centers', 'Cost Centers', FolderKanban],
    ['fixed-assets', 'Fixed Assets', Truck],
    ['payroll', 'Payroll Integration', Users],
    ['taxes', 'Taxes', Calculator],
    ['retentions', 'Retentions', ShieldCheck],
    ['progress-billing', 'Progress Billing', CalendarDays],
    ['reports', 'Financial Reports', Download],
    ['approvals', 'Approvals', CheckCircle2],
    ['audit-trail', 'Audit Trail', Clock3],
    ['automation', 'Automation', Workflow],
    ['settings', 'Finance Settings', Settings],
  ]
  const [activeTab, setActiveTab] = useState('dashboard')

  const resetFinanceSection = (section, overrides = {}) => {
    setFinanceForms((current) => ({ ...current, [section]: { ...emptyFinanceForms[section], ...overrides } }))
  }

  const submitFinanceForm = async (event, section, action, payloadBuilder, message, overrides = {}) => {
    event.preventDefault()
    const result = await runAction(() => action(payloadBuilder(forms[section])), message)
    if (result) {
      resetFinanceSection(section, overrides)
    }
  }

  const cleanPayload = (payload) =>
    Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined))

  const idOrNull = (value) => (value ? Number(value) : null)
  const num = (value) => Number(value || 0)
  const reportRows = (items = [], keys = []) => (items || []).map((item) => keys.map((key) => item?.[key] ?? ''))
  const setWorkbookFile = (event) => {
    const file = event.target.files?.[0] || null
    setFinanceForms((current) => ({ ...current, workbook: { ...current.workbook, file } }))
  }

  return (
    <section className="view-stack">
      <nav className="module-tabs" aria-label="Finance module navigation">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Cash Balance" value={money(finance.summary?.cash_balance)} sub="Bank and cash accounts" />
            <Kpi icon={FileText} label="Accounts Receivable" value={money(finance.summary?.accounts_receivable)} sub={`${money(finance.summary?.overdue)} overdue`} />
            <Kpi icon={Truck} label="Accounts Payable" value={money(finance.summary?.accounts_payable)} sub={`${money(finance.summary?.upcoming_payments)} due soon`} />
            <Kpi icon={BarChart3} label="Revenue This Month" value={money(finance.summary?.revenue_this_month)} sub={`${money(finance.summary?.profit)} profit`} />
            <Kpi icon={ClipboardList} label="Expenses This Month" value={money(finance.summary?.expenses_this_month)} sub={`${money(finance.summary?.approved_expenses)} approved total`} />
            <Kpi icon={RefreshCcw} label="Cash Flow" value={money(finance.summary?.cash_flow)} sub="Net movement this month" />
            <Kpi icon={Calculator} label="Budget Utilization" value={`${finance.summary?.budget_utilization || 0}%`} sub="Actual plus committed" />
            <Kpi icon={ShieldCheck} label="Retention Held" value={money(finance.summary?.retention_held)} sub="Client and supplier balances" />
            <Kpi icon={Calculator} label="Taxes Payable" value={money(finance.summary?.taxes_payable)} sub="Sales, purchase, payroll tax" />
            <Kpi icon={Users} label="Payroll" value={money(finance.summary?.payroll)} sub="Draft and approved runs" />
            <Kpi icon={Truck} label="Open POs" value={money(finance.summary?.outstanding_purchase_orders)} sub="Approved commitments" />
            <Kpi icon={FileText} label="Outstanding Invoices" value={money(finance.summary?.outstanding_invoices)} sub="Uncollected client billing" />
          </div>

          <div className="grid-main">
            <ChartPanel icon={BarChart3} title="Cash Flow Forecast">
              <AnalyticsBarChart data={finance.cash_flow?.forecast || []} xKey="period" bars={[{ key: 'inflows' }, { key: 'outflows' }, { key: 'net' }]} />
            </ChartPanel>
            <ChartPanel icon={Calculator} title="Budget Variance">
              <AnalyticsBarChart data={finance.budgets?.by_project || []} xKey="project" bars={[{ key: 'budget' }, { key: 'actual' }, { key: 'committed' }]} />
            </ChartPanel>
          </div>

          <section className="panel">
            <PanelTitle icon={BarChart3} title="Project Profitability" />
            <DataTable
              columns={['Project', 'Client', 'Contract', 'Revenue', 'Cost', 'Profit', 'Margin']}
              rows={(finance.financial_reports?.project_profitability || []).map((row) => [
                row.project,
                row.client || '',
                money(row.contract_value),
                money(row.recognized_revenue),
                money(row.cost),
                money(row.profit),
                `${row.margin_percent || 0}%`,
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'ar' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Current" value={money(aging.current)} sub="Not yet overdue" />
            <Kpi icon={Clock3} label="30 Days" value={money(aging['30_days'])} sub="Receivable aging" />
            <Kpi icon={Clock3} label="60 Days" value={money(aging['60_days'])} sub="Collection pressure" />
            <Kpi icon={AlertTriangle} label="120+ Days" value={money(aging['120_plus_days'])} sub="Critical collections" />
          </div>
          <section className="panel">
            <PanelTitle icon={Users} title="Customer Aging" />
            <div className="panel-toolbar">
              <DownloadButton filename="accounts-receivable-aging.csv" columns={['Client', 'Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days']} rows={(finance.accounts_receivable?.customers || []).map((row) => [row.client, row.outstanding, row.aging?.current, row.aging?.['30_days'], row.aging?.['60_days'], row.aging?.['90_days'], row.aging?.['120_plus_days']])} />
            </div>
            <DataTable columns={['Client', 'Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days']} rows={(finance.accounts_receivable?.customers || []).map((row) => [row.client, money(row.outstanding), money(row.aging?.current), money(row.aging?.['30_days']), money(row.aging?.['60_days']), money(row.aging?.['90_days']), money(row.aging?.['120_plus_days'])])} />
          </section>
          <section className="panel">
            <PanelTitle icon={FileText} title="Collections" />
            <DataTable columns={['Invoice', 'Client', 'Project', 'Due', 'Balance']} rows={(finance.accounts_receivable?.collections || []).map((invoice) => [invoice.invoice_number, invoice.client?.name || '', invoice.project?.name || '', shortDate(invoice.due_date), money(invoice.balance_due)])} />
          </section>
        </>
      )}

      {activeTab === 'ap' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Current" value={money(payableAging.current)} sub="Not yet due" />
            <Kpi icon={Clock3} label="30 Days" value={money(payableAging['30_days'])} sub="Supplier aging" />
            <Kpi icon={Clock3} label="60 Days" value={money(payableAging['60_days'])} sub="Payment pressure" />
            <Kpi icon={AlertTriangle} label="120+ Days" value={money(payableAging['120_plus_days'])} sub="Critical payables" />
          </div>
          <section className="panel">
            <PanelTitle icon={Truck} title="Supplier Aging" />
            <div className="panel-toolbar">
              <DownloadButton filename="accounts-payable-aging.csv" columns={['Supplier', 'Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days']} rows={(finance.accounts_payable?.suppliers || []).map((row) => [row.supplier, row.outstanding, row.aging?.current, row.aging?.['30_days'], row.aging?.['60_days'], row.aging?.['90_days'], row.aging?.['120_plus_days']])} />
            </div>
            <DataTable columns={['Supplier', 'Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days']} rows={(finance.accounts_payable?.suppliers || []).map((row) => [row.supplier, money(row.outstanding), money(row.aging?.current), money(row.aging?.['30_days']), money(row.aging?.['60_days']), money(row.aging?.['90_days']), money(row.aging?.['120_plus_days'])])} />
          </section>
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Due This Week" />
            <DataTable columns={['Invoice', 'Supplier', 'PO', 'Due', 'Balance', 'Status']} rows={(finance.accounts_payable?.due_this_week || []).map((invoice) => [invoice.invoice_number, invoice.supplier?.name || '', invoice.purchase_order?.po_number || '', shortDate(invoice.due_date), money(invoice.balance_due), <Badge key="status" value={invoice.status} />])} />
          </section>
        </>
      )}

      {activeTab === 'customers' && (
        <section className="panel">
          <PanelTitle icon={Users} title="Customers" />
          <DataTable columns={['Customer', 'Type', 'Contact', 'Email', 'Currency', 'Status']} rows={(finance.customers || clients).map((client) => [client.name, labelize(client.type || ''), client.contact_name || '', client.email || '', client.currency || '', <Badge key="status" value={client.status} />])} />
        </section>
      )}

      {activeTab === 'suppliers' && (
        <section className="panel">
          <PanelTitle icon={Truck} title="Suppliers" />
          <DataTable columns={['Supplier', 'Contact', 'Email', 'Currency', 'Rating', 'Status']} rows={(finance.suppliers || suppliers).map((supplier) => [supplier.name, supplier.contact_name || '', supplier.email || '', supplier.currency || '', supplier.rating || '', <Badge key="status" value={supplier.status} />])} />
        </section>
      )}

      {activeTab === 'invoices' && (
        <>
          <section className="panel">
            <PanelTitle icon={Plus} title="New Invoice" />
            <form className="form-grid two" onSubmit={createInvoice}>
              <Select label="Project" name="project_id" value={forms.invoice.project_id} onChange={setFinanceForm('invoice')}>
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <Select label="Client" name="client_id" value={forms.invoice.client_id} onChange={setFinanceForm('invoice')}>
                <option value="">Project client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </Select>
              <Field label="Title" name="title" value={forms.invoice.title} onChange={setFinanceForm('invoice')} required />
              <Field label="Due date" type="date" name="due_date" value={forms.invoice.due_date} onChange={setFinanceForm('invoice')} />
              <Field label="Retention %" type="number" step="0.01" name="retention_percent" value={forms.invoice.retention_percent} onChange={setFinanceForm('invoice')} />
              <Field label="Progress %" type="number" step="0.01" name="progress_percent" value={forms.invoice.progress_percent} onChange={setFinanceForm('invoice')} />
              <Field label="Billing stage" name="billing_stage" value={forms.invoice.billing_stage} onChange={setFinanceForm('invoice')} />
              <Field label="Line item" name="line_description" value={forms.invoice.line_description} onChange={setFinanceForm('invoice')} required />
              <Field label="Cost Code" name="cost_code" value={forms.invoice.cost_code} onChange={setFinanceForm('invoice')} placeholder="Auto-generated" />
              <Field label="Qty" type="number" step="0.01" name="quantity" value={forms.invoice.quantity} onChange={setFinanceForm('invoice')} required />
              <Field label="Unit price" type="number" step="0.01" name="unit_price" value={forms.invoice.unit_price} onChange={setFinanceForm('invoice')} required />
              <Field label="Tax %" type="number" step="0.01" name="tax_rate" value={forms.invoice.tax_rate} onChange={setFinanceForm('invoice')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Create invoice</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={FileText} title="Invoices" />
            <div className="panel-toolbar">
              <DownloadButton filename="invoices.csv" columns={['No.', 'Client', 'Project', 'Status', 'Payment', 'Total', 'Retention', 'Credit', 'Balance']} rows={(finance.invoices || []).map((invoice) => [invoice.invoice_number, invoice.client?.name || '', invoice.project?.name || '', invoice.status, invoice.payment_status, invoice.total_amount, invoice.retention_amount, invoice.credit_note_amount, invoice.balance_due])} />
            </div>
            <DataTable columns={['No.', 'Client', 'Project', 'Status', 'Payment', 'Total', 'Retention', 'Balance', 'Action']} rows={(finance.invoices || []).map((invoice) => [invoice.invoice_number, invoice.client?.name || '', invoice.project?.name || '', <Badge key="status" value={invoice.status} />, <Badge key="payment" value={invoice.payment_status} />, money(invoice.total_amount), money(invoice.retention_amount), money(invoice.balance_due), invoice.status === 'draft' ? <button key="issue" type="button" className="table-action" onClick={() => runAction(() => api.issueInvoice(invoice.id), 'Invoice issued.')}>Issue</button> : ''])} />
          </section>
        </>
      )}

      {activeTab === 'credit-notes' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={FileText} title="Credit Note" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'creditNote', api.createFinanceCreditNote, (form) => cleanPayload({ invoice_id: idOrNull(form.invoice_id), amount: num(form.amount), tax_amount: num(form.tax_amount), reason: form.reason }), 'Credit note created.')}>
              <Select label="Invoice" name="invoice_id" value={forms.creditNote.invoice_id} onChange={setFinanceForm('creditNote')} required>
                <option value="">Select</option>
                {issuedInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {money(invoice.balance_due)}</option>)}
              </Select>
              <Field label="Amount" type="number" step="0.01" name="amount" value={forms.creditNote.amount} onChange={setFinanceForm('creditNote')} required />
              <Field label="Tax" type="number" step="0.01" name="tax_amount" value={forms.creditNote.tax_amount} onChange={setFinanceForm('creditNote')} />
              <Field label="Reason" name="reason" value={forms.creditNote.reason} onChange={setFinanceForm('creditNote')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Create credit note</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={FileText} title="Credit Notes" />
            <DataTable columns={['No.', 'Invoice', 'Client', 'Amount', 'Tax', 'Status', 'Issued']} rows={(finance.credit_notes || []).map((note) => [note.credit_note_number, note.invoice?.invoice_number || '', note.client?.name || '', money(note.amount), money(note.tax_amount), <Badge key="status" value={note.status} />, shortDate(note.issue_date)])} />
          </section>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CheckCircle2} title="Payment" />
            <form className="form-grid two" onSubmit={recordPayment}>
              <Select label="Invoice" name="invoice_id" value={forms.payment.invoice_id} onChange={setFinanceForm('payment')} required>
                <option value="">Select</option>
                {openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {money(invoice.balance_due)}</option>)}
              </Select>
              <Select label="Bank Account" name="finance_bank_account_id" value={forms.payment.finance_bank_account_id} onChange={setFinanceForm('payment')}>
                <option value="">Default account</option>
                {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
              </Select>
              <Field label="Amount" type="number" step="0.01" name="amount" value={forms.payment.amount} onChange={setFinanceForm('payment')} required />
              <Select label="Method" name="method" value={forms.payment.method} onChange={setFinanceForm('payment')}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile money</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </Select>
              <Field label="Reference" name="reference" value={forms.payment.reference} onChange={setFinanceForm('payment')} />
              <button type="submit" className="primary-action span-2"><CheckCircle2 size={17} />Record payment</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Payments" />
            <DataTable columns={['No.', 'Invoice', 'Client', 'Bank', 'Method', 'Amount', 'Received']} rows={(finance.payments || []).map((payment) => [payment.payment_number, payment.invoice?.invoice_number || '', payment.client?.name || '', payment.bank_account?.account_name || '', labelize(payment.method), money(payment.amount), shortDate(payment.received_at)])} />
          </section>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Expense" />
            <form className="form-grid two" onSubmit={createExpense}>
              <Select label="Project" name="project_id" value={forms.expense.project_id} onChange={setFinanceForm('expense')}>
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <Select label="Supplier" name="supplier_id" value={forms.expense.supplier_id} onChange={setFinanceForm('expense')}>
                <option value="">None</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </Select>
              <Field label="Description" name="description" value={forms.expense.description} onChange={setFinanceForm('expense')} required />
              <Field label="Category" name="category" value={forms.expense.category} onChange={setFinanceForm('expense')} />
              <Field label="Cost Code" name="cost_code" value={forms.expense.cost_code} onChange={setFinanceForm('expense')} placeholder="Auto-generated" />
              <Field label="Amount" type="number" step="0.01" name="amount" value={forms.expense.amount} onChange={setFinanceForm('expense')} required />
              <Field label="Tax" type="number" step="0.01" name="tax_amount" value={forms.expense.tax_amount} onChange={setFinanceForm('expense')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Submit expense</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Expenses" />
            <DataTable columns={['No.', 'Project', 'Supplier', 'Status', 'Amount', 'Action']} rows={(finance.expenses || []).map((expense) => [expense.expense_number, expense.project?.name || '', expense.supplier?.name || '', <Badge key="status" value={expense.status} />, money(Number(expense.amount) + Number(expense.tax_amount)), expense.status === 'submitted' ? <button key="approve" type="button" className="table-action" onClick={() => runAction(() => api.reviewExpense(expense.id, 'approved'), 'Expense approved.')}>Approve</button> : expense.status === 'approved' ? <button key="pay" type="button" className="table-action" onClick={() => runAction(() => api.reviewExpense(expense.id, 'paid'), 'Expense paid.')}>Mark paid</button> : ''])} />
          </section>
        </div>
      )}

      {activeTab === 'budgets' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={Calculator} label="Budget" value={money(finance.budgets?.summary?.budget)} sub="Approved budget" />
            <Kpi icon={WalletCards} label="Actual" value={money(finance.budgets?.summary?.actual)} sub="Posted cost" />
            <Kpi icon={Truck} label="Committed" value={money(finance.budgets?.summary?.committed)} sub="Open commitments" />
            <Kpi icon={CheckCircle2} label="Remaining" value={money(finance.budgets?.summary?.remaining)} sub={`${money(finance.budgets?.summary?.variance)} variance`} />
          </div>
          <ChartPanel icon={Calculator} title="Budget By Project">
            <AnalyticsBarChart data={finance.budgets?.by_project || []} xKey="project" bars={[{ key: 'budget' }, { key: 'actual' }, { key: 'committed' }, { key: 'remaining' }]} />
          </ChartPanel>
          <section className="panel">
            <PanelTitle icon={Calculator} title="Budget Lines" />
            <DataTable columns={['Cost Code', 'Project', 'Category', 'Budget', 'Actual', 'Committed', 'Forecast']} rows={(finance.budgets?.lines || []).map((line) => [line.cost_code, line.project?.name || '', labelize(line.category), money(line.budget_amount), money(line.actual_amount), money(line.committed_amount), money(line.forecast_amount)])} />
          </section>
        </>
      )}

      {activeTab === 'cash-flow' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Opening Cash" value={money(finance.cash_flow?.position?.opening_cash)} sub="Opening bank balance" />
            <Kpi icon={WalletCards} label="Current Cash" value={money(finance.cash_flow?.position?.current_cash)} sub="Current bank balance" />
            <Kpi icon={FileText} label="Expected Receipts" value={money(finance.cash_flow?.position?.expected_receipts)} sub="Open receivables" />
            <Kpi icon={Truck} label="Supplier Obligations" value={money(finance.cash_flow?.position?.supplier_obligations)} sub="Open payables" />
          </div>
          <ChartPanel icon={BarChart3} title="Forecast">
            <AnalyticsBarChart data={finance.cash_flow?.forecast || []} xKey="period" bars={[{ key: 'inflows' }, { key: 'outflows' }, { key: 'net' }]} />
          </ChartPanel>
        </>
      )}

      {activeTab === 'bank-accounts' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Bank Account" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'bankAccount', api.createFinanceBankAccount, (form) => cleanPayload({ branch_id: idOrNull(form.branch_id), account_name: form.account_name, bank_name: form.bank_name, account_number: form.account_number, currency: form.currency, opening_balance: num(form.opening_balance), is_default: form.is_default }), 'Bank account created.')}>
              <Select label="Branch" name="branch_id" value={forms.bankAccount.branch_id} onChange={setFinanceForm('bankAccount')}>
                <option value="">Company wide</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
              <Field label="Account Name" name="account_name" value={forms.bankAccount.account_name} onChange={setFinanceForm('bankAccount')} required />
              <Field label="Bank Name" name="bank_name" value={forms.bankAccount.bank_name} onChange={setFinanceForm('bankAccount')} required />
              <Field label="Account No." name="account_number" value={forms.bankAccount.account_number} onChange={setFinanceForm('bankAccount')} />
              <Field label="Currency" name="currency" value={forms.bankAccount.currency} onChange={setFinanceForm('bankAccount')} maxLength={3} />
              <Field label="Opening Balance" type="number" step="0.01" name="opening_balance" value={forms.bankAccount.opening_balance} onChange={setFinanceForm('bankAccount')} />
              <Field label="Default" type="checkbox" name="is_default" checked={forms.bankAccount.is_default} onChange={setFinanceForm('bankAccount')} />
              <button type="submit" className="primary-action"><Plus size={17} />Add bank</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Bank Accounts" />
            <DataTable columns={['Account', 'Bank', 'No.', 'Currency', 'Current Balance', 'Default', 'Status']} rows={bankAccounts.map((account) => [account.account_name, account.bank_name, account.account_number || '', account.currency, money(account.current_balance), account.is_default ? 'Yes' : '', <Badge key="status" value={account.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'bank-reconciliation' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={RefreshCcw} title="Bank Reconciliation" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'reconciliation', api.createFinanceBankReconciliation, (form) => cleanPayload({ finance_bank_account_id: idOrNull(form.finance_bank_account_id), statement_date: form.statement_date, statement_balance: num(form.statement_balance), notes: form.notes }), 'Bank reconciliation created.')}>
              <Select label="Bank Account" name="finance_bank_account_id" value={forms.reconciliation.finance_bank_account_id} onChange={setFinanceForm('reconciliation')} required>
                <option value="">Select</option>
                {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
              </Select>
              <Field label="Statement Date" type="date" name="statement_date" value={forms.reconciliation.statement_date} onChange={setFinanceForm('reconciliation')} required />
              <Field label="Statement Balance" type="number" step="0.01" name="statement_balance" value={forms.reconciliation.statement_balance} onChange={setFinanceForm('reconciliation')} required />
              <Field label="Notes" name="notes" value={forms.reconciliation.notes} onChange={setFinanceForm('reconciliation')} />
              <button type="submit" className="primary-action span-2"><RefreshCcw size={17} />Reconcile</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={RefreshCcw} title="Reconciliations" />
            <DataTable columns={['Bank', 'Statement Date', 'Statement', 'System', 'Difference', 'Status']} rows={(finance.bank_reconciliations || []).map((item) => [item.bank_account?.account_name || '', shortDate(item.statement_date), money(item.statement_balance), money(item.system_balance), money(item.difference), <Badge key="status" value={item.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'workbooks' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Upload} title="Finance Workbook" />
            <form className="form-grid two" onSubmit={uploadFinanceWorkbook}>
              <Field label="Title" name="title" value={forms.workbook.title} onChange={setFinanceForm('workbook')} required />
              <Select label="Workbook Type" name="workbook_type" value={forms.workbook.workbook_type} onChange={setFinanceForm('workbook')}>
                <option value="general_finance">General finance</option>
                <option value="bank_statement">Bank statement</option>
                <option value="invoice_import">Invoice import</option>
                <option value="expense_import">Expense import</option>
                <option value="budget_import">Budget import</option>
                <option value="journal_import">Journal import</option>
                <option value="payroll_import">Payroll import</option>
              </Select>
              <Select label="Branch" name="branch_id" value={forms.workbook.branch_id} onChange={setFinanceForm('workbook')}>
                <option value="">Default branch</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
              <Select label="Project" name="project_id" value={forms.workbook.project_id} onChange={setFinanceForm('workbook')}>
                <option value="">Company finance library</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <label className="field">
                <span>Workbook File</span>
                <input type="file" name="file" accept={financeWorkbookAccept} onChange={setWorkbookFile} required />
                <small>Microsoft Excel (.xls, .xlsx, .xlsm) or CSV files up to 50 MB</small>
              </label>
              <TextArea className="span-2" label="Notes" name="description" value={forms.workbook.description} onChange={setFinanceForm('workbook')} />
              <button type="submit" className="primary-action span-2"><Upload size={17} />Upload workbook</button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={FileText} title="Workbook Register" />
            <DataTable
              columns={['No.', 'Title', 'Folder', 'Project', 'File', 'Uploaded', 'Action']}
              rows={financeWorkbooks.map((workbook) => [
                workbook.document_number,
                workbook.title,
                workbook.folder || '',
                workbook.project?.name || workbook.branch?.name || 'Company finance library',
                workbook.original_filename || '',
                shortDate(workbook.created_at),
                workbook.file_path ? (
                  <button key="download" type="button" className="table-action" onClick={() => runAction(() => api.downloadDocument(workbook.id, workbook.original_filename || workbook.title), 'Workbook download started.', { skipRefresh: true })}>
                    Download
                  </button>
                ) : (
                  ''
                ),
              ])}
            />
          </section>
        </div>
      )}

      {activeTab === 'chart-of-accounts' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Layers3} title="Account" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'account', api.createFinanceAccount, (form) => cleanPayload({ account_code: form.account_code, account_name: form.account_name, account_type: form.account_type, normal_balance: form.normal_balance, description: form.description }), 'Account created.')}>
              <Field label="Account Code" name="account_code" value={forms.account.account_code} onChange={setFinanceForm('account')} placeholder="Auto-generated" />
              <Field label="Account Name" name="account_name" value={forms.account.account_name} onChange={setFinanceForm('account')} required />
              <Select label="Type" name="account_type" value={forms.account.account_type} onChange={setFinanceForm('account')}>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </Select>
              <Select label="Normal Balance" name="normal_balance" value={forms.account.normal_balance} onChange={setFinanceForm('account')}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </Select>
              <Field label="Description" name="description" value={forms.account.description} onChange={setFinanceForm('account')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Create account</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Layers3} title="Chart of Accounts" />
            <DataTable columns={['Code', 'Account', 'Type', 'Normal', 'Debit', 'Credit', 'Balance', 'Active']} rows={accountRows.map((account) => [account.account_code, account.account_name, labelize(account.account_type), labelize(account.normal_balance), money(account.debit), money(account.credit), money(account.balance), account.is_active ? 'Yes' : 'No'])} />
          </section>
        </div>
      )}

      {activeTab === 'general-ledger' && (
        <section className="panel">
          <PanelTitle icon={FileText} title="General Ledger" />
          <div className="panel-toolbar">
            <DownloadButton filename="general-ledger.csv" columns={['Date', 'Account', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']} rows={ledgerRows.map((entry) => [entry.entry_date, `${entry.account?.account_code || ''} ${entry.account?.account_name || ''}`, entry.reference || '', entry.description || '', entry.debit, entry.credit, entry.running_balance])} />
          </div>
          <DataTable columns={['Date', 'Account', 'Project', 'Reference', 'Debit', 'Credit', 'Balance']} rows={ledgerRows.map((entry) => [shortDate(entry.entry_date), `${entry.account?.account_code || ''} ${entry.account?.account_name || ''}`, entry.project?.name || '', entry.reference || '', money(entry.debit), money(entry.credit), money(entry.running_balance)])} />
        </section>
      )}

      {activeTab === 'journal-entries' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Send} title="Journal Entry" />
            <form className="form-grid two" onSubmit={createJournalEntry}>
              <Field label="Date" type="date" name="entry_date" value={forms.journal.entry_date} onChange={setFinanceForm('journal')} required />
              <Field label="Reference" name="reference" value={forms.journal.reference} onChange={setFinanceForm('journal')} />
              <Field label="Debit code" name="debit_account_code" value={forms.journal.debit_account_code} onChange={setFinanceForm('journal')} required />
              <Field label="Debit account" name="debit_account_name" value={forms.journal.debit_account_name} onChange={setFinanceForm('journal')} required />
              <Field label="Credit code" name="credit_account_code" value={forms.journal.credit_account_code} onChange={setFinanceForm('journal')} required />
              <Field label="Credit account" name="credit_account_name" value={forms.journal.credit_account_name} onChange={setFinanceForm('journal')} required />
              <Field label="Debit amount" type="number" step="0.01" name="debit_amount" value={forms.journal.debit_amount} onChange={setFinanceForm('journal')} required />
              <Field label="Credit amount" type="number" step="0.01" name="credit_amount" value={forms.journal.credit_amount} onChange={setFinanceForm('journal')} placeholder="Matches debit" />
              <button type="submit" className="primary-action span-2"><Send size={17} />Post journal</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Journal Entries" />
            <DataTable columns={['No.', 'Date', 'Status', 'Debit', 'Credit']} rows={(finance.journal_entries || []).map((entry) => [entry.entry_number, shortDate(entry.entry_date), <Badge key="status" value={entry.status} />, money(entry.total_debit), money(entry.total_credit)])} />
          </section>
        </div>
      )}

      {activeTab === 'cost-centers' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={FolderKanban} title="Cost Center" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'costCenter', api.createFinanceCostCenter, (form) => cleanPayload({ project_id: idOrNull(form.project_id), code: form.code, name: form.name, type: form.type, description: form.description }), 'Cost center created.')}>
              <Select label="Project" name="project_id" value={forms.costCenter.project_id} onChange={setFinanceForm('costCenter')}>
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <Field label="Code" name="code" value={forms.costCenter.code} onChange={setFinanceForm('costCenter')} placeholder="Auto-generated" />
              <Field label="Name" name="name" value={forms.costCenter.name} onChange={setFinanceForm('costCenter')} required />
              <Select label="Type" name="type" value={forms.costCenter.type} onChange={setFinanceForm('costCenter')}>
                <option value="project">Project</option>
                <option value="workshop">Workshop</option>
                <option value="head_office">Head office</option>
                <option value="equipment_yard">Equipment yard</option>
                <option value="department">Department</option>
              </Select>
              <Field label="Description" name="description" value={forms.costCenter.description} onChange={setFinanceForm('costCenter')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Create cost center</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={FolderKanban} title="Cost Centers" />
            <DataTable columns={['Code', 'Name', 'Type', 'Project', 'Status']} rows={(finance.cost_centers || []).map((center) => [center.code, center.name, labelize(center.type), center.project?.name || '', <Badge key="status" value={center.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'fixed-assets' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Truck} title="Fixed Asset" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'fixedAsset', api.createFinanceFixedAsset, (form) => cleanPayload({ equipment_asset_id: idOrNull(form.equipment_asset_id), branch_id: idOrNull(form.branch_id), name: form.name, category: form.category, purchase_date: form.purchase_date, purchase_cost: num(form.purchase_cost), depreciation_method: form.depreciation_method, useful_life_months: Number(form.useful_life_months || 60) }), 'Fixed asset created.')}>
              <Select label="Equipment Link" name="equipment_asset_id" value={forms.fixedAsset.equipment_asset_id} onChange={setFinanceForm('fixedAsset')}>
                <option value="">None</option>
                {(finance.fixed_assets?.equipment_candidates || []).map((asset) => <option key={asset.id} value={asset.id}>{asset.equipment_number} - {asset.name}</option>)}
              </Select>
              <Select label="Branch" name="branch_id" value={forms.fixedAsset.branch_id} onChange={setFinanceForm('fixedAsset')}>
                <option value="">Company wide</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
              <Field label="Name" name="name" value={forms.fixedAsset.name} onChange={setFinanceForm('fixedAsset')} required />
              <Field label="Category" name="category" value={forms.fixedAsset.category} onChange={setFinanceForm('fixedAsset')} />
              <Field label="Purchase Date" type="date" name="purchase_date" value={forms.fixedAsset.purchase_date} onChange={setFinanceForm('fixedAsset')} />
              <Field label="Purchase Cost" type="number" step="0.01" name="purchase_cost" value={forms.fixedAsset.purchase_cost} onChange={setFinanceForm('fixedAsset')} required />
              <Select label="Depreciation" name="depreciation_method" value={forms.fixedAsset.depreciation_method} onChange={setFinanceForm('fixedAsset')}>
                <option value="straight_line">Straight line</option>
                <option value="reducing_balance">Reducing balance</option>
                <option value="none">None</option>
              </Select>
              <Field label="Useful Life Months" type="number" name="useful_life_months" value={forms.fixedAsset.useful_life_months} onChange={setFinanceForm('fixedAsset')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Add asset</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Truck} title="Fixed Assets" />
            <DataTable columns={['No.', 'Asset', 'Category', 'Purchase Cost', 'Depreciation', 'Current Value', 'Status']} rows={(finance.fixed_assets?.assets || []).map((asset) => [asset.asset_number, asset.name, labelize(asset.category), money(asset.purchase_cost), money(asset.accumulated_depreciation), money(asset.current_value), <Badge key="status" value={asset.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'payroll' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={Clock3} label="Draft Payroll" value={money(finance.payroll_integration?.summary?.draft)} sub="Not yet approved" />
            <Kpi icon={CheckCircle2} label="Approved Payroll" value={money(finance.payroll_integration?.summary?.approved)} sub="Awaiting payment" />
            <Kpi icon={WalletCards} label="Paid Payroll" value={money(finance.payroll_integration?.summary?.paid)} sub="Posted payroll" />
            <Kpi icon={Calculator} label="Tax Withheld" value={money(finance.payroll_integration?.summary?.tax_withheld)} sub="Payslip tax totals" />
          </div>
          <section className="panel">
            <PanelTitle icon={Users} title="Payroll Runs" />
            <DataTable columns={['Run', 'Period', 'Status', 'Finance', 'Gross', 'Deductions', 'Net']} rows={(finance.payroll_integration?.runs || []).map((run) => [run.run_number, `${shortDate(run.period_start)} - ${shortDate(run.period_end)}`, <Badge key="status" value={run.status} />, <Badge key="finance" value={run.finance_status || 'forecast_in_finance'} />, money(run.gross_pay), money(run.total_deductions), money(run.net_pay)])} />
          </section>
        </>
      )}

      {activeTab === 'taxes' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Calculator} title="Tax Rule" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'taxRule', api.createFinanceTaxRule, (form) => cleanPayload({ tax_name: form.tax_name, tax_type: form.tax_type, rate: num(form.rate), applies_to: form.applies_to, effective_from: form.effective_from }), 'Tax rule created.')}>
              <Field label="Tax Name" name="tax_name" value={forms.taxRule.tax_name} onChange={setFinanceForm('taxRule')} required />
              <Field label="Tax Type" name="tax_type" value={forms.taxRule.tax_type} onChange={setFinanceForm('taxRule')} required />
              <Field label="Rate %" type="number" step="0.001" name="rate" value={forms.taxRule.rate} onChange={setFinanceForm('taxRule')} required />
              <Select label="Applies To" name="applies_to" value={forms.taxRule.applies_to} onChange={setFinanceForm('taxRule')}>
                <option value="sales">Sales</option>
                <option value="purchases">Purchases</option>
                <option value="payroll">Payroll</option>
                <option value="retention">Retention</option>
                <option value="all">All</option>
              </Select>
              <Field label="Effective From" type="date" name="effective_from" value={forms.taxRule.effective_from} onChange={setFinanceForm('taxRule')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Create tax rule</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Calculator} title="Taxes" />
            <DataTable columns={['Tax', 'Type', 'Rate', 'Applies To', 'Active']} rows={(finance.taxes?.rules || []).map((rule) => [rule.tax_name, labelize(rule.tax_type), `${rule.rate}%`, labelize(rule.applies_to), rule.is_active ? 'Yes' : 'No'])} />
            <DataTable columns={['Metric', 'Amount']} rows={[['Sales tax collected', money(finance.taxes?.sales_tax_collected)], ['Purchase tax recorded', money(finance.taxes?.purchase_tax_recorded)], ['Payroll tax withheld', money(finance.taxes?.payroll_tax_withheld)], ['Taxes payable', money(finance.taxes?.taxes_payable)]]} />
          </section>
        </div>
      )}

      {activeTab === 'retentions' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Retention" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'retention', api.createFinanceRetention, (form) => cleanPayload({ project_id: idOrNull(form.project_id), invoice_id: idOrNull(form.invoice_id), supplier_invoice_id: idOrNull(form.supplier_invoice_id), party_type: form.party_type, base_amount: form.base_amount === '' ? null : num(form.base_amount), retention_percent: num(form.retention_percent), retention_amount: form.retention_amount === '' ? null : num(form.retention_amount), due_date: form.due_date }), 'Retention created.')}>
              <Select label="Party" name="party_type" value={forms.retention.party_type} onChange={setFinanceForm('retention')}>
                <option value="client">Client</option>
                <option value="supplier">Supplier</option>
              </Select>
              <Select label="Project" name="project_id" value={forms.retention.project_id} onChange={setFinanceForm('retention')}>
                <option value="">Optional</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <Select label="Client Invoice" name="invoice_id" value={forms.retention.invoice_id} onChange={setFinanceForm('retention')}>
                <option value="">None</option>
                {issuedInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}
              </Select>
              <Select label="Supplier Invoice" name="supplier_invoice_id" value={forms.retention.supplier_invoice_id} onChange={setFinanceForm('retention')}>
                <option value="">None</option>
                {payableInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}
              </Select>
              <Field label="Base Amount" type="number" step="0.01" name="base_amount" value={forms.retention.base_amount} onChange={setFinanceForm('retention')} />
              <Field label="Retention %" type="number" step="0.01" name="retention_percent" value={forms.retention.retention_percent} onChange={setFinanceForm('retention')} />
              <Field label="Retention Amount" type="number" step="0.01" name="retention_amount" value={forms.retention.retention_amount} onChange={setFinanceForm('retention')} />
              <Field label="Due Date" type="date" name="due_date" value={forms.retention.due_date} onChange={setFinanceForm('retention')} />
              <button type="submit" className="primary-action span-2"><Plus size={17} />Hold retention</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Retentions" />
            <DataTable columns={['No.', 'Party', 'Project', 'Amount', 'Released', 'Balance', 'Due', 'Status', 'Action']} rows={(finance.retentions || []).map((retention) => [retention.retention_number, labelize(retention.party_type), retention.project?.name || '', money(retention.retention_amount), money(retention.released_amount), money(retention.balance_amount), shortDate(retention.due_date), <Badge key="status" value={retention.status} />, Number(retention.balance_amount || 0) > 0 ? <button key="release" type="button" className="table-action" onClick={() => runAction(() => api.releaseFinanceRetention(retention.id, { amount: Number(retention.balance_amount || 0) }), 'Retention released.')}>Release</button> : ''])} />
          </section>
        </div>
      )}

      {activeTab === 'progress-billing' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Progress Billing" />
            <form className="form-grid two" onSubmit={(event) => submitFinanceForm(event, 'progressBilling', api.createFinanceProgressBilling, (form) => cleanPayload({ project_id: idOrNull(form.project_id), milestone_name: form.milestone_name, progress_percent: num(form.progress_percent), billable_amount: num(form.billable_amount), retention_percent: num(form.retention_percent), due_date: form.due_date, create_invoice: form.create_invoice }), 'Progress billing created.')}>
              <Select label="Project" name="project_id" value={forms.progressBilling.project_id} onChange={setFinanceForm('progressBilling')} required>
                <option value="">Select</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              <Field label="Milestone" name="milestone_name" value={forms.progressBilling.milestone_name} onChange={setFinanceForm('progressBilling')} required />
              <Field label="Progress %" type="number" step="0.01" name="progress_percent" value={forms.progressBilling.progress_percent} onChange={setFinanceForm('progressBilling')} required />
              <Field label="Billable Amount" type="number" step="0.01" name="billable_amount" value={forms.progressBilling.billable_amount} onChange={setFinanceForm('progressBilling')} required />
              <Field label="Retention %" type="number" step="0.01" name="retention_percent" value={forms.progressBilling.retention_percent} onChange={setFinanceForm('progressBilling')} />
              <Field label="Due Date" type="date" name="due_date" value={forms.progressBilling.due_date} onChange={setFinanceForm('progressBilling')} />
              <Field label="Create Invoice" type="checkbox" name="create_invoice" checked={forms.progressBilling.create_invoice} onChange={setFinanceForm('progressBilling')} />
              <button type="submit" className="primary-action"><Plus size={17} />Create billing</button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Progress Billings" />
            <DataTable columns={['No.', 'Project', 'Milestone', 'Progress', 'Billable', 'Invoice', 'Status']} rows={(finance.progress_billings || []).map((billing) => [billing.milestone_number, billing.project?.name || '', billing.milestone_name, `${billing.progress_percent}%`, money(billing.billable_amount), billing.invoice?.invoice_number || '', <Badge key="status" value={billing.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid-main">
          {[
            ['Income Statement', 'income-statement.csv', ['line', 'amount'], finance.financial_reports?.income_statement || []],
            ['Balance Sheet', 'balance-sheet.csv', ['line', 'amount'], finance.financial_reports?.balance_sheet || []],
            ['Cash Flow Statement', 'cash-flow-statement.csv', ['period', 'inflows', 'outflows', 'net'], finance.financial_reports?.cash_flow_statement || []],
            ['Trial Balance', 'trial-balance.csv', ['account_code', 'account_name', 'debit', 'credit', 'balance'], finance.financial_reports?.trial_balance || []],
            ['Expense Analysis', 'expense-analysis.csv', ['category', 'total'], finance.financial_reports?.expense_analysis || []],
            ['Budget Variance', 'budget-variance.csv', ['project', 'budget', 'actual', 'committed', 'remaining'], finance.financial_reports?.budget_variance || []],
            ['Project Profitability', 'project-profitability.csv', ['project', 'client', 'recognized_revenue', 'cost', 'profit', 'margin_percent'], finance.financial_reports?.project_profitability || []],
            ['Retention Report', 'retention-report.csv', ['party_type', 'status', 'balance'], finance.financial_reports?.retention_report || []],
          ].map(([title, filename, keys, rows]) => (
            <section key={title} className="panel">
              <PanelTitle icon={Download} title={title} />
              <div className="panel-toolbar">
                <DownloadButton filename={filename} columns={keys.map(labelize)} rows={reportRows(rows, keys)} />
              </div>
              <DataTable columns={keys.map(labelize)} rows={reportRows(rows, keys).map((row) => row.map((value) => typeof value === 'number' ? money(value) : value))} />
            </section>
          ))}
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Expense Approvals" />
            <DataTable columns={['No.', 'Project', 'Description', 'Amount', 'Action']} rows={(finance.approvals?.expenses || []).map((expense) => [expense.expense_number, expense.project?.name || '', expense.description, money(Number(expense.amount) + Number(expense.tax_amount)), <div key="actions" className="row-actions"><button type="button" className="table-action" onClick={() => runAction(() => api.reviewExpense(expense.id, 'approved'), 'Expense approved.')}>Approve</button><button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewExpense(expense.id, 'rejected'), 'Expense rejected.')}>Reject</button></div>])} />
          </section>
          <section className="panel">
            <PanelTitle icon={Truck} title="Supplier Invoice Approvals" />
            <DataTable columns={['Invoice', 'Supplier', 'PO', 'Amount', 'Action']} rows={(finance.approvals?.supplier_invoices || []).map((invoice) => [invoice.invoice_number, invoice.supplier?.name || '', invoice.purchase_order?.po_number || '', money(invoice.balance_due), <div key="actions" className="row-actions"><button type="button" className="table-action" onClick={() => runAction(() => api.approveSupplierInvoice(invoice.id, { decision: 'approved' }), 'Supplier invoice approved.')}>Approve</button><button type="button" className="table-action danger" onClick={() => runAction(() => api.approveSupplierInvoice(invoice.id, { decision: 'rejected' }), 'Supplier invoice rejected.')}>Reject</button></div>])} />
          </section>
        </div>
      )}

      {activeTab === 'audit-trail' && (
        <section className="panel">
          <PanelTitle icon={Clock3} title="Audit Trail" />
          <DataTable columns={['When', 'Action', 'Record', 'User', 'IP']} rows={(finance.audit_trail || []).map((log) => [timelineTime(log.created_at), labelize(log.action), String(log.auditable_type || '').split('\\').pop(), log.user_id || '', log.ip_address || ''])} />
        </section>
      )}

      {activeTab === 'automation' && (
        <section className="panel">
          <PanelTitle icon={Workflow} title="Finance Automation" />
          <DataTable
            columns={['Trigger', 'Status', 'Active Workflows']}
            rows={(finance.automation?.approval_triggers || []).map((trigger) => {
              const item = typeof trigger === 'string' ? { trigger, status: 'not_configured', active_workflows: 0 } : trigger

              return [labelize(item.trigger), <Badge key="status" value={item.status} />, item.active_workflows || 0]
            })}
          />
          <DataTable columns={['Metric', 'Value']} rows={[['Connected finance workflows', finance.automation?.connected_workflows || 0], ['Ledger posting', finance.finance_settings?.ledger_posting || 'automatic'], ['Audit trail', finance.finance_settings?.audit_trail_enabled ? 'Enabled' : 'Disabled']]} />
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="panel">
          <PanelTitle icon={Settings} title="Finance Settings" />
          <DataTable columns={['Setting', 'Value']} rows={[['Default currency', finance.finance_settings?.default_currency || 'GHS'], ['Multi-currency', finance.finance_settings?.multi_currency_enabled ? 'Enabled' : 'Disabled'], ['Ledger posting', labelize(finance.finance_settings?.ledger_posting || 'automatic')], ['Audit trail', finance.finance_settings?.audit_trail_enabled ? 'Enabled' : 'Disabled']]} />
        </section>
      )}
    </section>
  )
}

function PeopleView({ branches, projects, suppliers, users, roles, currentUser, people, forms, setPeopleForm, setPeopleForms, createEmployee, createLeaveRequest, createPayrollRun, runAction }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [accessForms, setAccessForms] = useState({
    user: { id: '', name: '', email: '', password: '', branch_id: '', role_id: '', role_name: '', permissions: [], status: 'active' },
    role: { id: '', name: '', permissions: [] },
  })
  const recruitment = people.recruitment || {}
  const attendance = people.attendance || {}
  const analytics = people.analytics || {}
  const reports = people.reports || {}
  const managerPortal = people.manager_portal || {}
  const selfService = people.self_service || {}
  const employees = people.employees || []
  const vacancies = recruitment.vacancies || []
  const candidates = recruitment.candidates || []
  const applications = recruitment.applications || []
  const interviews = recruitment.interviews || []
  const timesheets = people.timesheets || []
  const allocations = people.workforce_allocations || []
  const overtimeRequests = people.overtime_requests || []
  const trainingCourses = people.training_courses || []
  const trainingRecords = people.training_records || []
  const certifications = people.certifications || []
  const ppeIssues = people.ppe_issues || []
  const contractors = people.contractors || []
  const employeeAssets = people.employee_assets || []
  const documents = people.documents || []
  const exits = people.exit_records || []
  const activeEmployeeCount = people.summary?.active_employees || 0
  const reportRows = (rows = [], keys = []) => (rows || []).map((row) => keys.map((key) => row?.[key] ?? ''))

  const tabs = [
    ['dashboard', 'Dashboard', BarChart3],
    ['recruitment', 'Recruitment', Handshake],
    ['employees', 'Employees', Users],
    ['org', 'Organizational Chart', Building2],
    ['attendance', 'Attendance', Clock3],
    ['shifts', 'Shifts', CalendarDays],
    ['timesheets', 'Timesheets', ClipboardList],
    ['allocation', 'Workforce Allocation', MapPinned],
    ['leave', 'Leave Management', CalendarDays],
    ['overtime', 'Overtime', Clock3],
    ['payroll', 'Payroll', WalletCards],
    ['benefits', 'Benefits', ShieldCheck],
    ['performance', 'Performance', BarChart3],
    ['users_roles', 'Users & Roles', ShieldCheck],
    ['training', 'Training', ClipboardList],
    ['certifications', 'Certifications', FileText],
    ['safety', 'Health & Safety', ShieldCheck],
    ['ppe', 'PPE Management', Package],
    ['contractors', 'Contractor Management', Building2],
    ['assets', 'Employee Assets', Truck],
    ['documents', 'Documents', FileText],
    ['self', 'Self-Service Portal', Users],
    ['manager', 'Manager Portal', CheckCircle2],
    ['exit', 'Exit Management', LogOut],
    ['reports', 'HR Reports', Download],
    ['analytics', 'HR Analytics', BarChart3],
    ['automation', 'Automation', Workflow],
    ['settings', 'Settings', Settings],
  ]

  const numberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
  const isEditingHrUser = Boolean(accessForms.user.id)
  const isEditingHrRole = Boolean(accessForms.role.id)
  const hrUserPermissions = normalizePermissionList(accessForms.user.permissions)
  const hrRolePermissions = normalizePermissionList(accessForms.role.permissions)
  const hrUserReset = () => ({
    id: '',
    name: '',
    email: '',
    password: '',
    branch_id: branches[0]?.id || '',
    role_id: '',
    role_name: '',
    permissions: [],
    status: 'active',
  })
  const hrRoleReset = { id: '', name: '', permissions: [] }
  const nullablePayload = (payload) =>
    Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, value === '' || value === undefined ? null : value]),
    )
  const resetForm = (section, overrides = {}) => {
    setPeopleForms((current) => ({
      ...current,
      [section]: { ...emptyPeopleForms[section], ...overrides },
    }))
  }
  const submitPeopleForm = async (event, section, action, transform, message, resetOverrides = {}) => {
    event.preventDefault()
    const payload = nullablePayload(transform(forms[section]))
    const result = await runAction(() => action(payload), message)

    if (result) {
      resetForm(section, resetOverrides)
    }
  }
  const employeeName = (employee) => employee?.user?.name || employee?.name || ''
  const employeeOptions = () =>
    employees.map((employee) => (
      <option key={employee.id} value={employee.id}>
        {employeeName(employee)} ({employee.employee_number})
      </option>
    ))
  const projectOptions = () =>
    projects.map((project) => (
      <option key={project.id} value={project.id}>
        {project.name}
      </option>
    ))
  const branchOptions = () =>
    branches.map((branch) => (
      <option key={branch.id} value={branch.id}>
        {branch.name}
      </option>
    ))

  useEffect(() => {
    const defaultBranchId = branches[0]?.id || ''

    setAccessForms((current) => {
      const nextUser = {
        ...current.user,
        branch_id: current.user.branch_id || defaultBranchId,
      }

      if (nextUser.branch_id === current.user.branch_id) {
        return current
      }

      return { ...current, user: nextUser }
    })
  }, [branches])

  function setAccessFormValue(section) {
    return (event) => {
      const { name, value } = event.target
      setAccessForms((current) => ({
        ...current,
        [section]: { ...current[section], [name]: value },
      }))
    }
  }

  function setAccessUserField(field) {
    return (event) => {
      setAccessForms((current) => ({
        ...current,
        user: { ...current.user, [field]: event.target.value },
      }))
    }
  }

  function toggleAccessCategoryFor(section, category) {
    setAccessForms((current) => {
      const currentPermissions = normalizePermissionList(current[section].permissions)
      const expandedPermissions = currentPermissions.includes('*') ? allAccessPermissions : currentPermissions
      const hasCategory = category.permissions.every((permission) => expandedPermissions.includes(permission))
      const permissions = hasCategory
        ? expandedPermissions.filter((permission) => !category.permissions.includes(permission))
        : [...new Set([...expandedPermissions, ...category.permissions])]

      return {
        ...current,
        [section]: { ...current[section], permissions },
      }
    })
  }

  function setAllAccessFor(section) {
    setAccessForms((current) => ({
      ...current,
      [section]: { ...current[section], permissions: allAccessPermissions },
    }))
  }

  function clearAccessFor(section) {
    setAccessForms((current) => ({
      ...current,
      [section]: { ...current[section], permissions: [] },
    }))
  }

  function editHrUser(item) {
    setAccessForms((current) => ({
      ...current,
      user: {
        id: item.id,
        name: item.name || '',
        email: item.email || '',
        password: '',
        branch_id: item.branch_id || item.branch?.id || branches[0]?.id || '',
        role_id: item.role_id || item.role?.id || '',
        role_name: item.role?.name || '',
        permissions: explicitUserPermissions(item),
        status: item.status || 'active',
      },
    }))
  }

  function saveHrUser(event) {
    event.preventDefault()

    const payload = {
      name: accessForms.user.name,
      email: accessForms.user.email,
      branch_id: Number(accessForms.user.branch_id),
      role_name: (accessForms.user.role_name || '').trim(),
      permissions: hrUserPermissions,
      status: accessForms.user.status || 'active',
    }

    if (accessForms.user.password) {
      payload.password = accessForms.user.password
    }

    const request = isEditingHrUser
      ? () => api.updateUser(accessForms.user.id, payload)
      : () => api.createUser(payload)

    runAction(request, isEditingHrUser ? 'User updated.' : 'User added.').then((result) => {
      if (result) {
        setAccessForms((current) => ({ ...current, user: hrUserReset() }))
      }
    })
  }

  function deleteHrUser(item) {
    if (!window.confirm(`Delete ${item.name}? This removes their Navkwa Build access.`)) {
      return
    }

    runAction(() => api.deleteUser(item.id), 'User deleted.').then((result) => {
      if (result && accessForms.user.id === item.id) {
        setAccessForms((current) => ({ ...current, user: hrUserReset() }))
      }
    })
  }

  function editHrRole(item) {
    setAccessForms((current) => ({
      ...current,
      role: {
        id: item.id,
        name: item.name || '',
        permissions: rolePermissions(item),
      },
    }))
  }

  function saveHrRole(event) {
    event.preventDefault()

    const payload = {
      name: accessForms.role.name,
      permissions: hrRolePermissions,
    }
    const request = isEditingHrRole
      ? () => api.updateRole(accessForms.role.id, payload)
      : () => api.createRole(payload)

    runAction(request, isEditingHrRole ? 'Role updated.' : 'Role created.').then((result) => {
      if (result) {
        setAccessForms((current) => ({ ...current, role: hrRoleReset }))
      }
    })
  }

  function deleteHrRole(item) {
    if (!window.confirm(`Delete ${roleLabel(item)}? Users must be assigned to another role first.`)) {
      return
    }

    runAction(() => api.deleteRole(item.id), 'Role deleted.').then((result) => {
      if (result && accessForms.role.id === item.id) {
        setAccessForms((current) => ({ ...current, role: hrRoleReset }))
      }
    })
  }

  const workforceRows = employees.map((employee) => [
    employee.employee_number,
    employeeName(employee),
    employee.department || '',
    employee.position || '',
    employee.current_project?.name || '',
    employee.employment_type ? labelize(employee.employment_type) : '',
    money(employee.base_salary),
    <Badge key="status" value={employee.status} />,
  ])
  const headcountRows = reportRows(reports.headcount_by_department || [], ['department', 'employees'])
  const projectHeadcountRows = reportRows(reports.employees_by_project || [], ['project', 'employees'])
  const timesheetCostRows = reportRows(reports.timesheet_costs || [], ['project', 'hours', 'overtime', 'cost'])
  const trainingMatrixRows = reportRows(reports.training_matrix || [], ['employee', 'course', 'status', 'completed_on'])
  const certificationRows = reportRows(reports.certification_expiry || [], ['employee', 'certification', 'expires_on', 'status'])
  const turnoverRows = reportRows(reports.turnover || [], ['period', 'exits'])

  return (
    <section className="view-stack">
      <nav className="module-tabs" aria-label="HR and workforce module navigation">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={Users} label="Total workforce" value={people.summary?.total_workforce || activeEmployeeCount} sub="Employees plus contractor workers" />
            <Kpi icon={Handshake} label="Open vacancies" value={people.summary?.open_vacancies || 0} sub="Hiring demand" />
            <Kpi icon={Clock3} label="Attendance rate" value={`${people.summary?.attendance_rate || 0}%`} sub={`${people.summary?.present_today || 0} present today`} />
            <Kpi icon={WalletCards} label="Payroll liability" value={money(people.summary?.payroll_liability)} sub="Linked to Finance" />
            <Kpi icon={AlertTriangle} label="Expiring certs" value={people.summary?.expiring_certifications || 0} sub="Within 60 days" />
            <Kpi icon={CalendarDays} label="Pending leave" value={people.summary?.pending_leave || 0} sub="Awaiting approval" />
          </div>

          <div className="grid-main">
            <ChartPanel icon={Users} title="Headcount By Department">
              <AnalyticsBarChart data={analytics.headcount_by_department || []} bars={[{ key: 'value', color: '#2364d8' }]} />
            </ChartPanel>
            <ChartPanel icon={MapPinned} title="Workforce By Project">
              <AnalyticsBarChart data={analytics.employees_by_project || []} bars={[{ key: 'value', color: '#188a5a' }]} />
            </ChartPanel>
          </div>

          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Workforce Priorities" />
            <DataTable
              columns={['Area', 'Current Position', 'Action']}
              rows={[
                ['Recruitment', `${vacancies.filter((item) => item.status === 'open').length} open vacancies`, 'Fill project-critical roles and convert hired applications to employee profiles.'],
                ['Attendance', `${attendance.summary?.absent_today || 0} absent today`, 'Review site attendance exceptions and missing clock-outs.'],
                ['Overtime', `${people.summary?.overtime_hours || 0} hours recorded`, 'Approve justified overtime before payroll is generated.'],
                ['Training', `${people.summary?.training_compliance || 0}% compliance`, 'Schedule mandatory safety and trade training for uncovered roles.'],
                ['Certifications', `${people.summary?.expiring_certifications || 0} expiring`, 'Renew high-risk licenses before site deployment.'],
              ]}
            />
          </section>
        </>
      )}

      {activeTab === 'recruitment' && (
        <>
          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={Handshake} title="Job Vacancy" />
              <form
                className="form-grid two"
                onSubmit={(event) =>
                  submitPeopleForm(
                    event,
                    'vacancy',
                    api.createJobVacancy,
                    (form) => ({
                      ...form,
                      branch_id: numberOrNull(form.branch_id),
                      project_id: numberOrNull(form.project_id),
                      openings: Number(form.openings || 1),
                    }),
                    'Job vacancy created.',
                    { branch_id: forms.vacancy.branch_id, project_id: forms.vacancy.project_id },
                  )
                }
              >
                <Select label="Branch" name="branch_id" value={forms.vacancy.branch_id} onChange={setPeopleForm('vacancy')}>
                  <option value="">Company-wide</option>
                  {branchOptions()}
                </Select>
                <Select label="Project" name="project_id" value={forms.vacancy.project_id} onChange={setPeopleForm('vacancy')}>
                  <option value="">Not project specific</option>
                  {projectOptions()}
                </Select>
                <Field label="Role needed" name="title" value={forms.vacancy.title} onChange={setPeopleForm('vacancy')} required />
                <Field label="Department" name="department" value={forms.vacancy.department} onChange={setPeopleForm('vacancy')} />
                <Select label="Employment type" name="employment_type" value={forms.vacancy.employment_type} onChange={setPeopleForm('vacancy')}>
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="casual">Casual</option>
                </Select>
                <Select label="Priority" name="priority" value={forms.vacancy.priority} onChange={setPeopleForm('vacancy')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
                <Field label="Openings" type="number" name="openings" min="1" value={forms.vacancy.openings} onChange={setPeopleForm('vacancy')} />
                <Field label="Closes on" type="date" name="closes_on" value={forms.vacancy.closes_on} onChange={setPeopleForm('vacancy')} />
                <TextArea label="Required skills" className="span-2" name="required_skills" value={forms.vacancy.required_skills} onChange={setPeopleForm('vacancy')} />
                <TextArea label="Description" className="span-2" name="description" value={forms.vacancy.description} onChange={setPeopleForm('vacancy')} />
                <button type="submit" className="primary-action span-2">
                  <Plus size={17} />
                  Create vacancy
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={Users} title="Candidate Database" />
              <form
                className="form-grid two"
                onSubmit={(event) =>
                  submitPeopleForm(
                    event,
                    'candidate',
                    api.createCandidate,
                    (form) => ({ ...form, rating: Number(form.rating || 3) }),
                    'Candidate added.',
                  )
                }
              >
                <Field label="Full name" name="full_name" value={forms.candidate.full_name} onChange={setPeopleForm('candidate')} required />
                <Field label="Email" type="email" name="email" value={forms.candidate.email} onChange={setPeopleForm('candidate')} />
                <Field label="Phone" name="phone" value={forms.candidate.phone} onChange={setPeopleForm('candidate')} />
                <Field label="Trade" name="trade" value={forms.candidate.trade} onChange={setPeopleForm('candidate')} />
                <Field label="Location" name="location" value={forms.candidate.location} onChange={setPeopleForm('candidate')} />
                <Select label="Source" name="source" value={forms.candidate.source} onChange={setPeopleForm('candidate')}>
                  <option value="direct">Direct</option>
                  <option value="referral">Referral</option>
                  <option value="agency">Agency</option>
                  <option value="job_board">Job board</option>
                </Select>
                <Field label="Rating" type="number" min="1" max="5" name="rating" value={forms.candidate.rating} onChange={setPeopleForm('candidate')} />
                <TextArea label="Notes" className="span-2" name="notes" value={forms.candidate.notes} onChange={setPeopleForm('candidate')} />
                <button type="submit" className="primary-action span-2">
                  <Plus size={17} />
                  Add candidate
                </button>
              </form>
            </section>
          </div>

          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={ClipboardList} title="Applications & Interviews" />
              <form
                className="form-grid two"
                onSubmit={(event) =>
                  submitPeopleForm(
                    event,
                    'application',
                    api.createWorkforceApplication,
                    (form) => ({
                      ...form,
                      job_vacancy_id: Number(form.job_vacancy_id),
                      candidate_id: Number(form.candidate_id),
                      expected_salary: Number(form.expected_salary || 0),
                      screening_score: Number(form.screening_score || 0),
                    }),
                    'Application created.',
                  )
                }
              >
                <Select label="Vacancy" name="job_vacancy_id" value={forms.application.job_vacancy_id} onChange={setPeopleForm('application')} required>
                  <option value="">Select</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.vacancy_number} - {vacancy.title}
                    </option>
                  ))}
                </Select>
                <Select label="Candidate" name="candidate_id" value={forms.application.candidate_id} onChange={setPeopleForm('application')} required>
                  <option value="">Select</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name}
                    </option>
                  ))}
                </Select>
                <Field label="Expected salary" type="number" name="expected_salary" value={forms.application.expected_salary} onChange={setPeopleForm('application')} />
                <Field label="Screening score" type="number" min="0" max="100" name="screening_score" value={forms.application.screening_score} onChange={setPeopleForm('application')} />
                <Select label="Background check" name="background_check_status" value={forms.application.background_check_status} onChange={setPeopleForm('application')}>
                  <option value="pending">Pending</option>
                  <option value="clear">Clear</option>
                  <option value="flagged">Flagged</option>
                </Select>
                <Select label="Offer" name="offer_status" value={forms.application.offer_status} onChange={setPeopleForm('application')}>
                  <option value="not_sent">Not sent</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </Select>
                <TextArea label="Notes" className="span-2" name="notes" value={forms.application.notes} onChange={setPeopleForm('application')} />
                <button type="submit" className="primary-action span-2">
                  <Plus size={17} />
                  Create application
                </button>
              </form>

              <form
                className="form-grid two section-form"
                onSubmit={(event) =>
                  submitPeopleForm(
                    event,
                    'interview',
                    api.createWorkforceInterview,
                    (form) => ({ ...form, application_id: Number(form.application_id), score: Number(form.score || 0) }),
                    'Interview recorded.',
                  )
                }
              >
                <Select label="Application" name="application_id" value={forms.interview.application_id} onChange={setPeopleForm('interview')} required>
                  <option value="">Select</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.application_number} - {application.candidate?.full_name}
                    </option>
                  ))}
                </Select>
                <Field label="Scheduled" type="datetime-local" name="scheduled_at" value={forms.interview.scheduled_at} onChange={setPeopleForm('interview')} />
                <Field label="Stage" name="stage" value={forms.interview.stage} onChange={setPeopleForm('interview')} />
                <Select label="Result" name="result" value={forms.interview.result} onChange={setPeopleForm('interview')}>
                  <option value="scheduled">Scheduled</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="rescheduled">Rescheduled</option>
                </Select>
                <Field label="Score" type="number" min="0" max="100" name="score" value={forms.interview.score} onChange={setPeopleForm('interview')} />
                <Field label="Interviewers" name="interviewers" value={forms.interview.interviewers} onChange={setPeopleForm('interview')} />
                <TextArea label="Notes" className="span-2" name="notes" value={forms.interview.notes} onChange={setPeopleForm('interview')} />
                <button type="submit" className="primary-action span-2">
                  <Plus size={17} />
                  Record interview
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={CheckCircle2} title="Hire To Employee Profile" />
              <form className="form-grid two">
                <Select label="Branch" name="branch_id" value={forms.hire.branch_id} onChange={setPeopleForm('hire')}>
                  <option value="">Use vacancy branch</option>
                  {branchOptions()}
                </Select>
                <Select label="Project" name="project_id" value={forms.hire.project_id} onChange={setPeopleForm('hire')}>
                  <option value="">Use vacancy project</option>
                  {projectOptions()}
                </Select>
                <Select label="Manager" name="manager_id" value={forms.hire.manager_id} onChange={setPeopleForm('hire')}>
                  <option value="">No manager</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Field label="Base salary" type="number" name="base_salary" value={forms.hire.base_salary} onChange={setPeopleForm('hire')} />
                <Field label="Hourly rate" type="number" name="hourly_rate" value={forms.hire.hourly_rate} onChange={setPeopleForm('hire')} />
                <Field label="Hire date" type="date" name="hire_date" value={forms.hire.hire_date} onChange={setPeopleForm('hire')} />
              </form>
              <DataTable
                columns={['Application', 'Role', 'Candidate', 'Status', 'Offer', 'Action']}
                rows={applications.map((application) => [
                  application.application_number,
                  application.vacancy?.title || '',
                  application.candidate?.full_name || '',
                  <Badge key="status" value={application.status} />,
                  <Badge key="offer" value={application.offer_status} />,
                  application.status !== 'hired' ? (
                    <button
                      key="hire"
                      type="button"
                      className="table-action"
                      onClick={() =>
                        runAction(
                          () =>
                            api.hireWorkforceApplication(application.id, nullablePayload({
                              branch_id: numberOrNull(forms.hire.branch_id),
                              project_id: numberOrNull(forms.hire.project_id),
                              manager_id: numberOrNull(forms.hire.manager_id),
                              base_salary: numberOrNull(forms.hire.base_salary),
                              hourly_rate: numberOrNull(forms.hire.hourly_rate),
                              hire_date: forms.hire.hire_date,
                            })),
                          'Candidate hired and employee profile created.',
                        )
                      }
                    >
                      Hire
                    </button>
                  ) : (
                    'Hired'
                  ),
                ])}
              />
            </section>
          </div>

          <section className="panel">
            <PanelTitle icon={Handshake} title="Open Vacancies" />
            <DataTable columns={['No.', 'Role', 'Project', 'Openings', 'Priority', 'Status', 'Applications']} rows={vacancies.map((vacancy) => [vacancy.vacancy_number, vacancy.title, vacancy.project?.name || '', vacancy.openings, <Badge key="priority" value={vacancy.priority} />, <Badge key="status" value={vacancy.status} />, vacancy.applications?.length || 0])} />
          </section>

          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Interview Schedule" />
            <DataTable columns={['No.', 'Candidate', 'Role', 'Scheduled', 'Stage', 'Result', 'Score']} rows={interviews.map((interview) => [interview.interview_number, interview.application?.candidate?.full_name || '', interview.application?.vacancy?.title || '', timelineTime(interview.scheduled_at), interview.stage, <Badge key="result" value={interview.result} />, interview.score])} />
          </section>
        </>
      )}

      {activeTab === 'employees' && (
        <>
          <section className="panel">
            <PanelTitle icon={Users} title="Complete Employee Profile" />
            <form className="form-grid two" onSubmit={createEmployee}>
              <Select label="User" name="user_id" value={forms.employee.user_id} onChange={setPeopleForm('employee')} required>
                <option value="">Select</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select label="Branch" name="branch_id" value={forms.employee.branch_id} onChange={setPeopleForm('employee')} required>
                {branchOptions()}
              </Select>
              <Select label="Manager" name="manager_id" value={forms.employee.manager_id} onChange={setPeopleForm('employee')}>
                <option value="">No manager</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select label="Current project" name="current_project_id" value={forms.employee.current_project_id} onChange={setPeopleForm('employee')}>
                <option value="">Unassigned</option>
                {projectOptions()}
              </Select>
              <Field label="Department" name="department" value={forms.employee.department} onChange={setPeopleForm('employee')} />
              <Field label="Position" name="position" value={forms.employee.position} onChange={setPeopleForm('employee')} />
              <Select label="Employment type" name="employment_type" value={forms.employee.employment_type} onChange={setPeopleForm('employee')}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="casual">Casual</option>
              </Select>
              <Field label="Hire date" type="date" name="hire_date" value={forms.employee.hire_date} onChange={setPeopleForm('employee')} />
              <Field label="Gender" name="gender" value={forms.employee.gender} onChange={setPeopleForm('employee')} />
              <Field label="Date of birth" type="date" name="date_of_birth" value={forms.employee.date_of_birth} onChange={setPeopleForm('employee')} />
              <Field label="Nationality" name="nationality" value={forms.employee.nationality} onChange={setPeopleForm('employee')} />
              <Field label="Marital status" name="marital_status" value={forms.employee.marital_status} onChange={setPeopleForm('employee')} />
              <Field label="National ID" name="national_id" value={forms.employee.national_id} onChange={setPeopleForm('employee')} />
              <Field label="Tax number" name="tax_number" value={forms.employee.tax_number} onChange={setPeopleForm('employee')} />
              <Field label="SSNIT number" name="ssnit_number" value={forms.employee.ssnit_number} onChange={setPeopleForm('employee')} />
              <Field label="Base salary" type="number" name="base_salary" value={forms.employee.base_salary} onChange={setPeopleForm('employee')} />
              <Field label="Hourly rate" type="number" name="hourly_rate" value={forms.employee.hourly_rate} onChange={setPeopleForm('employee')} />
              <Field label="Allowances" type="number" name="allowances" value={forms.employee.allowances} onChange={setPeopleForm('employee')} />
              <Field label="Bonuses" type="number" name="bonuses" value={forms.employee.bonuses} onChange={setPeopleForm('employee')} />
              <Field label="Deductions" type="number" name="deductions" value={forms.employee.deductions} onChange={setPeopleForm('employee')} />
              <Field label="Bank name" name="bank_name" value={forms.employee.bank_name} onChange={setPeopleForm('employee')} />
              <Field label="Bank account" name="bank_account" value={forms.employee.bank_account} onChange={setPeopleForm('employee')} />
              <Field label="Emergency contact" name="emergency_contact" value={forms.employee.emergency_contact} onChange={setPeopleForm('employee')} />
              <TextArea label="Skills" className="span-2" name="skills" value={forms.employee.skills} onChange={setPeopleForm('employee')} />
              <TextArea label="Licenses" className="span-2" name="licenses" value={forms.employee.licenses} onChange={setPeopleForm('employee')} />
              <TextArea label="Medical notes" className="span-2" name="medical_notes" value={forms.employee.medical_notes} onChange={setPeopleForm('employee')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Create employee profile
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={Users} title="Employee Register" />
            <DownloadButton filename="hr-workforce-employee-register.csv" columns={['No.', 'Name', 'Department', 'Position', 'Project', 'Employment Type', 'Salary', 'Status']} rows={workforceRows.map((row) => row.map((cell) => (typeof cell === 'string' || typeof cell === 'number' ? cell : '')))} />
            <DataTable columns={['No.', 'Name', 'Department', 'Position', 'Project', 'Employment Type', 'Salary', 'Status']} rows={workforceRows} />
          </section>
        </>
      )}

      {activeTab === 'org' && (
        <section className="panel">
          <PanelTitle icon={Building2} title="Organizational Chart" />
          <DataTable
            columns={['Employee', 'Manager', 'Department', 'Role', 'Branch', 'Project']}
            rows={employees.map((employee) => [
              employeeName(employee),
              employee.manager?.name || '',
              employee.department || '',
              employee.position || '',
              employee.branch?.name || '',
              employee.current_project?.name || '',
            ])}
          />
        </section>
      )}

      {activeTab === 'attendance' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={CheckCircle2} label="Present today" value={attendance.summary?.present_today || 0} sub="Clocked in" />
            <Kpi icon={AlertTriangle} label="Absent today" value={attendance.summary?.absent_today || 0} sub="Expected active staff" />
            <Kpi icon={Clock3} label="Late today" value={attendance.summary?.late_today || 0} sub="Marked late" />
            <Kpi icon={BarChart3} label="Attendance rate" value={`${attendance.summary?.attendance_rate || 0}%`} sub="Today" />
          </div>
          <section className="panel">
            <PanelTitle icon={Clock3} title="Attendance Records" />
            <DataTable columns={['Employee', 'Project', 'Clock in', 'Clock out', 'Hours', 'Mode', 'Status']} rows={(attendance.records || []).map((record) => [record.user?.name || '', record.project_id || '', timelineTime(record.clock_in_at), timelineTime(record.clock_out_at), record.hours_worked || '', labelize(record.capture_mode || record.method || 'manual'), <Badge key="status" value={record.status} />])} />
          </section>
        </>
      )}

      {activeTab === 'shifts' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Shift Management" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'shift',
                  api.createWorkforceShift,
                  (form) => ({
                    ...form,
                    branch_id: numberOrNull(form.branch_id),
                    project_id: numberOrNull(form.project_id),
                    break_minutes: Number(form.break_minutes || 0),
                  }),
                  'Shift created.',
                  { branch_id: forms.shift.branch_id, project_id: forms.shift.project_id },
                )
              }
            >
              <Field label="Shift name" name="name" value={forms.shift.name} onChange={setPeopleForm('shift')} required />
              <Select label="Type" name="shift_type" value={forms.shift.shift_type} onChange={setPeopleForm('shift')}>
                <option value="day">Day</option>
                <option value="night">Night</option>
                <option value="weekend">Weekend</option>
                <option value="rotating">Rotating</option>
              </Select>
              <Field label="Start" type="time" name="start_time" value={forms.shift.start_time} onChange={setPeopleForm('shift')} required />
              <Field label="End" type="time" name="end_time" value={forms.shift.end_time} onChange={setPeopleForm('shift')} required />
              <Field label="Break minutes" type="number" name="break_minutes" value={forms.shift.break_minutes} onChange={setPeopleForm('shift')} />
              <Select label="Branch" name="branch_id" value={forms.shift.branch_id} onChange={setPeopleForm('shift')}>
                <option value="">Any branch</option>
                {branchOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.shift.project_id} onChange={setPeopleForm('shift')}>
                <option value="">Any project</option>
                {projectOptions()}
              </Select>
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Create shift
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={MapPinned} title="Shift Assignment" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'shiftAssignment',
                  api.createShiftAssignment,
                  (form) => ({
                    ...form,
                    shift_id: Number(form.shift_id),
                    employee_profile_id: Number(form.employee_profile_id),
                    project_id: numberOrNull(form.project_id),
                  }),
                  'Shift assigned.',
                  { shift_id: forms.shiftAssignment.shift_id, project_id: forms.shiftAssignment.project_id },
                )
              }
            >
              <Select label="Shift" name="shift_id" value={forms.shiftAssignment.shift_id} onChange={setPeopleForm('shiftAssignment')} required>
                <option value="">Select</option>
                {(people.shifts || []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </Select>
              <Select label="Employee" name="employee_profile_id" value={forms.shiftAssignment.employee_profile_id} onChange={setPeopleForm('shiftAssignment')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.shiftAssignment.project_id} onChange={setPeopleForm('shiftAssignment')}>
                <option value="">Use shift project</option>
                {projectOptions()}
              </Select>
              <Field label="Starts on" type="date" name="starts_on" value={forms.shiftAssignment.starts_on} onChange={setPeopleForm('shiftAssignment')} required />
              <Field label="Ends on" type="date" name="ends_on" value={forms.shiftAssignment.ends_on} onChange={setPeopleForm('shiftAssignment')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Assign shift
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Active Shifts" />
            <DataTable columns={['Code', 'Name', 'Type', 'Time', 'Branch', 'Project', 'Status']} rows={(people.shifts || []).map((shift) => [shift.shift_code, shift.name, labelize(shift.shift_type), `${shift.start_time} - ${shift.end_time}`, shift.branch?.name || '', shift.project?.name || '', <Badge key="status" value={shift.status} />])} />
          </section>

          <section className="panel">
            <PanelTitle icon={Users} title="Shift Assignments" />
            <DataTable columns={['Employee', 'Shift', 'Project', 'Dates', 'Status']} rows={(people.shift_assignments || []).map((assignment) => [assignment.employee_profile?.user?.name || '', assignment.shift?.name || '', assignment.project?.name || '', `${shortDate(assignment.starts_on)} - ${shortDate(assignment.ends_on)}`, <Badge key="status" value={assignment.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'timesheets' && (
        <>
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Timesheet Entry" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'timesheet',
                  api.createTimesheet,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    project_id: numberOrNull(form.project_id),
                    shift_id: numberOrNull(form.shift_id),
                    hours_worked: Number(form.hours_worked || 0),
                    overtime_hours: Number(form.overtime_hours || 0),
                    cost_rate: numberOrNull(form.cost_rate),
                  }),
                  'Timesheet submitted.',
                  { employee_profile_id: forms.timesheet.employee_profile_id, project_id: forms.timesheet.project_id, shift_id: forms.timesheet.shift_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.timesheet.employee_profile_id} onChange={setPeopleForm('timesheet')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.timesheet.project_id} onChange={setPeopleForm('timesheet')}>
                <option value="">Unassigned</option>
                {projectOptions()}
              </Select>
              <Select label="Shift" name="shift_id" value={forms.timesheet.shift_id} onChange={setPeopleForm('timesheet')}>
                <option value="">No shift</option>
                {(people.shifts || []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </Select>
              <Field label="Date" type="date" name="work_date" value={forms.timesheet.work_date} onChange={setPeopleForm('timesheet')} required />
              <Field label="Hours worked" type="number" step="0.25" name="hours_worked" value={forms.timesheet.hours_worked} onChange={setPeopleForm('timesheet')} required />
              <Field label="Overtime hours" type="number" step="0.25" name="overtime_hours" value={forms.timesheet.overtime_hours} onChange={setPeopleForm('timesheet')} />
              <Field label="Cost rate" type="number" name="cost_rate" value={forms.timesheet.cost_rate} onChange={setPeopleForm('timesheet')} />
              <TextArea label="Notes" className="span-2" name="notes" value={forms.timesheet.notes} onChange={setPeopleForm('timesheet')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Submit timesheet
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Timesheets" />
            <DataTable
              columns={['No.', 'Employee', 'Project', 'Date', 'Hours', 'Overtime', 'Cost', 'Status', 'Action']}
              rows={timesheets.map((sheet) => [
                sheet.timesheet_number,
                sheet.employee_profile?.user?.name || '',
                sheet.project?.name || '',
                shortDate(sheet.work_date),
                sheet.hours_worked,
                sheet.overtime_hours,
                money(sheet.cost_amount),
                <Badge key="status" value={sheet.status} />,
                sheet.status === 'submitted' ? (
                  <div key="actions" className="row-actions">
                    <button type="button" className="table-action" onClick={() => runAction(() => api.reviewTimesheet(sheet.id, { status: 'approved' }), 'Timesheet approved.')}>Approve</button>
                    <button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewTimesheet(sheet.id, { status: 'rejected' }), 'Timesheet rejected.')}>Reject</button>
                  </div>
                ) : '',
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'allocation' && (
        <>
          <section className="panel">
            <PanelTitle icon={MapPinned} title="Workforce Allocation" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'allocation',
                  api.createWorkforceAllocation,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    project_id: Number(form.project_id),
                    supervisor_id: numberOrNull(form.supervisor_id),
                    allocation_percent: Number(form.allocation_percent || 100),
                  }),
                  'Workforce allocation created.',
                  { project_id: forms.allocation.project_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.allocation.employee_profile_id} onChange={setPeopleForm('allocation')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.allocation.project_id} onChange={setPeopleForm('allocation')} required>
                <option value="">Select</option>
                {projectOptions()}
              </Select>
              <Select label="Supervisor" name="supervisor_id" value={forms.allocation.supervisor_id} onChange={setPeopleForm('allocation')}>
                <option value="">No supervisor</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Field label="Role on site" name="role" value={forms.allocation.role} onChange={setPeopleForm('allocation')} />
              <Field label="Allocation %" type="number" min="1" max="100" name="allocation_percent" value={forms.allocation.allocation_percent} onChange={setPeopleForm('allocation')} />
              <Field label="Start date" type="date" name="start_date" value={forms.allocation.start_date} onChange={setPeopleForm('allocation')} required />
              <Field label="End date" type="date" name="end_date" value={forms.allocation.end_date} onChange={setPeopleForm('allocation')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Allocate workforce
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={MapPinned} title="Project Workforce" />
            <DataTable columns={['No.', 'Employee', 'Project', 'Role', 'Supervisor', 'Allocation', 'Dates', 'Status']} rows={allocations.map((allocation) => [allocation.allocation_number, allocation.employee_profile?.user?.name || '', allocation.project?.name || '', allocation.role, allocation.supervisor?.name || '', `${allocation.allocation_percent}%`, `${shortDate(allocation.start_date)} - ${shortDate(allocation.end_date)}`, <Badge key="status" value={allocation.status} />])} />
          </section>
        </>
      )}

      {activeTab === 'leave' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Leave Request" />
            <form className="form-grid two" onSubmit={createLeaveRequest}>
              <Select label="Employee" name="employee_profile_id" value={forms.leave.employee_profile_id} onChange={setPeopleForm('leave')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Leave type" name="leave_type" value={forms.leave.leave_type} onChange={setPeopleForm('leave')}>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
                <option value="maternity">Maternity</option>
                <option value="paternity">Paternity</option>
                <option value="compassionate">Compassionate</option>
                <option value="study">Study</option>
                <option value="half_day">Half day</option>
                <option value="emergency">Emergency</option>
              </Select>
              <Field label="Start" type="date" name="starts_on" value={forms.leave.starts_on} onChange={setPeopleForm('leave')} required />
              <Field label="End" type="date" name="ends_on" value={forms.leave.ends_on} onChange={setPeopleForm('leave')} required />
              <TextArea label="Reason" className="span-2" name="reason" value={forms.leave.reason} onChange={setPeopleForm('leave')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Request leave
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={CalendarDays} title="Leave Approvals" />
            <DataTable
              columns={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Action']}
              rows={(people.leave_requests || []).map((leave) => [
                leave.employee_profile?.user?.name || '',
                labelize(leave.leave_type),
                `${shortDate(leave.starts_on)} - ${shortDate(leave.ends_on)}`,
                leave.days,
                <Badge key="status" value={leave.status} />,
                leave.status === 'pending' ? (
                  <div key="actions" className="row-actions">
                    <button type="button" className="table-action" onClick={() => runAction(() => api.reviewLeaveRequest(leave.id, { status: 'approved' }), 'Leave approved.')}>Approve</button>
                    <button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewLeaveRequest(leave.id, { status: 'rejected' }), 'Leave rejected.')}>Reject</button>
                  </div>
                ) : '',
              ])}
            />
          </section>
        </div>
      )}

      {activeTab === 'overtime' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Clock3} title="Overtime Request" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'overtime',
                  api.createOvertimeRequest,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    project_id: numberOrNull(form.project_id),
                    hours: Number(form.hours || 0),
                  }),
                  'Overtime request submitted.',
                  { employee_profile_id: forms.overtime.employee_profile_id, project_id: forms.overtime.project_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.overtime.employee_profile_id} onChange={setPeopleForm('overtime')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.overtime.project_id} onChange={setPeopleForm('overtime')}>
                <option value="">Unassigned</option>
                {projectOptions()}
              </Select>
              <Field label="Date" type="date" name="work_date" value={forms.overtime.work_date} onChange={setPeopleForm('overtime')} required />
              <Field label="Hours" type="number" step="0.25" name="hours" value={forms.overtime.hours} onChange={setPeopleForm('overtime')} required />
              <TextArea label="Reason" className="span-2" name="reason" value={forms.overtime.reason} onChange={setPeopleForm('overtime')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Submit overtime
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Clock3} title="Overtime Approvals" />
            <DataTable
              columns={['No.', 'Employee', 'Project', 'Date', 'Hours', 'Status', 'Action']}
              rows={overtimeRequests.map((request) => [
                request.request_number,
                request.employee_profile?.user?.name || '',
                request.project?.name || '',
                shortDate(request.work_date),
                request.hours,
                <Badge key="status" value={request.status} />,
                request.status === 'pending' ? (
                  <div key="actions" className="row-actions">
                    <button type="button" className="table-action" onClick={() => runAction(() => api.reviewOvertimeRequest(request.id, { status: 'approved' }), 'Overtime approved.')}>Approve</button>
                    <button type="button" className="table-action danger" onClick={() => runAction(() => api.reviewOvertimeRequest(request.id, { status: 'rejected' }), 'Overtime rejected.')}>Reject</button>
                  </div>
                ) : '',
              ])}
            />
          </section>
        </div>
      )}

      {activeTab === 'payroll' && (
        <>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Payroll Run" />
            <form className="form-grid two" onSubmit={createPayrollRun}>
              <Select label="Branch" name="branch_id" value={forms.payroll.branch_id} onChange={setPeopleForm('payroll')}>
                <option value="">All branches</option>
                {branchOptions()}
              </Select>
              <Field label="Period start" type="date" name="period_start" value={forms.payroll.period_start} onChange={setPeopleForm('payroll')} required />
              <Field label="Period end" type="date" name="period_end" value={forms.payroll.period_end} onChange={setPeopleForm('payroll')} required />
              <button type="submit" className="primary-action">
                <WalletCards size={17} />
                Run payroll
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Payroll Linked To Finance" />
            <DataTable
              columns={['Run', 'Period', 'Status', 'Finance', 'Gross', 'Deductions', 'Net', 'Action']}
              rows={(people.payroll_runs || []).map((run) => [
                run.run_number,
                `${shortDate(run.period_start)} - ${shortDate(run.period_end)}`,
                <Badge key="status" value={run.status} />,
                <Badge key="finance" value={run.finance_status || 'forecast_in_finance'} />,
                money(run.gross_pay),
                money(run.total_deductions),
                money(run.net_pay),
                run.status === 'draft' ? (
                  <button key="approve" type="button" className="table-action" onClick={() => runAction(() => api.approvePayrollRun(run.id), 'Payroll approved and posted to Finance.')}>
                    Approve
                  </button>
                ) : run.status === 'approved' ? (
                  <button key="pay" type="button" className="table-action" onClick={() => runAction(() => api.approvePayrollRun(run.id, { status: 'paid' }), 'Payroll marked paid and posted to Finance.')}>
                    Mark paid
                  </button>
                ) : (
                  ''
                ),
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'benefits' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Employee Benefit" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'benefit',
                  api.createWorkforceBenefit,
                  (form) => ({ ...form, employee_profile_id: Number(form.employee_profile_id), amount: Number(form.amount || 0) }),
                  'Benefit assigned.',
                  { employee_profile_id: forms.benefit.employee_profile_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.benefit.employee_profile_id} onChange={setPeopleForm('benefit')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Field label="Benefit type" name="benefit_type" value={forms.benefit.benefit_type} onChange={setPeopleForm('benefit')} required />
              <Field label="Provider" name="provider" value={forms.benefit.provider} onChange={setPeopleForm('benefit')} />
              <Field label="Amount" type="number" name="amount" value={forms.benefit.amount} onChange={setPeopleForm('benefit')} />
              <Field label="Starts on" type="date" name="starts_on" value={forms.benefit.starts_on} onChange={setPeopleForm('benefit')} />
              <Field label="Ends on" type="date" name="ends_on" value={forms.benefit.ends_on} onChange={setPeopleForm('benefit')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Assign benefit
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Benefits Register" />
            <DataTable columns={['Employee', 'Benefit', 'Provider', 'Amount', 'Dates', 'Status']} rows={(people.benefits || []).map((benefit) => [benefit.employee_profile?.user?.name || '', labelize(benefit.benefit_type), benefit.provider || '', money(benefit.amount), `${shortDate(benefit.starts_on)} - ${shortDate(benefit.ends_on)}`, <Badge key="status" value={benefit.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Performance Review" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'performance',
                  api.createPerformanceReview,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    safety_score: Number(form.safety_score || 0),
                    quality_score: Number(form.quality_score || 0),
                    productivity_score: Number(form.productivity_score || 0),
                    teamwork_score: Number(form.teamwork_score || 0),
                  }),
                  'Performance review saved.',
                  { employee_profile_id: forms.performance.employee_profile_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.performance.employee_profile_id} onChange={setPeopleForm('performance')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Field label="Period start" type="date" name="period_start" value={forms.performance.period_start} onChange={setPeopleForm('performance')} />
              <Field label="Period end" type="date" name="period_end" value={forms.performance.period_end} onChange={setPeopleForm('performance')} />
              <Field label="Safety" type="number" min="0" max="5" name="safety_score" value={forms.performance.safety_score} onChange={setPeopleForm('performance')} />
              <Field label="Quality" type="number" min="0" max="5" name="quality_score" value={forms.performance.quality_score} onChange={setPeopleForm('performance')} />
              <Field label="Productivity" type="number" min="0" max="5" name="productivity_score" value={forms.performance.productivity_score} onChange={setPeopleForm('performance')} />
              <Field label="Teamwork" type="number" min="0" max="5" name="teamwork_score" value={forms.performance.teamwork_score} onChange={setPeopleForm('performance')} />
              <TextArea label="Goals" className="span-2" name="goals" value={forms.performance.goals} onChange={setPeopleForm('performance')} />
              <TextArea label="Notes" className="span-2" name="notes" value={forms.performance.notes} onChange={setPeopleForm('performance')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Save review
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Performance Records" />
            <DataTable columns={['No.', 'Employee', 'Period', 'Safety', 'Quality', 'Productivity', 'Teamwork', 'Overall']} rows={(people.performance_reviews || []).map((review) => [review.review_number, review.employee_profile?.user?.name || '', `${shortDate(review.period_start)} - ${shortDate(review.period_end)}`, review.safety_score, review.quality_score, review.productivity_score, review.teamwork_score, review.overall_score])} />
          </section>
        </div>
      )}

      {activeTab === 'users_roles' && (
        <>
          <div className="grid-main">
            <section className="panel">
              <PanelTitle icon={ShieldCheck} title="Create User Role" />
              <form className="form-grid two" onSubmit={saveHrRole}>
                <Field label="Role name" name="name" value={accessForms.role.name} onChange={setAccessFormValue('role')} required />
                <div className="access-selector span-2">
                  <div className="access-selector-head">
                    <span>Permitted Categories</span>
                    <div className="row-actions">
                      <button type="button" className="table-action" onClick={() => setAllAccessFor('role')}>
                        Grant all
                      </button>
                      <button type="button" className="table-action" onClick={() => clearAccessFor('role')}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="access-grid">
                    {accessCategories.map((category) => (
                      <label key={category.id} className="access-option">
                        <input
                          type="checkbox"
                          checked={hasCategoryPermissions(hrRolePermissions, category)}
                          onChange={() => toggleAccessCategoryFor('role', category)}
                        />
                        <span>
                          <strong>{category.label}</strong>
                          <small>{category.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="row-actions span-2">
                  <button type="submit" className="primary-action">
                    {isEditingHrRole ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                    {isEditingHrRole ? 'Save role' : 'Add role'}
                  </button>
                  {isEditingHrRole && (
                    <button type="button" className="table-action" onClick={() => setAccessForms((current) => ({ ...current, role: hrRoleReset }))}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
              <DataTable
                columns={['Role', 'Access', 'Type', 'Actions']}
                rows={roles.map((role) => [
                  roleLabel(role),
                  permissionCategorySummary(rolePermissions(role)),
                  role.is_system ? 'System' : 'Custom',
                  role.is_system ? (
                    ''
                  ) : (
                    <div key="actions" className="row-actions">
                      <button type="button" className="table-action" onClick={() => editHrRole(role)}>
                        Edit
                      </button>
                      <button type="button" className="table-action danger" onClick={() => deleteHrRole(role)}>
                        Delete
                      </button>
                    </div>
                  ),
                ])}
              />
            </section>

            <section className="panel">
              <PanelTitle icon={Users} title="Users & Roles" />
              <form className="form-grid user-form" onSubmit={saveHrUser} autoComplete="off">
                <Field label="Name" name="name" value={accessForms.user.name} onChange={setAccessFormValue('user')} required />
                <Field label="Email" type="email" name="company_user_invite_email" value={accessForms.user.email} onChange={setAccessUserField('email')} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" required />
                <Field label="Password" type="password" name="company_user_temporary_password" value={accessForms.user.password} onChange={setAccessUserField('password')} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" required={!isEditingHrUser} placeholder={isEditingHrUser ? 'Leave blank to keep current' : 'Enter a secure temporary password'} />
                <Select label="Branch" name="branch_id" value={accessForms.user.branch_id} onChange={setAccessFormValue('user')}>
                  {branchOptions()}
                </Select>
                <Field label="Role" name="role_name" value={accessForms.user.role_name} onChange={setAccessFormValue('user')} placeholder="Type this company user's role" required />
                <Select label="Status" name="status" value={accessForms.user.status} onChange={setAccessFormValue('user')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
                <div className="access-selector span-2">
                  <div className="access-selector-head">
                    <span>Permitted Categories</span>
                    <div className="row-actions">
                      <button type="button" className="table-action" onClick={() => setAllAccessFor('user')}>
                        Grant all
                      </button>
                      <button type="button" className="table-action" onClick={() => clearAccessFor('user')}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="access-grid">
                    {accessCategories.map((category) => (
                      <label key={category.id} className="access-option">
                        <input
                          type="checkbox"
                          checked={hasCategoryPermissions(hrUserPermissions, category)}
                          onChange={() => toggleAccessCategoryFor('user', category)}
                        />
                        <span>
                          <strong>{category.label}</strong>
                          <small>{category.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="row-actions span-2">
                  <button type="submit" className="primary-action">
                    {isEditingHrUser ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                    {isEditingHrUser ? 'Save user' : 'Add user'}
                  </button>
                  {isEditingHrUser && (
                    <button type="button" className="table-action" onClick={() => setAccessForms((current) => ({ ...current, user: hrUserReset() }))}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>

          <section className="panel">
            <PanelTitle icon={Users} title="User Access Register" />
            <DataTable
              columns={['Name', 'Email', 'Role', 'Access', 'Branch', 'Status', 'Actions']}
              rows={users.map((item) => [
                item.name,
                item.email,
                roleLabel(item.role),
                permissionCategorySummary(explicitUserPermissions(item)),
                item.branch?.name,
                <Badge key="status" value={item.status} />,
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => editHrUser(item)}>
                    Edit
                  </button>
                  <button type="button" className="table-action danger" onClick={() => deleteHrUser(item)} disabled={item.id === currentUser?.id}>
                    Delete
                  </button>
                </div>,
              ])}
            />
          </section>
        </>
      )}

      {activeTab === 'training' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Training Course" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'trainingCourse',
                  api.createTrainingCourse,
                  (form) => ({ ...form, duration_hours: Number(form.duration_hours || 0) }),
                  'Training course created.',
                )
              }
            >
              <Field label="Title" name="title" value={forms.trainingCourse.title} onChange={setPeopleForm('trainingCourse')} required />
              <Field label="Category" name="category" value={forms.trainingCourse.category} onChange={setPeopleForm('trainingCourse')} />
              <Field label="Provider" name="provider" value={forms.trainingCourse.provider} onChange={setPeopleForm('trainingCourse')} />
              <Field label="Duration hours" type="number" name="duration_hours" value={forms.trainingCourse.duration_hours} onChange={setPeopleForm('trainingCourse')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Create course
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={CheckCircle2} title="Training Record" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'trainingRecord',
                  api.createTrainingRecord,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    training_course_id: Number(form.training_course_id),
                    score: Number(form.score || 0),
                  }),
                  'Training record saved.',
                  { employee_profile_id: forms.trainingRecord.employee_profile_id, training_course_id: forms.trainingRecord.training_course_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.trainingRecord.employee_profile_id} onChange={setPeopleForm('trainingRecord')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Course" name="training_course_id" value={forms.trainingRecord.training_course_id} onChange={setPeopleForm('trainingRecord')} required>
                <option value="">Select</option>
                {trainingCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
              <Select label="Status" name="status" value={forms.trainingRecord.status} onChange={setPeopleForm('trainingRecord')}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
              <Field label="Scheduled on" type="date" name="scheduled_on" value={forms.trainingRecord.scheduled_on} onChange={setPeopleForm('trainingRecord')} />
              <Field label="Completed on" type="date" name="completed_on" value={forms.trainingRecord.completed_on} onChange={setPeopleForm('trainingRecord')} />
              <Field label="Score" type="number" min="0" max="100" name="score" value={forms.trainingRecord.score} onChange={setPeopleForm('trainingRecord')} />
              <Field label="Certificate number" name="certificate_number" value={forms.trainingRecord.certificate_number} onChange={setPeopleForm('trainingRecord')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Save training record
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Training Matrix" />
            <DataTable columns={['Employee', 'Course', 'Status', 'Scheduled', 'Completed', 'Score']} rows={trainingRecords.map((record) => [record.employee_profile?.user?.name || '', record.course?.title || '', <Badge key="status" value={record.status} />, shortDate(record.scheduled_on), shortDate(record.completed_on), record.score])} />
          </section>
        </div>
      )}

      {activeTab === 'certifications' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={FileText} title="Certification" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'certification',
                  api.createCertification,
                  (form) => ({ ...form, employee_profile_id: Number(form.employee_profile_id) }),
                  'Certification recorded.',
                  { employee_profile_id: forms.certification.employee_profile_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.certification.employee_profile_id} onChange={setPeopleForm('certification')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Field label="Certification" name="name" value={forms.certification.name} onChange={setPeopleForm('certification')} required />
              <Field label="Issuing authority" name="issuing_authority" value={forms.certification.issuing_authority} onChange={setPeopleForm('certification')} />
              <Field label="Issued on" type="date" name="issued_on" value={forms.certification.issued_on} onChange={setPeopleForm('certification')} />
              <Field label="Expires on" type="date" name="expires_on" value={forms.certification.expires_on} onChange={setPeopleForm('certification')} />
              <Field label="Document path" name="document_path" value={forms.certification.document_path} onChange={setPeopleForm('certification')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Record certification
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={FileText} title="Certification Register" />
            <DataTable columns={['No.', 'Employee', 'Certification', 'Authority', 'Issued', 'Expires', 'Status']} rows={certifications.map((cert) => [cert.certification_number, cert.employee_profile?.user?.name || '', cert.name, cert.issuing_authority || '', shortDate(cert.issued_on), shortDate(cert.expires_on), <Badge key="status" value={cert.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ShieldCheck} title="Workforce Health & Safety" />
            <DataTable columns={['Indicator', 'Value']} rows={[['PPE records', ppeIssues.length], ['PPE due for replacement', people.health_safety?.expiring_ppe?.length || 0], ['Certification risk', people.health_safety?.certification_risk?.length || 0], ['Training compliance', `${people.summary?.training_compliance || 0}%`], ['Overtime hours', people.summary?.overtime_hours || 0]]} />
          </section>
          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Certification Risk" />
            <DataTable columns={['Employee', 'Certification', 'Expires', 'Status']} rows={(people.health_safety?.certification_risk || []).map((cert) => [cert.employee_profile?.user?.name || '', cert.name, shortDate(cert.expires_on), <Badge key="status" value={cert.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'ppe' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Package} title="PPE Issue" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'ppeIssue',
                  api.createPpeIssue,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    project_id: numberOrNull(form.project_id),
                    quantity: Number(form.quantity || 1),
                  }),
                  'PPE issued.',
                  { employee_profile_id: forms.ppeIssue.employee_profile_id, project_id: forms.ppeIssue.project_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.ppeIssue.employee_profile_id} onChange={setPeopleForm('ppeIssue')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Project" name="project_id" value={forms.ppeIssue.project_id} onChange={setPeopleForm('ppeIssue')}>
                <option value="">Company issue</option>
                {projectOptions()}
              </Select>
              <Field label="Item" name="item_name" value={forms.ppeIssue.item_name} onChange={setPeopleForm('ppeIssue')} required />
              <Field label="Size" name="size" value={forms.ppeIssue.size} onChange={setPeopleForm('ppeIssue')} />
              <Field label="Quantity" type="number" step="0.01" name="quantity" value={forms.ppeIssue.quantity} onChange={setPeopleForm('ppeIssue')} />
              <Field label="Issued on" type="date" name="issued_on" value={forms.ppeIssue.issued_on} onChange={setPeopleForm('ppeIssue')} />
              <Field label="Replacement due" type="date" name="replacement_due_on" value={forms.ppeIssue.replacement_due_on} onChange={setPeopleForm('ppeIssue')} />
              <Field label="Condition" name="condition" value={forms.ppeIssue.condition} onChange={setPeopleForm('ppeIssue')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Issue PPE
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Package} title="PPE Register" />
            <DataTable columns={['No.', 'Employee', 'Item', 'Project', 'Issued', 'Due', 'Condition', 'Status']} rows={ppeIssues.map((issue) => [issue.ppe_number, issue.employee_profile?.user?.name || '', issue.item_name, issue.project?.name || '', shortDate(issue.issued_on), shortDate(issue.replacement_due_on), issue.condition, <Badge key="status" value={issue.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'contractors' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Building2} title="Contractor Workforce" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'contractor',
                  api.createWorkforceContractor,
                  (form) => ({ ...form, supplier_id: numberOrNull(form.supplier_id), worker_count: Number(form.worker_count || 0) }),
                  'Contractor added.',
                  { supplier_id: forms.contractor.supplier_id },
                )
              }
            >
              <Select label="Supplier link" name="supplier_id" value={forms.contractor.supplier_id} onChange={setPeopleForm('contractor')}>
                <option value="">Independent contractor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              <Field label="Contractor name" name="name" value={forms.contractor.name} onChange={setPeopleForm('contractor')} required />
              <Field label="Contact" name="contact_name" value={forms.contractor.contact_name} onChange={setPeopleForm('contractor')} />
              <Field label="Email" type="email" name="email" value={forms.contractor.email} onChange={setPeopleForm('contractor')} />
              <Field label="Phone" name="phone" value={forms.contractor.phone} onChange={setPeopleForm('contractor')} />
              <Field label="Trade" name="trade" value={forms.contractor.trade} onChange={setPeopleForm('contractor')} />
              <Field label="Workers" type="number" name="worker_count" value={forms.contractor.worker_count} onChange={setPeopleForm('contractor')} />
              <Field label="Contract expiry" type="date" name="contract_expires_on" value={forms.contractor.contract_expires_on} onChange={setPeopleForm('contractor')} />
              <Field label="Insurance expiry" type="date" name="insurance_expires_on" value={forms.contractor.insurance_expires_on} onChange={setPeopleForm('contractor')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Add contractor
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Building2} title="Contractor Register" />
            <DataTable columns={['No.', 'Name', 'Trade', 'Workers', 'Contract', 'Insurance', 'Compliance', 'Status']} rows={contractors.map((contractor) => [contractor.contractor_number, contractor.name, contractor.trade || '', contractor.worker_count, shortDate(contractor.contract_expires_on), shortDate(contractor.insurance_expires_on), <Badge key="compliance" value={contractor.compliance_status} />, <Badge key="status" value={contractor.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Truck} title="Employee Asset" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'asset',
                  api.createWorkforceAsset,
                  (form) => ({
                    ...form,
                    employee_profile_id: Number(form.employee_profile_id),
                    equipment_asset_id: numberOrNull(form.equipment_asset_id),
                  }),
                  'Employee asset assigned.',
                  { employee_profile_id: forms.asset.employee_profile_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.asset.employee_profile_id} onChange={setPeopleForm('asset')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Equipment link" name="equipment_asset_id" value={forms.asset.equipment_asset_id} onChange={setPeopleForm('asset')}>
                <option value="">No equipment link</option>
                {(people.asset_candidates || []).map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.equipment_number} - {asset.name}
                  </option>
                ))}
              </Select>
              <Field label="Item" name="item_name" value={forms.asset.item_name} onChange={setPeopleForm('asset')} required />
              <Field label="Category" name="category" value={forms.asset.category} onChange={setPeopleForm('asset')} />
              <Field label="Serial number" name="serial_number" value={forms.asset.serial_number} onChange={setPeopleForm('asset')} />
              <Field label="Assigned on" type="date" name="assigned_on" value={forms.asset.assigned_on} onChange={setPeopleForm('asset')} />
              <Field label="Return due" type="date" name="return_due_on" value={forms.asset.return_due_on} onChange={setPeopleForm('asset')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Assign asset
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={Truck} title="Employee Asset Register" />
            <DataTable columns={['No.', 'Employee', 'Item', 'Category', 'Serial', 'Assigned', 'Due', 'Status']} rows={employeeAssets.map((asset) => [asset.asset_number, asset.employee_profile?.user?.name || '', asset.item_name, asset.category, asset.serial_number || '', shortDate(asset.assigned_on), shortDate(asset.return_due_on), <Badge key="status" value={asset.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={FileText} title="Workforce Document" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'document',
                  api.createWorkforceDocument,
                  (form) => ({
                    ...form,
                    employee_profile_id: numberOrNull(form.employee_profile_id),
                    candidate_id: numberOrNull(form.candidate_id),
                  }),
                  'Workforce document registered.',
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.document.employee_profile_id} onChange={setPeopleForm('document')}>
                <option value="">No employee</option>
                {employeeOptions()}
              </Select>
              <Select label="Candidate" name="candidate_id" value={forms.document.candidate_id} onChange={setPeopleForm('document')}>
                <option value="">No candidate</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                  </option>
                ))}
              </Select>
              <Field label="Document type" name="document_type" value={forms.document.document_type} onChange={setPeopleForm('document')} required />
              <Field label="Title" name="title" value={forms.document.title} onChange={setPeopleForm('document')} required />
              <Field label="File reference" name="file_path" value={forms.document.file_path} onChange={setPeopleForm('document')} />
              <Field label="Expiry date" type="date" name="expiry_date" value={forms.document.expiry_date} onChange={setPeopleForm('document')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Register document
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={FileText} title="Document Register" />
            <DataTable columns={['No.', 'Owner', 'Type', 'Title', 'Reference', 'Expiry', 'Status']} rows={documents.map((document) => [document.document_number, document.employee_profile?.user?.name || document.candidate?.full_name || '', labelize(document.document_type), document.title, document.file_path || '', shortDate(document.expiry_date), <Badge key="status" value={document.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'self' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Users} title="Self-Service Profile" />
            <DataTable columns={['Field', 'Value']} rows={[['Employee', selfService.employee?.user?.name || ''], ['Branch', selfService.employee?.branch?.name || ''], ['Project', selfService.employee?.current_project?.name || ''], ['Department', selfService.employee?.department || ''], ['Position', selfService.employee?.position || ''], ['Status', selfService.employee?.status || '']]} />
          </section>
          <section className="panel">
            <PanelTitle icon={WalletCards} title="My Payslips" />
            <DataTable columns={['Gross', 'Overtime', 'Allowances', 'Deductions', 'Net', 'Status']} rows={(selfService.payslips || []).map((payslip) => [money(payslip.gross_pay), money(payslip.overtime_pay), money(payslip.allowances), money(Number(payslip.deductions || 0) + Number(payslip.tax_amount || 0)), money(payslip.net_pay), <Badge key="status" value={payslip.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'manager' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={CheckCircle2} title="Manager Approvals" />
            <DataTable columns={['Type', 'Employee', 'Reference', 'Action']} rows={[
              ...(managerPortal.leave_approvals || []).map((leave) => ['Leave', leave.employee_profile?.user?.name || '', `${shortDate(leave.starts_on)} - ${shortDate(leave.ends_on)}`, <button key={`leave-${leave.id}`} type="button" className="table-action" onClick={() => runAction(() => api.reviewLeaveRequest(leave.id, { status: 'approved' }), 'Leave approved.')}>Approve</button>]),
              ...(managerPortal.overtime_approvals || []).map((item) => ['Overtime', item.employee_profile?.user?.name || '', `${shortDate(item.work_date)} - ${item.hours}h`, <button key={`ot-${item.id}`} type="button" className="table-action" onClick={() => runAction(() => api.reviewOvertimeRequest(item.id, { status: 'approved' }), 'Overtime approved.')}>Approve</button>]),
              ...(managerPortal.timesheet_approvals || []).map((sheet) => ['Timesheet', sheet.employee_profile?.user?.name || '', `${shortDate(sheet.work_date)} - ${sheet.hours_worked}h`, <button key={`ts-${sheet.id}`} type="button" className="table-action" onClick={() => runAction(() => api.reviewTimesheet(sheet.id, { status: 'approved' }), 'Timesheet approved.')}>Approve</button>]),
            ]} />
          </section>
          <section className="panel">
            <PanelTitle icon={Users} title="Performance Due" />
            <DataTable columns={['Employee', 'Department', 'Position']} rows={(managerPortal.performance_due || []).map((employee) => [employee.user?.name || '', employee.department || '', employee.position || ''])} />
          </section>
        </div>
      )}

      {activeTab === 'exit' && (
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={LogOut} title="Exit Record" />
            <form
              className="form-grid two"
              onSubmit={(event) =>
                submitPeopleForm(
                  event,
                  'exit',
                  api.createExitRecord,
                  (form) => ({ ...form, employee_profile_id: Number(form.employee_profile_id) }),
                  'Exit process opened.',
                  { employee_profile_id: forms.exit.employee_profile_id },
                )
              }
            >
              <Select label="Employee" name="employee_profile_id" value={forms.exit.employee_profile_id} onChange={setPeopleForm('exit')} required>
                <option value="">Select</option>
                {employeeOptions()}
              </Select>
              <Select label="Exit type" name="exit_type" value={forms.exit.exit_type} onChange={setPeopleForm('exit')}>
                <option value="resignation">Resignation</option>
                <option value="termination">Termination</option>
                <option value="retirement">Retirement</option>
              </Select>
              <Field label="Notice date" type="date" name="notice_date" value={forms.exit.notice_date} onChange={setPeopleForm('exit')} />
              <Field label="Exit date" type="date" name="exit_date" value={forms.exit.exit_date} onChange={setPeopleForm('exit')} />
              <TextArea label="Reason" className="span-2" name="reason" value={forms.exit.reason} onChange={setPeopleForm('exit')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Open exit process
              </button>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={LogOut} title="Exit Management" />
            <DataTable columns={['No.', 'Employee', 'Type', 'Notice', 'Exit', 'Clearance', 'Status']} rows={exits.map((exit) => [exit.exit_number, exit.employee_profile?.user?.name || '', labelize(exit.exit_type), shortDate(exit.notice_date), shortDate(exit.exit_date), <Badge key="clearance" value={exit.clearance_status} />, <Badge key="status" value={exit.status} />])} />
          </section>
        </div>
      )}

      {activeTab === 'reports' && (
        <section className="view-stack">
          {[
            ['Headcount By Department', 'hr-headcount-by-department.csv', ['department', 'employees'], headcountRows],
            ['Employees By Project', 'hr-employees-by-project.csv', ['project', 'employees'], projectHeadcountRows],
            ['Timesheet Costs', 'hr-timesheet-costs.csv', ['project', 'hours', 'overtime', 'cost'], timesheetCostRows],
            ['Training Matrix', 'hr-training-matrix.csv', ['employee', 'course', 'status', 'completed_on'], trainingMatrixRows],
            ['Certification Expiry', 'hr-certification-expiry.csv', ['employee', 'certification', 'expires_on', 'status'], certificationRows],
            ['Turnover', 'hr-turnover.csv', ['period', 'exits'], turnoverRows],
          ].map(([title, filename, keys, rows]) => (
            <section key={title} className="panel">
              <PanelTitle icon={Download} title={title} />
              <DownloadButton filename={filename} columns={keys.map(labelize)} rows={rows} />
              <DataTable columns={keys.map(labelize)} rows={rows.map((row) => row.map((value, index) => (keys[index] === 'cost' ? money(value) : value)))} />
            </section>
          ))}
        </section>
      )}

      {activeTab === 'analytics' && (
        <>
          <div className="kpi-grid">
            <Kpi icon={WalletCards} label="Average salary" value={money(analytics.average_salary)} sub="Active workforce" />
            <Kpi icon={WalletCards} label="Payroll cost" value={money(analytics.payroll_cost)} sub="Base monthly exposure" />
            <Kpi icon={Clock3} label="Overtime cost" value={money(analytics.overtime_cost)} sub="Approved and submitted sheets" />
            <Kpi icon={ShieldCheck} label="Training compliance" value={`${analytics.training_compliance || 0}%`} sub="Completed training records" />
          </div>
          <div className="grid-main">
            <ChartPanel icon={Users} title="Gender Distribution">
              <AnalyticsPieChart data={analytics.gender_distribution || []} />
            </ChartPanel>
            <ChartPanel icon={Users} title="Age Distribution">
              <AnalyticsBarChart data={analytics.age_distribution || []} bars={[{ key: 'value', color: '#6d5dfc' }]} />
            </ChartPanel>
            <ChartPanel icon={Handshake} title="Hiring Trends">
              <AnalyticsBarChart data={analytics.hiring_trends || []} xKey="period" bars={[{ key: 'applications', color: '#2364d8' }, { key: 'hires', color: '#188a5a' }]} />
            </ChartPanel>
            <ChartPanel icon={LogOut} title="Termination Trends">
              <AnalyticsBarChart data={analytics.termination_trends || []} xKey="period" bars={[{ key: 'exits', color: '#c3382f' }]} />
            </ChartPanel>
          </div>
        </>
      )}

      {activeTab === 'automation' && (
        <section className="panel">
          <PanelTitle icon={Workflow} title="HR Automation" />
          <DataTable
            columns={['Trigger', 'Status', 'Active Workflows']}
            rows={(people.automation?.available_triggers || []).map((trigger) => {
              const item = typeof trigger === 'string' ? { trigger, status: 'not_configured', active_workflows: 0 } : trigger

              return [labelize(item.trigger), <Badge key="status" value={item.status} />, item.active_workflows || 0]
            })}
          />
          <DataTable columns={['Metric', 'Value']} rows={[['Connected workflows', people.automation?.connected_workflows || 0], ['Payroll posting', 'Finance ledger integration'], ['Certification alerts', (people.health_safety?.certification_risk || []).length], ['Attendance exceptions', people.attendance?.summary?.absent_today || 0]]} />
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="panel">
          <PanelTitle icon={Settings} title="HR & Workforce Settings" />
          <DataTable columns={['Setting', 'Value']} rows={Object.entries(people.settings || {}).map(([key, value]) => [labelize(key), typeof value === 'object' ? JSON.stringify(value) : String(value)])} />
        </section>
      )}
    </section>
  )
}

function EquipmentView({
  branches,
  projects,
  equipment,
  forms,
  setEquipmentForm,
  createEquipmentAsset,
  assignEquipment,
  createMaintenanceLog,
  createFuelLog,
  runAction,
}) {
  return (
    <section className="view-stack">
      <div className="kpi-grid">
        <Kpi icon={Truck} label="Available" value={equipment.summary?.available || 0} sub="Ready assets" />
        <Kpi icon={MapPinned} label="Assigned" value={equipment.summary?.assigned || 0} sub="On projects" />
        <Kpi icon={AlertTriangle} label="Maintenance" value={equipment.summary?.maintenance || 0} sub="Unavailable" />
        <Kpi icon={WalletCards} label="Fuel cost" value={money(equipment.summary?.fuel_cost)} sub="Logged fuel" />
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Truck} title="Asset Register" />
          <form className="form-grid two" onSubmit={createEquipmentAsset}>
            <Select label="Branch" name="branch_id" value={forms.asset.branch_id} onChange={setEquipmentForm('asset')} required>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Field label="Name" name="name" value={forms.asset.name} onChange={setEquipmentForm('asset')} required />
            <Field label="Category" name="category" value={forms.asset.category} onChange={setEquipmentForm('asset')} />
            <Field label="Meter" type="number" name="meter_reading" value={forms.asset.meter_reading} onChange={setEquipmentForm('asset')} />
            <Field label="Hourly rate" type="number" name="hourly_rate" value={forms.asset.hourly_rate} onChange={setEquipmentForm('asset')} />
            <button type="submit" className="primary-action">
              <Plus size={17} />
              Add asset
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={MapPinned} title="Assign Equipment" />
          <form className="form-grid two" onSubmit={assignEquipment}>
            <Select label="Asset" name="asset_id" value={forms.assignment.asset_id} onChange={setEquipmentForm('assignment')} required>
              <option value="">Select</option>
              {(equipment.assets || []).filter((asset) => asset.status === 'available').map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.equipment_number} - {asset.name}
                </option>
              ))}
            </Select>
            <Select label="Project" name="project_id" value={forms.assignment.project_id} onChange={setEquipmentForm('assignment')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Meter start" type="number" name="meter_start" value={forms.assignment.meter_start} onChange={setEquipmentForm('assignment')} />
            <button type="submit" className="primary-action">
              <Send size={17} />
              Assign
            </button>
          </form>
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Maintenance" />
          <form className="form-grid two" onSubmit={createMaintenanceLog}>
            <Select label="Asset" name="asset_id" value={forms.maintenance.asset_id} onChange={setEquipmentForm('maintenance')} required>
              <option value="">Select</option>
              {(equipment.assets || []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </Select>
            <Select label="Status" name="status" value={forms.maintenance.status} onChange={setEquipmentForm('maintenance')}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </Select>
            <Field label="Service date" type="date" name="service_date" value={forms.maintenance.service_date} onChange={setEquipmentForm('maintenance')} required />
            <Field label="Cost" type="number" name="cost_amount" value={forms.maintenance.cost_amount} onChange={setEquipmentForm('maintenance')} />
            <Field className="span-2" label="Description" name="description" value={forms.maintenance.description} onChange={setEquipmentForm('maintenance')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Log maintenance
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Fuel Log" />
          <form className="form-grid two" onSubmit={createFuelLog}>
            <Select label="Asset" name="asset_id" value={forms.fuel.asset_id} onChange={setEquipmentForm('fuel')} required>
              <option value="">Select</option>
              {(equipment.assets || []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </Select>
            <Select label="Project" name="project_id" value={forms.fuel.project_id} onChange={setEquipmentForm('fuel')}>
              <option value="">Current project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Qty" type="number" name="quantity" value={forms.fuel.quantity} onChange={setEquipmentForm('fuel')} required />
            <Field label="Unit cost" type="number" name="unit_cost" value={forms.fuel.unit_cost} onChange={setEquipmentForm('fuel')} />
            <Field label="Meter" type="number" name="meter_reading" value={forms.fuel.meter_reading} onChange={setEquipmentForm('fuel')} />
            <button type="submit" className="primary-action">
              <Plus size={17} />
              Record fuel
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={Truck} title="Assets" />
        <DataTable
          columns={['No.', 'Asset', 'Category', 'Status', 'Project', 'Meter', 'Rate']}
          rows={(equipment.assets || []).map((asset) => [
            asset.equipment_number,
            asset.name,
            labelize(asset.category),
            <Badge key="status" value={asset.status} />,
            asset.current_project?.name || '',
            asset.meter_reading,
            money(asset.hourly_rate),
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={MapPinned} title="Assignments" />
        <DataTable
          columns={['No.', 'Asset', 'Project', 'Status', 'Start', 'Action']}
          rows={(equipment.assignments || []).map((assignment) => [
            assignment.assignment_number,
            assignment.asset?.name || '',
            assignment.project?.name || '',
            <Badge key="status" value={assignment.status} />,
            shortDate(assignment.starts_at),
            assignment.status === 'active' ? (
              <button key="release" type="button" className="table-action" onClick={() => runAction(() => api.releaseEquipmentAssignment(assignment.id), 'Equipment released.')}>
                Release
              </button>
            ) : (
              ''
            ),
          ])}
        />
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Maintenance Register" />
          <DataTable
            columns={['No.', 'Asset', 'Status', 'Service date', 'Cost']}
            rows={(equipment.maintenance || []).map((item) => [
              item.maintenance_number,
              item.asset?.name || '',
              <Badge key="status" value={item.status} />,
              shortDate(item.service_date),
              money(item.cost_amount),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Fuel Register" />
          <DataTable
            columns={['No.', 'Asset', 'Project', 'Qty', 'Total']}
            rows={(equipment.fuel_logs || []).map((item) => [
              item.fuel_number,
              item.asset?.name || '',
              item.project?.name || '',
              `${item.quantity} ${item.unit}`,
              money(item.total_cost),
            ])}
          />
        </section>
      </div>
    </section>
  )
}

function ComplianceView({
  projects,
  compliance,
  forms,
  setComplianceForm,
  createInspection,
  createNcr,
  createSafetyIncident,
  createToolboxTalk,
  createSafetyObservation,
  createWorkPermit,
  runAction,
}) {
  const inspections = compliance.inspections || []
  const ncrs = compliance.ncrs || []
  const incidents = compliance.incidents || []
  const observations = compliance.observations || []
  const permits = compliance.permits || []
  const talks = compliance.toolbox_talks || []
  const qaTypes = ['quality', 'workmanship', 'materials', 'handover']
  const hseTypes = ['safety', 'environmental', 'ppe', 'fire']
  const qualityInspections = inspections.filter((inspection) => qaTypes.includes(inspection.type))
  const safetyInspections = inspections.filter((inspection) => hseTypes.includes(inspection.type))
  const riskAssessments = inspections.filter((inspection) => inspection.type === 'risk_assessment')
  const snagPunchInspections = inspections.filter((inspection) => ['snagging', 'punch_list'].includes(inspection.type))
  const nearMisses = incidents.filter((incident) => incident.incident_type === 'near_miss')
  const overdueNcrs = ncrs.filter((ncr) => ncr.status !== 'closed' && ncr.due_date && new Date(ncr.due_date) < new Date())
  const expiringPermits = permits.filter((permit) => permit.status !== 'closed' && permit.valid_until && new Date(permit.valid_until) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
  const openCapa = [
    ...ncrs.filter((ncr) => ncr.status !== 'closed').map((ncr) => ({ type: 'Non-Conformance Report(NCR)', id: ncr.id, number: ncr.ncr_number, title: ncr.title, severity: ncr.severity, status: ncr.status, due: ncr.due_date })),
    ...incidents.filter((incident) => incident.status !== 'closed').map((incident) => ({ type: 'Incident', id: incident.id, number: incident.incident_number, title: incident.description, severity: incident.severity, status: incident.status, due: null })),
    ...observations.filter((observation) => observation.status !== 'closed').map((observation) => ({ type: 'Observation', id: observation.id, number: observation.observation_number, title: observation.description, severity: observation.severity, status: observation.status, due: null })),
  ]
  const checklistItems = inspections.flatMap((inspection) => (inspection.items || []).map((item) => ({ ...item, inspection })))
  const qualityChecklistItems = checklistItems.filter((item) => qaTypes.includes(item.inspection.type))
  const safetyChecklistItems = checklistItems.filter((item) => [...hseTypes, 'risk_assessment'].includes(item.inspection.type))
  const snagPunchItems = snagPunchInspections.flatMap((inspection) => (inspection.items || []).map((item) => ({ ...item, inspection })))
  const openObservationCount = observations.filter((observation) => observation.status !== 'closed').length
  const openIncidentCount = incidents.filter((incident) => incident.status !== 'closed').length
  const ncrReportColumns = ['Non-Conformance Report(NCR)', 'Project', 'Department', 'Category', 'Title', 'Location', 'Contractor', 'Subcontractor', 'Severity', 'Status', 'Due date', 'Description', 'Root cause', 'Corrective action', 'Preventive action', 'Verification notes']
  const ncrReportRows = ncrs.map((ncr) => [
    ncr.ncr_number || '',
    ncr.project?.name || '',
    labelize(ncr.department || ''),
    labelize(ncr.category || ''),
    ncr.title || '',
    ncr.location || '',
    ncr.contractor || '',
    ncr.subcontractor || '',
    labelize(ncr.severity || ''),
    labelize(ncr.status || ''),
    shortDate(ncr.due_date),
    ncr.description || '',
    ncr.root_cause || '',
    ncr.corrective_action || '',
    ncr.preventive_action || '',
    ncr.verification_notes || '',
  ])
  const incidentReportColumns = ['No.', 'Type', 'Project', 'Location', 'Severity', 'Status', 'Occurred', 'Injured person', 'Description', 'Immediate action', 'Root cause', 'Corrective action']
  const incidentReportRows = incidents.map((incident) => [
    incident.incident_number || '',
    labelize(incident.incident_type || ''),
    incident.project?.name || '',
    incident.location || '',
    labelize(incident.severity || ''),
    labelize(incident.status || ''),
    shortDate(incident.occurred_at),
    incident.injured_person || '',
    incident.description || '',
    incident.immediate_action || '',
    incident.root_cause || '',
    incident.corrective_action || '',
  ])
  const observationReportColumns = ['Observation', 'Type', 'Project', 'Location', 'Severity', 'Status', 'Observed', 'Description', 'Corrective action']
  const observationReportRows = observations.map((observation) => [
    observation.observation_number || '',
    labelize(observation.observation_type || ''),
    observation.project?.name || '',
    observation.location || '',
    labelize(observation.severity || ''),
    labelize(observation.status || ''),
    shortDate(observation.observed_at),
    observation.description || '',
    observation.corrective_action || '',
  ])
  const qaHseReportColumns = ['Report', 'Count', 'Open / Due']
  const qaHseReportRows = [
    ['Non-Conformance Reports(NCRs)', ncrs.length, compliance.summary?.open_ncrs || 0],
    ['Near misses', nearMisses.length, nearMisses.filter((item) => item.status !== 'closed').length],
    ['Incidents', incidents.length, openIncidentCount],
    ['Observations', observations.length, openObservationCount],
    ['Permits expiring in 3 days', expiringPermits.length, expiringPermits.map((permit) => permit.permit_number).join(', ')],
    ['Snag / punch list items', snagPunchItems.length, snagPunchItems.filter((item) => item.result === 'fail').length],
  ]

  return (
    <section className="view-stack">
      <div className="kpi-grid">
        <Kpi icon={ClipboardList} label="Quality Assurance inspections" value={qualityInspections.length} sub={`${compliance.summary?.failed_inspections || 0} failed`} />
        <Kpi icon={ShieldCheck} label="Health, Safety, and Environment records" value={safetyInspections.length + incidents.length + observations.length} sub={`${openIncidentCount} open incidents`} />
        <Kpi icon={AlertTriangle} label="Open Non-Conformance Reports(NCRs)" value={compliance.summary?.open_ncrs || 0} sub={`${overdueNcrs.length} overdue`} />
        <Kpi icon={CheckCircle2} label="Open CAPA" value={openCapa.length} sub={`${openObservationCount} observations`} />
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Site Inspection" />
          <form className="form-grid two" onSubmit={createInspection}>
            <Select label="Project" name="project_id" value={forms.inspection.project_id} onChange={setComplianceForm('inspection')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Inspection type" name="type" value={forms.inspection.type} onChange={setComplianceForm('inspection')}>
              <option value="quality">Quality inspection</option>
              <option value="materials">Material inspection</option>
              <option value="workmanship">Workmanship inspection</option>
              <option value="safety">Safety inspection</option>
              <option value="ppe">PPE inspection</option>
              <option value="fire">Fire drill / fire inspection</option>
              <option value="environmental">Environmental inspection</option>
              <option value="risk_assessment">Risk assessment</option>
              <option value="snagging">Snag list</option>
              <option value="punch_list">Punch list</option>
              <option value="handover">Handover inspection</option>
            </Select>
            <Field label="Area" name="area" value={forms.inspection.area} onChange={setComplianceForm('inspection')} />
            <Field label="Scheduled" type="date" name="scheduled_on" value={forms.inspection.scheduled_on} onChange={setComplianceForm('inspection')} />
            <Field label="Checklist item 1" name="first_item" value={forms.inspection.first_item} onChange={setComplianceForm('inspection')} />
            <Field label="Requirement 1" name="first_requirement" value={forms.inspection.first_requirement} onChange={setComplianceForm('inspection')} />
            <Select label="Result" name="first_result" value={forms.inspection.first_result} onChange={setComplianceForm('inspection')}>
              <option value="pending">Pending</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="na">N/A</option>
            </Select>
            <Select label="Severity" name="first_severity" value={forms.inspection.first_severity} onChange={setComplianceForm('inspection')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Field label="Checklist item 2" name="second_item" value={forms.inspection.second_item} onChange={setComplianceForm('inspection')} />
            <Field label="Requirement 2" name="second_requirement" value={forms.inspection.second_requirement} onChange={setComplianceForm('inspection')} />
            <Select label="Result" name="second_result" value={forms.inspection.second_result} onChange={setComplianceForm('inspection')}>
              <option value="pending">Pending</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="na">N/A</option>
            </Select>
            <Select label="Severity" name="second_severity" value={forms.inspection.second_severity} onChange={setComplianceForm('inspection')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <TextArea className="span-2" label="Notes" name="notes" value={forms.inspection.notes} onChange={setComplianceForm('inspection')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Create record
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Raise Non-Conformance Report(NCR)" />
          <form className="form-grid two" onSubmit={createNcr}>
            <Select label="Project" name="project_id" value={forms.ncr.project_id} onChange={setComplianceForm('ncr')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Department" name="department" value={forms.ncr.department} onChange={setComplianceForm('ncr')}>
              <option value="qa">Quality Assurance</option>
              <option value="hse">Health, Safety, and Environment</option>
              <option value="technical">Technical</option>
              <option value="operations">Operations</option>
            </Select>
            <Select label="Inspection" name="inspection_id" value={forms.ncr.inspection_id} onChange={setComplianceForm('ncr')}>
              <option value="">None</option>
              {(compliance.inspections || []).map((inspection) => (
                <option key={inspection.id} value={inspection.id}>
                  {inspection.inspection_number} - {inspection.area}
                </option>
              ))}
            </Select>
            <Field label="Title" name="title" value={forms.ncr.title} onChange={setComplianceForm('ncr')} required />
            <Select label="Category" name="category" value={forms.ncr.category} onChange={setComplianceForm('ncr')}>
              <option value="concrete">Concrete</option>
              <option value="reinforcement">Reinforcement</option>
              <option value="masonry">Masonry</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="finishes">Finishes</option>
              <option value="mechanical">Mechanical</option>
              <option value="safety">Safety</option>
              <option value="environmental">Environmental</option>
              <option value="documentation">Documentation</option>
            </Select>
            <Select label="Severity" name="severity" value={forms.ncr.severity} onChange={setComplianceForm('ncr')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Field label="Location" name="location" value={forms.ncr.location} onChange={setComplianceForm('ncr')} />
            <Field label="Contractor" name="contractor" value={forms.ncr.contractor} onChange={setComplianceForm('ncr')} />
            <Field label="Subcontractor" name="subcontractor" value={forms.ncr.subcontractor} onChange={setComplianceForm('ncr')} />
            <Field label="Due date" type="date" name="due_date" value={forms.ncr.due_date} onChange={setComplianceForm('ncr')} />
            <Field className="span-2" label="Reference documents" name="reference_documents" value={forms.ncr.reference_documents} onChange={setComplianceForm('ncr')} />
            <Field className="span-2" label="Evidence register" name="evidence" value={forms.ncr.evidence} onChange={setComplianceForm('ncr')} />
            <TextArea className="span-2" label="Description" name="description" value={forms.ncr.description} onChange={setComplianceForm('ncr')} required />
            <TextArea className="span-2" label="Root cause" name="root_cause" value={forms.ncr.root_cause} onChange={setComplianceForm('ncr')} />
            <TextArea className="span-2" label="Corrective action" name="corrective_action" value={forms.ncr.corrective_action} onChange={setComplianceForm('ncr')} />
            <TextArea className="span-2" label="Preventive action" name="preventive_action" value={forms.ncr.preventive_action} onChange={setComplianceForm('ncr')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Raise Non-Conformance Report(NCR)
            </button>
          </form>
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Incident / Near Miss" />
          <form className="form-grid two" onSubmit={createSafetyIncident}>
            <Select label="Project" name="project_id" value={forms.incident.project_id} onChange={setComplianceForm('incident')}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Type" name="incident_type" value={forms.incident.incident_type} onChange={setComplianceForm('incident')}>
              <option value="near_miss">Near miss</option>
              <option value="first_aid">First aid</option>
              <option value="medical_treatment">Medical treatment</option>
              <option value="lost_time">Lost time</option>
              <option value="property_damage">Property damage</option>
              <option value="environmental">Environmental</option>
            </Select>
            <Select label="Severity" name="severity" value={forms.incident.severity} onChange={setComplianceForm('incident')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Field label="Location" name="location" value={forms.incident.location} onChange={setComplianceForm('incident')} />
            <Field label="Occurred" type="datetime-local" name="occurred_at" value={forms.incident.occurred_at} onChange={setComplianceForm('incident')} />
            <Field label="Injured person" name="injured_person" value={forms.incident.injured_person} onChange={setComplianceForm('incident')} />
            <TextArea className="span-2" label="Description" name="description" value={forms.incident.description} onChange={setComplianceForm('incident')} required />
            <TextArea className="span-2" label="Immediate action" name="immediate_action" value={forms.incident.immediate_action} onChange={setComplianceForm('incident')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Log report
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Users} title="Toolbox Meeting" />
          <form className="form-grid two section-form" onSubmit={createToolboxTalk}>
            <Select label="Project" name="project_id" value={forms.talk.project_id} onChange={setComplianceForm('talk')}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Topic" name="topic" value={forms.talk.topic} onChange={setComplianceForm('talk')} required />
            <Field label="Date" type="date" name="talk_date" value={forms.talk.talk_date} onChange={setComplianceForm('talk')} />
            <Field label="Attendees" type="number" name="attendee_count" value={forms.talk.attendee_count} onChange={setComplianceForm('talk')} />
            <Field className="span-2" label="Hazards discussed" name="hazards_discussed" value={forms.talk.hazards_discussed} onChange={setComplianceForm('talk')} />
            <TextArea className="span-2" label="Summary" name="summary" value={forms.talk.summary} onChange={setComplianceForm('talk')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Record talk
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={FileText} title="Safety Observation" />
          <form className="form-grid two" onSubmit={createSafetyObservation}>
            <Select label="Project" name="project_id" value={forms.observation.project_id} onChange={setComplianceForm('observation')}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Type" name="observation_type" value={forms.observation.observation_type} onChange={setComplianceForm('observation')}>
              <option value="unsafe">Unsafe act / condition</option>
              <option value="safe">Safe observation</option>
              <option value="near_miss">Near miss</option>
              <option value="hazard">Hazard report</option>
              <option value="environmental">Environmental</option>
              <option value="ppe">PPE</option>
              <option value="fire">Fire</option>
            </Select>
            <Select label="Severity" name="severity" value={forms.observation.severity} onChange={setComplianceForm('observation')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Field label="Location" name="location" value={forms.observation.location} onChange={setComplianceForm('observation')} />
            <TextArea className="span-2" label="Observation" name="description" value={forms.observation.description} onChange={setComplianceForm('observation')} required />
            <TextArea className="span-2" label="Corrective action" name="corrective_action" value={forms.observation.corrective_action} onChange={setComplianceForm('observation')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Log observation
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Send} title="Permit to Work" />
          <form className="form-grid two section-form" onSubmit={createWorkPermit}>
            <Select label="Project" name="project_id" value={forms.permit.project_id} onChange={setComplianceForm('permit')}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Permit type" name="permit_type" value={forms.permit.permit_type} onChange={setComplianceForm('permit')}>
              <option value="hot_work">Hot work</option>
              <option value="lifting">Lifting</option>
              <option value="excavation">Excavation</option>
              <option value="work_at_height">Work at height</option>
              <option value="confined_space">Confined space</option>
              <option value="electrical">Electrical</option>
            </Select>
            <Field label="Location" name="location" value={forms.permit.location} onChange={setComplianceForm('permit')} />
            <Field label="Valid from" type="datetime-local" name="valid_from" value={forms.permit.valid_from} onChange={setComplianceForm('permit')} />
            <Field label="Valid until" type="datetime-local" name="valid_until" value={forms.permit.valid_until} onChange={setComplianceForm('permit')} />
            <TextArea className="span-2" label="Hazards" name="hazards" value={forms.permit.hazards} onChange={setComplianceForm('permit')} />
            <TextArea className="span-2" label="Controls" name="controls" value={forms.permit.controls} onChange={setComplianceForm('permit')} />
            <button type="submit" className="primary-action span-2">
              <Send size={17} />
              Submit permit
            </button>
          </form>
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Site Inspections" />
          <DataTable
            columns={['No.', 'Type', 'Project', 'Area', 'Status', 'Score', 'Action']}
            rows={inspections.map((inspection) => [
              inspection.inspection_number,
              labelize(inspection.type),
              inspection.project?.name || '',
              inspection.area || '',
              <Badge key="status" value={inspection.status} />,
              `${inspection.score}%`,
              inspection.status === 'scheduled' ? (
                <button key="complete" type="button" className="table-action" onClick={() => runAction(() => api.completeInspection(inspection.id), 'Inspection completed.')}>
                  Complete
                </button>
              ) : (
                ''
              ),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Non-Conformance Report(NCR) Register" />
          <div className="panel-toolbar">
            <DownloadButton filename="quality-assurance-health-safety-environment-non-conformance-report-register.csv" columns={ncrReportColumns} rows={ncrReportRows} />
          </div>
          <DataTable
            columns={['Non-Conformance Report(NCR)', 'Project', 'Category', 'Location', 'Severity', 'Due', 'Status', 'Action']}
            rows={ncrs.map((ncr, index) => [
              ncr.ncr_number,
              ncr.project?.name || '',
              labelize(ncr.category || 'uncategorized'),
              ncr.location || '',
              <Badge key="severity" value={ncr.severity} />,
              shortDate(ncr.due_date),
              <Badge key="status" value={ncr.status} />,
              <div key="actions" className="row-actions">
                {ncr.status !== 'closed' && (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() =>
                      runAction(
                        () =>
                          api.closeNcr(ncr.id, {
                            status: forms.ncr.close_status,
                            root_cause: forms.ncr.root_cause || ncr.root_cause || 'Root cause recorded.',
                            corrective_action: forms.ncr.corrective_action || ncr.corrective_action || 'Corrective action completed.',
                            preventive_action: forms.ncr.preventive_action || ncr.preventive_action || null,
                            verification_notes: forms.ncr.verification_notes || 'Quality Assurance verification completed.',
                          }),
                        `Non-Conformance Report(NCR) ${labelize(forms.ncr.close_status)}.`,
                      )
                    }
                  >
                    {labelize(forms.ncr.close_status)}
                  </button>
                )}
                <DownloadButton filename={`${ncr.ncr_number || `ncr-${ncr.id}`}.csv`} columns={ncrReportColumns} rows={[ncrReportRows[index]]} label="CSV" />
              </div>,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Incident & Near Miss Reports" />
          <div className="panel-toolbar">
            <DownloadButton filename="quality-assurance-health-safety-environment-incident-near-miss-reports.csv" columns={incidentReportColumns} rows={incidentReportRows} />
          </div>
          <DataTable
            columns={['No.', 'Type', 'Project', 'Location', 'Severity', 'Status', 'Action']}
            rows={incidents.map((incident, index) => [
              incident.incident_number,
              labelize(incident.incident_type),
              incident.project?.name || '',
              incident.location || '',
              <Badge key="severity" value={incident.severity} />,
              <Badge key="status" value={incident.status} />,
              <div key="actions" className="row-actions">
                {incident.status !== 'closed' && (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() =>
                      runAction(
                        () =>
                          api.closeSafetyIncident(incident.id, {
                            status: forms.incident.close_status,
                            root_cause: forms.incident.root_cause || incident.root_cause || null,
                            corrective_action: forms.incident.corrective_action || incident.corrective_action || 'Corrective action completed.',
                          }),
                        'Incident updated.',
                      )
                    }
                  >
                    Close
                  </button>
                )}
                <DownloadButton filename={`${incident.incident_number || `incident-${incident.id}`}.csv`} columns={incidentReportColumns} rows={[incidentReportRows[index]]} label="CSV" />
              </div>,
            ])}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={FileText} title="Safety Observations & Hazard Reports" />
          <div className="panel-toolbar">
            <DownloadButton filename="quality-assurance-health-safety-environment-observation-hazard-reports.csv" columns={observationReportColumns} rows={observationReportRows} />
          </div>
          <DataTable
            columns={['Observation', 'Type', 'Project', 'Location', 'Severity', 'Status', 'Action']}
            rows={observations.map((observation, index) => [
              observation.observation_number,
              labelize(observation.observation_type),
              observation.project?.name || '',
              observation.location || '',
              <Badge key="severity" value={observation.severity} />,
              <Badge key="status" value={observation.status} />,
              <div key="actions" className="row-actions">
                {observation.status !== 'closed' && (
                  <button type="button" className="table-action" onClick={() => runAction(() => api.closeSafetyObservation(observation.id, { corrective_action: forms.observation.corrective_action || observation.corrective_action || 'Corrective action completed.' }), 'Observation closed.')}>
                    Close
                  </button>
                )}
                <DownloadButton filename={`${observation.observation_number || `observation-${observation.id}`}.csv`} columns={observationReportColumns} rows={[observationReportRows[index]]} label="CSV" />
              </div>,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Send} title="Permit to Work Register" />
          <DataTable
            columns={['Permit', 'Type', 'Status', 'Location', 'Next']}
            rows={permits.map((permit) => [
              permit.permit_number,
              labelize(permit.permit_type),
              <Badge key="status" value={permit.status} />,
              permit.location || '',
              nextPermitStatus(permit.status) ? (
                <button key="next" type="button" className="table-action" onClick={() => runAction(() => api.transitionWorkPermit(permit.id, nextPermitStatus(permit.status)), `Permit ${labelize(nextPermitStatus(permit.status))}.`)}>
                  {labelize(nextPermitStatus(permit.status))}
                </button>
              ) : (
                ''
              ),
            ])}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Quality Checklists" />
          <DataTable
            columns={['Inspection', 'Checklist item', 'Requirement', 'Result', 'Severity']}
            rows={qualityChecklistItems.map((item) => [
              item.inspection.inspection_number,
              item.checklist_item,
              item.requirement || '',
              <Badge key="result" value={item.result} />,
              <Badge key="severity" value={item.severity} />,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Safety Checklists & Risk Assessments" />
          <DataTable
            columns={['Inspection', 'Type', 'Checklist item', 'Result', 'Severity']}
            rows={safetyChecklistItems.map((item) => [
              item.inspection.inspection_number,
              labelize(item.inspection.type),
              item.checklist_item,
              <Badge key="result" value={item.result} />,
              <Badge key="severity" value={item.severity} />,
            ])}
          />
          <DataTable
            columns={['Assessment', 'Project', 'Area', 'Status', 'Score']}
            rows={riskAssessments.map((inspection) => [
              inspection.inspection_number,
              inspection.project?.name || '',
              inspection.area || '',
              <Badge key="status" value={inspection.status} />,
              `${inspection.score}%`,
            ])}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="Snag List & Punch List" />
          <DataTable
            columns={['List', 'Type', 'Item', 'Result', 'Severity', 'Status']}
            rows={snagPunchItems.map((item) => [
              item.inspection.inspection_number,
              labelize(item.inspection.type),
              item.checklist_item,
              <Badge key="result" value={item.result} />,
              <Badge key="severity" value={item.severity} />,
              <Badge key="status" value={item.inspection.status} />,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={RefreshCcw} title="Corrective & Preventive Actions" />
          <Select label="Non-Conformance Report(NCR) verification status" name="close_status" value={forms.ncr.close_status} onChange={setComplianceForm('ncr')}>
            <option value="closed">Closed</option>
            <option value="under_review">Under review</option>
            <option value="corrective_action">Corrective action</option>
            <option value="rework_required">Rework required</option>
            <option value="reopened">Reopened</option>
          </Select>
          <TextArea label="Verification notes" name="verification_notes" value={forms.ncr.verification_notes} onChange={setComplianceForm('ncr')} />
          <DataTable
            columns={['Source', 'No.', 'Issue', 'Severity', 'Status', 'Due']}
            rows={openCapa.map((item) => [
              item.type,
              item.number,
              item.title,
              <Badge key="severity" value={item.severity} />,
              <Badge key="status" value={item.status} />,
              shortDate(item.due),
            ])}
          />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Users} title="Toolbox Meetings" />
          <DataTable
            columns={['Talk', 'Topic', 'Project', 'Date', 'Attendees']}
            rows={talks.map((talk) => [
              talk.talk_number,
              talk.topic,
              talk.project?.name || '',
              shortDate(talk.talk_date),
              talk.attendee_count,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={BarChart3} title="Reports" />
          <div className="panel-toolbar">
            <DownloadButton filename="quality-assurance-health-safety-environment-report-summary.csv" columns={qaHseReportColumns} rows={qaHseReportRows} />
          </div>
          <DataTable
            columns={qaHseReportColumns}
            rows={qaHseReportRows}
          />
        </section>
      </div>
    </section>
  )
}

function PortalsView({
  projects,
  clients,
  suppliers,
  drawings,
  documents,
  portals,
  forms,
  setPortalForm,
  createPortalUser,
  grantPortalAccess,
  createClientApproval,
  createConsultantSubmittal,
  createPortalWorkItem,
  runAction,
}) {
  const [activePortalTab, setActivePortalTab] = useState('overview')
  const workItems = portals.work_items || []
  const portalUsers = portals.portal_users || []
  const portalTypeConfig = {
    client: {
      label: 'Client Portal',
      items: ['progress_photo', 'milestone_update', 'approval_request', 'invoice_query', 'variation_request', 'rfi', 'meeting_minutes', 'project_document'],
      description: 'Progress, milestones, approvals, invoices, variations, RFIs, minutes, and documents.',
    },
    consultant: {
      label: 'Consultant Portal',
      items: ['drawing_review', 'technical_comment', 'submittal', 'rfi', 'inspection_request', 'digital_approval'],
      description: 'Drawing reviews, comments, submittals, RFIs, inspections, and approvals.',
    },
    supplier: {
      label: 'Supplier Portal',
      items: ['purchase_order_acknowledgement', 'delivery_schedule', 'invoice_submission', 'payment_status_query', 'document_upload'],
      description: 'Purchase orders, delivery schedules, invoice submission, payment status, and documents.',
    },
    subcontractor: {
      label: 'Subcontractor Portal',
      items: ['work_package_update', 'daily_report', 'safety_document', 'attendance_update', 'progress_update'],
      description: 'Work packages, daily reports, safety documents, attendance, and progress updates.',
    },
    inspector: {
      label: 'Inspector Portal',
      items: ['inspection_schedule', 'inspection_finding', 'compliance_report', 'inspection_signoff'],
      description: 'Inspection schedules, findings, compliance reports, and sign-offs.',
    },
    investor_owner: {
      label: 'Investor/Owner Portal',
      items: ['executive_report', 'project_health_update', 'milestone_update', 'budget_report'],
      description: 'Executive health, milestones, permitted budgets, and project reports.',
    },
  }
  const portalTabs = [
    ['overview', 'Overview', BarChart3],
    ...Object.entries(portalTypeConfig).map(([key, config]) => [key, config.label.replace(' Portal', ''), Building2]),
    ['directory', 'Directory', Users],
    ['work_items', 'Work Items', ClipboardList],
  ]
  const portalTypes = portals.portal_types?.length
    ? portals.portal_types
    : Object.entries(portalTypeConfig).map(([key, config]) => ({ key, label: config.label, features: config.items, users: 0, open_items: 0, completed_items: 0 }))
  const activeType = portalTypeConfig[forms.workItem.portal_type] ? forms.workItem.portal_type : 'client'
  const itemOptions = [...new Set([...(portalTypeConfig[activeType]?.items || portalTypeConfig.client.items), forms.workItem.item_type].filter(Boolean))]
  const usersFor = (type) => portalUsers.filter((portalUser) => portalUser.user_type === type)
  const selectedPortalUsers = usersFor(activeType)
  const workItemsFor = (type) => workItems.filter((item) => item.portal_type === type)
  const portalWorkItemRows = (items) =>
    items.map((item) => [
      <div key="item" className="table-primary">
        <strong>{item.item_number}</strong>
        <small>{item.title}</small>
      </div>,
      labelize(item.item_type),
      item.project?.name || '',
      item.portalUser?.name || item.supplier?.name || '',
      <Badge key="priority" value={item.priority} />,
      <Badge key="status" value={item.status} />,
      shortDate(item.due_date),
      <div key="actions" className="row-actions">
        {['submitted', 'changes_required'].includes(item.status) && (
          <button type="button" className="table-action" onClick={() => runAction(() => api.reviewPortalWorkItem(item.id, { status: 'in_review', response: 'Review started.' }), 'Portal item moved to review.')}>
            Review
          </button>
        )}
        {!['approved', 'completed', 'closed', 'paid', 'signed_off', 'rejected'].includes(item.status) && (
          <button type="button" className="table-action" onClick={() => runAction(() => api.reviewPortalWorkItem(item.id, { status: completionStatus(item.item_type), response: 'Completed in Navkwa Build.' }), 'Portal item completed.')}>
            Complete
          </button>
        )}
        <button type="button" className="table-action danger" onClick={() => runAction(() => api.deletePortalWorkItem(item.id), 'Portal work item archived.')}>
          Archive
        </button>
      </div>,
    ])

  function completionStatus(itemType) {
    if (itemType === 'invoice_submission' || itemType === 'payment_status_query') return 'paid'
    if (itemType === 'inspection_signoff') return 'signed_off'
    if (itemType.includes('approval') || itemType === 'drawing_review' || itemType === 'submittal') return 'approved'

    return 'completed'
  }

  function renderWorkItemForm() {
    return (
      <section className="panel">
        <PanelTitle icon={Plus} title="Portal Work Item" />
        <form className="form-grid two" onSubmit={createPortalWorkItem}>
          <Select label="Portal" name="portal_type" value={forms.workItem.portal_type} onChange={setPortalForm('workItem')}>
            {Object.entries(portalTypeConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </Select>
          <Select label="Project" name="project_id" value={forms.workItem.project_id} onChange={setPortalForm('workItem')} required>
            <option value="">Select</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Select label="Assignee" name="portal_user_id" value={forms.workItem.portal_user_id} onChange={setPortalForm('workItem')}>
            <option value="">Unassigned</option>
            {(selectedPortalUsers.length ? selectedPortalUsers : portalUsers).map((portalUser) => (
              <option key={portalUser.id} value={portalUser.id}>
                {portalUser.name}
              </option>
            ))}
          </Select>
          <Select label="Supplier" name="supplier_id" value={forms.workItem.supplier_id} onChange={setPortalForm('workItem')}>
            <option value="">None</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
          <Select label="Item type" name="item_type" value={forms.workItem.item_type} onChange={setPortalForm('workItem')}>
            {itemOptions.map((itemType) => (
              <option key={itemType} value={itemType}>
                {labelize(itemType)}
              </option>
            ))}
          </Select>
          <Select label="Priority" name="priority" value={forms.workItem.priority} onChange={setPortalForm('workItem')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
          <Field label="Due date" type="date" name="due_date" value={forms.workItem.due_date} onChange={setPortalForm('workItem')} />
          <Field label="Title" name="title" value={forms.workItem.title} onChange={setPortalForm('workItem')} required />
          <TextArea className="span-2" label="Description" name="description" value={forms.workItem.description} onChange={setPortalForm('workItem')} rows={3} />
          <button type="submit" className="primary-action span-2">
            <Plus size={17} />
            Create work item
          </button>
        </form>
      </section>
    )
  }

  function renderOverview() {
    return (
      <>
        <div className="portal-role-grid">
          {portalTypes.map((type) => (
            <button key={type.key} type="button" className="portal-role-card" onClick={() => setActivePortalTab(type.key)}>
              <span>{type.label}</span>
              <strong>{type.open_items || 0}</strong>
              <small>{type.users || 0} users | {type.completed_items || 0} completed</small>
            </button>
          ))}
        </div>

        <div className="grid-main">
          {renderWorkItemForm()}
          <section className="panel">
            <PanelTitle icon={Clock3} title="Portal Activity" />
            <DataTable
              columns={['Time', 'Portal', 'Activity', 'Status', 'Project']}
              rows={(portals.activity || []).map((activity) => [
                shortDate(activity.time),
                labelize(activity.portal),
                activity.title,
                <Badge key="status" value={activity.status} />,
                activity.project || '',
              ])}
            />
          </section>
        </div>
      </>
    )
  }

  function renderClientPortal() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="Client Approvals" />
          <DataTable
            columns={['No.', 'Title', 'Project', 'Drawing', 'Document', 'Status', 'Action']}
            rows={(portals.client_approvals || []).map((approval) => [
              approval.approval_number,
              approval.title,
              approval.project?.name || '',
              approval.drawing?.drawing_number || '',
              approval.document?.document_number || '',
              <Badge key="status" value={approval.status} />,
              approval.status === 'submitted' ? (
                <button key="approve" type="button" className="table-action" onClick={() => runAction(() => api.reviewClientApproval(approval.id, { status: 'approved', decision_notes: 'Approved in Navkwa Build.' }), 'Client approval completed.')}>
                  Approve
                </button>
              ) : (
                ''
              ),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Client Invoices" />
          <DataTable
            columns={['Invoice', 'Project', 'Client', 'Total', 'Balance', 'Payment']}
            rows={(portals.client_invoices || []).map((invoice) => [
              invoice.invoice_number,
              invoice.project?.name || '',
              invoice.client?.name || '',
              money(invoice.total_amount),
              money(invoice.balance_due),
              <Badge key="payment" value={invoice.payment_status} />,
            ])}
          />
        </section>

        <section className="panel span-2">
          <PanelTitle icon={ClipboardList} title="Client RFIs, Variations & Minutes" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('client'))} />
        </section>
      </div>
    )
  }

  function renderConsultantPortal() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Consultant Submittals" />
          <DataTable
            columns={['No.', 'Title', 'Discipline', 'Drawing', 'Status', 'Action']}
            rows={(portals.consultant_submittals || []).map((submittal) => [
              submittal.submittal_number,
              submittal.title,
              labelize(submittal.discipline),
              submittal.drawing?.drawing_number || '',
              <Badge key="status" value={submittal.status} />,
              ['submitted', 'in_review'].includes(submittal.status) ? (
                <button key="approve" type="button" className="table-action" onClick={() => runAction(() => api.reviewConsultantSubmittal(submittal.id, { status: 'approved', comments: 'Approved in Navkwa Build.' }), 'Submittal approved.')}>
                  Approve
                </button>
              ) : (
                ''
              ),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={FileText} title="Drawing Reviews" />
          <DataTable
            columns={['Drawing', 'Title', 'Discipline', 'Status']}
            rows={drawings.map((drawing) => [
              drawing.drawing_number,
              drawing.title,
              labelize(drawing.discipline),
              <Badge key="status" value={drawing.status} />,
            ])}
          />
        </section>

        <section className="panel span-2">
          <PanelTitle icon={ClipboardList} title="Technical Comments & RFIs" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('consultant'))} />
        </section>
      </div>
    )
  }

  function renderSupplierPortal() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Truck} title="Purchase Orders" />
          <DataTable
            columns={['PO', 'Supplier', 'Project', 'Status', 'Delivery', 'Total']}
            rows={(portals.supplier_purchase_orders || []).map((po) => [
              po.po_number,
              po.supplier?.name || '',
              po.project?.name || '',
              <Badge key="status" value={po.status} />,
              <Badge key="delivery" value={po.delivery_status} />,
              money(po.total_amount),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={WalletCards} title="Supplier Invoices & Payments" />
          <DataTable
            columns={['Invoice', 'Supplier', 'Project', 'Total', 'Balance', 'Status']}
            rows={(portals.supplier_invoices || []).map((invoice) => [
              invoice.invoice_number,
              invoice.supplier?.name || '',
              invoice.project?.name || '',
              money(invoice.total_amount),
              money(invoice.balance_due),
              <Badge key="status" value={invoice.status} />,
            ])}
          />
        </section>

        <section className="panel span-2">
          <PanelTitle icon={Package} title="Supplier Schedules, Documents & Queries" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('supplier'))} />
        </section>
      </div>
    )
  }

  function renderSubcontractorPortal() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={MapPinned} title="Daily Reports" />
          <DataTable
            columns={['Report', 'Project', 'Date', 'Labour', 'Status']}
            rows={(portals.daily_reports || []).map((report) => [
              report.report_number,
              report.project?.name || '',
              shortDate(report.report_date),
              report.labour_count || 0,
              <Badge key="status" value={report.status} />,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Safety Documents & Attendance" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('subcontractor'))} />
        </section>
      </div>
    )
  }

  function renderInspectorPortal() {
    return (
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={ShieldCheck} title="Inspections" />
          <DataTable
            columns={['Inspection', 'Project', 'Type', 'Area', 'Score', 'Status']}
            rows={(portals.inspections || []).map((inspection) => [
              inspection.inspection_number,
              inspection.project?.name || '',
              labelize(inspection.type),
              inspection.area || '',
              `${inspection.score || 0}%`,
              <Badge key="status" value={inspection.status} />,
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="Findings, Compliance & Sign-Offs" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('inspector'))} />
        </section>
      </div>
    )
  }

  function renderInvestorPortal() {
    return (
      <div className="grid-main">
        <section className="panel span-2">
          <PanelTitle icon={BarChart3} title="Executive Project Health" />
          <DataTable
            columns={['Project', 'Status', 'Health', 'Progress', 'Contract', 'Budget', 'Actual', 'Target']}
            rows={(portals.project_snapshots || []).map((project) => [
              project.name,
              <Badge key="status" value={project.status} />,
              <Badge key="health" value={project.health_status} />,
              `${project.progress_percent || 0}%`,
              money(project.contract_value),
              money(project.budget_total),
              money(project.actual_cost),
              shortDate(project.target_end_date),
            ])}
          />
        </section>

        <section className="panel span-2">
          <PanelTitle icon={FileText} title="Investor Reports & Milestones" />
          <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItemsFor('investor_owner'))} />
        </section>
      </div>
    )
  }

  function renderDirectory() {
    return (
      <>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Users} title="Portal User" />
            <form className="form-grid two" onSubmit={createPortalUser}>
              <Select label="Type" name="user_type" value={forms.user.user_type} onChange={setPortalForm('user')}>
                {Object.entries(portalTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </Select>
              <Select label="Client" name="client_id" value={forms.user.client_id} onChange={setPortalForm('user')}>
                <option value="">None</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
              <Field label="Name" name="name" value={forms.user.name} onChange={setPortalForm('user')} required />
              <Field label="Email" type="email" name="email" value={forms.user.email} onChange={setPortalForm('user')} required />
              <Field className="span-2" label="Organization" name="organization" value={forms.user.organization} onChange={setPortalForm('user')} />
              <button type="submit" className="primary-action span-2">
                <Plus size={17} />
                Create portal user
              </button>
            </form>
          </section>

          <section className="panel">
            <PanelTitle icon={FolderKanban} title="Project Access" />
            <form className="form-grid two" onSubmit={grantPortalAccess}>
              <Select label="Portal user" name="portal_user_id" value={forms.access.portal_user_id} onChange={setPortalForm('access')} required>
                <option value="">Select</option>
                {portalUsers.map((portalUser) => (
                  <option key={portalUser.id} value={portalUser.id}>
                    {portalUser.name}
                  </option>
                ))}
              </Select>
              <Select label="Project" name="project_id" value={forms.access.project_id} onChange={setPortalForm('access')} required>
                <option value="">Select</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              <Select label="Access" name="access_level" value={forms.access.access_level} onChange={setPortalForm('access')}>
                <option value="view">View</option>
                <option value="comment">Comment</option>
                <option value="approve">Approve</option>
                <option value="submit">Submit</option>
                <option value="manage">Manage</option>
              </Select>
              <Select label="Scope" name="access_scope" value={forms.access.access_scope} onChange={setPortalForm('access')}>
                <option value="project">Project</option>
                <option value="contract">Contract</option>
                <option value="work_package">Work package</option>
                <option value="cost_code">Cost code</option>
              </Select>
              <button type="submit" className="primary-action span-2">
                <Send size={17} />
                Grant access
              </button>
            </form>
          </section>
        </div>

        <section className="panel">
          <PanelTitle icon={Users} title="Portal Directory" />
          <DataTable
            columns={['Name', 'Type', 'Organization', 'Status', 'Accesses', 'Open items']}
            rows={portalUsers.map((portalUser) => [
              portalUser.name,
              labelize(portalUser.user_type),
              portalUser.organization || '',
              <Badge key="status" value={portalUser.status} />,
              portalUser.accesses?.length || 0,
              portalUser.work_items?.filter((item) => !['approved', 'completed', 'closed', 'paid', 'signed_off'].includes(item.status)).length || 0,
            ])}
          />
        </section>
      </>
    )
  }

  function renderLegacyForms(scope = 'both') {
    return (
      <div className="grid-main">
        {['both', 'client'].includes(scope) && (
        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="Client Approval" />
          <form className="form-grid two" onSubmit={createClientApproval}>
            <Select label="Project" name="project_id" value={forms.clientApproval.project_id} onChange={setPortalForm('clientApproval')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Reviewer" name="portal_user_id" value={forms.clientApproval.portal_user_id} onChange={setPortalForm('clientApproval')}>
              <option value="">Unassigned</option>
              {usersFor('client').map((portalUser) => (
                <option key={portalUser.id} value={portalUser.id}>
                  {portalUser.name}
                </option>
              ))}
            </Select>
            <Select label="Drawing" name="drawing_id" value={forms.clientApproval.drawing_id} onChange={setPortalForm('clientApproval')}>
              <option value="">None</option>
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.drawing_number}
                </option>
              ))}
            </Select>
            <Select label="Document" name="document_id" value={forms.clientApproval.document_id} onChange={setPortalForm('clientApproval')}>
              <option value="">None</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.document_number}
                </option>
              ))}
            </Select>
            <Field className="span-2" label="Title" name="title" value={forms.clientApproval.title} onChange={setPortalForm('clientApproval')} required />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Request approval
            </button>
          </form>
        </section>
        )}

        {['both', 'consultant'].includes(scope) && (
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Consultant Submittal" />
          <form className="form-grid two" onSubmit={createConsultantSubmittal}>
            <Select label="Project" name="project_id" value={forms.submittal.project_id} onChange={setPortalForm('submittal')} required>
              <option value="">Select</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Select label="Consultant" name="portal_user_id" value={forms.submittal.portal_user_id} onChange={setPortalForm('submittal')}>
              <option value="">Unassigned</option>
              {usersFor('consultant').map((portalUser) => (
                <option key={portalUser.id} value={portalUser.id}>
                  {portalUser.name}
                </option>
              ))}
            </Select>
            <Select label="Discipline" name="discipline" value={forms.submittal.discipline} onChange={setPortalForm('submittal')}>
              <option value="architectural">Architectural</option>
              <option value="structural">Structural</option>
              <option value="mep">MEP</option>
              <option value="civil">Civil</option>
              <option value="interiors">Interiors</option>
            </Select>
            <Select label="Drawing" name="drawing_id" value={forms.submittal.drawing_id} onChange={setPortalForm('submittal')}>
              <option value="">None</option>
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.drawing_number}
                </option>
              ))}
            </Select>
            <Field className="span-2" label="Title" name="title" value={forms.submittal.title} onChange={setPortalForm('submittal')} required />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Create submittal
            </button>
          </form>
        </section>
        )}
      </div>
    )
  }

  return (
    <section className="view-stack portal-workspace">
      <div className="kpi-grid">
        <Kpi icon={Users} label="Portal users" value={portals.summary?.active_users || 0} sub="Active external users" />
        <Kpi icon={ClipboardList} label="Open items" value={portals.summary?.open_work_items || 0} sub="Across all portals" />
        <Kpi icon={AlertTriangle} label="Overdue" value={portals.summary?.overdue_items || 0} sub="Needs follow-up" />
        <Kpi icon={WalletCards} label="Supplier invoices" value={portals.summary?.supplier_invoices || 0} sub="Open supplier invoices" />
        <Kpi icon={CheckCircle2} label="Client approvals" value={portals.summary?.pending_client_approvals || 0} sub="Awaiting decision" />
        <Kpi icon={ShieldCheck} label="Inspection sign-offs" value={portals.summary?.inspection_signoffs || 0} sub="Awaiting sign-off" />
        <Kpi icon={FolderKanban} label="Project access" value={portals.summary?.project_accesses || 0} sub="Granted scopes" />
      </div>

      <nav className="module-tabs" aria-label="Portal navigation">
        {portalTabs.map(([key, label, Icon]) => (
          <button key={key} type="button" className={activePortalTab === key ? 'active' : ''} onClick={() => setActivePortalTab(key)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {activePortalTab === 'overview' && renderOverview()}
      {activePortalTab === 'client' && (
        <>
          {renderLegacyForms('client')}
          {renderClientPortal()}
        </>
      )}
      {activePortalTab === 'consultant' && (
        <>
          {renderLegacyForms('consultant')}
          {renderConsultantPortal()}
        </>
      )}
      {activePortalTab === 'supplier' && renderSupplierPortal()}
      {activePortalTab === 'subcontractor' && renderSubcontractorPortal()}
      {activePortalTab === 'inspector' && renderInspectorPortal()}
      {activePortalTab === 'investor_owner' && renderInvestorPortal()}
      {activePortalTab === 'directory' && renderDirectory()}
      {activePortalTab === 'work_items' && (
        <>
          {renderWorkItemForm()}
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="All Portal Work Items" />
            <DataTable columns={['Item', 'Type', 'Project', 'Owner', 'Priority', 'Status', 'Due', 'Action']} rows={portalWorkItemRows(workItems)} />
          </section>
        </>
      )}
    </section>
  )
}

function DocumentsView({
  branches,
  projects,
  drawings,
  documents,
  documentForm,
  setDocumentForm,
  drawingForm,
  setDrawingForm,
  revisionForm,
  setRevisionForm,
  markupForm,
  setMarkupForm,
  reviewForm,
  setReviewForm,
  uploadDocument,
  uploadDrawing,
  reviseDrawing,
  runAction,
}) {
  const [editingDocumentId, setEditingDocumentId] = useState(null)

  function saveDocument(event) {
    if (!editingDocumentId) {
      uploadDocument(event)
      return
    }

    event.preventDefault()

    const formData = new FormData()
    Object.entries(documentForm).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value)
    })

    runAction(() => api.updateDocument(editingDocumentId, formData), 'Document updated.').then(() => {
      setEditingDocumentId(null)
      setDocumentForm({})
      event.currentTarget.reset()
    })
  }

  function editDocument(document) {
    setEditingDocumentId(document.id)
    setDocumentForm({
      title: document.title || '',
      document_type: document.document_type || 'general',
      branch_id: document.branch_id || document.branch?.id || '',
      project_id: document.project_id || document.project?.id || '',
      repository_scope: document.repository_scope || 'company',
      folder: document.folder || '',
      status: document.status || 'active',
      description: document.description || '',
    })
  }

  function cancelDocumentEdit() {
    setEditingDocumentId(null)
    setDocumentForm({})
  }

  function archiveDocument(document) {
    if (!window.confirm(`Archive document ${document.document_number || document.title}?`)) {
      return
    }

    runAction(() => api.deleteDocument(document.id), 'Document archived.').then(() => {
      if (editingDocumentId === document.id) {
        cancelDocumentEdit()
      }
    })
  }

  return (
    <section className="view-stack">
      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Upload} title={editingDocumentId ? 'Edit Document' : 'Upload Document'} />
          <form className="form-grid two" onSubmit={saveDocument}>
            <Field label="Title" name="title" value={documentForm.title || ''} onChange={setForm(setDocumentForm)} required />
            <Select label="Type" name="document_type" value={documentForm.document_type || 'general'} onChange={setForm(setDocumentForm)}>
              <option value="general">General</option>
              <option value="contract">Contract</option>
              <option value="invoice">Invoice</option>
              <option value="quality">Quality</option>
              <option value="safety">Safety</option>
              <option value="policy">Policy</option>
              <option value="microsoft_excel">Microsoft Excel</option>
              <option value="autocad">AutoCAD</option>
              <option value="pdf_drawing">PDF Drawing</option>
              <option value="csv_import">CSV Import</option>
              <option value="finance_workbook">Finance Workbook</option>
            </Select>
            <Select label="Branch" name="branch_id" value={documentForm.branch_id || ''} onChange={setForm(setDocumentForm)}>
              <option value="">Default</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select label="Project" name="project_id" value={documentForm.project_id || ''} onChange={setForm(setDocumentForm)}>
              <option value="">Branch library</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Field label="Folder" name="folder" value={documentForm.folder || ''} onChange={setForm(setDocumentForm)} />
            <Select label="Status" name="status" value={documentForm.status || 'active'} onChange={setForm(setDocumentForm)}>
              <option value="active">Active</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </Select>
            <label className="field">
              <span>File</span>
              <input type="file" name="file" accept={documentUploadAccept} onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files[0] }))} />
              <small>PDF, Word, Microsoft Excel, CSV, AutoCAD DWG/DXF, or image files up to 50 MB</small>
            </label>
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {editingDocumentId ? <CheckCircle2 size={17} /> : <Upload size={17} />}
                {editingDocumentId ? 'Save document' : 'Upload document'}
              </button>
              {editingDocumentId && (
                <button type="button" className="table-action" onClick={cancelDocumentEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Layers3} title="Upload Drawing" />
          <form className="form-grid two" onSubmit={uploadDrawing}>
            <Field label="Drawing No." name="drawing_number" value={drawingForm.drawing_number || ''} onChange={setForm(setDrawingForm)} placeholder="Auto-generated" />
            <Field label="Title" name="title" value={drawingForm.title || ''} onChange={setForm(setDrawingForm)} required />
            <Select label="Discipline" name="discipline" value={drawingForm.discipline || 'architectural'} onChange={setForm(setDrawingForm)}>
              <option value="architectural">Architectural</option>
              <option value="structural">Structural</option>
              <option value="mep">MEP</option>
              <option value="civil">Civil</option>
              <option value="interiors">Interiors</option>
            </Select>
            <Field label="Revision" name="revision_code" value={drawingForm.revision_code || ''} onChange={setForm(setDrawingForm)} placeholder="Auto-generated as P01" />
            <Select label="Project" name="project_id" value={drawingForm.project_id || ''} onChange={setForm(setDrawingForm)}>
              <option value="">Branch drawing library</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <label className="field">
              <span>File</span>
              <input type="file" name="file" accept={drawingUploadAccept} onChange={(event) => setDrawingForm((current) => ({ ...current, file: event.target.files[0] }))} />
              <small>PDF drawing, DWG, or DXF up to 100 MB</small>
            </label>
            <button type="submit" className="primary-action span-2">
              <Upload size={17} />
              Upload drawing
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={FileText} title="Document Repository" />
        <DataTable
          columns={['No.', 'Title', 'Scope', 'Type', 'Version', 'File', 'Status', 'Actions']}
          rows={documents.map((doc) => [
            doc.document_number,
            doc.title,
            labelize(doc.repository_scope),
            labelize(doc.document_type),
            `v${doc.version}`,
            doc.original_filename || '',
            <Badge key="status" value={doc.status} />,
            <div key="actions" className="row-actions">
              {doc.file_path && (
                <button type="button" className="table-action" onClick={() => runAction(() => api.downloadDocument(doc.id, doc.original_filename || doc.title), 'Document download started.', { skipRefresh: true })}>
                  Download
                </button>
              )}
              <button type="button" className="table-action" onClick={() => editDocument(doc)}>
                Edit
              </button>
              <button type="button" className="table-action danger" onClick={() => archiveDocument(doc)}>
                Archive
              </button>
            </div>,
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={Layers3} title="Drawing Library" />
        <form className="inline-form" onSubmit={reviseDrawing}>
          <Select label="Drawing" name="drawing_id" value={revisionForm.drawing_id} onChange={setForm(setRevisionForm)}>
            <option value="">Select drawing</option>
            {drawings.map((drawing) => (
              <option key={drawing.id} value={drawing.id}>
                {drawing.drawing_number} - {drawing.title}
              </option>
            ))}
          </Select>
          <Field label="Revision" name="revision_code" value={revisionForm.revision_code} onChange={setForm(setRevisionForm)} placeholder="Auto-generated" />
          <Field label="Notes" name="notes" value={revisionForm.notes} onChange={setForm(setRevisionForm)} />
          <label className="field compact-file">
            <span>File</span>
            <input type="file" name="file" accept={drawingUploadAccept} onChange={(event) => setRevisionForm((current) => ({ ...current, file: event.target.files[0] }))} />
          </label>
          <button type="submit" className="icon-button solid" title="Issue revision">
            <Plus size={17} />
          </button>
        </form>
        <DataTable
          columns={['No.', 'Title', 'Discipline', 'Revision', 'Status', 'Action']}
          rows={drawings.map((drawing) => {
            const currentRevision = (drawing.revisions || []).find((revision) => revision.revision_code === drawing.current_revision) || (drawing.revisions || [])[0]

            return [
              drawing.drawing_number,
              drawing.title,
              labelize(drawing.discipline),
              drawing.current_revision,
              <Badge key="status" value={drawing.status} />,
              <div key="actions" className="row-actions">
                {currentRevision?.file_path && (
                  <button type="button" className="table-action" onClick={() => runAction(() => api.downloadDrawingRevision(currentRevision.id, currentRevision.original_filename || drawing.title), 'Drawing download started.', { skipRefresh: true })}>
                    Download
                  </button>
                )}
                {drawing.status === 'issued_for_review' && (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => runAction(() => api.transitionDrawing(drawing.id, 'approved_for_construction'), 'Drawing approved.')}
                  >
                    Approve
                  </button>
                )}
              </div>,
            ]
          })}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={ClipboardList} title="Drawing Markups & Reviews" />
        <div className="grid-main tight">
          <form
            className="form-grid two"
            onSubmit={(event) => {
              event.preventDefault()
              if (!markupForm.drawing_id) return
              runAction(
                () =>
                  api.createDrawingMarkup(markupForm.drawing_id, {
                    comment: markupForm.comment,
                    markup_type: 'pin',
                    x: Number(markupForm.x || 0),
                    y: Number(markupForm.y || 0),
                  }),
                'Markup added.',
              ).then(() => setMarkupForm({ drawing_id: markupForm.drawing_id, comment: '', x: 0.5, y: 0.5 }))
            }}
          >
            <Select label="Drawing" name="drawing_id" value={markupForm.drawing_id} onChange={setForm(setMarkupForm)} required>
              <option value="">Select drawing</option>
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.drawing_number} - {drawing.title}
                </option>
              ))}
            </Select>
            <Field label="Comment" name="comment" value={markupForm.comment} onChange={setForm(setMarkupForm)} required />
            <Field label="X" type="number" step="0.01" min="0" max="1" name="x" value={markupForm.x} onChange={setForm(setMarkupForm)} />
            <Field label="Y" type="number" step="0.01" min="0" max="1" name="y" value={markupForm.y} onChange={setForm(setMarkupForm)} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Add markup
            </button>
          </form>

          <form
            className="form-grid two"
            onSubmit={(event) => {
              event.preventDefault()
              if (!reviewForm.drawing_id) return
              runAction(
                () =>
                  api.createDrawingReview(reviewForm.drawing_id, {
                    decision: reviewForm.decision,
                    comments: reviewForm.comments,
                  }),
                'Drawing review recorded.',
              ).then(() => setReviewForm({ drawing_id: reviewForm.drawing_id, decision: 'approved', comments: '' }))
            }}
          >
            <Select label="Drawing" name="drawing_id" value={reviewForm.drawing_id} onChange={setForm(setReviewForm)} required>
              <option value="">Select drawing</option>
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.drawing_number} - {drawing.title}
                </option>
              ))}
            </Select>
            <Select label="Decision" name="decision" value={reviewForm.decision} onChange={setForm(setReviewForm)}>
              <option value="approved">Approved</option>
              <option value="changes_required">Changes required</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Field className="span-2" label="Comments" name="comments" value={reviewForm.comments} onChange={setForm(setReviewForm)} />
            <button type="submit" className="primary-action span-2">
              <CheckCircle2 size={17} />
              Record review
            </button>
          </form>
        </div>
      </section>
    </section>
  )
}

function ReportsView({ reports, dashboard }) {
  const portfolio = reports?.portfolio || []
  const costControl = reports?.cost_control || []
  const documents = reports?.documents || {}
  const procurement = reports?.procurement || {}
  const sales = reports?.sales || {}
  const field = reports?.field || {}
  const inventory = reports?.inventory || {}
  const finance = reports?.finance || {}
  const payroll = reports?.payroll || {}
  const quality = reports?.quality || {}
  const safety = reports?.safety || {}
  const portals = reports?.portals || {}
  const costColumns = ['Project', 'Code', 'Category', 'Budget', 'Committed', 'Actual', 'Variance']
  const costRows = costControl.map((line) => [
    line.project?.code || '',
    line.cost_code || '',
    labelize(line.category || ''),
    money(line.budget_amount),
    money(line.committed_amount),
    money(line.actual_amount),
    money(line.variance),
  ])
  const portfolioColumns = ['Code', 'Project', 'Client', 'Status', 'Progress', 'Contract', 'Budget', 'Actual']
  const portfolioRows = portfolio.map((project) => [
    project.code || '',
    project.name || '',
    project.client?.name || '',
    labelize(project.status || ''),
    `${project.progress_percent || 0}%`,
    money(project.contract_value),
    money(project.budget_total),
    money(project.actual_cost),
  ])
  const statusColumns = ['Report', 'Status / Metric', 'Count', 'Value']
  const groupedRows = (reportName, items = [], labelKey = 'status', valueKey = 'value') =>
    (items || []).map((item) => [
      reportName,
      labelize(item[labelKey] || ''),
      item.total || 0,
      item[valueKey] !== undefined ? money(item[valueKey]) : '',
    ])
  const statusRows = [
    ['Documents', 'Total documents', documents.total || 0, ''],
    ...groupedRows('Documents by type', documents.by_type, 'document_type'),
    ...groupedRows('Drawings by status', documents.drawings_by_status),
    ...groupedRows('Purchase requisitions', procurement.requisitions),
    ...groupedRows('Purchase orders', procurement.purchase_orders),
    ...groupedRows('Sales leads', sales.leads, 'stage'),
    ...groupedRows('Opportunities', sales.opportunities, 'stage'),
    ...groupedRows('Tenders', sales.tenders),
    ...groupedRows('Estimates', sales.estimates),
    ...groupedRows('Daily reports', field.daily_reports),
    ...groupedRows('Site issues', field.issues),
    ['Site attendance', 'Open clock-ins', field.attendance_open || 0, ''],
    ['Inventory', 'Items', inventory.items || 0, ''],
    ['Inventory', 'Reorder alerts', (inventory.reorder_alerts || []).length, ''],
    ...groupedRows('Invoices', finance.invoices),
    ...groupedRows('Expenses', finance.expenses),
    ...groupedRows('Employees', payroll.employees),
    ...groupedRows('Payroll runs', payroll.runs),
    ...groupedRows('Equipment', reports?.equipment, 'status', 'hourly_rate'),
    ...groupedRows('Quality inspections', quality.inspections),
    ...groupedRows('Non-Conformance Reports(NCRs)', quality.ncrs),
    ...groupedRows('Safety incidents', safety.incidents),
    ...groupedRows('Work permits', safety.permits),
    ...groupedRows('Client approvals', portals.client_approvals),
    ...groupedRows('Consultant submittals', portals.consultant_submittals),
  ]
  const receivableColumns = ['Invoice', 'Client', 'Project', 'Due date', 'Status', 'Payment status', 'Total', 'Balance']
  const receivableRows = (finance.receivables || []).map((invoice) => [
    invoice.invoice_number || '',
    invoice.client?.name || '',
    invoice.project?.name || '',
    shortDate(invoice.due_date),
    labelize(invoice.status || ''),
    labelize(invoice.payment_status || ''),
    money(invoice.total_amount),
    money(invoice.balance_due),
  ])
  const reorderColumns = ['Stock Keeping Unit (SKU)', 'Item', 'Category', 'Status', 'On hand', 'Reorder level', 'Unit', 'Average cost']
  const reorderRows = (inventory.reorder_alerts || []).map((item) => [
    item.sku || '',
    item.name || '',
    labelize(item.category || ''),
    labelize(item.status || ''),
    item.quantity_on_hand || 0,
    item.reorder_level || 0,
    item.unit || '',
    money(item.average_cost),
  ])

  return (
    <section className="view-stack">
      <div className="kpi-grid">
        <Kpi icon={Building2} label="Portfolio value" value={money(dashboard?.kpis?.contract_value)} sub={`${portfolio.length} projects`} />
        <Kpi icon={WalletCards} label="Cost variance" value={money(dashboard?.kpis?.variance)} sub="Budget less actual" />
        <Kpi icon={ClipboardList} label="Requisitions" value={sumBy(procurement.requisitions, 'total')} sub="All statuses" />
        <Kpi icon={Truck} label="Purchase orders" value={sumBy(procurement.purchase_orders, 'total')} sub="All statuses" />
      </div>

      <section className="panel">
        <PanelTitle icon={WalletCards} title="Cost Control Report" />
        <div className="panel-toolbar">
          <DownloadButton filename="cost-control-report.csv" columns={costColumns} rows={costRows} />
        </div>
        <DataTable
          columns={costColumns}
          rows={costRows}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={FolderKanban} title="Portfolio Report" />
        <div className="panel-toolbar">
          <DownloadButton filename="portfolio-report.csv" columns={portfolioColumns} rows={portfolioRows} />
        </div>
        <DataTable
          columns={portfolioColumns}
          rows={portfolioRows.map((row, index) => [
            row[0],
            row[1],
            row[2],
            <Badge key="status" value={portfolio[index]?.status} />,
            row[4],
            row[5],
            row[6],
            row[7],
          ])}
        />
      </section>

      <section className="panel">
        <PanelTitle icon={BarChart3} title="Operational Status Report" />
        <div className="panel-toolbar">
          <DownloadButton filename="operational-status-report.csv" columns={statusColumns} rows={statusRows} />
        </div>
        <DataTable
          columns={statusColumns}
          rows={statusRows}
        />
      </section>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={WalletCards} title="Receivables Report" />
          <div className="panel-toolbar">
            <DownloadButton filename="receivables-report.csv" columns={receivableColumns} rows={receivableRows} />
          </div>
          <DataTable
            columns={receivableColumns}
            rows={receivableRows}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Package} title="Inventory Reorder Report" />
          <div className="panel-toolbar">
            <DownloadButton filename="inventory-reorder-report.csv" columns={reorderColumns} rows={reorderRows} />
          </div>
          <DataTable
            columns={reorderColumns}
            rows={reorderRows}
          />
        </section>
      </div>
    </section>
  )
}

function BusinessIntelligenceView({ bi, forms, setPhaseFourForm, createBiDashboard, createMetricSnapshot, runAction }) {
  const metrics = bi?.metrics || {}
  const snapshots = bi?.snapshots || []
  const meta = bi?.meta || {}
  const filters = bi?.filters || {}
  const alerts = bi?.alerts?.items || []
  const [subject, setSubject] = useState('executive')
  const [editingDashboardId, setEditingDashboardId] = useState(null)
  const [reportFilters, setReportFilters] = useState({
    company_id: '',
    branch_id: '',
    country: '',
    project_id: '',
    client_id: '',
    project_status: '',
    currency: '',
    cost_code: '',
    supplier_id: '',
    reporting_period: '',
  })
  const subjects = [
    ['executive', 'Executive Command Centre'],
    ['portfolio', 'Portfolio Analytics'],
    ['controls', 'Project Controls'],
    ['financial', 'Financial Analytics'],
    ['commercial', 'Commercial & Contracts'],
    ['procurement', 'Procurement Analytics'],
    ['inventory', 'Inventory Analytics'],
    ['schedule', 'Schedule Analytics'],
    ['workforce', 'Workforce Analytics'],
    ['equipment', 'Equipment Analytics'],
    ['quality', 'Quality Assurance / Quality Control Analytics'],
    ['hse', 'Health, Safety, and Environment Analytics'],
    ['risk', 'Risk Analytics'],
    ['sustainability', 'Sustainability Analytics'],
    ['client', 'Client Reporting'],
    ['custom', 'Custom Reports'],
    ['admin', 'Data & Report Administration'],
  ]
  const filteredProjects = filterIntelligenceProjects(bi?.portfolio?.comparison || [], reportFilters)
  const healthData = (bi?.datasets?.calculated_project_health || []).map((item) => ({ name: labelize(item.health), value: Number(item.total), key: item.health }))
  const revenueTrend = bi?.executive?.trends?.revenue_margin || []
  const procurementFunnel = bi?.procurement?.funnel || bi?.datasets?.procurement_funnel || []
  const projectPerformanceData = filteredProjects.map((project) => ({
    project: project.project,
    cpi: toChartNumber(project.cpi),
    spi: toChartNumber(project.spi),
    margin: toChartNumber(project.margin_percent),
    cash_position: toChartNumber(project.cash_position),
  }))
  const scheduleProgressData = filteredProjects.map((project) => ({
    project: project.project,
    planned_progress: toChartNumber(project.planned_progress),
    progress: toChartNumber(project.progress),
  }))
  const contractValueVsEarned = (bi?.executive?.trends?.contract_value_vs_earned || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    contract_value: toChartNumber(row.contract_value),
    earned_value: toChartNumber(row.earned_value),
  }))
  const earnedValueData = (bi?.project_controls?.earned_value || []).filter((row) => filterByProject(row, reportFilters)).map((row) => ({
    project: row.project,
    planned_value: toChartNumber(row.planned_value),
    earned_value: toChartNumber(row.earned_value),
    actual_cost: toChartNumber(row.actual_cost),
    cost_variance: toChartNumber(row.cost_variance),
    schedule_variance_value: toChartNumber(row.schedule_variance_value),
    cpi: toChartNumber(row.cpi),
    spi: toChartNumber(row.spi),
  }))
  const costCodeData = (bi?.project_controls?.cost_code_performance || []).slice(0, 12).map((line) => ({
    cost_code: line.cost_code || line.description || 'Uncoded',
    budget: toChartNumber(line.budget),
    committed: toChartNumber(line.committed),
    actual: toChartNumber(line.actual),
    forecast: toChartNumber(line.forecast),
    variance: toChartNumber(line.variance),
  }))
  const receivablesAgeingData = (bi?.financial?.accounts_receivable?.ageing || []).map((row) => ({
    bucket: row.bucket,
    balance: toChartNumber(row.balance),
  }))
  const cashFlowData = (bi?.financial?.cash_flow?.planned_vs_actual || []).map((row) => ({
    period: row.period,
    inflows: toChartNumber(row.inflows),
    outflows: toChartNumber(row.outflows),
    net_cash_flow: toChartNumber(row.net_cash_flow),
  }))
  const profitByProjectData = (bi?.financial?.revenue_profitability?.profit_by_project || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    gross_profit: toChartNumber(row.gross_profit),
    gross_margin: toChartNumber(row.gross_margin),
  }))
  const commercialCertificationData = (bi?.commercial?.certification_status || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    invoice: row.invoice,
    certified_value: toChartNumber(row.certified_value),
  }))
  const contractKpiData = Object.entries(bi?.commercial?.contract_kpis || {}).map(([key, value]) => ({
    metric: labelize(key),
    value: toChartNumber(value),
  }))
  const supplierSpendData = (bi?.procurement?.spend_by_supplier || bi?.datasets?.supplier_spend || []).map((row) => ({
    supplier: row.supplier,
    spend: toChartNumber(row.spend),
    orders: toChartNumber(row.orders),
  }))
  const procurementProjectSpendData = (bi?.procurement?.spend_by_project || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    spend: toChartNumber(row.spend),
    orders: toChartNumber(row.orders),
  }))
  const inventoryCategoryData = (bi?.inventory?.stock_by_category || []).map((row) => ({
    category: labelize(row.category),
    quantity: toChartNumber(row.quantity),
    value: toChartNumber(row.value),
  }))
  const scheduleVarianceData = (bi?.schedule?.schedule_variance_heatmap || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    variance: toChartNumber(row.variance),
    health: row.health,
  }))
  const workforceDepartmentData = (bi?.workforce?.workforce_by_department || []).map((row) => ({
    department: labelize(row.department),
    employees: toChartNumber(row.employees),
    active: toChartNumber(row.active),
  }))
  const workforceBranchData = (bi?.workforce?.workforce_by_branch || []).map((row) => ({
    branch: row.branch,
    employees: toChartNumber(row.employees),
  }))
  const equipmentStatusData = (bi?.equipment?.status_breakdown || []).map((row) => ({
    name: labelize(row.status),
    value: toChartNumber(row.total),
    key: row.status,
  }))
  const equipmentMaintenanceData = (bi?.equipment?.maintenance_due || []).map((row) => ({
    asset: row.asset || row.number,
    cost: toChartNumber(row.cost),
  }))
  const ncrCategoryData = (bi?.quality?.ncr_by_category || []).map((row) => ({
    name: labelize(row.category),
    value: toChartNumber(row.total),
    key: row.category,
  }))
  const ncrAgeingData = (bi?.quality?.ncr_ageing || []).map((row) => ({
    bucket: row.bucket,
    total: toChartNumber(row.total),
  }))
  const incidentSeverityData = (bi?.hse?.incident_by_severity || []).map((row) => ({
    name: labelize(row.severity),
    value: toChartNumber(row.total),
    key: row.severity,
  }))
  const leadingLaggingData = (bi?.hse?.leading_vs_lagging || []).map((row) => ({
    indicator: row.indicator,
    total: toChartNumber(row.total),
  }))
  const riskExposureData = (bi?.risk?.risk_heatmap || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    exposure: toChartNumber(row.exposure),
    probability: toChartNumber(row.probability),
    impact: toChartNumber(row.impact),
  }))
  const riskCategoryData = (bi?.risk?.risks_by_category || []).map((row) => ({
    category: row.category,
    total: toChartNumber(row.total),
  }))
  const sustainabilityData = [
    ...Object.entries(bi?.sustainability?.environmental || {}).map(([key, value]) => ({ metric: labelize(key), value: toChartNumber(value) })),
    ...Object.entries(bi?.sustainability?.social || {}).map(([key, value]) => ({ metric: labelize(key), value: toChartNumber(value) })),
    ...Object.entries(bi?.sustainability?.governance || {}).map(([key, value]) => ({ metric: labelize(key), value: toChartNumber(value) })),
  ]
  const clientReportData = (bi?.client_reporting?.controlled_reports || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((row) => ({
    project: row.project,
    progress: toChartNumber(row.overall_progress),
    certified_value: toChartNumber(row.certified_value),
  }))
  const dashboardWidgetData = (bi?.dashboards || []).map((dashboard) => ({
    dashboard: dashboard.name,
    widgets: Array.isArray(dashboard.widgets) ? dashboard.widgets.length : 0,
  }))
  const snapshotTrendData = snapshots.slice(0, 12).map((snapshot) => ({
    snapshot: snapshot.period_label || snapshot.snapshot_number,
    revenue: toChartNumber(snapshot.metrics?.revenue_year_to_date),
    contract_value: toChartNumber(snapshot.metrics?.contract_value),
    critical_alerts: toChartNumber(snapshot.metrics?.critical_alerts),
  })).reverse()
  const metricColumns = ['Metric', 'Value']
  const snapshotMetricKeys = Array.from(new Set([...Object.keys(metrics), ...snapshots.flatMap((snapshot) => Object.keys(snapshot.metrics || {}))]))
  const snapshotColumns = ['Snapshot', 'Period', 'Date', ...snapshotMetricKeys.map(labelize)]
  const snapshotRows = snapshots.map((snapshot) => [
    snapshot.snapshot_number || '',
    snapshot.period_label || '',
    shortDate(snapshot.snapshot_date),
    ...snapshotMetricKeys.map((key) => formatMetricValue(key, snapshot.metrics?.[key])),
  ])
  const headlineRows = (bi?.executive?.headline_scorecards || []).map((item) => [item.label, intelligenceValue(item)])
  const projectColumns = ['Project', 'Progress', 'CPI', 'SPI', 'Margin', 'Cash', 'Health, Safety, and Environment', 'Quality', 'Risk', 'Health']
  const projectRows = filteredProjects.map((project) => [
    project.project,
    `${project.progress || 0}%`,
    project.cpi ?? '',
    project.spi ?? '',
    `${project.margin_percent || 0}%`,
    money(project.cash_position),
    project.open_safety_incidents > 0 ? 'Attention' : 'Green',
    project.open_ncrs > 0 ? 'Attention' : 'Green',
    labelize(project.risk_level),
    <Badge key="health" value={project.health} />,
  ])
  const controlRows = (bi?.project_controls?.earned_value || []).filter((row) => filterByProject(row, reportFilters)).map((row) => [
    row.project,
    money(row.planned_value),
    money(row.earned_value),
    money(row.actual_cost),
    money(row.cost_variance),
    money(row.schedule_variance_value),
    row.cpi ?? '',
    row.spi ?? '',
    money(row.estimate_at_completion),
    row.to_complete_performance_index ?? '',
  ])
  const financialRows = (bi?.financial?.accounts_receivable?.drilldown || []).filter((row) => filterByProjectName(row, reportFilters, filteredProjects)).map((invoice) => [
    invoice.number,
    invoice.client,
    invoice.project,
    shortDate(invoice.due_date),
    labelize(invoice.payment_status),
    money(invoice.total),
    money(invoice.balance),
  ])
  const payableRows = (bi?.financial?.accounts_payable?.drilldown || []).map((invoice) => [
    invoice.number,
    invoice.supplier,
    invoice.po,
    labelize(invoice.status),
    shortDate(invoice.due_date),
    money(invoice.total),
    money(invoice.balance),
  ])
  const alertRows = alerts.map((alert) => [
    <Badge key="severity" value={alert.severity} />,
    alert.category,
    alert.project || '',
    alert.title,
    alert.responsible_person,
    alert.escalation_level,
    alert.recommended_action,
  ])

  function setFilterValue(event) {
    const { name, value } = event.target
    setReportFilters((current) => ({ ...current, [name]: value }))
  }

  function applySavedView(view) {
    const criteria = view.criteria || {}
    setReportFilters((current) => ({
      ...current,
      project_status: criteria.project_status || current.project_status,
    }))
  }

  function setDashboardFormValues(values) {
    Object.entries(values).forEach(([name, value]) => {
      setPhaseFourForm('dashboard')({ target: { name, value } })
    })
  }

  function saveBiDashboard(event) {
    if (!editingDashboardId) {
      createBiDashboard(event)
      return
    }

    event.preventDefault()
    const form = forms.dashboard

    runAction(
      () =>
        api.updateBiDashboard(editingDashboardId, {
          name: form.name,
          audience: form.audience,
          refresh_interval: form.refresh_interval,
          is_default: form.is_default === 'true',
        }),
      'Dashboard updated.',
    ).then(() => {
      setEditingDashboardId(null)
      setDashboardFormValues(emptyPhaseFourForms.dashboard)
    })
  }

  function editBiDashboard(dashboard) {
    setEditingDashboardId(dashboard.id)
    setDashboardFormValues({
      name: dashboard.name || '',
      audience: dashboard.audience || 'operations',
      refresh_interval: dashboard.refresh_interval || 'daily',
      is_default: dashboard.is_default ? 'true' : 'false',
    })
  }

  function cancelBiDashboardEdit() {
    setEditingDashboardId(null)
    setDashboardFormValues(emptyPhaseFourForms.dashboard)
  }

  function archiveBiDashboard(dashboard) {
    if (!window.confirm(`Archive dashboard ${dashboard.name}?`)) {
      return
    }

    runAction(() => api.deleteBiDashboard(dashboard.id), 'Dashboard archived.').then(() => {
      if (editingDashboardId === dashboard.id) {
        cancelBiDashboardEdit()
      }
    })
  }

  function renderExecutive() {
    return (
      <>
        <div className="kpi-grid">
          <Kpi icon={FolderKanban} label="Total contract value" value={money(metrics.contract_value)} sub={`${metrics.active_projects || 0} active projects`} />
          <Kpi icon={WalletCards} label="Cash position" value={money(metrics.cash_position)} sub="Receipts less supplier payments and paid expenses" />
          <Kpi icon={BarChart3} label="Gross margin" value={`${metrics.gross_margin || 0}%`} sub={money(metrics.gross_profit)} />
          <Kpi icon={AlertTriangle} label="Executive alerts" value={metrics.critical_alerts || 0} sub={`${metrics.projects_at_risk || 0} projects at risk`} />
        </div>

        <div className="grid-main">
          <ChartPanel icon={BarChart3} title="Revenue Trend">
            <AnalyticsBarChart
              data={revenueTrend}
              xKey="period"
              bars={[{ key: 'revenue', color: '#2364d8' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={ShieldCheck} title="Portfolio Health">
            <AnalyticsPieChart data={healthData} />
          </ChartPanel>

          <ChartPanel icon={WalletCards} title="Contract Value vs Earned Revenue">
            <AnalyticsBarChart
              data={contractValueVsEarned}
              xKey="project"
              bars={[
                { key: 'contract_value', color: '#2364d8' },
                { key: 'earned_value', color: '#188a5a' },
              ]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>
        </div>

        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={ClipboardList} title="Headline Scorecards" />
            <div className="panel-toolbar">
              <DownloadButton filename="intelligence-headline-scorecards.csv" columns={metricColumns} rows={headlineRows} />
            </div>
            <DataTable columns={metricColumns} rows={headlineRows} />
          </section>

          <section className="panel">
            <PanelTitle icon={AlertTriangle} title="Action Required" />
            <div className="panel-toolbar">
              <DownloadButton filename="intelligence-executive-actions.csv" columns={['Severity', 'Area', 'Project', 'Issue', 'Owner', 'Escalation', 'Action']} rows={alerts.map((alert) => [alert.severity, alert.category, alert.project || '', alert.title, alert.responsible_person, alert.escalation_level, alert.recommended_action])} />
            </div>
            <DataTable columns={['Severity', 'Area', 'Project', 'Issue', 'Owner', 'Escalation', 'Action']} rows={alertRows.slice(0, 10)} />
          </section>
        </div>
      </>
    )
  }

  function renderPortfolio() {
    return (
      <>
        <div className="grid-main">
          <ChartPanel icon={Workflow} title="CPI and SPI by Project">
            <AnalyticsBarChart
              data={projectPerformanceData}
              xKey="project"
              bars={[
                { key: 'cpi', color: '#2364d8' },
                { key: 'spi', color: '#188a5a' },
              ]}
              valueFormatter={(value) => toChartNumber(value).toFixed(2)}
            />
          </ChartPanel>

          <ChartPanel icon={WalletCards} title="Gross Margin by Project">
            <AnalyticsBarChart
              data={projectPerformanceData}
              xKey="project"
              bars={[{ key: 'margin', color: '#b66a05' }]}
              valueFormatter={(value) => `${toChartNumber(value).toFixed(0)}%`}
            />
          </ChartPanel>

          <ChartPanel icon={WalletCards} title="Cash Position by Project">
            <AnalyticsBarChart
              data={projectPerformanceData}
              xKey="project"
              bars={[{ key: 'cash_position', color: '#0f766e' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>
        </div>

        <section className="panel">
          <PanelTitle icon={FolderKanban} title="Portfolio Comparison" />
          <div className="panel-toolbar">
            <DownloadButton filename="portfolio-comparison.csv" columns={projectColumns} rows={projectRows.map((row) => row.map((cell) => (typeof cell === 'object' ? '' : cell)))} />
          </div>
          <DataTable columns={projectColumns} rows={projectRows} />
        </section>
        <div className="grid-main">
          <RankPanel title="Highest Profitability" rows={bi?.portfolio?.rankings?.profitability || []} valueKey="margin_percent" valueSuffix="%" />
          <RankPanel title="Schedule Pressure" rows={bi?.portfolio?.rankings?.schedule_delay || []} valueKey="schedule_variance" valueSuffix="%" />
        </div>
      </>
    )
  }

  function renderControls() {
    return (
      <>
        <div className="grid-main">
          <ChartPanel icon={Workflow} title="Earned Value S-Curve Inputs">
            <AnalyticsBarChart
              data={earnedValueData}
              xKey="project"
              bars={[
                { key: 'planned_value', color: '#2364d8' },
                { key: 'earned_value', color: '#188a5a' },
                { key: 'actual_cost', color: '#c3382f' },
              ]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={AlertTriangle} title="Cost and Schedule Variance">
            <AnalyticsBarChart
              data={earnedValueData}
              xKey="project"
              bars={[
                { key: 'cost_variance', color: '#b66a05' },
                { key: 'schedule_variance_value', color: '#6d5dfc' },
              ]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={Calculator} title="Cost Code Actual vs Forecast">
            <AnalyticsBarChart
              data={costCodeData}
              xKey="cost_code"
              bars={[
                { key: 'actual', color: '#2364d8' },
                { key: 'forecast', color: '#188a5a' },
              ]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>
        </div>

        <section className="panel">
          <PanelTitle icon={Workflow} title="Earned Value Controls" />
          <div className="panel-toolbar">
            <DownloadButton filename="project-controls-earned-value.csv" columns={['Project', 'PV', 'EV', 'AC', 'CV', 'SV', 'CPI', 'SPI', 'EAC', 'TCPI']} rows={controlRows} />
          </div>
          <DataTable columns={['Project', 'PV', 'EV', 'AC', 'CV', 'SV', 'CPI', 'SPI', 'EAC', 'TCPI']} rows={controlRows} />
        </section>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={Clock3} title="Delayed Activities" />
            <DataTable
              columns={['Project', 'Activity', 'Priority', 'Status', 'Progress', 'Due', 'Days late']}
              rows={(bi?.project_controls?.delayed_activities || []).map((task) => [task.project, task.activity, labelize(task.priority), labelize(task.status), `${task.progress}%`, shortDate(task.due_date), task.days_late])}
            />
          </section>
          <section className="panel">
            <PanelTitle icon={Calculator} title="Cost Code Performance" />
            <DataTable
              columns={['Project', 'Cost code', 'Category', 'Budget', 'Committed', 'Actual', 'Forecast', 'Variance']}
              rows={(bi?.project_controls?.cost_code_performance || []).map((line) => [line.project, line.cost_code, labelize(line.category), money(line.budget), money(line.committed), money(line.actual), money(line.forecast), money(line.variance)])}
            />
          </section>
        </div>
      </>
    )
  }

  function renderFinancial() {
    const ageRows = bi?.financial?.accounts_receivable?.ageing || []
    return (
      <>
        <div className="kpi-grid">
          <Kpi icon={WalletCards} label="Recognized revenue" value={money(bi?.financial?.revenue_profitability?.recognized_revenue)} sub="Issued non-draft invoices" />
          <Kpi icon={WalletCards} label="Collected revenue" value={money(bi?.financial?.revenue_profitability?.collected_revenue)} sub="Receipts recorded" />
          <Kpi icon={AlertTriangle} label="Overdue client payments" value={money(bi?.financial?.cash_flow?.overdue_client_payments)} sub="Drill down below" />
          <Kpi icon={Truck} label="Accounts payable" value={money(bi?.financial?.accounts_payable?.outstanding)} sub="Supplier obligations" />
        </div>
        <div className="grid-main">
          <ChartPanel icon={WalletCards} title="Cash Flow Trend">
            <AnalyticsBarChart
              data={cashFlowData}
              xKey="period"
              bars={[
                { key: 'inflows', color: '#188a5a' },
                { key: 'outflows', color: '#c3382f' },
                { key: 'net_cash_flow', color: '#2364d8' },
              ]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={Clock3} title="Receivables Ageing">
            <AnalyticsBarChart
              data={receivablesAgeingData}
              xKey="bucket"
              bars={[{ key: 'balance', color: '#b66a05' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={BarChart3} title="Profit by Project">
            <AnalyticsBarChart
              data={profitByProjectData}
              xKey="project"
              bars={[{ key: 'gross_profit', color: '#2364d8' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>
        </div>
        <div className="grid-main">
          <section className="panel">
            <PanelTitle icon={WalletCards} title="Accounts Receivable Drill-Down" />
            <div className="panel-toolbar">
              <DownloadButton filename="accounts-receivable-drilldown.csv" columns={['Invoice', 'Client', 'Project', 'Due', 'Payment', 'Total', 'Balance']} rows={financialRows} />
            </div>
            <DataTable columns={['Invoice', 'Client', 'Project', 'Due', 'Payment', 'Total', 'Balance']} rows={financialRows} />
          </section>
          <section className="panel">
            <PanelTitle icon={Clock3} title="Receivables Ageing" />
            <DataTable columns={['Bucket', 'Balance']} rows={ageRows.map((row) => [row.bucket, money(row.balance)])} />
          </section>
        </div>
        <section className="panel">
          <PanelTitle icon={Truck} title="Accounts Payable Drill-Down" />
          <DataTable columns={['Invoice', 'Supplier', 'PO', 'Status', 'Due', 'Total', 'Balance']} rows={payableRows} />
        </section>
      </>
    )
  }

  function renderProcurement() {
    const kpis = bi?.procurement?.kpis || {}
    return (
      <>
        <div className="kpi-grid">
          <Kpi icon={Truck} label="Procurement spend" value={money(kpis.procurement_spend)} sub={`${kpis.open_purchase_orders || 0} open POs`} />
          <Kpi icon={ClipboardList} label="Pending approvals" value={kpis.pending_approvals || 0} sub={`${kpis.open_requisitions || 0} open requisitions`} />
          <Kpi icon={Clock3} label="Late deliveries" value={kpis.late_deliveries || 0} sub={`${kpis.orders_awaiting_delivery || 0} awaiting delivery`} />
          <Kpi icon={AlertTriangle} label="Invoice exceptions" value={kpis.invoice_match_exceptions || 0} sub="Three-way match focus" />
        </div>
        <div className="grid-main">
          <ChartPanel icon={Workflow} title="Procure-To-Pay Funnel">
            <AnalyticsBarChart
              data={procurementFunnel}
              xKey="stage"
              bars={[{ key: 'count', color: '#188a5a' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          </ChartPanel>

          <ChartPanel icon={Truck} title="Spend by Supplier">
            <AnalyticsBarChart
              data={supplierSpendData}
              xKey="supplier"
              bars={[{ key: 'spend', color: '#2364d8' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <ChartPanel icon={FolderKanban} title="Spend by Project">
            <AnalyticsBarChart
              data={procurementProjectSpendData}
              xKey="project"
              bars={[{ key: 'spend', color: '#b66a05' }]}
              valueFormatter={(value) => money(value)}
            />
          </ChartPanel>

          <section className="panel">
            <PanelTitle icon={Truck} title="Supplier Scorecard" />
            <DataTable columns={['Supplier', 'Spend', 'Orders', 'On-time', 'Late', 'Rejection', 'Outstanding']} rows={(bi?.procurement?.supplier_scorecards || []).map((supplier) => [supplier.supplier, money(supplier.total_spend), supplier.orders, `${supplier.on_time_delivery}%`, supplier.late_deliveries, `${supplier.rejection_rate}%`, money(supplier.outstanding_balance)])} />
          </section>
        </div>
        <section className="panel">
          <PanelTitle icon={AlertTriangle} title="Late Delivery Drill-Down" />
          <DataTable columns={['PO', 'Supplier', 'Project', 'Expected', 'Status', 'Value']} rows={(bi?.procurement?.late_delivery_drilldown || []).map((po) => [po.po, po.supplier, po.project, shortDate(po.expected_delivery_date), labelize(po.status), money(po.value)])} />
        </section>
      </>
    )
  }

  function renderOperational(areaKey, title, kpis = {}, tables = [], charts = []) {
    return (
      <>
        <div className="kpi-grid">
          {Object.entries(kpis).slice(0, 8).map(([key, value]) => (
            <Kpi key={key} icon={BarChart3} label={labelize(key)} value={formatMetricValue(key, value)} sub={title} />
          ))}
        </div>
        {charts.length > 0 && (
          <div className="grid-main">
            {charts.map((chart) => (
              <ChartPanel key={chart.title} icon={chart.icon || BarChart3} title={chart.title}>
                {chart.content}
              </ChartPanel>
            ))}
          </div>
        )}
        <div className="grid-main">
          {tables.map((table) => (
            <section key={table.title} className="panel">
              <PanelTitle icon={table.icon || ClipboardList} title={table.title} />
              {table.download && <div className="panel-toolbar"><DownloadButton filename={table.download} columns={table.columns} rows={table.rows} /></div>}
              <DataTable columns={table.columns} rows={table.rows} />
            </section>
          ))}
        </div>
      </>
    )
  }

  function renderCurrentSubject() {
    if (subject === 'executive') return renderExecutive()
    if (subject === 'portfolio') return renderPortfolio()
    if (subject === 'controls') return renderControls()
    if (subject === 'financial') return renderFinancial()
    if (subject === 'procurement') return renderProcurement()
    if (subject === 'commercial') {
      return renderOperational('commercial', 'Commercial & Contracts', bi?.commercial?.contract_kpis || {}, [
        { title: 'Certification Status', columns: ['Invoice', 'Client', 'Project', 'Certified', 'Payment', 'Due'], rows: (bi?.commercial?.certification_status || []).map((row) => [row.invoice, row.client, row.project, money(row.certified_value), labelize(row.payment_status), shortDate(row.due_date)]), download: 'commercial-certification-status.csv' },
        { title: 'Critical Contract Alerts', columns: ['Approval', 'Title', 'Status', 'Due', 'Action'], rows: (bi?.commercial?.critical_alerts || []).map((row) => [row.approval, row.title, labelize(row.status), shortDate(row.due_date), row.recommended_action]) },
      ], [
        {
          title: 'Certified Value by Invoice',
          icon: WalletCards,
          content: (
            <AnalyticsBarChart
              data={commercialCertificationData}
              xKey="invoice"
              bars={[{ key: 'certified_value', color: '#2364d8' }]}
              valueFormatter={(value) => money(value)}
            />
          ),
        },
        {
          title: 'Contract KPI Mix',
          icon: Handshake,
          content: (
            <AnalyticsBarChart
              data={contractKpiData}
              xKey="metric"
              bars={[{ key: 'value', color: '#188a5a' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'inventory') {
      return renderOperational('inventory', 'Inventory Analytics', bi?.inventory?.kpis || {}, [
        { title: 'Stock By Category', columns: ['Category', 'Quantity', 'Value'], rows: (bi?.inventory?.stock_by_category || []).map((row) => [labelize(row.category), row.quantity, money(row.value)]), download: 'inventory-stock-by-category.csv' },
        { title: 'Reorder Requirements', columns: ['Stock Keeping Unit (SKU)', 'Item', 'Category', 'On hand', 'Reorder', 'Average cost', 'Value'], rows: (bi?.inventory?.reorder_drilldown || []).map((row) => [row.sku, row.item, labelize(row.category), row.on_hand, row.reorder_level, money(row.average_cost), money(row.value)]), download: 'inventory-reorder-requirements.csv' },
      ], [
        {
          title: 'Stock Value by Category',
          icon: Package,
          content: (
            <AnalyticsBarChart
              data={inventoryCategoryData}
              xKey="category"
              bars={[{ key: 'value', color: '#2364d8' }]}
              valueFormatter={(value) => money(value)}
            />
          ),
        },
        {
          title: 'Stock Quantity by Category',
          icon: BarChart3,
          content: (
            <AnalyticsBarChart
              data={inventoryCategoryData}
              xKey="category"
              bars={[{ key: 'quantity', color: '#188a5a' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'schedule') {
      return renderOperational('schedule', 'Schedule Analytics', bi?.schedule?.kpis || {}, [
        { title: 'Critical Path Activities', columns: ['Project', 'Activity', 'Priority', 'Status', 'Progress', 'Due'], rows: (bi?.schedule?.critical_path || []).map((row) => [row.project, row.activity, labelize(row.priority), labelize(row.status), `${row.progress}%`, shortDate(row.due_date)]), download: 'schedule-critical-path.csv' },
        { title: 'Six-Week Forecast', columns: ['Project', 'Activity', 'Status', 'Due'], rows: (bi?.schedule?.six_week_forecast || []).map((row) => [row.project, row.activity, labelize(row.status), shortDate(row.due_date)]) },
      ], [
        {
          title: 'Planned vs Actual Progress',
          icon: CalendarDays,
          content: (
            <AnalyticsBarChart
              data={scheduleProgressData}
              xKey="project"
              bars={[
                { key: 'planned_progress', color: '#2364d8' },
                { key: 'progress', color: '#188a5a' },
              ]}
              valueFormatter={(value) => `${toChartNumber(value).toFixed(0)}%`}
            />
          ),
        },
        {
          title: 'Schedule Variance by Project',
          icon: AlertTriangle,
          content: (
            <AnalyticsBarChart
              data={scheduleVarianceData}
              xKey="project"
              bars={[{ key: 'variance', color: '#b66a05' }]}
              valueFormatter={(value) => `${toChartNumber(value).toFixed(1)}%`}
            />
          ),
        },
      ])
    }
    if (subject === 'workforce') {
      return renderOperational('workforce', 'Workforce Analytics', bi?.workforce?.kpis || {}, [
        { title: 'Workforce By Department', columns: ['Department', 'Employees', 'Active'], rows: (bi?.workforce?.workforce_by_department || []).map((row) => [labelize(row.department), row.employees, row.active]), download: 'workforce-by-department.csv' },
        { title: 'Workforce By Branch', columns: ['Branch', 'Employees'], rows: (bi?.workforce?.workforce_by_branch || []).map((row) => [row.branch, row.employees]) },
      ], [
        {
          title: 'Workforce by Department',
          icon: Users,
          content: (
            <AnalyticsBarChart
              data={workforceDepartmentData}
              xKey="department"
              bars={[
                { key: 'employees', color: '#2364d8' },
                { key: 'active', color: '#188a5a' },
              ]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
        {
          title: 'Workforce by Branch',
          icon: Building2,
          content: (
            <AnalyticsBarChart
              data={workforceBranchData}
              xKey="branch"
              bars={[{ key: 'employees', color: '#6d5dfc' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'equipment') {
      return renderOperational('equipment', 'Equipment Analytics', bi?.equipment?.kpis || {}, [
        { title: 'Maintenance Due', columns: ['No.', 'Asset', 'Type', 'Status', 'Date', 'Cost'], rows: (bi?.equipment?.maintenance_due || []).map((row) => [row.number, row.asset, labelize(row.type), labelize(row.status), shortDate(row.service_date), money(row.cost)]), download: 'equipment-maintenance-due.csv' },
        { title: 'Underutilized Equipment', columns: ['No.', 'Asset', 'Category', 'Hourly rate'], rows: (bi?.equipment?.underutilized_equipment || []).map((row) => [row.number, row.asset, labelize(row.category), money(row.hourly_rate)]) },
      ], [
        {
          title: 'Fleet Status Breakdown',
          icon: Truck,
          content: <AnalyticsPieChart data={equipmentStatusData} />,
        },
        {
          title: 'Maintenance Cost Due',
          icon: Calculator,
          content: (
            <AnalyticsBarChart
              data={equipmentMaintenanceData}
              xKey="asset"
              bars={[{ key: 'cost', color: '#c3382f' }]}
              valueFormatter={(value) => money(value)}
            />
          ),
        },
      ])
    }
    if (subject === 'quality') {
      return renderOperational('quality', 'Quality Assurance / Quality Control Analytics', bi?.quality?.kpis || {}, [
        { title: 'Non-Conformance Report(NCR) Drill-Down', columns: ['No.', 'Project', 'Title', 'Category', 'Root cause', 'Severity', 'Status', 'Due'], rows: (bi?.quality?.ncr_drilldown || []).map((row) => [row.number, row.project, row.title, labelize(row.category), row.root_cause || '', labelize(row.severity), labelize(row.status), shortDate(row.due_date)]), download: 'quality-non-conformance-report-drilldown.csv' },
        { title: 'Inspection Register', columns: ['No.', 'Project', 'Type', 'Area', 'Status', 'Score', 'Scheduled'], rows: (bi?.quality?.inspection_register || []).map((row) => [row.number, row.project, labelize(row.type), row.area, labelize(row.status), row.score, shortDate(row.scheduled_on)]) },
      ], [
        {
          title: 'Non-Conformance Reports(NCRs) by Category',
          icon: ShieldCheck,
          content: <AnalyticsPieChart data={ncrCategoryData} />,
        },
        {
          title: 'Open Non-Conformance Report(NCR) Ageing',
          icon: Clock3,
          content: (
            <AnalyticsBarChart
              data={ncrAgeingData}
              xKey="bucket"
              bars={[{ key: 'total', color: '#c3382f' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'hse') {
      return renderOperational('hse', `Health, Safety, and Environment Analytics (${bi?.hse?.exposure_basis || 'rate basis not set'})`, bi?.hse?.kpis || {}, [
        { title: 'Incident Drill-Down', columns: ['No.', 'Project', 'Type', 'Severity', 'Status', 'Location', 'Occurred'], rows: (bi?.hse?.incident_drilldown || []).map((row) => [row.number, row.project, labelize(row.type), labelize(row.severity), labelize(row.status), row.location, shortDate(row.occurred_at)]), download: 'hse-incident-drilldown.csv' },
        { title: 'Leading vs Lagging', columns: ['Indicator', 'Total'], rows: (bi?.hse?.leading_vs_lagging || []).map((row) => [row.indicator, row.total]) },
      ], [
        {
          title: 'Incidents by Severity',
          icon: AlertTriangle,
          content: <AnalyticsPieChart data={incidentSeverityData} />,
        },
        {
          title: 'Leading vs Lagging Indicators',
          icon: ShieldCheck,
          content: (
            <AnalyticsBarChart
              data={leadingLaggingData}
              xKey="indicator"
              bars={[{ key: 'total', color: '#188a5a' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'risk') {
      return renderOperational('risk', 'Risk Analytics', bi?.risk?.kpis || {}, [
        { title: 'Top Risks', columns: ['Severity', 'Area', 'Project', 'Issue', 'Action'], rows: (bi?.risk?.top_risks || []).map((row) => [labelize(row.severity), row.category, row.project || '', row.title, row.recommended_action]), download: 'risk-top-risks.csv' },
        { title: 'Risk Heatmap', columns: ['Project', 'Probability', 'Impact', 'Exposure', 'Health'], rows: (bi?.risk?.risk_heatmap || []).map((row) => [row.project, row.probability, row.impact, money(row.exposure), labelize(row.health)]) },
      ], [
        {
          title: 'Risk Exposure by Project',
          icon: AlertTriangle,
          content: (
            <AnalyticsBarChart
              data={riskExposureData}
              xKey="project"
              bars={[{ key: 'exposure', color: '#c3382f' }]}
              valueFormatter={(value) => money(value)}
            />
          ),
        },
        {
          title: 'Probability and Impact',
          icon: BarChart3,
          content: (
            <AnalyticsBarChart
              data={riskExposureData}
              xKey="project"
              bars={[
                { key: 'probability', color: '#b66a05' },
                { key: 'impact', color: '#6d5dfc' },
              ]}
              valueFormatter={(value) => toChartNumber(value).toFixed(0)}
            />
          ),
        },
        {
          title: 'Risks by Category',
          icon: ClipboardList,
          content: (
            <AnalyticsBarChart
              data={riskCategoryData}
              xKey="category"
              bars={[{ key: 'total', color: '#2364d8' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'sustainability') {
      return renderOperational('sustainability', 'Sustainability Analytics', { ...(bi?.sustainability?.environmental || {}), ...(bi?.sustainability?.social || {}), ...(bi?.sustainability?.governance || {}) }, [
        { title: 'ESG Note', columns: ['Area', 'Definition'], rows: [['Emissions factor', bi?.sustainability?.emissions_factor_note || '']] },
      ], [
        {
          title: 'ESG Indicator Values',
          icon: Globe2,
          content: (
            <AnalyticsBarChart
              data={sustainabilityData}
              xKey="metric"
              bars={[{ key: 'value', color: '#188a5a' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          ),
        },
      ])
    }
    if (subject === 'client') {
      return renderOperational('client', 'Client Reporting', { pending_decisions: bi?.client_reporting?.pending_decisions || 0 }, [
        { title: 'Controlled Client Reports', columns: ['Project', 'Client', 'Progress', 'Milestones', 'Certified', 'Payment', 'Risks', 'Quality', 'Safety'], rows: (bi?.client_reporting?.controlled_reports || []).map((row) => [row.project, row.client, `${row.overall_progress}%`, labelize(row.milestone_status), money(row.certified_value), labelize(row.payment_status), row.major_risks, row.quality_summary, row.safety_summary]), download: 'client-controlled-reports.csv' },
        { title: 'Hidden Internal Fields', columns: ['Confidential Field'], rows: (bi?.client_reporting?.hidden_internal_fields || []).map((field) => [labelize(field)]) },
      ], [
        {
          title: 'Client Report Progress',
          icon: ClipboardList,
          content: (
            <AnalyticsBarChart
              data={clientReportData}
              xKey="project"
              bars={[{ key: 'progress', color: '#2364d8' }]}
              valueFormatter={(value) => `${toChartNumber(value).toFixed(0)}%`}
            />
          ),
        },
        {
          title: 'Certified Value by Client Report',
          icon: WalletCards,
          content: (
            <AnalyticsBarChart
              data={clientReportData}
              xKey="project"
              bars={[{ key: 'certified_value', color: '#188a5a' }]}
              valueFormatter={(value) => money(value)}
            />
          ),
        },
      ])
    }
    if (subject === 'custom') {
      return (
        <div className="grid-main">
          <ChartPanel icon={BarChart3} title="Dashboard Widget Coverage">
            <AnalyticsBarChart
              data={dashboardWidgetData}
              xKey="dashboard"
              bars={[{ key: 'widgets', color: '#2364d8' }]}
              valueFormatter={(value) => compactFormatter.format(toChartNumber(value))}
            />
          </ChartPanel>
          <section className="panel">
            <PanelTitle icon={Plus} title={editingDashboardId ? 'Edit Dashboard' : 'Custom Dashboard Builder'} />
            <form className="form-grid two" onSubmit={saveBiDashboard}>
              <Field label="Name" name="name" value={forms.dashboard.name} onChange={setPhaseFourForm('dashboard')} required />
              <Select label="Audience" name="audience" value={forms.dashboard.audience} onChange={setPhaseFourForm('dashboard')}>
                <option value="executive">Executive</option>
                <option value="operations">Operations</option>
                <option value="finance">Finance</option>
                <option value="commercial">Commercial</option>
                <option value="qhse">Quality Assurance and Health, Safety, and Environment</option>
              </Select>
              <Select label="Refresh" name="refresh_interval" value={forms.dashboard.refresh_interval} onChange={setPhaseFourForm('dashboard')}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Select label="Default" name="is_default" value={forms.dashboard.is_default} onChange={setPhaseFourForm('dashboard')}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
              <div className="row-actions span-2">
                <button type="submit" className="primary-action">
                  {editingDashboardId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                  {editingDashboardId ? 'Save dashboard' : 'Create dashboard'}
                </button>
                {editingDashboardId && (
                  <button type="button" className="table-action" onClick={cancelBiDashboardEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="panel">
            <PanelTitle icon={BarChart3} title="Dashboards" />
            <DataTable
              columns={['Name', 'Audience', 'Refresh', 'Default', 'Widgets', 'Actions']}
              rows={(bi.dashboards || []).map((dashboard) => [
                dashboard.name,
                labelize(dashboard.audience),
                labelize(dashboard.refresh_interval),
                dashboard.is_default ? 'Yes' : 'No',
                (dashboard.widgets || []).map((widget) => widget.title).join(', '),
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => editBiDashboard(dashboard)}>
                    Edit
                  </button>
                  <button type="button" className="table-action danger" onClick={() => archiveBiDashboard(dashboard)}>
                    Archive
                  </button>
                </div>,
              ])}
            />
          </section>
        </div>
      )
    }

    return (
      <div className="grid-main">
        <ChartPanel icon={BarChart3} title="Snapshot Revenue Trend">
          <AnalyticsBarChart
            data={snapshotTrendData}
            xKey="snapshot"
            bars={[
              { key: 'revenue', color: '#2364d8' },
              { key: 'contract_value', color: '#188a5a' },
            ]}
            valueFormatter={(value) => money(value)}
          />
        </ChartPanel>
        <section className="panel">
          <PanelTitle icon={ClipboardList} title="Snapshots" />
          <div className="row-actions">
            <button type="button" className="primary-action compact-action" onClick={createMetricSnapshot}><CheckCircle2 size={17} />Create snapshot</button>
            <DownloadButton filename="intelligence-metric-snapshots.csv" columns={snapshotColumns} rows={snapshotRows} />
          </div>
          <DataTable columns={snapshotColumns} rows={snapshotRows} />
        </section>
        <section className="panel">
          <PanelTitle icon={FileText} title="KPI Definitions" />
          <DataTable columns={['KPI', 'Definition']} rows={Object.entries(meta.kpi_definitions || {})} />
        </section>
      </div>
    )
  }

  return (
    <section className="view-stack">
      <section className="panel">
        <PanelTitle icon={Settings} title="Global Filters" />
        <div className="intelligence-filter-grid">
          <Select label="Company" name="company_id" value={reportFilters.company_id} onChange={setFilterValue}>
            <option value="">All companies</option>
            {(filters.companies || []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </Select>
          <Select label="Branch" name="branch_id" value={reportFilters.branch_id} onChange={setFilterValue}>
            <option value="">All branches</option>
            {(filters.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
          <Select label="Country" name="country" value={reportFilters.country} onChange={setFilterValue}>
            <option value="">All countries</option>
            {(filters.countries || []).map((country) => <option key={country} value={country}>{country}</option>)}
          </Select>
          <Select label="Project" name="project_id" value={reportFilters.project_id} onChange={setFilterValue}>
            <option value="">All projects</option>
            {(filters.projects || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
          <Select label="Client" name="client_id" value={reportFilters.client_id} onChange={setFilterValue}>
            <option value="">All clients</option>
            {(filters.clients || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </Select>
          <Select label="Project status" name="project_status" value={reportFilters.project_status} onChange={setFilterValue}>
            <option value="">All statuses</option>
            {(filters.project_statuses || []).map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
          </Select>
          <Select label="Currency" name="currency" value={reportFilters.currency} onChange={setFilterValue}>
            <option value="">All currencies</option>
            {(filters.currencies || []).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </Select>
          <Select label="Cost code" name="cost_code" value={reportFilters.cost_code} onChange={setFilterValue}>
            <option value="">All cost codes</option>
            {(filters.cost_codes || []).map((costCode) => <option key={costCode} value={costCode}>{costCode}</option>)}
          </Select>
          <Select label="Supplier" name="supplier_id" value={reportFilters.supplier_id} onChange={setFilterValue}>
            <option value="">All suppliers</option>
            {(filters.suppliers || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </Select>
          <Field label="Reporting period" type="month" name="reporting_period" value={reportFilters.reporting_period} onChange={setFilterValue} />
        </div>
        <div className="saved-view-row">
          {(filters.saved_views || []).map((view) => (
            <button key={view.name} type="button" className="table-action" onClick={() => applySavedView(view)}>
              {view.name}
            </button>
          ))}
          <button type="button" className="table-action" onClick={() => setReportFilters({ company_id: '', branch_id: '', country: '', project_id: '', client_id: '', project_status: '', currency: '', cost_code: '', supplier_id: '', reporting_period: '' })}>
            Clear filters
          </button>
        </div>
      </section>

      <div className="module-tabs intelligence-tabs">
        {subjects.map(([id, label]) => (
          <button key={id} type="button" className={subject === id ? 'active' : ''} onClick={() => setSubject(id)}>
            {label}
          </button>
        ))}
      </div>

      {renderCurrentSubject()}
    </section>
  )
}

function AutomationView({ automation = emptyAutomationData, forms, setPhaseFourForm, createAutomationRule, runAction }) {
  const summary = automation?.summary || {}
  const catalog = automation?.catalog || {}
  const analytics = automation?.analytics || {}
  const rules = automation?.rules || []
  const runs = automation?.runs || []
  const templates = automation?.templates || []
  const notifications = automation?.notifications || []
  const notificationSettings = automation?.notification_settings || emptyAutomationData.notification_settings
  const [activeTab, setActiveTab] = useState('dashboard')
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [search, setSearch] = useState('')
  const [settingsForm, setSettingsForm] = useState(() => notificationSettingsForm(notificationSettings))
  const form = forms.automation
  const moduleOptions = catalog.modules?.length ? catalog.modules : ['projects', 'procurement', 'finance', 'hr', 'inventory', 'field', 'equipment', 'qa_hse', 'crm', 'documents', 'general']
  const triggerOptions = catalog.triggers?.length ? catalog.triggers : [{ key: 'material_request_submitted', label: 'Material Request Submitted', module: 'procurement' }]
  const operatorOptions = catalog.operators?.length ? catalog.operators : ['equals', 'greater_than', 'less_than', 'not_empty']
  const fieldOptions = catalog.condition_fields?.length ? catalog.condition_fields : ['amount', 'status', 'priority', 'severity', 'budget_percent', 'stock_level', 'due_date']
  const actionOptions = catalog.actions?.length ? catalog.actions : [{ key: 'create_insight', label: 'Create In-App Insight' }]
  const scheduleOptions = catalog.schedules?.length ? catalog.schedules : ['event_driven', 'manual', 'daily', 'weekly', 'monthly']
  const approvalOptions = catalog.approval_modes?.length ? catalog.approval_modes : ['none', 'single', 'sequential', 'parallel', 'finance', 'executive']
  const tabs = [
    ['dashboard', 'Dashboard', BarChart3],
    ['workflows', 'Workflows', Workflow],
    ['templates', 'Templates', FileText],
    ['triggers', 'Triggers', RefreshCcw],
    ['conditions', 'Conditions', ShieldCheck],
    ['actions', 'Actions', Send],
    ['schedules', 'Schedules', CalendarDays],
    ['approvals', 'Approvals', CheckCircle2],
    ['logs', 'Logs', Clock3],
    ['analytics', 'Analytics', BarChart3],
    ['settings', 'Settings', Settings],
  ]
  const searchable = (item) => !search.trim() || JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase())
  const filteredRules = rules.filter(searchable)
  const filteredRuns = runs.filter(searchable)
  const filteredTemplates = templates.filter(searchable)
  const selectedAction = actionOptions.find((action) => action.key === form.action_type)
  const flowNodes = [
    { type: 'trigger', eyebrow: 'Trigger', title: triggerOptions.find((trigger) => trigger.key === form.trigger_event)?.label || labelize(form.trigger_event), detail: moduleLabel(form.module) },
    ...(form.condition_field
      ? [{ type: 'condition', eyebrow: 'Condition', title: `${labelize(form.condition_field)} ${labelize(form.condition_operator)} ${form.condition_value || ''}`.trim(), detail: labelize(form.condition_mode) }]
      : []),
    ...(form.approval_mode !== 'none' ? [{ type: 'approval', eyebrow: 'Approval', title: labelize(form.approval_mode), detail: 'Originator -> Manager -> Finance' }] : []),
    { type: 'action', eyebrow: 'Action', title: selectedAction?.label || labelize(form.action_type), detail: form.action_message || 'Configured action' },
    { type: 'log', eyebrow: 'Audit', title: 'Execution Log', detail: 'Versioned and traceable' },
  ]

  useEffect(() => {
    setSettingsForm(notificationSettingsForm(notificationSettings))
  }, [notificationSettings])

  function normalizedRuleConditions(rule) {
    if (Array.isArray(rule.conditions)) return rule.conditions
    if (rule.conditions?.field) return [rule.conditions]

    return []
  }

  function normalizedRuleActions(rule) {
    if (Array.isArray(rule.actions)) return rule.actions
    if (rule.actions?.type) return [rule.actions]

    return []
  }

  function saveAutomationRule(event) {
    if (!editingRuleId) {
      createAutomationRule(event)
      return
    }

    event.preventDefault()
    runAction(() => api.updateAutomationRule(editingRuleId, automationPayloadFromForm(form)), 'Automation workflow updated.').then(cancelAutomationRuleEdit)
  }

  function editAutomationRule(rule) {
    const condition = normalizedRuleConditions(rule)[0] || {}
    const action = normalizedRuleActions(rule)[0] || {}
    setEditingRuleId(rule.id)
    setActiveTab('workflows')
    Object.entries({
      name: rule.name || '',
      description: rule.description || '',
      module: rule.module || emptyPhaseFourForms.automation.module,
      rule_type: rule.rule_type || emptyPhaseFourForms.automation.rule_type,
      trigger_event: rule.trigger_event || emptyPhaseFourForms.automation.trigger_event,
      condition_field: condition.field || '',
      condition_operator: condition.operator || emptyPhaseFourForms.automation.condition_operator,
      condition_value: condition.operator === 'between' ? `${condition.min || ''},${condition.max || ''}` : condition.value ?? '',
      condition_mode: rule.settings?.condition_mode || emptyPhaseFourForms.automation.condition_mode,
      action_type: action.type || emptyPhaseFourForms.automation.action_type,
      action_message: action.message || action.recommendation || emptyPhaseFourForms.automation.action_message,
      schedule_frequency: rule.schedule_config?.frequency || emptyPhaseFourForms.automation.schedule_frequency,
      approval_mode: rule.approval_config?.mode || emptyPhaseFourForms.automation.approval_mode,
      severity: rule.severity || emptyPhaseFourForms.automation.severity,
      is_active: rule.is_active ? 'true' : 'false',
    }).forEach(([name, value]) => {
      setPhaseFourForm('automation')({ target: { name, value } })
    })
  }

  function cancelAutomationRuleEdit() {
    setEditingRuleId(null)
    Object.entries(emptyPhaseFourForms.automation).forEach(([name, value]) => {
      setPhaseFourForm('automation')({ target: { name, value } })
    })
  }

  function archiveAutomationRule(rule) {
    if (!window.confirm(`Archive automation workflow ${rule.name}?`)) return

    runAction(() => api.deleteAutomationRule(rule.id), 'Automation workflow archived.').then(() => {
      if (editingRuleId === rule.id) cancelAutomationRuleEdit()
    })
  }

  function previousVersion(rule) {
    return (rule.versions || [])
      .filter((version) => Number(version.version) < Number(rule.version || 1))
      .sort((a, b) => Number(b.version) - Number(a.version))[0]
  }

  function toggleRule(rule) {
    runAction(
      () => api.updateAutomationRule(rule.id, { is_active: !rule.is_active, status: rule.is_active ? 'paused' : 'active' }),
      rule.is_active ? 'Automation workflow paused.' : 'Automation workflow activated.',
    )
  }

  function setNotificationSetting(event) {
    const { name, value } = event.target
    setSettingsForm((current) => ({ ...current, [name]: value }))
  }

  function toggleNotificationChannel(channel) {
    setSettingsForm((current) => {
      const channels = current.default_channels.includes(channel)
        ? current.default_channels.filter((item) => item !== channel)
        : [...current.default_channels, channel]

      return { ...current, default_channels: channels }
    })
  }

  function saveNotificationSettings(event) {
    event.preventDefault()

    runAction(
      () =>
        api.updateNotificationSettings({
          in_app_enabled: settingsForm.in_app_enabled === 'true',
          email_enabled: settingsForm.email_enabled === 'true',
          email_from_name: settingsForm.email_from_name || null,
          email_from_address: settingsForm.email_from_address || null,
          reply_to_email: settingsForm.reply_to_email || null,
          minimum_email_severity: settingsForm.minimum_email_severity,
          digest_frequency: settingsForm.digest_frequency,
          default_channels: settingsForm.default_channels,
          retry_policy: {
            max_retries: Number(settingsForm.max_retries || 0),
            on_failure: settingsForm.on_failure || 'notify_admin',
          },
        }),
      'Notification settings updated.',
    )
  }

  function renderDashboard() {
    return (
      <>
        <div className="kpi-grid">
          <Kpi icon={Workflow} label="Active workflows" value={summary.active_rules || 0} sub="Enabled automations" />
          <Kpi icon={AlertTriangle} label="Failed workflows" value={summary.failed_workflows || 0} sub="Needs attention" />
          <Kpi icon={RefreshCcw} label="Running workflows" value={summary.running_workflows || 0} sub="Queued or in progress" />
          <Kpi icon={CheckCircle2} label="Completed today" value={summary.completed_today || 0} sub="Successful executions" />
          <Kpi icon={CalendarDays} label="Scheduled jobs" value={summary.scheduled_jobs || 0} sub="Time-based workflows" />
          <Kpi icon={ShieldCheck} label="Approvals" value={summary.approval_workflows || 0} sub="Approval workflows" />
          <Kpi icon={Clock3} label="Avg. execution" value={`${summary.average_execution_time_ms || 0} ms`} sub="Recent runs" />
          <Kpi icon={Send} label="Unread alerts" value={summary.unread_notifications || 0} sub={`${summary.email_failures || 0} email failures`} />
        </div>

        <div className="grid-main">
          <ChartPanel icon={BarChart3} title="Workflow Executions">
            <AnalyticsBarChart data={analytics.workflow_executions || []} xKey="date" bars={[{ key: 'executions', color: '#2364d8' }]} />
          </ChartPanel>
          <ChartPanel icon={Workflow} title="Top Used Workflows">
            <AnalyticsBarChart data={analytics.top_used_workflows || []} xKey="name" bars={[{ key: 'runs', color: '#188a5a' }]} />
          </ChartPanel>
        </div>
      </>
    )
  }

  function renderWorkflowBuilder() {
    return (
      <section className="panel">
        <PanelTitle icon={editingRuleId ? CheckCircle2 : Plus} title={editingRuleId ? 'Edit Workflow' : 'Workflow Builder'} />
        <div className="workflow-builder-grid">
          <form className="form-grid automation-form" onSubmit={saveAutomationRule}>
            <Field label="Workflow name" name="name" value={form.name} onChange={setPhaseFourForm('automation')} required />
            <Select label="Module" name="module" value={form.module} onChange={setPhaseFourForm('automation')}>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {moduleLabel(module)}
                </option>
              ))}
            </Select>
            <Select label="Rule type" name="rule_type" value={form.rule_type} onChange={setPhaseFourForm('automation')}>
              {['event_workflow', 'manual', 'project_overrun', 'overdue_invoice', 'low_stock', 'hse_open', 'permit_expiry'].map((type) => (
                <option key={type} value={type}>
                  {labelize(type)}
                </option>
              ))}
            </Select>
            <Select label="Trigger" name="trigger_event" value={form.trigger_event} onChange={setPhaseFourForm('automation')}>
              {triggerOptions.map((trigger) => (
                <option key={trigger.key} value={trigger.key}>
                  {trigger.label}
                </option>
              ))}
            </Select>
            <TextArea label="Description" name="description" value={form.description} onChange={setPhaseFourForm('automation')} className="span-2" rows={3} />
            <Select label="Condition field" name="condition_field" value={form.condition_field} onChange={setPhaseFourForm('automation')}>
              <option value="">No condition</option>
              {fieldOptions.map((field) => (
                <option key={field} value={field}>
                  {labelize(field)}
                </option>
              ))}
            </Select>
            <Select label="Operator" name="condition_operator" value={form.condition_operator} onChange={setPhaseFourForm('automation')}>
              {operatorOptions.map((operator) => (
                <option key={operator} value={operator}>
                  {labelize(operator)}
                </option>
              ))}
            </Select>
            <Field label="Value" name="condition_value" value={form.condition_value} onChange={setPhaseFourForm('automation')} placeholder="20000 or low,high" />
            <Select label="Mode" name="condition_mode" value={form.condition_mode} onChange={setPhaseFourForm('automation')}>
              {(catalog.condition_modes || ['all', 'any']).map((mode) => (
                <option key={mode} value={mode}>
                  {labelize(mode)}
                </option>
              ))}
            </Select>
            <Select label="Action" name="action_type" value={form.action_type} onChange={setPhaseFourForm('automation')}>
              {actionOptions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </Select>
            <Field label="Action message" name="action_message" value={form.action_message} onChange={setPhaseFourForm('automation')} className="span-2" />
            <Select label="Schedule" name="schedule_frequency" value={form.schedule_frequency} onChange={setPhaseFourForm('automation')}>
              {scheduleOptions.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {labelize(schedule)}
                </option>
              ))}
            </Select>
            <Select label="Approval" name="approval_mode" value={form.approval_mode} onChange={setPhaseFourForm('automation')}>
              {approvalOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {labelize(mode)}
                </option>
              ))}
            </Select>
            <Select label="Severity" name="severity" value={form.severity} onChange={setPhaseFourForm('automation')}>
              {['low', 'medium', 'high', 'critical'].map((severity) => (
                <option key={severity} value={severity}>
                  {labelize(severity)}
                </option>
              ))}
            </Select>
            <Select label="Active" name="is_active" value={form.is_active} onChange={setPhaseFourForm('automation')}>
              <option value="true">Active</option>
              <option value="false">Paused</option>
            </Select>
            <div className="row-actions automation-submit">
              <button type="submit" className="primary-action">
                {editingRuleId ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {editingRuleId ? 'Save workflow' : 'Create workflow'}
              </button>
              {editingRuleId && (
                <button type="button" className="table-action" onClick={cancelAutomationRuleEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="workflow-canvas">
            {flowNodes.map((node, index) => (
              <div key={`${node.type}-${index}`} className="workflow-canvas-item">
                <div className={`workflow-node ${node.type}`}>
                  <span>{node.eyebrow}</span>
                  <strong>{node.title}</strong>
                  <small>{node.detail}</small>
                </div>
                {index < flowNodes.length - 1 && <div className="workflow-arrow">↓</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function renderWorkflows() {
    return (
      <>
        {renderWorkflowBuilder()}
        <section className="panel">
          <div className="section-heading">
            <PanelTitle icon={Workflow} title="Workflows" />
            <DownloadButton
              filename="automation-workflows.csv"
              columns={['Name', 'Module', 'Trigger', 'Version', 'Status', 'Active', 'Runs']}
              rows={filteredRules.map((rule) => [rule.name, moduleLabel(rule.module), rule.trigger_event, rule.version, rule.status, rule.is_active ? 'Yes' : 'No', rule.runs_count || 0])}
            />
          </div>
          <DataTable
            columns={['Name', 'Module', 'Trigger', 'Version', 'Status', 'Active', 'Runs', 'Last run', 'Actions']}
            rows={filteredRules.map((rule) => {
              const rollback = previousVersion(rule)

              return [
                rule.name,
                moduleLabel(rule.module),
                labelize(rule.trigger_event),
                `v${rule.version || 1}`,
                <Badge key="status" value={rule.status || 'active'} />,
                rule.is_active ? 'Yes' : 'No',
                rule.runs_count || 0,
                shortDate(rule.last_run_at),
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => editAutomationRule(rule)}>
                    Edit
                  </button>
                  {rule.is_active && (
                    <button type="button" className="table-action" onClick={() => runAction(() => api.runAutomationRule(rule.id), 'Automation workflow ran.')}>
                      Run
                    </button>
                  )}
                  <button type="button" className="table-action" onClick={() => toggleRule(rule)}>
                    {rule.is_active ? 'Pause' : 'Activate'}
                  </button>
                  {rollback && (
                    <button type="button" className="table-action" onClick={() => runAction(() => api.rollbackAutomationVersion(rule.id, rollback.version), `Workflow rolled back to v${rollback.version}.`)}>
                      Rollback
                    </button>
                  )}
                  <button type="button" className="table-action danger" onClick={() => archiveAutomationRule(rule)}>
                    Archive
                  </button>
                </div>,
              ]
            })}
          />
        </section>
      </>
    )
  }

  function renderTemplates() {
    return (
      <section className="panel">
        <PanelTitle icon={FileText} title="Workflow Templates" />
        <DataTable
          columns={['Template', 'Module', 'Category', 'Trigger', 'Approval', 'Actions']}
          rows={filteredTemplates.map((template) => [
            <div key="template" className="table-primary">
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </div>,
            moduleLabel(template.module),
            labelize(template.category),
            labelize(template.trigger_event),
            labelize(template.approval_config?.mode || 'none'),
            <button key="use" type="button" className="table-action" onClick={() => runAction(() => api.instantiateAutomationTemplate(template.key || template.id, { name: template.name }), 'Template added as draft workflow.')}>
              Use template
            </button>,
          ])}
        />
      </section>
    )
  }

  function renderCatalog(items, title, icon, columns, rows) {
    return (
      <section className="panel">
        <PanelTitle icon={icon} title={title} />
        <DataTable columns={columns} rows={rows(items)} />
      </section>
    )
  }

  function renderApprovals() {
    return (
      <section className="panel">
        <PanelTitle icon={CheckCircle2} title="Approval Workflows" />
        <DataTable
          columns={['Workflow', 'Mode', 'Steps', 'Status', 'Version']}
          rows={filteredRules
            .filter((rule) => rule.approval_config?.mode && rule.approval_config.mode !== 'none')
            .map((rule) => [rule.name, labelize(rule.approval_config.mode), (rule.approval_config.steps || []).join(' -> ') || 'Configured by role', <Badge key="status" value={rule.status || 'active'} />, `v${rule.version || 1}`])}
        />
      </section>
    )
  }

  function renderLogs() {
    return (
      <section className="panel">
        <div className="section-heading">
          <PanelTitle icon={Clock3} title="Automation Logs" />
          <DownloadButton
            filename="automation-logs.csv"
            columns={['Run', 'Workflow', 'Status', 'Trigger', 'Matched', 'Actions', 'Duration', 'Retry', 'Started', 'Error']}
            rows={filteredRuns.map((run) => [run.run_number, run.rule?.name || '', run.status, run.trigger_event, run.matched_count, run.actions_executed, run.duration_ms, run.retry_count, run.started_at, run.error_message || ''])}
          />
        </div>
        <DataTable
          columns={['No.', 'Workflow', 'Status', 'Trigger', 'Matched', 'Actions', 'Duration', 'Retry', 'Started', 'Error']}
          rows={filteredRuns.map((run) => [
            run.run_number,
            run.rule?.name || '',
            <Badge key="status" value={run.status} />,
            labelize(run.trigger_event),
            run.matched_count,
            run.actions_executed,
            `${run.duration_ms || 0} ms`,
            run.retry_count || 0,
            shortDate(run.started_at),
            run.error_message || '',
          ])}
        />
      </section>
    )
  }

  function renderAnalytics() {
    return (
      <div className="grid-main">
        <ChartPanel icon={AlertTriangle} title="Failures">
          <AnalyticsBarChart data={analytics.failures || []} xKey="name" bars={[{ key: 'failures', color: '#c3382f' }]} />
        </ChartPanel>
        <ChartPanel icon={RefreshCcw} title="Most Triggered Events">
          <AnalyticsBarChart data={analytics.most_triggered_events || []} xKey="event" bars={[{ key: 'workflows', color: '#6d5dfc' }]} />
        </ChartPanel>
        <ChartPanel icon={Send} title="Notifications Sent">
          <AnalyticsBarChart data={analytics.notification_statistics || []} xKey="type" bars={[{ key: 'sent', color: '#188a5a' }]} />
        </ChartPanel>
        <section className="panel">
          <PanelTitle icon={BarChart3} title="Automation Savings" />
          <div className="automation-savings-grid">
            <Metric label="Executions tracked" value={runs.length} />
            <Metric label="Actions completed" value={runs.reduce((sum, run) => sum + Number(run.actions_executed || 0), 0)} />
            <Metric label="Failure rate" value={`${runs.length ? Math.round((runs.filter((run) => run.status === 'failed').length / runs.length) * 100) : 0}%`} />
            <Metric label="Versions stored" value={rules.reduce((sum, rule) => sum + Number((rule.versions || []).length), 0)} />
          </div>
        </section>
      </div>
    )
  }

  function renderSettings() {
    return (
      <>
        <section className="panel">
          <PanelTitle icon={Settings} title="Notification Settings" />
          <form className="form-grid automation-settings-form" onSubmit={saveNotificationSettings}>
            <Select label="In-app alerts" name="in_app_enabled" value={settingsForm.in_app_enabled} onChange={setNotificationSetting}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
            <Select label="Email alerts" name="email_enabled" value={settingsForm.email_enabled} onChange={setNotificationSetting}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
            <Select label="Minimum email severity" name="minimum_email_severity" value={settingsForm.minimum_email_severity} onChange={setNotificationSetting}>
              {['low', 'medium', 'high', 'critical'].map((severity) => (
                <option key={severity} value={severity}>
                  {labelize(severity)}
                </option>
              ))}
            </Select>
            <Select label="Delivery frequency" name="digest_frequency" value={settingsForm.digest_frequency} onChange={setNotificationSetting}>
              {['immediate', 'hourly', 'daily', 'weekly'].map((frequency) => (
                <option key={frequency} value={frequency}>
                  {labelize(frequency)}
                </option>
              ))}
            </Select>
            <Field label="From name" name="email_from_name" value={settingsForm.email_from_name} onChange={setNotificationSetting} />
            <Field label="From email" type="email" name="email_from_address" value={settingsForm.email_from_address} onChange={setNotificationSetting} />
            <Field label="Reply-to email" type="email" name="reply_to_email" value={settingsForm.reply_to_email} onChange={setNotificationSetting} />
            <Field label="Max retries" type="number" min="0" max="10" name="max_retries" value={settingsForm.max_retries} onChange={setNotificationSetting} />
            <Field label="Failure action" name="on_failure" value={settingsForm.on_failure} onChange={setNotificationSetting} />
            <div className="access-selector automation-channel-selector">
              <div className="access-selector-head">
                <span>Default Channels</span>
              </div>
              <div className="access-grid compact-access-grid">
                {['in_app', 'email'].map((channel) => (
                  <label key={channel} className="access-option">
                    <input type="checkbox" checked={settingsForm.default_channels.includes(channel)} onChange={() => toggleNotificationChannel(channel)} />
                    <span>
                      <strong>{labelize(channel)}</strong>
                      <small>{channel === 'email' ? 'Uses the configured Laravel mailer.' : 'Creates a saved Navkwa Build alert.'}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="primary-action automation-settings-submit">
              <CheckCircle2 size={17} />
              Save settings
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Send} title="Notification Events" />
          <DataTable
            columns={['No.', 'Title', 'Module', 'Severity', 'Status', 'Channels', 'Delivery', 'Created', 'Actions']}
            rows={notifications.map((notification) => [
              notification.notification_number,
              <div key="title" className="table-primary">
                <strong>{notification.title}</strong>
                <small>{notification.message}</small>
              </div>,
              moduleLabel(notification.module),
              <Badge key="severity" value={notification.severity} />,
              <Badge key="status" value={notification.status} />,
              (notification.channels || []).map(labelize).join(', '),
              Object.entries(notification.delivery_status || {}).map(([channel, status]) => `${labelize(channel)}: ${labelize(status)}`).join(', '),
              shortDate(notification.created_at),
              <div key="actions" className="row-actions">
                {notification.status === 'unread' && (
                  <button type="button" className="table-action" onClick={() => runAction(() => api.markNotificationRead(notification.id), 'Notification marked read.')}>
                    Read
                  </button>
                )}
                {!['acknowledged'].includes(notification.status) && (
                  <button type="button" className="table-action" onClick={() => runAction(() => api.acknowledgeNotification(notification.id), 'Notification acknowledged.')}>
                    Acknowledge
                  </button>
                )}
              </div>,
            ])}
          />
        </section>
      </>
    )
  }

  return (
    <section className="view-stack automation-engine">
      <div className="automation-toolbar">
        <Field label="Search automation" name="automation_search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Workflow, trigger, action, template, module" />
        <button type="button" className="primary-action compact-action" onClick={() => runAction(() => api.runActiveAutomation(), 'Active automation workflows ran.')}>
          <RefreshCcw size={17} />
          Run active workflows
        </button>
      </div>

      <nav className="module-tabs" aria-label="Automation module navigation">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'workflows' && renderWorkflows()}
      {activeTab === 'templates' && renderTemplates()}
      {activeTab === 'triggers' && renderCatalog(triggerOptions.filter(searchable), 'Triggers', RefreshCcw, ['Trigger', 'Module'], (items) => items.map((trigger) => [trigger.label || labelize(trigger.key), moduleLabel(trigger.module)]))}
      {activeTab === 'conditions' && renderCatalog(fieldOptions.filter(searchable), 'Conditions', ShieldCheck, ['Field', 'Supported operators'], (items) => items.map((field) => [labelize(field), operatorOptions.map(labelize).join(', ')]))}
      {activeTab === 'actions' && renderCatalog(actionOptions.filter(searchable), 'Actions', Send, ['Action', 'Category'], (items) => items.map((action) => [action.label || labelize(action.key), labelize(action.category)]))}
      {activeTab === 'schedules' && renderCatalog(scheduleOptions.filter(searchable), 'Schedules', CalendarDays, ['Schedule', 'Mode'], (items) => items.map((schedule) => [labelize(schedule), schedule === 'event_driven' ? 'System event' : 'Time based']))}
      {activeTab === 'approvals' && renderApprovals()}
      {activeTab === 'logs' && renderLogs()}
      {activeTab === 'analytics' && renderAnalytics()}
      {activeTab === 'settings' && renderSettings()}
    </section>
  )
}

function AdminView({
  organization,
  branches,
  clients,
  suppliers,
  users,
  currentUser,
  approvals = emptyAdminApprovalData,
  accountSecurity = emptyAccountSecurity,
  mfaSetup,
  forms,
  securityForms,
  setForms,
  setAdminFormValue,
  setSecurityForm,
  archiveCompany,
  startMfaSetup,
  changePassword,
  enableMfa,
  disableMfa,
  regenerateMfaRecoveryCodes,
  runAction,
}) {
  const company = organization?.company
  const canAdminister = canAdministerRecords(currentUser)
  const isEditingClient = Boolean(forms.client.id)
  const isEditingSupplier = Boolean(forms.supplier.id)
  const isEditingUser = Boolean(forms.user.id)
  const clientReset = { id: '', name: '', contact_name: '', email: '', phone: '', status: 'active' }
  const supplierReset = { id: '', name: '', contact_name: '', email: '', phone: '', rating: 4, lead_time_days: 7, status: 'active' }
  const userReset = { id: '', name: '', email: '', password: '', branch_id: branches[0]?.id || '', role_id: '', role_name: '', permissions: [], status: 'active' }
  const userPermissions = normalizePermissionList(forms.user.permissions)
  const companySettings = forms.company.settings || company?.settings || {}
  const approvalItems = approvals?.items || []
  const approvalSummary = approvals?.summary || {}

  function reviewApproval(item, decision) {
    if (decision === 'rejected' && !window.confirm(`Deny ${item.reference}? This will update the source record.`)) {
      return
    }

    runAction(
      () =>
        api.reviewAdminApproval(item.type, item.record_id, {
          decision,
          notes: decision === 'approved' ? 'Approved from Admin approval inbox.' : 'Denied from Admin approval inbox.',
        }),
      decision === 'approved' ? 'Approval recorded.' : 'Request denied.',
    )
  }

  function saveCompany(event) {
    event.preventDefault()

    const { appearance_theme, settings = companySettings, ...companyFields } = forms.company
    const payload = {
      ...companyFields,
      settings: {
        ...settings,
        appearance: {
          ...(settings.appearance || {}),
          theme: normalizeTheme(appearance_theme || settings.appearance?.theme),
        },
      },
    }

    runAction(() => api.updateCompany(payload), 'Company updated.')
  }

  function afterSubmit(section, reset) {
    setForms((current) => ({
      ...current,
      [section]: reset,
    }))
  }

  function editUser(item) {
    setForms((current) => ({
      ...current,
      user: {
        id: item.id,
        name: item.name || '',
        email: item.email || '',
        password: '',
        branch_id: item.branch_id || item.branch?.id || branches[0]?.id || '',
        role_id: item.role_id || item.role?.id || '',
        role_name: item.role?.name || '',
        permissions: explicitUserPermissions(item),
        status: item.status || 'active',
      },
    }))
  }

  function setUserFormField(field) {
    return (event) => {
      setForms((current) => ({
        ...current,
        user: { ...current.user, [field]: event.target.value },
      }))
    }
  }

  function toggleAccessCategory(category) {
    setForms((current) => {
      const currentPermissions = normalizePermissionList(current.user.permissions)
      const expandedPermissions = currentPermissions.includes('*') ? allAccessPermissions : currentPermissions
      const hasCategory = category.permissions.every((permission) => expandedPermissions.includes(permission))
      const permissions = hasCategory
        ? expandedPermissions.filter((permission) => !category.permissions.includes(permission))
        : [...new Set([...expandedPermissions, ...category.permissions])]

      return {
        ...current,
        user: {
          ...current.user,
          permissions,
        },
      }
    })
  }

  function setAllUserAccess() {
    setForms((current) => ({
      ...current,
      user: {
        ...current.user,
        permissions: allAccessPermissions,
      },
    }))
  }

  function clearUserAccess() {
    setForms((current) => ({
      ...current,
      user: {
        ...current.user,
        permissions: [],
      },
    }))
  }

  function editClient(item) {
    setForms((current) => ({
      ...current,
      client: {
        id: item.id,
        name: item.name || '',
        contact_name: item.contact_name || '',
        email: item.email || '',
        phone: item.phone || '',
        status: item.status || 'active',
      },
    }))
  }

  function saveClient(event) {
    event.preventDefault()

    const payload = {
      name: forms.client.name,
      contact_name: forms.client.contact_name,
      email: forms.client.email,
      phone: forms.client.phone,
      status: forms.client.status || 'active',
    }

    const request = isEditingClient
      ? () => api.updateClient(forms.client.id, payload)
      : () => api.createClient(payload)

    runAction(request, isEditingClient ? 'Client updated.' : 'Client created.').then(() => afterSubmit('client', clientReset))
  }

  function deleteClient(item) {
    if (!window.confirm(`Archive ${item.name}? This removes the client from active registers.`)) {
      return
    }

    runAction(() => api.deleteClient(item.id), 'Client archived.').then(() => {
      if (forms.client.id === item.id) {
        afterSubmit('client', clientReset)
      }
    })
  }

  function editSupplier(item) {
    setForms((current) => ({
      ...current,
      supplier: {
        id: item.id,
        name: item.name || '',
        contact_name: item.contact_name || '',
        email: item.email || '',
        phone: item.phone || '',
        rating: item.rating || 4,
        lead_time_days: item.lead_time_days || 7,
        status: item.status || 'active',
      },
    }))
  }

  function saveSupplier(event) {
    event.preventDefault()

    const payload = {
      name: forms.supplier.name,
      contact_name: forms.supplier.contact_name,
      email: forms.supplier.email,
      phone: forms.supplier.phone,
      rating: Number(forms.supplier.rating || 3),
      lead_time_days: Number(forms.supplier.lead_time_days || 7),
      status: forms.supplier.status || 'active',
    }

    const request = isEditingSupplier
      ? () => api.updateSupplier(forms.supplier.id, payload)
      : () => api.createSupplier(payload)

    runAction(request, isEditingSupplier ? 'Supplier updated.' : 'Supplier created.').then(() => afterSubmit('supplier', supplierReset))
  }

  function deleteSupplier(item) {
    if (!window.confirm(`Archive ${item.name}? This removes the supplier from active registers.`)) {
      return
    }

    runAction(() => api.deleteSupplier(item.id), 'Supplier archived.').then(() => {
      if (forms.supplier.id === item.id) {
        afterSubmit('supplier', supplierReset)
      }
    })
  }

  function saveUser(event) {
    event.preventDefault()

    const payload = {
      name: forms.user.name,
      email: forms.user.email,
      branch_id: Number(forms.user.branch_id),
      role_name: (forms.user.role_name || '').trim(),
      permissions: userPermissions,
      status: forms.user.status || 'active',
    }

    if (forms.user.password) {
      payload.password = forms.user.password
    }

    const request = isEditingUser
      ? () => api.updateUser(forms.user.id, payload)
      : () => api.createUser(payload)

    runAction(request, isEditingUser ? 'User updated.' : 'User invited.').then(() => afterSubmit('user', userReset))
  }

  function deleteUser(item) {
    if (!window.confirm(`Delete ${item.name}? This removes their Navkwa Build access.`)) {
      return
    }

    runAction(() => api.deleteUser(item.id), 'User deleted.').then(() => {
      if (forms.user.id === item.id) {
        afterSubmit('user', userReset)
      }
    })
  }

  function deleteCompany() {
    if (!window.confirm(`Archive ${company?.name}? This will sign you out and remove the company from active workspaces.`)) {
      return
    }

    archiveCompany()
  }

  return (
    <section className="view-stack">
      {canAdminister && (
        <section className="panel admin-approval-panel">
          <PanelTitle icon={CheckCircle2} title="Approval Inbox" />
          <div className="approval-inbox-meta">
            <span><strong>{approvalSummary.total_pending || 0}</strong> Pending decisions</span>
            <span><strong>{money(approvalSummary.total_value || 0)}</strong> Pending value</span>
            <span><strong>{approvalSummary.oldest_days || 0}</strong> Oldest days</span>
          </div>
          <DataTable
            columns={['Reference', 'Module', 'Request', 'Submitted By', 'Project / Context', 'Value', 'Status', 'Submitted', 'Actions']}
            rows={approvalItems.map((item) => [
              item.reference,
              item.module,
              item.title,
              item.requester || '',
              [item.project, item.context].filter(Boolean).join(' / '),
              item.amount ? money(item.amount) : '',
              <Badge key="status" value={item.status || 'pending'} />,
              shortDate(item.submitted_at),
              <div key="actions" className="row-actions">
                <button type="button" className="table-action" onClick={() => reviewApproval(item, 'approved')}>
                  <CheckCircle2 size={14} />
                  {item.approve_label || 'Approve'}
                </button>
                <button type="button" className="table-action danger" onClick={() => reviewApproval(item, 'rejected')}>
                  {item.deny_label || 'Deny'}
                </button>
              </div>,
            ])}
          />
        </section>
      )}

      <AccountSecurityPanel
        currentUser={currentUser}
        accountSecurity={accountSecurity}
        mfaSetup={mfaSetup}
        securityForms={securityForms}
        setSecurityForm={setSecurityForm}
        changePassword={changePassword}
        startMfaSetup={startMfaSetup}
        enableMfa={enableMfa}
        disableMfa={disableMfa}
        regenerateMfaRecoveryCodes={regenerateMfaRecoveryCodes}
      />

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Building2} title="Company" />
          <form
            className="form-grid two"
            onSubmit={saveCompany}
          >
            <Field label="Name" name="name" value={forms.company.name || company?.name || ''} onChange={setAdminFormValue('company')} required disabled={!canAdminister} />
            <Field label="Registration" name="registration_number" value={forms.company.registration_number || ''} onChange={setAdminFormValue('company')} disabled={!canAdminister} />
            <Field label="Tax ID" name="tax_id" value={forms.company.tax_id || ''} onChange={setAdminFormValue('company')} disabled={!canAdminister} />
            <Field label="Currency" name="default_currency" value={forms.company.default_currency || 'GHS'} onChange={setAdminFormValue('company')} disabled={!canAdminister} />
            <Field label="Country" name="country" value={forms.company.country || 'GH'} onChange={setAdminFormValue('company')} disabled={!canAdminister} />
            <Field label="Timezone" name="base_timezone" value={forms.company.base_timezone || 'Africa/Accra'} onChange={setAdminFormValue('company')} disabled={!canAdminister} />
            {canAdminister && (
              <div className="row-actions span-2">
                <button type="submit" className="primary-action">
                  <CheckCircle2 size={17} />
                  Save company
                </button>
                <button type="button" className="table-action danger" onClick={deleteCompany}>
                  Archive company
                </button>
              </div>
            )}
          </form>
        </section>

        <section className="panel">
          <PanelTitle icon={Building2} title="Branches" />
          <form
            className="form-grid two"
            onSubmit={(event) => {
              event.preventDefault()
              runAction(() => api.createBranch(forms.branch), 'Branch created.').then(() =>
                afterSubmit('branch', { code: '', name: '', city: '', country: 'GH' }),
              )
            }}
          >
            <Field label="Branch Code" name="code" value={forms.branch.code} onChange={setAdminFormValue('branch')} placeholder="Auto-generated" />
            <Field label="Name" name="name" value={forms.branch.name} onChange={setAdminFormValue('branch')} required />
            <Field label="City" name="city" value={forms.branch.city} onChange={setAdminFormValue('branch')} />
            <Field label="Country" name="country" value={forms.branch.country} onChange={setAdminFormValue('branch')} />
            <button type="submit" className="primary-action span-2">
              <Plus size={17} />
              Add branch
            </button>
          </form>
          <MiniList items={branches.map((branch) => `${branch.code} - ${branch.name}`)} />
        </section>
      </div>

      <div className="grid-main">
        <section className="panel">
          <PanelTitle icon={Users} title="Clients" />
          <form
            className="form-grid two"
            onSubmit={saveClient}
          >
            <Field label="Name" name="name" value={forms.client.name} onChange={setAdminFormValue('client')} required />
            <Field label="Contact" name="contact_name" value={forms.client.contact_name} onChange={setAdminFormValue('client')} />
            <Field label="Email" type="email" name="email" value={forms.client.email} onChange={setAdminFormValue('client')} />
            <Field label="Phone" name="phone" value={forms.client.phone} onChange={setAdminFormValue('client')} />
            {isEditingClient && (
              <Select label="Status" name="status" value={forms.client.status} onChange={setAdminFormValue('client')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {isEditingClient ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {isEditingClient ? 'Save client' : 'Add client'}
              </button>
              {isEditingClient && (
                <button type="button" className="table-action" onClick={() => afterSubmit('client', clientReset)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          <DataTable
            columns={['Client', 'Contact', 'Email', 'Phone', 'Status', 'Actions']}
            rows={clients.map((client) => [
              client.name,
              client.contact_name || '',
              client.email || '',
              client.phone || '',
              <Badge key="status" value={client.status} />,
              canAdminister ? (
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => editClient(client)}>
                    Edit
                  </button>
                  <button type="button" className="table-action danger" onClick={() => deleteClient(client)}>
                    Archive
                  </button>
                </div>
              ) : (
                ''
              ),
            ])}
          />
        </section>

        <section className="panel">
          <PanelTitle icon={Truck} title="Suppliers" />
          <form
            className="form-grid two"
            onSubmit={saveSupplier}
          >
            <Field label="Name" name="name" value={forms.supplier.name} onChange={setAdminFormValue('supplier')} required />
            <Field label="Contact" name="contact_name" value={forms.supplier.contact_name} onChange={setAdminFormValue('supplier')} />
            <Field label="Email" type="email" name="email" value={forms.supplier.email} onChange={setAdminFormValue('supplier')} />
            <Field label="Lead days" type="number" name="lead_time_days" value={forms.supplier.lead_time_days} onChange={setAdminFormValue('supplier')} />
            {isEditingSupplier && (
              <Select label="Status" name="status" value={forms.supplier.status} onChange={setAdminFormValue('supplier')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            <div className="row-actions span-2">
              <button type="submit" className="primary-action">
                {isEditingSupplier ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                {isEditingSupplier ? 'Save supplier' : 'Add supplier'}
              </button>
              {isEditingSupplier && (
                <button type="button" className="table-action" onClick={() => afterSubmit('supplier', supplierReset)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          <DataTable
            columns={['Supplier', 'Contact', 'Email', 'Lead days', 'Status', 'Actions']}
            rows={suppliers.map((supplier) => [
              supplier.name,
              supplier.contact_name || '',
              supplier.email || '',
              supplier.lead_time_days,
              <Badge key="status" value={supplier.status} />,
              canAdminister ? (
                <div key="actions" className="row-actions">
                  <button type="button" className="table-action" onClick={() => editSupplier(supplier)}>
                    Edit
                  </button>
                  <button type="button" className="table-action danger" onClick={() => deleteSupplier(supplier)}>
                    Archive
                  </button>
                </div>
              ) : (
                ''
              ),
            ])}
          />
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={ShieldCheck} title="Users & Roles" />
        <form
          className="form-grid user-form"
          onSubmit={saveUser}
          autoComplete="off"
        >
          <Field label="Name" name="name" value={forms.user.name} onChange={setAdminFormValue('user')} required />
          <Field label="Email" type="email" name="company_user_invite_email" value={forms.user.email} onChange={setUserFormField('email')} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" required />
          <Field label="Password" type="password" name="company_user_temporary_password" value={forms.user.password} onChange={setUserFormField('password')} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellCheck="false" required={!isEditingUser} placeholder={isEditingUser ? 'Leave blank to keep current' : 'Enter a secure temporary password'} />
          <Select label="Branch" name="branch_id" value={forms.user.branch_id} onChange={setAdminFormValue('user')}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Field label="Role" name="role_name" value={forms.user.role_name} onChange={setAdminFormValue('user')} placeholder="Type this company user's role" required />
          <Select label="Status" name="status" value={forms.user.status} onChange={setAdminFormValue('user')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
          <div className="access-selector admin-access-selector">
            <div className="access-selector-head">
              <span>Permitted Categories</span>
              <div className="row-actions">
                <button type="button" className="table-action" onClick={setAllUserAccess}>
                  Grant all
                </button>
                <button type="button" className="table-action" onClick={clearUserAccess}>
                  Clear
                </button>
              </div>
            </div>
            <div className="access-grid">
              {accessCategories.map((category) => (
                <label key={category.id} className="access-option">
                  <input
                    type="checkbox"
                    checked={hasCategoryPermissions(userPermissions, category)}
                    onChange={() => toggleAccessCategory(category)}
                  />
                  <span>
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="row-actions">
            <button type="submit" className="primary-action">
              {isEditingUser ? <CheckCircle2 size={17} /> : <Plus size={17} />}
              {isEditingUser ? 'Save user' : 'Add user'}
            </button>
            {isEditingUser && (
              <button type="button" className="table-action" onClick={() => afterSubmit('user', userReset)}>
                Cancel
              </button>
            )}
          </div>
        </form>
        <DataTable
          columns={['Name', 'Email', 'Role', 'Access', 'Branch', 'Status', 'Actions']}
          rows={users.map((item) => [
            item.name,
            item.email,
            roleLabel(item.role),
            permissionCategorySummary(explicitUserPermissions(item)),
            item.branch?.name,
            <Badge key="status" value={item.status} />,
            <div key="actions" className="row-actions">
              <button type="button" className="table-action" onClick={() => editUser(item)}>
                Edit
              </button>
              <button type="button" className="table-action danger" onClick={() => deleteUser(item)} disabled={item.id === currentUser?.id}>
                Delete
              </button>
            </div>,
          ])}
        />
      </section>
    </section>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input {...props} />
    </label>
  )
}

function Select({ label, className = '', children, ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  )
}

function PickerField({ label, name, value, options = [], onChange, className = '', placeholder = 'Select', searchPlaceholder = 'Search' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)
  const selected = options.find((option) => String(option.value) === String(value))
  const filteredOptions = options.filter((option) => {
    const searchText = `${option.label} ${option.meta || ''}`.toLowerCase()
    return searchText.includes(query.trim().toLowerCase())
  })

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  function choose(nextValue) {
    onChange?.({ target: { name, value: nextValue } })
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapperRef} className={`field picker-field ${open ? 'open' : ''} ${className}`}>
      <span>{label}</span>
      <button type="button" className="picker-trigger" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}>
        <strong>{selected?.label || placeholder}</strong>
        {selected?.meta && <small>{selected.meta}</small>}
        <ChevronRight className="picker-arrow" size={16} />
      </button>

      {open && (
        <div className="picker-popover">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
                setQuery('')
              }
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault()
                choose(filteredOptions[0].value)
              }
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
            autoFocus
          />
          <div className="picker-options" role="listbox">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button key={option.value} type="button" className={String(option.value) === String(value) ? 'selected' : ''} onClick={() => choose(option.value)} role="option" aria-selected={String(option.value) === String(value)}>
                <span>{option.label}</span>
                {option.meta && <small>{option.meta}</small>}
              </button>
            )) : (
              <div className="picker-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TextArea({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  )
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <section className="kpi">
      <div>
        <Icon size={19} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </section>
  )
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <div className="panel-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const intelligenceChartColors = ['#2364d8', '#188a5a', '#b66a05', '#c3382f', '#6d5dfc', '#0f766e', '#7c3aed', '#475569']

function toChartNumber(value) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function shortChartLabel(value) {
  const text = labelize(value)

  return text.length > 16 ? `${text.slice(0, 16)}...` : text
}

function ChartPanel({ icon: Icon = BarChart3, title, children }) {
  return (
    <section className="panel chart-panel">
      <PanelTitle icon={Icon} title={title} />
      {children}
    </section>
  )
}

function EmptyChart() {
  return <div className="analytics-chart-empty">No chart data</div>
}

function AnalyticsBarChart({ data = [], xKey = 'name', bars = [], height = 280, valueFormatter = (value) => compactFormatter.format(toChartNumber(value)) }) {
  const chartData = (data || []).filter(Boolean).slice(0, 12)

  if (chartData.length === 0 || bars.length === 0) {
    return <EmptyChart />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 12, left: 2, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={shortChartLabel} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={valueFormatter} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, name) => [valueFormatter(value), labelize(name)]}
          labelFormatter={labelize}
          contentStyle={{ borderRadius: 8, borderColor: '#d8e0ea' }}
        />
        <Legend formatter={labelize} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {bars.map((bar, index) => (
          <Bar key={bar.key} dataKey={bar.key} fill={bar.color || intelligenceChartColors[index % intelligenceChartColors.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function AnalyticsPieChart({ data = [], nameKey = 'name', valueKey = 'value', height = 280 }) {
  const chartData = (data || []).filter((item) => toChartNumber(item?.[valueKey]) > 0).slice(0, 8)

  if (chartData.length === 0) {
    return <EmptyChart />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={chartData} dataKey={valueKey} nameKey={nameKey} innerRadius={62} outerRadius={102} paddingAngle={3}>
          {chartData.map((entry, index) => {
            const healthKeys = ['green', 'amber', 'red', 'grey']
            const fill = entry.color || (healthKeys.includes(entry.key) ? healthColor(entry.key) : intelligenceChartColors[index % intelligenceChartColors.length])

            return <Cell key={`${entry[nameKey]}-${index}`} fill={fill} />
          })}
        </Pie>
        <Tooltip formatter={(value, name) => [compactFormatter.format(toChartNumber(value)), labelize(name)]} />
        <Legend formatter={labelize} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function RankPanel({ title, rows, valueKey, valueSuffix = '' }) {
  return (
    <section className="panel">
      <PanelTitle icon={BarChart3} title={title} />
      <DataTable
        columns={['Project', 'Health', 'Value']}
        rows={(rows || []).slice(0, 8).map((row) => [
          row.project,
          <Badge key="health" value={row.health} />,
          `${formatMetricValue(valueKey, row[valueKey])}${valueSuffix && !String(formatMetricValue(valueKey, row[valueKey])).endsWith(valueSuffix) ? valueSuffix : ''}`,
        ])}
      />
    </section>
  )
}

function DownloadButton({ filename, columns, rows, label = 'Download' }) {
  return (
    <button type="button" className="table-action" onClick={() => downloadCsv(filename, columns, rows)}>
      <Download size={14} />
      {label}
    </button>
  )
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-cell">
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={`${index}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ value }) {
  const key = String(value || 'neutral')
  return <span className={`badge ${statusColor[key] || 'neutral'}`}>{labelize(key)}</span>
}

function MiniList({ items }) {
  return (
    <ul className="mini-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function setForm(setter) {
  return (event) => {
    const { name, value } = event.target
    setter((current) => ({ ...current, [name]: value }))
  }
}

function money(value) {
  return currencyFormatter.format(Number(value || 0))
}

function requestStatusLabel(request = {}) {
  return request.approval_status_label || labelize(request.status || '')
}

function procurementRequesterName(request = {}) {
  return request.requested_by_name || request.requested_by?.name || request.requestedBy?.name || ''
}

function approvalProgressLabel(request = {}) {
  return request.approval_progress?.label || `${(request.approval_workflow || []).filter((step) => step.status === 'approved').length}/${(request.approval_workflow || []).length || 0}`
}

function workflowStatusSymbol(status) {
  return {
    approved: '✓',
    pending: '...',
    rejected: 'x',
    waiting: '-',
  }[status] || '-'
}

function timelineTime(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ratingStars(value) {
  const rating = Math.max(0, Math.min(5, Math.round(Number(value || 0))))
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
}

function emptyMaterialLine() {
  return {
    item_name: '',
    description: '',
    cost_code: '',
    quantity: 1,
    unit: 'each',
    estimated_unit_cost: '',
    tax_rate: 0,
    discount_amount: 0,
  }
}

function emptyQuoteLine() {
  return {
    item_name: '',
    description: '',
    cost_code: '',
    quantity: 1,
    unit: 'each',
    unit_price: '',
    tax_rate: 0,
    discount_amount: 0,
  }
}

function lineTotal(line, costKey) {
  const subtotal = Number(line.quantity || 0) * Number(line[costKey] || 0)
  const tax = subtotal * (Number(line.tax_rate || 0) / 100)
  const discount = Number(line.discount_amount || 0)

  return Math.max(0, subtotal + tax - discount)
}

function procurementTotals(lines = [], headerDiscount = 0) {
  const subtotal = lines.reduce((total, line) => {
    const unitCost = Number(line.estimated_unit_cost ?? line.unit_price ?? 0)
    return total + Number(line.quantity || 0) * unitCost
  }, 0)
  const tax = lines.reduce((total, line) => {
    const unitCost = Number(line.estimated_unit_cost ?? line.unit_price ?? 0)
    return total + (Number(line.quantity || 0) * unitCost * Number(line.tax_rate || 0)) / 100
  }, 0)
  const lineDiscount = lines.reduce((total, line) => total + Number(line.discount_amount || 0), 0)
  const discount = lineDiscount + Number(headerDiscount || 0)

  return {
    subtotal,
    tax,
    discount,
    grandTotal: Math.max(0, subtotal + tax - discount),
  }
}

function labelize(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function countryName(code = '') {
  return africanCountryNames[code] || code
}

function currencyName(code = '') {
  return africanCurrencyNames[code] || code
}

function moduleLabel(value = '') {
  const module = String(value).toLowerCase()
  if (['staff', 'people', 'hr'].includes(module)) return 'HR & Workforce'
  if (module === 'field') return 'Site Management'
  return labelize(value)
}

function roleLabel(role) {
  if (!role) return ''
  return role.slug === 'owner' ? 'CEO' : role.name
}

function normalizePermissionList(permissions = []) {
  if (!Array.isArray(permissions)) {
    return []
  }

  return [...new Set(permissions.map((permission) => String(permission).trim()).filter(Boolean))]
}

function rolePermissions(role) {
  return normalizePermissionList(role?.permissions)
}

function effectiveUserPermissions(user) {
  return normalizePermissionList(user?.effective_permissions || user?.permissions || user?.role?.permissions)
}

function explicitUserPermissions(user) {
  if (Array.isArray(user?.permissions)) {
    return normalizePermissionList(user.permissions)
  }

  return effectiveUserPermissions(user)
}

function hasPermissionFromList(permissions, requiredPermissions = []) {
  const normalized = normalizePermissionList(permissions)

  if (requiredPermissions.length === 0) {
    return true
  }

  return requiredPermissions.some((permission) => {
    if (permission.startsWith('platform.')) {
      return normalized.includes('platform.*') || normalized.includes(permission)
    }

    return normalized.includes('*') || normalized.includes(permission)
  })
}

function hasAnyPermission(user, requiredPermissions = []) {
  return hasPermissionFromList(effectiveUserPermissions(user), requiredPermissions)
}

function accessibleNavItems(user, options = {}) {
  if (!user) {
    return []
  }

  return navItems
    .filter((item) => options.cloudConsole ? ['platform', 'account'].includes(item.id) : item.id !== 'platform')
    .filter((item) => hasAnyPermission(user, item.permissions))
}

function hasCategoryPermissions(permissions, category) {
  const normalized = normalizePermissionList(permissions)

  return normalized.includes('*') || category.permissions.every((permission) => normalized.includes(permission))
}

function permissionCategorySummary(permissions) {
  const normalized = normalizePermissionList(permissions)

  if (normalized.includes('*')) {
    return 'All access'
  }

  const categories = accessCategories
    .filter((category) => hasCategoryPermissions(normalized, category))
    .map((category) => category.label)

  if (categories.length === 0) {
    return 'No module access'
  }

  if (categories.length <= 3) {
    return categories.join(', ')
  }

  return `${categories.slice(0, 3).join(', ')} +${categories.length - 3} more`
}

function canAdministerRecords(user) {
  const permissions = effectiveUserPermissions(user)
  return permissions.includes('*') || permissions.includes('settings.manage')
}

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function shortDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function dateFrom(value) {
  if (!value) return null
  const date = new Date(value)

  return Number.isNaN(date.valueOf()) ? null : date
}

function daysBetween(start, end) {
  const startDate = dateFrom(start)
  const endDate = dateFrom(end)

  if (!startDate || !endDate) return Number.NaN

  return (endDate - startDate) / 86400000
}

function addCrmEvent(events, date, type, title, detail, status) {
  if (!dateFrom(date)) return

  events.push({
    date,
    type,
    title,
    detail,
    status,
  })
}


function dateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function datetimeLocalInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 16)
}

function formatMetricValue(key, value) {
  if (value === null || value === undefined) return ''

  const numericValue = Number(value)
  if (/(amount|balance|budget|cost|liability|receivable|total|value)/i.test(key) && Number.isFinite(numericValue)) {
    return money(numericValue)
  }

  return value
}

function intelligenceValue(item = {}) {
  if (item.unit === '%') return `${item.value || 0}%`
  return formatMetricValue(item.key || item.label || '', item.value)
}

function healthColor(value) {
  return {
    green: '#188a5a',
    amber: '#c47a16',
    red: '#c24132',
    grey: '#8a97a5',
  }[value] || '#2c6d8f'
}

function filterIntelligenceProjects(projects = [], filters = {}) {
  return projects.filter((project) => {
    if (filters.project_id && String(project.project_id) !== String(filters.project_id)) return false
    if (filters.country && project.country !== filters.country) return false
    if (filters.project_status && project.status !== filters.project_status) return false

    return true
  })
}

function filterByProject(row = {}, filters = {}) {
  if (!filters.project_id) return true
  return String(row.project_id) === String(filters.project_id)
}

function filterByProjectName(row = {}, filters = {}, projects = []) {
  if (!filters.project_id) return true
  const project = projects.find((item) => String(item.project_id) === String(filters.project_id))
  return !project || row.project === project.project
}

function nextPoStatus(status) {
  return {
    draft: 'issued',
    issued: 'approved',
    approved: 'delivered',
    delivered: 'closed',
  }[status]
}

function nextPermitStatus(status) {
  return {
    submitted: 'approved',
    approved: 'active',
    active: 'closed',
  }[status]
}

function sumBy(items = [], key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0)
}

function downloadCsv(filename, columns, rows) {
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadSimplePdf(filename, title, rows) {
  const textLines = [
    title,
    `Generated ${new Date().toLocaleString()}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${String(value || '').replace(/[^\x20-\x7E]/g, '')}`),
  ].map((line) => line.slice(0, 110))
  const pageCommands = ['BT', '/F1 16 Tf', '50 790 Td', `(${pdfText(title)}) Tj`, '/F1 10 Tf', '0 -24 Td']

  textLines.slice(1, 42).forEach((line) => {
    pageCommands.push(`(${pdfText(line)}) Tj`, '0 -16 Td')
  })

  pageCommands.push('ET')

  const stream = pageCommands.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`

  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function pdfText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function csvCell(value) {
  if (value === null || value === undefined) return '""'

  const text = Array.isArray(value)
    ? value.join('; ')
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

  return `"${text.replace(/\s+/g, ' ').trim().replaceAll('"', '""')}"`
}

function csvList(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export default App
