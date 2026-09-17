export const requireAdmin = (req, res, next) => {
  if (req.user?.roles !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin.' });
  }
  next();
};

export default { requireAdmin };
