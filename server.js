require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const skills = require("./data/skills");
const premiumSkills = require("./data/premiumSkills");

const app = express();
const PORT = process.env.PORT || 3000;
const REG_FILE = path.join(__dirname, "data", "registrations.json");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Data available to every template without repeating it in every route.
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// ---------- Email transport ----------
// Configure these in Render's Environment tab (or a local .env file). See .env.example.
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  console.warn(
    "[LearnLoop] SMTP is not configured — confirmation emails will be skipped. " +
    "Set SMTP_HOST, SMTP_USER and SMTP_PASS (see .env.example) to enable them."
  );
}

// ---------- Registration storage ----------
// NOTE: on Render's free tier, the filesystem is ephemeral — it resets on every
// deploy/restart. This JSON file is fine for a class project / demo, but for a
// real production site, swap readRegistrations/writeRegistrations for a database
// (Render Postgres is a one-click add-on) or a Google Sheets webhook.
function readRegistrations() {
  try {
    const raw = fs.readFileSync(REG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}
function writeRegistrations(list) {
  fs.writeFileSync(REG_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function makeRegistrationId() {
  return "LL-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// ---------- Page routes ----------
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/skills", (req, res) => {
  res.render("skills", { skills });
});

app.get("/skills/:slug", (req, res) => {
  const skill = skills.find((s) => s.slug === req.params.slug);
  if (!skill) return res.status(404).render("404");
  res.render("skill-detail", { skill });
});

app.get("/learn", (req, res) => {
  res.render("learn", { premiumSkills });
});

app.get("/learn/:slug", (req, res) => {
  const skill = premiumSkills.find((s) => s.slug === req.params.slug);
  if (!skill) return res.status(404).render("404");
  res.render("learn-detail", { skill });
});

app.get("/how-it-works", (req, res) => {
  res.render("how-it-works");
});

app.get("/pricing", (req, res) => {
  res.render("pricing");
});

app.get("/faq", (req, res) => {
  res.render("faq");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});

app.get("/join", (req, res) => {
  res.render("join", {
    skills,
    premiumSkills,
    preselectSkill: req.query.skill || "",
    preselectPlan: req.query.plan || ""
  });
});

// ---------- Registration submit ----------
app.post("/api/join", async (req, res) => {
  const {
    fullName,
    email,
    phone,
    city,
    skillToLearn,
    skillToTeach,
    plan,
    consent,
    website // honeypot field — real users never fill this in
  } = req.body;

  // Honeypot spam check
  if (website) {
    return res.redirect("/join/success?id=spam");
  }

  if (!fullName || !email || !city || !skillToLearn || !plan || !consent) {
    return res.status(400).render("join", {
      skills,
      premiumSkills,
      preselectSkill: skillToLearn || "",
      preselectPlan: plan || "",
      error: "Please fill in every required field and accept the Privacy Policy before submitting."
    });
  }

  const registrationId = makeRegistrationId();
  const record = {
    registrationId,
    fullName,
    email,
    phone: phone || "",
    city,
    skillToLearn,
    skillToTeach: skillToTeach || "",
    plan,
    status: "new",
    submittedAt: new Date().toISOString()
  };

  const all = readRegistrations();
  all.push(record);
  writeRegistrations(all);

  // Send confirmation email to the person who just joined, and a copy to the admin.
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: "You're in! Welcome to LearnLoop",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color:#1C6E4A;">Welcome to LearnLoop, ${fullName}!</h2>
            <p>You've successfully joined the <strong>${plan}</strong> program.</p>
            <p><strong>Your registration ID:</strong> ${registrationId}</p>
            <p><strong>Skill you want to learn:</strong> ${skillToLearn}</p>
            ${skillToTeach ? `<p><strong>Skill you can teach:</strong> ${skillToTeach}</p>` : ""}
            <p>We'll be in touch soon with your first match. In the meantime, feel free to browse more skills on LearnLoop.</p>
            <p style="color:#4A5C51; font-size: 13px; margin-top: 32px;">LearnLoop — Trade skills, not money.</p>
          </div>
        `
      });

      if (process.env.ADMIN_NOTIFY_EMAIL) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || process.env.SMTP_USER,
          to: process.env.ADMIN_NOTIFY_EMAIL,
          subject: `New LearnLoop registration: ${fullName} (${registrationId})`,
          html: `
            <p>New registration received.</p>
            <ul>
              <li>ID: ${registrationId}</li>
              <li>Name: ${fullName}</li>
              <li>Email: ${email}</li>
              <li>Phone: ${phone || "—"}</li>
              <li>City: ${city}</li>
              <li>Skill to learn: ${skillToLearn}</li>
              <li>Skill to teach: ${skillToTeach || "—"}</li>
              <li>Plan: ${plan}</li>
            </ul>
          `
        });
      }
    } catch (err) {
      console.error("[LearnLoop] Failed to send confirmation email:", err.message);
      // We don't fail the registration just because email didn't send — the
      // signup itself is already saved.
    }
  }

  res.redirect(`/join/success?id=${registrationId}`);
});

app.get("/join/success", (req, res) => {
  res.render("join-success", { registrationId: req.query.id || "" });
});

// ---------- Admin: download all registrations as CSV ----------
app.get("/admin/export", (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(403).send("Forbidden — add ?key=YOUR_ADMIN_KEY (set in your environment variables).");
  }
  const all = readRegistrations();
  const header = "Registration ID,Timestamp,Name,Email,Phone,City,Skill to Learn,Skill to Teach,Plan,Status\n";
  const rows = all
    .map((r) =>
      [
        r.registrationId,
        r.submittedAt,
        r.fullName,
        r.email,
        r.phone,
        r.city,
        r.skillToLearn,
        r.skillToTeach,
        r.plan,
        r.status
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=learnloop-registrations.csv");
  res.send(header + rows);
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(PORT, () => {
  console.log(`LearnLoop running on port ${PORT}`);
});
