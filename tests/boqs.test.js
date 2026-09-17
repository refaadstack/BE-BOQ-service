import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
delete process.env.AUTH_SERVICE_URL;

const userToken = jwt.sign({ userId: 7, roles: 'user' }, process.env.JWT_SECRET, { expiresIn: '5m' });
const adminToken = jwt.sign({ userId: 1, roles: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
const userAuth = `Bearer ${userToken}`;
const adminAuth = `Bearer ${adminToken}`;

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
const realParsePdfOptions = (q = {}) => {
  const FALSY = new Set(['0', 'false', 'no', 'off', '']);
  const pick = (key, def) => {
    if (q[key] === undefined) return def;
    return !FALSY.has(String(q[key]).trim().toLowerCase());
  };
  return {
    company: pick('show_company', true),
    project: pick('show_project', true),
    ids: pick('show_ids', true),
    sections: pick('show_sections', true),
    items: pick('show_items', true),
    total: pick('show_total', true),
  };
};
jest.unstable_mockModule('../src/services/exportService.js', () => ({
  exportBoqToExcel: jest.fn(async () => Buffer.from('excel-bytes')),
  exportBoqToPdf: jest.fn(async () => Buffer.from('pdf-bytes')),
  parsePdfOptions: jest.fn((q) => realParsePdfOptions(q)),
  PDF_DEFAULT_OPTIONS: { company: true, project: true, ids: true, sections: true, items: true, total: true },
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

describe('BOQ CRUD', () => {
  test('GET / requires project_id', async () => {
    const res = await request(app).get('/api/boqs').set('Authorization', userAuth);
    expect(res.status).toBe(400);
    expect(Boq.findAll).not.toHaveBeenCalled();
  });

  test('GET / lists boqs by project', async () => {
    Boq.findAll.mockResolvedValue([{ id: 1, project_id: 5, name: 'BOQ A' }]);
    const res = await request(app).get('/api/boqs?project_id=5').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(Boq.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { project_id: 5 } }));
  });

  test('POST / validates name', async () => {
    const res = await request(app).post('/api/boqs').set('Authorization', userAuth).send({ project_id: 5 });
    expect(res.status).toBe(400);
    expect(Boq.create).not.toHaveBeenCalled();
  });

  test('POST / creates boq', async () => {
    Boq.create.mockResolvedValue({ id: 2, project_id: 5, name: 'BOQ B' });
    const res = await request(app).post('/api/boqs').set('Authorization', userAuth).send({ project_id: 5, name: 'BOQ B' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('BOQ B');
  });

  test('GET /:id returns detail with totals', async () => {
    const boq = row({ id: 1, project_id: 5, name: 'BOQ A', status: 'draft', current_version: 0, grand_total: 0 });
    Boq.findByPk.mockResolvedValue(boq);
    BoqSection.findAll.mockResolvedValue([{ id: 10, boq_id: 1, name: 'S1', order_index: 0 }]);
    BoqItem.findAll.mockResolvedValue([
      { id: 20, boq_id: 1, section_id: 10, name: 'Beton', unit: 'm3', volume: 2, unit_price: 1000, line_total: 2000, order_index: 0 },
    ]);
    const res = await request(app).get('/api/boqs/1').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(res.body.data.totals.grandTotal).toBe(2000);
    expect(res.body.data.totals.itemCount).toBe(1);
  });

  test('GET /:id 404 when missing', async () => {
    Boq.findByPk.mockResolvedValue(null);
    expect((await request(app).get('/api/boqs/99').set('Authorization', userAuth)).status).toBe(404);
  });

  test('PUT /:id locked when submitted', async () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'submitted' }));
    const res = await request(app).put('/api/boqs/1').set('Authorization', userAuth).send({ name: 'X' });
    expect(res.status).toBe(409);
  });

  test('DELETE /:id removes children then boq', async () => {
    const boq = row({ id: 1 });
    Boq.findByPk.mockResolvedValue(boq);
    BoqVersion.findAll.mockResolvedValue([{ id: 3 }]);
    const res = await request(app).delete('/api/boqs/1').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(BoqItem.destroy).toHaveBeenCalledWith({ where: { boq_id: 1 } });
    expect(BoqSection.destroy).toHaveBeenCalledWith({ where: { boq_id: 1 } });
    expect(boq.destroy).toHaveBeenCalled();
  });
});

describe('Sections & items', () => {
  test('POST section validates name', async () => {
    const res = await request(app).post('/api/boqs/1/sections').set('Authorization', userAuth).send({});
    expect(res.status).toBe(400);
  });

  test('POST section creates with auto order', async () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft' }));
    BoqSection.findAll.mockResolvedValue([{ order_index: 0 }]);
    BoqSection.create.mockResolvedValue({ id: 11, boq_id: 1, name: 'S2', order_index: 1 });
    const res = await request(app).post('/api/boqs/1/sections').set('Authorization', userAuth).send({ name: 'S2' });
    expect(res.status).toBe(201);
    expect(BoqSection.create).toHaveBeenCalledWith(expect.objectContaining({ boq_id: 1, name: 'S2', order_index: 1 }));
  });

  test('POST item rejects negative volume', async () => {
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth).send({ name: 'X', volume: -1 });
    expect(res.status).toBe(400);
    expect(BoqItem.create).not.toHaveBeenCalled();
  });

  test('POST item computes line_total', async () => {
    BoqSection.findAll.mockResolvedValue([]); // refreshGrandTotal needs this
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft', grand_total: 0, update: jest.fn() }));
    BoqSection.findByPk.mockResolvedValue({ id: 10, boq_id: 1 });
    BoqItem.findAll.mockResolvedValue([]);
    BoqItem.create.mockResolvedValue({ id: 21, line_total: 3000 });
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth)
      .send({ name: 'Besi', section_id: 10, volume: 3, unit_price: 1000 });
    expect(res.status).toBe(201);
    expect(BoqItem.create).toHaveBeenCalledWith(expect.objectContaining({ line_total: 3000 }));
  });

  test('POST item rejects foreign section', async () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft' }));
    BoqSection.findByPk.mockResolvedValue({ id: 10, boq_id: 2 });
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth)
      .send({ name: 'X', section_id: 10, volume: 1, unit_price: 1 });
    expect(res.status).toBe(400);
  });
});

