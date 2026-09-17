import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
delete process.env.AUTH_SERVICE_URL;
const token = jwt.sign({ userId: 7, roles: 'user' }, process.env.JWT_SECRET, { expiresIn: '5m' });
const auth = `Bearer ${token}`;
const Category = { findAll: jest.fn() };
const ProjectItem = {
  findAll: jest.fn(), create: jest.fn(), update: jest.fn(), destroy: jest.fn(),
};
jest.unstable_mockModule('../src/models/index.js', () => ({ Category, ProjectItem }));
const { default: boqRoutes } = await import('../src/routes/boqRoutes.js');
const app = express();
app.use(express.json());
app.use('/api/boq', boqRoutes);

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Active BOQ routes with isolated model mocks', () => {
  test('GET groups project items by category', async () => {
    const category = { id: 2, project_id: 7, name: 'Concrete', children: [] };
    const item = { id: 4, project_id: 7, category_id: 2, volume: 3 };
    Category.findAll.mockResolvedValue([category]);
    ProjectItem.findAll.mockResolvedValue([item]);
    const res = await request(app).get('/api/boq/projects/7').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ categories: [category], items: { 2: [item] } });
    expect(Category.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { project_id: '7', parent_id: null },
    }));
    expect(ProjectItem.findAll).toHaveBeenCalledWith({ where: { project_id: '7' } });
  });

  test('GET returns empty collections for an empty project', async () => {
    Category.findAll.mockResolvedValue([]);
    ProjectItem.findAll.mockResolvedValue([]);
    const res = await request(app).get('/api/boq/projects/7').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ categories: [], items: {} });
  });

  test('GET reports model failure', async () => {
    Category.findAll.mockRejectedValue(new Error('database unavailable'));
    const res = await request(app).get('/api/boq/projects/7').set('Authorization', auth);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('POST persists the project item payload', async () => {
    const body = { item_id: 3, category_id: 2, volume: 4, unit_price: 12000, notes: 'test' };
    ProjectItem.create.mockResolvedValue({ id: 8, project_id: '7', ...body });
    const res = await request(app).post('/api/boq/projects/7/items').set('Authorization', auth).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(8);
    expect(ProjectItem.create).toHaveBeenCalledWith({ project_id: '7', ...body });
  });

  test('POST reports persistence failure', async () => {
    ProjectItem.create.mockRejectedValue(new Error('database unavailable'));
    const res = await request(app).post('/api/boq/projects/7/items').set('Authorization', auth).send({ item_id: 3 });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test.each([[1, 200], [0, 404]])('PUT affected rows %i returns %i', async (count, status) => {
    ProjectItem.update.mockResolvedValue([count]);
    const res = await request(app).put('/api/boq/items/8').set('Authorization', auth).send({ volume: 5 });
    expect(res.status).toBe(status);
    expect(ProjectItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 5 }), { where: { id: '8' } },
    );
  });

  test('PUT reports persistence failure', async () => {
    ProjectItem.update.mockRejectedValue(new Error('database unavailable'));
    expect((await request(app).put('/api/boq/items/8').set('Authorization', auth).send({ volume: 5 })).status).toBe(500);
  });

  test.each([[1, 200], [0, 404]])('DELETE affected rows %i returns %i', async (count, status) => {
    ProjectItem.destroy.mockResolvedValue(count);
    const res = await request(app).delete('/api/boq/items/8').set('Authorization', auth);
    expect(res.status).toBe(status);
    expect(ProjectItem.destroy).toHaveBeenCalledWith({ where: { id: '8' } });
  });

  test('DELETE reports persistence failure', async () => {
    ProjectItem.destroy.mockRejectedValue(new Error('database unavailable'));
    expect((await request(app).delete('/api/boq/items/8').set('Authorization', auth)).status).toBe(500);
  });
});

describe('BOQ authentication boundary', () => {
  test.each([
    ['get', '/api/boq/projects/7'],
    ['post', '/api/boq/projects/7/items'],
    ['put', '/api/boq/items/8'],
    ['delete', '/api/boq/items/8'],
  ])('%s %s requires a bearer token', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(Category.findAll).not.toHaveBeenCalled();
    expect(ProjectItem.create).not.toHaveBeenCalled();
    expect(ProjectItem.update).not.toHaveBeenCalled();
    expect(ProjectItem.destroy).not.toHaveBeenCalled();
  });
});
