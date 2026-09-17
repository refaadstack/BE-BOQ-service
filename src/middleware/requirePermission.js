// Izin berbasis peran dari auth service.
// - Legacy admin (roles === 'admin') atau klaim '*' selalu lolos.
// - Token lama tanpa klaim permissions: izinkan (kompatibel mundur).
// - Token ber-klaim: harus memegang semua key yang diminta.
export const requirePermission = (...keys) => (req, res, next) => {
  if (req.user?.roles === 'admin') return next();
  const granted = req.user?.permissions;
  if (!Array.isArray(granted)) return next();
  if (granted.includes('*') || keys.every((k) => granted.includes(k))) return next();
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak. Butuh izin: ' + keys.join(', ') + '.',
  });
};

export default { requirePermission };
