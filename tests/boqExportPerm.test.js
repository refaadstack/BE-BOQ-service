import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
delete process.env.AUTH_SERVICE_URL;

const sign = (payload) => `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
const noPermAuth = sign({ userId: 7, roles: 'user', permissions: [] });
const internalAuth = sign({ userId: 7, roles: 'user', permissions: ['boq.export.internal'] });
const adminAuth = sign({ userId: 1, roles: 'admin' });
const legacyAuth = sign({ userId: 7, roles: 'user' });

const Boq = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
const BoqSection = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), destroy: jest.fn(), update: jest.fn() };
const BoqItem = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), destroy: jest.fn(), update: jest.fn() };
const BoqVersion = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), destroy: jest.fn() };
const BoqApproval = { findAll: jest.fn(), create: jest.fn(), destroy: jest.fn() };
const Setting = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() };
const axiosMock = { get: jest.fn() };

jest.unstable_mockModule('../src/models/index.js', () => ({
  Boq, BoqSection, BoqItem, BoqVersion, BoqApproval, Setting,
}));
jest.unstable_mockModule('axios', () => ({ default: axiosMock, get: axiosMock.get }));
jest.unstable_mockModule('../src/services/exportService.js', () => ({
  exportBoqToExcel: jest.fn(async () => Buffer.from('excel-bytes')),
  exportBoqToPdf: jest.fn(async () => Buffer.from('pdf-bytes')),
  parsePdfOptions: jest.fn((q) => ({ cost: String(q?.show_cost) === '1' })),
  PDF_DEFAULT_OPTIONS: {},
  default: {},
}));

const { default: boqsRoutes } = await import('../src/routes/boqsRoutes.js');
const exportSvc = await import('../src/services/exportService.js');
const app = express();
app.use(express.json());
app.use('/api/boqs', boqsRoutes);

const row = (data) => ({ ...data, update: jest.fn(async (p) => Object.assign(data, p)), destroy: jest.fn(async () => true) });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Export kolom internal butuh izin', () => {
  const detailMocks = () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, project_id: 5, name: 'BOQ A', status: 'draft', current_version: 0, grand_total: 0 }));
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([]);
    Setting.findAll.mockResolvedValue([]);
    exportSvc.exportBoqToExcel.mockResolvedValue(Buffer.from('excel-bytes'));
    exportSvc.exportBoqToPdf.mockResolvedValue(Buffer.from('pdf-bytes'));
    exportSvc.parsePdfOptions.mockImplementation((q) => ({ cost: String(q?.show_cost) === '1' }));
  };

  test('xlsx ditolak tanpa izin boq.export.internal', async () => {
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=xlsx').set('Authorization', noPermAuth);
    expect(res.status).toBe(403);
    expect(exportSvc.exportBoqToExcel).not.toHaveBeenCalled();
  });

  test('pdf internal ditolak tanpa izin', async () => {
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=pdf&show_cost=1').set('Authorization', noPermAuth);
    expect(res.status).toBe(403);
    expect(exportSvc.exportBoqToPdf).not.toHaveBeenCalled();
  });

  test('xlsx lolos dengan izin', async () => {
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=xlsx').set('Authorization', internalAuth);
    expect(res.status).toBe(200);
  });

  test('admin lolos tanpa klaim permissions', async () => {
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=xlsx').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
  });

  test('token lama tanpa klaim tetap boleh (kompatibel mundur)', async () => {
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=xlsx').set('Authorization', legacyAuth);
    expect(res.status).toBe(200);
  });
});
