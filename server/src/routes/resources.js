import express from "express";
import { Attendance, AuditLog, BalanceFreight, Customer, DocumentRecord, Driver, Expense, Invoice, Maintenance, Notification, Payment, Payroll, Trip, Vehicle } from "../models/index.js";
import { crudController } from "../controllers/crudController.js";
import { authorize } from "../middleware/auth.js";

const router = express.Router();

const resources = {
  vehicles: [Vehicle, {}],
  drivers: [Driver, {}],
  customers: [Customer, {}],
  trips: [Trip, { populate: "customer vehicle driver" }],
  expenses: [Expense, { populate: "trip" }],
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
