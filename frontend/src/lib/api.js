const configuredApiBase = import.meta.env.VITE_API_URL || '/api/v1'
const API_BASE = configuredApiBase.endsWith('/') ? configuredApiBase.slice(0, -1) : configuredApiBase
const TOKEN_KEY = 'navkwabuild_session_token'
const LEGACY_TOKEN_KEY = 'navkwabuild_token'

function clearLegacyToken() {
  try {
    window.localStorage?.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    // Storage access can be blocked by privacy settings.
  }
}

export function getToken() {
  clearLegacyToken()

  try {
    return window.sessionStorage?.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setToken(token) {
  clearLegacyToken()

  try {
    if (token) {
      window.sessionStorage?.setItem(TOKEN_KEY, token)
      return
    }

    window.sessionStorage?.removeItem(TOKEN_KEY)
  } catch {
    // Keep the app usable in locked-down browsers; the API will simply require login again.
  }
}

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const isFormData = options.body instanceof FormData

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiError(
      payload?.message || 'Request failed',
      response.status,
      payload?.errors || {},
    )
  }

  return payload
}

async function download(path, fallbackFilename = 'download') {
  const token = getToken()

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json() : null

    throw new ApiError(payload?.message || 'Request failed', response.status, payload?.errors || {})
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFromDisposition(response.headers.get('content-disposition') || '') || fallbackFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)

  return true
}

function filenameFromDisposition(disposition = '') {
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replaceAll('"', ''))

  const quotedMatch = disposition.match(/filename="?([^";]+)"?/i)
  return quotedMatch?.[1] || ''
}

function requestBody(payload) {
  return payload instanceof FormData ? payload : JSON.stringify(payload)
}

function spoofPatchBody(payload) {
  if (payload instanceof FormData) {
    if (!payload.has('_method')) {
      payload.append('_method', 'PATCH')
    }

    return payload
  }

  return JSON.stringify(payload)
}

