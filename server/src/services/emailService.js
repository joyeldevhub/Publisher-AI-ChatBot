const nodemailer = require('nodemailer');

const ALERT_EMAIL = 'alexjoyelraj23@gmail.com';

async function sendThumbsDownAlert(question, answer) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[DocFlow] SMTP_USER/SMTP_PASS not set — thumbsdown email skipped');
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const safe = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  await transporter.sendMail({
    from: `"DocFlow Bot" <${process.env.SMTP_USER}>`,
    to: ALERT_EMAIL,
    subject: '🔴 DocFlow — Unhelpful Response Flagged',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#8B3CF7,#17C8CE);padding:24px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;font-size:20px;">DocFlow Feedback Alert</h2>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">A user marked a response as unhelpful (👎)</p>
        </div>
        <div style="background:#f8f8fc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e8e8f0;border-top:none;">
          <h3 style="color:#1e1e2e;margin:0 0 8px;font-size:15px;">User Question</h3>
          <div style="background:white;padding:16px;border-radius:8px;border-left:4px solid #8B3CF7;margin-bottom:20px;font-size:14px;line-height:1.6;">${safe(question)}</div>
          <h3 style="color:#1e1e2e;margin:0 0 8px;font-size:15px;">DocFlow Response</h3>
          <div style="background:white;padding:16px;border-radius:8px;border-left:4px solid #ef4444;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safe(answer).slice(0, 3000)}</div>
          <hr style="border:none;border-top:1px solid #e8e8f0;margin:20px 0;">
          <p style="color:#999;font-size:12px;margin:0;">Sent automatically by DocFlow. Please review and update the knowledge base.</p>
        </div>
      </div>`,
  });
}

module.exports = { sendThumbsDownAlert };
