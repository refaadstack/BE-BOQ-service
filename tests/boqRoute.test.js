const request = require('supertest');
const express = require('express');

jest.mock('../src/models', () => {
  // Fungsi buat bikin mock instance kategori
  function createMockCategory(id) {
    return {
      id,
      project_id: 1,
      name: 'Existing Category',
      order_seq: 1,
      level: 1,
      is_active: true,
      update: jest.fn().mockImplementation(async (data) => {
        // simulasikan update properti name dan lainnya
        return { ...createMockCategory(id), ...data };
      }),
      destroy: jest.fn().mockResolvedValue(true),
    };
  }

  // Fungsi buat mock item map (relasi item ke kategori)
  function createMockItemMap(category_id, item_id) {
    return {
      category_id,
      item_id,
      destroy: jest.fn().mockResolvedValue(true),
    };
  }

  return {
    BoqCategory: {
      findAll: jest.fn().mockResolvedValue([
        { id: 1, project_id: 1, name: 'Mock Category 1', order_seq: 1, level: 1, is_active: true },
      ]),
      create: jest.fn().mockImplementation(data => Promise.resolve({ id: 2, ...data })),
      findByPk: jest.fn().mockImplementation(id => {
        if (id === 1) return Promise.resolve(createMockCategory(id));
        return Promise.resolve(null);
      }),
    },
    BoqItemMap: {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.category_id === 1 && where.item_id === 1) {
          // relasi sudah ada => duplicate
          return Promise.resolve(createMockItemMap(where.category_id, where.item_id));
        }
        // jika cek untuk hapus relasi yg ada
        if (where.category_id === 1 && where.item_id === 999) {
          return Promise.resolve(null);
        }
        // jika cek relasi yang tidak ada
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({ id: 1, category_id: 1, item_id: 999 }),
    },
  };
});

const boqRoutes = require('../src/routes/boqRoutes');
const app = express();
app.use(express.json());
app.use('/api/boq', boqRoutes);

describe('BOQ Routes with Mock Models', () => {
  const testProjectId = 1;

  test('GET /api/boq/projects/:projectId/categories should return categories array', async () => {
    const res = await request(app).get(`/api/boq/projects/${testProjectId}/categories`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('Mock Category 1');
  });

  test('POST /api/boq/projects/:projectId/categories should create a category', async () => {
    const res = await request(app)
      .post(`/api/boq/projects/${testProjectId}/categories`)
      .send({
        name: 'New Mock Category',
        order_seq: 1,
        level: 1,
        is_active: true,
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('New Mock Category');
  });

  test('PUT /api/boq/categories/:id should update a category', async () => {
    const res = await request(app)
      .put(`/api/boq/categories/1`)
      .send({
        name: 'Updated Mock Category',
        order_seq: 2,
        level: 1,
        is_active: false,
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Mock Category');
  });

  test('POST /api/boq/categories/:categoryId/items should add item to category', async () => {
    // pakai item_id yang belum ada agar bisa sukses create
    const res = await request(app)
      .post(`/api/boq/categories/1/items`)
      .send({ item_id: 999 });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/boq/categories/:categoryId/items should fail to add duplicate item', async () => {
    // pakai item_id yang sudah ada supaya error duplicate
    const res = await request(app)
      .post(`/api/boq/categories/1/items`)
      .send({ item_id: 1 });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/boq/categories/:categoryId/items/:itemId should remove item from category', async () => {
    const res = await request(app).delete(`/api/boq/categories/1/items/1`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('DELETE /api/boq/categories/:id should delete category', async () => {
    const res = await request(app).delete(`/api/boq/categories/1`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
