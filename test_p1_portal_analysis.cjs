const assert = require('node:assert/strict');
const { createPortalService } = require('./server/dist/services/portalService.js');

async function main() {
  const bill = {
    id: 'bill-p1', customerId: 'cust-1', customerName: 'Customer', fileName: 'bill.pdf', storagePath: 'cust-1/bill.pdf',
    mimeType: 'application/pdf', fileSizeBytes: 8, fileSizeKb: 1, utilityType: 'luce', status: 'in_review',
    uploadDate: '2026-09-17', createdAt: '2026-09-17T00:00:00.000Z',
  };
  let persisted;
  const backend = {
    uploadBill: async () => {}, insertBill: async record => record, removeBill: async () => {},
    listBills: async () => [bill], getBill: async id => id === bill.id ? bill : null,
    getBillDownload: async () => ({ kind: 'bytes', bytes: Buffer.from('%PDF-p1'), mimeType: 'application/pdf' }),
    getBillBytes: async () => ({ bytes: Buffer.from('%PDF-p1'), mimeType: 'application/pdf' }),
    updateBillAnalysis: async (_id, analysis) => { persisted = analysis; return { ...bill, ...analysis }; },
    insertReading: async record => record, listReadings: async () => [],
  };
  const analyzer = async () => ({
    fileName: bill.fileName, utilityType: 'luce', podOrPdr: 'IT001E12345678', supplier: 'Supplier',
    customerName: 'Customer', fiscalCode: 'RSSMRA80A01H501U', annualConsumption: 2500,
    rawCostTotal: 100, estimatedSavingEur: 125, confidenceScore: 95,
    currentUnitCost: 0.2, currentFixedFeeYear: 100,
  });
  const service = createPortalService(backend, () => new Date('2026-09-17T00:00:00.000Z'), analyzer);
  assert.equal(typeof service.analyzeBill, 'function', 'stored-bill analysis service must exist');
  const result = await service.analyzeBill(bill.id);
  assert.equal(result.bill.status, 'analyzed');
  assert.equal(result.bill.extractedSavingsEur, 125);
  assert.equal(persisted.ocrResult.podOrPdr, 'IT001E12345678');
  console.log('P1 portal analysis regression tests passed.');
}

main().catch(error => { console.error(error); process.exit(1); });
