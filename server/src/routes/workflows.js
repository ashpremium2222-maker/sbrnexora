import express from "express";
import { Attendance, BalanceFreight, Customer, DocumentRecord, Expense, Invoice, Maintenance, Notification, Payment, Payroll, Trip, Vehicle, Driver } from "../models/index.js";
import { authorize } from "../middleware/auth.js";
import { upload, uploadToStorage } from "../middleware/upload.js";

const router = express.Router();

const DAY_MS = 86400000;
const documentStatus = (expiryDate) => {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return "Expired";
  if (days <= 7) return "Due 7";
  if (days <= 15) return "Due 15";
  if (days <= 30) return "Due 30";
  if (days <= 60) return "Due 60";
  if (days <= 90) return "Due 90";
  return "Valid";
};

function analyzeTripProfit(trip, expenses) {
  const byCategory = (name) => expenses.filter((expense) => String(expense.trip) === String(trip._id) && expense.category === name).reduce((sum, expense) => sum + expense.amount, 0);
  const fuelCost = byCategory("Fuel");
  const driverSalary = byCategory("Salary");
  const driverAllowance = byCategory("Allowance");
  const tollCharges = byCategory("Toll");
  const parking = byCategory("Parking");
  const maintenanceCost = byCategory("Maintenance");
  const miscExpenses = byCategory("Other");
  const totalCost = fuelCost + driverSalary + driverAllowance + tollCharges + parking + maintenanceCost + miscExpenses;
  const netProfit = trip.freight - totalCost;
  const distance = trip.distanceKm || 1;
  const profitPercent = trip.freight ? Math.round((netProfit / trip.freight) * 100) : 0;
  return {
    freightIncome: trip.freight,
    fuelCost,
    driverSalary,
    driverAllowance,
    tollCharges,
    parking,
    maintenanceCost,
    miscExpenses,
    totalCost,
    netProfit,
    profitPercent,
    profitPerKm: Math.round(netProfit / distance),
    costPerKm: Math.round(totalCost / distance),
    revenuePerKm: Math.round(trip.freight / distance),
    status: netProfit < 0 ? "Loss" : profitPercent >= 30 ? "Highly Profitable" : "Average",
  };
}

router.post("/uploads", upload.array("files", 8), async (req, res) => {
  const files = await Promise.all(req.files.map(uploadToStorage));
  res.status(201).json({
    files: files.map((file) => ({
      type: req.body.type || "document",
      fileName: file.fileName,
      url: file.url,
    })),
  });
});

router.patch("/trips/:id/pod", async (req, res) => {
  const trip = await Trip.findByIdAndUpdate(req.params.id, { $set: { podDocs: req.body.podDocs || [] } }, { new: true, runValidators: false });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json(trip);
});

router.post("/trips/:id/complete", authorize("admin", "manager"), async (req, res) => {
  const trip = await Trip.findByIdAndUpdate(req.params.id, { status: "Completed", podDocs: req.body.podDocs || [] }, { new: true });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  await Promise.all([
    Vehicle.findByIdAndUpdate(trip.vehicle, { status: "Available" }),
    Driver.findByIdAndUpdate(trip.driver, { status: "Active" }),
    Expense.create({ trip: trip._id, category: "Allowance", amount: req.body.driverAllowance || 0, note: "Completion allowance" }),
  ]);
  const gstAmount = Math.round(trip.freight * 0.18);
  const invoice = await Invoice.create({
    invoiceNo: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
    trip: trip._id,
    customer: trip.customer,
    subtotal: trip.freight,
    gstAmount,
    total: trip.freight + gstAmount,
    dueDate: req.body.dueDate,
  });
  await Notification.create({ type: "trip", title: "Trip completed", message: `${trip._id} completed and invoice generated.` });
  res.json({ trip, invoice });
});

router.post("/invoices/:id/pay", authorize("admin", "manager"), async (req, res) => {
  const current = await Invoice.findById(req.params.id);
  if (!current) return res.status(404).json({ error: "Invoice not found" });
  const amount = Number(req.body.amount || current.total);
  const paidAmount = (current.paidAmount || 0) + amount;
  const outstandingAmount = Math.max((current.total || 0) - paidAmount, 0);
  const status = outstandingAmount === 0 ? "Paid" : "Partial";
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status, paidAmount, outstandingAmount, paidAt: status === "Paid" ? new Date() : current.paidAt }, { new: true });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  const payment = await Payment.create({
    invoice: invoice._id,
    customer: invoice.customer,
    amount,
    method: req.body.method || "Bank Transfer",
    reference: req.body.reference,
    receiptNo: req.body.receiptNo || `RCPT-${Date.now().toString().slice(-6)}`,
  });
  await Notification.create({ type: "payment", title: "Payment received", message: `${invoice.invoiceNo} marked paid.` });
  res.json({ invoice, payment });
});

