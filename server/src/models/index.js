import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  type: String,
  documentNumber: String,
  issueDate: Date,
  expiryDate: Date,
  status: { type: String, enum: ["Valid", "Due 90", "Due 60", "Due 30", "Due 15", "Due 7", "Expired"], default: "Valid" },
  fileName: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const moneyBreakdownSchema = new mongoose.Schema({
  fuelCost: { type: Number, default: 0 },
  driverSalary: { type: Number, default: 0 },
  driverAllowance: { type: Number, default: 0 },
  tollCharges: { type: Number, default: 0 },
  parking: { type: Number, default: 0 },
  maintenanceCost: { type: Number, default: 0 },
  miscExpenses: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  netProfit: { type: Number, default: 0 },
  profitPercent: { type: Number, default: 0 },
  profitPerKm: { type: Number, default: 0 },
  costPerKm: { type: Number, default: 0 },
  revenuePerKm: { type: Number, default: 0 },
  status: { type: String, enum: ["Highly Profitable", "Average", "Loss"], default: "Average" },
}, { _id: false });

export const User = mongoose.model("User", new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "manager", "driver"], default: "admin" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
}, { timestamps: true }));

export const Vehicle = mongoose.model("Vehicle", new mongoose.Schema({
  // These are business fields, not database identity fields.  A draft vehicle
  // record must be allowed while the operator is still collecting details.
  number: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  model: { type: String, default: "" },
  type: String,
  capacity: String,
  chassisNumber: String,
  engineNumber: String,
  ownerName: String,
  ownerPhone: String,
  registrationDate: Date,
  status: { type: String, enum: ["Available", "On Trip", "Under Maintenance"], default: "Available" },
  rcExpiry: Date,
  insuranceExpiry: Date,
  permitExpiry: Date,
  fitnessExpiry: Date,
  pucExpiry: Date,
  maintenanceSchedule: Date,
  currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  driverHistory: [{
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    driverName: String,
    assignedAt: Date,
    endedAt: Date,
    reason: String,
  }],
  billingHistory: [String],
  documentHistory: [String],
  documents: [documentSchema],
}, { timestamps: true }));

export const Driver = mongoose.model("Driver", new mongoose.Schema({
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  license: { type: String, unique: true, sparse: true, trim: true },
  licenseExpiry: Date,
  aadhaar: String,
  pan: String,
  address: String,
  emergencyContact: String,
  joiningDate: Date,
  assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  earnings: { type: Number, default: 0 },
  paymentHistory: [String],
  status: { type: String, enum: ["Active", "On Trip", "Off Duty"], default: "Active" },
  salary: { type: Number, default: 0 },
  tripWage: { type: Number, default: 0 },
  documents: [documentSchema],
  attendance: {
    workingDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    lateDeliveries: { type: Number, default: 0 },
    accidents: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    advanceTaken: { type: Number, default: 0 },
  },
}, { timestamps: true }));

export const Customer = mongoose.model("Customer", new mongoose.Schema({
  company: { type: String, default: "" },
  contact: String,
  phone: String,
  email: String,
  gst: { type: String, uppercase: true, trim: true },
  address: String,
  creditLimit: { type: Number, default: 0 },
}, { timestamps: true }));

export const Trip = mongoose.model("Trip", new mongoose.Schema({
  // Existing records were created before linked IDs were enforced. Keeping
  // them optional prevents old bookings from blocking document updates.
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  pickup: { type: String, default: "" },
  drop: { type: String, default: "" },
  lrNumber: String,
  cargoName: String,
  materialType: String,
  weight: String,
  quantity: String,
  cargo: String,
  date: Date,
  endDate: Date,
  distanceKm: { type: Number, default: 0 },
  durationHrs: { type: Number, default: 0 },
  freight: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  advances: [{ date: Date, amount: { type: Number, default: 0 }, mode: String, note: String }],
  manualVehicleNumber: { type: String, trim: true, default: "" },
  tollCharges: { type: Number, default: 0 },
  driverAllowance: { type: Number, default: 0 },
  otherExpenses: { type: Number, default: 0 },
  invoiceNumber: String,
  paymentStatus: { type: String, enum: ["Paid", "Partial", "Pending", "Overdue"], default: "Pending" },
  ewayBill: String,
  deliveryReceipt: String,
  size: String,
  billNo: String,
  chNo: String,
  receivedDate: Date,
  otherChargesReason: String,
  expenseRemarks: [{
    category: String,
    amount: { type: Number, default: 0 },
    remark: String,
  }],
  remarks: String,
  status: { type: String, enum: ["Draft", "Assigned", "In Transit", "Completed", "Cancelled"], default: "Assigned" },
  profitAnalysis: moneyBreakdownSchema,
  podDocs: [documentSchema],
}, { timestamps: true }));

