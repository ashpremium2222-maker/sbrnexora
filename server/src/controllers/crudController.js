const emptyDate = (value) => ["", "undefined", "null", "-"].includes(String(value ?? "").trim());

function cleanPayload(payload = {}) {
  const result = { ...payload };
  delete result._id;
  delete result.id;
  delete result.createdAt;
  delete result.updatedAt;

  for (const [key, value] of Object.entries(result)) {
    if (emptyDate(value) && /(date|expiry)$/i.test(key)) delete result[key];
  }

  // Sparse unique business identifiers must be absent, rather than an empty
  // string, so operators can save incomplete draft vehicles and drivers.
  for (const key of ["number", "license"]) {
    if (typeof result[key] === "string" && !result[key].trim()) delete result[key];
  }

  if (Array.isArray(result.documents)) {
    result.documents = result.documents
      .map((document) => {
        if (!document || typeof document !== "object") return null;
        const normalized = { ...document, url: document.url || document.dataUrl };
        delete normalized.dataUrl;
        for (const [key, value] of Object.entries(normalized)) {
          if (emptyDate(value) && /(date|expiry)$/i.test(key)) delete normalized[key];
        }
        return normalized;
      })
      .filter(Boolean);
  }
  return result;
}

export function crudController(Model, { populate = "" } = {}) {
  return {
    async list(req, res, next) {
      try {
        const { q, sort = "-createdAt", page = 1, limit = 25 } = req.query;
        const query = q ? { $text: { $search: q } } : {};
        const skip = (Number(page) - 1) * Number(limit);
        const [items, total] = await Promise.all([
          Model.find(query).sort(sort).skip(skip).limit(Number(limit)).populate(populate),
          Model.countDocuments(query),
        ]);
        res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
      } catch (error) { next(error); }
    },
    async get(req, res, next) {
      try {
        const item = await Model.findById(req.params.id).populate(populate);
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json(item);
      } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try {
        const item = await Model.create(cleanPayload(req.body));
        res.status(201).json(item);
      } catch (error) { next(error); }
    },
    async update(req, res, next) {
      try {
        const item = await Model.findByIdAndUpdate(req.params.id, { $set: cleanPayload(req.body) }, { new: true, runValidators: false });
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json(item);
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        const item = await Model.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        res.status(204).end();
      } catch (error) { next(error); }
    },
  };
}