router.get("/dashboard", async (req, res) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const [vehicles, drivers, trips, activeTrips, completedTrips, pendingTrips, expenses, invoices, documents, maintenance, balanceFreights, todayAttendance, monthlyPayroll] = await Promise.all([
    Vehicle.find(),
    Driver.find(),
    Trip.find(),
    Trip.countDocuments({ status: { $in: ["Assigned", "In Transit"] } }),
    Trip.countDocuments({ status: "Completed" }),
    Trip.countDocuments({ status: { $in: ["Draft", "Assigned"] } }),
    Expense.find(),
    Invoice.find(),
    DocumentRecord.find().sort({ expiryDate: 1 }).limit(12),
    Maintenance.find({ status: { $ne: "Completed" } }).populate("vehicle").sort({ dueDate: 1 }).limit(8),
    BalanceFreight.find(),
    Attendance.find({ date: { $gte: new Date(`${todayKey}T00:00:00.000Z`), $lte: new Date(`${todayKey}T23:59:59.999Z`) } }),
    Payroll.find({ month: monthKey }),
  ]);
  const revenue = trips.reduce((sum, item) => sum + item.freight, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const outstandingPayments = invoices.reduce((sum, item) => sum + (item.outstandingAmount || Math.max((item.total || 0) - (item.paidAmount || 0), 0)), 0);
  const balanceFreightTotal = balanceFreights.reduce((sum, item) => sum + (item.freight || 0), 0);
  const balanceFreightPending = balanceFreights.reduce((sum, item) => sum + (item.balance || 0), 0);
  res.json({
    revenue,
    expenseTotal,
    profit: revenue - expenseTotal,
    activeTrips,
    completedTrips,
    pendingTrips,
    trucksAvailable: vehicles.filter((item) => item.status === "Available").length,
    trucksOnTrip: vehicles.filter((item) => item.status === "On Trip").length,
    trucksUnderMaintenance: vehicles.filter((item) => item.status === "Under Maintenance").length,
    driversAvailable: drivers.filter((item) => item.status === "Active").length,
    driversOnDuty: drivers.filter((item) => item.status === "On Trip").length,
    pendingInvoices: invoices.filter((item) => item.status !== "Paid").length,
    outstandingPayments,
    todayFuelCost: expenses.filter((item) => item.category === "Fuel" && item.date?.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((sum, item) => sum + item.amount, 0),
    balanceFreight: balanceFreightTotal,
    pendingAmount: balanceFreightPending,
    paidAmount: balanceFreightTotal - balanceFreightPending,
    todayAttendance: todayAttendance.filter((item) => item.status === "Present" || item.status === "Half Day").length,
    absentDrivers: todayAttendance.filter((item) => item.status === "Absent").length,
    monthlySalaryExpense: monthlyPayroll.reduce((sum, item) => sum + (item.netSalary || 0), 0),
    upcomingRenewals: documents.map((item) => ({ ...item.toObject(), status: documentStatus(item.expiryDate) })),
    upcomingMaintenance: maintenance,
  });
});

router.get("/reports/profit-loss", async (req, res) => {
  const trips = await Trip.find().populate("customer vehicle driver");
  const expenses = await Expense.find();
  const rows = trips.map((trip) => {
    const analysis = analyzeTripProfit(trip, expenses);
    return {
      tripId: trip._id,
      route: `${trip.pickup} - ${trip.drop}`,
      customer: trip.customer?.company,
      vehicle: trip.vehicle?.number,
      driver: trip.driver?.name,
      revenue: analysis.freightIncome,
      expense: analysis.totalCost,
      profit: analysis.netProfit,
      profitPercent: analysis.profitPercent,
      profitPerKm: analysis.profitPerKm,
      costPerKm: analysis.costPerKm,
      revenuePerKm: analysis.revenuePerKm,
      profitStatus: analysis.status,
      status: trip.status,
    };
  });
  res.json({ rows, totals: rows.reduce((acc, row) => ({ revenue: acc.revenue + row.revenue, expense: acc.expense + row.expense, profit: acc.profit + row.profit }), { revenue: 0, expense: 0, profit: 0 }) });
});

router.get("/reports/payment-aging", async (req, res) => {
  const invoices = await Invoice.find({ status: { $ne: "Paid" } }).populate("customer");
  const now = Date.now();
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  invoices.forEach((invoice) => {
    const age = Math.max(Math.floor((now - new Date(invoice.dueDate || invoice.createdAt).getTime()) / DAY_MS), 0);
    const amount = invoice.outstandingAmount || invoice.total || 0;
    if (age <= 30) buckets["0-30"] += amount;
    else if (age <= 60) buckets["31-60"] += amount;
    else if (age <= 90) buckets["61-90"] += amount;
    else buckets["90+"] += amount;
  });
  res.json({ buckets, invoices });
});

router.get("/analytics/fuel", async (req, res) => {
  const fuel = await Expense.find({ category: "Fuel" }).populate("trip vehicle driver").sort({ date: 1 });
  const rows = fuel.map((item) => ({
    id: item._id,
    date: item.date,
    vehicle: item.vehicle?.number,
    driver: item.driver?.name,
    liters: item.liters,
    amount: item.amount,
    mileage: item.mileage,
    fuelCostPerKm: item.odometerKm ? Math.round(item.amount / item.odometerKm) : 0,
    abnormal: item.mileage > 0 && item.mileage < 4,
  }));
  res.json({ rows, totalCost: rows.reduce((sum, item) => sum + item.amount, 0), averageMileage: rows.length ? rows.reduce((sum, item) => sum + item.mileage, 0) / rows.length : 0 });
});

router.get("/analytics/drivers", async (req, res) => {
  const [drivers, trips, expenses] = await Promise.all([Driver.find(), Trip.find(), Expense.find()]);
  const rows = drivers.map((driver) => {
    const driverTrips = trips.filter((trip) => String(trip.driver) === String(driver._id));
    const completed = driverTrips.filter((trip) => trip.status === "Completed");
    const revenue = driverTrips.reduce((sum, trip) => sum + trip.freight, 0);
    const distance = driverTrips.reduce((sum, trip) => sum + trip.distanceKm, 0);
    const fuel = expenses.filter((expense) => String(expense.driver) === String(driver._id) && expense.category === "Fuel");
    const avgMileage = fuel.length ? fuel.reduce((sum, expense) => sum + expense.mileage, 0) / fuel.length : 0;
    const attendance = driver.attendance || {};
    const score = Math.max(0, Math.min(100, Math.round(55 + completed.length * 5 + avgMileage * 3 - (attendance.lateDeliveries || 0) * 4 - (attendance.accidents || 0) * 12 - (attendance.penalty || 0) / 1000)));
    return { driver: driver.name, tripsCompleted: completed.length, distance, revenue, fuelEfficiency: avgMileage, salary: driver.salary, advanceTaken: attendance.advanceTaken || 0, accidents: attendance.accidents || 0, penalty: attendance.penalty || 0, score };
  }).sort((a, b) => b.score - a.score);
  res.json({ rows });
});

router.get("/documents/expiring", async (req, res) => {
  const documents = await DocumentRecord.find().populate("vehicle driver").sort({ expiryDate: 1 });
  res.json({ rows: documents.map((item) => ({ ...item.toObject(), status: documentStatus(item.expiryDate) })) });
});

router.patch("/documents/bulk-renew", authorize("admin", "manager"), async (req, res) => {
  const { ids = [], issueDate, expiryDate } = req.body;
  const result = await DocumentRecord.updateMany({ _id: { $in: ids } }, { issueDate, expiryDate, status: documentStatus(expiryDate) });
  await Notification.create({ type: "document", title: "Bulk renewal updated", message: `${result.modifiedCount} documents renewed.` });
  res.json({ updated: result.modifiedCount });
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ rows: [] });
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [vehicles, drivers, customers, trips, invoices, expenses, documents] = await Promise.all([
    Vehicle.find({ $or: [{ number: pattern }, { model: pattern }] }).limit(5),
    Driver.find({ $or: [{ name: pattern }, { phone: pattern }, { license: pattern }] }).limit(5),
    Customer.find({ $or: [{ company: pattern }, { phone: pattern }, { gst: pattern }] }).limit(5),
    Trip.find({ $or: [{ pickup: pattern }, { drop: pattern }, { cargo: pattern }] }).limit(5),
    Invoice.find({ invoiceNo: pattern }).limit(5),
    Expense.find({ note: pattern }).limit(5),
    DocumentRecord.find({ documentNumber: pattern }).limit(5),
  ]);
  res.json({ rows: [
    ...vehicles.map((item) => ({ type: "Vehicle", title: item.number, subtitle: item.model })),
    ...drivers.map((item) => ({ type: "Driver", title: item.name, subtitle: item.phone })),
    ...customers.map((item) => ({ type: "Customer", title: item.company, subtitle: item.gst })),
    ...trips.map((item) => ({ type: "Trip", title: String(item._id), subtitle: `${item.pickup} to ${item.drop}` })),
    ...invoices.map((item) => ({ type: "Invoice", title: item.invoiceNo, subtitle: item.status })),
    ...expenses.map((item) => ({ type: "Expense", title: item.category, subtitle: item.note })),
    ...documents.map((item) => ({ type: "Document", title: item.documentNumber, subtitle: item.type })),
  ] });
});

export default router;