export const Expense = mongoose.model("Expense", new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  category: { type: String, default: "", trim: true },
  amount: { type: Number, default: 0 },
  liters: { type: Number, default: 0 },
  odometerKm: { type: Number, default: 0 },
  mileage: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  note: String,
  document: documentSchema,
}, { timestamps: true }));

// Company overhead is deliberately kept separate from trip/fleet expenses.
export const CompanyExpense = mongoose.model("CompanyExpense", new mongoose.Schema({
  name: { type: String, default: "", trim: true },
  amount: { type: Number, default: 0, min: 0 },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" },
}, { timestamps: true }));

// Recurring loan/EMI reminder. The client turns this into a bold in-app
// notification each month until the selected tenure has ended.
export const EmiReminder = mongoose.model("EmiReminder", new mongoose.Schema({
  name: { type: String, default: "", trim: true },
  amount: { type: Number, default: 0, min: 0 },
  dueDay: { type: Number, default: 1, min: 1, max: 31 },
  tenureMonths: { type: Number, default: 1, min: 1 },
  startDate: { type: Date, default: Date.now },
  note: { type: String, default: "" },
  status: { type: String, enum: ["Active", "Closed"], default: "Active" },
  // YYYY-MM entries that have been paid. This lets the next month's reminder return.
  paidMonths: { type: [String], default: [] },
}, { timestamps: true }));

export const Invoice = mongoose.model("Invoice", new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  billingDate: Date,
  additionalCharges: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  outstandingAmount: { type: Number, default: 0 },
  paymentMode: String,
  receiptFile: String,
  dueDate: Date,
  status: { type: String, enum: ["Paid", "Partial", "Pending", "Overdue"], default: "Pending" },
  paidAt: Date,
}, { timestamps: true }));

export const Payment = mongoose.model("Payment", new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Advance"], default: "Bank Transfer" },
  reference: String,
  receiptNo: String,
  paidAt: { type: Date, default: Date.now },
}, { timestamps: true }));

const balanceFreightSchema = new mongoose.Schema({
  freightId: String,
  billNo: String,
  challanNo: String,
  ownerName: String,
  cnNo: String,
  size: String,
  weight: String,
  rate: { type: Number, default: 0 },
  advances: [{ date: Date, amount: Number, mode: String, note: String }],
  linkedTrips: [String],
  invoiceNumber: String,
  billingDate: Date,
  loadingDate: { type: Date, default: Date.now },
  vehicleNumber: { type: String, default: "", uppercase: true, trim: true },
  from: { type: String, default: "", trim: true },
  to: { type: String, default: "", trim: true },
  freight: { type: Number, default: 0 },
  additionalCharges: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 18 },
  finalAmount: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  partyAdvance: { type: Number, default: 0 },
  advanceBalance: { type: Number, default: 0 },
  // Store the selected percentage itself.  Every calculation and print view
  // reads this persisted value; no frontend or server fallback percentage.
  commissionPercent: { type: Number, min: 0 },
  commission: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  otherChargesReason: { type: String, default: "" },
  hamali: { type: Number, default: 0 },
  payCharge: { type: Number, default: 0 },
  extraHeight: { type: Number, default: 0 },
  weightRecipt: { type: Number, default: 0 },
  paymentChg: { type: Number, default: 0 },
  challanFineChg: { type: Number, default: 0 },
  unlodingChg: { type: Number, default: 0 },
  extraWeightChg: { type: Number, default: 0 },
  extraWidthChg: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  balancePaymentDate: Date,
  partyName: { type: String, default: "", trim: true },
  chequeNeftNumber: String,
  bank: String,
  dueDate: Date,
  paymentMode: String,
  paymentDate: Date,
  remarks: String,
  status: { type: String, enum: ["Pending", "Partially Paid", "Paid", "Cancelled"], default: "Pending" },
}, { timestamps: true });

