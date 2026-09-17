import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
delete process.env.AUTH_SERVICE_URL;

const userToken = jwt.sign({ userId: 7, roles: 'user' }, process.env.JWT_SECRET, { expiresIn: '5m' });
const userAuth = `Bearer ${userToken}`;

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

const { default: boqsRoutes } = await import('../src/routes/boqsRoutes.js');
const { summarizeBoq, calcLineCost } = await import('../src/services/calculationService.js');
const app = express();
app.use(express.json());
app.use('/api/boqs', boqsRoutes);

const row = (data) => ({ ...data, update: jest.fn(async (p) => Object.assign(data, p)), destroy: jest.fn(async () => true) });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Biaya, laba & margin', () => {
  test('summarizeBoq hitung laba saat semua harga beli ada', () => {
    const t = summarizeBoq([], [
      { volume: 10, unit_price: 100, buy_price: 60 },
      { volume: 5, unit_price: 200, buy_price: 150 },
    ]);
    expect(t.grandTotal).toBe(2000);
    expect(t.totalCost).toBe(1350);
    expect(t.unknownCostCount).toBe(0);
    expect(t.profit).toBe(650);
    expect(t.profitMargin).toBe(32.5);
  });

  test('summarizeBoq laba null bila ada harga beli kosong', () => {
    const t = summarizeBoq([], [
      { volume: 10, unit_price: 100, buy_price: 60 },
      { volume: 5, unit_price: 200, buy_price: null },
    ]);
    expect(t.unknownCostCount).toBe(1);
    expect(t.profit).toBeNull();
    expect(t.profitMargin).toBeNull();
  });

  test('calcLineCost null untuk harga beli kosong', () => {
    expect(calcLineCost(5, null)).toBeNull();
    expect(calcLineCost(5, '')).toBeNull();
    expect(calcLineCost(5, 150)).toBe(750);
  });

  test('POST item simpan buy_price + vendor', async () => {
    BoqSection.findAll.mockResolvedValue([]);
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft', grand_total: 0, update: jest.fn() }));
    BoqItem.findAll.mockResolvedValue([]);
    BoqItem.create.mockResolvedValue({ id: 30 });
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth)
      .send({ name: 'AC Split', volume: 2, unit_price: 5000, buy_price: 3500, vendor_id: 4, vendor_name: 'PT Sinar AC' });
    expect(res.status).toBe(201);
    expect(BoqItem.create).toHaveBeenCalledWith(expect.objectContaining({
      buy_price: 3500, vendor_id: 4, vendor_name: 'PT Sinar AC',
    }));
  });

  test('POST item tolak harga beli negatif', async () => {
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth)
      .send({ name: 'X', volume: 1, unit_price: 100, buy_price: -5 });
    expect(res.status).toBe(400);
    expect(BoqItem.create).not.toHaveBeenCalled();
  });

  test('POST item tolak vendor_id tidak valid', async () => {
    const res = await request(app).post('/api/boqs/1/items').set('Authorization', userAuth)
      .send({ name: 'X', volume: 1, unit_price: 100, vendor_id: 'abc' });
    expect(res.status).toBe(400);
    expect(BoqItem.create).not.toHaveBeenCalled();
  });

  test('PUT item bisa kosongkan harga beli (NULL)', async () => {
    const item = row({ id: 31, boq_id: 1, volume: 2, unit_price: 5000, buy_price: 3500, vendor_id: 4, vendor_name: 'PT Sinar AC' });
    BoqItem.findByPk.mockResolvedValue(item);
    Boq.findByPk.mockResolvedValue(row({ id: 1, status: 'draft', grand_total: 0, update: jest.fn() }));
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([]);
    const res = await request(app).put('/api/boqs/items/31').set('Authorization', userAuth)
      .send({ buy_price: '', vendor_id: null });
    expect(res.status).toBe(200);
    expect(item.update).toHaveBeenCalledWith(expect.objectContaining({ buy_price: null, vendor_id: null, vendor_name: null }));
  });

  test('GET detail sertakan totalCost/profit di totals', async () => {
    const boq = row({ id: 1, project_id: 5, name: 'BOQ A', status: 'draft', current_version: 0, grand_total: 0 });
    Boq.findByPk.mockResolvedValue(boq);
    BoqSection.findAll.mockResolvedValue([]);
    BoqItem.findAll.mockResolvedValue([
      { id: 20, boq_id: 1, name: 'AC', unit: 'unit', volume: 2, unit_price: 5000, line_total: 10000, buy_price: 3500, vendor_id: 4, vendor_name: 'PT Sinar AC', order_index: 0 },
    ]);
    const res = await request(app).get('/api/boqs/1').set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ grandTotal: 10000, totalCost: 7000, unknownCostCount: 0, profit: 3000, profitMargin: 30 });
  });
});
