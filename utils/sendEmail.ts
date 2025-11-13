import nodemailer from 'nodemailer';

interface EmailOptions {
  email: string;
  subject: string;
  message?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    auth: {
      user: process.env.EMAIL_USER || 'maddison53@ethereal.email',
      pass: process.env.EMAIL_PASS || 'jn7jnAPss4f63QBp6D',
    },
  });

  const mailOptions = {
    from: '"Prokṛishi" <noreply@prokrishi.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(mailOptions);

  console.log('Message sent: %s', info.messageId);
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
};

export default sendEmail;

