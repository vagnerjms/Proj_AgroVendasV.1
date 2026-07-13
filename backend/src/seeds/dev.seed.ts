import mongoose from 'mongoose';
import { CustomerSchema } from '../modules/customers/schemas/customer.schema';
import { ProductSchema } from '../modules/products/schemas/product.schema';
import { ProducerSchema } from '../modules/producers/schemas/producer.schema';

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://localhost:27017/agrovenda_broker';

const products = [
  'Batata Especial',
  'Batata Primeira X',
  'Batata Diversa',
  'Batata Bolinha',
  'Batata',
  'Cebola Cx 1',
  'Cebola Cx 2',
  'Cebola Cx 3',
  'Cebola Cx 4',
  'Cebola',
  'Alho 1',
  'Alho 2',
  'Alho 3',
  'Alho 4',
  'Alho 5',
  'Alho 6',
  'Cenoura',
  'Abóbora Cabotiá',
];

function toInternalCode(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function run() {
  await mongoose.connect(mongoUri);
  const Product = mongoose.model('Product', ProductSchema);
  const Producer = mongoose.model('Producer', ProducerSchema);
  const Customer = mongoose.model('Customer', CustomerSchema);

  for (const name of products) {
    const internalCode = toInternalCode(name);
    await Product.updateOne(
      { internalCode },
      {
        $setOnInsert: {
          name,
          category: name.startsWith('Batata')
            ? 'Batata'
            : name.startsWith('Cebola')
              ? 'Cebola'
              : name.startsWith('Alho')
                ? 'Alho'
                : name,
          variety: name,
          defaultUnit: name.includes('Cx') ? 'caixa' : 'kg',
          active: true,
          internalCode,
          marketReferenceEnabled: true,
          isDeleted: false,
        },
      },
      { upsert: true },
    );
  }

  await Producer.updateOne(
    { documentNumber: '00000000000191' },
    {
      $setOnInsert: {
        name: 'Fazenda Modelo Hortifruti',
        documentType: 'cnpj',
        documentNumber: '00000000000191',
        stateRegistration: 'ISENTO',
        ruralRegistration: 'PR-0001',
        address: 'Estrada Rural, km 10',
        city: 'Ponta Grossa',
        state: 'PR',
        pixKey: 'fazenda@example.com',
        bankInfo: { bank: 'Banco Modelo', agency: '0001', account: '12345-6' },
        funruralConfig: { enabled: true, rate: 0.015 },
        accountantContact: { name: 'Contador Modelo', phone: '41999990000' },
        active: true,
        isDeleted: false,
      },
    },
    { upsert: true },
  );

  await Customer.updateOne(
    { documentNumber: '00000000000272' },
    {
      $setOnInsert: {
        name: 'Cliente Modelo Ceasa',
        documentType: 'cnpj',
        documentNumber: '00000000000272',
        stateRegistration: 'ISENTO',
        deliveryAddress: 'Box 10',
        city: 'São Paulo',
        state: 'SP',
        whatsapp: '11999990000',
        creditLimit: 50000,
        financialStatus: 'ok',
        active: true,
        isDeleted: false,
      },
    },
    { upsert: true },
  );

  console.log(`Seed concluido: ${products.length} produtos, 1 produtor e 1 cliente verificados/criados.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
