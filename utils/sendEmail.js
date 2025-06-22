import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  // Create a transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    auth: {
      user: process.env.EMAIL_USER || 'maddison53@ethereal.email',
      pass: process.env.EMAIL_PASS || 'jn7jnAPss4f63QBp6D',
    },
  });

  // Define the email options
  const mailOptions = {
    from: '"Prokṛishi" <noreply@prokrishi.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  // Send the email
  const info = await transporter.sendMail(mailOptions);

  console.log('Message sent: %s', info.messageId);
  // Preview only available when sending through an Ethereal account
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
};

export default sendEmail; 