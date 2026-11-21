var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function product(stock, reserved) {
  return {
    id: 6,
    sku: 'DRY-001',
    name: 'A2 Gir Cow Ghee 500ml',
    hsn: '0405',
    price: 450,
    stock: stock,
    reserved: reserved,
    reorderLevel: 5
  };
}

function orderLine(qty) {
  return {
    id: 6,
    sku: 'DRY-001',
    name: 'A2 Gir Cow Ghee 500ml',
    hsn: '0405',
    price: 450,
    qty: qty
  };
}

test('check accepts qty 1 when sellable stock is 1', function () {
  var result = inventory.check([product(1, 0)], [orderLine(1)]);

  assert.deepEqual(result, { ok: true });
});

test('CURRENT BEHAVIOUR: check rejects qty 2 when sellable stock is 1', function () {
  var result = inventory.check([product(1, 0)], [orderLine(2)]);

  assert.deepEqual(result, {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: check accepts qty 0 when sellable stock is 1', function () {
  var result = inventory.check([product(1, 0)], [orderLine(0)]);

  assert.deepEqual(result, { ok: true });
});

test('check accepts the last sellable unit with stock 4 and reserved 3', function () {
  var result = inventory.check([product(4, 3)], [orderLine(1)]);

  assert.deepEqual(result, { ok: true });
});

test('reserve then cancel restores stock without changing reserved', function () {
  var line = orderLine(2);
  var db = {
    products: [product(4, 1)],
    orders: [{
      id: 1007,
      date: '04/03/2022',
      customer: 'Suresh Deshmukh',
      customerId: null,
      paymentMode: 'cash',
      status: 'pending',
      items: [line],
      coupon: '',
      subtotal: 900,
      discount: 0,
      tax: 108,
      total: 1008
    }]
  };
  var before = { stock: db.products[0].stock, reserved: db.products[0].reserved };

  inventory.reserve(db.products, [line]);
  var afterReserve = { stock: db.products[0].stock, reserved: db.products[0].reserved };
  var result = orders.cancel(db, 1007, 'Characterization test');
  var afterCancel = { stock: db.products[0].stock, reserved: db.products[0].reserved };

  assert.equal(result.ok, true);
  assert.deepEqual(before, { stock: 4, reserved: 1 });
  assert.deepEqual(afterReserve, { stock: 2, reserved: 1 });
  assert.deepEqual(afterCancel, { stock: 4, reserved: 1 });
});

test('allows the last sellable unit and restores cancelled stock exactly once', function () {
  var line = orderLine(1);
  var db = {
    products: [product(1, 0)],
    orders: [{
      id: 1009,
      date: '15/03/2022',
      customer: 'Walk-in',
      customerId: null,
      paymentMode: 'cash',
      status: 'pending',
      items: [line],
      coupon: '',
      subtotal: 450,
      discount: 0,
      tax: 54,
      total: 504
    }]
  };

  assert.deepEqual(inventory.check(db.products, [line]), { ok: true });
  inventory.reserve(db.products, [line]);
  assert.equal(db.products[0].stock, 0);

  assert.equal(orders.cancel(db, 1009, 'Regression test').ok, true);
  assert.equal(db.products[0].stock, 1);
  assert.equal(orders.cancel(db, 1009, 'Second cancellation').ok, false);
  assert.equal(db.products[0].stock, 1);
});
