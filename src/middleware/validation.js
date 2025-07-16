const Joi = require('joi');

const validateSchema = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // include all errors
      allowUnknown: true, // ignore unknown props
      stripUnknown: true // remove unknown props
    };
    const { error, value } = schema.validate(req.body, validationOptions);
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      req.body = value;
      next();
    }
  };
};

module.exports = {
  validateSchema,
};
