const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body || {},
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return res.status(400).json({ error: "Validación fallida", details: errors });
  }

  req.validated = result.data;
  next();
};

module.exports = validate;