describe('Version & approval', () => {
  test('POST submit snapshots and locks', async () => {
    const boq = row({ id: 1, project_id: 5, name: 'BOQ A', status: 'draft', current_version: 0, grand_total: 0 });
    Boq.findByPk.mockResolvedValue(boq);
    BoqSection.findAll.mockResolvedValue([{ id: 10, boq_id: 1, name: 'S1', order_index: 0 }]);
    BoqItem.findAll.mockResolvedValue([
      { id: 20, boq_id: 1, section_id: 10, name: 'Beton', unit: 'm3', volume: 2, unit_price: 1000, order_index: 0 },
    ]);
    BoqVersion.create.mockResolvedValue({ id: 5, version_no: 1 });
    const res = await request(app).post('/api/boqs/1/submit').set('Authorization', userAuth).send({ note: 'siap' });
    expect(res.status).toBe(201);
    expect(BoqVersion.create).toHaveBeenCalledWith(expect.objectContaining({ boq_id: 1, version_no: 1, status: 'submitted' }));
    expect(BoqApproval.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'submit' }));
    expect(boq.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted', current_version: 1 }));
  });

  test('POST submit rejects empty boq', async () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft', current_version: 0 }));
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([]);
    expect((await request(app).post('/api/boqs/1/submit').set('Authorization', userAuth).send({})).status).toBe(400);
  });

  test('POST submit conflicts when already submitted', async () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'submitted', current_version: 1 }));
    expect((await request(app).post('/api/boqs/1/submit').set('Authorization', userAuth).send({})).status).toBe(409);
  });

  test('POST approve requires admin', async () => {
    const res = await request(app).post('/api/boqs/versions/5/approve').set('Authorization', userAuth).send({});
    expect(res.status).toBe(403);
    expect(BoqVersion.findByPk).not.toHaveBeenCalled();
  });

  test('POST approve works for admin on latest submitted', async () => {
    const version = row({ id: 5, boq_id: 1, version_no: 2, status: 'submitted' });
    const boq = row({ id: 1, status: 'submitted', current_version: 2 });
    BoqVersion.findByPk.mockResolvedValue(version);
    Boq.findByPk.mockResolvedValue(boq);
    const res = await request(app).post('/api/boqs/versions/5/approve').set('Authorization', adminAuth).send({});
    expect(res.status).toBe(200);
    expect(version.update).toHaveBeenCalledWith({ status: 'approved' });
    expect(boq.update).toHaveBeenCalledWith({ status: 'approved' });
  });

  test('POST reject stale version conflicts', async () => {
    BoqVersion.findByPk.mockResolvedValue(row({ id: 5, boq_id: 1, version_no: 1, status: 'submitted' }));
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'submitted', current_version: 2 }));
    expect((await request(app).post('/api/boqs/versions/5/reject').set('Authorization', adminAuth).send({})).status).toBe(409);
  });
});