export const api = {
  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeMfaChallenge: (payload) =>
    request('/auth/mfa-challenge', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changePassword: (payload) =>
    request('/security/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  mfaStatus: () => request('/security/mfa'),
  setupMfa: (payload) =>
    request('/security/mfa/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  enableMfa: (payload) =>
    request('/security/mfa/enable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disableMfa: (payload) =>
    request('/security/mfa/disable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  regenerateMfaRecoveryCodes: (payload) =>
    request('/security/mfa/recovery-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  dashboard: () => request('/dashboard'),
  reports: () => request('/reports'),
  notifications: () => request('/notifications'),
  updateNotificationSettings: (payload) =>
    request('/notifications/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    }),
  acknowledgeNotification: (notificationId) =>
    request(`/notifications/${notificationId}/acknowledge`, {
      method: 'POST',
    }),
  procurement: () => request('/procurement'),
  sales: () => request('/sales'),
  createLead: (payload) =>
    request('/sales/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLead: (leadId, payload) =>
    request(`/sales/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteLead: (leadId) =>
    request(`/sales/leads/${leadId}`, {
      method: 'DELETE',
    }),
  qualifyLead: (leadId, payload = {}) =>
    request(`/sales/leads/${leadId}/qualify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createOpportunity: (payload) =>
    request('/sales/opportunities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTenderFromOpportunity: (opportunityId, payload = {}) =>
    request(`/sales/opportunities/${opportunityId}/tenders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTender: (payload) =>
    request('/sales/tenders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTender: (tenderId, payload) =>
    request(`/sales/tenders/${tenderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  submitTender: (tenderId) =>
    request(`/sales/tenders/${tenderId}/submit`, {
      method: 'POST',
    }),
  winTender: (tenderId, payload = {}) =>
    request(`/sales/tenders/${tenderId}/win`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  loseTender: (tenderId, lost_reason) =>
    request(`/sales/tenders/${tenderId}/lose`, {
      method: 'POST',
      body: JSON.stringify({ lost_reason }),
    }),
  createTenderRfi: (tenderId, payload) =>
    request(`/sales/tenders/${tenderId}/rfis`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  respondTenderRfi: (rfiId, response) =>
    request(`/sales/tender-rfis/${rfiId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),
  uploadTenderDocument: (tenderId, payload) =>
    request(`/sales/tenders/${tenderId}/documents`, {
      method: 'POST',
      body: payload,
    }),
  createTenderRecord: (tenderId, payload) =>
    request(`/sales/tenders/${tenderId}/records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTenderRecord: (recordId, payload) =>
    request(`/sales/tender-records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createPricingItem: (payload) =>
    request('/sales/pricing-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createEstimate: (payload) =>
    request('/sales/estimates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addEstimateLine: (estimateId, payload) =>
    request(`/sales/estimates/${estimateId}/lines`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveEstimate: (estimateId) =>
    request(`/sales/estimates/${estimateId}/approve`, {
      method: 'POST',
    }),
  inventory: () => request('/inventory'),
  createWarehouse: (payload) =>
    request('/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWarehouse: (warehouseId, payload) =>
    request(`/inventory/warehouses/${warehouseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteWarehouse: (warehouseId) =>
    request(`/inventory/warehouses/${warehouseId}`, {
      method: 'DELETE',
    }),
  createInventoryItem: (payload) =>
    request('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateInventoryItem: (itemId, payload) =>
    request(`/inventory/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteInventoryItem: (itemId) =>
    request(`/inventory/items/${itemId}`, {
      method: 'DELETE',
    }),
  createStockMovement: (payload) =>
    request('/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSupplierPrice: (supplierId, payload) =>
    request(`/suppliers/${supplierId}/prices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSupplierReview: (supplierId, payload) =>
    request(`/suppliers/${supplierId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  field: () => request('/field'),
  createDailyReport: (projectId, payload) =>
    request(`/projects/${projectId}/daily-reports`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  transitionDailyReport: (dailyReportId, status) =>
    request(`/field/daily-reports/${dailyReportId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  createFieldIssue: (projectId, formData) =>
    request(`/projects/${projectId}/field-issues`, {
      method: 'POST',
      body: formData,
    }),
  updateFieldIssue: (issueId, payload) =>
    request(`/field/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFieldIssue: (issueId) =>
    request(`/field/issues/${issueId}`, {
      method: 'DELETE',
    }),
  clockIn: (formData) =>
    request('/attendance/clock-in', {
      method: 'POST',
      body: formData,
    }),
  clockOut: (attendanceId, formData) =>
    request(`/attendance/${attendanceId}/clock-out`, {
      method: 'POST',
      body: formData,
    }),
  organization: () => request('/organization'),
  updateCompany: (payload) =>
    request('/organization/company', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminApprovals: () => request('/admin/approvals'),
  reviewAdminApproval: (type, recordId, payload) =>
    request(`/admin/approvals/${type}/${recordId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCompany: () =>
    request('/organization/company', {
      method: 'DELETE',
    }),
  createBranch: (payload) =>
    request('/organization/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createClient: (payload) =>
    request('/organization/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateClient: (clientId, payload) =>
    request(`/organization/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteClient: (clientId) =>
    request(`/organization/clients/${clientId}`, {
      method: 'DELETE',
    }),
  createSupplier: (payload) =>
    request('/organization/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSupplier: (supplierId, payload) =>
    request(`/organization/suppliers/${supplierId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSupplier: (supplierId) =>
    request(`/organization/suppliers/${supplierId}`, {
      method: 'DELETE',
    }),
  createUser: (payload) =>
    request('/organization/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (userId, payload) =>
    request(`/organization/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteUser: (userId) =>
    request(`/organization/users/${userId}`, {
      method: 'DELETE',
    }),
  createRole: (payload) =>
    request('/organization/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRole: (roleId, payload) =>
    request(`/organization/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRole: (roleId) =>
    request(`/organization/roles/${roleId}`, {
      method: 'DELETE',
    }),
  projects: () => request('/projects?per_page=100'),
  project: (projectId) => request(`/projects/${projectId}`),
  createProject: (payload) =>
    request('/projects', {
      method: 'POST',
      body: requestBody(payload),
    }),
  uploadProjectImage: (projectId, formData) =>
    request(`/projects/${projectId}/future-image`, {
      method: 'POST',
      body: formData,
    }),
  updateProject: (projectId, payload) =>
    request(`/projects/${projectId}`, {
      method: payload instanceof FormData ? 'POST' : 'PATCH',
      body: spoofPatchBody(payload),
    }),
  deleteProject: (projectId) =>
    request(`/projects/${projectId}`, {
      method: 'DELETE',
    }),
  restoreProject: (projectId) =>
    request(`/projects/${projectId}/restore`, {
      method: 'POST',
    }),
  forceDeleteProject: (projectId) =>
    request(`/projects/${projectId}/force`, {
      method: 'DELETE',
    }),
  createProjectTemplate: (projectId, payload) =>
    request(`/projects/${projectId}/templates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteProjectTemplate: (templateId) =>
    request(`/project-templates/${templateId}`, {
      method: 'DELETE',
    }),
  createTask: (projectId, payload) =>
    request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (projectId, taskId, payload) =>
    request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteTask: (projectId, taskId) =>
    request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),
  createBudgetLine: (projectId, payload) =>
    request(`/projects/${projectId}/budget-lines`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBudgetLine: (projectId, budgetLineId, payload) =>
    request(`/projects/${projectId}/budget-lines/${budgetLineId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteBudgetLine: (projectId, budgetLineId) =>
    request(`/projects/${projectId}/budget-lines/${budgetLineId}`, {
      method: 'DELETE',
    }),
  requisitions: () => request('/procurement/requisitions?per_page=100'),
  purchaseOrders: () => request('/procurement/purchase-orders?per_page=100'),
  createRequisition: (projectId, payload) =>
    request(`/projects/${projectId}/requisitions`, {
      method: 'POST',
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    }),
  updateRequisition: (requisitionId, payload) =>
    request(`/procurement/requisitions/${requisitionId}`, {
      method: 'PATCH',
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    }),
  deleteRequisition: (requisitionId) =>
    request(`/procurement/requisitions/${requisitionId}`, {
      method: 'DELETE',
    }),
  submitRequisition: (requisitionId) =>
    request(`/procurement/requisitions/${requisitionId}/submit`, {
      method: 'POST',
    }),
  reviewRequisition: (requisitionId, decision) =>
    request(`/procurement/requisitions/${requisitionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  convertRequisition: (requisitionId, payload) =>
    request(`/procurement/requisitions/${requisitionId}/convert-to-po`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createRfq: (requisitionId, payload) =>
    request(`/procurement/requisitions/${requisitionId}/rfqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSupplierQuotation: (rfqId, payload) =>
    request(`/procurement/rfqs/${rfqId}/quotations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acceptQuotation: (quotationId) =>
    request(`/procurement/quotations/${quotationId}/accept`, {
      method: 'POST',
    }),
  createPoFromQuotation: (quotationId) =>
    request(`/procurement/quotations/${quotationId}/purchase-order`, {
      method: 'POST',
    }),
  transitionPurchaseOrder: (purchaseOrderId, status) =>
    request(`/procurement/purchase-orders/${purchaseOrderId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  createGoodsReceipt: (purchaseOrderId, payload) =>
    request(`/procurement/purchase-orders/${purchaseOrderId}/goods-receipts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createProcurementQualityInspection: (goodsReceiptId, payload) =>
    request(`/procurement/goods-receipts/${goodsReceiptId}/quality-inspections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSupplierInvoice: (purchaseOrderId, payload) =>
    request(`/procurement/purchase-orders/${purchaseOrderId}/supplier-invoices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveSupplierInvoice: (invoiceId, payload) =>
    request(`/procurement/supplier-invoices/${invoiceId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  paySupplierInvoice: (invoiceId, payload) =>
    request(`/procurement/supplier-invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSupplierContract: (supplierId, payload) =>
    request(`/suppliers/${supplierId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  documents: () => request('/documents?per_page=100'),
  uploadDocument: (formData) =>
    request('/documents', {
      method: 'POST',
      body: formData,
    }),
  updateDocument: (documentId, formData) => {
    const isFormData = formData instanceof FormData

    if (isFormData && !formData.has('_method')) {
      formData.append('_method', 'PATCH')
    }

    return request(`/documents/${documentId}`, {
      method: isFormData ? 'POST' : 'PATCH',
      body: isFormData ? formData : JSON.stringify(formData),
    })
  },
  deleteDocument: (documentId) =>
    request(`/documents/${documentId}`, {
      method: 'DELETE',
    }),
  downloadDocument: (documentId, filename) =>
    download(`/documents/${documentId}/download`, filename || 'document'),
  drawings: () => request('/drawings?per_page=100'),
  uploadDrawing: (formData) =>
    request('/drawings', {
      method: 'POST',
      body: formData,
    }),
  reviseDrawing: (drawingId, formData) =>
    request(`/drawings/${drawingId}/revisions`, {
      method: 'POST',
      body: formData,
    }),
  downloadDrawingRevision: (revisionId, filename) =>
    download(`/drawing-revisions/${revisionId}/download`, filename || 'drawing-revision'),
  transitionDrawing: (drawingId, status) =>
    request(`/drawings/${drawingId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  createDrawingMarkup: (drawingId, payload) =>
    request(`/drawings/${drawingId}/markups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveDrawingMarkup: (markupId) =>
    request(`/drawing-markups/${markupId}/resolve`, {
      method: 'POST',
    }),
  createDrawingReview: (drawingId, payload) =>
    request(`/drawings/${drawingId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  finance: () => request('/finance'),
  createInvoice: (payload) =>
    request('/finance/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  issueInvoice: (invoiceId, payload = {}) =>
    request(`/finance/invoices/${invoiceId}/issue`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  recordPayment: (invoiceId, payload) =>
    request(`/finance/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createExpense: (payload) =>
    request('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewExpense: (expenseId, status) =>
    request(`/finance/expenses/${expenseId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  createJournalEntry: (payload) =>
    request('/finance/journal-entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceAccount: (payload) =>
    request('/finance/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceBankAccount: (payload) =>
    request('/finance/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceBankReconciliation: (payload) =>
    request('/finance/bank-reconciliations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadFinanceWorkbook: (formData) =>
    request('/finance/workbooks', {
      method: 'POST',
      body: formData,
    }),
  createFinanceCreditNote: (payload) =>
    request('/finance/credit-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceRetention: (payload) =>
    request('/finance/retentions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  releaseFinanceRetention: (retentionId, payload) =>
    request(`/finance/retentions/${retentionId}/release`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceProgressBilling: (payload) =>
    request('/finance/progress-billings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceTaxRule: (payload) =>
    request('/finance/tax-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceCostCenter: (payload) =>
    request('/finance/cost-centers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFinanceFixedAsset: (payload) =>
    request('/finance/fixed-assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  people: () => request('/people'),
  createEmployee: (payload) =>
    request('/people/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createLeaveRequest: (payload) =>
    request('/people/leave-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewLeaveRequest: (leaveId, payload) =>
    request(`/people/leave-requests/${leaveId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPayrollRun: (payload) =>
    request('/people/payroll-runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approvePayrollRun: (runId, payload = {}) =>
    request(`/people/payroll-runs/${runId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createJobVacancy: (payload) =>
    request('/people/job-vacancies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createCandidate: (payload) =>
    request('/people/candidates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceApplication: (payload) =>
    request('/people/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  hireWorkforceApplication: (applicationId, payload = {}) =>
    request(`/people/applications/${applicationId}/hire`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceInterview: (payload) =>
    request('/people/interviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createOnboardingChecklist: (payload) =>
    request('/people/onboarding-checklists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceShift: (payload) =>
    request('/people/shifts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createShiftAssignment: (payload) =>
    request('/people/shift-assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTimesheet: (payload) =>
    request('/people/timesheets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewTimesheet: (timesheetId, payload) =>
    request(`/people/timesheets/${timesheetId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceAllocation: (payload) =>
    request('/people/workforce-allocations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createOvertimeRequest: (payload) =>
    request('/people/overtime-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewOvertimeRequest: (overtimeId, payload) =>
    request(`/people/overtime-requests/${overtimeId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceBenefit: (payload) =>
    request('/people/benefits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPerformanceReview: (payload) =>
    request('/people/performance-reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTrainingCourse: (payload) =>
    request('/people/training-courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTrainingRecord: (payload) =>
    request('/people/training-records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createCertification: (payload) =>
    request('/people/certifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPpeIssue: (payload) =>
    request('/people/ppe-issues', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceContractor: (payload) =>
    request('/people/contractors', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceAsset: (payload) =>
    request('/people/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkforceDocument: (payload) =>
    request('/people/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createExitRecord: (payload) =>
    request('/people/exit-records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  equipment: () => request('/equipment'),
  createEquipmentAsset: (payload) =>
    request('/equipment/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  assignEquipmentAsset: (assetId, payload) =>
    request(`/equipment/assets/${assetId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  releaseEquipmentAssignment: (assignmentId, payload = {}) =>
    request(`/equipment/assignments/${assignmentId}/release`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMaintenanceLog: (assetId, payload) =>
    request(`/equipment/assets/${assetId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createFuelLog: (assetId, payload) =>
    request(`/equipment/assets/${assetId}/fuel-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  compliance: () => request('/compliance'),
  createInspection: (projectId, payload) =>
    request(`/projects/${projectId}/inspections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeInspection: (inspectionId, payload = {}) =>
    request(`/compliance/inspections/${inspectionId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createNcr: (projectId, payload) =>
    request(`/projects/${projectId}/ncrs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeNcr: (ncrId, payload) =>
    request(`/compliance/ncrs/${ncrId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSafetyIncident: (payload) =>
    request('/safety/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeSafetyIncident: (incidentId, payload) =>
    request(`/safety/incidents/${incidentId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createToolboxTalk: (payload) =>
    request('/safety/toolbox-talks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSafetyObservation: (payload) =>
    request('/safety/observations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeSafetyObservation: (observationId, payload) =>
    request(`/safety/observations/${observationId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createWorkPermit: (payload) =>
    request('/safety/permits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  transitionWorkPermit: (permitId, status) =>
    request(`/safety/permits/${permitId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  portals: () => request('/portals'),
  createPortalUser: (payload) =>
    request('/portals/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  grantPortalAccess: (portalUserId, payload) =>
    request(`/portals/users/${portalUserId}/access`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createClientApproval: (projectId, payload) =>
    request(`/projects/${projectId}/client-approvals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewClientApproval: (approvalId, payload) =>
    request(`/portals/client-approvals/${approvalId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createConsultantSubmittal: (projectId, payload) =>
    request(`/projects/${projectId}/consultant-submittals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewConsultantSubmittal: (submittalId, payload) =>
    request(`/portals/consultant-submittals/${submittalId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPortalWorkItem: (projectId, payload) =>
    request(`/projects/${projectId}/portal-work-items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePortalWorkItem: (workItemId, payload) =>
    request(`/portals/work-items/${workItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  reviewPortalWorkItem: (workItemId, payload) =>
    request(`/portals/work-items/${workItemId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePortalWorkItem: (workItemId) =>
    request(`/portals/work-items/${workItemId}`, {
      method: 'DELETE',
    }),
  businessIntelligence: () => request('/bi'),
  createBiDashboard: (payload) =>
    request('/bi/dashboards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBiDashboard: (dashboardId, payload) =>
    request(`/bi/dashboards/${dashboardId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteBiDashboard: (dashboardId) =>
    request(`/bi/dashboards/${dashboardId}`, {
      method: 'DELETE',
    }),
  createMetricSnapshot: (payload = {}) =>
    request('/bi/snapshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  automation: () => request('/automation'),
  platformAdmin: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value)
    })

    return request(`/platform-admin${query.toString() ? `?${query}` : ''}`)
  },
  createPlatformCompany: (payload) =>
    request('/platform-admin/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatformCompany: (companyId, payload) =>
    request(`/platform-admin/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  archivePlatformCompany: (companyId) =>
    request(`/platform-admin/companies/${companyId}`, {
      method: 'DELETE',
    }),
  restorePlatformCompany: (companyId) =>
    request(`/platform-admin/companies/${companyId}/restore`, {
      method: 'POST',
    }),
  deleteArchivedPlatformCompany: (companyId) =>
    request(`/platform-admin/companies/${companyId}/permanent`, {
      method: 'DELETE',
    }),
  updatePlatformCompanyFeature: (companyId, flagId, payload) =>
    request(`/platform-admin/companies/${companyId}/features/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updatePlatformFeature: (flagId, payload) =>
    request(`/platform-admin/features/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updatePlatformBranding: (companyId, payload) =>
    request(`/platform-admin/companies/${companyId}/branding`, {
      method: 'POST',
      body: payload,
    }),
  updatePlatformCompanySuccess: (companyId, payload) =>
    request(`/platform-admin/companies/${companyId}/success`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createPlatformStaffUser: (payload) =>
    request('/platform-admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatformStaffUser: (userId, payload) =>
    request(`/platform-admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deletePlatformStaffUser: (userId) =>
    request(`/platform-admin/users/${userId}`, {
      method: 'DELETE',
    }),
  updatePlatformProfile: (payload) =>
    request('/platform-admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  startPlatformImpersonation: (companyId, payload) =>
    request(`/platform-admin/companies/${companyId}/impersonate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPlatformPlan: (payload) =>
    request('/platform-admin/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatformPlan: (planId, payload) =>
    request(`/platform-admin/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deletePlatformPlan: (planId) =>
    request(`/platform-admin/plans/${planId}`, {
      method: 'DELETE',
    }),
  updatePlatformSubscription: (subscriptionId, payload) =>
    request(`/platform-admin/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  upgradePlatformSubscription: (subscriptionId, payload) =>
    request(`/platform-admin/subscriptions/${subscriptionId}/upgrade`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePlatformSubscription: (subscriptionId) =>
    request(`/platform-admin/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    }),
  createPlatformBillingRecord: (payload) =>
    request('/platform-admin/billing-records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPlatformSupportTicket: (payload) =>
    request('/platform-admin/support-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatformSupportTicket: (ticketId, payload) =>
    request(`/platform-admin/support-tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createPlatformDeployment: (payload) =>
    request('/platform-admin/deployments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPlatformBackup: (payload) =>
    request('/platform-admin/backups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatformSettings: (payload) =>
    request('/platform-admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  automationCatalog: () => request('/automation/catalog'),
  createAutomationRule: (payload) =>
    request('/automation/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAutomationRule: (ruleId, payload) =>
    request(`/automation/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAutomationRule: (ruleId) =>
    request(`/automation/rules/${ruleId}`, {
      method: 'DELETE',
    }),
  runAutomationRule: (ruleId) =>
    request(`/automation/rules/${ruleId}/run`, {
      method: 'POST',
    }),
  rollbackAutomationVersion: (ruleId, version) =>
    request(`/automation/rules/${ruleId}/versions/${version}/rollback`, {
      method: 'POST',
    }),
  instantiateAutomationTemplate: (templateKey, payload = {}) =>
    request(`/automation/templates/${templateKey}/instantiate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  triggerAutomationEvent: (event, payload = {}) =>
    request(`/automation/triggers/${event}`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    }),
  runActiveAutomation: () =>
    request('/automation/run-active', {
      method: 'POST',
    }),
}

export function validationSummary(error) {
  if (!(error instanceof ApiError) || !error.errors) {
    return error.message || 'Something went wrong'
  }

  const first = Object.values(error.errors)[0]
  return Array.isArray(first) ? first[0] : error.message
}