balanceFreightSchema.index({ partyName: "text", vehicleNumber: "text", from: "text", to: "text", chequeNeftNumber: "text", bank: "text", remarks: "text" });
balanceFreightSchema.pre("validate", function calculateBalanceFreight(next) {
  // Preserve the effective percentage for legacy records that only stored a
  // commission amount, then always calculate from the persisted percentage.
  if (this.commissionPercent === undefined || this.commissionPercent === null) {
    this.commissionPercent = this.freight ? ((this.commission || 0) / this.freight) * 100 : 0;
  }
  this.commission = Math.round((this.freight || 0) * (this.commissionPercent || 0) / 100);
  const advances = Array.isArray(this.advances) ? this.advances : [];
  const totalAdvance = advances.length
    ? advances.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
    : (Number(this.partyAdvance ?? this.advance) || 0);
  this.advance = totalAdvance;
  this.partyAdvance = totalAdvance;
  // Balance Advance remains an independently stored challan field and does
  // not alter the final balance.
  this.advanceBalance = Number(this.advanceBalance || 0);
  const deductions = (this.commission || 0) + (this.hamali || 0) + (this.paymentChg || 0);
  const additions = (this.payCharge || 0) + (this.extraHeight || 0) + (this.extraWidthChg || 0)
    + (this.extraWeightChg || 0) + (this.weightRecipt || 0) + (this.unlodingChg || 0)
    + (this.challanFineChg || 0) + (this.otherCharges || 0);
  // The printed challan calls this signed net value "Extra". Keep a
  // negative Extra negative so the database balance matches the challan.
  const extra = additions - deductions;
  this.balance = (this.freight || 0) - totalAdvance + extra;
  next();
});

export const BalanceFreight = mongoose.model("BalanceFreight", balanceFreightSchema);

export const Attendance = mongoose.model("Attendance", new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
  date: { type: Date, required: true },
  month: { type: String, required: true },
  status: { type: String, enum: ["Present", "Absent", "Leave", "Half Day"], required: true },
  notes: String,
}, { timestamps: true }).index({ driver: 1, date: 1 }, { unique: true }));

const payrollSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
  month: { type: String, required: true },
  baseSalary: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  leave: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
}, { timestamps: true });

payrollSchema.index({ driver: 1, month: 1 }, { unique: true });
payrollSchema.pre("validate", function calculateNetSalary(next) {
  const workingDays = this.presentDays + (this.halfDays * 0.5);
  const perDay = this.baseSalary ? this.baseSalary / 30 : 0;
  this.netSalary = Math.round((workingDays * perDay) + (this.overtime || 0) + (this.bonus || 0) - (this.penalty || 0) - (this.advance || 0));
  next();
});

export const Payroll = mongoose.model("Payroll", payrollSchema);

export const Notification = mongoose.model("Notification", new mongoose.Schema({
  type: String,
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  priority: { type: String, enum: ["Low", "Normal", "High", "Critical"], default: "Normal" },
  targetRole: { type: String, enum: ["admin", "manager", "driver", "all"], default: "all" },
}, { timestamps: true }));

export const DocumentRecord = mongoose.model("DocumentRecord", new mongoose.Schema({
  ownerType: { type: String, enum: ["Vehicle", "Driver"], required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  type: { type: String, required: true },
  documentNumber: String,
  issueDate: Date,
  expiryDate: { type: Date, required: true },
  status: { type: String, enum: ["Valid", "Due 90", "Due 60", "Due 30", "Due 15", "Due 7", "Expired"], default: "Valid" },
  file: documentSchema,
}, { timestamps: true }));

export const Maintenance = mongoose.model("Maintenance", new mongoose.Schema({
  // Keep service planning usable for a draft or a custom service type. A
  // vehicle can be linked later, and the entered record must still persist.
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: undefined },
  serviceType: { type: String, default: "" },
  serviceCost: { type: Number, default: 0 },
  workshop: String,
  mechanic: String,
  partsUsed: String,
  serviceIntervalKm: { type: Number, default: 0 },
  mileageReminderKm: { type: Number, default: 0 },
  dueDate: Date,
  completedAt: Date,
  status: { type: String, enum: ["Upcoming", "Due", "Completed"], default: "Upcoming" },
}, { timestamps: true }));

export const AuditLog = mongoose.model("AuditLog", new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  module: String,
  entityId: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true }));

// A singleton business profile shared by the whole portal.
export const CompanyProfile = mongoose.model("CompanyProfile", new mongoose.Schema({
  key: { type: String, unique: true, default: "primary" },
  name: { type: String, default: "SBR Portal" },
  tagline: String,
  gst: String,
  phone: String,
  phone2: String,
  email: String,
  address: String,
  jurisdiction: String,
  pan: String,
  bankName: String,
  bankBranch: String,
  bankAccount: String,
  bankIfsc: String,
}, { timestamps: true }));
