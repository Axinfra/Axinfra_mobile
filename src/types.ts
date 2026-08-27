// Shapes matching what the shared Axinfra API actually returns — see the corresponding
// route.ts files in the web repo for the source of truth on each.

// GET /api/projects — src/app/api/projects/route.ts
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isExampleProject: boolean;
  myRole: string;
  milestoneCount: number;
  createdAt: string;
}

// GET /api/projects/[projectId]/milestones?all=true — src/app/api/projects/[projectId]/milestones/route.ts
export interface Activity {
  id: string;
  title: string;
  state: string;
  plannedEnd: string | null;
  percentComplete: number | null;
  priority: string;
  phase: { id: string; name: string } | null;
  vendorUser: { id: string; name: string } | null;
}

// GET /api/profile — src/app/api/profile/route.ts
export interface Profile {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  contactPerson: string | null;
  mobile: string | null;
  gstNumber: string | null;
  address: string | null;
  isVendor: boolean;
  isProfileComplete: boolean;
  projects: Array<{ projectId: string; projectName: string; role: string }>;
}

// GET /api/vendor/profile — src/app/api/vendor/profile/route.ts (narrower than /api/profile —
// no isVendor/isProfileComplete/projects, just the editable fields).
export interface VendorProfile {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  contactPerson: string | null;
  mobile: string | null;
  gstNumber: string | null;
  address: string | null;
}

// GET /api/directory — src/app/api/directory/route.ts. Global, no projectId — CLIENT/PMC only.
export interface DirectoryEntry {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  companyName: string | null;
  contactPerson: string | null;
  memberSince: string;
  roleTypes: string[];
  projects: Array<{ projectId: string; projectName: string; role: string }>;
}

// GET /api/projects/[projectId]/direct-orders — src/app/api/projects/[projectId]/direct-orders/route.ts
// PMC/VENDOR only (not CLIENT) — matches RoleGuard.requireRole on the web route.
export interface DirectOrder {
  id: string;
  doNumber: string;
  vendorUserId: string;
  vendorName: string;
  itemDescription: string;
  value: number;
  billedValue: number | null;
  status: string;
  remarks: string | null;
  createdAt: string;
}
export interface DirectOrderSummary {
  totalOrdered: number;
  totalDeliveredValue: number;
  paid: number;
  outstanding: number;
  totalVariance: number;
}
export interface DirectOrdersResponse {
  directOrders: DirectOrder[];
  summary: DirectOrderSummary;
}

// GET /api/projects/[projectId]/roles — src/app/api/projects/[projectId]/roles/route.ts.
// A flat array mixing accepted roles (userId set) and pending invites (userId null,
// isPendingInvite true) — only accepted VENDOR rows are usable for the "New Direct Order"
// picker, since an order needs a real userId.
export interface ProjectRoleEntry {
  userId: string | null;
  name: string;
  email: string;
  role: string;
  isPendingInvite: boolean;
}

// GET /api/projects/[projectId]/documents — src/app/api/projects/[projectId]/documents/route.ts
export interface ProjectDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  createdAt: string;
  uploadedByName: string;
  files: Array<{ id: string; fileName: string; size: number }>;
}

// GET /api/projects/[projectId]/architecture — src/app/api/projects/[projectId]/architecture/route.ts
// Overview-stats only — the same "counts, not the full drawing-row table" scope the web route
// itself gives a VENDOR; this app uses the same shape for every role rather than the heavier
// per-drawing-set/version data the full web Architecture page also has.
export interface ArchitectureOverview {
  sets: { total: number; approved: number; paid: number };
  rows: { total: number; pending: number; submitted: number; approved: number; rejected: number };
  pendingReview: number;
}

// GET /api/projects/[projectId]/architecture/sets — the full per-set/per-drawing detail (richer
// than ArchitectureOverview above), used by the Payments screen's Consultant Fees tab, matching
// the web app's Payments page exactly: fee is split across a set's drawings, and paid/due is
// tracked per drawing, not per set.
export interface DrawingRow {
  id: string;
  serialNo: number;
  name: string;
  category: string;
  /** BASEMENT | GROUND_FLOOR | FIRST_FLOOR | SECOND_FLOOR | TERRACE | ALL_FLOORS */
  floor: string;
  /** PENDING | SUBMITTED | APPROVED | REJECTED */
  status: string;
  paidAt: string | null;
  dueDate: string | null;
}
export interface DrawingSet {
  id: string;
  name: string;
  cost: number;
  currency: string;
  /** DRAFT | SUBMITTED_TO_PMC | REQUESTED | IN_PROGRESS | DELIVERED | APPROVED | PAID */
  status: string;
  dueDate: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  rowStats: { total: number; pending: number; submitted: number; approved: number; rejected: number; paid: number };
  rows: DrawingRow[];
}

