import mongoose from "mongoose";
import { DocumentRecord, Expense, Invoice, Maintenance, Notification, Trip, Vehicle, Driver } from "../models/index.js";

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/truck_business";
const DAY_MS = 86400000;

function statusFor(expiryDate) {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return "Expired";
  if (days <= 7) return "Due 7";
  if (days <= 15) return "Due 15";
  if (days <= 30) return "Due 30";
  if (days <= 60) return "Due 60";
  if (days <= 90) return "Due 90";
  return "Valid";
}

function profitStatus(profitPercent, netProfit) {
  if (netProfit < 0) return "Loss";
  if (profitPercent >= 30) return "Highly Profitable";
  return "Average";
}

async function upsertVehicleDocuments() {
  const vehicles = await Vehicle.find();
  for (const vehicle of vehicles) {
    const docs = [
      ["RC", vehicle.rcExpiry],
      ["Insurance", vehicle.insuranceExpiry],
      ["Permit", vehicle.permitExpiry],
      ["PUC", vehicle.pucExpiry],
    ].filter(([, expiryDate]) => expiryDate);

    for (const [type, expiryDate] of docs) {
      await DocumentRecord.updateOne(
        { ownerType: "Vehicle", vehicle: vehicle._id, type },
        {
          ownerType: "Vehicle",
          vehicle: vehicle._id,
          type,
          documentNumber: `${vehicle.number}-${type}`.replace(/\s+/g, "-").toUpperCase(),
          expiryDate,
          status: statusFor(expiryDate),
        },
        { upsert: true },
      );
    }
  }
}

async function upsertDriverDocuments() {
  const drivers = await Driver.find();
  for (const driver of drivers) {
    if (!driver.licenseExpiry) continue;
    await DocumentRecord.updateOne(
      { ownerType: "Driver", driver: driver._id, type: "License" },
      {
        ownerType: "Driver",
        driver: driver._id,
        type: "License",
        documentNumber: driver.license,
        expiryDate: driver.licenseExpiry,
        status: statusFor(driver.licenseExpiry),
      },
      { upsert: true },
    );
  }
}

async function backfillTripProfit() {
  const [trips, expenses] = await Promise.all([Trip.find(), Expense.find()]);
  for (const trip of trips) {
    const sum = (category) => expenses.filter((expense) => String(expense.trip) === String(trip._id) && expense.category === category).reduce((total, expense) => total + expense.amount, 0);
    const fuelCost = sum("Fuel");
    const driverSalary = sum("Salary");
    const driverAllowance = sum("Allowance");
    const tollCharges = sum("Toll");
    const parking = sum("Parking");
    const maintenanceCost = sum("Maintenance");
    const miscExpenses = sum("Other");
    const totalCost = fuelCost + driverSalary + driverAllowance + tollCharges + parking + maintenanceCost + miscExpenses;
    const netProfit = trip.freight - totalCost;
    const distance = trip.distanceKm || 1;
    const profitPercent = trip.freight ? Math.round((netProfit / trip.freight) * 100) : 0;

    trip.profitAnalysis = {
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
      status: profitStatus(profitPercent, netProfit),
    };
    await trip.save();
  }
}

async function seedMaintenancePlanner() {
  const vehicles = await Vehicle.find({ maintenanceSchedule: { $exists: true, $ne: null } });
  for (const vehicle of vehicles) {
    await Maintenance.updateOne(
      { vehicle: vehicle._id, serviceType: "General Service", dueDate: vehicle.maintenanceSchedule },
      {
        vehicle: vehicle._id,
        serviceType: "General Service",
        serviceCost: 0,
        workshop: "Preferred workshop",
        mechanic: "",
        partsUsed: "",
        serviceIntervalKm: 10000,
        mileageReminderKm: 500,
        dueDate: vehicle.maintenanceSchedule,
        status: "Upcoming",
      },
      { upsert: true },
    );
  }
}

async function normalizeInvoices() {
  const invoices = await Invoice.find();
  for (const invoice of invoices) {
    const total = invoice.total || invoice.subtotal + invoice.gstAmount;
    const outstandingAmount = Math.max(total - (invoice.paidAmount || 0), 0);
    invoice.total = total;
    invoice.outstandingAmount = outstandingAmount;
    if (outstandingAmount === 0) invoice.status = "Paid";
    else if ((invoice.paidAmount || 0) > 0) invoice.status = "Partial";
    await invoice.save();
  }
}

async function createDocumentAlerts() {
  const docs = await DocumentRecord.find({ status: { $ne: "Valid" } }).populate("vehicle driver");
  for (const doc of docs) {
    const owner = doc.vehicle?.number || doc.driver?.name || doc.ownerType;
    await Notification.updateOne(
      { type: "document", title: `${doc.type} ${doc.status}`, message: `${owner} ${doc.type} is ${doc.status.toLowerCase()}.` },
      { type: "document", title: `${doc.type} ${doc.status}`, message: `${owner} ${doc.type} is ${doc.status.toLowerCase()}.`, priority: doc.status === "Expired" ? "Critical" : "High" },
      { upsert: true },
    );
  }
}

async function run() {
  await mongoose.connect(mongoUri);
  await upsertVehicleDocuments();
  await upsertDriverDocuments();
  await backfillTripProfit();
  await seedMaintenancePlanner();
  await normalizeInvoices();
  await createDocumentAlerts();
  await mongoose.disconnect();
  console.log("Phase 3 enterprise migration complete");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
