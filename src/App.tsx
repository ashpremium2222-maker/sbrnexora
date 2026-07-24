import { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle, BarChart3, Bell, Building2, Calendar, CheckCircle2, ChevronRight, ClipboardList,
  CreditCard, Download, Eye, FileText, Filter, Fuel, IndianRupee, LayoutDashboard, LogOut,
  Mail, MapPin, Package, Phone, Plus, Printer, Receipt, Route, Search, Send, Settings as SettingsIcon,
  ShieldCheck, Sparkles, Truck, Upload, User, UserCheck, Users, Wrench, X, Gauge, Battery, Wifi, Navigation, Activity, Minus, Locate,
  Maximize2, Minimize2, Map as MapIcon, List as ListIcon, Sun, Moon, Trash2,
} from "lucide-react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Role = "admin" | "driver";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");
const PORTAL_NAME = "SBR Portal";
let currentAuthToken: string | null = null;

async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function mapCompanyProfileFromApi(doc: Record<string, unknown>): CompanyProfile {
  const fields: (keyof CompanyProfile)[] = ["name", "tagline", "gst", "phone", "phone2", "email", "address", "jurisdiction", "pan", "bankName", "bankBranch", "bankAccount", "bankIfsc"];
  return fields.reduce((profile, field) => ({ ...profile, [field]: String(doc[field] ?? profile[field] ?? "") }), { ...seedCompanyProfile });
}

function companyProfileToApiPayload(profile: CompanyProfile) {
  const { name, tagline, gst, phone, phone2, email, address, jurisdiction, pan, bankName, bankBranch, bankAccount, bankIfsc } = profile;
  return { name, tagline, gst, phone, phone2, email, address, jurisdiction, pan, bankName, bankBranch, bankAccount, bankIfsc };
}

function mapVehicleFromApi(doc: Record<string, unknown>): Vehicle {
  return {
    id: String(doc._id),
    number: String(doc.number || ""),
    model: String(doc.model || ""),
    status: (doc.status as Status) || "Available",
    capacity: String(doc.capacity || ""),
    rcExpiry: String(doc.rcExpiry || "").slice(0, 10),
    insuranceExpiry: String(doc.insuranceExpiry || "").slice(0, 10),
    permitExpiry: String(doc.permitExpiry || "").slice(0, 10),
    pucExpiry: String(doc.pucExpiry || "").slice(0, 10),
    type: doc.type ? String(doc.type) : undefined,
    chassisNumber: doc.chassisNumber ? String(doc.chassisNumber) : undefined,
    engineNumber: doc.engineNumber ? String(doc.engineNumber) : undefined,
    ownerName: doc.ownerName ? String(doc.ownerName) : undefined,
    ownerPhone: doc.ownerPhone ? String(doc.ownerPhone) : undefined,
    registrationDate: doc.registrationDate ? String(doc.registrationDate).slice(0, 10) : undefined,
    fitnessExpiry: doc.fitnessExpiry ? String(doc.fitnessExpiry).slice(0, 10) : undefined,
    currentDriverId: doc.currentDriver ? String((doc.currentDriver as Record<string, unknown>)?._id ?? doc.currentDriver) : undefined,
    driverHistory: ((doc.driverHistory as Record<string, unknown>[]) || []).map((entry) => ({
      driverId: String((entry.driver as Record<string, unknown>)?._id ?? entry.driver ?? ""),
      driverName: String(entry.driverName || ""), vehicleId: String(doc._id), vehicleNumber: String(doc.number || ""),
      assignedAt: entry.assignedAt ? String(entry.assignedAt).slice(0, 10) : "", endedAt: entry.endedAt ? String(entry.endedAt).slice(0, 10) : undefined,
      reason: String(entry.reason || ""),
    })),
    billingHistory: (doc.billingHistory as string[]) || [],
    documentHistory: (doc.documentHistory as string[]) || [],
    documents: ((doc.documents as Record<string, unknown>[]) || []).map((d) => ({ id: uid("vdoc"), category: String(d.type || "Other"), fileName: String(d.fileName || ""), dataUrl: d.url ? String(d.url) : undefined })),
  };
}

function vehicleToApiPayload(item: Vehicle) {
  return {
    number: item.number, model: item.model, type: item.type, capacity: item.capacity,
    chassisNumber: item.chassisNumber, engineNumber: item.engineNumber, ownerName: item.ownerName, ownerPhone: item.ownerPhone,
    registrationDate: item.registrationDate || undefined, status: item.status,
    rcExpiry: item.rcExpiry || undefined, insuranceExpiry: item.insuranceExpiry || undefined,
    permitExpiry: item.permitExpiry || undefined, fitnessExpiry: item.fitnessExpiry || undefined, pucExpiry: item.pucExpiry || undefined,
    currentDriver: isMongoId(item.currentDriverId) ? item.currentDriverId : undefined,
    driverHistory: (item.driverHistory ?? []).map((entry) => ({ driver: isMongoId(entry.driverId) ? entry.driverId : undefined, driverName: entry.driverName, assignedAt: entry.assignedAt || undefined, endedAt: entry.endedAt || undefined, reason: entry.reason })),
    documents: (item.documents ?? []).map((d) => ({ type: d.category, fileName: d.fileName, url: d.dataUrl })),
  };
}

function mapDriverFromApi(doc: Record<string, unknown>): Driver {
  return {
    id: String(doc._id),
    name: String(doc.name || ""),
    phone: String(doc.phone || ""),
    license: String(doc.license || ""),
    licenseExpiry: doc.licenseExpiry ? String(doc.licenseExpiry).slice(0, 10) : "",
    aadhaar: String(doc.aadhaar || ""),
    pan: String(doc.pan || ""),
    status: (doc.status as Driver["status"]) || "Active",
    salary: Number(doc.salary || 0),
    address: doc.address ? String(doc.address) : undefined,
    emergencyContact: doc.emergencyContact ? String(doc.emergencyContact) : undefined,
    joiningDate: doc.joiningDate ? String(doc.joiningDate).slice(0, 10) : undefined,
    assignedVehicleId: doc.assignedVehicle ? String((doc.assignedVehicle as Record<string, unknown>)?._id ?? doc.assignedVehicle) : undefined,
    earnings: Number(doc.earnings || 0),
    paymentHistory: [],
    documents: ((doc.documents as Record<string, unknown>[]) || []).map((d) => ({ id: uid("doc"), category: (String(d.type || "Other") as DriverDocument["category"]), fileName: String(d.fileName || ""), dataUrl: d.url ? String(d.url) : undefined })),
  };
}

function driverToApiPayload(item: Driver) {
  return {
    name: item.name, phone: item.phone, license: item.license, licenseExpiry: item.licenseExpiry || undefined,
    aadhaar: item.aadhaar, pan: item.pan, address: item.address, emergencyContact: item.emergencyContact,
    joiningDate: item.joiningDate || undefined, assignedVehicle: isMongoId(item.assignedVehicleId) ? item.assignedVehicleId : undefined, salary: item.salary, status: item.status,
    documents: (item.documents ?? []).map((d) => ({ type: d.category, fileName: d.fileName, url: d.dataUrl })),
  };
}

// ---- Generic API-backed persistence helpers (all remaining modules) ----
const isMongoId = (id?: string) => !!id && /^[0-9a-f]{24}$/i.test(id);
const nextDocumentNumber = (values: Array<string | undefined>) => String(Math.max(0, ...values.map((value) => Number.parseInt(String(value || ""), 10)).filter(Number.isFinite)) + 1);

function mapCustomerFromApi(doc: Record<string, unknown>): Customer {
  return { id: String(doc._id), company: String(doc.company || ""), contact: String(doc.contact || ""), phone: String(doc.phone || ""), email: String(doc.email || ""), gst: String(doc.gst || ""), address: String(doc.address || ""), creditLimit: Number(doc.creditLimit || 0) };
}
function customerToApiPayload(item: Customer) {
  return { company: item.company, contact: item.contact, phone: item.phone, email: item.email, gst: item.gst, address: item.address, creditLimit: item.creditLimit ?? 0 };
}

function mapTripFromApi(doc: Record<string, unknown>): Trip {
  return {
    id: String(doc._id), customerId: String((doc.customer as Record<string, unknown>)?._id ?? doc.customer ?? ""), vehicleId: String((doc.vehicle as Record<string, unknown>)?._id ?? doc.vehicle ?? ""), driverId: String((doc.driver as Record<string, unknown>)?._id ?? doc.driver ?? ""),
    pickup: String(doc.pickup || ""), drop: String(doc.drop || ""), cargo: String(doc.cargo || ""), date: String(doc.date || "").slice(0, 10),
    distanceKm: Number(doc.distanceKm || 0), durationHrs: Number(doc.durationHrs || 0), freight: Number(doc.freight || 0), status: (doc.status as TripStatus) || "Assigned",
    lrNumber: doc.lrNumber ? String(doc.lrNumber) : undefined, cargoName: doc.cargoName ? String(doc.cargoName) : undefined, materialType: doc.materialType ? String(doc.materialType) : undefined,
    weight: doc.weight ? String(doc.weight) : undefined, quantity: doc.quantity ? String(doc.quantity) : undefined, endDate: doc.endDate ? String(doc.endDate).slice(0, 10) : undefined,
    advanceAmount: Number(doc.advanceAmount || 0), advances: ((doc.advances as Record<string, unknown>[]) || []).map((entry) => ({ date: String(entry.date || "").slice(0, 10), mode: String(entry.mode || entry.note || "Cash"), amount: Number(entry.amount || 0) })), manualVehicleNumber: doc.manualVehicleNumber ? String(doc.manualVehicleNumber) : undefined, tollCharges: Number(doc.tollCharges || 0), driverAllowance: Number(doc.driverAllowance || 0), otherExpenses: Number(doc.otherExpenses || 0),
    invoiceNumber: doc.invoiceNumber ? String(doc.invoiceNumber) : undefined, paymentStatus: (doc.paymentStatus as PaymentStatus) || "Pending",
    ewayBill: doc.ewayBill ? String(doc.ewayBill) : undefined, deliveryReceipt: doc.deliveryReceipt ? String(doc.deliveryReceipt) : undefined,
    size: doc.size ? String(doc.size) : undefined, billNo: doc.billNo ? String(doc.billNo) : undefined, chNo: doc.chNo ? String(doc.chNo) : undefined,
    receivedDate: doc.receivedDate ? String(doc.receivedDate).slice(0, 10) : undefined,
    otherChargesReason: doc.otherChargesReason ? String(doc.otherChargesReason) : undefined,
    expenseRemarks: ((doc.expenseRemarks as Record<string, unknown>[]) || []).map((entry) => ({ category: String(entry.category || "Other"), amount: Number(entry.amount || 0), remark: String(entry.remark || "") })),
    podDocs: ((doc.podDocs as Record<string, unknown>[]) || []).map((d) => String(d.url || d.fileName || "")).filter(Boolean), remarks: doc.remarks ? String(doc.remarks) : undefined,
  };
}
function tripToApiPayload(item: Trip) {
  return {
    customer: isMongoId(item.customerId) ? item.customerId : undefined, vehicle: isMongoId(item.vehicleId) ? item.vehicleId : undefined, driver: isMongoId(item.driverId) ? item.driverId : undefined,
    pickup: item.pickup, drop: item.drop, lrNumber: item.lrNumber, cargoName: item.cargoName, materialType: item.materialType, weight: item.weight, quantity: item.quantity, cargo: item.cargo,
    date: item.date || undefined, endDate: item.endDate || undefined, distanceKm: item.distanceKm, durationHrs: item.durationHrs, freight: item.freight, advanceAmount: item.advanceAmount, advances: item.advances || [], manualVehicleNumber: item.manualVehicleNumber || undefined,
    tollCharges: item.tollCharges, driverAllowance: item.driverAllowance, otherExpenses: item.otherExpenses, invoiceNumber: item.invoiceNumber, paymentStatus: item.paymentStatus,
    ewayBill: item.ewayBill, deliveryReceipt: item.deliveryReceipt, status: item.status, remarks: item.remarks,
    size: item.size, billNo: item.billNo, chNo: item.chNo, receivedDate: item.receivedDate || undefined,
    otherChargesReason: item.otherChargesReason, expenseRemarks: item.expenseRemarks || [],
  };
}

function mapExpenseFromApi(doc: Record<string, unknown>): Expense {
  return { id: String(doc._id), tripId: doc.trip ? String((doc.trip as Record<string, unknown>)?._id ?? doc.trip) : undefined, vehicleId: doc.vehicle ? String((doc.vehicle as Record<string, unknown>)?._id ?? doc.vehicle) : undefined, driverId: doc.driver ? String((doc.driver as Record<string, unknown>)?._id ?? doc.driver) : undefined, category: (doc.category as Expense["category"]) || "Other", amount: Number(doc.amount || 0), date: String(doc.date || "").slice(0, 10), note: String(doc.note || ""), liters: doc.liters ? Number(doc.liters) : undefined, mileage: doc.mileage ? Number(doc.mileage) : undefined };
}
function expenseToApiPayload(item: Expense) {
  return { trip: isMongoId(item.tripId) ? item.tripId : undefined, vehicle: isMongoId(item.vehicleId) ? item.vehicleId : undefined, driver: isMongoId(item.driverId) ? item.driverId : undefined, category: item.category, amount: item.amount, date: item.date || undefined, note: item.note, liters: item.liters ?? 0, mileage: item.mileage ?? 0 };
}

function mapCompanyExpenseFromApi(doc: Record<string, unknown>): CompanyExpense {
  return { id: String(doc._id), name: String(doc.name || ""), amount: Number(doc.amount || 0), date: String(doc.date || "").slice(0, 10), note: String(doc.note || ""), type: "Expense", reminderDate: "", status: "Paid" };
}
function companyExpenseToApiPayload(item: CompanyExpense) {
  return { name: item.name, amount: item.amount, date: item.date || undefined, note: item.note };
}
function mapEmiReminderFromApi(doc: Record<string, unknown>): EmiReminder {
  return { id: String(doc._id), name: String(doc.name || ""), amount: Number(doc.amount || 0), dueDay: Number(doc.dueDay || 1), tenureMonths: Number(doc.tenureMonths || 1), startDate: String(doc.startDate || "").slice(0, 10), note: String(doc.note || ""), status: doc.status === "Closed" ? "Closed" : "Active", paidMonths: Array.isArray(doc.paidMonths) ? doc.paidMonths.map(String) : [] };
}
function emiReminderToApiPayload(item: EmiReminder) {
  return { name: item.name, amount: item.amount, dueDay: item.dueDay, tenureMonths: item.tenureMonths, startDate: item.startDate || undefined, note: item.note, status: item.status, paidMonths: item.paidMonths };
}

function mapInvoiceFromApi(doc: Record<string, unknown>): Invoice {
  return { id: String(doc._id), tripId: String((doc.trip as Record<string, unknown>)?._id ?? doc.trip ?? ""), customerId: String((doc.customer as Record<string, unknown>)?._id ?? doc.customer ?? ""), status: (doc.status as PaymentStatus) || "Pending", dueDate: doc.dueDate ? String(doc.dueDate).slice(0, 10) : "", paidAt: doc.paidAt ? String(doc.paidAt).slice(0, 10) : undefined, total: Number(doc.total || 0), paidAmount: Number(doc.paidAmount || 0), invoiceNo: doc.invoiceNo ? String(doc.invoiceNo) : undefined, billingDate: doc.billingDate ? String(doc.billingDate).slice(0, 10) : undefined, additionalCharges: Number(doc.additionalCharges || 0), discount: Number(doc.discount || 0), gst: Number(doc.gstAmount || 0), finalAmount: Number(doc.total || 0), paymentMode: doc.paymentMode ? String(doc.paymentMode) : undefined };
}
function invoiceToApiPayload(item: Invoice) {
  return { trip: isMongoId(item.tripId) ? item.tripId : undefined, customer: isMongoId(item.customerId) ? item.customerId : undefined, status: item.status, dueDate: item.dueDate || undefined, paidAt: item.paidAt || undefined, total: item.total ?? item.finalAmount ?? 0, paidAmount: item.paidAmount ?? 0, invoiceNo: item.invoiceNo, billingDate: item.billingDate || undefined, additionalCharges: item.additionalCharges ?? 0, discount: item.discount ?? 0, paymentMode: item.paymentMode };
}

function mapPaymentFromApi(doc: Record<string, unknown>): Payment {
  return { id: String(doc._id), invoiceId: String((doc.invoice as Record<string, unknown>)?._id ?? doc.invoice ?? ""), customerId: String((doc.customer as Record<string, unknown>)?._id ?? doc.customer ?? ""), amount: Number(doc.amount || 0), method: String(doc.method || ""), reference: String(doc.reference || ""), paidAt: doc.paidAt ? String(doc.paidAt).slice(0, 10) : "" };
}
function paymentToApiPayload(item: Payment) {
  return { invoice: isMongoId(item.invoiceId) ? item.invoiceId : undefined, customer: isMongoId(item.customerId) ? item.customerId : undefined, amount: item.amount, method: item.method, reference: item.reference, paidAt: item.paidAt || undefined };
}

function mapMaintenanceFromApi(doc: Record<string, unknown>): MaintenanceRecord {
  return { id: String(doc._id), vehicleId: String((doc.vehicle as Record<string, unknown>)?._id ?? doc.vehicle ?? ""), serviceType: String(doc.serviceType || ""), serviceCost: Number(doc.serviceCost || 0), workshop: String(doc.workshop || ""), mechanic: String(doc.mechanic || ""), partsUsed: String(doc.partsUsed || ""), serviceIntervalKm: Number(doc.serviceIntervalKm || 0), mileageReminderKm: Number(doc.mileageReminderKm || 0), dueDate: doc.dueDate ? String(doc.dueDate).slice(0, 10) : "", status: (doc.status as MaintenanceRecord["status"]) || "Upcoming" };
}
function maintenanceToApiPayload(item: MaintenanceRecord) {
  return { vehicle: isMongoId(item.vehicleId) ? item.vehicleId : undefined, serviceType: item.serviceType, serviceCost: item.serviceCost, workshop: item.workshop, mechanic: item.mechanic, partsUsed: item.partsUsed, serviceIntervalKm: item.serviceIntervalKm, mileageReminderKm: item.mileageReminderKm, dueDate: item.dueDate || undefined, status: item.status };
}

function mapDocumentFromApi(doc: Record<string, unknown>): DocumentRecord {
  const vehicle = doc.vehicle as Record<string, unknown> | undefined;
  const driver = doc.driver as Record<string, unknown> | undefined;
  const ownerType = doc.ownerType === "Driver" ? "Driver" : "Vehicle";
  const owner = ownerType === "Driver" ? driver : vehicle;
  const file = (doc.file as Record<string, unknown>) || {};
  return {
    id: String(doc._id), ownerType,
    ownerId: String(owner?._id ?? (ownerType === "Driver" ? doc.driver : doc.vehicle) ?? ""),
    ownerName: String(ownerType === "Driver" ? owner?.name ?? "" : owner?.number ?? ""),
    type: String(doc.type || "Document"), documentNumber: String(doc.documentNumber || ""),
    issueDate: doc.issueDate ? String(doc.issueDate).slice(0, 10) : "",
    expiryDate: doc.expiryDate ? String(doc.expiryDate).slice(0, 10) : "",
    status: (doc.status as DocumentRecord["status"]) || "Valid",
    fileName: String(file.fileName || ""), dataUrl: file.url ? String(file.url) : undefined,
  };
}

function mapBalanceFreightFromApi(doc: Record<string, unknown>): BalanceFreightRecord {
  const freight = Number(doc.freight || 0);
  // Legacy rows may have only a commission amount.  Derive its historical
  // percentage once for display, but never substitute a hard-coded default.
  const commissionPercent = doc.commissionPercent === undefined || doc.commissionPercent === null
    ? (freight ? (Number(doc.commission || 0) / freight) * 100 : 0)
    : Number(doc.commissionPercent || 0);
  return {
    id: String(doc._id), loadingDate: doc.loadingDate ? String(doc.loadingDate).slice(0, 10) : "", vehicleNumber: String(doc.vehicleNumber || ""), from: String(doc.from || ""), to: String(doc.to || ""),
    freight, advance: Number(doc.advance || 0), commission: Number(doc.commission || 0), commissionPercent, otherCharges: Number(doc.otherCharges || 0), hamali: Number(doc.hamali || 0),
    payCharge: Number(doc.payCharge || 0), balance: Number(doc.balance || 0), partyName: String(doc.partyName || ""), paidAmount: Number(doc.advance || 0), chequeNeftNumber: String(doc.chequeNeftNumber || ""),
    bank: String(doc.bank || ""), paymentDate: doc.paymentDate ? String(doc.paymentDate).slice(0, 10) : "", remarks: String(doc.remarks || ""), status: (doc.status as BalanceFreightRecord["status"]) || "Pending",
    freightId: doc.freightId ? String(doc.freightId) : undefined, billNo: doc.billNo ? String(doc.billNo) : undefined, challanNo: doc.challanNo ? String(doc.challanNo) : undefined,
    ownerName: doc.ownerName ? String(doc.ownerName) : undefined, cnNo: doc.cnNo ? String(doc.cnNo) : undefined, size: doc.size ? String(doc.size) : undefined, weight: doc.weight ? String(doc.weight) : undefined, rate: Number(doc.rate || 0),
    advances: ((doc.advances as Record<string, unknown>[]) || []).map((entry) => ({ date: String(entry.date || "").slice(0, 10), amount: Number(entry.amount || 0), mode: String(entry.mode || entry.note || "Cash") })), linkedTrips: (doc.linkedTrips as string[]) || [], invoiceNumber: doc.invoiceNumber ? String(doc.invoiceNumber) : undefined,
    billingDate: doc.billingDate ? String(doc.billingDate).slice(0, 10) : undefined, additionalCharges: Number(doc.additionalCharges || 0), discount: Number(doc.discount || 0), gst: Number(doc.gst || 0),
    finalAmount: Number(doc.finalAmount || 0), dueDate: doc.dueDate ? String(doc.dueDate).slice(0, 10) : undefined, paymentMode: doc.paymentMode ? String(doc.paymentMode) : undefined,
    partyAdvance: Number(doc.partyAdvance ?? doc.advance ?? 0), advanceBalance: Number(doc.advanceBalance ?? 0),
    otherChargesReason: String(doc.otherChargesReason || ""), extraHeight: Number(doc.extraHeight || 0), weightRecipt: Number(doc.weightRecipt || 0), paymentChg: Number(doc.paymentChg || 0),
    challanFineChg: Number(doc.challanFineChg || 0), unlodingChg: Number(doc.unlodingChg || 0), extraWeightChg: Number(doc.extraWeightChg || 0), extraWidthChg: Number(doc.extraWidthChg || 0),
    balancePaymentDate: doc.balancePaymentDate ? String(doc.balancePaymentDate).slice(0, 10) : undefined,
  };
}
function balanceFreightToApiPayload(item: BalanceFreightRecord) {
  return {
    freightId: item.freightId, billNo: item.billNo, challanNo: item.challanNo, ownerName: item.ownerName, cnNo: item.cnNo, size: item.size, weight: item.weight, rate: item.rate ?? 0,
    advances: item.advances ?? [], linkedTrips: item.linkedTrips ?? [], invoiceNumber: item.invoiceNumber, billingDate: item.billingDate || undefined, loadingDate: item.loadingDate || undefined,
    vehicleNumber: item.vehicleNumber, from: item.from, to: item.to, freight: item.freight, additionalCharges: item.additionalCharges ?? 0, discount: item.discount ?? 0, gst: item.gst ?? 0,
    finalAmount: item.finalAmount ?? 0, advance: item.advance, partyAdvance: item.partyAdvance ?? item.advance, advanceBalance: item.advanceBalance ?? 0,
    commissionPercent: item.commissionPercent ?? 0, commission: item.commission, otherCharges: item.otherCharges, otherChargesReason: item.otherChargesReason ?? "", hamali: item.hamali, payCharge: item.payCharge,
    extraHeight: item.extraHeight ?? 0, weightRecipt: item.weightRecipt ?? 0, paymentChg: item.paymentChg ?? 0, challanFineChg: item.challanFineChg ?? 0,
    unlodingChg: item.unlodingChg ?? 0, extraWeightChg: item.extraWeightChg ?? 0, extraWidthChg: item.extraWidthChg ?? 0, balancePaymentDate: item.balancePaymentDate || undefined, partyName: item.partyName,
    chequeNeftNumber: item.chequeNeftNumber, bank: item.bank, dueDate: item.dueDate || undefined, paymentMode: item.paymentMode, paymentDate: item.paymentDate || undefined, remarks: item.remarks, status: item.status,
  };
}

function mapAttendanceFromApi(doc: Record<string, unknown>): AttendanceRecord {
  return { id: String(doc._id), driverId: String((doc.driver as Record<string, unknown>)?._id ?? doc.driver ?? ""), date: String(doc.date || "").slice(0, 10), month: String(doc.month || ""), status: ((doc.status === "Present" ? "Present" : "Absent") as AttendanceRecord["status"]), notes: String(doc.notes || "") };
}
function attendanceToApiPayload(item: AttendanceRecord) {
  return { driver: isMongoId(item.driverId) ? item.driverId : undefined, date: item.date || undefined, month: item.month, status: item.status, notes: item.notes };
}

function mapPayrollFromApi(doc: Record<string, unknown>): PayrollRecord {
  return { id: String(doc._id), driverId: String((doc.driver as Record<string, unknown>)?._id ?? doc.driver ?? ""), month: String(doc.month || ""), baseSalary: Number(doc.baseSalary || 0), presentDays: Number(doc.presentDays || 0), halfDays: Number(doc.halfDays || 0), leave: Number(doc.leave || 0), incentive: Number(doc.overtime || 0), bonus: Number(doc.bonus || 0), penalty: Number(doc.penalty || 0), advance: Number(doc.advance || 0), advanceReason: "", netSalary: Number(doc.netSalary || 0) };
}
function payrollToApiPayload(item: PayrollRecord) {
  return { driver: isMongoId(item.driverId) ? item.driverId : undefined, month: item.month, baseSalary: item.baseSalary, presentDays: item.presentDays, halfDays: item.halfDays, leave: item.leave, overtime: item.incentive, bonus: item.bonus, penalty: item.penalty, advance: item.advance };
}
type View =
  | "dashboard" | "vehicles" | "drivers" | "customers" | "trips" | "expenses" | "fuel"
  | "maintenance" | "documents" | "salary" | "invoices" | "payments" | "reports" | "analytics" | "performance"
  | "notifications" | "settings" | "profile" | "balanceFreight" | "attendance" | "payroll"
  | "liveTracking" | "vehicleHealth" | "billing" | "api" | "users" | "roles" | "company"
  | "tripReport" | "freightReport" | "companyExpenses" | "emiReminders";
type Status = "Available" | "On Trip" | "Under Maintenance";
type TripStatus = "Draft" | "Assigned" | "In Transit" | "Completed" | "Cancelled";
type PaymentStatus = "Paid" | "Partial" | "Pending" | "Overdue";

type VehicleDocument = { id: string; category: string; fileName: string; dataUrl?: string };
type Vehicle = {
  id: string; number: string; model: string; status: Status; capacity: string;
  rcExpiry: string; insuranceExpiry: string; permitExpiry: string; pucExpiry: string;
  documents: VehicleDocument[];
  type?: string; chassisNumber?: string; engineNumber?: string; ownerName?: string; ownerPhone?: string; registrationDate?: string; fitnessExpiry?: string;
  currentDriverId?: string; driverHistory?: DriverAssignment[];
  billingHistory?: string[]; documentHistory?: string[];
  telemetry?: VehicleTelemetry;
};
type DriverAssignment = { driverId: string; driverName: string; vehicleId: string; vehicleNumber: string; assignedAt: string; endedAt?: string; reason?: string };
type VehicleTelemetry = {
  speed: number; fuelLevel: number; batteryVoltage: number; gpsSignal: number; ignition: "ON" | "OFF";
  latitude: string; longitude: string; location: string; lastUpdated: string; eta: string; odometerKm: number;
  distanceTodayKm: number; engineHealth: "Good" | "Warning" | "Critical"; oilHealth: number; tyrePressure: string;
  apiSync: "Connected" | "Delayed" | "Offline"; harshEvents: number;
};
type DocumentRecord = {
  id: string; ownerType: "Vehicle" | "Driver"; ownerId: string; ownerName: string; type: string;
  documentNumber: string; issueDate: string; expiryDate: string; status: "Valid" | "Due 90" | "Due 60" | "Due 30" | "Due 15" | "Due 7" | "Expired"; fileName: string; dataUrl?: string;
};
type DriverDocument = { id: string; category: "License" | "Aadhaar" | "PAN" | "Other"; fileName: string; dataUrl?: string };
type DriverPayment = { id: string; driverId: string; month: string; amount: number; method: string; status: PaymentStatus; paidAt: string; notes?: string };
type Driver = {
  id: string; name: string; phone: string; license: string; licenseExpiry: string;
  aadhaar: string; pan: string; status: "Active" | "On Trip" | "Off Duty"; salary: number;
  address?: string; emergencyContact?: string; joiningDate?: string; assignedVehicleId?: string; earnings?: number; paymentHistory?: DriverPayment[];
  documents: DriverDocument[];
};
type Customer = {
  id: string; company: string; contact: string; phone: string; email: string; gst: string; address: string;
  creditLimit?: number;
};
type TripExpenseRemark = { category: string; amount: number; remark: string };
const parseTripExpenseRemarks = (value?: string): TripExpenseRemark[] => {
  try {
    const rows = JSON.parse(value || "[]");
    return Array.isArray(rows) ? rows
      .map((row) => ({ category: String(row?.category || "").trim(), amount: Number(row?.amount || 0), remark: String(row?.remark || "").trim() }))
      .filter((row) => row.category && (row.amount > 0 || row.remark))
      : [];
  } catch { return []; }
};
type Trip = {
  id: string; customerId: string; vehicleId: string; driverId: string; pickup: string; drop: string;
  cargo: string; date: string; distanceKm: number; durationHrs: number; freight: number; status: TripStatus;
  lrNumber?: string; cargoName?: string; materialType?: string; weight?: string; quantity?: string; endDate?: string;
  advanceAmount?: number; advances?: AdvanceEntry[]; manualVehicleNumber?: string; tollCharges?: number; driverAllowance?: number; otherExpenses?: number; otherChargesReason?: string; expenseRemarks?: TripExpenseRemark[]; invoiceNumber?: string; paymentStatus?: PaymentStatus;
  ewayBill?: string; deliveryReceipt?: string;
  size?: string; billNo?: string; chNo?: string; receivedDate?: string;
  podDocs: string[]; remarks?: string;
};
type TelemetryLogEntry = { time: string; speed: number; fuelLevel: number; ignition: "ON" | "OFF"; location: string };
type StopEvent = { location: string; start: string; end: string | null; ticks: number };
type Expense = {
  id: string; tripId?: string; category: string;
  amount: number; date: string; note: string; vehicleId?: string; driverId?: string; liters?: number; mileage?: number;
};
type CompanyExpense = {
  id: string; name: string; amount: number; date: string; note: string;
  // Legacy UI fields are retained during this release so existing locally-open
  // modals do not break. The database model contains company expenses only.
  type: "Expense" | "EMI"; reminderDate: string; status: "Pending" | "Paid";
};
type EmiReminder = { id: string; name: string; amount: number; dueDay: number; tenureMonths: number; startDate: string; note: string; status: "Active" | "Closed"; paidMonths: string[] };
type Invoice = {
  id: string; tripId: string; customerId: string; status: PaymentStatus; dueDate: string; paidAt?: string; total?: number; paidAmount?: number;
  invoiceNo?: string; billingDate?: string; additionalCharges?: number; discount?: number; gst?: number; finalAmount?: number; paymentMode?: string; receiptFile?: string;
};
type Payment = { id: string; invoiceId: string; customerId: string; amount: number; method: string; reference: string; paidAt: string };
type AdvanceEntry = { date: string; mode: string; amount: number };
type BalanceFreightRecord = {
  id: string; loadingDate: string; vehicleNumber: string; from: string; to: string; freight: number; advance: number;
  commission: number; otherCharges: number; hamali: number; payCharge: number; balance: number; partyName: string;
  paidAmount: number; chequeNeftNumber: string; bank: string; paymentDate: string; remarks: string; status: "Pending" | "Partially Paid" | "Paid" | "Cancelled";
  freightId?: string; linkedTrips?: string[]; invoiceNumber?: string; billingDate?: string; additionalCharges?: number; discount?: number; gst?: number; finalAmount?: number; dueDate?: string; paymentMode?: string;
  size?: string; partyAdvance?: number; advanceBalance?: number; commissionPercent?: number; otherChargesReason?: string; billNo?: string;
  challanNo?: string; ownerName?: string; cnNo?: string; weight?: string; rate?: number; advances?: AdvanceEntry[];
  extraHeight?: number; weightRecipt?: number; paymentChg?: number; challanFineChg?: number; unlodingChg?: number; extraWeightChg?: number; extraWidthChg?: number; balancePaymentDate?: string;
};
type AttendanceRecord = { id: string; driverId: string; date: string; month: string; status: "Present" | "Absent"; notes: string };
type PayrollRecord = {
  id: string; driverId: string; month: string; baseSalary: number; presentDays: number; halfDays: number; leave: number;
  incentive: number; bonus: number; penalty: number; advance: number; advanceReason: string; netSalary: number;
};
type MaintenanceRecord = {
  id: string; vehicleId: string; serviceType: string; serviceCost: number; workshop: string; mechanic: string;
  partsUsed: string; serviceIntervalKm: number; mileageReminderKm: number; dueDate: string; status: "Upcoming" | "Due" | "Completed";
};
type Notification = { id: string; type: string; title: string; message: string; read: boolean; createdAt: string };
type ApiConfig = {
  baseUrl: string; environment: string; apiToken: string; orgId: string; liveLocationEndpoint: string;
  fuelStatusEndpoint: string; vehicleMappingKey: string; pollingInterval: string; webhookUrl: string; timeoutMs: string;
  syncLiveLocation: boolean; syncFuelLevel: boolean; syncIgnitionGps: boolean; connected: boolean; lastSynced: string;
};
type CompanyProfile = {
  name: string; gst: string; phone: string; address: string;
  tagline?: string; phone2?: string; email?: string; jurisdiction?: string;
  pan?: string; bankName?: string; bankBranch?: string; bankAccount?: string; bankIfsc?: string;
};

const glass = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: "0 12px 30px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.04)",
};
const glassSubtle = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

// ISO date for form defaults, using the user's local calendar day.
const today = (() => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
})();
const rupees = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
function amountInWords(amount: number): string {
  const num = Math.max(0, Math.round(amount || 0));
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function two(n: number): string { if (n < 20) return ones[n]; return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`; }
  function three(n: number): string { if (n >= 100) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " + two(n % 100) : ""}`; return two(n); }
  function inWords(n: number): string {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const rest = n;
    const parts: string[] = [];
    if (crore) parts.push(`${three(crore)} Crore`);
    if (lakh) parts.push(`${three(lakh)} Lakh`);
    if (thousand) parts.push(`${three(thousand)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
  }
  return `${inWords(num)} And Zero Paise Only`;
}
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - new Date(today).getTime()) / 86400000);
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const monthKey = (date: string) => date.slice(0, 7);
const daysInMonth = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
const tripExpensesTotal = (trip: Trip, expenses: Expense[] = []) =>
  expenses.filter((e) => e.tripId === trip.id).reduce((s, e) => s + e.amount, 0) + (trip.tollCharges ?? 0) + (trip.driverAllowance ?? 0) + (trip.otherExpenses ?? 0);
const tripProfit = (trip: Trip, expenses: Expense[] = []) => trip.freight - tripExpensesTotal(trip, expenses);
const routeByView: Record<View, string> = {
  dashboard: "/dashboard",
  vehicles: "/fleet/vehicles",
  liveTracking: "/fleet/live-tracking",
  trips: "/fleet/trips",
  tripReport: "/fleet/trips/report",
  drivers: "/fleet/drivers",
  customers: "/operations/customers",
  documents: "/operations/documents",
  notifications: "/operations/alerts",
  maintenance: "/maintenance/service",
  fuel: "/maintenance/fuel",
  vehicleHealth: "/maintenance/vehicle-health",
  expenses: "/finance/expenses",
  companyExpenses: "/finance/company-expenses",
  emiReminders: "/finance/emi-reminders",
  balanceFreight: "/finance/freight",
  freightReport: "/finance/freight/report",
  billing: "/finance/billing",
  invoices: "/finance/billing",
  payments: "/finance/billing",
  attendance: "/hr/attendance",
  salary: "/hr/salary",
  payroll: "/hr/salary",
  reports: "/reports",
  analytics: "/reports",
  performance: "/fleet/drivers",
  settings: "/settings/company",
  api: "/settings/api",
  users: "/settings/users",
  roles: "/settings/roles",
  company: "/settings/company",
  profile: "/settings/users",
};
const viewByRoute = Object.entries(routeByView).reduce((acc, [view, route]) => ({ ...acc, [route]: view as View }), {} as Record<string, View>);
const removedPortalRoutes = new Set(["/fleet/live-tracking", "/maintenance/vehicle-health", "/finance/billing"]);
const removedPortalViews = new Set<View>(["liveTracking", "vehicleHealth", "billing", "invoices", "payments"]);
const viewFromPath = (path: string): View => removedPortalRoutes.has(path) ? "dashboard" : (viewByRoute[path] ?? "dashboard");
const defaultTelemetry = (vehicle?: Partial<Vehicle>): VehicleTelemetry => ({
  // A vehicle has no live telemetry until a real tracker/API sends it.
  // Never manufacture locations, fuel, speeds, or tracker status in the UI.
  speed: 0,
  fuelLevel: 0,
  batteryVoltage: 0,
  gpsSignal: 0,
  ignition: "OFF",
  latitude: "",
  longitude: "",
  location: "No live location",
  lastUpdated: "No live data",
  eta: "-",
  odometerKm: 0,
  distanceTodayKm: 0,
  engineHealth: "No data",
  oilHealth: 0,
  tyrePressure: "No data",
  apiSync: "Not connected",
  harshEvents: 0,
});
const telemetryOf = (vehicle: Vehicle) => vehicle.telemetry ?? defaultTelemetry(vehicle);
const nowClock = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
function simulateVehicleTelemetry(vehicle: Vehicle): Vehicle {
  const t = telemetryOf(vehicle);
  if (vehicle.status !== "On Trip") {
    // Parked or under-maintenance vehicles: engine off, stationary, no fuel burn.
    return { ...vehicle, telemetry: { ...t, ignition: "OFF", speed: 0, lastUpdated: nowClock() } };
  }
  const moving = Math.random() > 0.2;
  const nextSpeed = moving ? Math.max(18, Math.min(88, Math.round(t.speed + (Math.random() * 24 - 10)) || 45)) : 0;
  const distanceDeltaKm = nextSpeed > 0 ? Math.round(nextSpeed * (4 / 3600) * 10) / 10 : 0;
  const fuelBurn = distanceDeltaKm * 0.06;
  const fuelLevel = Math.max(4, Math.round((t.fuelLevel - fuelBurn) * 10) / 10);
  const gpsSignal = Math.max(2, Math.min(5, t.gpsSignal + (Math.random() > 0.5 ? 1 : -1)));
  return {
    ...vehicle,
    telemetry: {
      ...t,
      speed: nextSpeed,
      ignition: "ON",
      fuelLevel,
      distanceTodayKm: Math.round((t.distanceTodayKm + distanceDeltaKm) * 10) / 10,
      odometerKm: t.odometerKm + Math.round(distanceDeltaKm),
      lastUpdated: nowClock(),
      gpsSignal,
      apiSync: fuelLevel < 10 ? "Delayed" : "Connected",
    },
  };
}
function computeStops(log: TelemetryLogEntry[]): StopEvent[] {
  const stops: StopEvent[] = [];
  let current: StopEvent | null = null;
  log.forEach((entry) => {
    if (entry.speed === 0 && entry.ignition === "ON") {
      if (!current) { current = { location: entry.location, start: entry.time, end: entry.time, ticks: 1 }; stops.push(current); }
      else { current.end = entry.time; current.ticks += 1; }
    } else {
      current = null;
    }
  });
  return stops;
}
function computeIgnitionEvents(log: TelemetryLogEntry[]): { time: string; state: "ON" | "OFF" }[] {
  const events: { time: string; state: "ON" | "OFF" }[] = [];
  let last: "ON" | "OFF" | null = null;
  log.forEach((entry) => {
    if (entry.ignition !== last) { events.push({ time: entry.time, state: entry.ignition }); last = entry.ignition; }
  });
  return events;
}
const vehicleHealthScore = (vehicle: Vehicle, service?: MaintenanceRecord, docDue = 0) => {
  const telemetry = telemetryOf(vehicle);
  return Math.max(35, Math.min(99, 96 - (vehicle.status === "Under Maintenance" ? 24 : 0) - docDue * 8 - (service?.status === "Due" ? 14 : 0) - (telemetry.engineHealth === "Warning" ? 12 : telemetry.engineHealth === "Critical" ? 32 : 0) - (telemetry.batteryVoltage < 11.5 ? 8 : 0) - (telemetry.fuelLevel < 25 ? 4 : 0)));
};
const calculateBalanceFreight = (record: Omit<BalanceFreightRecord, "balance" | "status"> & { status?: BalanceFreightRecord["status"] }): BalanceFreightRecord => {
  const commissionPercent = Number(record.commissionPercent ?? 0);
  const commission = Math.round((record.freight * commissionPercent) / 100);
  const advances = record.advances ?? [];
  const advancesTotal = advances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const partyAdvance = advances.length ? advancesTotal : (record.partyAdvance ?? record.advance ?? 0);
  // Balance Advance is a separate challan field and is deliberately not
  // folded into the final-balance calculation.
  const advanceBalance = Number(record.advanceBalance ?? 0);
  const deductions = commission + (record.hamali || 0) + (record.paymentChg || 0);
  const additions = (record.payCharge || 0) + (record.extraHeight || 0) + (record.extraWidthChg || 0)
    + (record.extraWeightChg || 0) + (record.weightRecipt || 0) + (record.unlodingChg || 0)
    + (record.challanFineChg || 0) + (record.otherCharges || 0);
  // The original challan calls the net of additions and deductions "Extra".
  // It is intentionally signed: a net deduction is a negative Extra value.
  const extra = additions - deductions;
  const payable = record.freight - partyAdvance + extra;
  const status = record.status || (partyAdvance > 0 ? "Partially Paid" : "Pending");
  const paidAmount = partyAdvance;
  return { ...record, advances, advance: partyAdvance, partyAdvance, advanceBalance, commission, commissionPercent, paidAmount, balance: payable, status };
};

const seedVehicles: Vehicle[] = [
  { id: "veh-1", number: "MH12AB1234", model: "Tata Prima 4028.S", type: "Trailer", chassisNumber: "MAT4488126A123456", engineNumber: "ENG4028S7788", ownerName: "Sharma Roadlines", ownerPhone: "+91 90000 11111", registrationDate: "2021-09-30", currentDriverId: "drv-1", driverHistory: [{ driverId: "drv-1", driverName: "Ramesh Kumar", vehicleId: "veh-1", vehicleNumber: "MH12AB1234", assignedAt: "2026-06-15", reason: "Regular duty" }], billingHistory: ["INV-2026-0087"], documentHistory: ["RC.pdf", "Insurance.pdf"], status: "Available", capacity: "40 tons", rcExpiry: "2026-09-30", insuranceExpiry: "2026-07-12", permitExpiry: "2026-08-15", pucExpiry: "2026-07-20", documents: [{ id: uid("vdoc"), category: "RC", fileName: "RC.pdf" }, { id: uid("vdoc"), category: "Insurance", fileName: "Insurance.pdf" }], telemetry: { speed: 0, fuelLevel: 78, batteryVoltage: 12.4, gpsSignal: 4, ignition: "OFF", latitude: "19.0760 N", longitude: "72.8777 E", location: "Mumbai Yard, Gate 2", lastUpdated: "09:42:17 AM", eta: "-", odometerKm: 84203, distanceTodayKm: 0, engineHealth: "Good", oilHealth: 87, tyrePressure: "Normal", apiSync: "Connected", harshEvents: 0 } },
  { id: "veh-2", number: "MH14CD5678", model: "Ashok Leyland 3718", status: "On Trip", capacity: "32 tons", rcExpiry: "2026-07-10", insuranceExpiry: "2026-11-28", permitExpiry: "2026-12-22", pucExpiry: "2026-08-05", documents: [{ id: uid("vdoc"), category: "Permit", fileName: "Permit.pdf" }], telemetry: { speed: 72, fuelLevel: 68, batteryVoltage: 13.2, gpsSignal: 5, ignition: "ON", latitude: "18.5204 N", longitude: "73.8567 E", location: "NH-48, Pune-Mumbai Expressway, Khopoli", lastUpdated: "09:41:52 AM", eta: "11:30 AM", odometerKm: 124880, distanceTodayKm: 312, engineHealth: "Good", oilHealth: 74, tyrePressure: "Normal", apiSync: "Connected", harshEvents: 1 } },
  { id: "veh-3", number: "MH15EF9012", model: "BharatBenz 1617R", status: "Available", capacity: "16 tons", rcExpiry: "2027-03-18", insuranceExpiry: "2026-08-05", permitExpiry: "2026-07-08", pucExpiry: "2026-07-08", documents: [], telemetry: { speed: 0, fuelLevel: 45, batteryVoltage: 11.8, gpsSignal: 3, ignition: "OFF", latitude: "19.9975 N", longitude: "73.7898 E", location: "Nashik Depot, Bay 4", lastUpdated: "09:40:08 AM", eta: "-", odometerKm: 61005, distanceTodayKm: 18, engineHealth: "Warning", oilHealth: 62, tyrePressure: "Low rear-left", apiSync: "Delayed", harshEvents: 0 } },
  { id: "veh-4", number: "GJ01GH3456", model: "Eicher Pro 6031", status: "Under Maintenance", capacity: "28 tons", rcExpiry: "2026-10-25", insuranceExpiry: "2027-02-19", permitExpiry: "2027-01-30", pucExpiry: "2026-09-01", documents: [{ id: uid("vdoc"), category: "Service", fileName: "Service-estimate.pdf" }], telemetry: { speed: 0, fuelLevel: 21, batteryVoltage: 10.1, gpsSignal: 1, ignition: "OFF", latitude: "23.0225 N", longitude: "72.5714 E", location: "Western Fleet Care, Ahmedabad", lastUpdated: "08:58:44 AM", eta: "-", odometerKm: 102330, distanceTodayKm: 0, engineHealth: "Critical", oilHealth: 44, tyrePressure: "Service due", apiSync: "Offline", harshEvents: 3 } },
];
const seedDrivers: Driver[] = [
  { id: "drv-1", name: "Ramesh Kumar", phone: "+91 98100 12345", license: "MH1220190012345", licenseExpiry: "2026-07-06", aadhaar: "1234 5678 9012", pan: "ABCPK1234D", address: "Andheri East, Mumbai", emergencyContact: "+91 98100 55555", joiningDate: "2024-04-12", assignedVehicleId: "veh-1", earnings: 138000, paymentHistory: [
    { id: "PAY-JUN-DRV1", driverId: "drv-1", month: "2026-06", amount: 22000, method: "Bank Transfer", status: "Paid", paidAt: "2026-06-30", notes: "June salary" },
    { id: "PAY-MAY-DRV1", driverId: "drv-1", month: "2026-05", amount: 22000, method: "Bank Transfer", status: "Paid", paidAt: "2026-05-31", notes: "May salary" },
  ], status: "Active", salary: 22000, documents: [{ id: "doc-drv1-1", category: "License", fileName: "License.jpg" }, { id: "doc-drv1-2", category: "Aadhaar", fileName: "Aadhaar.pdf" }] },
  { id: "drv-2", name: "Suresh Patil", phone: "+91 91234 56789", license: "MH1420180098765", licenseExpiry: "2026-08-18", aadhaar: "8765 4321 0987", pan: "BXZPP5678E", status: "On Trip", salary: 24000, documents: [{ id: "doc-drv2-1", category: "License", fileName: "License.pdf" }] },
  { id: "drv-3", name: "Vikas More", phone: "+91 93456 78901", license: "GJ0120200055555", licenseExpiry: "2027-01-18", aadhaar: "4444 5555 6666", pan: "CMNPM9012F", status: "Active", salary: 21000, documents: [] },
];
const seedCustomers: Customer[] = [
  { id: "cus-1", company: "Reliance Industries Ltd", contact: "Anil Sharma", phone: "+91 98100 12345", email: "anil.sharma@reliance.in", gst: "27AABCR1234A1Z5", address: "Nariman Point, Mumbai 400021", creditLimit: 500000 },
  { id: "cus-2", company: "Tata Steel Limited", contact: "Priya Menon", phone: "+91 91234 56789", email: "priya.m@tatasteel.com", gst: "20AAACT2727Q1ZV", address: "Bombay House, Mumbai 400001" },
  { id: "cus-3", company: "Mahindra Logistics", contact: "Rajesh Nair", phone: "+91 93456 78901", email: "r.nair@mahindra.com", gst: "27AAACM3025F1ZG", address: "Gateway Building, Mumbai 400001" },
];
const seedTrips: Trip[] = [
  { id: "TRIP-0481", lrNumber: "LR-2026-0481", customerId: "cus-1", vehicleId: "veh-2", driverId: "drv-2", pickup: "Mumbai", drop: "Pune", cargo: "Electronics - 18 pallets", cargoName: "Consumer electronics", materialType: "Fragile", weight: "12 tons", quantity: "18 pallets", date: "2026-07-01", endDate: "2026-07-02", distanceKm: 148, durationHrs: 4.2, freight: 42000, advanceAmount: 15000, tollCharges: 1800, driverAllowance: 1200, otherExpenses: 900, invoiceNumber: "INV-2026-0086", paymentStatus: "Overdue", ewayBill: "EWAY-0481.pdf", deliveryReceipt: "DR-0481.pdf", status: "In Transit", podDocs: [], remarks: "Handle with care - fragile electronics" },
  { id: "TRIP-0480", customerId: "cus-2", vehicleId: "veh-1", driverId: "drv-1", pickup: "Pune", drop: "Nashik", cargo: "Steel coils", date: "2026-07-02", distanceKm: 210, durationHrs: 5.8, freight: 52000, status: "Assigned", podDocs: ["E-way-bill.pdf"], remarks: "" },
  { id: "TRIP-0479", customerId: "cus-3", vehicleId: "veh-3", driverId: "drv-3", pickup: "Nashik", drop: "Aurangabad", cargo: "Auto parts", date: "2026-06-29", distanceKm: 185, durationHrs: 5, freight: 38000, status: "Completed", podDocs: ["POD.jpg", "Invoice.pdf"], remarks: "" },
];
const seedExpenses: Expense[] = [
  { id: "exp-1", tripId: "TRIP-0481", vehicleId: "veh-2", driverId: "drv-2", category: "Fuel", amount: 9500, date: "2026-07-01", note: "Diesel refill", liters: 82, mileage: 4.8 },
  { id: "exp-2", tripId: "TRIP-0481", category: "Toll", amount: 1800, date: "2026-07-01", note: "Mumbai-Pune toll" },
  { id: "exp-3", category: "Maintenance", amount: 17500, date: "2026-06-28", note: "Brake service for GJ01GH3456" },
  { id: "exp-4", tripId: "TRIP-0479", category: "Allowance", amount: 1200, date: "2026-06-29", note: "Driver allowance" },
  { id: "exp-5", tripId: "TRIP-0479", vehicleId: "veh-3", driverId: "drv-3", category: "Fuel", amount: 11200, date: "2026-06-29", note: "Diesel refill", liters: 96, mileage: 3.9 },
  { id: "exp-6", tripId: "TRIP-0480", category: "Parking", amount: 600, date: "2026-07-02", note: "Warehouse parking" },
];
const seedInvoices: Invoice[] = [
  { id: "INV-2026-0088", tripId: "TRIP-0479", customerId: "cus-3", status: "Pending", dueDate: "2026-07-11", total: 44840, paidAmount: 0 },
  { id: "INV-2026-0087", tripId: "TRIP-0480", customerId: "cus-2", status: "Partial", dueDate: "2026-06-25", total: 61360, paidAmount: 25000 },
  { id: "INV-2026-0086", tripId: "TRIP-0481", customerId: "cus-1", status: "Overdue", dueDate: "2026-06-18", total: 49560, paidAmount: 0 },
];
const seedPayments: Payment[] = [
  { id: "RCPT-3001", invoiceId: "INV-2026-0087", customerId: "cus-2", amount: 25000, method: "Bank Transfer", reference: "UTR88421", paidAt: "2026-06-27" },
];
const seedDocuments: DocumentRecord[] = [
  { id: "doc-1", ownerType: "Vehicle", ownerId: "veh-1", ownerName: "MH12AB1234", type: "Insurance", documentNumber: "INS-MH12-2026", issueDate: "2025-07-12", expiryDate: "2026-07-12", status: "Due 15", fileName: "Insurance.pdf" },
  { id: "doc-2", ownerType: "Vehicle", ownerId: "veh-2", ownerName: "MH14CD5678", type: "RC", documentNumber: "RC-MH14-5678", issueDate: "2021-07-10", expiryDate: "2026-07-10", status: "Due 15", fileName: "RC.pdf" },
  { id: "doc-3", ownerType: "Vehicle", ownerId: "veh-3", ownerName: "MH15EF9012", type: "Permit", documentNumber: "PER-MH15-9012", issueDate: "2025-07-08", expiryDate: "2026-07-08", status: "Due 7", fileName: "Permit.pdf" },
  { id: "doc-4", ownerType: "Driver", ownerId: "drv-1", ownerName: "Ramesh Kumar", type: "License", documentNumber: "MH1220190012345", issueDate: "2021-07-06", expiryDate: "2026-07-06", status: "Due 7", fileName: "License.jpg" },
  { id: "doc-5", ownerType: "Driver", ownerId: "drv-2", ownerName: "Suresh Patil", type: "Medical Certificate", documentNumber: "MED-7782", issueDate: "2025-06-01", expiryDate: "2026-06-30", status: "Expired", fileName: "Medical.pdf" },
];
const seedApiConfig: ApiConfig = {
  baseUrl: "https://api.sbrportal.com/v3", environment: "Production", apiToken: "", orgId: "org_SBRPortal_00482",
  liveLocationEndpoint: "/vehicles/location/live", fuelStatusEndpoint: "/vehicles/fuel/status", vehicleMappingKey: "vehicleNumber",
  pollingInterval: "30", webhookUrl: "https://ops.yourfleet.com/webhooks/sbrportal", timeoutMs: "5000",
  syncLiveLocation: true, syncFuelLevel: true, syncIgnitionGps: true, connected: false, lastSynced: "Never",
};
const seedCompanyProfile: CompanyProfile = {
  name: "SHREE BIROBA ROADLINES", gst: "", phone: "7350005112", address: "Shop No. 03, 5th Floor, Geet Sidhi Commercial, Nr. MNGL Gas Station, Big City Mart Bldg., Moshi, Pune – 412105",
  tagline: "Transport Contractor & Carrying Heavy & ODC Size Consignment Services",
  phone2: "7757004694", email: "shreebirobaroadlines1980@gmail.com", jurisdiction: "Pune",
  pan: "", bankName: "", bankBranch: "", bankAccount: "", bankIfsc: "",
};

// Fixed legal identity printed on every Booking Register freight bill.
const BOOKING_REGISTER_COMPANY: CompanyProfile = seedCompanyProfile;
const seedMaintenance: MaintenanceRecord[] = [
  { id: "mnt-1", vehicleId: "veh-4", serviceType: "Brake", serviceCost: 17500, workshop: "Western Fleet Care", mechanic: "A. Shaikh", partsUsed: "Brake liner kit", serviceIntervalKm: 10000, mileageReminderKm: 500, dueDate: "2026-07-05", status: "Due" },
  { id: "mnt-2", vehicleId: "veh-1", serviceType: "Oil Change", serviceCost: 8200, workshop: "Highway Motors", mechanic: "R. Pawar", partsUsed: "Engine oil, filter", serviceIntervalKm: 8000, mileageReminderKm: 700, dueDate: "2026-07-18", status: "Upcoming" },
  { id: "mnt-3", vehicleId: "veh-3", serviceType: "Tyre", serviceCost: 24000, workshop: "Truck Tyre Point", mechanic: "K. Patel", partsUsed: "2 rear tyres", serviceIntervalKm: 30000, mileageReminderKm: 1500, dueDate: "2026-08-02", status: "Upcoming" },
];

function generateNotifications(vehicles: Vehicle[], drivers: Driver[], invoices: Invoice[]): Notification[] {
  const items: Notification[] = [];
  vehicles.forEach((v) => {
    [["Insurance", v.insuranceExpiry], ["RC", v.rcExpiry], ["Permit", v.permitExpiry], ["PUC", v.pucExpiry]].forEach(([label, date]) => {
      const days = daysUntil(date);
      if (days <= 30) items.push({ id: uid("note"), type: "document", title: `${label} reminder`, message: `${v.number} ${label} expires in ${days} days`, read: false, createdAt: today });
    });
  });
  drivers.forEach((d) => {
    const days = daysUntil(d.licenseExpiry);
    if (days <= 30) items.push({ id: uid("note"), type: "driver", title: "License expiring", message: `${d.name}'s license expires in ${days} days`, read: false, createdAt: today });
  });
  invoices.filter((i) => i.status !== "Paid").forEach((i) => {
    items.push({ id: uid("note"), type: "payment", title: `${i.status} payment`, message: `${i.id} is ${i.status.toLowerCase()} and due on ${i.dueDate}`, read: false, createdAt: today });
  });
  return items;
}

function Login({ onLogin }: { onLogin: (role: Role, token: string, name: string) => void }) {
  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError("");
    setBusy(true);
    try {
      const body = role === "driver" ? { phone: email, password } : { email, password };
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      const effectiveRole: Role = data.user.role === "driver" ? "driver" : "admin";
      onLogin(effectiveRole, data.token, data.user.name);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-[Inter,sans-serif]" style={{ background: "linear-gradient(135deg,#E9EDF4 0%,#F5F7FB 100%)" }}>
      <section className="hidden lg:flex relative overflow-hidden p-12 flex-col justify-between">
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-blue-300/35 blur-[110px]" />
        <div className="relative flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-white/65 flex items-center justify-center"><Truck className="text-[#1E3A5F]" /></div><span className="text-[#1E3A5F] font-bold text-xl">FleetOS</span></div>
        <div className="relative max-w-md">
          <h2 className="text-5xl font-bold text-[#12151C] leading-tight">Manage trucks, trips, invoices, and cashflow in one place.</h2>
          <p className="mt-5 text-[#4B5563] leading-7">Phase 1 and Phase 2 workflows are connected across fleet, drivers, customers, expenses, reports, GST invoices, payments, and reminders.</p>
        </div>
        <p className="relative text-xs text-[#6B7280]">Truck Business Management System</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[28px] p-8" style={glass}>
          <div className="flex items-center gap-2 mb-7"><div className="w-9 h-9 rounded-xl bg-[#12151C] flex items-center justify-center"><Truck size={17} className="text-white" /></div><span className="font-bold text-lg">FleetOS</span></div>
          <h1 className="text-2xl font-bold text-[#12151C]">Welcome back</h1>
          <p className="text-sm text-[#6B7280] mt-1">Login to manage your fleet</p>
          <div className="mt-6 rounded-2xl p-1 flex" style={glassSubtle}>
            {(["admin", "driver"] as Role[]).map((r) => (
              <button key={r} onClick={() => setRole(r)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all" style={role === r ? { background: "#12151C", color: "#fff" } : { color: "#6B7280" }}>{r === "admin" ? "Admin / Manager" : "Driver"}</button>
            ))}
          </div>
          <label className="block mt-5 text-sm font-medium text-[#374151]">{role === "driver" ? "Phone Number" : "Email Address"}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full px-5 py-3.5 rounded-2xl text-sm outline-none border border-white/70 bg-white/55" />
          <label className="block mt-4 text-sm font-medium text-[#374151]">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="mt-2 w-full px-5 py-3.5 rounded-2xl text-sm outline-none border border-white/70 bg-white/55" />
          {error && <p className="mt-3 text-sm text-red-500 font-medium">{error}</p>}
          <button disabled={busy} onClick={handleLogin} className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C] active:scale-[0.98] disabled:opacity-60">
            {busy ? "Signing in..." : "Login to FleetOS"} <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

type NavItem = { view: View; label: string; icon: React.ElementType; driver?: boolean; section: string };
const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, driver: true, section: "Overview" },
  { view: "vehicles", label: "Vehicles", icon: Truck, section: "Fleet" },
  { view: "maintenance", label: "Service", icon: Wrench, section: "Fleet" },
  { view: "fuel", label: "Fuel", icon: Fuel, section: "Fleet" },
  { view: "trips", label: "Booking Register", icon: Route, driver: true, section: "Operations" },
  { view: "balanceFreight", label: "Vehicle Register", icon: ClipboardList, section: "Operations" },
  { view: "drivers", label: "Driver Info & Documents", icon: UserCheck, section: "Operations" },
  { view: "customers", label: "Party", icon: Users, section: "Operations" },
  { view: "documents", label: "Documents", icon: ShieldCheck, section: "Operations" },
  { view: "notifications", label: "Alerts", icon: Bell, driver: true, section: "Operations" },
  { view: "expenses", label: "Expenses", icon: Receipt, driver: true, section: "Finance" },
  { view: "companyExpenses", label: "Company Expenses", icon: CreditCard, section: "Finance" },
  { view: "emiReminders", label: "EMI Reminders", icon: Bell, section: "Finance" },
  { view: "salary", label: "Salary", icon: IndianRupee, section: "Finance" },
  { view: "attendance", label: "Attendance", icon: Calendar, section: "Admin" },
  { view: "reports", label: "Reports", icon: BarChart3, section: "Admin" },
  { view: "api", label: "API", icon: SettingsIcon, section: "Admin" },
  { view: "users", label: "Users", icon: Users, section: "Admin" },
  { view: "roles", label: "Roles", icon: ShieldCheck, section: "Admin" },
  { view: "company", label: "Company", icon: Building2, section: "Admin" },
];

function Shell({
  view, setView, role, logout, children, unread, profileName, theme, toggleTheme,
}: { view: View; setView: (v: View) => void; role: Role; logout: () => void; children: React.ReactNode; unread: number; profileName: string; theme: "light" | "dark"; toggleTheme: () => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const items = NAV_ITEMS.filter((item) => role === "admin" || item.driver);
  const sections = Array.from(new Set(items.map((item) => item.section)));
  const isActive = (target: View) => view === target || (target === "billing" && (view === "invoices" || view === "payments"));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="min-h-screen w-full flex font-[Inter,sans-serif] relative overflow-hidden" style={{ background: "var(--background)" }}>
      <aside className={`hidden md:flex h-screen self-stretch flex-col py-5 px-2 gap-0.5 z-20 relative overflow-hidden transition-all bg-[#0B111C] shadow-2xl ${collapsed ? "w-[88px] items-center" : "w-[238px]"}`}>
        <div className={`mb-3 flex items-center gap-3 ${collapsed ? "justify-center" : "justify-between w-full"}`}>
          <button onClick={() => setView("dashboard")} aria-label="SBR Portal dashboard" className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-lg shrink-0 overflow-hidden"><img src="/sbr-logo.png" alt="SBR Portal" className="w-full h-full object-cover" /></button>
          {!collapsed && <span className="text-sm font-bold text-white">SBR Portal</span>}
          <button onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="w-9 h-9 rounded-2xl flex items-center justify-center bg-white/10 text-white"><ChevronRight size={15} className={collapsed ? "" : "rotate-180"} /></button>
        </div>
        <nav className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pr-1 sidebar-scroll" aria-label="Portal navigation">
        {sections.map((section, sectionIndex) => (
          <div key={section} className="w-full">
            {sectionIndex > 0 && (collapsed
              ? <div className="w-8 h-px bg-white/10 mx-auto my-2" />
              : <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">{section}</p>)}
            {items.filter((item) => item.section === section).map(({ icon: Icon, label, view: target }) => {
              const active = isActive(target);
              return (
                <button key={target} onClick={() => setView(target)} title={label} className={`relative flex items-center ${collapsed ? "flex-col justify-center gap-1 py-2.5" : "gap-3 px-3 py-2.5"} w-full rounded-2xl transition-all`} style={active ? { background: "#fff", boxShadow: "0 8px 18px rgba(0,0,0,0.18)" } : {}}>
                  <Icon size={collapsed ? 18 : 16} color={active ? "#111827" : "#8A94A6"} />
                  <span className={`${collapsed ? "text-[9px]" : "text-xs"} font-semibold truncate`} style={{ color: active ? "#111827" : "#8A94A6" }}>{label}</span>
                  {target === "notifications" && unread > 0 && <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">{unread}</span>}
                </button>
              );
            })}
          </div>
        ))}
        </nav>
        <button onClick={logout} title="Logout" className="mt-auto w-10 h-10 rounded-2xl flex items-center justify-center bg-white/10 text-white"><LogOut size={16} /></button>
      </aside>
      <main className="flex-1 z-10 overflow-y-auto max-h-screen p-5 md:p-8">
        {view !== "liveTracking" && <div className="flex items-center gap-3 mb-7">
          <div className="md:hidden w-10 h-10 rounded-2xl bg-[#12151C] flex items-center justify-center"><Truck size={18} className="text-white" /></div>
          <div className="flex-1">
            <p className="text-sm text-[#7A8494]">{dateLabel}</p>
            <h1 className="text-2xl font-extrabold text-[#111827]">{greeting}, {role === "admin" ? profileName : "Ramesh"}</h1>
          </div>
          <select value={view} onChange={(e) => setView(e.target.value as View)} className="md:hidden rounded-2xl px-3 py-2 text-xs font-semibold" style={glassSubtle}>{items.map((item) => <option key={item.view} value={item.view}>{item.label}</option>)}</select>
          <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="relative w-11 h-11 rounded-2xl shadow-sm flex items-center justify-center" style={glass}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button onClick={() => setView("notifications")} className="relative w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center"><Bell size={17} />{unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{unread}</span>}</button>
          <button onClick={() => setView("profile")} className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white shadow-sm"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{role === "admin" ? initials(profileName || "Nexora") : "RK"}</div><span className="text-sm font-semibold">{role === "admin" ? profileName : "Driver"}</span><ChevronRight size={14} className="rotate-90 text-[#9CA3AF]" /></button>
          {role === "admin" && <button onClick={() => setView("trips")} className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-[#0B111C] shadow-lg"><Plus size={16} />New Booking</button>}
        </div>}
        {children}
      </main>
    </div>
  );
}

function Toolbar({ title, subtitle, search, setSearch, action, filters }: { title: string; subtitle: string; search?: string; setSearch?: (v: string) => void; action?: React.ReactNode; filters?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-5">
      <div className="flex-1 min-w-[220px]"><h2 className="text-2xl font-extrabold text-[#12151C] tracking-tight">{title}</h2><p className="text-sm text-[#6B7280] mt-0.5">{subtitle}</p></div>
      {setSearch && <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl w-full sm:w-72" style={glassSubtle}><Search size={15} color="#9CA3AF" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-transparent text-sm outline-none w-full" /></div>}
      {filters}
      {action}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-[#1a1d2e]/15 backdrop-blur-[2px] z-50 flex justify-end" onMouseDown={onClose}>
      <div className="h-full w-[440px] max-w-full rounded-l-[28px] border-l border-white/60 shadow-2xl overflow-y-auto" style={{ ...glass, background: "var(--card)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-7 py-5 border-b border-white/50" style={{ background: "var(--card)", backdropFilter: "blur(16px)" }}>
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/60"><X size={16} /></button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );
}
type ViewableDoc = { fileName: string; dataUrl?: string; title?: string };
function DocumentViewerModal({ doc, onClose }: { doc: ViewableDoc; onClose: () => void }) {
  const ext = doc.fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = doc.dataUrl?.startsWith("data:image") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = doc.dataUrl?.startsWith("data:application/pdf") || ext === "pdf";
  return (
    <div className="fixed inset-0 bg-[#1a1d2e]/45 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] rounded-[24px] overflow-hidden flex flex-col" style={{ ...glass, background: "var(--card)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50">
          <div className="min-w-0"><p className="text-sm font-bold truncate">{doc.title || doc.fileName}</p><p className="text-xs text-[#9CA3AF] truncate">{doc.fileName}</p></div>
          <div className="flex items-center gap-2 shrink-0">
            {doc.dataUrl && <a href={doc.dataUrl} download={doc.fileName} className="w-9 h-9 rounded-xl flex items-center justify-center" title="Download" style={glassSubtle}><Download size={15} /></a>}
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/60"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#0B111C]/5 p-4 flex items-center justify-center">
          {!doc.dataUrl && <EmptyState label="No preview available - this document was added before file upload was enabled. Re-upload it to view here." />}
          {doc.dataUrl && isImage && <img src={doc.dataUrl} alt={doc.fileName} className="max-h-[70vh] max-w-full rounded-xl shadow-lg object-contain" />}
          {doc.dataUrl && isPdf && <iframe title={doc.fileName} src={doc.dataUrl} className="w-full h-[70vh] rounded-xl bg-white" />}
          {doc.dataUrl && !isImage && !isPdf && <div className="text-center"><FileText size={32} className="mx-auto mb-3 text-[#9CA3AF]" /><p className="text-sm font-semibold mb-2">Preview not supported for this file type</p><a href={doc.dataUrl} download={doc.fileName} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Download size={14} />Download {doc.fileName}</a></div>}
        </div>
      </div>
    </div>
  );
}
function FreightBillModal({ trip, customer, vehicle, company, onClose }: { trip: Trip; customer?: Customer; vehicle?: Vehicle; company: CompanyProfile; onClose: () => void }) {
  const advance = trip.advances?.length ? trip.advances.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) : (trip.advanceAmount ?? 0);
  const detention = trip.otherExpenses ?? 0;
  const amount = trip.freight + detention;
  const balance = Math.max(amount - advance, 0);
  
  const normalizedChargeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const detentionName = trip.otherChargesReason || "Detention";
  const breakdownCharges = (trip.expenseRemarks ?? []).filter((item) => {
    if (item.amount <= 0) return false;
    const isDetention = normalizedChargeName(item.category).includes("detention");
    const sameAmount = Number(item.amount) === Number(detention);
    return !(detention > 0 && isDetention && sameAmount);
  });
  
  const allCharges = [
    ...(advance > 0 ? [["Advance", advance] as const] : []),
    ...(detention > 0 ? [[detentionName, detention] as const] : []),
    ...(breakdownCharges.map((item) => [item.category, item.amount] as const)),
    ...(trip.tollCharges ? [["Toll / FASTag", trip.tollCharges] as const] : []),
    ...(trip.driverAllowance ? [["Driver Allowance", trip.driverAllowance] as const] : []),
  ];

  const totalAllCharges = allCharges.reduce((sum, [, val]) => sum + val, 0);

  const printDate = (value?: string) => {
    if (!value) return "-";
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${day}-${month}-${year}` : value;
  };

  const defaultWidths = [4, 8, 8, 10, 15, 15, 8, 7, 16, 9];
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("freightBillColWidths");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length === 10) return parsed;
      }
    } catch (e) {}
    return defaultWidths;
  });

  const onDragStart = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startLeftWidth = colWidths[index];
    const startRightWidth = colWidths[index + 1];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const tableWidth = document.getElementById("freight-bill-printable")?.clientWidth || 720;
      const deltaPercent = (deltaX / tableWidth) * 100;

      setColWidths(prev => {
        const newWidths = [...prev];
        const newLeft = startLeftWidth + deltaPercent;
        const newRight = startRightWidth - deltaPercent;

        if (newLeft >= 2 && newRight >= 2) {
          newWidths[index] = newLeft;
          newWidths[index + 1] = newRight;
        }
        return newWidths;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setColWidths(prev => {
        localStorage.setItem("freightBillColWidths", JSON.stringify(prev));
        return prev;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const headers = ["Sr.", "Date", "Lr No.", "Vehicle No.", "From", "To", "Size", "Weight", "Freight", "All Charges"];

  const chargeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [chargeHeights, setChargeHeights] = useState<number[]>([]);

  useEffect(() => {
    if (!chargeRefs.current.length || !allCharges.length) return;
    
    const observer = new ResizeObserver((entries) => {
      setChargeHeights(prev => {
        const newHeights = [...prev];
        let changed = false;
        entries.forEach(entry => {
          const index = chargeRefs.current.findIndex(el => el === entry.target);
          if (index !== -1) {
            const h = (entry.target as HTMLElement).offsetHeight;
            if (newHeights[index] !== h) {
              newHeights[index] = h;
              changed = true;
            }
          }
        });
        return changed ? newHeights : prev;
      });
    });

    chargeRefs.current.forEach(el => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [allCharges]);

  return (
    <div className="fixed inset-0 bg-[#1a1d2e]/45 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] rounded-[20px] overflow-hidden flex flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 no-print">
          <div><p className="text-sm font-bold">Freight Bill Preview</p><p className="text-xs text-[#9CA3AF]">Bill No. {trip.billNo || "-"} - {customer?.company}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Printer size={15} />Print / Save PDF</button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#0B111C]/5 p-4 flex justify-center">
          <div id="freight-bill-printable" className="bg-white w-full max-w-[720px] p-8 text-[#111827]" style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 400 }}>
            <p className="text-center text-[10px] tracking-wide mb-2">Subject to {company.jurisdiction || "Pune"} Jurisdiction</p>
            <div className="text-center border-2 border-[#111827] rounded-md px-4 pt-4 pb-3">
              <h1 className="text-3xl font-bold tracking-wide text-[#F97316]" style={{ letterSpacing: "1px" }}>SHREE BIROBA ROADLINES</h1>
              <p className="text-xs mt-1" style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 700 }}>Transport Contractor & Carrying Heavy & ODC Size Consignment Services</p>
              <p className="text-xs mt-1">{company.address}</p>
              <p className="text-xs">
                {[company.phone, company.phone2].filter(Boolean).join(" / ")}
                {company.email ? `  Email - ${company.email}` : ""}
              </p>
              <div className="border-t border-[#111827] mt-3 pt-2 grid grid-cols-2 text-xs text-left px-2">
                <div><p className="font-bold">M/S. : {(customer?.company || trip.customerId || "-").toUpperCase()}</p><p className="mt-1">Add : {customer?.address || ""}</p></div>
                <div className="text-right"><p><span className="font-semibold">Bill No. :</span> {trip.billNo || "-"}</p><p><span className="font-semibold">Date :</span> <span className="font-sans font-bold">{printDate(trip.date)}</span></p></div>
              </div>
              <p className="text-xs border-t border-[#111827] mt-2 pt-2 text-left px-2">We Hereby Submit Our Freight Bill For Transportation Of Your Goods As Under</p>
              <table className="w-full table-fixed text-[10px] border-collapse mt-1">
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: `${w}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-t border-b border-[#111827]">
                    {headers.map((h, index) => (
                      <th key={h} className="border-r border-[#111827] last:border-r-0 px-1 py-1 font-semibold relative group select-none">
                        {h}
                        {index < headers.length - 1 && (
                          <div
                            onMouseDown={(e) => onDragStart(index, e)}
                            className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-10 hover:bg-black/20 no-print"
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">1</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans font-bold">{printDate(trip.date)}</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">{trip.lrNumber || "-"}</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">{vehicle?.number || trip.manualVehicleNumber || "-"}</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">{trip.pickup}</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">
                      {trip.drop}
                      {trip.remarks && <span className="block text-[10px] mt-1">{trip.remarks}</span>}
                    </td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">{trip.size || "-"}</td>
                    <td className="border-r border-[#111827] px-1 py-1 text-center font-sans">{trip.weight || "-"}</td>
                    
                    {/* FREIGHT COLUMN */}
                    <td className="border-r border-[#111827] p-0 align-top">
                      <div className="flex flex-col h-full">
                        <div className="p-1 text-right font-bold border-b border-[#111827] flex items-center justify-end min-h-[26px]">
                          {trip.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex-1 flex flex-col pt-0.5 pb-1">
                          {allCharges.map((c, i) => (
                            <div 
                              key={i} 
                              ref={el => chargeRefs.current[i] = el}
                              className="px-1 py-0.5 text-left text-[9px] leading-tight flex items-center"
                            >
                              {c[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    
                    {/* ALL CHARGES COLUMN */}
                    <td className="p-0 align-top">
                      <div className="flex flex-col h-full">
                        <div className="p-1 text-right font-bold border-b border-[#111827] flex items-center justify-end min-h-[26px]">
                          {totalAllCharges > 0 ? totalAllCharges.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                        </div>
                        <div className="flex-1 flex flex-col pt-0.5 pb-1">
                          {allCharges.map((c, i) => (
                            <div 
                              key={i} 
                              className="px-1 py-0.5 text-right text-[9px] leading-tight flex items-center justify-end font-sans"
                              style={{ height: chargeHeights[i] ? `${chargeHeights[i]}px` : 'auto' }}
                            >
                              {c[1].toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: 10 }).map((__, columnIndex) => (
                        <td key={columnIndex} className={`h-6 ${columnIndex < 9 ? "border-r border-[#111827]" : ""}`}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#111827]">
                    <td colSpan={7} className="align-bottom px-1 py-1 text-left text-[10px] italic">{trip.remarks || ""}</td>
                    <td colSpan={2} className="border-l border-[#111827] px-2 py-1 text-right font-semibold">Amount</td>
                    <td className="border-l border-[#111827] px-2 py-1 text-right font-sans">{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td colSpan={7}></td>
                    <td colSpan={2} className="border-l border-[#111827] px-2 py-1 text-right font-semibold">Advance</td>
                    <td className="border-l border-[#111827] px-2 py-1 text-right font-sans">{advance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="border-b border-[#111827]">
                    <td colSpan={7}></td>
                    <td colSpan={2} className="border-l border-t border-[#111827] px-2 py-1 text-right font-semibold">Balance</td>
                    <td className="border-l border-t border-[#111827] px-2 py-1 text-right font-bold font-sans">{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-left px-2 mt-2 border-t border-[#111827] pt-2">Rupees : {amountInWords(balance)}</p>
              {company.pan && <p className="text-xs text-left px-2 mt-1 font-semibold">PAN NO. {company.pan}</p>}
              <div className="flex justify-between items-end px-2 mt-6">
                <div className="text-left text-xs">
                  {company.bankName && <p>BANK NAME : {company.bankName}</p>}
                  {company.bankBranch && <p>BRANCH : {company.bankBranch}</p>}
                  {company.bankAccount && <p>A/C NO : {company.bankAccount}</p>}
                  {company.bankIfsc && <p>IFSC CODE : {company.bankIfsc}</p>}
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold mb-8">FOR {company.name.toUpperCase()}</p>
                  <img src="/authorized-signature.png" alt="Authorised signature" className="w-36 h-14 object-contain ml-auto -mt-8 mb-1" />
                  <p>Authorised Signature</p>
                </div>
              </div>
              <p className="text-right text-[10px] mt-3">Page 1 of 1</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ChallanModal({ record, vehicle, company, onClose }: { record: BalanceFreightRecord; vehicle?: Vehicle; company: CompanyProfile; onClose: () => void }) {
  const advances = record.advances ?? [];
  const totalAdvance = advances.length ? advances.reduce((s, a) => s + (a.amount || 0), 0) : (record.partyAdvance ?? record.advance ?? 0);
  const chargesLeft = [
    ["Commission (-)", record.commission || 0],
    ["Extra Height", record.extraHeight || 0],
    ["Payment Chg", record.paymentChg || 0],
    ["Challan Fine chg", record.challanFineChg || 0],
    ["other Charges", record.otherCharges || 0],
    ["Extra Width", record.extraWidthChg || 0],
  ] as const;
  const chargesRight = [
    ["Detention", record.payCharge || 0],
    ["WeightRecipt", record.weightRecipt || 0],
    ["Hamali (-)", record.hamali || 0],
    ["UnlodingChg", record.unlodingChg || 0],
    ["Extra Weight", record.extraWeightChg || 0],
  ] as const;
  const deductions = (record.commission || 0) + (record.hamali || 0) + (record.paymentChg || 0);
  const additions = (record.payCharge || 0) + (record.extraHeight || 0) + (record.extraWidthChg || 0)
    + (record.extraWeightChg || 0) + (record.weightRecipt || 0) + (record.unlodingChg || 0)
    + (record.challanFineChg || 0) + (record.otherCharges || 0);
  // "Extra" is the signed net of all charge additions and deductions.
  const extra = additions - deductions;
  const balance = record.freight - totalAdvance + extra;
  return (
    <div className="fixed inset-0 bg-[#1a1d2e]/45 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] rounded-[20px] overflow-hidden flex flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 no-print">
          <div><p className="text-sm font-bold">Lorry Hire Challan Preview</p><p className="text-xs text-[#9CA3AF]">Challan No. {record.challanNo || "-"} - {record.vehicleNumber}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Printer size={15} />Print / Save PDF</button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#0B111C]/5 p-4 flex justify-center">
          <div id="challan-printable" className="bg-white w-full max-w-[720px] p-6 text-[#111827] border-2 border-[#111827] rounded-md" style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 400 }}>
            <p className="text-center text-[10px] font-bold tracking-wide">LORRY HIRE CHALLAN</p>
            <h1 className="text-center text-2xl font-bold tracking-wide mt-1 text-[#F97316]">SHREE BIROBA ROADLINES</h1>
            <p className="text-center text-[10px] mt-1" style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 700 }}>Transport Contractor & Carrying Heavy & ODC Size Consignment Services</p>
            <p className="text-center text-xs mt-1">Shop No-03, 5th Floor, Geet Sidhi Commercial, Nr MNGL Gas Station, Big City Mart Bldg, Moshi, Pune - 412105</p>
            <p className="text-center text-xs">7350005112 / 7757004694 &nbsp; Email - shreebirobaroadlines1980@gmail.com</p>

            <div className="border-t border-[#111827] mt-3 pt-2 grid grid-cols-2 text-xs gap-y-1">
              <p><span className="font-semibold">Challan No. :</span> {record.challanNo || "-"}</p>
              <p className="text-right"><span className="font-semibold">Loading Date :</span> <span className="font-sans font-bold">{record.loadingDate}</span></p>
              <p><span className="font-semibold">Vehicle No. :</span> {record.vehicleNumber}</p>
              <p className="text-right"><span className="font-semibold">Owner Name :-</span> {record.ownerName || vehicle?.ownerName || "-"}</p>
              <p><span className="font-semibold">From :</span> {record.from}</p>
              <p className="text-right"><span className="font-semibold">To :</span> {record.to}</p>
              <p><span className="font-semibold">CN No. :</span> {record.cnNo || "-"}</p>
              <p className="text-right"><span className="font-semibold">Party :</span> {record.partyName}</p>
              <p><span className="font-semibold">Weight :</span> {record.weight || "-"}</p>
              <p className="text-right"><span className="font-semibold">Rate :</span> {(record.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              <p className="col-span-2"><span className="font-semibold">Freight :</span> {record.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>

            <table className="w-full text-[11px] border-collapse border-t border-[#111827] mt-2">
              <tbody>
                <tr>
                  <td className="align-top border-r border-[#111827] w-1/3 p-2">
                    <p className="font-semibold">Size</p><p>{record.size || "-"}</p>
                    <p className="font-semibold mt-3">Balance Advance</p><p>{(record.advanceBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </td>
                  <td className="align-top p-2">
                    <p className="font-semibold text-center border-b border-[#111827] pb-1 mb-1">Advance Details</p>
                    <table className="w-full text-[10px]">
                      <thead><tr className="border-b border-[#111827]"><th className="py-0.5 text-left font-semibold">Date</th><th className="py-0.5 text-left font-semibold">Description</th><th className="py-0.5 text-right font-semibold">Amount</th></tr></thead>
                      <tbody>
                        {advances.length ? advances.map((a, i) => <tr key={i}><td className="pr-2 py-0.5">{a.date}</td><td className="pr-2 py-0.5">{a.mode}</td><td className="text-right py-0.5">{a.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>) : <tr><td colSpan={3} className="py-1 text-[#9CA3AF]">No advance entries</td></tr>}
                      </tbody>
                    </table>
                    <div className="border-t border-[#111827] mt-2 pt-1 flex justify-between"><span className="font-semibold">Total Advance</span><span>{totalAdvance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Extra</span><span>{extra.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Balance</span><span>{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="w-full text-[11px] border-collapse border-t border-[#111827] mt-2">
              <tbody>
                {chargesLeft.map(([label, value], i) => <tr key={label}><td className="border-r border-[#111827] px-2 py-1 w-1/4">{label}</td><td className="border-r border-[#111827] px-2 py-1 text-right w-1/4">{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td className="border-r border-[#111827] px-2 py-1 w-1/4">{chargesRight[i]?.[0] ?? ""}</td><td className="px-2 py-1 text-right w-1/4">{chargesRight[i] ? chargesRight[i][1].toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}</td></tr>)}
                <tr className="border-t border-[#111827] font-semibold"><td colSpan={3} className="px-2 py-1 text-right">Extra:</td><td className="px-2 py-1 text-right">{extra.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table>

            <div className="grid grid-cols-3 text-xs border-t border-[#111827] mt-2 pt-2 gap-y-1">
              <p><span className="font-semibold">Balance Payment Date :</span> {record.balancePaymentDate || "-"}</p>
              <p><span className="font-semibold">Balance Paid :</span> {record.paidAmount ? record.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</p>
              <p><span className="font-semibold">Cash / Bank :</span> {record.paymentMode || "-"}</p>
              <p><span className="font-semibold">Discount :</span> {(record.discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              <p><span className="font-semibold">Chq No. :</span> {record.chequeNeftNumber || "-"}</p>
            </div>
            <p className="text-xs border-t border-[#111827] mt-2 pt-2"><span className="font-semibold">Remark :</span> {record.remarks || ""}</p>

            <div className="grid grid-cols-4 text-[10px] text-center mt-10 pt-2 border-t border-[#111827] gap-2">
              <p>Agent's Signature</p><p>Lorry Owner's Signature</p><p>Driver's Signature</p><p>Dispatching Clerk</p>
            </div>
            <p className="text-right text-[10px] mt-2">Page 1 of 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
function DocRow({ icon, title, subtitle, doc, onView }: { icon: React.ReactNode; title: string; subtitle?: string; doc?: ViewableDoc; onView?: (doc: ViewableDoc) => void }) {
  return <Row>
    {icon}
    <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{title}</p>{subtitle && <p className="text-xs text-[#9CA3AF] truncate">{subtitle}</p>}</div>
    {doc && onView && <button onClick={() => onView(doc)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/70 ring-1 ring-white/70 hover:bg-white"><Eye size={12} />View</button>}
  </Row>;
}

function FormSection({ title }: { title: string }) {
  return <p className="mb-3 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[#8A94A6] border-b border-white/60 pb-1.5">{title}</p>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">{label}<input type={type} value={value} onWheel={(e) => type === "number" && e.currentTarget.blur()} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1d2e]/10" /></label>;
}
function SelectField({ label, value, onChange, options, allowManual = false, manualPlaceholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allowManual?: boolean; manualPlaceholder?: string }) {
  const isKnownValue = options.some((o) => o.value === value);
  const [manual, setManual] = useState(allowManual && value !== "" && !isKnownValue);
  return (
    <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {allowManual && (
          <button type="button" onClick={() => { setManual((m) => !m); onChange(""); }} className="text-[11px] font-semibold text-[#1a1d2e]/55 underline underline-offset-2">
            {manual ? "Choose from list" : "Enter manually"}
          </button>
        )}
      </div>
      {manual ? (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={manualPlaceholder || "Type here"} className="mt-1.5 w-full rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1d2e]/10" />
      ) : (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      )}
    </label>
  );
}
function VehicleSearchField({ label = "Vehicle No.", value, onChange, vehicles, valueKind, onManualChange }: { label?: string; value: string; onChange: (value: string) => void; vehicles: Vehicle[]; valueKind: "id" | "number"; onManualChange?: (value: string) => void }) {
  const selected = vehicles.find((vehicle) => (valueKind === "id" ? vehicle.id : vehicle.number) === value);
  const [query, setQuery] = useState(selected?.number ?? value ?? "");
  // A rented/unregistered vehicle is a valid final selection too. Keep the
  // suggestion list closed once the user has chosen to enter it manually.
  const [manualSelected, setManualSelected] = useState(Boolean(value) && !selected);
  const normalized = query.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const matches = vehicles.filter((vehicle) => vehicle.number.replace(/[^a-z0-9]/gi, "").toLowerCase().includes(normalized)).slice(0, 8);
  const choose = (vehicle: Vehicle) => { setQuery(vehicle.number); setManualSelected(false); onChange(valueKind === "id" ? vehicle.id : vehicle.number); onManualChange?.(""); };
  const chooseManual = () => { const manual = query.trim().toUpperCase(); if (!manual) return; setQuery(manual); setManualSelected(true); if (valueKind === "number") onChange(manual); else onManualChange?.(manual); };
  return <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">
    <span>{label}</span>
    <div className="relative mt-1.5">
      <input value={query} onChange={(event) => { const next = event.target.value.toUpperCase(); setQuery(next); const exact = vehicles.find((vehicle) => vehicle.number.toLowerCase() === next.toLowerCase()); const hasMatches = vehicles.some((vehicle) => vehicle.number.replace(/[^a-z0-9]/gi, "").toLowerCase().includes(next.replace(/[^a-z0-9]/gi, "").toLowerCase())); if (exact) { setManualSelected(false); onChange(valueKind === "id" ? exact.id : exact.number); onManualChange?.(""); } else if (next && !hasMatches) { setManualSelected(true); if (valueKind === "number") onChange(next); else onManualChange?.(next); } else { setManualSelected(false); onChange(""); onManualChange?.(""); } }} placeholder="Type vehicle number, e.g. MH12 or 12" className="w-full rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1d2e]/10" />
      {query && !selected && !manualSelected && <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-2xl border border-white/70 bg-white shadow-xl p-1">{matches.map((vehicle) => <button key={vehicle.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(vehicle)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-slate-100"><b>{vehicle.number}</b><span className="ml-2 text-xs text-[#8A94A6]">{vehicle.model}</span></button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={chooseManual} className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-50">Enter “{query}” manually <span className="ml-1 text-xs font-normal text-[#8A94A6]">(rented / unregistered)</span></button></div>}
    </div>
  </label>;
}
type UploadedFile = { fileName: string; dataUrl: string };
async function uploadFilesToServer(files: File[], type: string): Promise<UploadedFile[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("type", type);
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    headers: currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return (data.files as { fileName: string; url: string }[]).map((f) => ({ fileName: f.fileName, dataUrl: f.url }));
}
function FileField({ label, onFiles, category = "document" }: { label: string; onFiles: (files: UploadedFile[]) => void; category?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  return <div className="mb-4">
    <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#1a1d2e]/15 bg-white/35 px-4 py-6 cursor-pointer"><Upload size={18} /><span className="text-sm font-medium">{busy ? "Uploading..." : label}</span><span className="text-[10px] text-[#a0a3b1]">PDF, JPG, PNG</span>{error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}<input type="file" multiple accept=".pdf,image/*" className="sr-only" onChange={async (e) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadFilesToServer(picked, category);
      setUploaded(uploaded);
      onFiles(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
    }} /></label>
    {uploaded.length > 0 && <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[11px] font-semibold text-emerald-700">Uploaded to Supabase</p><div className="mt-1 flex flex-wrap gap-2">{uploaded.map((file) => <a key={`${file.fileName}-${file.dataUrl}`} href={file.dataUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#1a1d2e] ring-1 ring-emerald-200"><Eye size={12} />View {file.fileName}</a>)}</div></div>}
  </div>;
}

export default function App() {
  // Keep the login only for this browser session: refreshes stay signed in,
  // while closing the browser ends the session and requires login again.
  const [role, setRole] = useState<Role | null>(() => (sessionStorage.getItem("sbr-role") as Role | null) || null);
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem("sbr-token"));
  useEffect(() => { currentAuthToken = authToken; }, [authToken]);
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("sbr-theme") as "light" | "dark") || "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sbr-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    if (!authToken) return;
    apiFetch("/vehicles?limit=200", authToken)
      .then((data) => {
        setVehicles((data.items || []).map(mapVehicleFromApi));
        setVehiclesLoaded(true);
      })
      .catch((err) => setVehiclesError(err instanceof Error ? err.message : "Failed to load vehicles"));
    apiFetch("/drivers?limit=200", authToken)
      .then((data) => setDrivers((data.items || []).map(mapDriverFromApi)))
      .catch((err) => notify("Could not load drivers", err instanceof Error ? err.message : "Failed to load drivers", "alert"));
    apiFetch("/customers?limit=200", authToken)
      .then((data) => setCustomers((data.items || []).map(mapCustomerFromApi)))
      .catch((err) => notify("Could not load customers", err instanceof Error ? err.message : "Failed to load customers", "alert"));
    apiFetch("/trips?limit=200", authToken)
      .then((data) => setTrips((data.items || []).map(mapTripFromApi)))
      .catch((err) => notify("Could not load bookings", err instanceof Error ? err.message : "Failed to load bookings", "alert"));
    apiFetch("/expenses?limit=200", authToken)
      .then((data) => setExpenses((data.items || []).map(mapExpenseFromApi)))
      .catch((err) => notify("Could not load expenses", err instanceof Error ? err.message : "Failed to load expenses", "alert"));
    apiFetch("/companyExpenses?limit=200", authToken)
      .then((data) => setCompanyExpenses((data.items || []).map(mapCompanyExpenseFromApi)))
      .catch((err) => notify("Could not load company expenses", err instanceof Error ? err.message : "Failed to load company expenses", "alert"));
    apiFetch("/emiReminders?limit=200", authToken)
      .then((data) => setEmiReminders((data.items || []).map(mapEmiReminderFromApi)))
      .catch((err) => notify("Could not load EMI reminders", err instanceof Error ? err.message : "Failed to load EMI reminders", "alert"));
    apiFetch("/invoices?limit=200", authToken)
      .then((data) => setInvoices((data.items || []).map(mapInvoiceFromApi)))
      .catch((err) => notify("Could not load invoices", err instanceof Error ? err.message : "Failed to load invoices", "alert"));
    apiFetch("/payments?limit=200", authToken)
      .then((data) => setPayments((data.items || []).map(mapPaymentFromApi)))
      .catch((err) => notify("Could not load payments", err instanceof Error ? err.message : "Failed to load payments", "alert"));
    apiFetch("/maintenance?limit=200", authToken)
      .then((data) => setMaintenancePlan((data.items || []).map(mapMaintenanceFromApi)))
      .catch((err) => notify("Could not load maintenance", err instanceof Error ? err.message : "Failed to load maintenance", "alert"));
    apiFetch("/documents?limit=500", authToken)
      .then((data) => setDocuments((data.items || []).map(mapDocumentFromApi)))
      .catch((err) => notify("Could not load documents", err instanceof Error ? err.message : "Failed to load documents", "alert"));
    apiFetch("/balanceFreights?limit=200", authToken)
      .then((data) => setBalanceFreights((data.items || []).map(mapBalanceFreightFromApi)))
      .catch((err) => notify("Could not load vehicle register", err instanceof Error ? err.message : "Failed to load vehicle register", "alert"));
    apiFetch("/attendance?limit=500", authToken)
      .then((data) => setAttendance((data.items || []).map(mapAttendanceFromApi)))
      .catch((err) => notify("Could not load attendance", err instanceof Error ? err.message : "Failed to load attendance", "alert"));
    apiFetch("/payroll?limit=200", authToken)
      .then((data) => setPayroll((data.items || []).map(mapPayrollFromApi)))
      .catch((err) => notify("Could not load payroll", err instanceof Error ? err.message : "Failed to load payroll", "alert"));
    apiFetch("/company-profile", authToken)
      .then((data) => {
        if (data && Object.keys(data).length) {
          const profile = mapCompanyProfileFromApi(data);
          setCompanyProfile(profile);
          setProfileName(profile.name || PORTAL_NAME);
        }
      })
      .catch((err) => notify("Could not load company settings", err instanceof Error ? err.message : "Failed to load company settings", "alert"));
  }, [authToken]);

  const [view, setViewState] = useState<View>(() => viewFromPath(window.location.pathname));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [vehiclesError, setVehiclesError] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);
  const [emiReminders, setEmiReminders] = useState<EmiReminder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [maintenancePlan, setMaintenancePlan] = useState<MaintenanceRecord[]>([]);
  const [balanceFreights, setBalanceFreights] = useState<BalanceFreightRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  useEffect(() => {
    const now = new Date();
    const elapsedMonths = (startDate: string) => {
      const start = new Date(`${startDate}T00:00:00`);
      return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    };
    const dueNow = emiReminders.filter((item) => {
      const elapsed = elapsedMonths(item.startDate);
      const dueDay = Math.min(item.dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return item.status === "Active" && elapsed >= 0 && elapsed < item.tenureMonths && now.getDate() >= dueDay && !item.paidMonths.includes(thisMonth);
    });
    setNotes((previous) => [
      ...previous.filter((note) => note.type !== "emi"),
      ...dueNow.map((item) => ({ id: `emi-${item.id}-${now.getFullYear()}-${now.getMonth()}`, title: `EMI DUE: ${item.name}`, message: `${rupees(item.amount)} is due on the ${item.dueDay}${item.dueDay === 1 ? "st" : item.dueDay === 2 ? "nd" : item.dueDay === 3 ? "rd" : "th"} of this month.`, type: "emi", read: false, createdAt: today })),
    ]);
  }, [emiReminders]);
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<ViewableDoc | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<DriverPayment | null>(null);
  const [earningsDriverId, setEarningsDriverId] = useState<string | null>(null);
  const [billTripId, setBillTripId] = useState<string | null>(null);
  const [challanRecordId, setChallanRecordId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState<Record<string, string>>({});
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [profileName, setProfileName] = useState(PORTAL_NAME);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(seedApiConfig);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(seedCompanyProfile);
  const [telemetryLog, setTelemetryLog] = useState<Record<string, TelemetryLogEntry[]>>({});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    const onPopState = () => setViewState(viewFromPath(window.location.pathname));
    const timer = window.setInterval(() => setLastRefresh(new Date()), 30000);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Tracker values are intentionally not simulated. The fleet UI only shows
  // telemetry received from an actual connected tracker/API.

  const customer = (id: string) => customers.find((c) => c.id === id);
  const vehicle = (id: string) => vehicles.find((v) => v.id === id);
  const driver = (id: string) => drivers.find((d) => d.id === id);
  const tripExpenses = (tripId: string) => expenses.filter((e) => e.tripId === tripId).reduce((s, e) => s + e.amount, 0);
  const tripProfit = (trip: Trip) => trip.freight - tripExpenses(trip.id);
  const completedTrips = trips.filter((t) => t.status === "Completed");
  const revenue = trips.reduce((s, t) => s + t.freight, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const unread = notes.filter((n) => !n.read).length;
  const setView = (next: View) => {
    if (removedPortalViews.has(next)) next = "dashboard";
    setViewState(next);
    const route = routeByView[next];
    if (route && window.location.pathname !== route) window.history.pushState({}, "", route);
  };

  function openFreightBill(id: string) {
    const record = trips.find((trip) => trip.id === id);
    if (!record) return;
    if (!record.billNo) {
      const updated = { ...record, billNo: nextDocumentNumber(trips.map((trip) => trip.billNo)) };
      setTrips((items) => items.map((trip) => trip.id === id ? updated : trip));
      if (isMongoId(id)) apiFetch(`/trips/${id}`, authToken, { method: "PATCH", body: JSON.stringify(tripToApiPayload(updated)) })
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Bill number was not saved.", "alert"));
    }
    setBillTripId(id);
  }

  function openChallan(id: string) {
    const record = balanceFreights.find((item) => item.id === id);
    if (!record) return;
    if (!record.challanNo) {
      const updated = { ...record, challanNo: nextDocumentNumber(balanceFreights.map((item) => item.challanNo)) };
      setBalanceFreights((items) => items.map((item) => item.id === id ? updated : item));
      if (isMongoId(id)) apiFetch(`/balanceFreights/${id}`, authToken, { method: "PATCH", body: JSON.stringify(balanceFreightToApiPayload(updated)) })
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Challan number was not saved.", "alert"));
    }
    setChallanRecordId(id);
  }

  function notify(title: string, message: string, type = "system") {
    setNotes((n) => [{ id: uid("note"), title, message, type, read: false, createdAt: today }, ...n]);
  }
  function openModal(name: string, seed: Record<string, string> = {}) { setForm(seed); setModal(name); }
  function handlePodUpload(tripId: string, files: UploadedFile[]) {
    const podUrls = files.map((f) => f.dataUrl);
    setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, podDocs: [...t.podDocs, ...podUrls] } : t));
    notify("POD uploaded", `${files.length} file(s) attached to ${tripId}.`, "document");
    if (/^[0-9a-f]{24}$/i.test(tripId)) {
      const trip = trips.find((t) => t.id === tripId);
      const podDocs = [...(trip?.podDocs || []), ...podUrls];
      apiFetch(`/trips/${tripId}/pod`, authToken, { method: "PATCH", body: JSON.stringify({ podDocs }) }).catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "POD was not saved to the database.", "alert"));
    }
  }
  function updateTripStatus(id: string, status: TripStatus) {
    const trip = trips.find((t) => t.id === id);
    if (!trip) return;
    const updatedTrip = { ...trip, status };
    setTrips((prev) => prev.map((t) => t.id === id ? updatedTrip : t));
    if (status === "In Transit" || status === "Assigned") {
      markAttendance(trip.driverId, trip.date, "Present", "Auto-marked: vehicle running on trip");
      setVehicles((prev) => prev.map((v) => v.id === trip.vehicleId ? { ...v, status: "On Trip" } : v));
    }
    if (status === "Completed" || status === "Cancelled") {
      setVehicles((prev) => prev.map((v) => v.id === trip.vehicleId ? { ...v, status: "Available" } : v));
    }
    if (isMongoId(id)) {
      apiFetch(`/trips/${id}`, authToken, { method: "PATCH", body: JSON.stringify(tripToApiPayload(updatedTrip)) })
        .then((doc) => setTrips((prev) => prev.map((item) => item.id === id ? mapTripFromApi(doc) : item)))
        .catch((err) => {
          setTrips((prev) => prev.map((item) => item.id === id ? trip : item));
          notify("Cloud save failed", err instanceof Error ? err.message : "Trip status was not saved to the database.", "alert");
        });
    }
    notify("Trip status updated", `${id} changed to ${status}.`, "trip");
  }
  function persistInvoicePatch(id: string, patch: Record<string, unknown>) {
    if (isMongoId(id)) apiFetch(`/invoices/${id}`, authToken, { method: "PATCH", body: JSON.stringify(patch) }).catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Invoice was not updated in the database.", "alert"));
  }
  function persistPayment(payment: Payment) {
    if (!isMongoId(payment.invoiceId) || !isMongoId(payment.customerId)) return;
    apiFetch("/payments", authToken, { method: "POST", body: JSON.stringify(paymentToApiPayload(payment)) })
      .then((doc) => setPayments((prev) => prev.map((x) => x.id === payment.id ? mapPaymentFromApi(doc) : x)))
      .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Payment was not saved to the database.", "alert"));
  }
  function markPaid(id: string) {
    const invoice = invoices.find((i) => i.id === id);
    const balance = invoice ? (invoice.total ?? 0) - (invoice.paidAmount ?? 0) : 0;
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: "Paid", paidAt: today, paidAmount: i.total ?? i.paidAmount ?? 0 } : i));
    if (invoice && balance > 0) {
      const payment: Payment = { id: uid("RCPT"), invoiceId: id, customerId: invoice.customerId, amount: balance, method: "Bank Transfer", reference: "Manual receipt", paidAt: today };
      setPayments((prev) => [payment, ...prev]);
      persistPayment(payment);
    }
    persistInvoicePatch(id, { status: "Paid", paidAt: today, paidAmount: invoice?.total ?? invoice?.paidAmount ?? 0 });
    notify("Payment received", `${id} marked paid and customer balance updated.`, "payment");
  }
  function setInvoiceStatusQuick(id: string, status: PaymentStatus) {
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return;
    if (status === "Paid") { markPaid(id); return; }
    if (status === "Partial" && (invoice.paidAmount ?? 0) <= 0) { openModal("invoicePayment", { invoiceId: id, status: "Partial", amount: "" }); return; }
    if (status === "Pending") { setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: "Pending", paidAmount: 0, paidAt: "" } : i)); persistInvoicePatch(id, { status: "Pending", paidAmount: 0, paidAt: null }); notify("Invoice status updated", `${id} set back to Pending.`, "payment"); return; }
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    persistInvoicePatch(id, { status });
    notify("Invoice status updated", `${id} marked ${status}.`, "payment");
  }
  function recordInvoicePayment() {
    const invoice = invoices.find((i) => i.id === form.invoiceId);
    if (!invoice) return;
    const total = invoice.total ?? 0;
    const currentPaid = invoice.paidAmount ?? 0;
    const outstanding = Math.max(total - currentPaid, 0);
    const status = (form.status || "Paid") as "Paid" | "Partial" | "Pending";
    const amount = status === "Paid" ? outstanding : status === "Pending" ? 0 : Math.min(Number(form.amount || 0), outstanding);
    const paidAmount = currentPaid + amount;
    const nextStatus: PaymentStatus = paidAmount >= total ? "Paid" : paidAmount > 0 ? "Partial" : invoice.status === "Overdue" ? "Overdue" : "Pending";
    setInvoices((prev) => prev.map((i) => i.id === invoice.id ? { ...i, status: nextStatus, paidAt: nextStatus === "Paid" ? today : i.paidAt, paidAmount } : i));
    persistInvoicePatch(invoice.id, { status: nextStatus, paidAt: nextStatus === "Paid" ? today : invoice.paidAt, paidAmount });
    if (amount > 0) {
      const payment: Payment = { id: uid("RCPT"), invoiceId: invoice.id, customerId: invoice.customerId, amount, method: form.method || "Bank Transfer", reference: form.reference || "Manual receipt", paidAt: form.paidAt || today };
      setPayments((prev) => [payment, ...prev]);
      persistPayment(payment);
    }
    notify("Payment updated", `${invoice.id} paid ${rupees(amount)}. Pending balance ${rupees(Math.max(total - paidAmount, 0))}.`, "payment");
    setModal(null);
  }
  function saveTrip(files: UploadedFile[]) {
    const podUrls = files.map((file) => file.dataUrl).filter(Boolean);
    let advances: AdvanceEntry[] = [];
    try { advances = JSON.parse(form.advancesJson || "[]"); } catch { advances = []; }
    const totalAdvance = advances.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    if (form.id) {
      const existing = trips.find((trip) => trip.id === form.id);
      if (!existing) return;
      const updatedTrip: Trip = {
        ...existing,
        customerId: form.customerId || existing.customerId, vehicleId: form.vehicleId || "", manualVehicleNumber: form.manualVehicleNumber || undefined,
        lrNumber: form.lrNumber?.trim() || undefined,
        pickup: form.pickup ?? existing.pickup, drop: form.drop ?? existing.drop, cargo: form.cargo ?? existing.cargo,
        size: form.size ?? existing.size, billNo: form.billNo?.trim() || existing.billNo || nextDocumentNumber(trips.map((trip) => trip.billNo)), chNo: form.chNo ?? existing.chNo,
        receivedDate: form.receivedDate ?? existing.receivedDate, date: form.date || existing.date,
        freight: Number(form.freight || 0), advances, advanceAmount: totalAdvance, otherExpenses: Number(form.otherCharges || 0),
        otherChargesReason: form.otherChargesReason ?? existing.otherChargesReason,
        expenseRemarks: form.tripExpenseRemarksJson !== undefined ? parseTripExpenseRemarks(form.tripExpenseRemarksJson) : (existing.expenseRemarks ?? []),
        invoiceNumber: form.invoiceNumber ?? existing.invoiceNumber, paymentStatus: (form.paymentStatus || existing.paymentStatus || "Pending") as PaymentStatus,
        ewayBill: form.ewayBill ?? existing.ewayBill, deliveryReceipt: form.deliveryReceipt ?? existing.deliveryReceipt,
        remarks: form.remarks ?? existing.remarks, podDocs: podUrls.length ? [...existing.podDocs, ...podUrls] : existing.podDocs,
      };
      setTrips((prev) => prev.map((trip) => trip.id === form.id ? updatedTrip : trip));
      notify("Booking updated", `${form.id} details saved.`, "trip");
      setModal(null);
      if (isMongoId(form.id)) {
        apiFetch(`/trips/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(tripToApiPayload(updatedTrip)) })
          .then((doc) => setTrips((prev) => prev.map((trip) => trip.id === form.id ? mapTripFromApi(doc) : trip)))
          .catch((err) => {
            setTrips((prev) => prev.map((trip) => trip.id === form.id ? existing : trip));
            notify("Cloud save failed", err instanceof Error ? err.message : "Booking update was not saved.", "alert");
          });
      }
      return;
    }
    const assignedDriverId = vehicles.find((v) => v.id === form.vehicleId)?.currentDriverId || form.driverId || "";
    const newTrip: Trip = { id: uid("TRIP"), lrNumber: form.lrNumber?.trim() || undefined, customerId: form.customerId, vehicleId: form.vehicleId, manualVehicleNumber: form.manualVehicleNumber || undefined, driverId: assignedDriverId, pickup: form.pickup, drop: form.drop, cargo: form.cargo || "", size: form.size || "", billNo: form.billNo?.trim() || nextDocumentNumber(trips.map((trip) => trip.billNo)), chNo: form.chNo || "", receivedDate: form.receivedDate || "", date: form.date || today, distanceKm: 0, durationHrs: 0, freight: Number(form.freight || 0), advances, advanceAmount: totalAdvance, tollCharges: 0, driverAllowance: 0, otherExpenses: Number(form.otherCharges || 0), otherChargesReason: form.otherChargesReason || "", expenseRemarks: parseTripExpenseRemarks(form.tripExpenseRemarksJson), invoiceNumber: form.invoiceNumber || "", paymentStatus: (form.paymentStatus || "Pending") as PaymentStatus, ewayBill: form.ewayBill || "", deliveryReceipt: form.deliveryReceipt || "", status: "Assigned", podDocs: podUrls, remarks: form.remarks || "" };
    setTrips((t) => [newTrip, ...t]);
    setVehicles((v) => v.map((x) => x.id === newTrip.vehicleId ? { ...x, status: "On Trip" } : x));
    if (assignedDriverId) { setDrivers((d) => d.map((x) => x.id === assignedDriverId ? { ...x, status: "On Trip", assignedVehicleId: newTrip.vehicleId } : x)); markAttendance(assignedDriverId, newTrip.date, "Present", `Auto-marked: vehicle ${vehicle(newTrip.vehicleId)?.number ?? ""} running trip ${newTrip.id}`); }
    notify("Trip assigned", `${newTrip.id} assigned${driver(assignedDriverId)?.name ? ` to ${driver(assignedDriverId)?.name}` : ""}.`);
    setModal(null);
    apiFetch("/trips", authToken, { method: "POST", body: JSON.stringify(tripToApiPayload(newTrip)) })
      .then((doc) => { const saved = mapTripFromApi(doc); setTrips((t) => t.map((x) => x.id === newTrip.id ? { ...saved, lrNumber: newTrip.lrNumber, podDocs: newTrip.podDocs, remarks: newTrip.remarks } : x)); })
      .catch((err) => {
        setTrips((current) => current.filter((trip) => trip.id !== newTrip.id));
        notify("Cloud save failed", err instanceof Error ? err.message : "Booking was not saved to the database.", "alert");
      });
  }
  function deleteTrip(id: string) {
    const target = trips.find((trip) => trip.id === id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
    notify("Booking deleted", `${id} removed from booking register.`, "trip");
    if (isMongoId(id)) apiFetch(`/trips/${id}`, authToken, { method: "DELETE" }).catch((err) => {
      if (target) setTrips((prev) => [target, ...prev]);
      notify("Cloud delete failed", err instanceof Error ? err.message : "Booking was not removed from the database.", "alert");
    });
  }
  function deleteVehicle(id: string) {
    const target = vehicles.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete vehicle ${target.number}? This cannot be undone.`)) return;
    setVehicles((prev) => prev.filter((item) => item.id !== id));
    setDrivers((prev) => prev.map((item) => item.assignedVehicleId === id ? { ...item, assignedVehicleId: "" } : item));
    setSelected((current) => current === id ? null : current);
    setModal(null);
    notify("Vehicle deleted", `${target.number} was removed from the fleet.`, "alert");
    if (isMongoId(id)) apiFetch(`/vehicles/${id}`, authToken, { method: "DELETE" }).catch((err) => {
      setVehicles((prev) => [target, ...prev]);
      notify("Cloud delete failed", err instanceof Error ? err.message : "Vehicle was not removed from the database.", "alert");
    });
  }
  function deleteDriver(id: string) {
    const target = drivers.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete driver ${target.name}? This cannot be undone.`)) return;
    setDrivers((prev) => prev.filter((item) => item.id !== id));
    setVehicles((prev) => prev.map((item) => item.currentDriverId === id ? { ...item, currentDriverId: undefined } : item));
    notify("Driver deleted", `${target.name} was removed.`, "alert");
    if (isMongoId(id)) apiFetch(`/drivers/${id}`, authToken, { method: "DELETE" }).catch((err) => {
      setDrivers((prev) => [target, ...prev]);
      notify("Cloud delete failed", err instanceof Error ? err.message : "Driver was not removed from the database.", "alert");
    });
  }
  function deleteCustomer(id: string) {
    const target = customers.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete party ${target.company}? This cannot be undone.`)) return;
    setCustomers((prev) => prev.filter((item) => item.id !== id));
    notify("Party deleted", `${target.company} was removed.`, "alert");
    if (isMongoId(id)) apiFetch(`/customers/${id}`, authToken, { method: "DELETE" }).catch((err) => {
      setCustomers((prev) => [target, ...prev]);
      notify("Cloud delete failed", err instanceof Error ? err.message : "Party was not removed from the database.", "alert");
    });
  }
  function saveBalanceFreight() {
    let advances: AdvanceEntry[] = [];
    try { advances = JSON.parse(form.advancesJson || "[]"); } catch { advances = []; }
    const existing = form.id ? balanceFreights.find((item) => item.id === form.id) : undefined;
    const record = calculateBalanceFreight({
      id: form.id || uid("bfr"), loadingDate: form.loadingDate || today, vehicleNumber: form.vehicleNumber || "",
      size: form.size || "", from: form.from || "", to: form.to || "", freight: Number(form.freight || 0),
      advance: 0, partyAdvance: 0,
      commissionPercent: Number(form.commissionPercent || 0),
      commission: Number(form.commission || 0), otherCharges: Number(form.otherCharges || 0), otherChargesReason: form.otherChargesReason || "",
      hamali: Number(form.hamali || 0), payCharge: Number(form.payCharge || 0), partyName: form.partyName || "", chequeNeftNumber: form.chequeNeftNumber || "",
      paidAmount: Number(form.partyAdvance || 0), bank: form.bank || "", paymentDate: form.paymentDate || "", remarks: form.remarks || "",
      billNo: form.billNo?.trim() || existing?.billNo || nextDocumentNumber(balanceFreights.map((item) => item.billNo)), freightId: existing?.freightId || uid("VR"), linkedTrips: existing?.linkedTrips || [],
      invoiceNumber: form.invoiceNumber || "", billingDate: form.billingDate || form.loadingDate || today,
      additionalCharges: 0, discount: Number(form.discount || 0), gst: 0,
      finalAmount: Number(form.freight || 0),
      dueDate: "", paymentMode: form.paymentMode || "Bank Transfer",
      status: (form.status || undefined) as BalanceFreightRecord["status"] | undefined,
      challanNo: form.challanNo?.trim() || existing?.challanNo || nextDocumentNumber(balanceFreights.map((item) => item.challanNo)), ownerName: form.ownerName || "", cnNo: form.cnNo || "",
      weight: form.weight || "", rate: Number(form.rate || 0), advances,
      extraHeight: Number(form.extraHeight || 0), weightRecipt: Number(form.weightRecipt || 0),
      paymentChg: Number(form.paymentChg || 0), challanFineChg: Number(form.challanFineChg || 0),
      unlodingChg: Number(form.unlodingChg || 0), extraWeightChg: Number(form.extraWeightChg || 0),
      extraWidthChg: Number(form.extraWidthChg || 0), balancePaymentDate: form.balancePaymentDate || "",
      advanceBalance: Number(form.advanceBalance || 0),
    });
    const isNew = !form.id;
    setBalanceFreights((prev) => form.id ? prev.map((item) => item.id === form.id ? record : item) : [record, ...prev]);
    notify("Vehicle register entry saved", `${record.vehicleNumber} ${record.from} to ${record.to} net balance is ${rupees(record.balance)}.`, "freight");
    setModal(null);
    const request = isNew
      ? apiFetch("/balanceFreights", authToken, { method: "POST", body: JSON.stringify(balanceFreightToApiPayload(record)) })
      : apiFetch(`/balanceFreights/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(balanceFreightToApiPayload(record)) });
    request
      .then((doc) => setBalanceFreights((prev) => prev.map((x) => x.id === record.id ? mapBalanceFreightFromApi(doc) : x)))
      .catch((err) => {
        setBalanceFreights((prev) => isNew
          ? prev.filter((item) => item.id !== record.id)
          : prev.map((item) => item.id === record.id ? (existing || item) : item));
        notify("Cloud save failed", err instanceof Error ? err.message : "Vehicle register entry was not saved to the database.", "alert");
      });
  }
  function deleteBalanceFreight(id: string) {
    const target = balanceFreights.find((item) => item.id === id);
    setBalanceFreights((prev) => prev.filter((item) => item.id !== id));
    notify("Vehicle register entry deleted", "Vehicle register record removed.", "freight");
    if (isMongoId(id)) apiFetch(`/balanceFreights/${id}`, authToken, { method: "DELETE" }).catch((err) => {
      if (target) setBalanceFreights((prev) => [target, ...prev]);
      notify("Cloud delete failed", err instanceof Error ? err.message : "Record was not removed from the database.", "alert");
    });
  }
  function updateBalanceFreightStatus(id: string, status: BalanceFreightRecord["status"]) {
    let updated: BalanceFreightRecord | undefined;
    setBalanceFreights((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      updated = calculateBalanceFreight({ ...item, status, paymentDate: status === "Paid" && !item.paymentDate ? today : item.paymentDate });
      return updated;
    }));
    notify("Vehicle register status updated", `Record marked ${status}.`, "freight");
    if (isMongoId(id)) apiFetch(`/balanceFreights/${id}`, authToken, { method: "PATCH", body: JSON.stringify({ status }) }).catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Status change was not saved.", "alert"));
  }
  function markAttendance(driverId: string, date: string, status: AttendanceRecord["status"], notes = "") {
    const month = monthKey(date);
    const existing = attendance.find((item) => item.driverId === driverId && item.date === date);
    if (!isMongoId(driverId)) {
      notify("Attendance not saved", "Save the driver to the database before marking attendance.", "alert");
      return;
    }
    const record: AttendanceRecord = { id: existing?.id || uid("att"), driverId, date, month, status, notes };
    setAttendance((prev) => existing ? prev.map((item) => item.driverId === driverId && item.date === date ? record : item) : [record, ...prev]);
    apiFetch("/attendance/entry", authToken, { method: "PUT", body: JSON.stringify(attendanceToApiPayload(record)) })
      .then((doc) => {
        const saved = mapAttendanceFromApi(doc);
        setAttendance((prev) => {
          const withoutCell = prev.filter((item) => !(item.driverId === driverId && item.date === date));
          return [saved, ...withoutCell];
        });
        notify("Attendance saved", `${saved.status} recorded for ${saved.date}.`, "attendance");
      })
      .catch((err) => {
        setAttendance((prev) => {
          const withoutCell = prev.filter((item) => !(item.driverId === driverId && item.date === date));
          return existing ? [existing, ...withoutCell] : withoutCell;
        });
        notify("Attendance was not saved", err instanceof Error ? err.message : "The database rejected this attendance entry.", "alert");
      });
  }
  function clearAttendance(driverId: string, date: string) {
    const existing = attendance.find((item) => item.driverId === driverId && item.date === date);
    if (!existing || !isMongoId(driverId)) return;
    setAttendance((prev) => prev.filter((item) => !(item.driverId === driverId && item.date === date)));
    apiFetch("/attendance/entry", authToken, {
      method: "DELETE",
      body: JSON.stringify({ driver: driverId, date }),
    }).then(() => {
      notify("Attendance removed", `Attendance cleared for ${date}.`, "attendance");
    }).catch((err) => {
      setAttendance((prev) => [existing, ...prev]);
      notify("Attendance was not removed", err instanceof Error ? err.message : "The database could not clear this attendance entry.", "alert");
    });
  }
  function assignDriverToVehicle(vehicleId: string, driverId: string, reason: string) {
    const targetVehicle = vehicles.find((v) => v.id === vehicleId);
    if (!targetVehicle || !driverId) return;
    const newDriver = drivers.find((d) => d.id === driverId);
    const oldDriverId = targetVehicle.currentDriverId;
    const oldDriver = drivers.find((d) => d.id === oldDriverId);
    if (oldDriverId === driverId) { notify("No change", "That driver is already assigned to this vehicle."); return; }
    setVehicles((prev) => prev.map((v) => {
      if (v.id !== vehicleId) return v;
      const closedHistory = (v.driverHistory ?? []).map((h) => (!h.endedAt ? { ...h, endedAt: today } : h));
      return {
        ...v, currentDriverId: driverId,
        driverHistory: [...closedHistory, { driverId, driverName: newDriver?.name ?? "Driver", vehicleId: v.id, vehicleNumber: v.number, assignedAt: today, reason: reason || "Reassigned" }],
      };
    }));
    setDrivers((prev) => prev.map((d) => {
      if (d.id === driverId) return { ...d, assignedVehicleId: vehicleId, status: d.status === "Off Duty" ? "Active" : d.status };
      if (d.id === oldDriverId && d.assignedVehicleId === vehicleId) return { ...d, assignedVehicleId: "" };
      return d;
    }));
    if (isMongoId(vehicleId)) {
      const updatedVehicle = {
        ...targetVehicle,
        currentDriverId: driverId,
        driverHistory: [...(targetVehicle.driverHistory ?? []).map((h) => (!h.endedAt ? { ...h, endedAt: today } : h)), { driverId, driverName: newDriver?.name ?? "Driver", vehicleId: targetVehicle.id, vehicleNumber: targetVehicle.number, assignedAt: today, reason: reason || "Reassigned" }],
      };
      apiFetch(`/vehicles/${vehicleId}`, authToken, { method: "PATCH", body: JSON.stringify(vehicleToApiPayload(updatedVehicle)) })
        .then((doc) => setVehicles((prev) => prev.map((item) => item.id === vehicleId ? mapVehicleFromApi(doc) : item)))
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Vehicle assignment was not saved to the database.", "alert"));
    }
    if (isMongoId(driverId) && newDriver) {
      apiFetch(`/drivers/${driverId}`, authToken, { method: "PATCH", body: JSON.stringify(driverToApiPayload({ ...newDriver, assignedVehicleId: vehicleId })) })
        .then((doc) => setDrivers((prev) => prev.map((item) => item.id === driverId ? mapDriverFromApi(doc) : item)))
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Driver assignment was not saved to the database.", "alert"));
    }
    // A vehicle has one active driver. Clear the former driver's database link
    // as well, otherwise the UI appears correct only until the next reload.
    if (oldDriver && oldDriver.id !== driverId && isMongoId(oldDriver.id)) {
      apiFetch(`/drivers/${oldDriver.id}`, authToken, { method: "PATCH", body: JSON.stringify({ assignedVehicle: null }) })
        .then((doc) => setDrivers((prev) => prev.map((item) => item.id === oldDriver.id ? mapDriverFromApi(doc) : item)))
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Previous driver assignment could not be cleared.", "alert"));
    }
    notify("Driver reassigned", `${newDriver?.name ?? "Driver"} is now assigned to ${targetVehicle.number}.`, "assignment");
  }
  function savePayroll() {
    const record: PayrollRecord = {
      id: form.id || uid("pay"), driverId: form.driverId || "", month: form.month || today.slice(0, 7),
      baseSalary: Number(form.baseSalary || 0), presentDays: Number(form.presentDays || 0), halfDays: Number(form.halfDays || 0),
      leave: Number(form.leave || 0), incentive: Number(form.incentive || 0), bonus: Number(form.bonus || 0),
      penalty: Number(form.penalty || 0), advance: Number(form.advance || 0), advanceReason: form.advanceReason || "", netSalary: 0,
    };
    const perDay = record.baseSalary / 30;
    record.netSalary = Math.round((record.presentDays + record.halfDays * 0.5) * perDay + record.incentive + record.bonus - record.penalty - record.advance);
    const isNew = !form.id;
    setPayroll((prev) => form.id ? prev.map((item) => item.id === form.id ? record : item) : [record, ...prev]);
    notify("Payroll generated", `${driver(record.driverId)?.name ?? "Driver"} net salary is ${rupees(record.netSalary)}.`, "payroll");
    setModal(null);
    const request = isNew
      ? apiFetch("/payroll", authToken, { method: "POST", body: JSON.stringify(payrollToApiPayload(record)) })
      : apiFetch(`/payroll/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(payrollToApiPayload(record)) });
    request
      .then((doc) => setPayroll((prev) => prev.map((x) => x.id === record.id ? mapPayrollFromApi(doc) : x)))
      .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Payroll was not saved to the database.", "alert"));
  }
  function saveMaintenance() {
    const record: MaintenanceRecord = {
      id: form.id || uid("mnt"),
      vehicleId: form.vehicleId || "",
      serviceType: form.serviceType || "Service",
      serviceCost: Number(form.serviceCost || 0),
      workshop: form.workshop || "",
      mechanic: form.mechanic || "",
      partsUsed: form.partsUsed || "",
      serviceIntervalKm: Number(form.serviceIntervalKm || 0),
      mileageReminderKm: Number(form.mileageReminderKm || 0),
      dueDate: form.dueDate || today,
      status: (form.status || "Upcoming") as MaintenanceRecord["status"],
    };
    const isNew = !form.id;
    setMaintenancePlan((prev) => form.id ? prev.map((item) => item.id === form.id ? record : item) : [record, ...prev]);
    if (record.serviceCost > 0 && isNew) {
      const newExpense: Expense = { id: uid("exp"), category: "Maintenance", amount: record.serviceCost, date: record.dueDate, note: `${record.serviceType} service`, vehicleId: record.vehicleId };
      setExpenses((prev) => [newExpense, ...prev]);
      apiFetch("/expenses", authToken, { method: "POST", body: JSON.stringify(expenseToApiPayload(newExpense)) })
        .then((doc) => setExpenses((e) => e.map((x) => x.id === newExpense.id ? mapExpenseFromApi(doc) : x)))
        .catch(() => {});
    }
    notify("Service saved", `${record.serviceType} service updated for ${vehicle(record.vehicleId)?.number ?? "vehicle"}.`, "maintenance");
    setModal(null);
    const request = isNew
      ? apiFetch("/maintenance", authToken, { method: "POST", body: JSON.stringify(maintenanceToApiPayload(record)) })
      : apiFetch(`/maintenance/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(maintenanceToApiPayload(record)) });
    request
      .then((doc) => setMaintenancePlan((prev) => prev.map((x) => x.id === record.id ? mapMaintenanceFromApi(doc) : x)))
      .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Service record was not saved to the database.", "alert"));
  }
  function deleteMaintenance(id: string) {
    const target = maintenancePlan.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete ${target.serviceType} service record? This cannot be undone.`)) return;
    setMaintenancePlan((prev) => prev.filter((item) => item.id !== id));
    if (!isMongoId(id)) return;
    apiFetch(`/maintenance/${id}`, authToken, { method: "DELETE" })
      .then(() => notify("Service deleted", "Service record removed from the database.", "maintenance"))
      .catch((err) => {
        setMaintenancePlan((prev) => [target, ...prev]);
        notify("Cloud delete failed", err instanceof Error ? err.message : "Service record was not removed from the database.", "alert");
      });
  }
  function reassignVehicleDriver() { assignDriverToVehicle(form.vehicleId, form.driverId, form.reason); setModal(null); }
  function reassignDriverVehicle() { assignDriverToVehicle(form.vehicleId, form.driverId, form.reason); setModal(null); }
  function exportCsv(name: string, rows: Record<string, string | number>[]) {
    const csv = [Object.keys(rows[0] ?? {}).join(","), ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${name}.csv`;
    a.click();
  }

  if (!role) return <Login onLogin={(r, token) => { sessionStorage.setItem("sbr-role", r); sessionStorage.setItem("sbr-token", token); setRole(r); setAuthToken(token); setProfileName(PORTAL_NAME); setView(r === "driver" ? "trips" : "dashboard"); }} />;

  const page = (() => {
    if (view === "dashboard") return <Dashboard vehicles={vehicles} drivers={drivers} trips={trips} expenses={expenses} invoices={invoices} notes={notes} documents={documents} maintenancePlan={maintenancePlan} balanceFreights={balanceFreights} attendance={attendance} payroll={payroll} lastRefresh={lastRefresh} setView={setView} />;
    if (view === "vehicles") return <Vehicles vehicles={vehicles} drivers={drivers} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} openModal={openModal} edit={(item) => openModal("vehicle", Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)])))} select={(id) => { setSelected(id); openModal("vehicleDetails"); }} remove={deleteVehicle} />;
    if (view === "liveTracking") return <LiveTracking vehicles={vehicles} drivers={drivers} trips={trips} telemetryLog={telemetryLog} />;
    if (view === "drivers") return <DriversWithDelete drivers={drivers} search={search} setSearch={setSearch} openModal={openModal} edit={(item) => openModal("driver", Object.fromEntries(Object.entries(item).filter(([k]) => k !== "documents").map(([k, v]) => [k, String(v)])))} select={(id) => { setSelected(id); openModal("driverDetails"); }} remove={deleteDriver} />;
    if (view === "customers") return <CustomersWithDelete customers={customers} trips={trips} search={search} setSearch={setSearch} openModal={openModal} remove={deleteCustomer} />;
    if (view === "trips") return <TripsWithView trips={trips} customers={customers} vehicles={vehicles} drivers={drivers} role={role} search={search} setSearch={setSearch} openModal={openModal} updateTripStatus={updateTripStatus} setView={setView} exportCsv={exportCsv} onBill={openFreightBill} edit={(t) => openModal("trip", { ...Object.fromEntries(Object.entries(t).filter(([k]) => k !== "podDocs" && k !== "expenseRemarks" && k !== "advances").map(([k, v]) => [k, String(v ?? "")])), advancesJson: JSON.stringify(t.advances ?? []), tripExpenseRemarksJson: JSON.stringify(t.expenseRemarks ?? []) })} remove={deleteTrip} onPodUpload={handlePodUpload} onView={setDocPreview} />;
    if (view === "expenses" || view === "fuel") return <Expenses view={view} expenses={expenses} trips={trips} vehicles={vehicles} drivers={drivers} openModal={openModal} exportCsv={exportCsv} remove={(id) => {
      const record = expenses.find((item) => item.id === id);
      setExpenses((items) => items.filter((item) => item.id !== id));
      apiFetch(`/expenses/${id}`, authToken, { method: "DELETE" })
        .then(() => notify("Expense deleted", "The expense record was removed from the database."))
        .catch((err) => { if (record) setExpenses((items) => [record, ...items]); notify("Cloud delete failed", err instanceof Error ? err.message : "Expense could not be deleted.", "alert"); });
    }} />;
    if (view === "companyExpenses") return <CompanyExpenses records={companyExpenses} openModal={openModal} remove={(id) => {
      setCompanyExpenses((items) => items.filter((item) => item.id !== id));
      apiFetch(`/companyExpenses/${id}`, authToken, { method: "DELETE" })
        .then(() => notify("Company expense deleted", "The record was removed from the database."))
        .catch((err) => notify("Cloud delete failed", err instanceof Error ? err.message : "Company expense could not be deleted.", "alert"));
    }} exportCsv={exportCsv} />;
    if (view === "emiReminders") return <EmiReminders records={emiReminders} openModal={openModal} markPaid={(id) => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      const updated = emiReminders.find((item) => item.id === id);
      if (!updated) return;
      const next = { ...updated, paidMonths: Array.from(new Set([...updated.paidMonths, thisMonth])) };
      setEmiReminders((items) => items.map((item) => item.id === id ? next : item));
      apiFetch(`/emiReminders/${id}`, authToken, { method: "PATCH", body: JSON.stringify(emiReminderToApiPayload(next)) })
        .then((doc) => { setEmiReminders((items) => items.map((item) => item.id === id ? mapEmiReminderFromApi(doc) : item)); notify("EMI marked paid", "This month’s EMI alert has been cleared."); })
        .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "EMI payment status could not be saved.", "alert"));
    }} remove={(id) => {
      setEmiReminders((items) => items.filter((item) => item.id !== id));
      apiFetch(`/emiReminders/${id}`, authToken, { method: "DELETE" })
        .then(() => notify("EMI reminder deleted", "The reminder was removed from the database."))
        .catch((err) => notify("Cloud delete failed", err instanceof Error ? err.message : "EMI reminder could not be deleted.", "alert"));
    }} />;
    if (view === "maintenance") return <MaintenanceModule records={maintenancePlan} vehicles={vehicles} trips={trips} openModal={openModal} exportCsv={exportCsv} remove={deleteMaintenance} />;
    if (view === "vehicleHealth") return <VehicleHealth vehicles={vehicles} maintenancePlan={maintenancePlan} expenses={expenses} documents={documents} />;
    if (view === "documents") return <Documents documents={documents} search={search} setSearch={setSearch} exportCsv={exportCsv} sendReminder={(doc) => notify("Document reminder sent", `${doc.ownerName} ${doc.type} expires on ${doc.expiryDate}.`, "document")} onView={setDocPreview} />;
    if (view === "salary" || view === "payroll") return <PayrollModule drivers={drivers} attendance={attendance} payroll={payroll} openModal={openModal} exportCsv={exportCsv} />;
    if (view === "balanceFreight") return <BalanceFreightModule records={balanceFreights} vehicles={vehicles} search={search} setSearch={setSearch} openModal={openModal} edit={(record) => openModal("balanceFreight", { ...Object.fromEntries(Object.entries(record).filter(([k]) => k !== "advances" && k !== "linkedTrips").map(([k, v]) => [k, String(v ?? "")])), advancesJson: JSON.stringify(record.advances ?? []) })} remove={deleteBalanceFreight} updateStatus={updateBalanceFreightStatus} exportCsv={exportCsv} setView={setView} onChallan={openChallan} />;
    if (view === "tripReport") return <div><button onClick={() => setView("trips")} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold mb-4" style={glassSubtle}><ChevronRight size={15} className="rotate-180" />Back to Booking Register</button><TripReport trips={trips} expenses={expenses} vehicles={vehicles} drivers={drivers} customers={customers} maintenancePlan={maintenancePlan} exportCsv={exportCsv} /></div>;
    if (view === "freightReport") return <div><button onClick={() => setView("balanceFreight")} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold mb-4" style={glassSubtle}><ChevronRight size={15} className="rotate-180" />Back to Vehicle Register</button><FreightRegisterReport balanceFreights={balanceFreights} exportCsv={exportCsv} /></div>;
    if (view === "attendance") return <AttendanceModule drivers={drivers} records={attendance} markAttendance={markAttendance} clearAttendance={clearAttendance} exportCsv={exportCsv} select={(id) => { setSelected(id); openModal("driverDetails"); }} />;
    if (view === "billing") return <Billing invoices={invoices} payments={payments} trips={trips} customers={customers} balanceFreights={balanceFreights} setInvoiceStatus={setInvoiceStatusQuick} openPayment={(invoice) => openModal("invoicePayment", { invoiceId: invoice.id, status: "Paid", amount: String(Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0)) })} />;
    if (view === "invoices") return <Invoices invoices={invoices} trips={trips} customer={customer} openPayment={(invoice) => openModal("invoicePayment", { invoiceId: invoice.id, status: "Paid", amount: String(Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0)) })} />;
    if (view === "payments") return <Payments invoices={invoices} payments={payments} trips={trips} customer={customer} balanceFreights={balanceFreights} openPayment={(invoice) => openModal("invoicePayment", { invoiceId: invoice.id, status: "Paid", amount: String(Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0)) })} />;
    if (view === "reports" || view === "analytics") return <Reports trips={trips} expenses={expenses} invoices={invoices} vehicles={vehicles} drivers={drivers} customers={customers} documents={documents} maintenancePlan={maintenancePlan} balanceFreights={balanceFreights} exportCsv={exportCsv} />;
    if (view === "performance") return <DriverPerformance drivers={drivers} trips={trips} expenses={expenses} payroll={payroll} />;
    if (view === "notifications") return <Notifications notes={notes} setNotes={setNotes} />;
    if (view === "api") return <ApiSettings config={apiConfig} setConfig={setApiConfig} notify={notify} />;
    if (view === "users") return <UsersSettings profileName={profileName} role={role} authToken={authToken} />;
    if (view === "roles") return <RolesSettings />;
    if (view === "company") return <CompanySettings profile={companyProfile} setProfile={setCompanyProfile} setProfileName={setProfileName} authToken={authToken} notify={notify} />;
    return <Settings role={role} setRole={setRole} profileName={profileName} setProfileName={setProfileName} />;
  })();

  return (
    <Shell view={view} setView={setView} role={role} logout={() => { setRole(null); setAuthToken(null); sessionStorage.removeItem("sbr-role"); sessionStorage.removeItem("sbr-token"); }} unread={unread} profileName={profileName} theme={theme} toggleTheme={toggleTheme}>
      {page}
      {modal === "vehicle" && <Modal title={form.id ? "Edit Vehicle" : "Add Vehicle"} onClose={() => setModal(null)}><VehicleForm form={form} setForm={setForm} drivers={drivers} onSave={(files) => {
        const existing = vehicles.find((x) => x.id === form.id);
        const isNew = !form.id;
        const vehicleId = form.id || uid("veh");
        const newDriverId = form.currentDriverId || existing?.currentDriverId || "";
        const driverChanged = newDriverId && newDriverId !== existing?.currentDriverId;
        const newDriverName = drivers.find((d) => d.id === newDriverId)?.name ?? "Driver";
        const closedHistory = (existing?.driverHistory ?? []).map((h) => (!h.endedAt && driverChanged ? { ...h, endedAt: today } : h));
        const driverHistory = driverChanged ? [...closedHistory, { driverId: newDriverId, driverName: newDriverName, vehicleId, vehicleNumber: form.number, assignedAt: today, reason: existing ? "Reassigned via vehicle edit" : "Initial assignment" }] : (existing?.driverHistory ?? []);
        const replacementCategories = new Set(files.filter((file) => file.category !== "Other").map((file) => file.category));
        const item: Vehicle = { ...existing, id: vehicleId, number: form.number, model: form.model, type: form.type, chassisNumber: form.chassisNumber, engineNumber: form.engineNumber, ownerName: form.ownerName, ownerPhone: form.ownerPhone, registrationDate: form.registrationDate, fitnessExpiry: form.fitnessExpiry, currentDriverId: newDriverId || undefined, driverHistory, billingHistory: existing?.billingHistory ?? [], documentHistory: [...(existing?.documentHistory ?? []), ...files.map((f) => f.fileName)], status: (form.status || "Available") as Status, capacity: form.capacity || "20 tons", rcExpiry: form.rcExpiry, insuranceExpiry: form.insuranceExpiry, permitExpiry: form.permitExpiry, pucExpiry: form.pucExpiry || form.permitExpiry, documents: [...(existing?.documents ?? []).filter((document) => document.category === "Other" || !replacementCategories.has(document.category)), ...files.map((f) => ({ id: uid("vdoc"), category: f.category, fileName: f.fileName, dataUrl: f.dataUrl }))], telemetry: existing?.telemetry ?? defaultTelemetry({ status: (form.status || "Available") as Status }) };
        setVehicles((v) => form.id ? v.map((x) => x.id === form.id ? item : x) : [item, ...v]);
        if (driverChanged) setDrivers((d) => d.map((x) => {
          if (x.id === newDriverId) return { ...x, assignedVehicleId: vehicleId };
          if (x.id === existing?.currentDriverId && x.assignedVehicleId === vehicleId) return { ...x, assignedVehicleId: "" };
          return x;
        }));
        notify(form.id ? "Vehicle updated" : "Vehicle added", `${form.number} is ready for assignment.`);
        setModal(null);
        const request = isNew
          ? apiFetch("/vehicles", authToken, { method: "POST", body: JSON.stringify(vehicleToApiPayload(item)) })
          : apiFetch(`/vehicles/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(vehicleToApiPayload(item)) });
        request
          .then((doc) => {
            const saved = mapVehicleFromApi(doc);
            setVehicles((v) => v.map((x) => x.id === vehicleId ? { ...saved, driverHistory: item.driverHistory, telemetry: item.telemetry, documents: item.documents } : x));
          })
          .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Vehicle was not saved to the database.", "alert"));
      }} /></Modal>}
      {modal === "driver" && <Modal title={form.id ? "Edit Driver" : "Add Driver"} onClose={() => setModal(null)}><DriverForm form={form} setForm={setForm} vehicles={vehicles} onSave={(docs) => {
        if (!form.name?.trim() || !form.phone?.trim() || !form.license?.trim()) {
          notify("Driver not saved", "Full name, mobile number, and driving license number are required.", "alert");
          return;
        }
        const existing = drivers.find((x) => x.id === form.id);
        const isNew = !form.id;
        const driverId = form.id || uid("drv");
        const mergedDocs = [...(existing?.documents ?? []), ...docs.map((doc) => ({ id: uid("doc"), category: doc.category, fileName: doc.fileName, dataUrl: doc.dataUrl }))];
        const newVehicleId = form.assignedVehicleId || existing?.assignedVehicleId || "";
        const vehicleChanged = newVehicleId && newVehicleId !== existing?.assignedVehicleId;
        const item: Driver = { id: driverId, name: form.name, phone: form.phone, license: form.license, licenseExpiry: form.licenseExpiry, aadhaar: form.aadhaar, pan: form.pan, address: form.address, emergencyContact: form.emergencyContact, joiningDate: form.joiningDate, assignedVehicleId: newVehicleId || undefined, earnings: Number(form.earnings || existing?.earnings || 0), paymentHistory: existing?.paymentHistory ?? [], status: existing?.status ?? "Active", salary: Number(form.salary || 0), documents: mergedDocs };
        const request = isNew
          ? apiFetch("/drivers", authToken, { method: "POST", body: JSON.stringify(driverToApiPayload(item)) })
          : apiFetch(`/drivers/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(driverToApiPayload(item)) });
        request
          .then((doc) => {
            const saved = mapDriverFromApi(doc);
            const persisted = { ...saved, assignedVehicleId: item.assignedVehicleId, documents: item.documents };
            setDrivers((d) => form.id ? d.map((x) => x.id === form.id ? persisted : x) : [persisted, ...d]);
            if (vehicleChanged) {
              const targetVehicle = vehicles.find((v) => v.id === newVehicleId);
              setVehicles((v) => v.map((x) => {
                if (x.id === newVehicleId) {
                  const closedHistory = (x.driverHistory ?? []).map((h) => (!h.endedAt ? { ...h, endedAt: today } : h));
                  return { ...x, currentDriverId: saved.id, driverHistory: [...closedHistory, { driverId: saved.id, driverName: item.name, vehicleId: x.id, vehicleNumber: x.number, assignedAt: today, reason: existing ? "Reassigned via driver edit" : "Initial assignment" }] };
                }
                if (x.id === existing?.assignedVehicleId && x.currentDriverId === driverId) return { ...x, currentDriverId: undefined };
                return x;
              }));
              if (targetVehicle) notify("Vehicle assigned", `${item.name} is now assigned to ${targetVehicle.number}.`, "assignment");
            }
            if (vehicleChanged && /^[0-9a-f]{24}$/i.test(newVehicleId)) {
              apiFetch(`/vehicles/${newVehicleId}`, authToken, { method: "PATCH", body: JSON.stringify({ currentDriver: saved.id }) }).catch(() => {});
            }
            notify(form.id ? "Driver updated" : "Driver added", `${item.name} was saved to the database.`, "driver");
            setModal(null);
          })
          .catch((err) => notify("Driver not saved", err instanceof Error ? err.message : "The database rejected the driver record. Please correct the details and try again.", "alert"));
      }} /></Modal>}
      {modal === "driverDetails" && selected && driver(selected) && <Modal title="Driver Info & Documents" onClose={() => setModal(null)}><DriverDetails driver={driver(selected) as Driver} onView={setDocPreview} vehicles={vehicles} onSelectPayment={(p) => { setModal(null); setPaymentPreview(p); }} onSelectEarnings={() => { setModal(null); setEarningsDriverId(selected); }} onReassignVehicle={() => { const d = driver(selected) as Driver; setModal(null); openModal("reassignVehicle", { driverId: d.id, vehicleId: d.assignedVehicleId || "", reason: "" }); }} /></Modal>}
      {modal === "customer" && <Modal title={form.id ? "Edit Party" : "Add Party"} onClose={() => setModal(null)}><CustomerForm form={form} setForm={setForm} onSave={() => {
        const isNew = !form.id;
        const customerId = form.id || uid("cus");
        const item: Customer = { id: customerId, company: form.company, contact: form.contact, phone: form.phone, email: form.email, gst: form.gst, address: form.address, creditLimit: Number(form.creditLimit || 0) };
        setCustomers((c) => form.id ? c.map((x) => x.id === form.id ? item : x) : [item, ...c]);
        notify(form.id ? "Party updated" : "Party added", `${form.company} added for bookings and GST invoices.`);
        setModal(null);
        const request = isNew
          ? apiFetch("/customers", authToken, { method: "POST", body: JSON.stringify(customerToApiPayload(item)) })
          : apiFetch(`/customers/${form.id}`, authToken, { method: "PATCH", body: JSON.stringify(customerToApiPayload(item)) });
        request
          .then((doc) => setCustomers((c) => c.map((x) => x.id === customerId ? mapCustomerFromApi(doc) : x)))
          .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Party was not saved to the database.", "alert"));
      }} /></Modal>}
      {modal === "trip" && <Modal title={form.id ? "Edit Booking" : "Create Booking"} onClose={() => setModal(null)}><TripForm form={form} setForm={setForm} customers={customers} vehicles={vehicles} onSave={saveTrip} /></Modal>}
      {modal === "companyExpense" && <Modal title="Add Company Expense" onClose={() => setModal(null)}><CompanyExpenseForm form={form} setForm={setForm} onSave={() => {
        const item: CompanyExpense = { id: uid("company-exp"), name: form.name || "Company expense", amount: Number(form.amount || 0), date: form.date || today, note: form.note || "", type: "Expense", reminderDate: "", status: "Paid" };
        setCompanyExpenses((items) => [item, ...items]);
        setModal(null);
        apiFetch("/companyExpenses", authToken, { method: "POST", body: JSON.stringify(companyExpenseToApiPayload(item)) })
          .then((doc) => { setCompanyExpenses((items) => items.map((entry) => entry.id === item.id ? mapCompanyExpenseFromApi(doc) : entry)); notify("Company expense saved", "Saved permanently to the database."); })
          .catch((err) => { setCompanyExpenses((items) => items.filter((entry) => entry.id !== item.id)); notify("Cloud save failed", err instanceof Error ? err.message : "Company expense was not saved to the database.", "alert"); });
      }} /></Modal>}
      {modal === "emiReminder" && <Modal title="Add EMI Reminder" onClose={() => setModal(null)}><EmiReminderForm form={form} setForm={setForm} onSave={() => {
        const item: EmiReminder = { id: uid("emi"), name: form.name || "EMI", amount: Number(form.amount || 0), dueDay: Math.min(31, Math.max(1, Number(form.dueDay || 1))), tenureMonths: Math.max(1, Number(form.tenureMonths || 1)), startDate: form.startDate || today, note: form.note || "", status: "Active", paidMonths: [] };
        setEmiReminders((items) => [item, ...items]);
        setModal(null);
        apiFetch("/emiReminders", authToken, { method: "POST", body: JSON.stringify(emiReminderToApiPayload(item)) })
          .then((doc) => { setEmiReminders((items) => items.map((entry) => entry.id === item.id ? mapEmiReminderFromApi(doc) : entry)); notify("EMI reminder saved", `You will see a bold reminder every month on day ${item.dueDay}.`, "emi"); })
          .catch((err) => { setEmiReminders((items) => items.filter((entry) => entry.id !== item.id)); notify("Cloud save failed", err instanceof Error ? err.message : "EMI reminder was not saved to the database.", "alert"); });
      }} /></Modal>}
      {modal === "expense" && <Modal title="Add Expense" onClose={() => setModal(null)}><ExpenseForm form={form} setForm={setForm} trips={trips} vehicles={vehicles} onSave={() => {
        const category = form.category === "Custom" ? (form.customCategory || "Custom expense").trim() : (form.category || "Other");
        const liters = form.liters ? Number(form.liters) : undefined;
        const vehicleId = form.vehicleId || undefined;
        const newExpense: Expense = { id: uid("exp"), tripId: form.tripId || undefined, vehicleId, category, amount: Number(form.amount || 0), date: form.date || today, note: form.note, liters, mileage: form.mileage ? Number(form.mileage) : undefined };
        setExpenses((e) => [newExpense, ...e]);
        if (category === "Fuel" && vehicleId && liters) {
          // Fuel entries are recorded vehicle-wise: refuelling tops up that vehicle's own fuel level.
          setVehicles((v) => v.map((x) => x.id === vehicleId ? { ...x, telemetry: { ...telemetryOf(x), fuelLevel: Math.min(100, Math.round((telemetryOf(x).fuelLevel + liters / 2.5) * 10) / 10) } } : x));
        }
        notify("Expense recorded", `${rupees(Number(form.amount || 0))} added to accounts.`);
        setModal(null);
        apiFetch("/expenses", authToken, { method: "POST", body: JSON.stringify(expenseToApiPayload(newExpense)) })
          .then((doc) => setExpenses((e) => e.map((x) => x.id === newExpense.id ? mapExpenseFromApi(doc) : x)))
          .catch((err) => notify("Cloud save failed", err instanceof Error ? err.message : "Expense was not saved to the database.", "alert"));
      }} /></Modal>}
      {modal === "service" && <Modal title={form.id ? "Edit Service" : "Add Service"} onClose={() => setModal(null)}><ServiceForm form={form} setForm={setForm} vehicles={vehicles} onSave={saveMaintenance} /></Modal>}
      {modal === "balanceFreight" && <Modal title={form.id ? "Edit Vehicle Register Entry" : "Add Vehicle Register Entry"} onClose={() => setModal(null)}><BalanceFreightForm form={form} setForm={setForm} vehicles={vehicles} onSave={saveBalanceFreight} /></Modal>}
      {modal === "attendanceNote" && <Modal title="Attendance Note" onClose={() => setModal(null)}><AttendanceNoteForm form={form} setForm={setForm} onSave={() => { markAttendance(form.driverId, form.date, (form.status || "Present") as AttendanceRecord["status"], form.vehicleLast4 || form.notes || ""); setModal(null); }} /></Modal>}
      {modal === "payroll" && <Modal title={form.id ? "Edit Payroll" : "Generate Payroll"} onClose={() => setModal(null)}><PayrollForm form={form} setForm={setForm} drivers={drivers} attendance={attendance} onSave={savePayroll} /></Modal>}
      {modal === "invoicePayment" && <Modal title="Update Payment" onClose={() => setModal(null)}><PaymentForm form={form} setForm={setForm} invoices={invoices} onSave={recordInvoicePayment} /></Modal>}
      {modal === "vehicleDetails" && selected && vehicle(selected) && <Modal title="Vehicle Details" onClose={() => setModal(null)}><VehicleDetails vehicle={vehicle(selected) as Vehicle} onView={setDocPreview} drivers={drivers} onReassignDriver={() => { const v = vehicle(selected) as Vehicle; setModal(null); openModal("reassignDriver", { vehicleId: v.id, driverId: v.currentDriverId || "", reason: "" }); }} /></Modal>}
      {modal === "reassignDriver" && <Modal title="Change Assigned Driver" onClose={() => setModal(null)}><ReassignDriverForm form={form} setForm={setForm} drivers={drivers} vehicles={vehicles} onSave={reassignVehicleDriver} /></Modal>}
      {modal === "reassignVehicle" && <Modal title="Change Assigned Vehicle" onClose={() => setModal(null)}><ReassignVehicleForm form={form} setForm={setForm} drivers={drivers} vehicles={vehicles} onSave={reassignDriverVehicle} /></Modal>}
      {paymentPreview && <Modal title="Payment Details" onClose={() => setPaymentPreview(null)}><PaymentDetails payment={paymentPreview} driverName={driver(paymentPreview.driverId)?.name} /></Modal>}
      {earningsDriverId && driver(earningsDriverId) && <Modal title="Earnings Breakdown" onClose={() => setEarningsDriverId(null)}><EarningsDetails driver={driver(earningsDriverId) as Driver} /></Modal>}
      {globalSearchOpen && <GlobalSearch onClose={() => setGlobalSearchOpen(false)} vehicles={vehicles} drivers={drivers} customers={customers} trips={trips} invoices={invoices} expenses={expenses} documents={documents} setView={setView} />}
      {docPreview && <DocumentViewerModal doc={docPreview} onClose={() => setDocPreview(null)} />}
      {billTripId && trips.find((t) => t.id === billTripId) && <FreightBillModal trip={trips.find((t) => t.id === billTripId) as Trip} customer={customer(trips.find((t) => t.id === billTripId)?.customerId || "")} vehicle={vehicle(trips.find((t) => t.id === billTripId)?.vehicleId || "")} company={companyProfile} onClose={() => setBillTripId(null)} />}
      {challanRecordId && balanceFreights.find((r) => r.id === challanRecordId) && <ChallanModal record={balanceFreights.find((r) => r.id === challanRecordId) as BalanceFreightRecord} vehicle={vehicles.find((v) => v.number === balanceFreights.find((r) => r.id === challanRecordId)?.vehicleNumber)} company={companyProfile} onClose={() => setChallanRecordId(null)} />}
    </Shell>
  );
}

function Dashboard({ vehicles, drivers, trips, expenses, invoices, notes, documents, maintenancePlan, balanceFreights, attendance, payroll, lastRefresh, setView }: { vehicles: Vehicle[]; drivers: Driver[]; trips: Trip[]; expenses: Expense[]; invoices: Invoice[]; notes: Notification[]; documents: DocumentRecord[]; maintenancePlan: MaintenanceRecord[]; balanceFreights: BalanceFreightRecord[]; attendance: AttendanceRecord[]; payroll: PayrollRecord[]; lastRefresh: Date; setView: (v: View) => void }) {
  const revenue = trips.reduce((s, t) => s + t.freight, 0);
  const expense = expenses.reduce((s, e) => s + e.amount, 0);
  // Build every chart strictly from saved portal records. No demo months or
  // placeholder values are added when the business has not entered data yet.
  const monthly = new Map<string, { trips: number; revenue: number; expense: number; fuel: number }>();
  const monthKey = (value?: string) => /^\d{4}-\d{2}/.test(value || "") ? (value as string).slice(0, 7) : null;
  const ensureMonth = (key: string) => {
    const current = monthly.get(key) ?? { trips: 0, revenue: 0, expense: 0, fuel: 0 };
    monthly.set(key, current);
    return current;
  };
  trips.forEach((trip) => {
    const key = monthKey(trip.date);
    if (!key) return;
    const current = ensureMonth(key);
    current.trips += 1;
    current.revenue += Number(trip.freight || 0);
  });
  expenses.forEach((entry) => {
    const key = monthKey(entry.date);
    if (!key) return;
    const current = ensureMonth(key);
    current.expense += Number(entry.amount || 0);
    if (entry.category === "Fuel") current.fuel += Number(entry.amount || 0);
  });
  const chartData = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => ({
      month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      ...value,
      profit: value.revenue - value.expense,
    }));
  const categoryData = ["Fuel", "Toll", "Maintenance", "Salary", "Allowance", "Parking", "Other"].map((name) => ({ name, value: expenses.filter((e) => e.category === name).reduce((s, e) => s + e.amount, 0) })).filter((item) => item.value > 0);
  const pendingInvoices = invoices.filter((i) => i.status !== "Paid");
  const outstanding = pendingInvoices.reduce((s, i) => s + ((i.total ?? (trips.find((t) => t.id === i.tripId)?.freight ?? 0) * 1.18) - (i.paidAmount ?? 0)), 0);
  const todayAttendance = attendance.filter((item) => item.date === today);
  const balanceFreightTotal = balanceFreights.reduce((s, item) => s + item.freight, 0);
  const pendingFreight = balanceFreights.reduce((s, item) => s + item.balance, 0);
  const kpis = [
    { label: "Vehicle Register Total", value: rupees(balanceFreightTotal), icon: ClipboardList, accent: "#2563EB", sub: `${balanceFreights.length} register records` },
    { label: "Pending Amount", value: rupees(pendingFreight), icon: CreditCard, accent: "#DC2626", sub: "vehicle register" },
    { label: "Advance Collected", value: rupees(balanceFreights.reduce((s, item) => s + (item.paidAmount || item.advance || 0), 0)), icon: CheckCircle2, accent: "#10B981", sub: "advance collected" },
    { label: "Today's Attendance", value: todayAttendance.filter((item) => item.status === "Present").length, icon: Calendar, accent: "#14B8A6", sub: `${todayAttendance.length} marked` },
    { label: "Absent Drivers", value: todayAttendance.filter((item) => item.status === "Absent").length, icon: UserCheck, accent: "#EF4444", sub: "today" },
    { label: "Monthly Salary Expense", value: rupees(payroll.filter((item) => item.month === today.slice(0, 7)).reduce((s, item) => s + item.netSalary, 0)), icon: IndianRupee, accent: "#F59E0B", sub: "payroll" },
    { label: "Total Revenue", value: rupees(revenue), icon: IndianRupee, accent: "#10B981", sub: "freight income" },
    { label: "Total Expenses", value: rupees(expense), icon: Receipt, accent: "#F97316", sub: "all categories" },
    { label: "Total Profit", value: rupees(revenue - expense), icon: BarChart3, accent: "#2563EB", sub: `${Math.round(((revenue - expense) / Math.max(revenue, 1)) * 100)}% margin` },
    { label: "Active Trips", value: trips.filter((t) => ["Assigned", "In Transit"].includes(t.status)).length, icon: Route, accent: "#6366F1", sub: `${trips.filter((t) => t.status === "Completed").length} completed` },
    { label: "Pending Trips", value: trips.filter((t) => ["Draft", "Assigned"].includes(t.status)).length, icon: Calendar, accent: "#8B5CF6", sub: "dispatch queue" },
    { label: "Trucks Available", value: vehicles.filter((v) => v.status === "Available").length, icon: Truck, accent: "#0EA5E9", sub: `${vehicles.filter((v) => v.status === "On Trip").length} on trip` },
    { label: "Under Maintenance", value: vehicles.filter((v) => v.status === "Under Maintenance").length, icon: Wrench, accent: "#EF4444", sub: `${maintenancePlan.filter((m) => m.status !== "Completed").length} due items` },
    { label: "Drivers Available", value: drivers.filter((d) => d.status === "Active").length, icon: UserCheck, accent: "#14B8A6", sub: `${drivers.filter((d) => d.status === "On Trip").length} on duty` },
    { label: "Pending Invoices", value: pendingInvoices.length, icon: FileText, accent: "#F59E0B", sub: `${invoices.filter((i) => i.status === "Overdue").length} overdue` },
    { label: "Outstanding Payments", value: rupees(outstanding), icon: CreditCard, accent: "#DC2626", sub: "customer ledger" },
    { label: "Today's Fuel Cost", value: rupees(expenses.filter((e) => e.category === "Fuel" && e.date === today).reduce((s, e) => s + e.amount, 0)), icon: Fuel, accent: "#0891B2", sub: "diesel entries" },
    { label: "Upcoming Renewals", value: documents.filter((d) => d.status !== "Valid").length, icon: ShieldCheck, accent: "#CA8A04", sub: "90 day alert window" },
  ];
  return <div>
    <Toolbar title="Executive Dashboard" subtitle={`Auto-refreshing logistics cockpit · refreshed ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`} action={<button onClick={() => setView("trips")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />New Booking</button>} />
    <div className="grid grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-4">{kpis.map((k) => <div key={k.label} className="rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={glass}><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${k.accent}18` }}><k.icon size={18} color={k.accent} /></div><p className="mt-4 text-2xl font-extrabold break-words">{k.value}</p><p className="text-sm text-[#6B7280]">{k.label}</p><p className="text-xs text-[#9CA3AF]">{k.sub}</p></div>)}</div>
    <div className="grid xl:grid-cols-3 gap-4 mt-4">
      <ChartPanel title="Revenue, Expense & Profit Trend" className="xl:col-span-2"><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `₹${v / 1000}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Legend /><Area dataKey="revenue" fill="#10B98122" stroke="#10B981" /><Line dataKey="expense" stroke="#F97316" /><Bar dataKey="profit" fill="#2563EB" radius={[5, 5, 0, 0]} /></ComposedChart></ChartPanel>
      <ChartPanel title="Expense Category Pie"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={82} paddingAngle={4}>{categoryData.map((_, i) => <Cell key={i} fill={["#2563EB", "#F97316", "#10B981", "#8B5CF6", "#F59E0B", "#14B8A6", "#64748B"][i % 7]} />)}</Pie><Tooltip formatter={(v) => rupees(Number(v))} /><Legend /></PieChart></ChartPanel>
      <ChartPanel title="Trips Per Month"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="trips" fill="#6366F1" radius={[6, 6, 0, 0]} /></BarChart></ChartPanel>
      <ChartPanel title="Fuel Cost Trend"><LineChartShim data={chartData} dataKey="fuel" color="#0891B2" /></ChartPanel>
      <ChartPanel title="Vehicle & Driver Utilization"><BarChart data={[{ name: "Vehicles", used: vehicles.filter((v) => v.status === "On Trip").length, free: vehicles.filter((v) => v.status === "Available").length }, { name: "Drivers", used: drivers.filter((d) => d.status === "On Trip").length, free: drivers.filter((d) => d.status === "Active").length }]}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="used" stackId="a" fill="#2563EB" /><Bar dataKey="free" stackId="a" fill="#10B981" /></BarChart></ChartPanel>
    </div>
    <div className="grid lg:grid-cols-5 gap-4 mt-4">
      <DashboardList title="Recent Trips" view="trips" setView={setView} items={trips.slice(0, 4).map((t) => ({ id: t.id, title: `${t.pickup} to ${t.drop}`, meta: `${t.status} · ${rupees(t.freight)}` }))} />
      <DashboardList title="Recent Expenses" view="expenses" setView={setView} items={expenses.slice(0, 4).map((e) => ({ id: e.id, title: e.category, meta: `${e.date} · ${rupees(e.amount)}` }))} />
      <DashboardList title="Recent Invoices" view="invoices" setView={setView} items={invoices.slice(0, 4).map((i) => ({ id: i.id, title: i.status, meta: `${i.dueDate} · ${rupees(i.total ?? 0)}` }))} />
      <DashboardList title="Upcoming Maintenance" view="maintenance" setView={setView} items={maintenancePlan.slice(0, 4).map((m) => ({ id: m.id, title: m.serviceType, meta: `${vehicles.find((v) => v.id === m.vehicleId)?.number} · ${m.dueDate}` }))} />
      <DashboardList title="Upcoming Renewals" view="documents" setView={setView} items={documents.filter((d) => d.status !== "Valid").slice(0, 4).map((d) => ({ id: d.id, title: `${d.ownerName} · ${d.type}`, meta: `${d.status} · ${d.expiryDate}` }))} />
    </div>
    <div className="rounded-2xl p-6 mt-4" style={glass}><h3 className="font-bold">Recent Notifications</h3><div className="mt-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3">{notes.slice(0, 8).map((n) => <div key={n.id} className="flex gap-3 p-3 rounded-xl" style={glassSubtle}><AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" /><div><p className="text-sm font-semibold">{n.title}</p><p className="text-xs text-[#9CA3AF]">{n.message}</p></div></div>)}</div></div>
  </div>;
}

function ChartPanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl p-6 ${className}`} style={glass}><h3 className="font-bold mb-4">{title}</h3><div className="h-64"><ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer></div></div>;
}

function LineChartShim({ data, dataKey, color }: { data: Record<string, string | number>[]; dataKey: string; color: string }) {
  return <ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `₹${v / 1000}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Line dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 4 }} /></ComposedChart>;
}

function DashboardList({ title, items, view, setView }: { title: string; items: { id: string; title: string; meta: string }[]; view: View; setView: (v: View) => void }) {
  return <div className="rounded-2xl p-5" style={glass}><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{title}</h3><button onClick={() => setView(view)} className="text-xs font-semibold text-blue-700">View</button></div><div className="mt-3 space-y-2">{items.length ? items.map((item) => <button key={item.id} onClick={() => setView(view)} className="w-full text-left p-3 rounded-xl transition-all hover:bg-white/55" style={glassSubtle}><p className="text-sm font-semibold truncate">{item.title}</p><p className="text-xs text-[#9CA3AF] truncate">{item.meta}</p></button>) : <EmptyState label="No records" />}</div></div>;
}

type TileMode = "Satellite" | "Road" | "Terrain";
const TILE_LAYERS: Record<TileMode, { url: string; attribution: string }> = {
  Satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles &copy; Esri" },
  Road: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors" },
  Terrain: { url: "https://tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenTopoMap contributors" },
};
const parseLat = (value: string) => { const n = parseFloat(value); return value.trim().toUpperCase().endsWith("S") ? -n : n; };
const parseLng = (value: string) => { const n = parseFloat(value); return value.trim().toUpperCase().endsWith("W") ? -n : n; };

function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, Math.max(map.getZoom(), 11), { duration: 0.8 }); }, [center[0], center[1]]);
  return null;
}
function MapControls({ tileMode, setTileMode }: { tileMode: TileMode; setTileMode: (m: TileMode) => void }) {
  const map = useMap();
  return <>
    <div className="absolute left-6 top-6 flex rounded-2xl bg-white p-1.5 shadow-xl z-[1000]">
      {(["Satellite", "Road", "Terrain"] as TileMode[]).map((mode) => <button key={mode} onClick={() => setTileMode(mode)} className={`px-5 py-3 rounded-xl text-sm font-bold ${tileMode === mode ? "bg-[#0B111C] text-white" : "text-[#52708D]"}`}>{mode}</button>)}
    </div>
    <div className="absolute right-5 top-5 space-y-3 z-[1000]">
      <button onClick={() => map.zoomIn()} title="Zoom in" className="h-14 w-14 rounded-2xl bg-white text-[#0B111C] flex items-center justify-center shadow-xl"><Plus size={22} /></button>
      <button onClick={() => map.zoomOut()} title="Zoom out" className="h-14 w-14 rounded-2xl bg-white text-[#0B111C] flex items-center justify-center shadow-xl"><Minus size={22} /></button>
      <button onClick={() => map.setView(map.getCenter(), 11)} title="Reset zoom" className="h-14 w-14 rounded-2xl bg-white text-[#0B111C] flex items-center justify-center shadow-xl"><Locate size={22} /></button>
    </div>
  </>;
}
function FleetMap({ vehicles, selectedId, telemetryOf }: { vehicles: Vehicle[]; selectedId: string | null; telemetryOf: (v: Vehicle) => VehicleTelemetry }) {
  const [tileMode, setTileMode] = useState<TileMode>("Satellite");
  const selected = vehicles.find((v) => v.id === selectedId);
  const selT = selected ? telemetryOf(selected) : null;
  const center: [number, number] = selT ? [parseLat(selT.latitude), parseLng(selT.longitude)] : [19.7515, 75.7139];
  const layer = TILE_LAYERS[tileMode];
  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom zoomControl={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer url={layer.url} attribution={layer.attribution} />
      {vehicles.map((v) => {
        const t = telemetryOf(v);
        const lat = parseLat(t.latitude);
        const lng = parseLng(t.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return <Marker key={v.id} position={[lat, lng]}><Popup><b>{v.number}</b><br />{t.location}<br />{t.speed} km/h - {t.ignition}</Popup></Marker>;
      })}
      <MapFlyTo center={center} />
      <MapControls tileMode={tileMode} setTileMode={setTileMode} />
    </MapContainer>
  );
}

function LiveTracking({ vehicles, drivers, trips, telemetryLog }: { vehicles: Vehicle[]; drivers: Driver[]; trips: Trip[]; telemetryLog: Record<string, TelemetryLogEntry[]> }) {
  const [selectedId, setSelectedId] = useState<string | null>(vehicles.find((v) => v.status === "On Trip")?.id ?? vehicles[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Running" | "Moving" | "Idle" | "Offline">("All");
  const [mapView, setMapView] = useState<"map" | "list">("map");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [bottomTab, setBottomTab] = useState<"Location" | "Ignition" | "Stops" | "Fuel">("Location");
  const driverNameFor = (vehicleId: string) => drivers.find((d) => trips.some((t) => t.vehicleId === vehicleId && t.driverId === d.id))?.name ?? "Unassigned";
  const rows = vehicles.map((v) => ({ vehicle: v, telemetry: telemetryOf(v), driverName: driverNameFor(v.id) }));
  const filteredRows = rows.filter(({ vehicle, telemetry, driverName }) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || vehicle.number.toLowerCase().includes(q) || driverName.toLowerCase().includes(q);
    const matchesFilter = filter === "All"
      || (filter === "Running" && vehicle.status === "On Trip")
      || (filter === "Moving" && telemetry.speed > 0)
      || (filter === "Idle" && telemetry.speed === 0 && vehicle.status !== "Under Maintenance")
      || (filter === "Offline" && telemetry.apiSync === "Offline");
    return matchesSearch && matchesFilter;
  });
  const selected = vehicles.find((v) => v.id === selectedId) ?? vehicles[0];
  const selectedTrip = trips.find((t) => t.vehicleId === selected?.id);
  const selectedDriver = drivers.find((d) => d.id === selectedTrip?.driverId);
  const selectedTelemetry = selected ? telemetryOf(selected) : defaultTelemetry();
  const progress = [
    { title: selectedTrip?.pickup ?? "Mumbai, MH", sub: "Departed - 04:15 AM", state: "done", icon: MapPin },
    { title: "Pune Toll, MH", sub: "Crossed - 06:48 AM", state: "done", icon: CheckCircle2 },
    { title: selectedTrip?.drop ?? "Satara, MH", sub: "08:47 AM - On Route", state: "current", icon: Truck },
    { title: "Kolhapur, MH", sub: "ETA - 11:30 AM", state: "next", icon: Navigation },
  ];
  const selectedLog = telemetryLog[selected?.id ?? ""] ?? [];
  const stops = useMemo(() => computeStops(selectedLog), [selectedLog]);
  const ignitionEvents = useMemo(() => computeIgnitionEvents(selectedLog), [selectedLog]);
  const onlineVehicles = vehicles.filter((v) => telemetryOf(v).apiSync !== "Offline").length;
  return <div className="min-h-[calc(100vh-40px)] text-[#111827]">
    <div className="flex items-start gap-4 mb-5">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h2 className="text-[32px] leading-none font-extrabold tracking-tight">Live Tracking</h2>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />LIVE</span>
        </div>
        <p className="mt-2 text-sm text-[#607086]">Refreshed at <b className="text-[#111827]">{selectedTelemetry.lastUpdated}</b> - {onlineVehicles} of {vehicles.length} vehicles online</p>
      </div>
      <div className="hidden lg:flex items-center gap-4">
        <div className="w-[265px] h-12 rounded-2xl bg-white flex items-center gap-3 px-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"><Search size={19} color="#52708D" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle / driver..." className="bg-transparent outline-none text-sm w-full placeholder:text-[#8A94A6]" /></div>
        <button className="relative h-12 w-12 rounded-2xl bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] flex items-center justify-center"><Bell size={19} /><span className="absolute -top-2 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">7</span></button>
        <button className="h-12 rounded-2xl bg-[#0B111C] text-white px-7 shadow-[0_10px_24px_rgba(15,23,42,0.18)] text-sm font-bold"><Plus size={17} className="inline mr-2" />New Trip</button>
      </div>
    </div>

    <div className="grid xl:grid-cols-[300px_390px_1fr] gap-5">
      <div className="rounded-[22px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.07)] flex flex-col max-h-[760px]">
        <div className="p-4 border-b border-[#EEF4FA]">
          <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold">Live Vehicles</h3><span className="text-xs font-bold text-emerald-600 bg-emerald-100 rounded-full px-2.5 py-1">{rows.filter((r) => r.telemetry.speed > 0).length} active</span></div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={glassSubtle}><Search size={14} color="#8A94A6" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle..." className="bg-transparent outline-none text-sm w-full placeholder:text-[#8A94A6]" /></div>
          <div className="flex flex-wrap gap-1.5">{(["All", "Running", "Moving", "Idle", "Offline"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === f ? "bg-[#0B111C] text-white" : "text-[#607086]"}`} style={filter === f ? {} : glassSubtle}>{f}</button>)}</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredRows.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-8">No vehicles match.</p>}
          {filteredRows.map(({ vehicle, telemetry, driverName }) => {
            const active = vehicle.id === selectedId;
            const dotColor = vehicle.status === "Under Maintenance" ? "bg-red-500" : telemetry.apiSync === "Offline" ? "bg-gray-400" : telemetry.speed > 0 ? "bg-emerald-500" : "bg-amber-500";
            return <button key={vehicle.id} onClick={() => setSelectedId(vehicle.id)} className={`w-full text-left px-4 py-3 border-b border-[#F3F6FB] transition-colors ${active ? "bg-[#EEF4FA]" : "hover:bg-[#F8FBFF]"}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-extrabold flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dotColor}`} />{vehicle.number}</span><span className="text-xs font-bold text-[#607086]">{telemetry.speed} km/h</span></div>
              <p className="text-xs text-[#8A94A6] mt-1">{driverName}</p>
            </button>;
          })}
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[22px] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#223B56] flex items-center justify-center text-white"><Truck size={24} /></div>
            <div className="flex-1"><div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-extrabold">{selected?.number ?? "MH 04 GX 7823"}</h3><Badge label={selected?.status === "On Trip" ? "Running" : selected?.status ?? "Running"} /></div><p className="text-sm text-[#607086]">{selected?.model ?? "Tata Signa 4825.T"} - TN Fleet #{selectedTrip?.id.slice(-2) ?? "18"}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-[#F8FBFF] p-4 text-center"><User size={17} className="mx-auto text-[#52708D]" /><p className="mt-3 font-extrabold">{selectedDriver?.name.split(" ")[0] ?? "Rajan"} K.</p><p className="text-xs text-[#8A94A6]">Driver</p></div>
            <div className="rounded-2xl bg-[#F8FBFF] p-4 text-center"><Package size={17} className="mx-auto text-[#52708D]" /><p className="mt-3 font-extrabold">{selected?.capacity.replace(" tons", "") ?? "18.4"}T</p><p className="text-xs text-[#8A94A6]">Payload</p></div>
            <div className="rounded-2xl bg-[#F8FBFF] p-4 text-center"><Wifi size={17} className="mx-auto text-[#52708D]" /><p className="mt-3 font-extrabold">{selectedTelemetry.gpsSignal}G-Strong</p><p className="text-xs text-[#8A94A6]">Signal</p></div>
          </div>
          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-4 text-amber-700 font-bold"><AlertTriangle size={18} className="inline mr-2" />Harsh braking detected - 08:42 AM</div>
        </div>

        <div className="rounded-[22px] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.07)] max-h-[420px] overflow-y-auto">
          <div className="flex items-center justify-between"><h3 className="text-xl font-extrabold">Trip Progress</h3><span className="rounded-xl bg-[#EEF4FA] px-3 py-1.5 text-sm font-bold text-[#52708D]">Trip #{selectedTrip?.id ?? "TRP-20847"}</span></div>
          <div className="mt-7 space-y-6 relative">
            <div className="absolute left-[21px] top-8 bottom-4 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-300 to-amber-500" />
            {progress.map(({ title, sub, state, icon: Icon }) => <div key={title} className="relative flex gap-4 items-start"><div className={`z-10 h-11 w-11 rounded-full flex items-center justify-center ${state === "current" ? "bg-[#9A8634] text-white" : state === "done" ? "bg-emerald-100 text-emerald-600" : "bg-[#EEF4FA] text-[#52708D]"}`}><Icon size={18} /></div><div><p className="text-lg font-extrabold">{title} {state === "current" && <span className="ml-2 rounded-xl bg-blue-100 text-blue-600 px-2 py-1 text-xs">Current</span>}</p><p className="text-sm text-[#8A94A6]">{sub}</p></div></div>)}
          </div>
        </div>
      </div>

      <div className={mapExpanded ? "fixed inset-4 z-[2000] rounded-[22px] overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.35)] bg-[#07121D]" : "rounded-[22px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.12)] relative min-h-[590px] bg-[#07121D]"}>
        <div className="absolute left-6 top-6 z-[1100] flex rounded-2xl bg-white p-1.5 shadow-xl">
          <button onClick={() => setMapView("map")} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold ${mapView === "map" ? "bg-[#0B111C] text-white" : "text-[#52708D]"}`}><MapIcon size={15} />Map</button>
          <button onClick={() => setMapView("list")} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold ${mapView === "list" ? "bg-[#0B111C] text-white" : "text-[#52708D]"}`}><ListIcon size={15} />List</button>
        </div>
        <button onClick={() => setMapExpanded((v) => !v)} title={mapExpanded ? "Collapse" : "Expand"} className="absolute right-6 top-6 z-[1100] h-11 w-11 rounded-2xl bg-white text-[#0B111C] flex items-center justify-center shadow-xl">
          {mapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        {mapView === "map" ? (
          <FleetMap vehicles={vehicles} selectedId={selectedId} telemetryOf={telemetryOf} />
        ) : (
          <div className={`h-full w-full overflow-y-auto bg-[#07121D] pt-24 pb-6 px-6 ${mapExpanded ? "" : "min-h-[590px]"}`}>
            <div className="space-y-2.5">
              {filteredRows.map(({ vehicle, telemetry, driverName }) => {
                const active = vehicle.id === selectedId;
                const dotColor = vehicle.status === "Under Maintenance" ? "bg-red-500" : telemetry.apiSync === "Offline" ? "bg-gray-400" : telemetry.speed > 0 ? "bg-emerald-500" : "bg-amber-500";
                return <button key={vehicle.id} onClick={() => setSelectedId(vehicle.id)} className={`w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between gap-4 transition-colors ${active ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}>
                  <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} /><div><p className="text-sm font-extrabold text-white">{vehicle.number}</p><p className="text-xs text-white/50">{driverName} - {telemetry.location}</p></div></div>
                  <div className="text-right"><p className="text-sm font-bold text-white">{telemetry.speed} km/h</p><p className="text-xs text-white/50">{vehicle.status}</p></div>
                </button>;
              })}
              {filteredRows.length === 0 && <p className="text-sm text-white/50 text-center py-8">No vehicles match.</p>}
            </div>
          </div>
        )}
        {mapView === "map" && <>
        <div className="absolute left-6 bottom-7 z-[1000] rounded-2xl bg-white px-5 py-3 flex items-center gap-5 shadow-xl text-sm font-bold"><span className="inline-flex items-center gap-2"><span className="h-2 w-10 rounded-full bg-[#7EA6C7]" />Covered</span><span className="inline-flex items-center gap-2"><span className="h-2 w-10 rounded-full bg-[#E9C779]" />Remaining</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#FB7185]" />Alert</span></div>
        <div className="absolute right-7 bottom-7 z-[1000] rounded-[22px] bg-white px-6 py-4 shadow-xl grid grid-cols-3 gap-5 text-center">
          <div><p className="text-3xl font-extrabold">{selectedTelemetry.speed}</p><p className="text-xs text-[#8A94A6]">km/h</p></div>
          <div className="border-x border-[#E7EEF7] px-5"><p className="text-3xl font-extrabold">{selectedTelemetry.distanceTodayKm}</p><p className="text-xs text-[#8A94A6]">km done</p></div>
          <div><p className="text-3xl font-extrabold">{selectedTelemetry.eta}</p><p className="text-xs text-[#8A94A6]">ETA</p></div>
        </div>
        </>}
      </div>
    </div>
    {mapExpanded && <div className="fixed inset-0 z-[1999] bg-black/50" onClick={() => setMapExpanded(false)} />}

    <div className="mt-5 rounded-[22px] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-12 text-[#8A94A6] font-bold">
          {(["Location", "Ignition", "Stops", "Fuel"] as const).map((tab) => <button key={tab} onClick={() => setBottomTab(tab)} className={bottomTab === tab ? "text-[#111827] border-b-2 border-[#D4A029] pb-3" : "pb-3"}>{tab}</button>)}
        </div>
        <p className="text-sm text-[#8A94A6]">Live - updates every few seconds <Download size={14} className="inline ml-3" /> Export</p>
      </div>

      {bottomTab === "Location" && (
        selectedLog.length ? <div className="mt-6 overflow-x-auto"><div className="flex gap-6 min-w-max pb-2">{selectedLog.slice(-10).map((entry, i) => <div key={i} className="text-center w-28"><span className="mx-auto block h-3 w-3 rounded-full ring-8 ring-white bg-[#3B82F6]" /><p className="mt-2 text-xs text-[#8A94A6]">{entry.time}</p><p className="text-xs font-bold truncate" title={entry.location}>{entry.location}</p><p className="text-[10px] text-[#9CA3AF]">{entry.speed} km/h</p></div>)}</div></div>
          : <EmptyState label="Waiting for live location updates..." />
      )}

      {bottomTab === "Ignition" && (
        ignitionEvents.length ? <div className="mt-6 space-y-2">{ignitionEvents.slice().reverse().map((ev, i) => <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={glassSubtle}><span className={`h-2.5 w-2.5 rounded-full ${ev.state === "ON" ? "bg-emerald-500" : "bg-slate-400"}`} /><p className="text-sm font-semibold flex-1">Ignition turned {ev.state}</p><p className="text-xs text-[#8A94A6]">{ev.time}</p></div>)}</div>
          : <EmptyState label="No ignition changes recorded yet" />
      )}

      {bottomTab === "Stops" && (
        stops.length ? <div className="mt-6 space-y-2">{stops.slice().reverse().map((stop, i) => <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={glassSubtle}><AlertTriangle size={16} className="text-amber-500" /><div className="flex-1"><p className="text-sm font-semibold">{stop.location}</p><p className="text-xs text-[#8A94A6]">{stop.start} - {stop.end}</p></div><p className="text-xs font-bold">{stop.ticks * 4}s stopped</p></div>)}</div>
          : <EmptyState label="No stops detected yet - vehicle has been moving" />
      )}

      {bottomTab === "Fuel" && (
        selectedLog.length ? <div className="mt-6"><div className="flex items-end gap-2 h-32">{selectedLog.slice(-16).map((entry, i) => <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1"><div className={`w-full rounded-t-md ${entry.fuelLevel < 25 ? "bg-red-500" : entry.fuelLevel < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ height: `${Math.max(4, entry.fuelLevel)}%` }} title={`${entry.fuelLevel}% at ${entry.time}`} /></div>)}</div><p className="mt-3 text-xs text-[#8A94A6]">Current level <b className="text-[#111827]">{selectedTelemetry.fuelLevel}%</b> - refuel entries recorded per vehicle in the Fuel module update this automatically.</p></div>
          : <EmptyState label="Waiting for fuel readings..." />
      )}
    </div>
  </div>;
}

function VehicleHealth({ vehicles, maintenancePlan, expenses, documents }: { vehicles: Vehicle[]; maintenancePlan: MaintenanceRecord[]; expenses: Expense[]; documents: DocumentRecord[] }) {
  const maintenanceCost = expenses.filter((e) => e.category === "Maintenance").reduce((s, e) => s + e.amount, 0);
  const rows = vehicles.map((v) => {
    const service = maintenancePlan.find((m) => m.vehicleId === v.id);
    const docDue = documents.filter((d) => d.ownerId === v.id && d.status !== "Valid").length;
    const score = vehicleHealthScore(v, service, docDue);
    return { vehicle: v, service, docDue, score };
  });
  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / Math.max(rows.length, 1));
  return <div><Toolbar title="Vehicle Health" subtitle="Fleet health, fuel, battery, GPS and service signals" />
    <div className="grid md:grid-cols-6 gap-4 mb-4"><Metric title="Total Fleet" value={String(vehicles.length)} /><Metric title="Running" value={String(vehicles.filter((v) => v.status === "On Trip").length)} /><Metric title="Moving" value={String(vehicles.filter((v) => telemetryOf(v).speed > 0).length)} /><Metric title="Offline" value={String(vehicles.filter((v) => telemetryOf(v).apiSync === "Offline").length)} /><Metric title="Service Due" value={String(maintenancePlan.filter((m) => m.status !== "Completed").length)} /><Metric title="Maintenance Cost" value={rupees(maintenanceCost)} /></div>
    <div className="grid xl:grid-cols-[340px_1fr] gap-4">
      <div className="space-y-4"><div className="rounded-2xl p-6" style={glass}><h3 className="font-bold">Fleet Health Score</h3><div className="mt-7 mx-auto w-44 h-24 rounded-t-full border-[18px] border-b-0 border-[#14B8A6]/25 relative"><div className="absolute left-1/2 bottom-0 w-1 h-20 bg-[#12151C] origin-bottom" style={{ transform: `translateX(-50%) rotate(${Math.max(-70, Math.min(70, avgScore - 50))}deg)` }} /></div><p className="text-5xl font-extrabold text-center">{avgScore}%</p><p className="text-xs text-[#9CA3AF] text-center mt-2">Overall system vitality index</p></div><DataCard>{maintenancePlan.slice(0, 4).map((m) => <Row key={m.id}><AlertTriangle size={16} /><div className="flex-1"><p className="text-sm font-semibold">{m.serviceType}</p><p className="text-xs text-[#9CA3AF]">{vehicles.find((v) => v.id === m.vehicleId)?.number} - {m.dueDate}</p></div><Badge label={m.status} /></Row>)}</DataCard></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map(({ vehicle, service, docDue, score }) => { const t = telemetryOf(vehicle); return <div key={vehicle.id} className="rounded-2xl p-5" style={glass}><div className="flex justify-between gap-3"><div><p className="text-sm font-bold">{vehicle.number}</p><p className="text-xs text-[#9CA3AF]">{vehicle.model}</p></div><Badge label={score >= 80 ? "Good" : score >= 65 ? "Watch" : "Service"} /></div><div className="mt-5 flex items-end gap-3"><p className="text-3xl font-extrabold">{score}</p><span className="text-xs text-[#9CA3AF] mb-1">health</span></div><div className="h-2 rounded-full bg-white/60 mt-3 overflow-hidden"><div className={`h-full rounded-full ${score < 65 ? "bg-red-500" : score < 80 ? "bg-amber-500" : "bg-[#14B8A6]"}`} style={{ width: `${score}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#6B7280]"><p><Fuel size={12} className="inline mr-1" />{t.fuelLevel}%</p><p><Battery size={12} className="inline mr-1" />{t.batteryVoltage}V</p><p><Wifi size={12} className="inline mr-1" />GPS {t.gpsSignal}/5</p><p><Gauge size={12} className="inline mr-1" />{t.speed} km/h</p></div><div className="mt-4 space-y-1 text-xs text-[#6B7280]"><p>Service: {service?.status ?? "Clear"}</p><p>Documents due: {docDue}</p><p>Engine: {t.engineHealth} - Oil {t.oilHealth}%</p><p>Tyres: {t.tyrePressure}</p></div></div>; })}</div>
    </div>
  </div>;
}

function Billing({ invoices, payments, trips, customers, balanceFreights, setInvoiceStatus, openPayment }: { invoices: Invoice[]; payments: Payment[]; trips: Trip[]; customers: Customer[]; balanceFreights: BalanceFreightRecord[]; setInvoiceStatus: (id: string, status: PaymentStatus) => void; openPayment: (invoice: Invoice) => void }) {
  const customer = (id: string) => customers.find((c) => c.id === id);
  const pending = invoices.reduce((s, i) => s + Math.max((i.total ?? 0) - (i.paidAmount ?? 0), 0), 0);
  // Billing must only show records returned by the database; displaying a
  // sample charge here makes an empty database look like it contains data.
  const freightCharges = balanceFreights;
  const statusOptions: PaymentStatus[] = ["Pending", "Partial", "Paid", "Overdue"];
  const [tripFilter, setTripFilter] = useState<"All" | "Pending" | "Partial">("All");
  const filteredInvoices = invoices.filter((i) => tripFilter === "All" || i.status === tripFilter);
  const filteredFreightCharges = freightCharges.filter((f) => tripFilter === "All" || (tripFilter === "Partial" ? f.status === "Partially Paid" : f.status === tripFilter));
  return <div><Toolbar title="Billing" subtitle="Invoice list, payment status, customer billing and freight charges" filters={<label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><span className="text-[#8A94A6] text-xs">Trip Status</span><select value={tripFilter} onChange={(e) => setTripFilter(e.target.value as "All" | "Pending" | "Partial")} className="bg-transparent outline-none text-sm font-semibold"><option value="All">All</option><option value="Pending">Pending</option><option value="Partial">Partial</option></select></label>} action={<button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Printer size={15} />Print/PDF</button>} />
    <div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Invoice List" value={String(invoices.length)} /><Metric title="Payment Status" value={rupees(pending)} /><Metric title="Party Billing" value={String(customers.length)} /><Metric title="Freight Charges" value={rupees(freightCharges.reduce((s, f) => s + f.freight, 0))} /></div>
    <div className="grid xl:grid-cols-2 gap-4">
      <DataCard>{filteredInvoices.length ? filteredInvoices.map((i) => { const t = trips.find((x) => x.id === i.tripId); const balance = Math.max((i.total ?? 0) - (i.paidAmount ?? 0), 0); return <Row key={i.id}><FileText size={18} /><div className="flex-1"><p className="text-sm font-semibold">{i.id}</p><p className="text-xs text-[#9CA3AF]">{customer(i.customerId)?.company} - {t?.pickup} to {t?.drop}</p></div><p className="text-sm font-bold">{rupees(balance)}</p><select value={i.status} onChange={(e) => setInvoiceStatus(i.id, e.target.value as PaymentStatus)} className="rounded-xl px-3 py-2 text-xs font-semibold outline-none" style={glassSubtle}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>{i.status !== "Paid" && <button onClick={() => openPayment(i)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600">Update</button>}</Row>; }) : <EmptyState label="No invoices match this filter" />}</DataCard>
      <DataCard>{filteredFreightCharges.length ? filteredFreightCharges.map((f) => <Row key={f.id}><ClipboardList size={18} /><div className="flex-1"><p className="text-sm font-semibold">{f.partyName || "Customer Billing"}</p><p className="text-xs text-[#9CA3AF]">{f.vehicleNumber} - {f.from} to {f.to}</p></div><p className="text-xs">Paid {rupees(f.paidAmount || f.advance || 0)}</p><p className="text-sm font-bold">{rupees(f.balance)}</p><Badge label={f.status} /></Row>) : <EmptyState label="No freight charges match this filter" />}</DataCard>
      <div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">Payment Status</h3><div className="space-y-2">{payments.length ? payments.map((p) => <p key={p.id} className="flex justify-between text-sm rounded-xl p-3" style={glassSubtle}><span>{p.id} - {customer(p.customerId)?.company}</span><b>{rupees(p.amount)}</b></p>) : <EmptyState label="No payments recorded" />}</div></div>
      <div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">Party Billing</h3><div className="space-y-2">{customers.map((c) => <p key={c.id} className="flex justify-between text-sm rounded-xl p-3" style={glassSubtle}><span>{c.company}</span><b>{invoices.filter((i) => i.customerId === c.id).length} invoices</b></p>)}</div></div>
    </div>
  </div>;
}

function Vehicles({ vehicles, drivers, search, setSearch, filter, setFilter, openModal, edit, select, remove }: { vehicles: Vehicle[]; drivers: Driver[]; search: string; setSearch: (v: string) => void; filter: string; setFilter: (v: string) => void; openModal: (m: string) => void; edit: (vehicle: Vehicle) => void; select: (id: string) => void; remove: (id: string) => void }) {
  const filtered = vehicles.filter((v) => (filter === "All" || v.status === filter) && `${v.number} ${v.model}`.toLowerCase().includes(search.toLowerCase()));
  return <div><Toolbar title="Fleet Vehicles" subtitle={`${vehicles.length} total - ${vehicles.filter((v) => v.status === "On Trip").length} running - SBR Portal telemetry ready`} search={search} setSearch={setSearch} filters={<><select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option>All</option><option>Available</option><option>On Trip</option><option>Under Maintenance</option></select><button className="px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Filter size={14} className="inline mr-1" />Columns</button></>} action={<button onClick={() => openModal("vehicle")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Vehicle</button>} />
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4"><Metric title="Total Fleet" value={String(vehicles.length)} /><Metric title="Running" value={String(vehicles.filter((v) => v.status === "On Trip").length)} /><Metric title="Idle" value={String(vehicles.filter((v) => v.status === "Available").length)} /><Metric title="Offline" value={String(vehicles.filter((v) => telemetryOf(v).apiSync === "Offline").length)} /><Metric title="Maintenance" value={String(vehicles.filter((v) => v.status === "Under Maintenance").length)} /><Metric title="Avg Speed" value={`${Math.round(vehicles.reduce((s, v) => s + telemetryOf(v).speed, 0) / Math.max(vehicles.length, 1))} km/h`} /></div>
    <DataCard>
      <div className="hidden xl:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-[#6B7280] border-b border-white/50">
              <th className="w-[56px] px-3 py-3"></th>
              <th className="text-left px-3 py-3">Vehicle No.</th>
              <th className="text-left px-3 py-3">Driver Assigned</th>
              <th className="text-left px-3 py-3">Status</th>
              <th className="text-left px-3 py-3 w-[110px]">Ignition</th>
              <th className="text-left px-3 py-3 w-[100px]">Speed</th>
              <th className="text-left px-3 py-3 w-[130px]">Fuel Level</th>
              <th className="text-left px-3 py-3">Location</th>
              <th className="text-left px-3 py-3 w-[110px]">Battery</th>
              <th className="text-left px-3 py-3 w-[90px]">Signal</th>
              <th className="text-left px-3 py-3 w-[110px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const t = telemetryOf(v);
              return (
                <tr key={v.id} className="border-b border-[#EEF3F8] last:border-b-0 hover:bg-[#F8FBFF] transition-all align-middle">
                  <td className="px-3 py-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.status === "On Trip" ? "#10B98118" : v.status === "Available" ? "#F59E0B18" : "#EF444418" }}><Truck size={18} color={v.status === "On Trip" ? "#10B981" : v.status === "Available" ? "#F59E0B" : "#EF4444"} /></div></td>
                  <td className="px-3 py-4"><p className="text-sm font-extrabold">{v.number}</p><p className="text-xs text-[#9CA3AF]">{v.model}</p></td>
                  <td className="px-3 py-4"><p className="text-xs font-semibold">{drivers.find((d) => d.id === v.currentDriverId)?.name || "Not assigned"}</p></td>
                  <td className="px-3 py-4"><Badge label={v.status} /><p className="mt-1 text-[10px] text-[#9CA3AF]">API {t.apiSync}</p></td>
                  <td className="px-3 py-4"><p className="text-xs font-semibold whitespace-nowrap"><span className={`inline-block w-2 h-2 rounded-full mr-1 ${t.ignition === "ON" ? "bg-emerald-500" : "bg-slate-400"}`} />{t.ignition}</p></td>
                  <td className="px-3 py-4"><p className="text-sm font-bold whitespace-nowrap">{t.speed || "-"} <span className="text-[10px] text-[#9CA3AF]">km/h</span></p></td>
                  <td className="px-3 py-4"><p className="text-xs font-bold">{t.fuelLevel}%</p><div className="h-2 w-full rounded-full bg-white/60 mt-1 overflow-hidden"><div className={`h-full rounded-full ${t.fuelLevel < 25 ? "bg-red-500" : t.fuelLevel < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${t.fuelLevel}%` }} /></div></td>
                  <td className="px-3 py-4"><p className="text-xs font-semibold"><MapPin size={12} className="inline mr-1" />{t.location}</p><p className="text-[10px] text-[#9CA3AF]">Updated {t.lastUpdated}</p></td>
                  <td className="px-3 py-4"><p className="text-xs whitespace-nowrap"><Battery size={13} className="inline mr-1" />{t.batteryVoltage}V</p></td>
                  <td className="px-3 py-4"><p className="text-xs whitespace-nowrap"><Wifi size={13} className="inline mr-1" />{t.gpsSignal}/5</p></td>
                  <td className="px-3 py-4"><div className="flex gap-2"><button onClick={() => select(v.id)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="View Details" style={glassSubtle}><Eye size={15} /></button><button onClick={() => edit(v)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="Edit" style={glassSubtle}><SettingsIcon size={15} /></button><button onClick={() => remove(v.id)} className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600" title="Delete vehicle" style={glassSubtle}><Trash2 size={15} /></button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.map((v) => {
        const t = telemetryOf(v);
        return <Row key={`${v.id}-mobile`} className="xl:hidden">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.status === "On Trip" ? "#10B98118" : v.status === "Available" ? "#F59E0B18" : "#EF444418" }}><Truck size={18} color={v.status === "On Trip" ? "#10B981" : v.status === "Available" ? "#F59E0B" : "#EF4444"} /></div>
          <div className="flex-1 min-w-[150px]"><p className="text-sm font-extrabold">{v.number}</p><p className="text-xs text-[#9CA3AF]">{v.model} · Driver: {drivers.find((d) => d.id === v.currentDriverId)?.name || "Not assigned"}</p><div className="mt-1"><Badge label={v.status} /></div></div>
          <div className="text-xs text-[#6B7280] space-y-0.5"><p>{t.ignition} - {t.speed || 0} km/h</p><p>Fuel {t.fuelLevel}% - {t.location}</p></div>
          <div className="flex gap-2"><button onClick={() => select(v.id)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="View Details" style={glassSubtle}><Eye size={15} /></button><button onClick={() => edit(v)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="Edit" style={glassSubtle}><SettingsIcon size={15} /></button><button onClick={() => remove(v.id)} className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600" title="Delete vehicle" style={glassSubtle}><Trash2 size={15} /></button></div>
        </Row>;
      })}
    </DataCard></div>;
}

function DriversWithDelete({ drivers, search, setSearch, openModal, edit, select, remove }: { drivers: Driver[]; search: string; setSearch: (v: string) => void; openModal: (m: string) => void; edit: (driver: Driver) => void; select: (id: string) => void; remove: (id: string) => void }) {
  return <div className="space-y-4"><Drivers drivers={drivers} search={search} setSearch={setSearch} openModal={openModal} edit={edit} select={select} /><DataCard><div className="px-5 py-3 border-b border-[#EEF3F8]"><p className="text-sm font-bold">Driver record actions</p><p className="text-xs text-[#9CA3AF]">Delete a saved driver record when it is no longer required.</p></div>{drivers.map((driver) => <Row key={driver.id}><Avatar text={initials(driver.name)} /><div className="flex-1"><p className="text-sm font-semibold">{driver.name}</p><p className="text-xs text-[#9CA3AF]">{driver.license}</p></div><button onClick={() => remove(driver.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600"><Trash2 size={13} />Delete</button></Row>)}</DataCard></div>;
}

function Drivers({ drivers, search, setSearch, openModal, edit, select, remove }: { drivers: Driver[]; search: string; setSearch: (v: string) => void; openModal: (m: string) => void; edit: (driver: Driver) => void; select: (id: string) => void; remove?: (id: string) => void }) {
  const filtered = drivers.filter((d) => `${d.name} ${d.license} ${d.phone} ${d.aadhaar} ${d.pan}`.toLowerCase().includes(search.toLowerCase()));
  return <div><Toolbar title="Driver Info & Documents" subtitle={`${drivers.filter((d) => d.status === "Active").length} active · ${drivers.filter((d) => d.status === "On Trip").length} on trip`} search={search} setSearch={setSearch} action={<button onClick={() => openModal("driver")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Driver</button>} /><DataCard>{filtered.map((d) => <Row key={d.id}><Avatar text={initials(d.name)} /><div className="flex-1"><p className="text-sm font-semibold">{d.name}</p><p className="text-xs text-[#9CA3AF]">{d.phone}</p></div><p className="hidden md:block text-xs font-mono">{d.license}</p><p className={daysUntil(d.licenseExpiry) <= 15 ? "text-xs text-amber-600 font-semibold" : "text-xs"}>{d.licenseExpiry}</p><span className="hidden lg:block text-xs text-[#9CA3AF]">{d.documents.length} docs</span><Badge label={d.status} /><div className="flex gap-2"><button onClick={() => select(d.id)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="Driver Info & Documents" style={glassSubtle}><Eye size={15} /></button><button onClick={() => edit(d)} className="w-9 h-9 rounded-xl flex items-center justify-center" title="Edit" style={glassSubtle}><SettingsIcon size={15} /></button></div></Row>)}</DataCard></div>;
}
function DriverDetails({ driver, onView, onSelectPayment, onReassignVehicle, onSelectEarnings, vehicles }: { driver: Driver; onView?: (doc: ViewableDoc) => void; onSelectPayment?: (p: DriverPayment) => void; onReassignVehicle?: () => void; onSelectEarnings?: () => void; vehicles?: Vehicle[] }) {
  const categories: DriverDocument["category"][] = ["License", "Aadhaar", "PAN", "Other"];
  return <div className="space-y-4">
    <div className="rounded-2xl p-5" style={glassSubtle}>
      <div className="flex justify-between gap-3"><div><p className="text-xl font-extrabold">{driver.name}</p><p className="text-xs text-[#9CA3AF]">{driver.phone}</p></div><Badge label={driver.status} /></div>
      <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Mobile Number</p><p className="font-semibold mt-1">{driver.phone}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Driving License</p><p className="font-semibold mt-1">{driver.license}</p><p className="text-[10px] text-[#9CA3AF]">Expiry {driver.licenseExpiry}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Aadhaar Card</p><p className="font-semibold mt-1">{driver.aadhaar || "-"}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">PAN Card</p><p className="font-semibold mt-1">{driver.pan || "-"}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Address</p><p className="font-semibold mt-1">{driver.address || "-"}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Emergency Contact</p><p className="font-semibold mt-1">{driver.emergencyContact || "-"}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Joining Date</p><p className="font-semibold mt-1">{driver.joiningDate || "-"}</p></div>
        <div className="rounded-xl p-3 bg-white/45 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Assigned Vehicle</p><p className="font-semibold mt-1">{vehicles?.find((v) => v.id === driver.assignedVehicleId)?.number || driver.assignedVehicleId || "-"}</p></div>{onReassignVehicle && <button onClick={onReassignVehicle} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold" style={glassSubtle}>Change</button>}</div>
      </div>
    </div>
    <div className="grid md:grid-cols-3 gap-3"><Metric title="Earnings" value={rupees(driver.earnings ?? 0)} onClick={onSelectEarnings} /><Metric title="Payments" value={String(driver.paymentHistory?.length ?? 0)} /><Metric title="Documents" value={String(driver.documents.length)} /></div>
    <DataCard>{(driver.paymentHistory ?? []).map((item) => <Row key={item.id} className={onSelectPayment ? "cursor-pointer" : ""}>
      <div onClick={() => onSelectPayment?.(item)} className="flex-1 flex items-center gap-4 min-w-0">
        <CreditCard size={16} />
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{item.id}</p><p className="text-xs text-[#9CA3AF]">{item.month} - {item.method}</p></div>
        <p className="text-sm font-bold">{rupees(item.amount)}</p>
        <DocumentBadge status={item.status === "Paid" ? "Valid" : item.status === "Overdue" ? "Expired" : "Due 15"} />
      </div>
    </Row>)}{!(driver.paymentHistory ?? []).length && <EmptyState label="No payment history yet" />}</DataCard>
    <DataCard>
      {categories.map((category) => {
        const docs = driver.documents.filter((doc) => doc.category === category);
        const label = category === "Other" ? "Other Documents" : `${category} Card`;
        if (!docs.length) return <Row key={category}><FileText size={16} /><div className="flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#9CA3AF]">No document uploaded</p></div></Row>;
        return <div key={category}>{docs.map((doc) => <DocRow key={doc.id} icon={<FileText size={16} />} title={label} subtitle={doc.fileName} doc={{ fileName: doc.fileName, dataUrl: doc.dataUrl, title: `${driver.name} - ${label}` }} onView={onView} />)}</div>;
      })}
    </DataCard>
  </div>;
}

function CustomersWithDelete({ customers, trips, search, setSearch, openModal, remove }: { customers: Customer[]; trips: Trip[]; search: string; setSearch: (v: string) => void; openModal: (m: string) => void; remove: (id: string) => void }) {
  return <div className="space-y-4"><Customers customers={customers} trips={trips} search={search} setSearch={setSearch} openModal={openModal} /><DataCard><div className="px-5 py-3 border-b border-[#EEF3F8]"><p className="text-sm font-bold">Party record actions</p><p className="text-xs text-[#9CA3AF]">Delete a saved party when it is no longer required.</p></div>{customers.map((customer) => <Row key={customer.id}><Avatar text={initials(customer.company)} /><div className="flex-1"><p className="text-sm font-semibold">{customer.company}</p><p className="text-xs text-[#9CA3AF]">{customer.phone}</p></div><button onClick={() => remove(customer.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600"><Trash2 size={13} />Delete</button></Row>)}</DataCard></div>;
}

function Customers({ customers, trips, search, setSearch, openModal }: { customers: Customer[]; trips: Trip[]; search: string; setSearch: (v: string) => void; openModal: (m: string) => void }) {
  const filtered = customers.filter((c) => `${c.company} ${c.contact} ${c.gst}`.toLowerCase().includes(search.toLowerCase()));
  return <div><Toolbar title="Party" subtitle={`${customers.length} companies registered`} search={search} setSearch={setSearch} action={<button onClick={() => openModal("customer")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Party</button>} /><DataCard>{filtered.map((c) => <Row key={c.id}><Avatar text={initials(c.company)} /><div className="flex-[2]"><p className="text-sm font-semibold">{c.company}</p><p className="text-xs text-[#9CA3AF]">{c.email}</p></div><p className="hidden md:block text-xs">{c.contact}</p><p className="hidden lg:block text-xs font-mono">{c.gst}</p><span className="text-xs font-bold text-blue-700">{trips.filter((t) => t.customerId === c.id).length} trips</span></Row>)}</DataCard></div>;
}

function TripsWithView({ trips, customers, vehicles, drivers, role, search, setSearch, openModal, updateTripStatus, setView, exportCsv, onBill, edit, remove, onPodUpload, onView }: { trips: Trip[]; customers: Customer[]; vehicles: Vehicle[]; drivers: Driver[]; role: Role; search: string; setSearch: (v: string) => void; openModal: (m: string, f?: Record<string, string>) => void; updateTripStatus: (id: string, status: TripStatus) => void; setView: (v: View) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; onBill: (id: string) => void; edit: (trip: Trip) => void; remove: (id: string) => void; onPodUpload: (tripId: string, files: UploadedFile[]) => void; onView: (doc: ViewableDoc) => void }) {
  const podFiles = trips.flatMap((trip) => trip.podDocs.filter((url) => /^https?:\/\//i.test(url)).map((url) => ({ trip, url })));
  return <div className="space-y-4">
    <Trips trips={trips} customers={customers} vehicles={vehicles} drivers={drivers} role={role} search={search} setSearch={setSearch} openModal={openModal} updateTripStatus={updateTripStatus} setView={setView} exportCsv={exportCsv} onBill={onBill} edit={edit} remove={remove} onPodUpload={onPodUpload} />
    {podFiles.length > 0 && <DataCard><div className="px-5 py-3 border-b border-[#EEF3F8]"><p className="text-sm font-bold">Uploaded POD Files</p><p className="text-xs text-[#9CA3AF]">Saved in Supabase — available after refresh</p></div>{podFiles.map(({ trip, url }) => { const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "POD document"); return <Row key={`${trip.id}-${url}`}><FileText size={16} /><div className="flex-1 min-w-0"><p className="text-sm font-semibold">{trip.lrNumber || trip.id} — POD</p><p className="text-xs text-[#9CA3AF] truncate">{fileName}</p></div><button onClick={() => onView({ fileName, dataUrl: url, title: `${trip.lrNumber || trip.id} - POD` })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/70 ring-1 ring-white/70 hover:bg-white"><Eye size={13} />View</button></Row>; })}</DataCard>}
  </div>;
}

function Trips({ trips, customers, vehicles, drivers, role, search, setSearch, openModal, updateTripStatus, setView, exportCsv, onBill, edit, remove, onPodUpload }: { trips: Trip[]; customers: Customer[]; vehicles: Vehicle[]; drivers: Driver[]; role: Role; search: string; setSearch: (v: string) => void; openModal: (m: string) => void; updateTripStatus: (id: string, status: TripStatus) => void; setView: (v: View) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; onBill: (id: string) => void; edit: (trip: Trip) => void; remove: (id: string) => void; onPodUpload: (tripId: string, files: UploadedFile[]) => void }) {
  const filtered = trips.filter((t) => `${t.id} ${t.lrNumber ?? ""} ${t.manualVehicleNumber ?? ""} ${t.pickup} ${t.drop} ${t.cargo} ${t.cargoName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const statusOptions: TripStatus[] = ["Draft", "Assigned", "In Transit", "Completed", "Cancelled"];
  return <div><Toolbar title={role === "driver" ? "My Bookings" : "Booking Register"} subtitle="LR, cargo, live tracking, POD upload, trip billing and status control" search={search} setSearch={setSearch} action={<>{role === "admin" && <button onClick={() => exportCsv("booking-register", trips.map((t) => ({ id: t.id, date: t.date, lrNumber: t.lrNumber ?? "", vehicleNo: vehicles.find((v) => v.id === t.vehicleId)?.number ?? "", driver: drivers.find((d) => d.id === t.driverId)?.name ?? "", partyName: customers.find((c) => c.id === t.customerId)?.company ?? "", from: t.pickup, to: t.drop, freight: t.freight, advance: t.advanceAmount ?? 0, balance: Math.max(t.freight - (t.advanceAmount ?? 0), 0), otherCharges: t.otherExpenses ?? 0, otherChargesReason: t.otherChargesReason ?? "", invoiceNumber: t.invoiceNumber ?? "", paymentStatus: t.paymentStatus ?? "", status: t.status, remarks: t.remarks ?? "" })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export Excel</button>}<button onClick={() => setView("tripReport")} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><FileText size={15} />Report</button>{role === "admin" && <button onClick={() => openModal("trip")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />New Booking</button>}</>} />
    <DataCard>{filtered.map((t) => { const tripBreakdownTotal = (t.expenseRemarks ?? []).reduce((sum, item) => sum + item.amount, 0); const totalExpenses = (t.tollCharges ?? 0) + (t.driverAllowance ?? 0) + (t.otherExpenses ?? 0) + tripBreakdownTotal; const profit = t.freight - totalExpenses; return <Row key={t.id}><div className="w-10 h-10 rounded-xl bg-[#12151C] text-white flex items-center justify-center"><Route size={17} /></div><div className="flex-1 min-w-[260px]"><p className="text-sm font-semibold">{t.pickup} <ChevronRight size={12} className="inline" /> {t.drop}</p><p className="text-xs text-[#9CA3AF]">{t.lrNumber || "LR not assigned"} - {customers.find((c) => c.id === t.customerId)?.company} - {t.cargoName || t.cargo}</p><p className="text-xs text-[#9CA3AF]">Cargo: {t.materialType || "-"} - {t.weight || "-"} - Qty {t.quantity || "-"} - {t.date}{t.endDate ? ` to ${t.endDate}` : ""}</p>{t.remarks && <p className="text-xs text-[#9CA3AF] italic mt-0.5">Remarks: {t.remarks}</p>}</div><p className="hidden lg:block text-xs">{vehicles.find((v) => v.id === t.vehicleId)?.number}</p><p className="hidden lg:block text-xs">{drivers.find((d) => d.id === t.driverId)?.name}</p><div className="text-xs min-w-[170px]"><p className="font-bold">{rupees(t.freight)}</p><p className="text-[#9CA3AF]">Advance {rupees(t.advanceAmount ?? 0)}</p><p className={profit < 0 ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>P/L {rupees(profit)}</p></div><div className="text-xs min-w-[180px]"><p>Expenses {rupees(totalExpenses)}</p>{t.expenseRemarks?.map((item, index) => <p key={`${item.category}-${index}`} className="text-[#52708D] mt-0.5">{item.category} {rupees(item.amount)}{item.remark ? ` · ${item.remark}` : ""}</p>)}<p>Invoice {t.invoiceNumber || "-"}</p><Badge label={t.paymentStatus || "Pending"} /></div><select value={t.status} onChange={(e) => updateTripStatus(t.id, e.target.value as TripStatus)} className="rounded-xl px-3 py-2 text-xs font-semibold outline-none" style={glassSubtle}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>{role === "admin" && <button onClick={() => onBill(t.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}><Receipt size={13} />Bill</button>}{role === "admin" && <button onClick={() => edit(t)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Edit</button>}{role === "admin" && <button onClick={() => remove(t.id)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600">Delete</button>}<FileField label="POD" category="pod" onFiles={(files) => onPodUpload(t.id, files)} /></Row>; })}</DataCard>
  </div>;
}function LegacyExpenses({ view, expenses, trips, vehicles, drivers, openModal, exportCsv, remove }: { view: View; expenses: Expense[]; trips: Trip[]; vehicles: Vehicle[]; drivers: Driver[]; openModal: (m: string, f?: Record<string, string>) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; remove: (id: string) => void }) {
  const [dateFilter, setDateFilter] = useState("");
  const [tripFilter, setTripFilter] = useState("All");
  const [currentDay, setCurrentDay] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    // Detect when a new calendar day starts so the "Today" entry list clears automatically
    // while everything already recorded stays available in the day-wise history below.
    const timer = window.setInterval(() => {
      const nowDay = new Date().toISOString().slice(0, 10);
      setCurrentDay((prev) => (prev === nowDay ? prev : nowDay));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  const relevant = expenses.filter((e) => view === "expenses" || (view === "fuel" ? e.category === "Fuel" : e.category === "Maintenance"));
  const filtered = relevant.filter((e) => (!dateFilter || e.date === dateFilter) && (tripFilter === "All" || (tripFilter === "General" ? !e.tripId : e.tripId === tripFilter)));
  const title = view === "fuel" ? "Fuel Logs" : "Expenses";
  const fuelRows = filtered.filter((e) => e.category === "Fuel");
  const avgMileage = fuelRows.length ? fuelRows.reduce((s, e) => s + (e.mileage ?? 0), 0) / fuelRows.length : 0;
  const todaysEntries = relevant.filter((e) => e.date === currentDay);
  const groupedByDay = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    filtered.forEach((e) => { (map[e.date] ??= []).push(e); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);
  const deleteExpense = (item: Expense) => { if (window.confirm(`Delete ${item.category} expense of ${rupees(item.amount)}?`)) remove(item.id); };
  return <div><Toolbar title={title} subtitle={`${filtered.length} entries - ${rupees(filtered.reduce((s, e) => s + e.amount, 0))}`} filters={<><input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} /><select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option value="All">All Trips</option><option value="General">General Expenses</option>{trips.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select></>} action={<><button onClick={() => exportCsv(title, filtered.map((e) => ({ id: e.id, trip: e.tripId ?? "General", category: e.category, amount: e.amount, date: e.date, note: e.note })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => openModal("expense", { category: view === "fuel" ? "Fuel" : "Other", date: currentDay })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Entry</button></>} />
    {view === "fuel" && <><div className="grid md:grid-cols-6 gap-4 mb-4"><Metric title="Fuel Filled" value={`${fuelRows.reduce((s, e) => s + (e.liters ?? 0), 0)} L`} /><Metric title="Fuel Cost" value={rupees(fuelRows.reduce((s, e) => s + e.amount, 0))} /><Metric title="Average Mileage" value={`${avgMileage.toFixed(1)} km/L`} /><Metric title="Low Fuel" value={String(vehicles.filter((v) => telemetryOf(v).fuelLevel < 30).length)} /><Metric title="Active Vehicles" value={String(vehicles.filter((v) => telemetryOf(v).ignition === "ON").length)} /><Metric title="Abnormal Logs" value={String(fuelRows.filter((e) => (e.mileage ?? 0) > 0 && (e.mileage ?? 0) < 4).length)} /></div>
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">{vehicles.map((v) => { const t = telemetryOf(v); const history = expenses.filter((e) => e.category === "Fuel" && e.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3); return <div key={v.id} className="rounded-2xl p-5" style={glass}><div className="flex justify-between gap-2"><div><p className="font-bold">{v.number}</p><p className="text-xs text-[#9CA3AF]">{t.location}</p></div><Fuel size={18} color={t.fuelLevel < 30 ? "#DC2626" : "#10B981"} /></div><p className="mt-5 text-3xl font-extrabold">{t.fuelLevel}%</p><div className="h-2 rounded-full bg-white/60 mt-3 overflow-hidden"><div className={`h-full rounded-full ${t.fuelLevel < 25 ? "bg-red-500" : t.fuelLevel < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${t.fuelLevel}%` }} /></div><div className="mt-3 flex justify-between text-xs text-[#6B7280]"><span>{t.ignition}</span><span>{t.apiSync}</span></div><div className="mt-4 pt-3 border-t border-[#EEF3F8]"><p className="text-[10px] font-bold uppercase text-[#9CA3AF] mb-1.5">This vehicle's fuel history</p>{history.length ? history.map((h) => <p key={h.id} className="text-xs flex justify-between text-[#6B7280]"><span>{h.date}</span><span>{h.liters ?? "-"} L - {rupees(h.amount)}</span></p>) : <p className="text-xs text-[#9CA3AF]">No fuel entries yet</p>}</div></div>; })}</div></>}
    {view === "expenses" && <div className="rounded-2xl p-5 mb-4" style={glass}><div className="flex items-center justify-between"><h3 className="font-bold">Today · {currentDay}</h3><p className="text-sm font-bold">{rupees(todaysEntries.reduce((s, e) => s + e.amount, 0))}</p></div>{todaysEntries.length ? <div className="mt-3 space-y-2">{todaysEntries.map((e) => <Row key={e.id}><Receipt size={16} /><div className="flex-1"><p className="text-sm font-semibold">{e.category}</p><p className="text-xs text-[#9CA3AF]">{e.note || e.tripId || "General"}</p></div><p className="text-sm font-bold">{rupees(e.amount)}</p></Row>)}</div> : <p className="mt-3 text-sm text-[#9CA3AF]">No entries yet today - this list refreshes blank automatically each new day, while everything below stays in history.</p>}</div>}
    <div className="space-y-5">{groupedByDay.length ? groupedByDay.map(([date, rows]) => <div key={date}><div className="flex items-center justify-between mb-2 px-1"><h4 className="text-sm font-extrabold text-[#52708D]">{date}{date === currentDay ? <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">Today</span> : null}</h4><p className="text-xs font-bold text-[#8A94A6]">{rupees(rows.reduce((s, e) => s + e.amount, 0))}</p></div><DataCard>{rows.map((e) => <Row key={e.id}><Receipt size={18} /><div className="flex-1"><p className="text-sm font-semibold">{e.category}{e.category === "Fuel" && (e.mileage ?? 0) < 4 ? <span className="ml-2 text-[10px] text-red-600 font-bold">ABNORMAL</span> : null}</p><p className="text-xs text-[#9CA3AF]">{e.note || e.tripId || "General"}</p></div><p className="hidden md:block text-xs">{vehicles.find((v) => v.id === e.vehicleId)?.number ?? trips.find((t) => t.id === e.tripId)?.id ?? "-"}</p><p className="hidden lg:block text-xs">{drivers.find((d) => d.id === e.driverId)?.name ?? "-"}</p><p className="text-xs">{e.date}</p><p className="text-sm font-bold">{rupees(e.amount)}</p></Row>)}</DataCard></div>) : <EmptyState label="No entries match this filter" />}</div>
  </div>;
}

function Expenses({ view, expenses, trips, vehicles, drivers, openModal, exportCsv, remove }: { view: View; expenses: Expense[]; trips: Trip[]; vehicles: Vehicle[]; drivers: Driver[]; openModal: (m: string, f?: Record<string, string>) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; remove: (id: string) => void }) {
  const [dateFilter, setDateFilter] = useState("");
  const [tripFilter, setTripFilter] = useState("All");
  const relevant = expenses.filter((entry) => view === "expenses" || (view === "fuel" ? entry.category === "Fuel" : entry.category === "Maintenance"));
  const rows = relevant.filter((entry) => (!dateFilter || entry.date === dateFilter) && (tripFilter === "All" || (tripFilter === "General" ? !entry.tripId : entry.tripId === tripFilter))).sort((a, b) => b.date.localeCompare(a.date));
  const title = view === "fuel" ? "Fuel Logs" : "Expenses";
  const deleteEntry = (entry: Expense) => { if (window.confirm(`Delete ${entry.category} expense of ${rupees(entry.amount)}?`)) remove(entry.id); };
  return <div><Toolbar title={title} subtitle={`${rows.length} entries · ${rupees(rows.reduce((sum, entry) => sum + entry.amount, 0))}`} filters={<><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} /><select value={tripFilter} onChange={(event) => setTripFilter(event.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option value="All">All Trips</option><option value="General">General Expenses</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.lrNumber || trip.id}</option>)}</select></>} action={<><button onClick={() => exportCsv(title, rows.map((entry) => ({ category: entry.category, amount: entry.amount, date: entry.date, note: entry.note, trip: entry.tripId || "General" })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => openModal("expense", { category: view === "fuel" ? "Fuel" : "Other", date: today })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Entry</button></>} />
    <DataCard>{rows.length ? rows.map((entry) => <Row key={entry.id}><Receipt size={18} /><div className="flex-1"><p className="text-sm font-semibold">{entry.category}</p><p className="text-xs text-[#9CA3AF]">{entry.note || (entry.tripId ? `Trip: ${entry.tripId}` : "General expense")}</p></div><p className="hidden md:block text-xs">{vehicles.find((vehicle) => vehicle.id === entry.vehicleId)?.number || drivers.find((driver) => driver.id === entry.driverId)?.name || "-"}</p><p className="text-xs">{entry.date}</p><p className="font-bold text-sm">{rupees(entry.amount)}</p><button onClick={() => deleteEntry(entry)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-red-600"><Trash2 size={14} />Delete</button></Row>) : <EmptyState label="No expenses match this filter" />}</DataCard>
  </div>;
}

function LegacyCompanyExpenses({ records, openModal, remove, exportCsv }: { records: CompanyExpense[]; openModal: (m: string, f?: Record<string, string>) => void; remove: (id: string) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const [filter, setFilter] = useState<"All" | "Expense" | "EMI">("All");
  const visible = records.filter((record) => filter === "All" || record.type === filter).sort((a, b) => `${b.reminderDate || b.date}`.localeCompare(`${a.reminderDate || a.date}`));
  const emiDue = records.filter((record) => record.type === "EMI" && record.status === "Pending").sort((a, b) => (a.reminderDate || a.date).localeCompare(b.reminderDate || b.date));
  const total = visible.reduce((sum, record) => sum + record.amount, 0);
  return <div><Toolbar title="Company Expenses" subtitle={`${visible.length} records · ${rupees(total)}`} filters={<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option value="All">All records</option><option value="Expense">Company expenses</option><option value="EMI">EMI reminders</option></select>} action={<><button onClick={() => exportCsv("company-expenses", visible.map((record) => ({ name: record.name, type: record.type, amount: record.amount, date: record.date, reminderDate: record.reminderDate, status: record.status, note: record.note })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => openModal("companyExpense", { type: "Expense", date: today, status: "Pending" })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Company Expense</button></>} />
    <div className="grid md:grid-cols-3 gap-4 mb-5"><Metric title="Total company expenses" value={rupees(records.filter((record) => record.type === "Expense").reduce((sum, record) => sum + record.amount, 0))} /><Metric title="Pending EMIs" value={String(emiDue.length)} /><Metric title="EMI due amount" value={rupees(emiDue.reduce((sum, record) => sum + record.amount, 0))} /></div>
    <div className="rounded-2xl p-5 mb-5" style={glass}><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">EMI reminders</h3><p className="text-sm text-[#8A94A6]">Keep upcoming instalments separate from normal company expenses.</p></div><button onClick={() => openModal("companyExpense", { type: "EMI", date: today, reminderDate: today, status: "Pending" })} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#12151C]">+ Add EMI reminder</button></div>{emiDue.length ? <div className="mt-4 space-y-2">{emiDue.map((record) => <Row key={record.id}><CreditCard size={17} /><div className="flex-1"><p className="font-semibold text-sm">{record.name}</p><p className="text-xs text-[#8A94A6]">Due {record.reminderDate || record.date}{record.note ? ` · ${record.note}` : ""}</p></div><p className="font-bold text-sm">{rupees(record.amount)}</p><Badge label="Pending" /></Row>)}</div> : <p className="mt-4 text-sm text-[#8A94A6]">No pending EMI reminders.</p>}</div>
    <DataCard>{visible.length ? visible.map((record) => <Row key={record.id}><Receipt size={18} /><div className="flex-1"><p className="text-sm font-semibold">{record.name}</p><p className="text-xs text-[#8A94A6]">{record.type}{record.note ? ` · ${record.note}` : ""}</p></div><p className="text-xs">{record.type === "EMI" ? `Reminder: ${record.reminderDate || record.date}` : record.date}</p><p className="font-bold text-sm">{rupees(record.amount)}</p><Badge label={record.status} /><button onClick={() => { if (window.confirm(`Delete ${record.name}?`)) remove(record.id); }} className="p-2 rounded-xl text-red-600" title="Delete record"><Trash2 size={16} /></button></Row>) : <EmptyState label="No company expenses or EMI reminders yet" />}</DataCard>
  </div>;
}

function CompanyExpenses({ records, openModal, remove, exportCsv }: { records: CompanyExpense[]; openModal: (m: string, f?: Record<string, string>) => void; remove: (id: string) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  return <div><Toolbar title="Company Expenses" subtitle={`${sorted.length} records · ${rupees(sorted.reduce((sum, record) => sum + record.amount, 0))}`} action={<><button onClick={() => exportCsv("company-expenses", sorted.map((record) => ({ name: record.name, amount: record.amount, date: record.date, note: record.note })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => openModal("companyExpense", { date: today })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Company Expense</button></>} />
    <div className="grid md:grid-cols-2 gap-4 mb-5"><Metric title="Total company expenses" value={rupees(sorted.reduce((sum, record) => sum + record.amount, 0))} /><Metric title="Saved records" value={String(sorted.length)} /></div>
    <DataCard>{sorted.length ? sorted.map((record) => <Row key={record.id}><Receipt size={18} /><div className="flex-1"><p className="text-sm font-semibold">{record.name}</p><p className="text-xs text-[#9CA3AF]">{record.note || "Company expense"}</p></div><p className="text-xs">{record.date}</p><p className="font-bold text-sm">{rupees(record.amount)}</p><button onClick={() => { if (window.confirm(`Delete ${record.name}?`)) remove(record.id); }} className="p-2 rounded-xl text-red-600" title="Delete record"><Trash2 size={16} /></button></Row>) : <EmptyState label="No company expenses saved yet" />}</DataCard>
  </div>;
}

function LegacyEmiReminders({ records, openModal, markPaid, remove }: { records: EmiReminder[]; openModal: (m: string, f?: Record<string, string>) => void; markPaid: (id: string) => void; remove: (id: string) => void }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthOffset = (startDate: string) => { const start = new Date(`${startDate}T00:00:00`); return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth(); };
  const isCurrent = (record: EmiReminder) => { const offset = monthOffset(record.startDate); return record.status === "Active" && offset >= 0 && offset < record.tenureMonths; };
  const current = records.filter(isCurrent).sort((a, b) => a.dueDay - b.dueDay);
  return <div><Toolbar title="EMI Reminders" subtitle={`${current.length} active monthly EMI reminders`} action={<button onClick={() => openModal("emiReminder", { dueDay: "1", tenureMonths: "12", startDate: today })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add EMI Reminder</button>} />
    <div className="rounded-2xl p-5 mb-5 border-2 border-red-400 bg-red-50"><p className="text-lg font-extrabold text-red-800">⚠ Monthly EMI alerts</p><p className="text-sm font-semibold text-red-700 mt-1">EMI due reminders are shown prominently in Alerts on the selected date, for every month of the selected tenure.</p></div>
    <div className="grid md:grid-cols-3 gap-4 mb-5"><Metric title="Active EMIs" value={String(current.length)} /><Metric title="Monthly commitment" value={rupees(current.reduce((sum, record) => sum + record.amount, 0))} /><Metric title="Next due day" value={current[0] ? `${current[0].dueDay} of month` : "-"} /></div>
    <DataCard>{records.length ? records.map((record) => { const elapsed = Math.max(0, monthOffset(record.startDate)); const remaining = Math.max(0, record.tenureMonths - elapsed); const dueTodayOrPast = isCurrent(record) && now.getDate() >= record.dueDay; return <Row key={record.id}><Bell size={18} className={dueTodayOrPast ? "text-red-600" : "text-amber-500"} /><div className="flex-1"><p className={dueTodayOrPast ? "text-sm font-extrabold text-red-700" : "text-sm font-semibold"}>{record.name}</p><p className="text-xs text-[#8A94A6]">Every month on day {record.dueDay} · {remaining} of {record.tenureMonths} months remaining{record.note ? ` · ${record.note}` : ""}</p></div><p className="font-bold text-sm">{rupees(record.amount)}</p><Badge label={record.status} /><button onClick={() => { if (window.confirm(`Delete ${record.name}?`)) remove(record.id); }} className="p-2 rounded-xl text-red-600" title="Delete EMI reminder"><Trash2 size={16} /></button></Row>; }) : <EmptyState label="No EMI reminders saved yet" />}</DataCard>
  </div>;
}

function EmiReminders({ records, openModal, markPaid, remove }: { records: EmiReminder[]; openModal: (m: string, f?: Record<string, string>) => void; markPaid: (id: string) => void; remove: (id: string) => void }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthOffset = (startDate: string) => { const start = new Date(`${startDate}T00:00:00`); return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth(); };
  const isCurrent = (record: EmiReminder) => { const offset = monthOffset(record.startDate); return record.status === "Active" && offset >= 0 && offset < record.tenureMonths; };
  const active = records.filter(isCurrent).sort((a, b) => a.dueDay - b.dueDay);
  return <div><Toolbar title="EMI Reminders" subtitle={`${active.length} active monthly EMI reminders`} action={<button onClick={() => openModal("emiReminder", { dueDay: "1", tenureMonths: "12", startDate: today })} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add EMI Reminder</button>} />
    <div className="rounded-2xl p-5 mb-5 border-2 border-red-400 bg-red-50"><p className="text-lg font-extrabold text-red-800">EMI due alerts</p><p className="text-sm font-semibold text-red-700 mt-1">Marking an EMI paid clears only this month’s alert. The next monthly alert appears automatically until the tenure ends.</p></div>
    <div className="grid md:grid-cols-3 gap-4 mb-5"><Metric title="Active EMIs" value={String(active.length)} /><Metric title="Monthly commitment" value={rupees(active.reduce((sum, record) => sum + record.amount, 0))} /><Metric title="Next due day" value={active[0] ? `${active[0].dueDay} of month` : "-"} /></div>
    <DataCard>{records.length ? records.map((record) => { const elapsed = Math.max(0, monthOffset(record.startDate)); const remaining = Math.max(0, record.tenureMonths - elapsed); const paidThisMonth = record.paidMonths.includes(thisMonth); const due = isCurrent(record) && now.getDate() >= record.dueDay && !paidThisMonth; return <Row key={record.id}><Bell size={18} className={due ? "text-red-600" : paidThisMonth ? "text-emerald-600" : "text-amber-500"} /><div className="flex-1"><p className={due ? "text-sm font-extrabold text-red-700" : "text-sm font-semibold"}>{record.name}</p><p className="text-xs text-[#8A94A6]">Every month on day {record.dueDay} · {remaining} of {record.tenureMonths} months remaining{record.note ? ` · ${record.note}` : ""}</p></div><p className="font-bold text-sm">{rupees(record.amount)}</p><Badge label={paidThisMonth ? "Paid this month" : record.status} />{isCurrent(record) && <button onClick={() => !paidThisMonth && markPaid(record.id)} disabled={paidThisMonth} className={`px-3 py-2 rounded-xl text-xs font-bold ${paidThisMonth ? "bg-emerald-100 text-emerald-700 cursor-default" : "bg-emerald-600 text-white"}`}>{paidThisMonth ? "Paid" : "Mark paid"}</button>}<button onClick={() => { if (window.confirm(`Delete ${record.name}?`)) remove(record.id); }} className="p-2 rounded-xl text-red-600" title="Delete EMI reminder"><Trash2 size={16} /></button></Row>; }) : <EmptyState label="No EMI reminders saved yet" />}</DataCard>
  </div>;
}

function Documents({ documents, search, setSearch, exportCsv, sendReminder, onView }: { documents: DocumentRecord[]; search: string; setSearch: (v: string) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; sendReminder: (doc: DocumentRecord) => void; onView?: (doc: ViewableDoc) => void }) {
  const filtered = documents.filter((d) => `${d.ownerName} ${d.type} ${d.documentNumber} ${d.status}`.toLowerCase().includes(search.toLowerCase()));
  const renewDue = filtered.filter((d) => d.status !== "Valid");
  return <div><Toolbar title="Document Expiry Management" subtitle={`${renewDue.length} renewals need attention - vehicle and driver documents`} search={search} setSearch={setSearch} action={<button onClick={() => exportCsv("document-renewals", filtered.map((d) => ({ owner: d.ownerName, type: d.type, number: d.documentNumber, expiry: d.expiryDate, status: d.status })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button>} />
    <div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Upcoming Renewals" value={String(documents.filter((d) => d.status.startsWith("Due")).length)} /><Metric title="Expired Documents" value={String(documents.filter((d) => d.status === "Expired").length)} /><Metric title="Vehicle Docs" value={String(documents.filter((d) => d.ownerType === "Vehicle").length)} /><Metric title="Driver Docs" value={String(documents.filter((d) => d.ownerType === "Driver").length)} /></div>
    <DataCard>{filtered.map((d) => <Row key={d.id}><ShieldCheck size={18} /><div className="flex-1"><p className="text-sm font-semibold">{d.ownerName} - {d.type}</p><p className="text-xs text-[#9CA3AF]">{d.documentNumber} - {d.fileName}</p></div><p className="hidden md:block text-xs">Issued {d.issueDate}</p><p className="text-xs">Expiry {d.expiryDate}</p><DocumentBadge status={d.status} /><button onClick={() => onView?.({ fileName: d.fileName, dataUrl: d.dataUrl, title: `${d.ownerName} - ${d.type}` })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/70 ring-1 ring-white/70 hover:bg-white"><Eye size={12} />View</button><button onClick={() => sendReminder(d)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Send Reminder</button></Row>)}</DataCard></div>;
}
function MaintenanceModule({ records, vehicles, trips, openModal, exportCsv, remove }: { records: MaintenanceRecord[]; vehicles: Vehicle[]; trips: Trip[]; openModal: (m: string, f?: Record<string, string>) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; remove: (id: string) => void }) {
  const [dateFilter, setDateFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [tripFilter, setTripFilter] = useState("All");
  const filtered = records.filter((r) => (!dateFilter || r.dueDate === dateFilter) && (vehicleFilter === "All" || r.vehicleId === vehicleFilter) && (tripFilter === "All" || trips.find((t) => t.id === tripFilter)?.vehicleId === r.vehicleId));
  const editService = (record: MaintenanceRecord) => openModal("service", Object.fromEntries(Object.entries(record).map(([k, v]) => [k, String(v)])));
  return <div><Toolbar title="Service Planner" subtitle={`${filtered.filter((r) => r.status !== "Completed").length} vehicles due or upcoming`} filters={<><input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} /><select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option value="All">All Vehicles</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}</select><select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option value="All">All Trips</option>{trips.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select></>} action={<><button onClick={() => exportCsv("service-report", filtered.map((r) => ({ vehicle: vehicles.find((v) => v.id === r.vehicleId)?.number ?? "-", service: r.serviceType, cost: r.serviceCost, intervalKm: r.serviceIntervalKm, dueDate: r.dueDate, status: r.status })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => openModal("service")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Service</button></>} />
    <div className="grid md:grid-cols-3 gap-4 mb-4"><Metric title="Vehicles Due" value={String(filtered.filter((r) => r.status === "Due").length)} /><Metric title="Service Cost" value={rupees(filtered.reduce((s, r) => s + r.serviceCost, 0))} /><Metric title="Upcoming Service" value={filtered[0]?.dueDate ?? "-"} /></div>
    <DataCard>{filtered.map((r) => <Row key={r.id}><Wrench size={18} /><div className="flex-1"><p className="text-sm font-semibold">{r.serviceType} - {vehicles.find((v) => v.id === r.vehicleId)?.number}</p><p className="text-xs text-[#9CA3AF]">{r.workshop} - {r.mechanic} - {r.partsUsed}</p></div><p className="hidden md:block text-xs">{r.serviceIntervalKm.toLocaleString()} km interval</p><p className="text-xs">{r.dueDate}</p><p className="text-sm font-bold">{rupees(r.serviceCost)}</p><Badge label={r.status} /><button onClick={() => editService(r)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Edit</button><button onClick={() => remove(r.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600"><Trash2 size={13} />Delete</button></Row>)}</DataCard></div>;
}
function BalanceFreightModule({ records, vehicles, search, setSearch, openModal, edit, remove, updateStatus, exportCsv, setView, onChallan }: { records: BalanceFreightRecord[]; vehicles: Vehicle[]; search: string; setSearch: (v: string) => void; openModal: (m: string, f?: Record<string, string>) => void; edit: (record: BalanceFreightRecord) => void; remove: (id: string) => void; updateStatus: (id: string, status: BalanceFreightRecord["status"]) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; setView: (v: View) => void; onChallan: (id: string) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [party, setParty] = useState("All");
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [route, setRoute] = useState("");
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const filtered = records.filter((r) => r.loadingDate.startsWith(month) && (party === "All" || r.partyName === party) && (vehicleFilter === "All" || r.vehicleNumber === vehicleFilter) && `${r.partyName} ${r.vehicleNumber} ${r.from} ${r.to} ${r.chequeNeftNumber} ${r.bank} ${r.remarks}`.toLowerCase().includes(`${search} ${route}`.trim().toLowerCase()));
  const parties = Array.from(new Set(records.map((r) => r.partyName).filter(Boolean)));
  const vehicleNumbers = Array.from(new Set([...vehicles.map((v) => v.number), ...records.map((r) => r.vehicleNumber)].filter(Boolean)));
  const chooseStatus = (id: string, status: BalanceFreightRecord["status"]) => { updateStatus(id, status); setOpenStatus(null); };
  return <div><Toolbar title="Vehicle Register" subtitle={`${filtered.length} records for ${month}`} search={search} setSearch={setSearch} filters={<><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} /><select value={party} onChange={(e) => setParty(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option>All</option>{parties.map((p) => <option key={p}>{p}</option>)}</select><select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle}><option>All</option>{vehicleNumbers.map((v) => <option key={v}>{v}</option>)}</select><input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Route" className="rounded-2xl px-4 py-2.5 text-sm outline-none w-36" style={glassSubtle} /></>} action={<><button onClick={() => exportCsv("vehicle-register", filtered.map((r) => ({ challanNo: r.challanNo || r.freightId || r.id, date: r.loadingDate, vehicleNo: r.vehicleNumber, ownerName: r.ownerName ?? "", partyName: r.partyName, cnNo: r.cnNo ?? "", size: r.size ?? "", weight: r.weight ?? "", rate: r.rate ?? 0, from: r.from, to: r.to, freight: r.freight, totalAdvance: r.partyAdvance ?? r.advance, commissionPercent: r.commissionPercent ?? 0, commission: r.commission, hamali: r.hamali, detention: r.payCharge, otherCharges: r.otherCharges, otherChargesReason: r.otherChargesReason ?? "", netBalance: r.balance, billNo: r.billNo ?? "", remarks: r.remarks })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export Excel</button><button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Printer size={15} />PDF / Print</button><button onClick={() => setView("freightReport")} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><FileText size={15} />Report</button><button onClick={() => openModal("balanceFreight")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Add Vehicle Register Entry</button></>} />
    <div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Total Freight" value={rupees(filtered.reduce((s, r) => s + r.freight, 0))} /><Metric title="Advance Collected" value={rupees(filtered.reduce((s, r) => s + (r.paidAmount || r.advance || 0), 0))} /><Metric title="Completed" value={String(filtered.filter((r) => r.status === "Paid").length)} /><Metric title="Pending Balance" value={rupees(filtered.reduce((s, r) => s + r.balance, 0))} /></div>
    <div className="grid xl:grid-cols-[1fr_360px] gap-4"><DataCard>{filtered.map((r) => <Row key={r.id}><ClipboardList size={18} /><div className="flex-1 min-w-[240px]"><p className="text-sm font-semibold">{r.challanNo || r.invoiceNumber || r.freightId || r.id} - {r.vehicleNumber} - {r.from} to {r.to}</p><p className="text-xs text-[#9CA3AF]">{r.loadingDate} - {r.partyName}{r.size ? ` - ${r.size}` : ""} - Commission {r.commissionPercent ?? 0}% - {r.paymentMode || r.bank || "No bank"}</p></div><p className="hidden md:block text-xs">Final {rupees(r.finalAmount ?? r.freight)}</p><p className="text-xs">Freight {rupees(r.freight)}</p><p className="text-xs">Advance {rupees(r.paidAmount || r.advance || 0)}</p><p className="text-sm font-bold">{rupees(r.balance)}</p><div className="relative"><button onClick={() => setOpenStatus(openStatus === r.id ? null : r.id)} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/60 ring-1 ring-white/70"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{r.status}</button>{openStatus === r.id && <div className="absolute right-0 top-8 z-20 w-40 rounded-2xl p-2 shadow-xl" style={{ ...glass, background: "rgba(255,255,255,0.94)" }}><button onClick={() => chooseStatus(r.id, "Paid")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-50">Paid / Completed</button><button onClick={() => chooseStatus(r.id, "Cancelled")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50">Cancel</button></div>}</div><button onClick={() => onChallan(r.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}><Printer size={13} />Challan</button><button onClick={() => edit(r)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Edit</button><button onClick={() => remove(r.id)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600">Delete</button></Row>)}</DataCard><div className="space-y-4"><LedgerSummary title="Party Page" rows={parties.map((p) => { const items = records.filter((r) => r.partyName === p); return { name: p, meta: `${items.length} transactions`, amount: items.reduce((s, r) => s + r.balance, 0) }; })} /><LedgerSummary title="Vehicle Page" rows={vehicleNumbers.map((v) => { const items = records.filter((r) => r.vehicleNumber === v); return { name: v, meta: `${rupees(items.reduce((s, r) => s + r.freight, 0))} earnings`, amount: items.reduce((s, r) => s + r.balance, 0) }; })} /></div></div></div>;
}
function LedgerSummary({ title, rows }: { title: string; rows: { name: string; meta: string; amount: number }[] }) {
  return <div className="rounded-2xl p-5" style={glass}><h3 className="font-bold mb-3">{title}</h3><div className="space-y-2">{rows.length ? rows.map((row) => <div key={row.name} className="rounded-xl p-3" style={glassSubtle}><p className="text-sm font-semibold">{row.name}</p><p className="text-xs text-[#9CA3AF]">{row.meta}</p><p className="text-xs font-bold mt-1">Pending {rupees(row.amount)}</p></div>) : <EmptyState label="No history" />}</div></div>;
}

function AttendanceModule({ drivers, records, markAttendance, clearAttendance, exportCsv, select }: { drivers: Driver[]; records: AttendanceRecord[]; markAttendance: (driverId: string, date: string, status: AttendanceRecord["status"], notes?: string) => void; clearAttendance: (driverId: string, date: string) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void; select: (id: string) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  // Keep typed vehicle digits in the browser until the cell loses focus. Saving
  // every keystroke lets slower older responses overwrite a newer digit.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dates = Array.from({ length: daysInMonth(month) }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  // The dashboard totals must be based on the same cells that are visible in
  // this month grid. Old records for removed drivers or malformed month values
  // must not make the summary disagree with the table.
  const visibleDriverIds = new Set(drivers.map((driver) => driver.id));
  const visibleDates = new Set(dates);
  const monthRows = records.filter((item) => visibleDriverIds.has(item.driverId) && visibleDates.has(item.date));
  const attendanceLabel = (record: AttendanceRecord | undefined) => {
    if (!record) return "-";
    if (record.status === "Absent") return "A";
    return record.notes;
  };
  const rows = drivers.flatMap((driver) => dates.map((date) => {
    const record = records.find((item) => item.driverId === driver.id && item.date === date);
    return { driver: driver.name, date, status: record?.status || "", number: record?.status === "Present" ? record.notes : record?.status === "Absent" ? "A" : "" };
  }));
  return <div><Toolbar title="Driver Attendance" subtitle={`Type vehicle number for present, double-click a cell for absent`} filters={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} />} action={<button onClick={() => exportCsv("attendance-register", rows)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export Excel</button>} />
    <div className="grid md:grid-cols-2 gap-4 mb-4"><Metric title="Present Days" value={String(monthRows.filter((r) => r.status === "Present").length)} /><Metric title="Absent Days" value={String(monthRows.filter((r) => r.status === "Absent").length)} /></div>
    <div className="rounded-3xl border border-white/60 overflow-auto shadow-xl" style={{ background: "rgba(255,255,255,0.58)", backdropFilter: "blur(20px)" }}><table className="min-w-[1060px] w-full text-xs"><thead><tr className="border-b border-white/50"><th className="sticky left-0 bg-white/70 text-left p-3">Driver</th>{dates.map((date) => <th key={date} className="p-2 text-center">{date.slice(-2)}</th>)}<th className="p-3">%</th><th className="p-3">Driver Info</th></tr></thead><tbody>{drivers.map((d) => { const driverRows = monthRows.filter((r) => r.driverId === d.id); const present = driverRows.filter((r) => r.status === "Present").length; return <tr key={d.id} className="border-b border-white/40"><td className="sticky left-0 bg-white/70 p-3 font-semibold">{d.name}<p className="text-[10px] text-[#9CA3AF]">Yearly {attendancePercent(records.filter((r) => r.driverId === d.id))}%</p></td>{dates.map((date) => { const record = monthRows.find((item) => item.driverId === d.id && item.date === date); const key = `${d.id}:${date}`; const value = drafts[key] ?? attendanceLabel(record); return <td key={date} className="p-1 text-center"><input title="Type number for present. It saves when you leave the cell. Clear the cell to remove attendance; double-click for absent." value={value === "-" ? "" : value} placeholder="-" onFocus={() => { if (record?.status === "Absent") setDrafts((prev) => ({ ...prev, [key]: "" })); }} onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value.replace(/\D/g, "").slice(-4) }))} onBlur={() => { if (!(key in drafts)) return; const nextValue = drafts[key]; setDrafts((prev) => { const copy = { ...prev }; delete copy[key]; return copy; }); if (nextValue) markAttendance(d.id, date, "Present", nextValue); else clearAttendance(d.id, date); }} onDoubleClick={() => { setDrafts((prev) => { const copy = { ...prev }; delete copy[key]; return copy; }); markAttendance(d.id, date, "Absent", ""); }} className={`w-12 h-8 rounded-lg text-center text-[10px] font-bold outline-none ${record?.status === "Absent" ? "bg-red-50 text-red-600" : "bg-white/55"}`} /></td>; })}<td className="p-3 font-bold">{Math.round((present / Math.max(dates.length, 1)) * 100)}%</td><td className="p-3"><button onClick={() => select(d.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={glassSubtle}><UserCheck size={12} />Driver Info</button></td></tr>; })}</tbody></table></div></div>;
}

function attendancePercent(records: AttendanceRecord[]) {
  const counted = records.filter((r) => r.status === "Present").length;
  return Math.round((counted / Math.max(records.length, 1)) * 100);
}

function PayrollModule({ drivers, attendance, payroll, openModal, exportCsv }: { drivers: Driver[]; attendance: AttendanceRecord[]; payroll: PayrollRecord[]; openModal: (m: string, f?: Record<string, string>) => void; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const rows = payroll.filter((p) => p.month === month);
  const seedPayroll = (driverId: string) => { const d = drivers.find((item) => item.id === driverId); const r = attendance.filter((item) => item.driverId === driverId && item.month === month); openModal("payroll", { driverId, month, baseSalary: String(d?.salary ?? 0), presentDays: String(r.filter((item) => item.status === "Present").length), halfDays: "0", leave: String(r.filter((item) => item.status === "Absent").length), incentive: "0", bonus: "0", penalty: "0", advance: "0", advanceReason: "" }); };
  return <div><Toolbar title="Salary & Payroll" subtitle={`Manual salary, advances, bonuses and net pay for ${month}`} filters={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-2xl px-4 py-2.5 text-sm" style={glassSubtle} />} action={<><button onClick={() => exportCsv("salary-payroll", rows.map((p) => ({ driver: drivers.find((d) => d.id === p.driverId)?.name ?? "-", month: p.month, baseSalary: p.baseSalary, presentDays: p.presentDays, halfDays: p.halfDays, leave: p.leave, incentive: p.incentive, bonus: p.bonus, penalty: p.penalty, advance: p.advance, reason: p.advanceReason, netSalary: p.netSalary })))} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export</button><button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Printer size={15} />PDF</button></>} />
    <div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Salary Expense" value={rupees(rows.reduce((s, r) => s + r.netSalary, 0))} /><Metric title="Bonus Paid" value={rupees(rows.reduce((s, r) => s + r.bonus, 0))} /><Metric title="Advance Given" value={rupees(rows.reduce((s, r) => s + r.advance, 0))} /><Metric title="Drivers Pending" value={String(Math.max(drivers.length - rows.length, 0))} /></div>
    <DataCard>{drivers.map((d) => { const row = rows.find((p) => p.driverId === d.id); return <Row key={d.id}><Avatar text={initials(d.name)} /><div className="flex-1"><p className="text-sm font-semibold">{d.name}</p><p className="text-xs text-[#9CA3AF]">Attendance {attendancePercent(attendance.filter((r) => r.driverId === d.id && r.month === month))}%</p></div>{row ? <><p className="text-xs">Base {rupees(row.baseSalary)} - Bonus {rupees(row.bonus)}</p><p className="text-xs">Advance {rupees(row.advance)}{row.advanceReason ? ` - ${row.advanceReason}` : ""}</p><p className="text-sm font-bold">{rupees(row.netSalary)}</p><button onClick={() => openModal("payroll", Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)])))} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Edit</button></> : <button onClick={() => seedPayroll(d.id)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#12151C]">Generate</button>}</Row>; })}</DataCard></div>;
}
function Salary({ drivers }: { drivers: Driver[]; trips: Trip[] }) {
  return <div><Toolbar title="Driver Salary" subtitle="Salary is managed from the combined Salary & Payroll tab" /><DataCard>{drivers.map((d) => <Row key={d.id}><Avatar text={initials(d.name)} /><div className="flex-1"><p className="text-sm font-semibold">{d.name}</p><p className="text-xs text-[#9CA3AF]">Monthly salary is entered manually in payroll</p></div><p className="text-sm font-bold">{rupees(d.salary)}</p></Row>)}</DataCard></div>;
}
function Invoices({ invoices, trips, customer, openPayment }: { invoices: Invoice[]; trips: Trip[]; customer: (id: string) => Customer | undefined; openPayment: (invoice: Invoice) => void }) {
  return <div><Toolbar title="GST Invoices" subtitle="Generated from completed trips with GST-ready line items" action={<button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Printer size={15} />Print/PDF</button>} /><div className="grid xl:grid-cols-[1fr_420px] gap-4"><DataCard>{invoices.map((i) => { const t = trips.find((x) => x.id === i.tripId); const total = i.total ?? Math.round((t?.freight ?? 0) * 1.18); const balance = Math.max(total - (i.paidAmount ?? 0), 0); return <Row key={i.id}><FileText size={18} /><div className="flex-1"><p className="text-sm font-semibold">{i.id}</p><p className="text-xs text-[#9CA3AF]">{customer(i.customerId)?.company} - {t?.pickup} to {t?.drop}</p></div><p className="hidden md:block text-xs">Paid {rupees(i.paidAmount ?? 0)}</p><p className="text-sm font-bold">{rupees(balance)}</p><Badge label={i.status} />{i.status !== "Paid" && <button onClick={() => openPayment(i)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600">Update Payment</button>}</Row>; })}</DataCard><InvoicePreview invoice={invoices[0]} trip={trips.find((t) => t.id === invoices[0]?.tripId)} customer={customer(invoices[0]?.customerId)} /></div></div>;
}
function Payments({ invoices, payments, trips, customer, balanceFreights, openPayment }: { invoices: Invoice[]; payments: Payment[]; trips: Trip[]; customer: (id: string) => Customer | undefined; balanceFreights: BalanceFreightRecord[]; openPayment: (invoice: Invoice) => void }) {
  const outstanding = invoices.filter((i) => i.status !== "Paid");
  const invoicePending = outstanding.reduce((s, i) => s + ((i.total ?? 0) - (i.paidAmount ?? 0)), 0);
  const freightPending = balanceFreights.reduce((s, f) => s + f.balance, 0);
  const freightCollected = balanceFreights.reduce((s, f) => s + (f.paidAmount || f.advance || 0), 0);
  const aging = ["0-30", "31-60", "61-90", "90+"].map((bucket, index) => ({ bucket, amount: outstanding.filter((i) => Math.max(0, daysUntil(i.dueDate) * -1) >= [0, 31, 61, 91][index]).reduce((s, i) => s + ((i.total ?? 0) - (i.paidAmount ?? 0)), 0) }));
  return <div><Toolbar title="Outstanding Payment Management" subtitle="Party ledger, invoice payments and balance freight collections" action={<button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Printer size={15} />Receipt/PDF</button>} />
    <div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Invoice Pending" value={rupees(invoicePending)} /><Metric title="Freight Pending" value={rupees(freightPending)} /><Metric title="Freight Collected" value={rupees(freightCollected)} /><Metric title="Total Pending" value={rupees(invoicePending + freightPending)} /></div>
    <div className="grid xl:grid-cols-[1fr_360px] gap-4"><DataCard>{invoices.map((i) => { const t = trips.find((x) => x.id === i.tripId); const balance = Math.max((i.total ?? 0) - (i.paidAmount ?? 0), 0); return <Row key={i.id}><CreditCard size={18} /><div className="flex-1"><p className="text-sm font-semibold">Invoice - {customer(i.customerId)?.company}</p><p className="text-xs text-[#9CA3AF]">{i.id} - {t?.pickup} to {t?.drop}</p></div><p className="hidden md:block text-xs">Paid {rupees(i.paidAmount ?? 0)}</p><p className="text-sm font-bold">{rupees(balance)}</p><Badge label={i.status} />{i.status !== "Paid" && <button onClick={() => openPayment(i)} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600">Record Payment</button>}</Row>; })}{balanceFreights.map((f) => <Row key={f.id}><ClipboardList size={18} /><div className="flex-1"><p className="text-sm font-semibold">Balance Freight - {f.partyName || f.vehicleNumber}</p><p className="text-xs text-[#9CA3AF]">{f.loadingDate} - {f.vehicleNumber} - {f.from} to {f.to}</p></div><p className="hidden md:block text-xs">Advance {rupees(f.paidAmount || f.advance || 0)}</p><p className="text-sm font-bold">{rupees(f.balance)}</p><Badge label={f.status} /></Row>)}</DataCard>
      <div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">Payment Aging</h3><div className="h-56"><ResponsiveContainer><BarChart data={aging}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="bucket" /><YAxis tickFormatter={(v) => `Rs ${v / 1000}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Bar dataKey="amount" fill="#DC2626" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-4 space-y-2">{payments.map((p) => <p key={p.id} className="text-xs flex justify-between"><span>{p.id} - {p.method}</span><b>{rupees(p.amount)}</b></p>)}{balanceFreights.filter((f) => (f.paidAmount || f.advance) > 0).map((f) => <p key={f.id} className="text-xs flex justify-between"><span>{f.vehicleNumber} - balance freight</span><b>{rupees(f.paidAmount || f.advance)}</b></p>)}</div></div></div></div>;
}
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">{label}</p><p className="font-semibold mt-1 text-sm break-words">{value ?? "-"}</p></div>;
}
function TripReport({ trips, expenses, vehicles, drivers, customers, maintenancePlan, exportCsv }: { trips: Trip[]; expenses: Expense[]; vehicles: Vehicle[]; drivers: Driver[]; customers: Customer[]; maintenancePlan: MaintenanceRecord[]; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const [q, setQ] = useState("");
  const rows = trips.map((t) => {
    const tripExpenseEntries = expenses.filter((e) => e.tripId === t.id);
    const otherExpTotal = tripExpenseEntries.reduce((s, e) => s + e.amount, 0);
    const totalExpense = otherExpTotal + (t.tollCharges ?? 0) + (t.driverAllowance ?? 0) + (t.otherExpenses ?? 0);
    const profit = t.freight - totalExpense;
    const profitPercent = Math.round((profit / Math.max(t.freight, 1)) * 100);
    const vehicle = vehicles.find((v) => v.id === t.vehicleId);
    const service = maintenancePlan.filter((m) => m.vehicleId === t.vehicleId).sort((a, b) => a.dueDate < b.dueDate ? 1 : -1)[0];
    return { trip: t, customer: customers.find((c) => c.id === t.customerId), vehicle, driver: drivers.find((d) => d.id === t.driverId), tripExpenseEntries, totalExpense, profit, profitPercent, service };
  }).filter((r) => `${r.trip.id} ${r.trip.lrNumber ?? ""} ${r.customer?.company ?? ""} ${r.vehicle?.number ?? ""} ${r.driver?.name ?? ""} ${r.trip.pickup} ${r.trip.drop}`.toLowerCase().includes(q.toLowerCase()));
  const totalRevenue = rows.reduce((s, r) => s + r.trip.freight, 0);
  const totalExpense = rows.reduce((s, r) => s + r.totalExpense, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const exportRows = rows.map((r) => ({
    tripId: r.trip.id, lrNumber: r.trip.lrNumber ?? "", status: r.trip.status, customer: r.customer?.company ?? "-",
    size: r.trip.size ?? "", pickup: r.trip.pickup, drop: r.trip.drop, cargo: r.trip.cargoName || r.trip.cargo, materialType: r.trip.materialType ?? "",
    weight: r.trip.weight ?? "", quantity: r.trip.quantity ?? "", startDate: r.trip.date, endDate: r.trip.endDate ?? "",
    distanceKm: r.trip.distanceKm, durationHrs: r.trip.durationHrs, vehicle: r.vehicle?.number ?? "-", driver: r.driver?.name ?? "-",
    freight: r.trip.freight, advance: r.trip.advanceAmount ?? 0, balance: Math.max(r.trip.freight - (r.trip.advanceAmount ?? 0), 0),
    receivedDate: r.trip.receivedDate ?? "", billNo: r.trip.billNo ?? "", chNo: r.trip.chNo ?? "",
    tollCharges: r.trip.tollCharges ?? 0, driverAllowance: r.trip.driverAllowance ?? 0,
    otherExpenses: r.trip.otherExpenses ?? 0, tripLoggedExpenses: r.tripExpenseEntries.reduce((s, e) => s + e.amount, 0), totalExpense: r.totalExpense,
    profit: r.profit, profitPercent: r.profitPercent, paymentStatus: r.trip.paymentStatus ?? "", invoiceNumber: r.trip.invoiceNumber ?? "",
    ewayBill: r.trip.ewayBill ?? "", deliveryReceipt: r.trip.deliveryReceipt ?? "", podDocs: r.trip.podDocs.join(" | "), remarks: r.trip.remarks ?? "",
    lastService: r.service ? `${r.service.serviceType} (${r.service.status}, due ${r.service.dueDate})` : "-",
  }));
  return <div>
    <Toolbar title="Booking Register Report" subtitle={`${rows.length} trips - full trip-level detail with linked vehicle service`} search={q} setSearch={setQ} action={<button onClick={() => exportCsv("trip-report", exportRows)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export Excel</button>} />
    <div className="grid lg:grid-cols-4 gap-4 mb-4"><Metric title="Trips" value={String(rows.length)} /><Metric title="Revenue" value={rupees(totalRevenue)} /><Metric title="Total Expense" value={rupees(totalExpense)} /><Metric title="Net Profit" value={rupees(totalProfit)} /></div>
    <div className="rounded-2xl p-6 mb-4" style={glass}><h3 className="font-bold mb-4">Revenue vs Expense vs Profit</h3><div className="h-64"><ResponsiveContainer><BarChart data={rows.map((r) => ({ name: r.trip.id.slice(-8), revenue: r.trip.freight, expense: r.totalExpense, profit: r.profit }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `Rs ${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Legend /><Bar dataKey="revenue" fill="#10B981" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" fill="#F97316" radius={[5, 5, 0, 0]} /><Bar dataKey="profit" fill="#2563EB" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <div className="space-y-4">
      {rows.map((r) => <div key={r.trip.id} className="rounded-2xl overflow-hidden" style={glass}>
        <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/50">
          <div><p className="text-sm font-extrabold">{r.trip.id} {r.trip.lrNumber ? `- ${r.trip.lrNumber}` : ""}</p><p className="text-xs text-[#9CA3AF]">{r.trip.pickup} <ChevronRight size={11} className="inline" /> {r.trip.drop} - {r.trip.date}{r.trip.endDate ? ` to ${r.trip.endDate}` : ""}</p></div>
          <div className="flex items-center gap-2"><Badge label={r.trip.status} /><Badge label={r.trip.paymentStatus || "Pending"} /></div>
        </div>
        <div className="p-5 grid md:grid-cols-3 xl:grid-cols-4 gap-3">
          <DetailField label="Customer" value={r.customer?.company ?? "-"} />
          <DetailField label="Vehicle" value={r.vehicle?.number ?? "-"} />
          <DetailField label="Driver" value={r.driver?.name ?? "-"} />
          <DetailField label="Cargo" value={r.trip.cargoName || r.trip.cargo} />
          <DetailField label="Material Type" value={r.trip.materialType} />
          <DetailField label="Weight / Quantity" value={`${r.trip.weight || "-"} / ${r.trip.quantity || "-"}`} />
          <DetailField label="Size" value={r.trip.size || "-"} />
          <DetailField label="Distance / Duration" value={`${r.trip.distanceKm} km - ${r.trip.durationHrs} hrs`} />
          <DetailField label="Invoice Number" value={r.trip.invoiceNumber || "-"} />
          <DetailField label="Freight" value={rupees(r.trip.freight)} />
          <DetailField label="Advance" value={rupees(r.trip.advanceAmount ?? 0)} />
          <DetailField label="Balance" value={rupees(Math.max(r.trip.freight - (r.trip.advanceAmount ?? 0), 0))} />
          <DetailField label="Received Date" value={r.trip.receivedDate || "-"} />
          <DetailField label="Bill No. / Ch. No." value={`${r.trip.billNo || "-"} / ${r.trip.chNo || "-"}`} />
          <DetailField label="Toll Charges" value={rupees(r.trip.tollCharges ?? 0)} />
          <DetailField label="Driver Allowance" value={rupees(r.trip.driverAllowance ?? 0)} />
          <DetailField label="Other Expenses" value={rupees(r.trip.otherExpenses ?? 0)} />
          <DetailField label="Total Expense" value={rupees(r.totalExpense)} />
          <DetailField label="Profit / Loss" value={`${rupees(r.profit)} (${r.profitPercent}%)`} />
          <DetailField label="E-way Bill / Delivery Receipt" value={`${r.trip.ewayBill || "-"} / ${r.trip.deliveryReceipt || "-"}`} />
        </div>
        <div className="px-5 pb-5 grid md:grid-cols-2 gap-3">
          <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF] mb-1">POD / Trip Documents</p>{r.trip.podDocs.length ? <p className="text-xs font-semibold">{r.trip.podDocs.join(", ")}</p> : <p className="text-xs text-[#9CA3AF]">No documents attached</p>}</div>
          <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF] mb-1">Linked Vehicle Service</p>{r.service ? <p className="text-xs font-semibold">{r.service.serviceType} - {r.service.workshop} - {rupees(r.service.serviceCost)} - <Badge label={r.service.status} /> - due {r.service.dueDate}</p> : <p className="text-xs text-[#9CA3AF]">No service record for this vehicle</p>}</div>
        </div>
        {r.trip.remarks && <div className="px-5 pb-5"><div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Remarks</p><p className="text-xs mt-1">{r.trip.remarks}</p></div></div>}
      </div>)}
      {!rows.length && <EmptyState label="No trips match this search" />}
    </div>
  </div>;
}
function FreightRegisterReport({ balanceFreights, exportCsv }: { balanceFreights: BalanceFreightRecord[]; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const [q, setQ] = useState("");
  const rows = balanceFreights.filter((f) => `${f.freightId ?? f.id} ${f.partyName} ${f.vehicleNumber} ${f.from} ${f.to} ${f.invoiceNumber ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const totalFreight = rows.reduce((s, f) => s + (f.finalAmount ?? f.freight), 0);
  const totalAdvance = rows.reduce((s, f) => s + (f.paidAmount || f.advance || 0), 0);
  const totalBalance = rows.reduce((s, f) => s + f.balance, 0);
  const exportRows = rows.map((f) => ({
    freightId: f.freightId || f.id, challanNo: f.challanNo || "", ownerName: f.ownerName || "", cnNo: f.cnNo || "",
    loadingDate: f.loadingDate, vehicle: f.vehicleNumber, party: f.partyName, size: f.size ?? "", weight: f.weight ?? "", rate: f.rate ?? 0, from: f.from, to: f.to,
    freight: f.freight, advanceEntries: (f.advances ?? []).map((a) => `${a.date}:${a.mode}:${a.amount}`).join(" | "),
    partyAdvance: f.partyAdvance ?? f.advance, advanceBalance: f.advanceBalance ?? 0,
    commissionPercent: f.commissionPercent ?? 0, commission: f.commission, hamali: f.hamali, detention: f.payCharge,
    extraHeight: f.extraHeight ?? 0, weightRecipt: f.weightRecipt ?? 0, paymentChg: f.paymentChg ?? 0, challanFineChg: f.challanFineChg ?? 0,
    unlodingChg: f.unlodingChg ?? 0, extraWeightChg: f.extraWeightChg ?? 0, extraWidthChg: f.extraWidthChg ?? 0,
    otherCharges: f.otherCharges, otherChargesReason: f.otherChargesReason ?? "",
    paidAmount: f.paidAmount, balance: f.balance, billNo: f.billNo ?? "", balancePaymentDate: f.balancePaymentDate ?? "", chequeNeft: f.chequeNeftNumber, bank: f.bank, paymentDate: f.paymentDate, status: f.status,
    linkedTrips: (f.linkedTrips ?? []).join(" | "), invoiceNumber: f.invoiceNumber ?? "", billingDate: f.billingDate ?? "",
    additionalCharges: f.additionalCharges ?? 0, discount: f.discount ?? 0, gst: f.gst ?? 0, finalAmount: f.finalAmount ?? f.freight,
    dueDate: f.dueDate ?? "", paymentMode: f.paymentMode ?? "", remarks: f.remarks,
  }));
  return <div>
    <Toolbar title="Vehicle Register Report" subtitle={`${rows.length} balance-freight records - full ledger-level detail`} search={q} setSearch={setQ} action={<button onClick={() => exportCsv("freight-register-report", exportRows)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export Excel</button>} />
    <div className="grid lg:grid-cols-4 gap-4 mb-4"><Metric title="Records" value={String(rows.length)} /><Metric title="Total Freight" value={rupees(totalFreight)} /><Metric title="Collected" value={rupees(totalAdvance)} /><Metric title="Balance Outstanding" value={rupees(totalBalance)} /></div>
    <div className="rounded-2xl p-6 mb-4" style={glass}><h3 className="font-bold mb-4">Freight vs Collected vs Balance</h3><div className="h-64"><ResponsiveContainer><BarChart data={rows.map((f) => ({ name: (f.freightId || f.id).slice(-8), freight: f.finalAmount ?? f.freight, collected: f.paidAmount || f.advance || 0, balance: f.balance }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `Rs ${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Legend /><Bar dataKey="freight" fill="#2563EB" radius={[5, 5, 0, 0]} /><Bar dataKey="collected" fill="#10B981" radius={[5, 5, 0, 0]} /><Bar dataKey="balance" fill="#DC2626" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <div className="space-y-4">
      {rows.map((f) => <div key={f.id} className="rounded-2xl overflow-hidden" style={glass}>
        <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/50">
          <div><p className="text-sm font-extrabold">{f.freightId || f.id} - {f.partyName}</p><p className="text-xs text-[#9CA3AF]">{f.vehicleNumber} - {f.from} <ChevronRight size={11} className="inline" /> {f.to} - Loaded {f.loadingDate}</p></div>
          <Badge label={f.status} />
        </div>
        <div className="p-5 grid md:grid-cols-3 xl:grid-cols-4 gap-3">
          <DetailField label="Challan No." value={f.challanNo || "-"} />
          <DetailField label="Owner Name" value={f.ownerName || "-"} />
          <DetailField label="CN No." value={f.cnNo || "-"} />
          <DetailField label="Weight" value={f.weight || "-"} />
          <DetailField label="Size" value={f.size || "-"} />
          <DetailField label="Freight Amount" value={rupees(f.freight)} />
          <DetailField label="Advance Entries" value={(f.advances ?? []).length ? (f.advances ?? []).map((a) => `${a.date} - ${a.mode} - ${rupees(a.amount)}`).join(", ") : "-"} />
          <DetailField label="Total Advance" value={rupees(f.partyAdvance ?? f.advance)} />
          <DetailField label="Commission" value={`${rupees(f.commission)} (${f.commissionPercent ?? 0}%)`} />
          <DetailField label="Extra Width" value={rupees(f.extraWidthChg ?? 0)} />
          <DetailField label="Hamali" value={rupees(f.hamali)} />
          <DetailField label="Detention" value={rupees(f.payCharge)} />
          <DetailField label="Weight Receipt" value={rupees(f.weightRecipt ?? 0)} />
          <DetailField label="Unloading Chg" value={rupees(f.unlodingChg ?? 0)} />
          <DetailField label="Extra Weight" value={rupees(f.extraWeightChg ?? 0)} />
          <DetailField label="Other Charges" value={rupees(f.otherCharges)} />
          <DetailField label="Reason for Other Charges" value={f.otherChargesReason || "-"} />
          <DetailField label="Net Balance" value={rupees(f.balance)} />
          <DetailField label="Bill No." value={f.billNo || "-"} />
          <DetailField label="Balance Payment Date" value={f.balancePaymentDate || "-"} />
          <DetailField label="Cash / Bank" value={f.paymentMode || "-"} />
          <DetailField label="Cheque / NEFT No." value={f.chequeNeftNumber || "-"} />
          <DetailField label="Bank" value={f.bank || "-"} />
          <DetailField label="Payment Date" value={f.paymentDate || "-"} />
          <DetailField label="Linked Trips" value={(f.linkedTrips ?? []).join(", ") || "-"} />
          <DetailField label="Billing Date" value={f.billingDate || "-"} />
          <DetailField label="Additional Charges" value={rupees(f.additionalCharges ?? 0)} />
          <DetailField label="GST" value={rupees(f.gst ?? 0)} />
          <DetailField label="Final Amount" value={rupees(f.finalAmount ?? f.freight)} />
          <DetailField label="Due Date" value={f.dueDate || "-"} />
          <DetailField label="Payment Mode" value={f.paymentMode || "-"} />
        </div>
        {f.remarks && <div className="px-5 pb-5"><div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Remarks</p><p className="text-xs mt-1">{f.remarks}</p></div></div>}
      </div>)}
      {!rows.length && <EmptyState label="No freight register records match this search" />}
    </div>
  </div>;
}
function Reports({ trips, expenses, invoices, vehicles, drivers, customers, documents, maintenancePlan, balanceFreights, exportCsv }: { trips: Trip[]; expenses: Expense[]; invoices: Invoice[]; vehicles: Vehicle[]; drivers: Driver[]; customers: Customer[]; documents: DocumentRecord[]; maintenancePlan: MaintenanceRecord[]; balanceFreights: BalanceFreightRecord[]; exportCsv: (n: string, rows: Record<string, string | number>[]) => void }) {
  const [reportType, setReportType] = useState("Booking Register Report");
  if (reportType === "Booking Register Report") {
    return <div><div className="flex flex-wrap gap-2 mb-4">{["Vehicle", "Driver", "Booking Register Report", "Vehicle Register Report", "Party Ledger", "Fuel", "Expense", "Invoice / Payment", "Maintenance", "Print"].map((name) => <button key={name} onClick={() => name === "Print" ? window.print() : setReportType(name)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={name === reportType ? { background: "#12151C", color: "#fff" } : glassSubtle}>{name === "Print" ? <><Printer size={13} className="inline mr-1" />Print</> : name}</button>)}</div>
      <TripReport trips={trips} expenses={expenses} vehicles={vehicles} drivers={drivers} customers={customers} maintenancePlan={maintenancePlan} exportCsv={exportCsv} /></div>;
  }
  if (reportType === "Vehicle Register Report") {
    return <div><div className="flex flex-wrap gap-2 mb-4">{["Vehicle", "Driver", "Booking Register Report", "Vehicle Register Report", "Party Ledger", "Fuel", "Expense", "Invoice / Payment", "Maintenance", "Print"].map((name) => <button key={name} onClick={() => name === "Print" ? window.print() : setReportType(name)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={name === reportType ? { background: "#12151C", color: "#fff" } : glassSubtle}>{name === "Print" ? <><Printer size={13} className="inline mr-1" />Print</> : name}</button>)}</div>
      <FreightRegisterReport balanceFreights={balanceFreights} exportCsv={exportCsv} /></div>;
  }
  const reportRows = reportType === "Vehicle" ? vehicles.map((v) => ({ trip: v.number, route: v.model, customer: v.ownerName || "-", vehicle: v.status, driver: v.driverHistory?.at(-1)?.driverName ?? "-", revenue: trips.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.freight, 0), expense: expenses.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + e.amount, 0), profit: trips.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.freight, 0) - expenses.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + e.amount, 0), profitPercent: 0, status: `${documents.filter((d) => d.ownerId === v.id && d.status !== "Valid").length} docs due` })) : reportType === "Driver" ? drivers.map((d) => ({ trip: d.name, route: d.license, customer: d.phone, vehicle: d.assignedVehicleId || "-", driver: d.status, revenue: d.earnings ?? trips.filter((t) => t.driverId === d.id).reduce((s, t) => s + t.freight, 0), expense: d.salary, profit: (d.earnings ?? 0) - d.salary, profitPercent: 0, status: `${trips.filter((t) => t.driverId === d.id && t.status === "Completed").length} completed` })) : reportType === "Fuel" ? expenses.filter((e) => e.category === "Fuel").map((e) => ({ trip: e.tripId ?? "General", route: e.note, customer: "Fuel", vehicle: vehicles.find((v) => v.id === e.vehicleId)?.number ?? "-", driver: drivers.find((d) => d.id === e.driverId)?.name ?? "-", revenue: 0, expense: e.amount, profit: -e.amount, profitPercent: 0, status: e.date })) : reportType === "Expense" ? expenses.map((e) => ({ trip: e.tripId ?? "General", route: e.note, customer: e.category, vehicle: vehicles.find((v) => v.id === e.vehicleId)?.number ?? "-", driver: drivers.find((d) => d.id === e.driverId)?.name ?? "-", revenue: 0, expense: e.amount, profit: -e.amount, profitPercent: 0, status: e.date })) : reportType === "Party Ledger" ? customers.map((c) => { const freight = balanceFreights.filter((f) => f.partyName === c.company); const inv = invoices.filter((i) => i.customerId === c.id); const total = freight.reduce((s, f) => s + (f.finalAmount ?? f.freight), 0) + inv.reduce((s, i) => s + (i.total ?? 0), 0); const paid = freight.reduce((s, f) => s + (f.paidAmount || f.advance || 0), 0) + inv.reduce((s, i) => s + (i.paidAmount ?? 0), 0); return { trip: c.company, route: c.gst, customer: c.contact, vehicle: c.phone, driver: "Debit/Credit", revenue: total, expense: paid, profit: total - paid, profitPercent: 0, status: `Limit ${rupees(c.creditLimit ?? 0)}` }; }) : reportType === "Invoice / Payment" ? invoices.map((i) => ({ trip: i.id, route: trips.find((t) => t.id === i.tripId)?.id ?? "-", customer: customers.find((c) => c.id === i.customerId)?.company ?? "-", vehicle: "-", driver: "-", revenue: i.total ?? 0, expense: i.paidAmount ?? 0, profit: Math.max((i.total ?? 0) - (i.paidAmount ?? 0), 0), profitPercent: 0, status: i.status })) : reportType === "Maintenance" ? maintenancePlan.map((m) => ({ trip: m.id, route: m.serviceType, customer: m.workshop, vehicle: vehicles.find((v) => v.id === m.vehicleId)?.number ?? "-", driver: m.mechanic, revenue: 0, expense: m.serviceCost, profit: -m.serviceCost, profitPercent: 0, status: m.status })) : [];
  const reportButtons = ["Vehicle", "Driver", "Booking Register Report", "Vehicle Register Report", "Party Ledger", "Fuel", "Expense", "Invoice / Payment", "Maintenance", "Print"];
  return <div><Toolbar title="Reports" subtitle={`${reportType} details`} action={<button onClick={() => exportCsv(`${reportType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report`, reportRows)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}><Download size={15} />Export CSV</button>} />
    <div className="flex flex-wrap gap-2 mb-4">{reportButtons.map((name) => <button key={name} onClick={() => name === "Print" ? window.print() : setReportType(name)} className="px-3 py-2 rounded-xl text-xs font-semibold" style={name === reportType ? { background: "#12151C", color: "#fff" } : glassSubtle}>{name === "Print" ? <><Printer size={13} className="inline mr-1" />Print</> : name}</button>)}</div>
    <div className="grid lg:grid-cols-4 gap-4 mb-4"><Metric title="Revenue" value={rupees(reportRows.reduce((s, r) => s + r.revenue, 0))} /><Metric title="Expenses" value={rupees(reportRows.reduce((s, r) => s + r.expense, 0))} /><Metric title="Profit / Balance" value={rupees(reportRows.reduce((s, r) => s + r.profit, 0))} /><Metric title="Documents Due" value={String(documents.filter((d) => d.status !== "Valid").length)} /></div>
    <div className="rounded-2xl p-6 mb-4" style={glass}><h3 className="font-bold mb-4">Report Graph</h3><div className="h-64"><ResponsiveContainer><BarChart data={reportRows.map((r) => ({ name: String(r.trip).slice(-8), revenue: r.revenue, expense: r.expense, profit: r.profit }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff80" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `Rs ${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => rupees(Number(v))} /><Legend /><Bar dataKey="revenue" fill="#10B981" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" fill="#F97316" radius={[5, 5, 0, 0]} /><Bar dataKey="profit" fill="#2563EB" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <DataCard>{reportRows.map((r) => <Row key={`${r.trip}-${r.route}-${r.status}`}><ClipboardList size={18} /><div className="flex-1"><p className="text-sm font-semibold">{r.trip} - {r.route}</p><p className="text-xs text-[#9CA3AF]">{r.customer} - {r.vehicle} - {r.driver}</p></div><p className="hidden md:block text-xs">Profit {r.profitPercent}%</p><p className="text-sm font-bold">{rupees(r.profit)}</p><Badge label={r.status} /></Row>)}</DataCard></div>;
}
function DriverPerformance({ drivers, trips, expenses, payroll }: { drivers: Driver[]; trips: Trip[]; expenses: Expense[]; payroll: PayrollRecord[] }) {
  const rows = drivers.map((d) => {
    const driverTrips = trips.filter((t) => t.driverId === d.id);
    const completed = driverTrips.filter((t) => t.status === "Completed");
    const distance = driverTrips.reduce((s, t) => s + t.distanceKm, 0);
    const revenue = driverTrips.reduce((s, t) => s + t.freight, 0);
    const fuel = expenses.filter((e) => e.driverId === d.id && e.category === "Fuel");
    const mileage = fuel.length ? fuel.reduce((s, e) => s + (e.mileage ?? 0), 0) / fuel.length : 5.1;
    const lateDeliveries = d.id === "drv-2" ? 1 : 0;
    const accidents = d.id === "drv-3" ? 0 : 0;
    const bonusPaid = payroll.filter((p) => p.driverId === d.id).reduce((s, p) => s + p.bonus, 0);
    const advance = payroll.filter((p) => p.driverId === d.id).reduce((s, p) => s + p.advance, 0);
    const penalty = payroll.filter((p) => p.driverId === d.id).reduce((s, p) => s + p.penalty, 0) + lateDeliveries * 500;
    const score = Math.max(0, Math.min(100, Math.round(55 + completed.length * 7 + mileage * 5 - lateDeliveries * 8 - accidents * 15)));
    return { driver: d, completed: completed.length, distance, revenue, mileage, lateDeliveries, attendance: 24, leave: d.id === "drv-2" ? 2 : 1, advance, bonusPaid, accidents, penalty, score };
  }).sort((a, b) => b.score - a.score);
  return <div><Toolbar title="Driver Score" subtitle="Scorecard, leaderboard, bonus paid, revenue, fuel efficiency and attendance" /><div className="grid md:grid-cols-4 gap-4 mb-4"><Metric title="Top Driver" value={rows[0]?.driver.name ?? "-"} /><Metric title="Best Score" value={`${rows[0]?.score ?? 0}/100`} /><Metric title="Bonus Paid" value={rupees(rows.reduce((s, r) => s + r.bonusPaid, 0))} /><Metric title="Needs Improvement" value={rows.filter((r) => r.score < 70).map((r) => r.driver.name).join(", ") || "None"} /></div><DataCard>{rows.map((r, index) => <Row key={r.driver.id}><Avatar text={String(index + 1)} /><div className="flex-1"><p className="text-sm font-semibold">{r.driver.name}</p><p className="text-xs text-[#9CA3AF]">{r.completed} trips - {r.distance} km - {rupees(r.revenue)} revenue</p></div><p className="hidden md:block text-xs">{r.mileage.toFixed(1)} km/L</p><p className="hidden lg:block text-xs">{r.attendance} working - {r.leave} leave</p><p className="hidden xl:block text-xs">Bonus {rupees(r.bonusPaid)} - Advance {rupees(r.advance)}</p><p className="text-xl font-extrabold">{r.score}</p><Badge label={r.score >= 80 ? "Top Driver" : r.score < 70 ? "Needs Improvement" : "Average"} /></Row>)}</DataCard></div>;
}
function Notifications({ notes, setNotes }: { notes: Notification[]; setNotes: React.Dispatch<React.SetStateAction<Notification[]>> }) {
  return <div><Toolbar title="Notifications" subtitle={`${notes.filter((n) => !n.read).length} unread reminders and alerts`} action={<button onClick={() => setNotes((n) => n.map((x) => ({ ...x, read: true })))} className="px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Mark all read</button>} /><DataCard>{notes.map((n) => { const isEmi = n.type === "emi"; return <Row key={n.id}><Bell size={18} className={isEmi ? "text-red-600" : n.read ? "text-[#9CA3AF]" : "text-blue-600"} /><div className={`flex-1 ${isEmi ? "rounded-xl border-2 border-red-400 bg-red-50 px-3 py-2" : ""}`}><p className={isEmi ? "text-sm font-extrabold text-red-700" : "text-sm font-semibold"}>{n.title}</p><p className={isEmi ? "text-xs font-bold text-red-600" : "text-xs text-[#9CA3AF]"}>{n.message}</p></div><Badge label={isEmi ? "EMI DUE" : n.type} /><button onClick={() => setNotes((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))} className="px-3 py-2 rounded-xl text-xs font-semibold" style={glassSubtle}>Read</button></Row>; })}</DataCard></div>;
}
function Settings({ role, setRole, profileName, setProfileName }: { role: Role; setRole: (r: Role) => void; profileName: string; setProfileName: (v: string) => void }) { return <div><Toolbar title="Settings & Profile" subtitle="Role-based access, company profile, reminders and notification preferences" /><div className="grid md:grid-cols-2 gap-4"><div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">User Profile</h3><Field label="Name" value={profileName} onChange={setProfileName} /><SelectField label="Role" value={role} onChange={(v) => setRole(v as Role)} options={[{ value: "admin", label: "Admin / Manager" }, { value: "driver", label: "Driver" }]} /></div><div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">Reminder Rules</h3>{["Insurance 30 days before expiry", "License 30 days before expiry", "Payment due and overdue alerts", "Maintenance schedule alerts"].map((x) => <label key={x} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" defaultChecked />{x}</label>)}</div></div></div>; }

function ApiSettings({ config, setConfig, notify }: { config: ApiConfig; setConfig: React.Dispatch<React.SetStateAction<ApiConfig>>; notify: (title: string, message: string, type?: string) => void }) {
  const set = <K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) => setConfig((prev) => ({ ...prev, [key]: value }));
  const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const save = () => { notify("API configuration saved", "Your SBR Portal API settings have been updated."); };
  const testConnection = async () => {
    if (!config.baseUrl.trim() || !config.apiToken.trim()) {
      notify("Missing details", "Add a Base URL and API Token before testing.", "alert");
      return;
    }
    try {
      const res = await fetch(config.baseUrl, { headers: { Authorization: `Bearer ${config.apiToken}` } });
      setConfig((prev) => ({ ...prev, connected: res.ok, lastSynced: res.ok ? nowTime() : prev.lastSynced }));
      notify(res.ok ? "Connection successful" : `Connection failed (${res.status})`, res.ok ? "SBR Portal API responded successfully." : "The API returned an error status - double check the Base URL and token.", res.ok ? "system" : "alert");
    } catch {
      setConfig((prev) => ({ ...prev, connected: false }));
      notify("Connection failed", "Could not reach the API. Check the Base URL, or the API may be blocking browser requests (CORS) - in that case it needs to be called from a backend, not directly from this page.", "alert");
    }
  };
  const syncNow = () => { setConfig((prev) => ({ ...prev, lastSynced: nowTime() })); notify("Sync started", "Pulling latest vehicle telemetry from SBR Portal."); };
  return <div><Toolbar title="SBR Portal API Settings" subtitle="Fuel status, live location, GPS signal and vehicle telemetry integration" action={<div className="flex gap-2"><button onClick={testConnection} className="px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Test Connection</button><button onClick={syncNow} className="px-4 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Sync Now</button><button onClick={save} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]">Save Configuration</button></div>} />
    <div className="grid xl:grid-cols-[1fr_280px] gap-4">
      <div className="rounded-2xl overflow-hidden" style={glass}>
        <div className="p-5 bg-[#12151C] text-white"><h3 className="font-bold">SBR Portal API Configuration</h3><p className="text-xs text-white/60">Vehicle GPS, fuel, ignition and route sync</p></div>
        <div className="p-6 grid md:grid-cols-2 gap-4">
          <Field label="Base URL" value={config.baseUrl} onChange={(v) => set("baseUrl", v)} />
          <SelectField label="Environment" value={config.environment} onChange={(v) => set("environment", v)} options={[{ value: "Production", label: "Production" }, { value: "Sandbox", label: "Sandbox" }]} />
          <Field label="API Token" value={config.apiToken} onChange={(v) => set("apiToken", v)} />
          <Field label="Account / Organization ID" value={config.orgId} onChange={(v) => set("orgId", v)} />
          <Field label="Live Location Endpoint" value={config.liveLocationEndpoint} onChange={(v) => set("liveLocationEndpoint", v)} />
          <Field label="Fuel Status Endpoint" value={config.fuelStatusEndpoint} onChange={(v) => set("fuelStatusEndpoint", v)} />
          <Field label="Vehicle Mapping Key" value={config.vehicleMappingKey} onChange={(v) => set("vehicleMappingKey", v)} />
          <Field label="Polling Interval (sec)" type="number" value={config.pollingInterval} onChange={(v) => set("pollingInterval", v)} />
          <Field label="Webhook URL" value={config.webhookUrl} onChange={(v) => set("webhookUrl", v)} />
          <Field label="Timeout (ms)" type="number" value={config.timeoutMs} onChange={(v) => set("timeoutMs", v)} />
        </div>
        <div className="px-6 pb-6 grid md:grid-cols-3 gap-3">
          <label className="rounded-2xl p-4 text-sm font-semibold flex items-center gap-3" style={glassSubtle}><input type="checkbox" checked={config.syncLiveLocation} onChange={(e) => set("syncLiveLocation", e.target.checked)} />Sync live location</label>
          <label className="rounded-2xl p-4 text-sm font-semibold flex items-center gap-3" style={glassSubtle}><input type="checkbox" checked={config.syncFuelLevel} onChange={(e) => set("syncFuelLevel", e.target.checked)} />Sync fuel level</label>
          <label className="rounded-2xl p-4 text-sm font-semibold flex items-center gap-3" style={glassSubtle}><input type="checkbox" checked={config.syncIgnitionGps} onChange={(e) => set("syncIgnitionGps", e.target.checked)} />Sync ignition/GPS</label>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl p-5" style={glass}>
          <Badge label={config.connected ? "Connected" : "Not connected"} />
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex justify-between"><span>Base URL</span><b className="truncate max-w-[150px]" title={config.baseUrl}>{config.baseUrl || "-"}</b></p>
            <p className="flex justify-between"><span>Last synced</span><b>{config.lastSynced}</b></p>
            <p className="flex justify-between"><span>Location sync</span><b>{config.syncLiveLocation ? `Every ${config.pollingInterval}s` : "Off"}</b></p>
            <p className="flex justify-between"><span>Fuel sync</span><b>{config.syncFuelLevel ? "Enabled" : "Off"}</b></p>
          </div>
        </div>
        <DataCard>{["Authentication Guide", "Live Location Payload", "Fuel Status Payload", "Vehicle Mapping Rules", "Error Code Reference"].map((item) => <Row key={item}><FileText size={16} /><span className="text-sm font-semibold">{item}</span></Row>)}</DataCard>
      </div>
    </div>
  </div>;
}

type BackendUser = { _id: string; name: string; email?: string; phone?: string; role: string };

function UsersSettings({ profileName, role, authToken }: { profileName: string; role: Role; authToken: string | null }) {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "manager" });

  async function loadUsers() {
    if (!authToken) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE}/auth/users`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, [authToken]);

  async function handleCreate() {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setFormError("Name, email and password are required");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setNewUser({ name: "", email: "", password: "", role: "manager" });
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <Toolbar title="Users" subtitle="User access and invitation management" action={<button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]"><Plus size={15} />Invite User</button>} />
    {showForm && (
      <div className="rounded-2xl p-6 mb-4" style={glass}>
        <h3 className="font-bold mb-4">Invite a new user</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-[#374151] mb-1.5">Name</label><input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border border-white/70 bg-white/55" /></div>
          <div><label className="block text-sm font-medium text-[#374151] mb-1.5">Email</label><input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border border-white/70 bg-white/55" /></div>
          <div><label className="block text-sm font-medium text-[#374151] mb-1.5">Password</label><input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border border-white/70 bg-white/55" /></div>
          <div><label className="block text-sm font-medium text-[#374151] mb-1.5">Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border border-white/70 bg-white/55">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="driver">Driver</option>
            </select>
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-red-500 font-medium">{formError}</p>}
        <div className="mt-4 flex gap-3">
          <button disabled={saving} onClick={handleCreate} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C] disabled:opacity-60">{saving ? "Saving..." : "Create user"}</button>
          <button onClick={() => { setShowForm(false); setFormError(""); }} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Cancel</button>
        </div>
      </div>
    )}
    {loading && <p className="text-sm text-[#9CA3AF]">Loading users...</p>}
    {loadError && <p className="text-sm text-red-500 font-medium">{loadError}</p>}
    {!loading && !loadError && (
      <DataCard>
        {users.length === 0 && <EmptyState label="No users yet" />}
        {users.map((user) => <Row key={user._id}><Avatar text={initials(user.name)} /><div className="flex-1"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-[#9CA3AF]">{user.email || user.phone}</p></div><Badge label={user.role} /></Row>)}
      </DataCard>
    )}
  </div>;
}

function RolesSettings() {
  const roles = [{ name: "Admin", access: "Full access across company, users, backup and audit logs", users: 1 }, { name: "Manager", access: "Vehicles, drivers, trips, documents, live tracking and reports", users: 1 }, { name: "Accountant", access: "Billing, payments, freight register, GST invoices and reports", users: 1 }, { name: "Driver", access: "Update assigned trip status, upload POD and view assigned trips", users: 3 }];
  return <div><Toolbar title="Roles" subtitle="Permission groups for enterprise access control" />
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{roles.map((role) => <div key={role.name} className="rounded-2xl p-5" style={glass}><ShieldCheck size={18} /><p className="mt-4 text-lg font-bold">{role.name}</p><p className="text-xs text-[#9CA3AF]">{role.access}</p><p className="mt-4 text-sm font-semibold">{role.users} users</p></div>)}</div>
    <div className="rounded-2xl p-6 mt-4" style={glass}><h3 className="font-bold mb-4">Permission Matrix</h3>{["Dashboard", "Vehicles", "Drivers", "Trips", "Documents", "Billing", "Payments", "Freight Register", "Reports", "Audit Logs", "Backup / Restore"].map((item) => <label key={item} className="flex items-center justify-between py-2 text-sm border-b border-white/40 last:border-b-0"><span>{item}</span><input type="checkbox" defaultChecked /></label>)}</div>
  </div>;
}

function CompanySettings({ profile, setProfile, setProfileName, authToken, notify }: { profile: CompanyProfile; setProfile: React.Dispatch<React.SetStateAction<CompanyProfile>>; setProfileName: (v: string) => void; authToken: string | null; notify: (title: string, message: string, type?: string) => void }) {
  const [draft, setDraft] = useState<CompanyProfile>(profile);
  useEffect(() => setDraft(profile), [profile]);
  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(profile);
  const save = async () => {
    try {
      const saved = await apiFetch("/company-profile", authToken, { method: "PUT", body: JSON.stringify(companyProfileToApiPayload(draft)) });
      const nextProfile = mapCompanyProfileFromApi(saved);
      setProfile(nextProfile);
      setProfileName(nextProfile.name || PORTAL_NAME);
      notify("Changes saved", "Company settings were saved permanently to the database.");
    } catch (error) {
      notify("Save failed", error instanceof Error ? error.message : "Company settings could not be saved to the database.", "alert");
    }
  };
  return <div><Toolbar title="Company" subtitle="Company profile, billing identity and reminder defaults" action={hasChanges ? <button onClick={save} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]">Save Changes</button> : undefined} />
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl p-6" style={glass}>
        <h3 className="font-bold mb-4">Company Profile</h3>
        <Field label="Company Name" value={draft.name} onChange={(v) => set("name", v)} />
        <Field label="Tagline" value={draft.tagline || ""} onChange={(v) => set("tagline", v)} />
        <Field label="GST Number" value={draft.gst} onChange={(v) => set("gst", v.toUpperCase())} />
        <Field label="Phone" value={draft.phone} onChange={(v) => set("phone", v)} />
        <Field label="Phone (2)" value={draft.phone2 || ""} onChange={(v) => set("phone2", v)} />
        <Field label="Email" value={draft.email || ""} onChange={(v) => set("email", v)} />
        <Field label="Address" value={draft.address} onChange={(v) => set("address", v)} />
        <Field label="Bill Jurisdiction (City)" value={draft.jurisdiction || ""} onChange={(v) => set("jurisdiction", v)} />
      </div>
      <div className="rounded-2xl p-6" style={glass}>
        <h3 className="font-bold mb-4">Freight Bill - Bank & PAN Details</h3>
        <Field label="PAN No." value={draft.pan || ""} onChange={(v) => set("pan", v.toUpperCase())} />
        <Field label="Bank Name" value={draft.bankName || ""} onChange={(v) => set("bankName", v)} />
        <Field label="Branch" value={draft.bankBranch || ""} onChange={(v) => set("bankBranch", v)} />
        <Field label="A/C No." value={draft.bankAccount || ""} onChange={(v) => set("bankAccount", v)} />
        <Field label="IFSC Code" value={draft.bankIfsc || ""} onChange={(v) => set("bankIfsc", v.toUpperCase())} />
      </div>
      <div className="rounded-2xl p-6" style={glass}><h3 className="font-bold mb-4">Reminder Rules</h3>{["Insurance 30 days before expiry", "License 30 days before expiry", "Payment due and overdue alerts", "Maintenance schedule alerts"].map((x) => <label key={x} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" defaultChecked />{x}</label>)}</div>
    </div>
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
      {["Audit logs", "Data backup and restore", "Excel import/export", "PDF export", "One-click printing", "WhatsApp invoice sharing", "SMS notifications", "Multi-company support", "Activity logs"].map((item) => <div key={item} className="rounded-2xl p-5" style={glass}><CheckCircle2 size={18} className="text-emerald-600" /><p className="mt-3 text-sm font-bold">{item}</p><p className="text-xs text-[#9CA3AF]">Enabled for production workflow</p></div>)}
    </div>
  </div>;
}

function VehicleForm({ form, setForm, drivers, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; drivers?: Driver[]; onSave: (files: { category: string; fileName: string; dataUrl?: string }[]) => void }) {
  const [rcFiles, setRcFiles] = useState<UploadedFile[]>([]);
  const [insuranceFiles, setInsuranceFiles] = useState<UploadedFile[]>([]);
  const [permitFiles, setPermitFiles] = useState<UploadedFile[]>([]);
  const [pucFiles, setPucFiles] = useState<UploadedFile[]>([]);
  const [fitnessFiles, setFitnessFiles] = useState<UploadedFile[]>([]);
  const [otherFiles, setOtherFiles] = useState<UploadedFile[]>([]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => onSave([
    ...rcFiles.map((f) => ({ category: "RC", fileName: f.fileName, dataUrl: f.dataUrl })),
    ...insuranceFiles.map((f) => ({ category: "Insurance", fileName: f.fileName, dataUrl: f.dataUrl })),
    ...permitFiles.map((f) => ({ category: "Permit", fileName: f.fileName, dataUrl: f.dataUrl })),
    ...pucFiles.map((f) => ({ category: "PUC", fileName: f.fileName, dataUrl: f.dataUrl })),
    ...fitnessFiles.map((f) => ({ category: "Fitness", fileName: f.fileName, dataUrl: f.dataUrl })),
    ...otherFiles.map((f) => ({ category: "Other", fileName: f.fileName, dataUrl: f.dataUrl })),
  ]);
  return <>
    <Field label="Vehicle Number" value={form.number || ""} onChange={(v) => set("number", v.toUpperCase())} />
    <Field label="Vehicle Type" value={form.type || ""} onChange={(v) => set("type", v)} />
    <Field label="Model" value={form.model || ""} onChange={(v) => set("model", v)} />
    <Field label="Capacity" value={form.capacity || ""} onChange={(v) => set("capacity", v)} />
    <Field label="Chassis Number" value={form.chassisNumber || ""} onChange={(v) => set("chassisNumber", v.toUpperCase())} />
    <Field label="Engine Number" value={form.engineNumber || ""} onChange={(v) => set("engineNumber", v.toUpperCase())} />
    <Field label="Owner Name" value={form.ownerName || ""} onChange={(v) => set("ownerName", v)} />
    <Field label="Owner Mobile" value={form.ownerPhone || ""} onChange={(v) => set("ownerPhone", v)} />
    <Field label="Registration Date" type="date" value={form.registrationDate || ""} onChange={(v) => set("registrationDate", v)} />
    <SelectField label="Vehicle Status" value={form.status || "Available"} onChange={(v) => set("status", v)} options={["Available", "On Trip", "Under Maintenance"].map((x) => ({ value: x, label: x }))} />
    {drivers && <SelectField label="Assign Driver" value={form.currentDriverId || ""} onChange={(v) => set("currentDriverId", v)} options={[{ value: "", label: "No driver assigned yet" }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]} />}
    <Field label="RC Expiry" type="date" value={form.rcExpiry || ""} onChange={(v) => set("rcExpiry", v)} />
    <FileField label="Upload RC" onFiles={setRcFiles} />
    <Field label="Insurance Expiry" type="date" value={form.insuranceExpiry || ""} onChange={(v) => set("insuranceExpiry", v)} />
    <FileField label="Upload Insurance" onFiles={setInsuranceFiles} />
    <Field label="Permit Expiry" type="date" value={form.permitExpiry || ""} onChange={(v) => set("permitExpiry", v)} />
    <FileField label="Upload Permit" onFiles={setPermitFiles} />
    <Field label="PUC Expiry" type="date" value={form.pucExpiry || ""} onChange={(v) => set("pucExpiry", v)} />
    <FileField label="Upload PUC" onFiles={setPucFiles} />
    <Field label="Fitness Expiry" type="date" value={form.fitnessExpiry || ""} onChange={(v) => set("fitnessExpiry", v)} />
    <FileField label="Upload Fitness Certificate" onFiles={setFitnessFiles} />
    <FileField label="Upload Other Documents" onFiles={setOtherFiles} />
    <Save onClick={save} />
  </>;
}
function DriverForm({ form, setForm, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; vehicles?: Vehicle[]; onSave: (docs: { category: DriverDocument["category"]; fileName: string; dataUrl?: string }[]) => void }) {
  const [licenseFiles, setLicenseFiles] = useState<UploadedFile[]>([]);
  const [aadhaarFiles, setAadhaarFiles] = useState<UploadedFile[]>([]);
  const [panFiles, setPanFiles] = useState<UploadedFile[]>([]);
  const [otherFiles, setOtherFiles] = useState<UploadedFile[]>([]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => onSave([
    ...licenseFiles.map((f) => ({ category: "License" as const, fileName: f.fileName, dataUrl: f.dataUrl })),
    ...aadhaarFiles.map((f) => ({ category: "Aadhaar" as const, fileName: f.fileName, dataUrl: f.dataUrl })),
    ...panFiles.map((f) => ({ category: "PAN" as const, fileName: f.fileName, dataUrl: f.dataUrl })),
    ...otherFiles.map((f) => ({ category: "Other" as const, fileName: f.fileName, dataUrl: f.dataUrl })),
  ]);
  return <>
    <Field label="Full Name" value={form.name || ""} onChange={(v) => set("name", v)} />
    <Field label="Mobile Number" value={form.phone || ""} onChange={(v) => set("phone", v)} />
    <Field label="Driving License Number" value={form.license || ""} onChange={(v) => set("license", v)} />
    <Field label="License Expiry" type="date" value={form.licenseExpiry || ""} onChange={(v) => set("licenseExpiry", v)} />
    <Field label="Aadhaar Card Number" value={form.aadhaar || ""} onChange={(v) => set("aadhaar", v)} />
    <Field label="PAN Card Number" value={form.pan || ""} onChange={(v) => set("pan", v)} />
    <Field label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
    <Field label="Monthly Salary" type="number" value={form.salary || ""} onChange={(v) => set("salary", v)} />
    <Field label="Emergency Contact" value={form.emergencyContact || ""} onChange={(v) => set("emergencyContact", v)} />
    <Field label="Joining Date" type="date" value={form.joiningDate || ""} onChange={(v) => set("joiningDate", v)} />
    <SelectField label="Driver Status" value={form.status || "Active"} onChange={(v) => set("status", v)} options={["Active", "On Trip", "Off Duty"].map((x) => ({ value: x, label: x }))} />
    {vehicles && <SelectField label="Assign Vehicle" value={form.assignedVehicleId || ""} onChange={(v) => set("assignedVehicleId", v)} options={[{ value: "", label: "No vehicle assigned yet" }, ...vehicles.map((v) => ({ value: v.id, label: `${v.number} - ${v.model}` }))]} />}
    <FileField label="Upload Driving License" onFiles={setLicenseFiles} />
    <FileField label="Upload Aadhaar Card" onFiles={setAadhaarFiles} />
    <FileField label="Upload PAN Card" onFiles={setPanFiles} />
    <FileField label="Upload Other Documents" onFiles={setOtherFiles} />
    <Save onClick={save} />
  </>;
}
function CustomerForm({ form, setForm, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: () => void }) {
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return <>
    <Field label="Party Name" value={form.company || ""} onChange={(v) => set("company", v)} />
    <Field label="Contact Person" value={form.contact || ""} onChange={(v) => set("contact", v)} />
    <Field label="Mobile Number" value={form.phone || ""} onChange={(v) => set("phone", v)} />
    <Field label="Email" type="email" value={form.email || ""} onChange={(v) => set("email", v)} />
    <Field label="GST Number" value={form.gst || ""} onChange={(v) => set("gst", v.toUpperCase())} />
    <Field label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
    <Field label="Credit Limit" type="number" value={form.creditLimit || ""} onChange={(v) => set("creditLimit", v)} />
    <Save onClick={onSave} />
  </>;
}
function TripForm({ form, setForm, customers, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; customers: Customer[]; vehicles: Vehicle[]; onSave: (files: UploadedFile[]) => void }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [showCharges, setShowCharges] = useState(false);
  const [showTripExpenses, setShowTripExpenses] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const availableVehicles = vehicles.filter((v) => v.status === "Available" || v.id === form.vehicleId);
  const freight = Number(form.freight || 0);
  const advances: AdvanceEntry[] = useMemo(() => { try { return JSON.parse(form.advancesJson || "[]"); } catch { return []; } }, [form.advancesJson]);
  const setAdvances = (next: AdvanceEntry[]) => set("advancesJson", JSON.stringify(next));
  const addAdvance = () => setAdvances([...advances, { date: form.date || today, mode: "Cash", amount: 0 }]);
  const updateAdvance = (index: number, patch: Partial<AdvanceEntry>) => setAdvances(advances.map((entry, current) => current === index ? { ...entry, ...patch } : entry));
  const removeAdvance = (index: number) => setAdvances(advances.filter((_, current) => current !== index));
  const totalAdvance = advances.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const bookingBalance = Math.max(freight - totalAdvance, 0);
  const totalExpenses = Number(form.otherCharges || 0);
  return <>
    <FormSection title="Booking Register" />
    <Field label="Date" type="date" value={form.date || today} onChange={(v) => set("date", v)} />
    <Field label="LR Number" value={form.lrNumber || ""} onChange={(v) => set("lrNumber", v)} />
    <VehicleSearchField value={form.vehicleId || form.manualVehicleNumber || ""} onChange={(v) => { set("vehicleId", v); if (v) set("manualVehicleNumber", ""); }} onManualChange={(v) => { set("manualVehicleNumber", v); set("vehicleId", ""); }} vehicles={availableVehicles} valueKind="id" />
    <SelectField label="Party Name" value={form.customerId || ""} onChange={(v) => set("customerId", v)} options={[{ value: "", label: "Select party" }, ...customers.map((c) => ({ value: c.id, label: c.company }))]} />
    <Field label="Size" value={form.size || ""} onChange={(v) => set("size", v)} />
    <Field label="From" value={form.pickup || ""} onChange={(v) => set("pickup", v)} />
    <Field label="To" value={form.drop || ""} onChange={(v) => set("drop", v)} />
    <Field label="Freight" type="number" value={form.freight || ""} onChange={(v) => set("freight", v)} />
    <FormSection title="Advance Details" />
    <div className="space-y-2 mb-3">{advances.map((entry, index) => <div key={index} className="flex items-center gap-2 rounded-2xl p-2" style={glassSubtle}>
      <input type="date" value={entry.date} onChange={(event) => updateAdvance(index, { date: event.target.value })} className="rounded-xl px-2 py-2 text-xs outline-none flex-1 min-w-0" style={{ background: "rgba(255,255,255,0.6)" }} />
      <input type="text" value={entry.mode} onChange={(event) => updateAdvance(index, { mode: event.target.value })} placeholder="Cash, Diesel Card, Bank" className="rounded-xl px-2 py-2 text-xs outline-none flex-[1.4] min-w-0" style={{ background: "rgba(255,255,255,0.6)" }} />
      <input type="text" inputMode="decimal" value={entry.amount || ""} onChange={(event) => { const value = event.target.value; if (/^\d*\.?\d*$/.test(value)) updateAdvance(index, { amount: Number(value) || 0 }); }} placeholder="Amount" className="rounded-xl px-2 py-2 text-xs outline-none w-24" style={{ background: "rgba(255,255,255,0.6)" }} />
      <button type="button" onClick={() => removeAdvance(index)} className="w-8 h-8 rounded-xl flex items-center justify-center text-red-600 bg-white/70 flex-shrink-0"><X size={13} /></button>
    </div>)}</div>
    <button type="button" onClick={addAdvance} className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold" style={glassSubtle}><Plus size={13} />Add Advance Entry</button>
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Total Advance: {rupees(totalAdvance)}</div>
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Balance: {rupees(bookingBalance)}</div>
    <Field label="Received Date" type="date" value={form.receivedDate || ""} onChange={(v) => set("receivedDate", v)} />
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Bill number is assigned automatically in sequence when you save this booking.</div>
    <Field label="Ch. No." value={form.chNo || ""} onChange={(v) => set("chNo", v)} />
    <Field label="Remarks" value={form.remarks || ""} onChange={(v) => set("remarks", v)} />
    <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">Trip Expense & Remarks
      <div className="mt-1.5 flex gap-2"><button type="button" onClick={() => setShowTripExpenses((value) => !value)} className="px-4 py-3 rounded-2xl text-xs font-semibold" style={glassSubtle}>{showTripExpenses ? "Close breakdown" : "Add trip breakdown"}</button>{parseTripExpenseRemarks(form.tripExpenseRemarksJson).length > 0 && <span className="self-center text-xs text-[#6B7280]">{parseTripExpenseRemarks(form.tripExpenseRemarksJson).length} saved item(s)</span>}</div>
    </label>
    {showTripExpenses && <TripExpenseRemarkBreakdown initialRows={parseTripExpenseRemarks(form.tripExpenseRemarksJson)} onApply={(rows) => set("tripExpenseRemarksJson", JSON.stringify(rows))} onClose={() => setShowTripExpenses(false)} />}

    <FormSection title="Charges & Billing" />
    <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">Other Charges
      <div className="mt-1.5 flex gap-2">
        <input type="text" inputMode="decimal" value={form.otherCharges || ""} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) set("otherCharges", v); }} placeholder="Enter amount" className="flex-1 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1d2e]/10" />
        <button type="button" onClick={() => setShowCharges(true)} className="px-4 py-3 rounded-2xl text-xs font-semibold whitespace-nowrap" style={glassSubtle}>Breakdown</button>
      </div>
    </label>
    {showCharges && <OtherChargesModal initialAmount={form.otherCharges || ""} initialReason={form.otherChargesReason || ""} onApply={(amount, reason) => { set("otherCharges", amount); set("otherChargesReason", reason); }} onClose={() => setShowCharges(false)} />}
    <Field label="Invoice Number" value={form.invoiceNumber || ""} onChange={(v) => set("invoiceNumber", v)} />
    <SelectField label="Payment Status" value={form.paymentStatus || "Pending"} onChange={(v) => set("paymentStatus", v)} options={["Paid", "Partial", "Pending", "Overdue"].map((x) => ({ value: x, label: x }))} />
    <Field label="E-way Bill" value={form.ewayBill || ""} onChange={(v) => set("ewayBill", v)} />
    <Field label="Delivery Receipt" value={form.deliveryReceipt || ""} onChange={(v) => set("deliveryReceipt", v)} />
    <FileField label="Upload e-way bill, POD, delivery receipt or invoice" category="pod" onFiles={setFiles} />
    <div className="rounded-2xl p-4 mb-4 text-sm font-bold" style={glassSubtle}>Total expenses: {rupees(totalExpenses)} - Profit/Loss: {rupees(freight - totalExpenses)}</div>
    <Save onClick={() => onSave(files)} />
  </>;
}

function CompanyExpenseForm({ form, setForm, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: () => void }) {
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <>
    <Field label="Expense Name" value={form.name || ""} onChange={(value) => set("name", value)} />
    <Field label="Amount" type="number" value={form.amount || ""} onChange={(value) => set("amount", value)} />
    <Field label="Expense Date" type="date" value={form.date || today} onChange={(value) => set("date", value)} />
    <Field label="Note" value={form.note || ""} onChange={(value) => set("note", value)} />
    <Save onClick={onSave} />
  </>;
}

function EmiReminderForm({ form, setForm, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: () => void }) {
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <>
    <Field label="EMI / Loan Name" value={form.name || ""} onChange={(value) => set("name", value)} />
    <Field label="Monthly EMI Amount" type="number" value={form.amount || ""} onChange={(value) => set("amount", value)} />
    <Field label="Monthly Reminder Day (1–31)" type="number" value={form.dueDay || ""} onChange={(value) => set("dueDay", value)} />
    <Field label="Tenure (months)" type="number" value={form.tenureMonths || ""} onChange={(value) => set("tenureMonths", value)} />
    <Field label="Starts From" type="date" value={form.startDate || today} onChange={(value) => set("startDate", value)} />
    <Field label="Note" value={form.note || ""} onChange={(value) => set("note", value)} />
    <div className="rounded-2xl p-4 text-sm font-bold border-2 border-amber-300 bg-amber-50 text-amber-900">A bold EMI alert will appear every month on the selected day until the tenure ends.</div>
    <Save onClick={onSave} />
  </>;
}

function ExpenseForm({ form, setForm, trips, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; trips: Trip[]; vehicles: Vehicle[]; onSave: () => void }) {
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isFuel = (form.category || "Other") === "Fuel";
  return <>
    <SelectField label="Category" value={form.category || "Other"} onChange={(v) => set("category", v)} options={["Fuel", "Toll", "Maintenance", "Salary", "Allowance", "Parking", "Other", "Custom"].map((x) => ({ value: x, label: x === "Custom" ? "Custom category…" : x }))} />
    {form.category === "Custom" && <Field label="Custom Category Name" value={form.customCategory || ""} onChange={(v) => set("customCategory", v)} />}
    <SelectField label="Trip" value={form.tripId || ""} onChange={(v) => set("tripId", v)} options={[{ value: "", label: "General expense" }, ...trips.map((t) => ({ value: t.id, label: `${t.id} · ${t.pickup} to ${t.drop}` }))]} />
    <SelectField label="Vehicle" value={form.vehicleId || ""} onChange={(v) => set("vehicleId", v)} options={[{ value: "", label: isFuel ? "Select vehicle" : "Not vehicle-specific" }, ...vehicles.map((v) => ({ value: v.id, label: `${v.number} · ${v.model}` }))]} />
    {isFuel && <Field label="Liters Filled" type="number" value={form.liters || ""} onChange={(v) => set("liters", v)} />}
    {isFuel && <Field label="Mileage (km/L)" type="number" value={form.mileage || ""} onChange={(v) => set("mileage", v)} />}
    <Field label="Amount" type="number" value={form.amount || ""} onChange={(v) => set("amount", v)} />
    <Field label="Date" type="date" value={form.date || today} onChange={(v) => set("date", v)} />
    <Field label="Note" value={form.note || ""} onChange={(v) => set("note", v)} />
    <Save onClick={onSave} />
  </>;
}

function ServiceForm({ form, setForm, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; vehicles: Vehicle[]; onSave: () => void }) { const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v })); return <><SelectField label="Vehicle" value={form.vehicleId || ""} onChange={(v) => set("vehicleId", v)} options={[{ value: "", label: "Select vehicle" }, ...vehicles.map((v) => ({ value: v.id, label: v.number }))]} /><Field label="Service Type" value={form.serviceType || ""} onChange={(v) => set("serviceType", v)} /><Field label="Service Cost" type="number" value={form.serviceCost || ""} onChange={(v) => set("serviceCost", v)} /><Field label="Workshop" value={form.workshop || ""} onChange={(v) => set("workshop", v)} /><Field label="Mechanic" value={form.mechanic || ""} onChange={(v) => set("mechanic", v)} /><Field label="Parts Used" value={form.partsUsed || ""} onChange={(v) => set("partsUsed", v)} /><Field label="Manual Service Interval (km)" type="number" value={form.serviceIntervalKm || ""} onChange={(v) => set("serviceIntervalKm", v)} /><Field label="Mileage Reminder (km)" type="number" value={form.mileageReminderKm || ""} onChange={(v) => set("mileageReminderKm", v)} /><Field label="Due Date" type="date" value={form.dueDate || today} onChange={(v) => set("dueDate", v)} /><SelectField label="Status" value={form.status || "Upcoming"} onChange={(v) => set("status", v)} options={["Upcoming", "Due", "Completed"].map((x) => ({ value: x, label: x }))} /><Save onClick={onSave} /></>; }

function PaymentForm({ form, setForm, invoices, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; invoices: Invoice[]; onSave: () => void }) { const invoice = invoices.find((i) => i.id === form.invoiceId); const outstanding = Math.max((invoice?.total ?? 0) - (invoice?.paidAmount ?? 0), 0); const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v })); const status = form.status || "Paid"; return <><SelectField label="Invoice" value={form.invoiceId || ""} onChange={(v) => set("invoiceId", v)} options={[{ value: "", label: "Select invoice" }, ...invoices.map((i) => ({ value: i.id, label: `${i.id} - ${rupees(Math.max((i.total ?? 0) - (i.paidAmount ?? 0), 0))} pending` }))]} /><SelectField label="Payment Status" value={status} onChange={(v) => setForm((f) => ({ ...f, status: v, amount: v === "Partial" ? f.amount || "" : "" }))} options={[{ value: "Paid", label: "Paid" }, { value: "Partial", label: "Partially Paid" }, { value: "Pending", label: "Pending" }]} />{status === "Partial" && <Field label="Paid Amount" type="number" value={form.amount || ""} onChange={(v) => set("amount", v)} />}<Field label="Method" value={form.method || "Bank Transfer"} onChange={(v) => set("method", v)} /><Field label="Reference" value={form.reference || ""} onChange={(v) => set("reference", v)} /><Field label="Payment Date" type="date" value={form.paidAt || today} onChange={(v) => set("paidAt", v)} /><div className="rounded-2xl p-4 mb-4 text-sm font-bold" style={glassSubtle}>Pending Balance: {rupees(outstanding)}</div><Save onClick={onSave} /></>; }
function BalanceFreightForm({ form, setForm, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; vehicles: Vehicle[]; onSave: () => void }) {
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [showCharges, setShowCharges] = useState(false);
  const freight = Number(form.freight || 0);
  const commissionPercent = Number(form.commissionPercent || 0);
  const commission = Math.round((freight * commissionPercent) / 100);
  const advances: AdvanceEntry[] = useMemo(() => { try { return JSON.parse(form.advancesJson || "[]"); } catch { return []; } }, [form.advancesJson]);
  const setAdvances = (next: AdvanceEntry[]) => set("advancesJson", JSON.stringify(next));
  const addAdvance = () => setAdvances([...advances, { date: form.loadingDate || today, mode: "Cash", amount: 0 }]);
  const updateAdvance = (index: number, patch: Partial<AdvanceEntry>) => setAdvances(advances.map((a, i) => i === index ? { ...a, ...patch } : a));
  const removeAdvance = (index: number) => setAdvances(advances.filter((_, i) => i !== index));
  const totalAdvance = advances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const deductions = commission + Number(form.hamali || 0) + Number(form.paymentChg || 0);
  const additions = Number(form.payCharge || 0) + Number(form.extraHeight || 0) + Number(form.extraWidthChg || 0) + Number(form.extraWeightChg || 0)
    + Number(form.weightRecipt || 0) + Number(form.unlodingChg || 0) + Number(form.challanFineChg || 0) + Number(form.otherCharges || 0);
  const extra = additions - deductions;
  const netBalance = freight - totalAdvance + extra;
  return <>
    <FormSection title="Lorry Hire Challan" />
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Challan number is assigned automatically in sequence when you save this record.</div>
    <Field label="Date" type="date" value={form.loadingDate || today} onChange={(v) => set("loadingDate", v)} />
    <VehicleSearchField value={form.vehicleNumber || ""} onChange={(v) => set("vehicleNumber", v)} vehicles={vehicles} valueKind="number" />
    <Field label="Owner Name" value={form.ownerName || ""} onChange={(v) => set("ownerName", v)} />
    <Field label="Party Name" value={form.partyName || ""} onChange={(v) => set("partyName", v)} />
    <Field label="From" value={form.from || ""} onChange={(v) => set("from", v)} />
    <Field label="To" value={form.to || ""} onChange={(v) => set("to", v)} />
    <Field label="CN No." value={form.cnNo || ""} onChange={(v) => set("cnNo", v)} />
    <Field label="Size" value={form.size || ""} onChange={(v) => set("size", v)} />
    <Field label="Weight" value={form.weight || ""} onChange={(v) => set("weight", v)} />
    <Field label="Freight" type="number" value={form.freight || ""} onChange={(v) => set("freight", v)} />

    <FormSection title="Advance Details" />
    <div className="space-y-2 mb-3">
      {advances.map((a, i) => <div key={i} className="flex items-center gap-2 rounded-2xl p-2" style={glassSubtle}>
        <input type="date" value={a.date} onChange={(e) => updateAdvance(i, { date: e.target.value })} className="rounded-xl px-2 py-2 text-xs outline-none flex-1 min-w-0" style={{ background: "rgba(255,255,255,0.6)" }} />
        <input type="text" value={a.mode} onChange={(e) => updateAdvance(i, { mode: e.target.value })} placeholder="Mode e.g. HDFC Bank, Diesel Card, Cash" className="rounded-xl px-2 py-2 text-xs outline-none flex-[1.4] min-w-0" style={{ background: "rgba(255,255,255,0.6)" }} />
        <input type="text" inputMode="decimal" value={a.amount || ""} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) updateAdvance(i, { amount: Number(v) || 0 }); }} placeholder="Amount" className="rounded-xl px-2 py-2 text-xs outline-none w-24" style={{ background: "rgba(255,255,255,0.6)" }} />
        <button type="button" onClick={() => removeAdvance(i)} className="w-8 h-8 rounded-xl flex items-center justify-center text-red-600 bg-white/70 flex-shrink-0"><X size={13} /></button>
      </div>)}
      {!advances.length && <p className="text-xs text-[#9CA3AF] px-1">No advance entries yet - add one below.</p>}
    </div>
    <button type="button" onClick={addAdvance} className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold" style={glassSubtle}><Plus size={13} />Add Advance Entry</button>
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Total Advance: {rupees(totalAdvance)}</div>
    <Field label="Balance Advance" type="number" value={form.advanceBalance || ""} onChange={(v) => set("advanceBalance", v)} />
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Balance Advance is shown separately on the challan and is not added to or deducted from Final Balance.</div>

    <FormSection title="Commission & Charges" />
    <Field label="Commission %" type="number" value={form.commissionPercent ?? ""} onChange={(v) => set("commissionPercent", v)} />
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Commission (-) ({commissionPercent}% of freight): {rupees(commission)}</div>
    <label className="block mb-4 text-sm font-semibold text-[#1a1d2e]">Other Charges
      <div className="mt-1.5 flex gap-2">
        <input type="text" inputMode="decimal" value={form.otherCharges || ""} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) set("otherCharges", v); }} placeholder="Enter amount" className="flex-1 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1d2e]/10" />
        <button type="button" onClick={() => setShowCharges(true)} className="px-4 py-3 rounded-2xl text-xs font-semibold whitespace-nowrap" style={glassSubtle}>Breakdown</button>
      </div>
    </label>
    {showCharges && <VehicleChargeBreakdownModal values={{
      payCharge: form.payCharge || "", weightRecipt: form.weightRecipt || "", hamali: form.hamali || "", unlodingChg: form.unlodingChg || "", extraWeightChg: form.extraWeightChg || "",
      extraHeight: form.extraHeight || "", extraWidthChg: form.extraWidthChg || "", paymentChg: form.paymentChg || "", challanFineChg: form.challanFineChg || "", otherCharges: form.otherCharges || "",
    }} onApply={(values) => {
      set("payCharge", values.payCharge); set("weightRecipt", values.weightRecipt); set("hamali", values.hamali); set("unlodingChg", values.unlodingChg); set("extraWeightChg", values.extraWeightChg);
      set("extraHeight", values.extraHeight); set("extraWidthChg", values.extraWidthChg); set("paymentChg", values.paymentChg); set("challanFineChg", values.challanFineChg); set("otherCharges", values.otherCharges);
    }} onClose={() => setShowCharges(false)} />}
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Extra: {rupees(extra)} (deductions {rupees(deductions)}, additions {rupees(additions)})</div>
    <div className="rounded-2xl p-4 mb-4 text-sm font-bold" style={glassSubtle}>Balance: {rupees(netBalance)}</div>
    <div className="rounded-2xl p-3 mb-4 text-xs font-semibold" style={glassSubtle}>Bill number is assigned automatically in sequence when you save this record.</div>
    <Field label="Remarks" value={form.remarks || ""} onChange={(v) => set("remarks", v)} />

    <FormSection title="Balance Payment" />
    <Field label="Balance Payment Date" type="date" value={form.balancePaymentDate || ""} onChange={(v) => set("balancePaymentDate", v)} />
    <SelectField label="Payment Status" value={form.status || "Pending"} onChange={(v) => { set("status", v); if (v === "Paid" && !form.paymentDate) set("paymentDate", today); }} options={[{ value: "Pending", label: "Pending" }, { value: "Partially Paid", label: "Partially Paid" }, { value: "Paid", label: "Payment Completed" }, { value: "Cancelled", label: "Cancelled" }]} />
    <Field label="Cash / Bank" value={form.paymentMode || "Bank Transfer"} onChange={(v) => set("paymentMode", v)} />
    <Field label="Chq No." value={form.chequeNeftNumber || ""} onChange={(v) => set("chequeNeftNumber", v)} />
    <Field label="Bank" value={form.bank || ""} onChange={(v) => set("bank", v)} />
    <Field label="Payment Date" type="date" value={form.paymentDate || ""} onChange={(v) => set("paymentDate", v)} />

    <FormSection title="Billing & Tracking (System)" />
    <Field label="Billing Date" type="date" value={form.billingDate || form.loadingDate || today} onChange={(v) => set("billingDate", v)} />
    <Save onClick={onSave} />
  </>;
}
function AttendanceNoteForm({ form, setForm, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: () => void }) { const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v })); return <><Field label="Date" type="date" value={form.date || today} onChange={(v) => set("date", v)} /><SelectField label="Status" value={form.status || "Present"} onChange={(v) => set("status", v)} options={["Present", "Absent"].map((x) => ({ value: x, label: x }))} /><Field label="Vehicle Number" value={form.vehicleLast4 || ""} onChange={(v) => set("vehicleLast4", v.replace(/\D/g, "").slice(-4))} /><Save onClick={onSave} /></>; }
function PayrollForm({ form, setForm, drivers, attendance, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; drivers: Driver[]; attendance: AttendanceRecord[]; onSave: () => void }) { const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v })); const driverRecords = attendance.filter((r) => r.driverId === form.driverId && r.month === (form.month || today.slice(0, 7))); const base = Number(form.baseSalary || 0); const present = Number(form.presentDays || driverRecords.filter((r) => r.status === "Present").length); const half = Number(form.halfDays || 0); const leave = Number(form.leave || driverRecords.filter((r) => r.status === "Absent").length); const net = Math.round((present + half * 0.5) * (base / 30) + Number(form.incentive || 0) + Number(form.bonus || 0) - Number(form.penalty || 0) - Number(form.advance || 0)); return <><SelectField label="Driver" value={form.driverId || ""} onChange={(v) => { const d = drivers.find((item) => item.id === v); setForm((f) => ({ ...f, driverId: v, baseSalary: String(d?.salary ?? 0) })); }} options={[{ value: "", label: "Select driver" }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]} /><Field label="Month" type="month" value={form.month || today.slice(0, 7)} onChange={(v) => set("month", v)} /><Field label="Base Salary" type="number" value={form.baseSalary || ""} onChange={(v) => set("baseSalary", v)} /><Field label="Present Days" type="number" value={form.presentDays || String(present)} onChange={(v) => set("presentDays", v)} /><Field label="Half Days" type="number" value={form.halfDays || String(half)} onChange={(v) => set("halfDays", v)} /><Field label="Leave" type="number" value={form.leave || String(leave)} onChange={(v) => set("leave", v)} /><Field label="Incentive" type="number" value={form.incentive || ""} onChange={(v) => set("incentive", v)} /><Field label="Bonus" type="number" value={form.bonus || ""} onChange={(v) => set("bonus", v)} /><Field label="Penalty" type="number" value={form.penalty || ""} onChange={(v) => set("penalty", v)} /><Field label="Advance" type="number" value={form.advance || ""} onChange={(v) => set("advance", v)} /><div className="rounded-2xl p-4 mb-4 text-sm font-bold" style={glassSubtle}>Net Salary: {rupees(net)}</div><Save onClick={onSave} /></>; }

function ReassignDriverForm({ form, setForm, drivers, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; drivers: Driver[]; vehicles: Vehicle[]; onSave: () => void }) {
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const v = vehicles.find((x) => x.id === form.vehicleId);
  const currentDriver = drivers.find((d) => d.id === v?.currentDriverId);
  return <>
    <div className="rounded-2xl p-4 mb-4 text-sm" style={glassSubtle}>Vehicle <b>{v?.number ?? "-"}</b> is currently assigned to <b>{currentDriver?.name ?? "no driver"}</b>. Vehicle-driver pairs usually stay the same, but you can change it below when needed.</div>
    <SelectField label="Assign New Driver" value={form.driverId || ""} onChange={(x) => set("driverId", x)} options={[{ value: "", label: "Select driver" }, ...drivers.map((d) => ({ value: d.id, label: `${d.name}${d.assignedVehicleId && d.assignedVehicleId !== form.vehicleId ? ` (currently on ${vehicles.find((vv) => vv.id === d.assignedVehicleId)?.number ?? "another vehicle"})` : ""}` }))]} />
    <Field label="Reason for change" value={form.reason || ""} onChange={(x) => set("reason", x)} />
    <Save onClick={onSave} />
  </>;
}
function ReassignVehicleForm({ form, setForm, drivers, vehicles, onSave }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; drivers: Driver[]; vehicles: Vehicle[]; onSave: () => void }) {
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const d = drivers.find((x) => x.id === form.driverId);
  const currentVehicle = vehicles.find((v) => v.id === d?.assignedVehicleId);
  return <>
    <div className="rounded-2xl p-4 mb-4 text-sm" style={glassSubtle}>Driver <b>{d?.name ?? "-"}</b> is currently assigned to <b>{currentVehicle?.number ?? "no vehicle"}</b>. Vehicle-driver pairs usually stay the same, but you can change it below when needed.</div>
    <SelectField label="Assign New Vehicle" value={form.vehicleId || ""} onChange={(x) => set("vehicleId", x)} options={[{ value: "", label: "Select vehicle" }, ...vehicles.map((v) => ({ value: v.id, label: `${v.number} - ${v.model}${v.currentDriverId && v.currentDriverId !== form.driverId ? ` (currently driven by ${drivers.find((dd) => dd.id === v.currentDriverId)?.name ?? "another driver"})` : ""}` }))]} />
    <Field label="Reason for change" value={form.reason || ""} onChange={(x) => set("reason", x)} />
    <Save onClick={onSave} />
  </>;
}
function PaymentDetails({ payment, driverName }: { payment: DriverPayment; driverName?: string }) {
  return <div className="space-y-4">
    <div className="rounded-2xl p-5" style={glassSubtle}>
      <div className="flex justify-between gap-3"><div><p className="text-xl font-extrabold">{payment.id}</p><p className="text-xs text-[#9CA3AF]">{driverName ?? "Driver"} - {payment.month}</p></div><DocumentBadge status={payment.status === "Paid" ? "Valid" : payment.status === "Overdue" ? "Expired" : "Due 15"} /></div>
      <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Amount</p><p className="font-semibold mt-1">{rupees(payment.amount)}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Status</p><p className="font-semibold mt-1">{payment.status}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Method</p><p className="font-semibold mt-1">{payment.method}</p></div>
        <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Paid On</p><p className="font-semibold mt-1">{payment.paidAt}</p></div>
        <div className="rounded-xl p-3 bg-white/45 col-span-2"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Notes</p><p className="font-semibold mt-1">{payment.notes || "-"}</p></div>
      </div>
    </div>
  </div>;
}
function EarningsDetails({ driver }: { driver: Driver }) {
  const payments = driver.paymentHistory ?? [];
  const paid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status !== "Paid").reduce((s, p) => s + p.amount, 0);
  return <div className="space-y-4">
    <div className="rounded-2xl p-5" style={glassSubtle}>
      <p className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Total Earnings</p>
      <p className="text-3xl font-extrabold mt-1">{rupees(driver.earnings ?? 0)}</p>
      <p className="text-xs text-[#9CA3AF] mt-1">{driver.name} - {driver.status}</p>
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Monthly Salary</p><p className="font-semibold mt-1">{rupees(driver.salary)}</p></div>
      <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Payments Made</p><p className="font-semibold mt-1">{String(payments.length)}</p></div>
      <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Total Paid</p><p className="font-semibold mt-1 text-emerald-700">{rupees(paid)}</p></div>
      <div className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Pending / Partial</p><p className="font-semibold mt-1 text-amber-600">{rupees(pending)}</p></div>
    </div>
    <DataCard>{payments.length ? payments.map((p) => <Row key={p.id}><CreditCard size={16} /><div className="flex-1"><p className="text-sm font-semibold">{p.id}</p><p className="text-xs text-[#9CA3AF]">{p.month} - {p.method}</p></div><p className="text-sm font-bold">{rupees(p.amount)}</p><DocumentBadge status={p.status === "Paid" ? "Valid" : p.status === "Overdue" ? "Expired" : "Due 15"} /></Row>) : <EmptyState label="No payment history yet" />}</DataCard>
  </div>;
}
function DataCard({ children }: { children: React.ReactNode }) { return <div className="rounded-[22px] border border-[#E7EEF7] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.07)] bg-white">{children}</div>; }
function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`flex flex-wrap items-center gap-4 px-5 py-4 border-b border-[#EEF3F8] last:border-b-0 hover:bg-[#F8FBFF] transition-all ${className}`}>{children}</div>; }
function Avatar({ text }: { text: string }) { return <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600">{text}</div>; }
function Badge({ label }: { label: string }) { return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/60 ring-1 ring-white/70"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{label}</span>; }
function DocumentBadge({ status }: { status: DocumentRecord["status"] }) {
  const color = status === "Valid" ? "#16A34A" : status === "Expired" ? "#DC2626" : status === "Due 7" || status === "Due 15" ? "#EA580C" : "#CA8A04";
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/70 ring-1 ring-white/70"><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{status}</span>;
}
function Metric({ title, value, onClick }: { title: string; value: string; onClick?: () => void }) {
  const size = value.length > 12 ? "text-base" : value.length > 9 ? "text-lg" : value.length > 6 ? "text-xl" : "text-2xl";
  const Tag = onClick ? "button" : "div";
  return <Tag onClick={onClick} className={`rounded-[20px] p-5 bg-white border border-[#E7EEF7] shadow-[0_12px_30px_rgba(15,23,42,0.07)] min-w-0 overflow-hidden text-left w-full ${onClick ? "hover:border-[#C7D6EA] cursor-pointer transition-colors" : ""}`}><p className="text-xs text-[#9CA3AF] uppercase tracking-wider font-bold truncate">{title}</p><p className={`${size} font-extrabold mt-2 text-[#111827] truncate`} title={value}>{value}</p>{onClick && <p className="text-[10px] text-[#9CA3AF] mt-1">Tap to view full details</p>}</Tag>;
}
function Save({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="w-full mt-2 rounded-2xl bg-[#1a1d2e] px-5 py-3 text-sm font-semibold text-white">Save</button>; }
type ChargeRow = { id: string; name: string; amount: string; custom?: boolean };
const DEFAULT_CHARGE_NAMES = ["Detention", "Weight Receipt", "Loading Charge", "Unloading Charge", "Warai Charge", "Extra Weight", "Extra Size", "Challan Fine", "St Charge"];
function OtherChargesModal({ initialAmount, initialReason, onApply, onClose }: { initialAmount: string; initialReason: string; onApply: (amount: string, reason: string) => void; onClose: () => void }) {
  const [rows, setRows] = useState<ChargeRow[]>(() => {
    const base: ChargeRow[] = DEFAULT_CHARGE_NAMES.map((n) => ({ id: uid("chg"), name: n, amount: "" }));
    if (Number(initialAmount || 0) > 0) base.push({ id: uid("chg"), name: initialReason || "Other", amount: initialAmount, custom: true });
    return base;
  });
  const addCustomRow = () => setRows((r) => [...r, { id: uid("chg"), name: "", amount: "", custom: true }]);
  const updateRow = (id: string, patch: Partial<ChargeRow>) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id));
  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const apply = () => {
    const reasonParts = rows.filter((r) => Number(r.amount || 0) > 0 && r.name.trim()).map((r) => `${r.name}: ${rupees(Number(r.amount || 0))}`);
    onApply(String(total), reasonParts.join("; "));
    onClose();
  };
  return (
    <div className="relative z-20 w-full rounded-3xl p-4 mb-4 border border-white/60 shadow-xl" style={{ ...glass, background: "var(--card)" }}>
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        <p className="text-lg font-bold mb-1">Other Charges Breakdown</p>
        <p className="text-xs text-[#9CA3AF] mb-4">Type an amount against any charge. Leave it blank or 0 to skip. All amounts entered add up into a single Other Charges total automatically.</p>
        <div className="rounded-2xl overflow-hidden mb-4" style={glassSubtle}>
          <div className="grid grid-cols-[1fr_110px_28px] gap-2 px-3 py-2 text-xs font-bold text-[#9CA3AF] border-b border-white/60"><span>Name</span><span>Amount</span><span /></div>
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_110px_28px] gap-2 px-3 py-1.5 items-center rounded-lg">
              {row.custom ? (
                <input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Charge name" className="rounded-xl border border-white/60 bg-white/70 px-2 py-1.5 text-xs outline-none" />
              ) : (
                <span className="text-xs px-2 py-1.5 font-semibold">{row.name}</span>
              )}
              <input type="number" value={row.amount} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateRow(row.id, { amount: e.target.value })} placeholder="0" className="rounded-xl border border-white/60 bg-white/70 px-2 py-1.5 text-xs outline-none" />
              {row.custom ? <button onClick={() => removeRow(row.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-red-600"><X size={12} /></button> : <span />}
            </div>
          ))}
        </div>
        <button onClick={addCustomRow} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold mb-4" style={glassSubtle}><Plus size={13} />Add custom charge (manual)</button>
        <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-5 text-sm font-bold" style={glassSubtle}><span>Total Other Charges</span><span>{rupees(total)}</span></div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Close</button>
          <button onClick={apply} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]">OK</button>
        </div>
      </div>
    </div>
  );
}
type VehicleChargeKey = "extraHeight" | "paymentChg" | "challanFineChg" | "otherCharges" | "extraWidthChg" | "payCharge" | "weightRecipt" | "hamali" | "unlodingChg" | "extraWeightChg";
type VehicleChargeValues = Record<VehicleChargeKey, string>;
const VEHICLE_CHARGE_ROWS: { key: VehicleChargeKey; label: string; deduction?: boolean }[] = [
  { key: "extraHeight", label: "Extra Height" },
  { key: "paymentChg", label: "Payment Charges", deduction: true },
  { key: "challanFineChg", label: "Challan Fine Charges" },
  { key: "otherCharges", label: "Other Charges" },
  { key: "extraWidthChg", label: "Extra Width" },
  { key: "payCharge", label: "Detention" },
  { key: "weightRecipt", label: "Weight Receipt" },
  { key: "hamali", label: "Hamali", deduction: true },
  { key: "unlodingChg", label: "Unloading Charges" },
  { key: "extraWeightChg", label: "Extra Weight" },
];
function VehicleChargeBreakdownModal({ values, onApply, onClose }: { values: VehicleChargeValues; onApply: (values: VehicleChargeValues) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<VehicleChargeValues>(values);
  const update = (key: VehicleChargeKey, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const deductions = VEHICLE_CHARGE_ROWS.filter((row) => row.deduction).reduce((total, row) => total + Number(draft[row.key] || 0), 0);
  const additions = VEHICLE_CHARGE_ROWS.filter((row) => !row.deduction).reduce((total, row) => total + Number(draft[row.key] || 0), 0);
  return <div className="relative z-20 w-full rounded-3xl p-4 mb-4 border border-white/60 shadow-xl" style={{ ...glass, background: "var(--card)" }}>
    <p className="text-lg font-bold mb-1">Challan Charge Breakdown</p>
    <p className="text-xs text-[#9CA3AF] mb-4">Every amount is saved in its own challan field and will reappear in Edit and on the matching printed challan line.</p>
    <div className="max-h-[55vh] overflow-y-auto pr-1 rounded-2xl" style={glassSubtle}>
      <div className="grid grid-cols-[1fr_120px] gap-2 px-3 py-2 text-xs font-bold text-[#9CA3AF] border-b border-white/60"><span>Charge</span><span>Amount</span></div>
      {VEHICLE_CHARGE_ROWS.map((row) => <label key={row.key} className="grid grid-cols-[1fr_120px] gap-2 px-3 py-2 items-center border-b border-white/40 last:border-0">
        <span className="text-xs font-semibold">{row.label}{row.deduction ? " (-)" : ""}</span>
        <input type="number" min="0" value={draft[row.key]} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => update(row.key, event.target.value)} placeholder="0" className="rounded-xl border border-white/60 bg-white/70 px-2 py-2 text-xs outline-none" />
      </label>)}
    </div>
    <div className="flex items-center justify-between rounded-2xl px-4 py-3 mt-4 text-sm font-bold" style={glassSubtle}><span>Extra</span><span>{rupees(additions - deductions)}</span></div>
    <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Close</button><button type="button" onClick={() => { onApply(draft); onClose(); }} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]">Save breakdown</button></div>
  </div>;
}
type TripExpenseRow = { id: string; category: string; amount: string; remark: string; custom?: boolean };
const DEFAULT_TRIP_EXPENSES = ["Toll / FASTag", "Fuel", "Fooding", "AdBlue"];
function TripExpenseRemarkBreakdown({ initialRows, onApply, onClose }: { initialRows: TripExpenseRemark[]; onApply: (rows: TripExpenseRemark[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<TripExpenseRow[]>(() => {
    const existing = initialRows.map((row) => ({ id: uid("trip-expense"), category: row.category, amount: String(row.amount || ""), remark: row.remark || "", custom: !DEFAULT_TRIP_EXPENSES.includes(row.category) }));
    return existing.length ? existing : DEFAULT_TRIP_EXPENSES.map((category) => ({ id: uid("trip-expense"), category, amount: "", remark: "" }));
  });
  const update = (id: string, patch: Partial<TripExpenseRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const add = () => setRows((current) => [...current, { id: uid("trip-expense"), category: "", amount: "", remark: "", custom: true }]);
  const remove = (id: string) => setRows((current) => current.filter((row) => row.id !== id));
  const savedRows = rows.map((row) => ({ category: row.category.trim(), amount: Number(row.amount || 0), remark: row.remark.trim() })).filter((row) => row.category && (row.amount > 0 || row.remark));
  return <div className="relative z-20 w-full rounded-3xl p-4 mb-4 border border-white/60 shadow-xl" style={{ ...glass, background: "var(--card)" }}>
    <p className="text-lg font-bold mb-1">Trip Expense & Remark Breakdown</p>
    <p className="text-xs text-[#9CA3AF] mb-4">These trip expenses are separate from Other Charges and are saved with this booking.</p>
    <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-2">
      {rows.map((row) => <div key={row.id} className="rounded-2xl p-3" style={glassSubtle}>
        <div className="grid grid-cols-[1fr_105px_28px] gap-2 items-center">
          {row.custom ? <input value={row.category} onChange={(e) => update(row.id, { category: e.target.value })} placeholder="Expense name" className="rounded-xl border border-white/60 bg-white/70 px-2 py-2 text-xs outline-none" /> : <span className="text-xs font-semibold px-2">{row.category}</span>}
          <input type="number" value={row.amount} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => update(row.id, { amount: e.target.value })} placeholder="Amount" className="rounded-xl border border-white/60 bg-white/70 px-2 py-2 text-xs outline-none" />
          {row.custom ? <button type="button" onClick={() => remove(row.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-600"><X size={12} /></button> : <span />}
        </div>
        <input value={row.remark} onChange={(e) => update(row.id, { remark: e.target.value })} placeholder="Trip remark (optional)" className="mt-2 w-full rounded-xl border border-white/60 bg-white/70 px-2 py-2 text-xs outline-none" />
      </div>)}
    </div>
    <button type="button" onClick={add} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold mt-3" style={glassSubtle}><Plus size={13} />Add expense</button>
    <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={glassSubtle}>Close</button><button type="button" onClick={() => { onApply(savedRows); onClose(); }} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#12151C]">Save trip breakdown</button></div>
  </div>;
}
function EmptyState({ label }: { label: string }) { return <div className="rounded-xl p-4 text-center text-xs text-[#9CA3AF] bg-white/35">{label}</div>; }
function VehicleDetails({ vehicle, onView, onReassignDriver, drivers }: { vehicle: Vehicle; onView?: (doc: ViewableDoc) => void; onReassignDriver?: () => void; drivers?: Driver[] }) {
  const t = telemetryOf(vehicle);
  const docRows = [["RC Expiry", vehicle.rcExpiry], ["Insurance", vehicle.insuranceExpiry], ["Permit", vehicle.permitExpiry], ["Fitness", vehicle.fitnessExpiry || "-"], ["PUC", vehicle.pucExpiry]];
  const docCategories = ["RC", "Insurance", "Permit", "PUC", "Fitness", "Other"];
  const currentDriverName = drivers?.find((d) => d.id === vehicle.currentDriverId)?.name || vehicle.driverHistory?.at(-1)?.driverName || "-";
  return <div className="space-y-4">
    <div className="rounded-2xl p-5" style={glassSubtle}><div className="flex justify-between gap-3"><div><p className="text-xl font-extrabold">{vehicle.number}</p><p className="text-xs text-[#9CA3AF]">{vehicle.model} - {vehicle.capacity}</p></div><Badge label={vehicle.status} /></div><div className="grid grid-cols-3 gap-3 mt-5"><div className="rounded-xl p-3 text-center bg-white/45"><Gauge size={16} className="mx-auto" /><p className="text-lg font-extrabold mt-1">{t.speed}</p><p className="text-[10px] text-[#9CA3AF]">km/h</p></div><div className="rounded-xl p-3 text-center bg-white/45"><Fuel size={16} className="mx-auto" /><p className="text-lg font-extrabold mt-1">{t.fuelLevel}%</p><p className="text-[10px] text-[#9CA3AF]">fuel</p></div><div className="rounded-xl p-3 text-center bg-white/45"><Wifi size={16} className="mx-auto" /><p className="text-lg font-extrabold mt-1">{t.gpsSignal}/5</p><p className="text-[10px] text-[#9CA3AF]">GPS</p></div></div></div>
    <div className="grid md:grid-cols-2 gap-3 text-sm">
      {[["Vehicle Type", vehicle.type || "-"], ["Chassis Number", vehicle.chassisNumber || "-"], ["Engine Number", vehicle.engineNumber || "-"], ["Owner Details", `${vehicle.ownerName || "-"} ${vehicle.ownerPhone || ""}`], ["Registration Date", vehicle.registrationDate || "-"]].map(([label, value]) => <div key={label} className="rounded-xl p-3 bg-white/45"><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">{label}</p><p className="font-semibold mt-1">{value}</p></div>)}
      <div className="rounded-xl p-3 bg-white/45 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Current Driver</p><p className="font-semibold mt-1">{currentDriverName}</p></div>{onReassignDriver && <button onClick={onReassignDriver} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold" style={glassSubtle}>Change</button>}</div>
    </div>
    <div className="rounded-2xl p-5" style={glassSubtle}><h4 className="font-bold mb-3">Live Location</h4><div className="h-44 rounded-2xl relative overflow-hidden bg-white/50 border border-white/60"><div className="absolute inset-0 opacity-35" style={{ backgroundImage: "linear-gradient(#94A3B833 1px, transparent 1px), linear-gradient(90deg,#94A3B833 1px, transparent 1px)", backgroundSize: "34px 34px" }} /><div className="absolute left-[44%] top-[42%] w-12 h-12 rounded-2xl bg-[#12151C] text-white flex items-center justify-center shadow-xl"><Truck size={19} /></div><div className="absolute left-4 bottom-4 right-4 rounded-xl p-3 text-xs bg-white/80"><MapPin size={13} className="inline mr-1" />{t.location}</div></div><div className="grid grid-cols-2 gap-2 mt-3 text-xs"><p className="rounded-xl p-3 bg-white/45">Latitude <b className="block">{t.latitude}</b></p><p className="rounded-xl p-3 bg-white/45">Longitude <b className="block">{t.longitude}</b></p></div></div>
    <div className="grid grid-cols-2 gap-3"><Metric title="Battery" value={`${t.batteryVoltage}V`} /><Metric title="Distance Today" value={`${t.distanceTodayKm} km`} /><Metric title="Odometer" value={`${t.odometerKm.toLocaleString()} km`} /><Metric title="ETA" value={t.eta} /></div>
    <div className="rounded-2xl p-5" style={glassSubtle}><h4 className="font-bold mb-3">Fuel & Health</h4>{[["Fuel Level", t.fuelLevel], ["Oil Health", t.oilHealth]].map(([label, value]) => <div key={label} className="mb-3"><div className="flex justify-between text-xs font-semibold"><span>{label}</span><span>{value}%</span></div><div className="h-2 rounded-full bg-white/70 mt-1 overflow-hidden"><div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${value}%` }} /></div></div>)}<p className="text-xs text-[#6B7280]">Engine: <b>{t.engineHealth}</b> - Tyres: <b>{t.tyrePressure}</b> - Harsh events: <b>{t.harshEvents}</b></p></div>
    <DataCard>{docRows.map(([label, date]) => <Row key={label}><FileText size={16} /><div className="flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#9CA3AF]">{date}</p></div><DocumentBadge status={daysUntil(date) <= 7 ? "Due 7" : daysUntil(date) <= 15 ? "Due 15" : "Valid"} /></Row>)}</DataCard>
    <DataCard>
      {docCategories.map((category) => {
        const docs = vehicle.documents.filter((doc) => doc.category === category);
        const label = `${category} Document`;
        if (!docs.length) return <Row key={category}><FileText size={16} /><div className="flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#9CA3AF]">No document uploaded</p></div></Row>;
        return <div key={category}>{docs.map((doc) => <DocRow key={doc.id} icon={<FileText size={16} />} title={label} subtitle={doc.fileName} doc={{ fileName: doc.fileName, dataUrl: doc.dataUrl, title: `${vehicle.number} - ${label}` }} onView={onView} />)}</div>;
      })}
    </DataCard>
    <DataCard>{(vehicle.driverHistory ?? []).map((h) => <Row key={`${h.driverId}-${h.assignedAt}`}><UserCheck size={16} /><div className="flex-1"><p className="text-sm font-semibold">{h.driverName}</p><p className="text-xs text-[#9CA3AF]">Assigned {h.assignedAt}{h.endedAt ? ` to ${h.endedAt}` : " - Current"} - {h.reason || "No reason noted"}</p></div></Row>)}{!(vehicle.driverHistory ?? []).length && <EmptyState label="No driver history" />}</DataCard>
    <DataCard>{[...(vehicle.billingHistory ?? []), ...(vehicle.documentHistory ?? [])].map((item) => <Row key={item}><ClipboardList size={16} /><span className="text-sm font-semibold">{item}</span></Row>)}{!(vehicle.billingHistory ?? []).length && !(vehicle.documentHistory ?? []).length && <EmptyState label="No billing or document history" />}</DataCard>
  </div>;
}
function Details({ entity, onView }: { entity: unknown; onView?: (doc: ViewableDoc) => void }) {
  if (entity && typeof entity === "object" && "number" in entity && "model" in entity) return <VehicleDetails vehicle={entity as Vehicle} onView={onView} />;
  const rows = entity && typeof entity === "object" ? Object.entries(entity as Record<string, unknown>) : [];
  return <div className="space-y-2">{rows.map(([key, value]) => <div key={key} className="flex justify-between gap-4 rounded-xl p-3 text-sm" style={glassSubtle}><span className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</span><span className="text-right text-[#6B7280]">{Array.isArray(value) ? value.join(", ") || "-" : String(value ?? "-")}</span></div>)}</div>;
}
function GlobalSearch({ onClose, vehicles, drivers, customers, trips, invoices, expenses, documents, setView }: { onClose: () => void; vehicles: Vehicle[]; drivers: Driver[]; customers: Customer[]; trips: Trip[]; invoices: Invoice[]; expenses: Expense[]; documents: DocumentRecord[]; setView: (v: View) => void }) {
  const [q, setQ] = useState("");
  const rows = [
    ...vehicles.map((v) => ({ view: "vehicles" as View, type: "Vehicle", title: v.number, meta: v.model })),
    ...drivers.map((d) => ({ view: "drivers" as View, type: "Driver", title: d.name, meta: `${d.phone} · ${d.license}` })),
    ...customers.map((c) => ({ view: "customers" as View, type: "Party", title: c.company, meta: `${c.phone} · ${c.gst}` })),
    ...trips.map((t) => ({ view: "trips" as View, type: "Trip", title: t.id, meta: `${t.pickup} to ${t.drop} · ${t.cargo}` })),
    ...invoices.map((i) => ({ view: "invoices" as View, type: "Invoice", title: i.id, meta: `${i.status} · ${i.dueDate}` })),
    ...expenses.map((e) => ({ view: "expenses" as View, type: "Expense", title: e.category, meta: `${e.note} · ${rupees(e.amount)}` })),
    ...documents.map((d) => ({ view: "documents" as View, type: "Document", title: d.documentNumber, meta: `${d.ownerName} · ${d.type}` })),
  ].filter((row) => `${row.type} ${row.title} ${row.meta}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return <div className="fixed inset-0 z-[70] bg-[#12151C]/25 backdrop-blur-sm flex items-start justify-center p-4 pt-24" onMouseDown={onClose}><div className="w-full max-w-2xl rounded-[24px] overflow-hidden" style={{ ...glass, background: "var(--card)" }} onMouseDown={(e) => e.stopPropagation()}><div className="flex items-center gap-3 p-4 border-b border-white/60"><Search size={18} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicle, driver, customer, trip, invoice, expense, document or phone..." className="flex-1 bg-transparent outline-none text-sm" /><span className="text-[10px] font-bold text-[#9CA3AF]">CTRL K</span></div><div className="max-h-[420px] overflow-y-auto p-2">{rows.length ? rows.map((row) => <button key={`${row.type}-${row.title}`} onClick={() => { setView(row.view); onClose(); }} className="w-full flex items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/60"><Badge label={row.type} /><div className="min-w-0"><p className="text-sm font-semibold truncate">{row.title}</p><p className="text-xs text-[#9CA3AF] truncate">{row.meta}</p></div></button>) : <EmptyState label="Start typing to search enterprise records" />}</div></div></div>;
}
function InvoicePreview({ invoice, trip, customer }: { invoice?: Invoice; trip?: Trip; customer?: Customer }) {
  if (!invoice || !trip) return <div className="rounded-2xl p-6" style={glass}>Select an invoice</div>;
  const subtotal = trip.freight;
  const gst = Math.round(subtotal * 0.18);
  return <div className="rounded-[22px] ring-1 ring-white/70 shadow-xl overflow-hidden" style={glass}><div className="p-6 border-b border-white/50 flex justify-between gap-4"><div><h3 className="text-lg font-bold">Sharma Roadlines Pvt. Ltd.</h3><p className="text-xs text-[#717182]">GSTIN: 27AABCS1429B1Z1</p></div><div className="text-right"><p className="text-2xl font-bold">TAX INVOICE</p><p className="text-xs">{invoice.id}</p><Badge label={invoice.status} /></div></div><div className="p-6 border-b border-white/50"><p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Bill To</p><p className="text-sm font-bold">{customer?.company}</p><p className="text-xs text-[#717182]">{customer?.gst}</p><p className="text-xs text-[#717182]">{customer?.address}</p></div><div className="p-6 text-sm space-y-2"><p className="flex justify-between"><span>Freight Charges - {trip.pickup} to {trip.drop}</span><b>{rupees(subtotal)}</b></p><p className="flex justify-between"><span>CGST 9%</span><b>{rupees(gst / 2)}</b></p><p className="flex justify-between"><span>SGST 9%</span><b>{rupees(gst / 2)}</b></p><p className="flex justify-between border-t border-black/10 pt-3 text-lg"><span>Grand Total</span><b>{rupees(subtotal + gst)}</b></p></div><div className="p-4 flex gap-2"><button onClick={() => window.print()} className="flex-1 rounded-2xl py-2 text-sm font-semibold" style={glassSubtle}><Printer size={14} className="inline mr-1" />Print</button><button className="flex-1 rounded-2xl py-2 text-sm font-semibold text-white bg-[#12151C]"><Send size={14} className="inline mr-1" />Send</button></div></div>;
}