// GET /api/projects/[projectId]/cost-overview — a lightweight cost snapshot (totals only, not
// the full PDF-generating ReportService data), used on the Project Overview screen.
export interface CostSnapshot {
  currency: string;
  totals: { committed: number; paidToDate: number; outstanding: number };
}

// GET /api/projects/[projectId]/checklists — src/app/api/projects/[projectId]/checklists/route.ts
export interface ChecklistSummary {
  id: string;
  title: string;
  docRefNo: string;
  referenceDrawingNo: string;
  status: string;
  signedAt: string | null;
  signedByName: string | null;
  createdAt: string;
  createdByName: string;
  itemCount: number;
  filledCount: number;
}

// GET /api/projects/[projectId]/dpr — src/app/api/projects/[projectId]/dpr/route.ts
// Full DPR also has procurement/manpower rows and photos, entered on the web app's DPR detail
// page after creation — not ported here; this covers creating a minimal DPR (date + optional
// highlights) and viewing the list, same as Checklists' scope decision above.
export interface DprSummary {
  id: string;
  reportDate: string;
  docRefNo: string;
  status: string;
  createdByName: string;
}

// GET /api/projects/[projectId]/documents/search?q=... — src/app/api/projects/[projectId]/
// documents/search/route.ts. Cross-entity (drawings, docs, checklists, DPRs, measurement
// sheets) — `subtitle`/`href` cover every type except DRAWING, which nests a `drawing` object
// instead; this app doesn't have a drawing detail screen, so DRAWING results just aren't
// tappable here (see DocumentSearchResults in documents/[projectId].tsx).
export interface SearchResult {
  type: 'DRAWING' | 'SPEC' | 'OTHER' | 'CHECKLIST' | 'DPR' | 'MEASUREMENT_SHEET';
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
}

// GET /api/admin/vendors?projectId=... — src/app/api/admin/vendors/route.ts. The real
// "Vendor Onboarding" feature (invite a vendor by email) — not to be confused with
// VendorProfile above, which is the vendor's own profile-completion form.
export interface VendorRow {
  userId: string | null;
  inviteId: string | null;
  name: string;
  email: string;
  role: string;
  assignedAt: string;
  isPendingInvite: boolean;
}

// GET /api/projects/[projectId]/phases — only the fields needed for the "assign to a Purchase
// Order" picker on the invite-vendor form.
export interface PhaseOption {
  id: string;
  name: string;
  vendorUserId: string | null;
}

// GET /api/projects/[projectId]/boq?orderId=... — src/app/api/projects/[projectId]/boq/route.ts.
// The raw route returns full Prisma BOQ rows (items, revisions) — this is the subset actually
// rendered, computed client-side from those (see orders/[projectId]/[orderId].tsx).
export interface Boq {
  id: string;
  status: string;
  order: { id: string; name: string; vendorUserId: string | null };
  items: Array<{ id: string; description: string; unit: string; plannedQty: number; rate: number; plannedValue: number }>;
}

// GET /api/projects/[projectId]/phases — src/app/api/projects/[projectId]/phases/route.ts.
// Purchase Orders — the list screen's items. `boqs` here is just id/status/itemsCount, same
// summary shape as the single-phase detail route below.
export interface PurchaseOrder {
  id: string;
  name: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  estimatedCost: number | null;
  vendorUserId: string | null;
  boqs: Array<{ id: string; status: string; itemsCount: number }>;
}

// GET /api/projects/[projectId]/phases/[phaseId] — single-PO detail, adds vendor contact info
// and Work Order status on top of the list route's summary.
export interface PurchaseOrderDetail {
  id: string;
  name: string;
  description: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  estimatedCost: number | null;
  vendorUserId: string | null;
  vendor: {
    id: string; name: string; email: string; companyName: string | null;
    contactPerson: string | null; mobile: string | null; gstNumber: string | null; address: string | null;
  } | null;
  boqs: Array<{ id: string; status: string; itemsCount: number }>;
  workOrder: { id: string; number: string; status: string; currentRevisionNumber: number } | null;
}

