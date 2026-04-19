import nodemailer from 'nodemailer';

async function createTestAccount() {
  const testAccount = await nodemailer.createTestAccount();

  console.log("USER:", testAccount.user);
  console.log("PASS:", testAccount.pass);
}

createTestAccount();
