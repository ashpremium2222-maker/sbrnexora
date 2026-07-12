import express from "express";
import { Attendance, AuditLog, BalanceFreight, CompanyExpense, CompanyProfile, Customer, DocumentRecord, Driver, Expense, Invoice, Maintenance, Notification, Payment, Payroll, Trip, Vehicle } from "../models/index.js";
import { crudController } from "../controllers/crudController.js";
import { authorize } from "../middleware/auth.js";

const router = express.Router();

// One shared company profile. It is intentionally separate from generic CRUD
// resources so every admin edits the same permanent business identity.
router.get("/company-profile", async (req, res, next) => {
  try {
    const profile = await CompanyProfile.findOne({ key: "primary" });
    res.json(profile || {});
  } catch (error) { next(error); }
});

router.put("/company-profile", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const fields = ["name", "tagline", "gst", "phone", "phone2", "email", "address", "jurisdiction", "pan", "bankName", "bankBranch", "bankAccount", "bankIfsc"];
    const update = Object.fromEntries(fields.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
    const profile = await CompanyProfile.findOneAndUpdate(
      { key: "primary" },
      { $set: update, $setOnInsert: { key: "primary" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json(profile);
  } catch (error) { next(error); }
});

const resources = {
  vehicles: [Vehicle, {}],
  drivers: [Driver, {}],
  customers: [Customer, {}],
  trips: [Trip, { populate: "customer vehicle driver" }],
  expenses: [Expense, { populate: "trip" }],
  companyExpenses: [CompanyExpense, {}],
  invoices: [Invoice, { populate: "trip customer" }],
  payments: [Payment, { populate: "invoice customer" }],
  notifications: [Notification, {}],
  documents: [DocumentRecord, { populate: "vehicle driver" }],
  maintenance: [Maintenance, { populate: "vehicle" }],
  balanceFreights: [BalanceFreight, {}],
  attendance: [Attendance, { populate: "driver" }],
  payroll: [Payroll, { populate: "driver" }],
  auditLogs: [AuditLog, { populate: "actor" }],
};

Object.entries(resources).forEach(([name, [Model, options]]) => {
  const c = crudController(Model, options);
  router.get(`/${name}`, c.list);
  router.get(`/${name}/:id`, c.get);
  router.post(`/${name}`, authorize("admin", "manager"), c.create);
  router.patch(`/${name}/:id`, authorize("admin", "manager"), c.update);
  router.delete(`/${name}/:id`, authorize("admin", "manager"), c.remove);
});

export default router;
