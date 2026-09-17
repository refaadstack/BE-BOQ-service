import jwt from 'jsonwebtoken';
import axios from 'axios';

const getSecret = () => process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = /^Bearer ([^\s]+)$/i.exec(authHeader || '')?.[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    if (authServiceUrl) {
      const response = await axios.post(authServiceUrl + '/api/auth/verify-token', { token }, { timeout: 5000 });
      if (!response.data || !response.data.valid) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Failed to authenticate token' });
  }
};

export default { authenticateToken };
