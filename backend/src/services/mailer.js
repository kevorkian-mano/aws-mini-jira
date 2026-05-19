const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

const getFromAddress = () => process.env.SMTP_FROM || process.env.SMTP_USER;

const sendTaskAssignedEmail = async ({ to, taskTitle, assigneeName, teamName, deadline }) => {
  if (!to) {
    throw new Error("Assignee email is missing");
  }

  const from = getFromAddress();
  if (!from) {
    throw new Error("SMTP_FROM or SMTP_USER must be configured");
  }

  const subject = `New task assigned: ${taskTitle}`;
  const text = [
    `Hi ${assigneeName || "there"},`,
    "",
    `A new task has been assigned to you: ${taskTitle}`,
    teamName ? `Team: ${teamName}` : null,
    deadline ? `Deadline: ${deadline}` : null,
    "",
    "Please log in to the app to review the full details.",
  ].filter(Boolean).join("\n");

  await transport.sendMail({
    from,
    to,
    subject,
    text,
  });
};

module.exports = { sendTaskAssignedEmail };