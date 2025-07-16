const jwt = require('jsonwebtoken');
const axios = require('axios');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Optionally verify token with Auth Service
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    const response = await axios.post(authServiceUrl + '/api/auth/verify-token', { token });
    if (!response.data.valid) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Failed to authenticate token' });
  }
};

module.exports = {
  authenticateToken,
};
