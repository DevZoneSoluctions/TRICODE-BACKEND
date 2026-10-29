import nodemailer from "nodemailer";

// ─── Helpers ───────────────────────────────────────────────────────────────
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());

const buildEmailHTML = (data) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 32px auto; background: #fff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 24px rgba(37,99,235,0.07); }
    .header { background: linear-gradient(135deg, #00D2FF 0%, #2563EB 45%, #7C3AED 100%); padding: 32px 36px 24px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px 36px; }
    .field { margin-bottom: 20px; }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 4px; }
    .value { font-size: 15px; color: #0F172A; font-weight: 500; line-height: 1.5; }
    .message-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; color: #334155; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
    .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 36px; text-align: center; color: #94A3B8; font-size: 11px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; background: #EFF6FF; color: #2563EB; font-size: 11px; font-weight: 700; border: 1px solid #BFDBFE; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📬 New Project Inquiry — TRICODE AI</h1>
      <p>A visitor submitted the contact form on your website.</p>
    </div>
    <div class="body">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;">
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Full Name</div>
          <div class="value">${data.name}</div>
        </div>
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Work Email</div>
          <div class="value"><a href="mailto:${data.email}" style="color:#2563EB;text-decoration:none;">${data.email}</a></div>
        </div>
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;">
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Company / Organization</div>
          <div class="value">${data.company || "—"}</div>
        </div>
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Target Capability</div>
          <div class="value"><span class="badge">${data.service}</span></div>
        </div>
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;">
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Estimated Budget</div>
          <div class="value">${data.budget}</div>
        </div>
        <div class="field" style="flex:1;min-width:180px;">
          <div class="label">Target Timeline</div>
          <div class="value">${data.timeline}</div>
        </div>
      </div>
      <div class="field">
        <div class="label">Project Requirements</div>
        <div class="message-box">${data.message}</div>
      </div>
    </div>
    <div class="footer">
      <p>Reply directly to this email — it will go to <strong>${data.email}</strong><br/>
      TRICODE AI Technologies &nbsp;|&nbsp; Automated Contact System</p>
    </div>
  </div>
</body>
</html>
`;

// ─── Vercel Serverless Function Handler ────────────────────────────────────
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed. Please use POST.`,
    });
  }

  try {
    const { name, email, company, service, budget, timeline, message } = req.body || {};

    // ── Input Validation ──
    const errors = {};
    if (!name || String(name).trim().length < 2) {
      errors.name = "Name is required (at least 2 characters).";
    }
    if (!email || !isValidEmail(email)) {
      errors.email = "A valid email address is required.";
    }
    if (!message || String(message).trim().length < 15) {
      errors.message = "Message must be at least 15 characters.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // ── Environment Credentials Check ──
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const receiveEmail = process.env.RECEIVE_EMAIL || emailUser;

    if (!emailUser || !emailPass) {
      console.error("[Vercel /api/contact] Missing EMAIL_USER or EMAIL_PASS environment variables.");
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact the administrator directly.",
      });
    }

    // ── Sanitize Data ──
    const payload = {
      name: String(name).trim().slice(0, 100),
      email: String(email).trim().toLowerCase().slice(0, 200),
      company: company ? String(company).trim().slice(0, 150) : "",
      service: service ? String(service).trim().slice(0, 150) : "Not specified",
      budget: budget ? String(budget).trim().slice(0, 50) : "Not specified",
      timeline: timeline ? String(timeline).trim().slice(0, 80) : "Not specified",
      message: String(message).trim().slice(0, 5000),
    };

    // ── Setup Nodemailer Transporter ──
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // ── Send Email ──
    await transporter.sendMail({
      from: `"TRICODE AI Contact" <${emailUser}>`,
      to: receiveEmail,
      replyTo: payload.email,
      subject: `[TRICODE] New Inquiry from ${payload.name} — ${payload.service}`,
      html: buildEmailHTML(payload),
      text: `New inquiry from ${payload.name} (${payload.email})\n\nCompany: ${payload.company || "—"}\nService: ${payload.service}\nBudget: ${payload.budget}\nTimeline: ${payload.timeline}\n\nMessage:\n${payload.message}`,
    });

    return res.status(200).json({
      success: true,
      message: "Your inquiry has been received. We will respond within 24 hours.",
    });
  } catch (err) {
    console.error("[Vercel /api/contact] Error sending email:", err);
    return res.status(500).json({
      success: false,
      message: "We could not process your request right now. Please try again later or email us directly.",
    });
  }
}