describe('Export & auth boundary', () => {
  const detailMocks = () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, project_id: 5, name: 'BOQ A', status: 'draft', current_version: 0, grand_total: 0 }));
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([]);
  };
  test('GET export rejects bad format', async () => {
    expect((await request(app).get('/api/boqs/1/export?format=csv').set('Authorization', userAuth)).status).toBe(400);
  });
  test('GET export xlsx returns file', async () => {
    exportSvc.exportBoqToExcel.mockResolvedValue(Buffer.from('excel-bytes'));
    Setting.findAll.mockResolvedValue([]); // resetAllMocks wipes factory impl
    detailMocks();
    const res = await request(app).get('/api/boqs/1/export?format=xlsx').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch('spreadsheetml');
  });
  test.each([
    ['get', '/api/boqs?project_id=5'],
    ['post', '/api/boqs'],
    ['get', '/api/boqs/1'],
    ['post', '/api/boqs/1/submit'],
    ['post', '/api/boqs/versions/5/approve'],
  ])('%s %s requires a bearer token', async (method, url) => {
    expect((await request(app)[method](url).send({})).status).toBe(401);
  });
});

describe('Settings kop', () => {
  test('GET /settings returns all keys with defaults', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'company_name', value: 'PT Maju' }]);
    const res = await request(app).get('/api/boqs/settings').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(res.body.data.company_name).toBe('PT Maju');
    expect(res.body.data.company_address).toBe('');
  });

  test('PUT /settings requires admin', async () => {
    const res = await request(app).put('/api/boqs/settings').set('Authorization', userAuth).send({ company_name: 'X' });
    expect(res.status).toBe(403);
    expect(Setting.create).not.toHaveBeenCalled();
  });

  test('PUT /settings rejects unknown keys', async () => {
    const res = await request(app).put('/api/boqs/settings').set('Authorization', adminAuth).send({ nope: 'x' });
    expect(res.status).toBe(400);
    expect(Setting.create).not.toHaveBeenCalled();
  });

  test('PUT /settings creates missing keys', async () => {
    Setting.findOne.mockResolvedValue(null);
    Setting.create.mockResolvedValue({});
    Setting.findAll.mockResolvedValue([{ key: 'company_name', value: 'PT Maju' }]);
    const res = await request(app).put('/api/boqs/settings').set('Authorization', adminAuth).send({ company_name: 'PT Maju' });
    expect(res.status).toBe(200);
    expect(Setting.create).toHaveBeenCalledWith({ key: 'company_name', value: 'PT Maju' });
    expect(res.body.data.company_name).toBe('PT Maju');
  });

  test('PUT /settings updates existing key', async () => {
    const row = { update: jest.fn() };
    Setting.findOne.mockResolvedValue(row);
    Setting.findAll.mockResolvedValue([]);
    const res = await request(app).put('/api/boqs/settings').set('Authorization', adminAuth).send({ company_phone: '021' });
    expect(res.status).toBe(200);
    expect(row.update).toHaveBeenCalledWith({ value: '021' });
    expect(Setting.create).not.toHaveBeenCalled();
  });
});

describe('Export PDF options', () => {
  const pdfDetail = () => {
    Boq.findByPk.mockResolvedValue(row({ id: 1, project_id: 5, name: 'BOQ A', status: 'approved', current_version: 2, grand_total: 0 }));
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([]);
    Setting.findAll.mockResolvedValue([]);
    exportSvc.exportBoqToPdf.mockResolvedValue(Buffer.from('pdf-bytes'));
    exportSvc.parsePdfOptions.mockImplementation((q) => realParsePdfOptions(q));
  };
  test('passes parsed options and project info', async () => {
    pdfDetail();
    axiosMock.get.mockResolvedValue({ data: { data: { id: 5, name: 'Gedung', description: 'Desc' } } });
    const res = await request(app).get('/api/boqs/1/export?format=pdf&show_total=0&show_company=0').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/projects/5'), expect.anything());
    expect(exportSvc.exportBoqToPdf).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ total: false, company: false, items: true, sections: true }),
      project: { id: 5, name: 'Gedung', description: 'Desc' },
    }));
  });
  test('tolerates project service down', async () => {
    pdfDetail();
    axiosMock.get.mockRejectedValue(new Error('down'));
    const res = await request(app).get('/api/boqs/1/export?format=pdf').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(exportSvc.exportBoqToPdf).toHaveBeenCalledWith(expect.objectContaining({ project: null }));
  });
});
