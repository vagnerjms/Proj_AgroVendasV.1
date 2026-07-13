import mongoose from 'mongoose';
import { UserSchema } from '../modules/users/schemas/user.schema';

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://localhost:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const User = mongoose.model('User', UserSchema);

  const email = 'admin@agrovenda.local';
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Admin ja existe: ${email}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name: 'Administrador AgroVenda',
    email,
    passwordHash: 'Admin123!',
    role: 'admin',
    active: true,
    isDeleted: false,
  });

  console.log(`Admin criado: ${email} / senha: Admin123!`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
