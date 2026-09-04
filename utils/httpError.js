const httpError = (message, status = 400, extra = {}) => {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
};

module.exports = httpError;
