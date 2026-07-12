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
  number: { type: String, required: true, unique: true, uppercase: true },
  model: { type: String, required: true },
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
  name: { type: String, required: true },
  phone: { type: String, required: true },
  license: { type: String, required: true, unique: true },
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
  company: { type: String, required: true },
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
  pickup: { type: String, required: true },
  drop: { type: String, required: true },
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
  remarks: String,
  status: { type: String, enum: ["Draft", "Assigned", "In Transit", "Completed", "Cancelled"], default: "Assigned" },
  profitAnalysis: moneyBreakdownSchema,
  podDocs: [documentSchema],
}, { timestamps: true }));

export const Expense = mongoose.model("Expense", new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  category: { type: String, enum: ["Fuel", "Toll", "Maintenance", "Salary", "Allowance", "Parking", "Other"], required: true },
  amount: { type: Number, required: true },
  liters: { type: Number, default: 0 },
  odometerKm: { type: Number, default: 0 },
  mileage: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  note: String,
  document: documentSchema,
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
  linkedTrips: [String],
  invoiceNumber: String,
  billingDate: Date,
  loadingDate: { type: Date, required: true },
  vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
  from: { type: String, required: true, trim: true },
  to: { type: String, required: true, trim: true },
  freight: { type: Number, default: 0 },
  additionalCharges: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 18 },
  finalAmount: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  hamali: { type: Number, default: 0 },
  payCharge: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  partyName: { type: String, required: true, trim: true },
  chequeNeftNumber: String,
  bank: String,
  dueDate: Date,
  paymentMode: String,
  paymentDate: Date,
  remarks: String,
  status: { type: String, enum: ["Pending", "Partially Paid", "Paid"], default: "Pending" },
}, { timestamps: true });

balanceFreightSchema.index({ partyName: "text", vehicleNumber: "text", from: "text", to: "text", chequeNeftNumber: "text", bank: "text", remarks: "text" });
balanceFreightSchema.pre("validate", function calculateBalanceFreight(next) {
  if (!this.commission) this.commission = Math.round((this.freight || 0) * 0.02);
  this.balance = Math.max((this.freight || 0) - (this.advance || 0) - (this.commission || 0) - (this.otherCharges || 0) - (this.hamali || 0) - (this.payCharge || 0), 0);
  this.status = this.balance === 0 ? "Paid" : (this.advance || this.payCharge || this.paymentDate) ? "Partially Paid" : "Pending";
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
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  serviceType: { type: String, enum: ["Oil Change", "Tyre", "Battery", "Brake", "Engine", "Suspension", "Electrical", "General Service"], required: true },
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
