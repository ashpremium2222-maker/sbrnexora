export function crudController(Model, { populate = "" } = {}) {
  return {
    async list(req, res) {
      const { q, sort = "-createdAt", page = 1, limit = 25 } = req.query;
      const query = q ? { $text: { $search: q } } : {};
      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        Model.find(query).sort(sort).skip(skip).limit(Number(limit)).populate(populate),
        Model.countDocuments(query),
      ]);
      res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
    },
    async get(req, res) {
      const item = await Model.findById(req.params.id).populate(populate);
      if (!item) return res.status(404).json({ error: "Not found" });
      res.json(item);
    },
    async create(req, res) {
      const item = await Model.create(req.body);
      res.status(201).json(item);
    },
    async update(req, res) {
      const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ error: "Not found" });
      res.json(item);
    },
    async remove(req, res) {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      res.status(204).end();
    },
  };
}