// GET /api/projects/[projectId]/payment-eligibility — src/app/api/projects/[projectId]/
// payment-eligibility/route.ts
export interface PaymentEligibilityRow {
  id: string;
  milestoneId: string;
  milestone: { id: string; title: string; paymentModel: string; state: string };
  state: string;
  eligibleAmount: number;
  blockedAmount: number;
  dueDate: string | null;
  indicator: { isUrgent: boolean; daysUntilDue: number | null; daysOverdue: number | null };
}
export interface PaymentSummary {
  totalEligible: number;
  totalBlocked: number;
  totalPaid: number;
  countByState: Record<string, number>;
  urgentCount: number;
}
export interface PaymentsResponse {
  eligibilities: PaymentEligibilityRow[];
  summary: PaymentSummary;
}

// GET /api/projects/[projectId]/ra-bills — src/app/api/projects/[projectId]/ra-bills/route.ts
// (RABillService.getForProject, which `include`s lineItems + order, so every scalar RABill
// column comes through — certifiedAt/paymentReference/lineItems added here to back the
// web-parity "Pay Now" flow in ra-bills/[projectId].tsx's Payments view.)
export interface RaBill {
  id: string;
  billNumber: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  submittedValue: number | null;
  certifiedAt: string | null;
  approvedValue: number | null;
  releasedValue: number | null;
  deductions: number;
  paymentReference: string | null;
  order: { id: string; name: string };
  /** Sum of `thisBillAmount` = the bill's gross/"Certified Value" — same computation as the web
   * app's `raBillGross()`, used as the fallback headline figure before submittedValue exists and
   * as the base "Certified Value" line in the Pay Now modal. */
  lineItems: { thisBillAmount: number }[];
}
export interface RaBillSummary {
  totalSubmittedValue: number;
  totalApprovedValue: number;
  totalReleasedValue: number;
  pendingSiteEngineerReviewCount: number;
  pendingCertificationCount: number;
  pendingApprovalCount: number;
}
export interface RaBillsResponse {
  raBills: RaBill[];
  total: number;
  summary: RaBillSummary;
}

// GET /api/projects/[projectId]/orders/[orderId]/work-order —
// src/app/api/projects/[projectId]/orders/[orderId]/work-order/route.ts (WorkOrderService.getForOrder).
// Only the current (latest) revision's fields — full revision history/compare isn't ported.
export interface WorkOrderRevision {
  revisionNumber: number;
  issueDate: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  fileName: string;
  remarks: string | null;
  reason: string | null;
  vendorAcceptanceStatus: string;
  acceptedAt: string | null;
  vendorRemarks: string | null;
  createdBy: { name: string };
}
export interface WorkOrderDetail {
  id: string;
  number: string;
  status: string;
  currentRevisionNumber: number;
  revisions: WorkOrderRevision[];
}

// GET /api/projects/[projectId]/messages/conversations —
// src/app/api/projects/[projectId]/messages/conversations/route.ts
export interface Conversation {
  userId: string;
  name: string;
  role: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

// GET /api/projects/[projectId]/messages/[otherUserId] —
// src/app/api/projects/[projectId]/messages/[otherUserId]/route.ts
export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  sender: { id: string; name: string };
}

// GET /api/projects/[projectId]/analysis?tab=execution —
// src/services/AnalysisService.ts ExecutionAnalysis. Only overview + stateBreakdown — slaBreaches
// and byTrade from the full type aren't rendered here, same "the headline numbers, not every
// drill-down table" scope as the rest of this app's Analysis-adjacent screens.
export interface ExecutionOverview {
  totalMilestones: number;
  verifiedPercent: number;
  avgDaysInProgress: number;
  avgDaysInSubmitted: number;
  doneCount: number;
  inProgressCount: number;
  submittedCount: number;
  approachingCount: number;
  draftCount: number;
}
export interface StateBreakdownRow {
  state: string;
  count: number;
  percent: number;
  avgDaysInState: number;
}
export interface ExecutionAnalysis {
  overview: ExecutionOverview;
  stateBreakdown: StateBreakdownRow[];
}

// GET /api/projects/[projectId]/analysis?tab=vendor — src/services/AnalysisService.ts VendorAnalysis
export interface VendorAnalysisRow {
  vendorId: string;
  vendorName: string;
  overrunPercent: number;
  milestonesTotal: number;
  milestonesVerified: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}
export interface VendorAnalysis {
  vendors: VendorAnalysisRow[];
  totals: { totalVendors: number; highRiskCount: number };
}
