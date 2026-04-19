import 'dotenv/config';
import prisma from '../src/utils/prisma';
import bcrypt from 'bcrypt';

async function seedAdmin() {
  const email = 'admin@esusu.com';
  const password = 'adminpassword123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', isVerified: true, password: hashedPassword }
    });
    console.log("Admin account updated.");
  } else {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email,
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true
      }
    });
    console.log("Admin account created.");
  }

  console.log("Email:", email);
  console.log("Password:", password);
}

seedAdmin()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
